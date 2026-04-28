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
const STRATEGY_LOOKAHEAD_WEEKS = 16;
const ECOLO_KEEP_BONUS = 900;
const ECOLO_LOSE_PENALTY = 2400;

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
  sandbox.__simConsts = vm.runInContext('({ WEEKLY_FOOD_BASE, currentWeeklyFood, averageWeeklyFood, VICTORY_POINTS, ACHIEVEMENT_POINTS, PEKIN_EXPRESS_MODES, ANIMAL_ORDER, HOUSING_ORDER, CONTINENT_ORDER })', sandbox);

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
  const futureTravel = futureStarts.reduce((sum, mission) => sum + (mission.travelCost || 0) + (mission.accessCost || 0), 0);
  const horizon = Math.max(week + STRATEGY_LOOKAHEAD_WEEKS, ...pendingMissions.map(mission => mission.endWeek));
  let projectedFood = 0;
  const parentsDepartureWeek = ctx.STATE.atParents ? ctx.getParentsDepartureWeek() : null;
  for (let w = week; w < horizon; w++) {
    const sheltered = ctx.STATE.atParents && (parentsDepartureWeek == null || w < parentsDepartureWeek);
    if (!sheltered) projectedFood += ctx.__simConsts.currentWeeklyFood(w);
  }
  const projectedCash = ctx.STATE.balance + futurePay - futureTravel - projectedFood;
  const projectedAchievementState = buildProjectedAchievementState(ctx);
  const currentAchievementPoints = sumAchievementPoints(ctx.__simConsts.ACHIEVEMENT_POINTS, ctx.STATE.achievements);
  const projectedAchievementPoints = sumAchievementPoints(ctx.__simConsts.ACHIEVEMENT_POINTS, projectedAchievementState.achieved);
  const projectedAchievementDelta = projectedAchievementPoints - currentAchievementPoints;
  const projectedPoints = ctx.STATE.points + futurePoints + projectedAchievementDelta;
  const projectedAchievementProgressEquivalent = getProjectedAchievementProgressEquivalent(ctx, projectedAchievementState);

  let score = projectedCash + (pointValue * projectedPoints);
  score += pointValue * projectedAchievementProgressEquivalent;
  score += (projectedPoints / Math.max(8, horizon - week)) * pointValue * 0.35;
  if (ctx.STATE.achievements.has('ecolo')) {
    if (projectedAchievementState.achieved.has('ecolo')) score += ECOLO_KEEP_BONUS;
    else score -= ECOLO_LOSE_PENALTY + (projectedAchievementState.planeLegsPlanned * 600);
  }
  if (projectedCash < 0) score -= 1500;
  if (ctx.STATE.phase === 'over' && ctx.STATE.endReason === 'defeat') score -= 1000000;
  if (ctx.STATE.phase === 'over' && ctx.STATE.endReason === 'victory') score += 1000000;

  return {
    score,
    projectedCash,
    projectedPoints,
    projectedAchievementPoints,
    projectedAchievementProgressEquivalent,
    projectedAchievementState,
    horizon,
  };
}

function cancellableVariants(ctx, mode) {
  if (mode == null) return [false];
  return ctx.isAutoCancellableMode(mode) ? [false] : [false, true];
}

function uniqueModes(options) {
  return [...new Set((options || []).map(option => option.mode))];
}

function sumAchievementPoints(pointsMap, achieved) {
  let total = 0;
  for (const key of achieved) total += pointsMap[key] || 0;
  return total;
}

