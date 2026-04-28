"""Variantes pour calibrer le jeu vers la cible : 9 mois pour victoire normale."""
import importlib
import balance_sim as bs

def run(label):
    print(f"\n--- {label} ---")
    for strat in ["positive", "smart"]:
        s = bs.run_batch(strat, 800)
        print(f"  [{strat:8s}] win={s['win_rate']*100:5.1f}%  def={s['defeat_rate']*100:5.1f}%  to={s['timeout_rate']*100:5.1f}%   "
              f"missions={s['avg_missions_all']:.1f}  défaite~sem{s['avg_weeks_defeat']:.0f}  victoire~sem{s['avg_weeks_win']:.0f}  pts={s['avg_points_all']:.1f}")

print("=== BASELINE ===")
importlib.reload(bs); run("baseline")

print("\n=== LEVIER 1 : pts/mission x2 ===")
importlib.reload(bs)
bs.POINT_RANGES = {"dog": (4, 8), "cat": (8, 14), "bird": (10, 16), "house": (6, 10)}
run("pts x2")

print("\n=== LEVIER 2 : succès gonflés (Globe-trotter +50, Bestiaire +30, Kiffeur +30) ===")
importlib.reload(bs)
bs.ACHIEVEMENT_POINTS = {"expert_chien": 10, "expert_chat": 10, "ermite": 10,
                        "bestiaire": 30, "globetrotter": 50, "kiffeur": 30}
run("succès gonflés")

print("\n=== LEVIER 3 : threshold 100 → 50 ===")
importlib.reload(bs)
bs.VICTORY_POINTS = 50
run("victoire à 50")

print("\n=== LEVIER 4 : P_opp 45% → 65% ===")
importlib.reload(bs)
bs.P_OPPORTUNITY = 0.65
run("P_opp 65%")

print("\n=== LEVIER 5 : pool biaisé vers le continent du joueur (50% same / 50% world) ===")
importlib.reload(bs)
_orig_gen = bs.gen_card
def biased_gen(week_now, biases, rng):
    return _orig_gen(week_now, biases, rng)
def patched_simulate(strategy="smart", seed=None):
    import random as _r
    rng = _r.Random(seed)
    state = bs.GameState(start_city=rng.choice(bs.CITIES))
    while state.week < bs.MAX_WEEKS:
        state.week += 1
        bs.resolve_endings(state)
        bs.resolve_starts(state)
        state.balance -= bs.WEEKLY_FOOD_COST
        if state.balance < 0:
            return bs.summary(state, "defeat")
        if state.points >= bs.VICTORY_POINTS:
            return bs.summary(state, "victory")
        if rng.random() < bs.P_OPPORTUNITY:
            state.cards_seen += 1
            biases = set()
            if "expert_chien" in state.achievements: biases.add("dog")
            if "expert_chat" in state.achievements: biases.add("cat")
            if "ermite" in state.achievements: biases.add("house")
            # déterminer la position courante du joueur
            cur_city = state.start_city
            cur_end = state.week
            for m in sorted(state.agenda, key=lambda x: x["start_week"] + x["duration_weeks"]):
                end = m["start_week"] + m["duration_weeks"]
                if end > cur_end:
                    cur_end = end
                    cur_city = m["city"]
            card = bs.gen_card(state.week, biases, rng)
            # 50% chance de remplacer la ville par une du même continent
            if rng.random() < 0.5:
                same = [c for c in bs.CITIES if c["continent"] == cur_city["continent"] and c["name"] != cur_city["name"]]
                if same:
                    card["city"] = rng.choice(same)
            evald = bs.evaluate_card(card, state)
            if evald is None:
                state.cards_refused += 1
                continue
            if bs.strategy_decide(strategy, evald, card, state):
                m = dict(card)
                m["pay_total"] = evald["pay_total"]
                m["travel_cost"] = evald["travel_cost"]
                state.agenda.append(m)
                state.cards_accepted += 1
            else:
                state.cards_refused += 1
    return bs.summary(state, "timeout")
bs.simulate_game = patched_simulate
run("pool biaisé 50/50")

print("\n=== COMBO : succès gonflés + pts x1.5 ===")
importlib.reload(bs)
bs.POINT_RANGES = {"dog": (3, 6), "cat": (6, 10), "bird": (8, 12), "house": (4, 8)}
bs.ACHIEVEMENT_POINTS = {"expert_chien": 10, "expert_chat": 10, "ermite": 10,
                        "bestiaire": 30, "globetrotter": 50, "kiffeur": 30}
run("combo succès+ + pts+")
