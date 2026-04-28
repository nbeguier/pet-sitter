#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME_HTML = path.join(ROOT, 'game', 'pet-sitter.html');
const DEFAULT_N = 1000;
const DEFAULT_MAX_WEEKS = 260;
const DEFAULT_POINT_VALUE = 70;
const FOUR_MONTHS_WEEKS = Math.floor((52 * 4) / 12);

function parseArgs(argv) {
  const options = {
    n: DEFAULT_N,
    maxWeeks: DEFAULT_MAX_WEEKS,
    pointValue: DEFAULT_POINT_VALUE,
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--n' && argv[i + 1]) options.n = Number(argv[++i]);
    else if (arg === '--max-weeks' && argv[i + 1]) options.maxWeeks = Number(argv[++i]);
    else if (arg === '--point-value' && argv[i + 1]) options.pointValue = Number(argv[++i]);
  }

  return options;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function seededMath(seed) {
  let state = seed >>> 0;
  const next = () => {
    state += 0x6D2B79F5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const math = {};
  for (const key of Object.getOwnPropertyNames(Math)) math[key] = Math[key];
  math.random = next;
  return math;
}

function extractScript(html) {
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) throw new Error('Impossible de trouver le script du jeu.');
  return match[1];
}

function makeContext(compiledGame, seed) {
  const app = { innerHTML: '' };
  const help = { style: { display: 'none' } };

  const sandbox = {
    console,
    Date,
    Set,
    Map,
    JSON,
    Math: seededMath(seed),
    NodeFilter: { SHOW_TEXT: 4 },
    performance: { now() { return 0; } },
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    document: {
      getElementById(id) {
        if (id === 'app') return app;
        if (id === 'help-overlay') return help;
        return { innerHTML: '', style: { display: 'none' } };
      },
      createTreeWalker() {
        return { nextNode() { return null; } };
      },
    },
  };

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  compiledGame.runInContext(sandbox);
  sandbox.__simConsts = vm.runInContext('({ WEEKLY_FOOD, VICTORY_POINTS })', sandbox);

  sandbox.render = function renderNoop() {};
  sandbox.saveGame = function saveNoop() {};
  sandbox.window.confirm = () => true;

  return sandbox;
}

function snapshotState(ctx) {
  const state = ctx.STATE;
  return JSON.stringify({
    ...state,
    achievements: [...state.achievements],
    animalsDone: [...state.animalsDone],
    housingsDone: [...state.housingsDone],
    continentsDone: [...state.continentsDone],
    transportModesDone: [...state.transportModesDone],
  });
}

function restoreState(ctx, snapshot) {
  const parsed = JSON.parse(snapshot);
  Object.assign(ctx.STATE, ctx.buildDefaultState(), parsed);
  ctx.normalizeLoadedState(parsed);
}

function startGame(ctx) {
  ctx.STATE.characterName = 'Bot';
  ctx.STATE.characterIcon = '🧳';
  ctx.startGame();
}

function evaluateState(ctx, pointValue) {
  const week = ctx.STATE.week;
  const pendingMissions = ctx.STATE.agenda.filter(mission => mission.endWeek > week);
  const futureStarts = ctx.STATE.agenda.filter(mission => mission.startWeek > week);
  const futurePoints = pendingMissions.reduce((sum, mission) => sum + mission.points, 0);
  const futurePay = futureStarts.reduce((sum, mission) => sum + mission.payTotal, 0);
  const futureTravel = futureStarts.reduce((sum, mission) => sum + (mission.travelCost || 0), 0);
  const horizon = Math.max(week, ...pendingMissions.map(mission => mission.endWeek));
  const projectedCash = ctx.STATE.balance + futurePay - futureTravel - (ctx.__simConsts.WEEKLY_FOOD * (horizon - week));
  const projectedPoints = ctx.STATE.points + futurePoints;

  let score = projectedCash + (pointValue * projectedPoints);
  if (projectedCash < 0) score -= 1500;
  if (ctx.STATE.phase === 'over' && ctx.STATE.endReason === 'defeat') score -= 1000000;
  if (ctx.STATE.phase === 'over' && ctx.STATE.endReason === 'victory') score += 1000000;

  return { score, projectedCash, projectedPoints, horizon };
}

function cancellableVariants(ctx, mode) {
  if (mode == null) return [false];
  return ctx.isAutoCancellableMode(mode) ? [false] : [false, true];
}

function uniqueModes(options) {
  return [...new Set((options || []).map(option => option.mode))];
}

function buildMissionCandidates(ctx) {
  const originalSnapshot = snapshotState(ctx);
  const baseline = [];

  restoreState(ctx, originalSnapshot);
  ctx.refuseCard();
  baseline.push({
    action: 'refuse',
    transportKey: 'refuse',
    ...evaluateState(ctx, currentPointValue),
  });

  restoreState(ctx, originalSnapshot);
  const card = ctx.STATE.pendingCard;
  const inboundModes = uniqueModes(card.inboundOptions);
  const outboundModes = card.nextMissionId ? uniqueModes(card.outboundOptions) : [null];
  const seen = new Set(['refuse']);

  for (const inboundMode of (inboundModes.length ? inboundModes : [null])) {
    for (const inboundCancellable of cancellableVariants(ctx, inboundMode)) {
      for (const outboundMode of (outboundModes.length ? outboundModes : [null])) {
        for (const outboundCancellable of cancellableVariants(ctx, outboundMode)) {
          restoreState(ctx, originalSnapshot);
          const pending = ctx.STATE.pendingCard;
          pending.selectedInboundMode = inboundMode;
          pending.selectedInboundCancellable = inboundCancellable;
          pending.selectedOutboundMode = outboundMode;
          pending.selectedOutboundCancellable = outboundCancellable;
          ctx.refreshPendingMissionSelections(pending);

          const selectionSnapshot = snapshotState(ctx);
          const selected = ctx.STATE.pendingCard;
          const transportKey = [
            selected.selectedInboundMode || 'none',
            selected.selectedInboundCancellable ? 'c1' : 'c0',
            selected.selectedOutboundMode || 'none',
            selected.selectedOutboundCancellable ? 'c1' : 'c0',
          ].join('|');

          const actions = [];
          if (selected.feasible && selected.selectedInbound) actions.push('accept');
          if (selected.canAcceptByCancellingOverlap && selected.selectedInbound) actions.push('accept_overlap');
          if (selected.canAcceptByCancellingNextMission && selected.selectedInbound) actions.push('accept_next');

          for (const action of actions) {
            const actionKey = `${transportKey}|${action}`;
            if (seen.has(actionKey)) continue;
            seen.add(actionKey);

            restoreState(ctx, selectionSnapshot);
            if (action === 'accept') ctx.acceptCard();
            else if (action === 'accept_overlap') ctx.acceptCardByCancellingOverlap();
            else if (action === 'accept_next') ctx.acceptCardByCancellingNextMission();

            baseline.push({
              action,
              transportKey,
              ...evaluateState(ctx, currentPointValue),
            });
          }
        }
      }
    }
  }

  restoreState(ctx, originalSnapshot);
  return baseline;
}

function resolvePendingCard(ctx) {
  const card = ctx.STATE.pendingCard;
  if (!card) return;

  if (card.kind === 'chance') {
    ctx.acceptCard();
    return;
  }

  const candidates = buildMissionCandidates(ctx);
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const originalSnapshot = snapshotState(ctx);

  if (!best || best.action === 'refuse') {
    ctx.refuseCard();
    return;
  }

  restoreState(ctx, originalSnapshot);
  const pending = ctx.STATE.pendingCard;
  const [inboundMode, inboundCancellableKey, outboundMode, outboundCancellableKey] = best.transportKey.split('|');
  pending.selectedInboundMode = inboundMode === 'none' ? null : inboundMode;
  pending.selectedInboundCancellable = inboundCancellableKey === 'c1';
  pending.selectedOutboundMode = outboundMode === 'none' ? null : outboundMode;
  pending.selectedOutboundCancellable = outboundCancellableKey === 'c1';
  ctx.refreshPendingMissionSelections(pending);

  if (best.action === 'accept') ctx.acceptCard();
  else if (best.action === 'accept_overlap') ctx.acceptCardByCancellingOverlap();
  else if (best.action === 'accept_next') ctx.acceptCardByCancellingNextMission();
}

function simulateOne(compiledGame, seed, maxWeeks, pointValue) {
  const ctx = makeContext(compiledGame, seed);
  startGame(ctx);

  const weeklyBalances = [];

  while (ctx.STATE.phase === 'playing' && ctx.STATE.week < maxWeeks) {
    while (ctx.STATE.pendingCard) resolvePendingCard(ctx);
    ctx.nextTurn();
    while (ctx.STATE.pendingCard) resolvePendingCard(ctx);
    weeklyBalances.push(ctx.STATE.balance);
  }

  const result = ctx.STATE.phase === 'over' ? ctx.STATE.endReason : 'timeout';
  return {
    result,
    weeks: ctx.STATE.week,
    balance: ctx.STATE.balance,
    week52Balance: weeklyBalances.length >= 52 ? weeklyBalances[51] : null,
    carriedYear1Balance: weeklyBalances.length >= 52 ? weeklyBalances[51] : ctx.STATE.balance,
  };
}

function summarize(results, options) {
  const defeats = results.filter(result => result.result === 'defeat');
  const week52Survivors = results.filter(result => result.week52Balance != null).map(result => result.week52Balance);

  return {
    strategy: 'balanced_bot',
    n: results.length,
    maxWeeks: options.maxWeeks,
    pointValue: options.pointValue,
    winRate: results.filter(result => result.result === 'victory').length / results.length,
    defeatRate: defeats.length / results.length,
    timeoutRate: results.filter(result => result.result === 'timeout').length / results.length,
    defeatRateFirst4Months: defeats.filter(result => result.weeks <= FOUR_MONTHS_WEEKS).length / results.length,
    medianWeekDefeat: median(defeats.map(result => result.weeks)),
    medianBalanceYear1Carry: median(results.map(result => result.carriedYear1Balance)),
    medianBalanceWeek52Survivors: median(week52Survivors),
    week52SurvivorRate: week52Survivors.length / results.length,
  };
}

function printSummary(summary, options) {
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`Simulation actuelle du jeu (${summary.n} parties, bot=${summary.strategy})`);
  console.log(`- Victoires : ${(summary.winRate * 100).toFixed(1)} %`);
  console.log(`- Défaites : ${(summary.defeatRate * 100).toFixed(1)} %`);
  console.log(`- Timeouts : ${(summary.timeoutRate * 100).toFixed(1)} %`);
  console.log(`- Semaine médiane de défaite : ${summary.medianWeekDefeat == null ? 'n/a' : summary.medianWeekDefeat.toFixed(1)}`);
  console.log(`- Solde médian à la fin de la 1re année (ou dernier solde si mort avant) : ${summary.medianBalanceYear1Carry == null ? 'n/a' : summary.medianBalanceYear1Carry.toFixed(0)} €`);
  console.log(`- Solde médian à S52 parmi les survivants : ${summary.medianBalanceWeek52Survivors == null ? 'n/a' : summary.medianBalanceWeek52Survivors.toFixed(0)} €`);
  console.log(`- Taux de survie jusqu'à S52 : ${(summary.week52SurvivorRate * 100).toFixed(1)} %`);
  console.log(`- Défaites dans les 4 premiers mois (~${FOUR_MONTHS_WEEKS} semaines) : ${(summary.defeatRateFirst4Months * 100).toFixed(1)} %`);
}

const options = parseArgs(process.argv.slice(2));
const gameHtml = fs.readFileSync(GAME_HTML, 'utf8');
const compiledGame = new vm.Script(extractScript(gameHtml), { filename: GAME_HTML });
let currentPointValue = options.pointValue;

const results = [];
for (let seed = 0; seed < options.n; seed++) {
  results.push(simulateOne(compiledGame, seed + 1, options.maxWeeks, options.pointValue));
}

printSummary(summarize(results, options), options);