function buildProjectedAchievementState(ctx) {
  const week = ctx.STATE.week;
  const achieved = new Set(ctx.STATE.achievements);
  const typeCount = { ...ctx.STATE.typeCount };
  const animalsDone = new Set(ctx.STATE.animalsDone);
  const housingsDone = new Set(ctx.STATE.housingsDone);
  const continentsDone = new Set(ctx.STATE.continentsDone);
  const transportModesDone = new Set(ctx.STATE.transportModesDone);
  let potesCount = ctx.STATE.potesCount;
  let ecoloActive = achieved.has('ecolo');
  let planeLegsPlanned = 0;

  const futureStarts = ctx.STATE.agenda
    .filter(mission => mission.startWeek > week)
    .sort((a, b) => a.startWeek - b.startWeek);
  for (const mission of futureStarts) {
    const travelLegs = ctx.getMissionTravelLegs(mission) || [];
    for (const leg of travelLegs) {
      if (!leg || leg.mode === 'none') continue;
      if (leg.mode === 'plane') {
        ecoloActive = false;
        planeLegsPlanned++;
      }
      if (ctx.__simConsts.PEKIN_EXPRESS_MODES.includes(leg.mode)) transportModesDone.add(leg.mode);
    }
  }

  const pendingMissions = ctx.STATE.agenda
    .filter(mission => mission.endWeek > week)
    .sort((a, b) => a.endWeek - b.endWeek);
  for (const mission of pendingMissions) {
    typeCount[mission.type] = (typeCount[mission.type] || 0) + 1;
    if (mission.animal) animalsDone.add(mission.animal);
    if (mission.housing) housingsDone.add(mission.housing);
    if (mission.city && mission.city.continent) continentsDone.add(mission.city.continent);
    if (mission.hasPotes) potesCount++;
  }

  if (!ecoloActive) achieved.delete('ecolo');
  if (typeCount.dog >= 5) achieved.add('expert_chien');
  if (typeCount.house >= 5) achieved.add('ermite');
  if (animalsDone.size >= ctx.__simConsts.ANIMAL_ORDER.length) achieved.add('bestiaire');
  if (housingsDone.size >= ctx.__simConsts.HOUSING_ORDER.length) achieved.add('agent_immo');
  if (ctx.__simConsts.PEKIN_EXPRESS_MODES.every(mode => transportModesDone.has(mode))) achieved.add('pekin_express');
  if (continentsDone.size >= ctx.__simConsts.CONTINENT_ORDER.length) achieved.add('globetrotter');
  if (potesCount >= 5) achieved.add('kiffeur');

  return {
    achieved,
    typeCount,
    animalsDone,
    housingsDone,
    continentsDone,
    transportModesDone,
    potesCount,
    planeLegsPlanned,
  };
}

function getProjectedAchievementProgressEquivalent(ctx, projected) {
  const pts = ctx.__simConsts.ACHIEVEMENT_POINTS;
  let equivalentPoints = 0;

  const addProgress = (isDone, progress, total, rewardPoints, weight) => {
    if (isDone || total <= 0) return;
    equivalentPoints += (progress / total) * rewardPoints * weight;
  };

  addProgress(projected.achieved.has('expert_chien'), projected.typeCount.dog, 5, pts.expert_chien, 0.35);
  addProgress(projected.achieved.has('ermite'), projected.typeCount.house, 5, pts.ermite, 0.20);
  addProgress(projected.achieved.has('bestiaire'), projected.animalsDone.size, ctx.__simConsts.ANIMAL_ORDER.length, pts.bestiaire, 1.45);
  addProgress(projected.achieved.has('agent_immo'), projected.housingsDone.size, ctx.__simConsts.HOUSING_ORDER.length, pts.agent_immo, 0.55);
  addProgress(projected.achieved.has('pekin_express'), projected.transportModesDone.size, ctx.__simConsts.PEKIN_EXPRESS_MODES.length, pts.pekin_express, 0.35);
  addProgress(projected.achieved.has('globetrotter'), projected.continentsDone.size, ctx.__simConsts.CONTINENT_ORDER.length, pts.globetrotter, 0.25);
  addProgress(projected.achieved.has('kiffeur'), projected.potesCount, 5, pts.kiffeur, 1.25);
  if (projected.achieved.has('ecolo')) equivalentPoints += pts.ecolo * 0.75;

  return equivalentPoints;
}

function buildHomeCandidates(ctx) {
  const originalSnapshot = snapshotState(ctx);
  const baseline = [{
    action: 'stay',
    transportKey: 'stay',
    ...evaluateState(ctx, currentPointValue),
  }];

  restoreState(ctx, originalSnapshot);
  ctx.offerReturnHome();
  if (!ctx.STATE.pendingCard || ctx.STATE.pendingCard.kind !== 'home') {
    restoreState(ctx, originalSnapshot);
    return baseline;
  }

  const card = ctx.STATE.pendingCard;
  const inboundModes = uniqueModes(card.inboundOptions);
  const outboundModes = card.nextMissionId ? uniqueModes(card.outboundOptions) : [null];
  const seen = new Set(['stay']);

  for (const inboundMode of (inboundModes.length ? inboundModes : [null])) {
    for (const outboundMode of (outboundModes.length ? outboundModes : [null])) {
      for (const outboundCancellable of cancellableVariants(ctx, outboundMode)) {
        restoreState(ctx, originalSnapshot);
        ctx.offerReturnHome();
        const pending = ctx.STATE.pendingCard;
        if (!pending || pending.kind !== 'home') continue;
        pending.selectedInboundMode = inboundMode;
        pending.selectedOutboundMode = outboundMode;
        pending.selectedOutboundCancellable = outboundCancellable;
        ctx.refreshPendingHomeSelections(pending);

        const selectionSnapshot = snapshotState(ctx);
        const selected = ctx.STATE.pendingCard;
        const transportKey = [
          selected.selectedInboundMode || 'none',
          selected.selectedOutboundMode || 'none',
          selected.selectedOutboundCancellable ? 'c1' : 'c0',
        ].join('|');

        const actions = [];
        if (selected.feasible && selected.selectedInbound) actions.push('accept');
        if (selected.canAcceptByCancellingNextMission && selected.selectedInbound) actions.push('accept_next');

        for (const action of actions) {
          const actionKey = `${transportKey}|${action}`;
          if (seen.has(actionKey)) continue;
          seen.add(actionKey);

          restoreState(ctx, selectionSnapshot);
          if (action === 'accept') ctx.acceptHomeCard();
          else if (action === 'accept_next') ctx.acceptHomeCardByCancellingNextMission();

          baseline.push({
            action,
            transportKey,
            ...evaluateState(ctx, currentPointValue),
          });
        }
      }
    }
  }

  restoreState(ctx, originalSnapshot);
  return baseline;
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

  const candidates = card.kind === 'home'
    ? buildHomeCandidates(ctx)
    : buildMissionCandidates(ctx);
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const originalSnapshot = snapshotState(ctx);

  if (!best || best.action === 'refuse' || best.action === 'stay') {
    if (card.kind === 'home') ctx.discardPendingCard('Retour chez les parents refusé.');
    else ctx.refuseCard();
    return;
  }

  restoreState(ctx, originalSnapshot);
  const pending = ctx.STATE.pendingCard;

  if (pending.kind === 'home') {
    const [inboundMode, outboundMode, outboundCancellableKey] = best.transportKey.split('|');
    pending.selectedInboundMode = inboundMode === 'none' ? null : inboundMode;
    pending.selectedOutboundMode = outboundMode === 'none' ? null : outboundMode;
    pending.selectedOutboundCancellable = outboundCancellableKey === 'c1';
    ctx.refreshPendingHomeSelections(pending);

    if (best.action === 'accept') ctx.acceptHomeCard();
    else if (best.action === 'accept_next') ctx.acceptHomeCardByCancellingNextMission();
    return;
  }

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

function updateOfferFilterForSurvival(ctx) {
  const weeklyFood = ctx.__simConsts.currentWeeklyFood(ctx.STATE.week);
  const projected = evaluateState(ctx, currentPointValue);
  const futureStarts = ctx.STATE.agenda.filter(mission => mission.startWeek > ctx.STATE.week).length;
  const remainingWeeks = Math.max(1, currentMaxWeeks - ctx.STATE.week);
  const requiredPointPace = Math.max(0, ctx.__simConsts.VICTORY_POINTS - ctx.STATE.points) / remainingWeeks;
  const behindOnPoints = requiredPointPace > 0.55;
  const emergency = ctx.STATE.balance < weeklyFood * 5 || projected.projectedCash < weeklyFood * 3;
  const difficult = ctx.STATE.balance < weeklyFood * 8
    || projected.projectedCash < weeklyFood * 5
    || (futureStarts === 0 && ctx.STATE.balance < weeklyFood * 10);
  ctx.STATE.offerFilter = emergency || (difficult && !behindOnPoints) ? 'nearby' : 'anywhere';
}

function maybeOfferReturnHome(ctx) {
  if (ctx.STATE.phase !== 'playing' || ctx.STATE.pendingCard || ctx.STATE.atParents) return false;
  if (typeof ctx.getActiveMission === 'function' && ctx.getActiveMission()) return false;
  if (typeof ctx.deriveCurrentCityFromState === 'function' && typeof ctx.sameCity === 'function') {
    const currentCity = ctx.deriveCurrentCityFromState();
    if (!currentCity || !ctx.STATE.startCity) {
      return false;
    }
  }

  const candidates = buildHomeCandidates(ctx);
  candidates.sort((a, b) => b.score - a.score);
  const baseline = candidates.find(candidate => candidate.action === 'stay') || { score: -Infinity, projectedCash: -Infinity };
  const best = candidates[0];
  if (!best || best.action === 'stay') return false;

  const weeklyFood = ctx.__simConsts.currentWeeklyFood(ctx.STATE.week);
  const futureStarts = ctx.STATE.agenda.filter(mission => mission.startWeek > ctx.STATE.week).length;
  const remainingWeeks = Math.max(1, currentMaxWeeks - ctx.STATE.week);
  const requiredPointPace = Math.max(0, ctx.__simConsts.VICTORY_POINTS - ctx.STATE.points) / remainingWeeks;
  const behindOnPoints = requiredPointPace > 0.55;
  const risky = ctx.STATE.balance < weeklyFood * 8
    || baseline.projectedCash < weeklyFood * 5
    || futureStarts === 0;
  const betterCash = best.projectedCash > baseline.projectedCash + Math.max(40, weeklyFood * 1.5);
  const betterScore = best.score > baseline.score + Math.max(80, weeklyFood * 2);

  if (behindOnPoints && !risky) return false;
  if (!betterCash && !(risky && betterScore)) return false;

  ctx.offerReturnHome();
  if (!ctx.STATE.pendingCard || ctx.STATE.pendingCard.kind !== 'home') return false;
  resolvePendingCard(ctx);
  return !ctx.STATE.pendingCard;
}

function applySurvivalStrategy(ctx) {
  updateOfferFilterForSurvival(ctx);
  let usedHome = false;
  if (!ctx.STATE.pendingCard) {
    usedHome = maybeOfferReturnHome(ctx);
    updateOfferFilterForSurvival(ctx);
  }
  return { usedHome };
}

function simulateOne(compiledGame, seed, maxWeeks, pointValue) {
  const ctx = makeContext(compiledGame, seed);
  startGame(ctx);

  const weeklyBalances = [];
  let homeUses = 0;
  let nearbyWeeks = 0;

  while (ctx.STATE.phase === 'playing' && ctx.STATE.week < maxWeeks) {
    while (ctx.STATE.pendingCard) resolvePendingCard(ctx);
    const strategyStep = applySurvivalStrategy(ctx);
    if (strategyStep.usedHome) homeUses++;
    if (ctx.STATE.offerFilter === 'nearby') nearbyWeeks++;
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
    points: ctx.STATE.points,
    week52Balance: weeklyBalances.length >= 52 ? weeklyBalances[51] : null,
    carriedYear1Balance: weeklyBalances.length >= 52 ? weeklyBalances[51] : ctx.STATE.balance,
    homeUses,
    nearbyWeeks,
  };
}

function summarize(results, options) {
  const defeats = results.filter(result => result.result === 'defeat');
  const defeatsAfter52 = defeats.filter(result => result.weeks > 52);
  const week52Survivors = results.filter(result => result.week52Balance != null).map(result => result.week52Balance);

  return {
    strategy: 'ecolo_collection_bot',
    n: results.length,
    maxWeeks: options.maxWeeks,
    pointValue: options.pointValue,
    winRate: results.filter(result => result.result === 'victory').length / results.length,
    defeatRate: defeats.length / results.length,
    timeoutRate: results.filter(result => result.result === 'timeout').length / results.length,
    defeatRateFirst4Months: defeats.filter(result => result.weeks <= FOUR_MONTHS_WEEKS).length / results.length,
    medianWeekDefeat: median(defeats.map(result => result.weeks)),
    defeatsAfter52Count: defeatsAfter52.length,
    medianPointsAtDefeatAfter52: median(defeatsAfter52.map(result => result.points)),
    medianBalanceYear1Carry: median(results.map(result => result.carriedYear1Balance)),
    medianBalanceWeek52Survivors: median(week52Survivors),
    week52SurvivorRate: week52Survivors.length / results.length,
    avgHomeUses: results.reduce((sum, result) => sum + result.homeUses, 0) / results.length,
    nearbyWeekRate: results.reduce((sum, result) => sum + result.nearbyWeeks, 0) / Math.max(1, results.reduce((weeks, result) => weeks + result.weeks, 0)),
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
  console.log(`- Points médians lors des défaites après S52 : ${summary.medianPointsAtDefeatAfter52 == null ? 'n/a' : summary.medianPointsAtDefeatAfter52.toFixed(1)} (${summary.defeatsAfter52Count} cas)`);
  console.log(`- Solde médian à la fin de la 1re année (ou dernier solde si mort avant) : ${summary.medianBalanceYear1Carry == null ? 'n/a' : summary.medianBalanceYear1Carry.toFixed(0)} €`);
  console.log(`- Solde médian à S52 parmi les survivants : ${summary.medianBalanceWeek52Survivors == null ? 'n/a' : summary.medianBalanceWeek52Survivors.toFixed(0)} €`);
  console.log(`- Taux de survie jusqu'à S52 : ${(summary.week52SurvivorRate * 100).toFixed(1)} %`);
  console.log(`- Défaites dans les 4 premiers mois (~${FOUR_MONTHS_WEEKS} semaines) : ${(summary.defeatRateFirst4Months * 100).toFixed(1)} %`);
  console.log(`- Retours maison moyens par partie : ${summary.avgHomeUses.toFixed(2)}`);
  console.log(`- Part des semaines jouées en filtre "à proximité" : ${(summary.nearbyWeekRate * 100).toFixed(1)} %`);
}

const options = parseArgs(process.argv.slice(2));
const gameHtml = fs.readFileSync(GAME_HTML, 'utf8');
const compiledGame = new vm.Script(extractScript(gameHtml), { filename: GAME_HTML });
let currentPointValue = options.pointValue;
let currentMaxWeeks = options.maxWeeks;

const results = [];
for (let seed = 0; seed < options.n; seed++) {
  results.push(simulateOne(compiledGame, seed + 1, options.maxWeeks, options.pointValue));
}

printSummary(summarize(results, options), options);
