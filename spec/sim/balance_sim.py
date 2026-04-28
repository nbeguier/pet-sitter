"""
Simulateur d'équilibrage pour Pet Sitter — le jeu.

Implémente la logique de jeu décrite dans /spec/00-overview.md et /spec/02-balance.md
puis lance N parties avec différentes stratégies de bot pour observer le ratio
victoire/défaite/timeout, la durée moyenne, l'argent en fin de partie, etc.

Usage: python3 balance_sim.py
"""

from __future__ import annotations
import math
import random
import statistics
from dataclasses import dataclass, field
from typing import Optional

# ======================= CONSTANTES DU JEU =======================

INITIAL_BALANCE = 1500.0          # 3 mois × 500€
MONTHLY_FOOD_COST = 500.0
WEEKLY_FOOD_COST = MONTHLY_FOOD_COST * 12 / 52  # ≈ 115.38 €/semaine
P_OPPORTUNITY = 0.45
VICTORY_POINTS = 100
MAX_WEEKS = 52 * 3                # garde-fou : 3 ans max

# Pool sans aucun Expert (proba conditionnelle au tirage)
POOL_BASE = {"dog": 0.60, "cat": 0.18, "house": 0.17, "bird": 0.05}

# Tarifs €/jour
PAY_RANGES = {
    "dog":   (35, 55),
    "cat":   (25, 40),
    "bird":  (30, 50),
    "house": (20, 35),
}

# Points de satisfaction
POINT_RANGES = {
    "dog":   (2, 4),
    "cat":   (4, 7),
    "bird":  (5, 8),
    "house": (3, 5),
}

ANIMAL_FOR_TYPE = {"dog": "chien", "cat": "chat", "bird": "oiseau", "house": None}

P_RARE_HOUSING = 0.25       # bonus +2 pts
P_POTES_INVITES = 0.30
FAR_BONUS = 1.20            # +20% paiement si continent différent

# Transports (€/km, km/jour)
TRANSPORT = {
    "hitch": {"cost_km": 0.005, "km_day": 60,  "trans_ocean": False},
    "bus":   {"cost_km": 0.04,  "km_day": 200, "trans_ocean": False},
    "train": {"cost_km": 0.08,  "km_day": 400, "trans_ocean": False},
    "plane": {"cost_km": 0.15,  "km_day": 800, "trans_ocean": True},
}
MODES_BY_PRICE = ["hitch", "bus", "train", "plane"]

# Continents reliés par voie terrestre (sinon avion obligatoire)
LAND_CONNECTED = {
    frozenset(["Europe", "Asia"]),
    frozenset(["Europe", "Africa"]),
    frozenset(["Asia", "Africa"]),
    frozenset(["N.America", "S.America"]),
}

# Bonus de succès
ACHIEVEMENT_POINTS = {
    "expert_chien": 7,
    "expert_chat": 7,
    "ermite": 7,
    "bestiaire": 20,
    "globetrotter": 30,
    "kiffeur": 20,
}

# Biais du pool : probabilité que la carte tombe dans le continent du joueur
P_LOCAL_CARD = 0.60

# ======================= DONNÉES VILLES =======================

CITIES = [
    # Europe
    {"name": "Paris",      "continent": "Europe",   "lat": 48.85, "lng":   2.35},
    {"name": "Berlin",     "continent": "Europe",   "lat": 52.52, "lng":  13.40},
    {"name": "Rome",       "continent": "Europe",   "lat": 41.90, "lng":  12.50},
    {"name": "Lisbon",     "continent": "Europe",   "lat": 38.72, "lng":  -9.14},
    {"name": "Stockholm",  "continent": "Europe",   "lat": 59.33, "lng":  18.07},
    {"name": "Madrid",     "continent": "Europe",   "lat": 40.42, "lng":  -3.70},
    {"name": "Vienna",     "continent": "Europe",   "lat": 48.21, "lng":  16.37},
    {"name": "Athens",     "continent": "Europe",   "lat": 37.98, "lng":  23.73},
    # Africa
    {"name": "Cairo",      "continent": "Africa",   "lat": 30.04, "lng":  31.24},
    {"name": "Cape Town",  "continent": "Africa",   "lat": -33.92,"lng":  18.42},
    {"name": "Marrakech",  "continent": "Africa",   "lat": 31.63, "lng":  -8.00},
    {"name": "Nairobi",    "continent": "Africa",   "lat": -1.29, "lng":  36.82},
    {"name": "Dakar",      "continent": "Africa",   "lat": 14.72, "lng": -17.47},
    {"name": "Lagos",      "continent": "Africa",   "lat":  6.46, "lng":   3.39},
    # Asia
    {"name": "Tokyo",      "continent": "Asia",     "lat": 35.68, "lng": 139.76},
    {"name": "Bangkok",    "continent": "Asia",     "lat": 13.75, "lng": 100.50},
    {"name": "Mumbai",     "continent": "Asia",     "lat": 19.08, "lng":  72.88},
    {"name": "Beijing",    "continent": "Asia",     "lat": 39.90, "lng": 116.41},
    {"name": "Istanbul",   "continent": "Asia",     "lat": 41.00, "lng":  28.98},
    {"name": "Seoul",      "continent": "Asia",     "lat": 37.57, "lng": 126.98},
    {"name": "Singapore",  "continent": "Asia",     "lat":  1.35, "lng": 103.82},
    # North America
    {"name": "New York",    "continent": "N.America", "lat": 40.71, "lng": -74.00},
    {"name": "LA",          "continent": "N.America", "lat": 34.05, "lng":-118.24},
    {"name": "Mexico City", "continent": "N.America", "lat": 19.43, "lng": -99.13},
    {"name": "Toronto",     "continent": "N.America", "lat": 43.65, "lng": -79.38},
    # South America
    {"name": "Buenos Aires","continent": "S.America", "lat":-34.61, "lng": -58.38},
    {"name": "Rio",         "continent": "S.America", "lat":-22.91, "lng": -43.17},
    {"name": "Lima",        "continent": "S.America", "lat":-12.05, "lng": -77.04},
    {"name": "Bogota",      "continent": "S.America", "lat":  4.71, "lng": -74.07},
    # Oceania
    {"name": "Sydney",     "continent": "Oceania",  "lat":-33.87, "lng": 151.21},
    {"name": "Auckland",   "continent": "Oceania",  "lat":-36.85, "lng": 174.76},
    {"name": "Melbourne",  "continent": "Oceania",  "lat":-37.81, "lng": 144.96},
]

# ======================= UTILS =======================

def haversine(a: dict, b: dict) -> float:
    R = 6371.0
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp = math.radians(b["lat"] - a["lat"])
    dl = math.radians(b["lng"] - a["lng"])
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(h))

def needs_plane(c1: str, c2: str) -> bool:
    if c1 == c2:
        return False
    return frozenset([c1, c2]) not in LAND_CONNECTED

def best_transport(distance_km: float, days_available: float,
                   src_continent: str, dst_continent: str):
    """Retourne le mode le moins cher qui rentre dans la fenêtre temporelle.
    Renvoie None si aucun mode ne rentre."""
    if distance_km < 1.0:
        return {"mode": "none", "cost": 0.0, "days": 0.0}
    must_fly = needs_plane(src_continent, dst_continent)
    candidates = ["plane"] if must_fly else MODES_BY_PRICE
    for m in candidates:
        spec = TRANSPORT[m]
        d_needed = distance_km / spec["km_day"]
        if d_needed <= days_available:
            return {"mode": m, "cost": distance_km * spec["cost_km"], "days": d_needed}
    return None

# ======================= GÉNÉRATION DE CARTES =======================

def gen_card(week_now: int, expert_biases: set[str], rng: random.Random) -> dict:
    weights = dict(POOL_BASE)
    for e in expert_biases:
        if e in weights:
            weights[e] *= 2
    s = sum(weights.values())
    weights = {k: v / s for k, v in weights.items()}
    types, probs = list(weights.keys()), list(weights.values())
    t = rng.choices(types, probs)[0]

    city = rng.choice(CITIES)

    # durée : 60% courte 7-21j, 25% moyenne 22-60j, 10% longue 61-90j, 5% très courte 5-6j
    bucket = rng.choices(["short", "medium", "long", "tiny"], [0.60, 0.25, 0.10, 0.05])[0]
    if bucket == "short": duration = rng.randint(7, 21)
    elif bucket == "medium": duration = rng.randint(22, 60)
    elif bucket == "long": duration = rng.randint(61, 90)
    else: duration = rng.randint(5, 6)

    pay_lo, pay_hi = PAY_RANGES[t]
    pay_per_day = rng.uniform(pay_lo, pay_hi)

    pts_lo, pts_hi = POINT_RANGES[t]
    points = rng.randint(pts_lo, pts_hi)

    is_rare_housing = rng.random() < P_RARE_HOUSING
    if is_rare_housing:
        points += 2

    has_potes = rng.random() < P_POTES_INVITES

    # date de début : 1-12 semaines dans le futur
    offset_bucket = rng.choices(["near", "mid", "far"], [0.5, 0.3, 0.2])[0]
    if offset_bucket == "near": offset = rng.randint(1, 4)
    elif offset_bucket == "mid": offset = rng.randint(5, 8)
    else: offset = rng.randint(9, 12)

    return {
        "type": t,
        "city": city,
        "duration_days": duration,
        "duration_weeks": math.ceil(duration / 7),
        "pay_per_day": pay_per_day,
        "points": points,
        "is_rare_housing": is_rare_housing,
        "has_potes": has_potes,
        "start_week": week_now + offset,
    }

# ======================= ÉTAT DE PARTIE =======================

@dataclass
class GameState:
    balance: float = INITIAL_BALANCE
    points: int = 0
    week: int = 0
    start_city: dict = field(default_factory=dict)
    agenda: list = field(default_factory=list)        # missions en cours / futures
    completed: list = field(default_factory=list)
    achievements: set = field(default_factory=set)
    animals_done: set = field(default_factory=set)
    continents_done: set = field(default_factory=set)
    type_count: dict = field(default_factory=lambda: {"dog": 0, "cat": 0, "house": 0, "bird": 0})
    potes_count: int = 0
    cards_seen: int = 0
    cards_accepted: int = 0
    cards_refused: int = 0

# ======================= ÉVALUATION D'UNE CARTE PAR LE BOT =======================

def evaluate_card(card: dict, state: GameState):
    """Retourne {profit, travel_cost, pay_total, src_city, mode} ou None si infaisable."""
    # 1) chevauchement temporel ?
    card_end = card["start_week"] + card["duration_weeks"]
    for m in state.agenda:
        if not (card_end <= m["start_week"] or card["start_week"] >= m["start_week"] + m["duration_weeks"]):
            return None  # overlap

    # 2) trouver la position et la date dispo juste avant le début de la carte
    src_city = state.start_city
    last_end = state.week
    for m in sorted(state.agenda, key=lambda x: x["start_week"] + x["duration_weeks"]):
        end = m["start_week"] + m["duration_weeks"]
        if end <= card["start_week"] and end > last_end:
            last_end = end
            src_city = m["city"]

    days_available = max(0, (card["start_week"] - last_end)) * 7
    if days_available < 1:
        return None

    distance = haversine(src_city, card["city"])
    travel = best_transport(distance, days_available, src_city["continent"], card["city"]["continent"])
    if travel is None:
        return None

    far = src_city["continent"] != card["city"]["continent"]
    pay_total = card["pay_per_day"] * card["duration_days"] * (FAR_BONUS if far else 1.0)
    food_during = WEEKLY_FOOD_COST * (card["duration_days"] / 7)
    profit = pay_total - travel["cost"] - food_during

    return {
        "profit": profit,
        "travel_cost": travel["cost"],
        "pay_total": pay_total,
        "src_city": src_city,
        "mode": travel["mode"],
        "distance": distance,
    }

# ======================= STRATÉGIES =======================

def strategy_decide(name: str, evald: dict, card: dict, state: GameState) -> bool:
    """Renvoie True pour accepter, False pour refuser. evald non-None requis."""
    if name == "accept_all":
        return True
    if name == "positive":
        return evald["profit"] > 0
    if name == "min100":
        return evald["profit"] > 100

    # Compteurs pour raisonnement de survie
    weeks_until_end = card["start_week"] + card["duration_weeks"] - state.week
    food_through_end = WEEKLY_FOOD_COST * weeks_until_end
    cash_after_mission = state.balance + evald["pay_total"] - evald["travel_cost"] - food_through_end
    # cash_now considère ce qui est déjà engagé dans l'agenda actif
    pending_pay  = sum(m["pay_total"] for m in state.agenda)
    pending_cost = sum(m.get("travel_cost", 0) for m in state.agenda)
    # combien je vais cumuler en nourriture jusqu'à la fin la plus tardive ?
    horizon = max([state.week] + [m["start_week"] + m["duration_weeks"] for m in state.agenda] + [card["start_week"] + card["duration_weeks"]])
    food_to_horizon = WEEKLY_FOOD_COST * (horizon - state.week)

    if name == "safe":
        # Refuse si la trésorerie planifiée passe sous zéro avant la fin de la mission
        # Approximation : balance + tous les revenus prévus - tous les coûts prévus + cette carte
        projected = (state.balance + pending_pay + evald["pay_total"]
                     - pending_cost - evald["travel_cost"] - food_to_horizon)
        return projected >= 100  # marge de sécurité

    if name == "smart":
        # Comme safe, mais devient plus exigeant si la trésorerie est confortable,
        # et privilégie les nouveaux continents si on chasse le Globe-trotter
        projected = (state.balance + pending_pay + evald["pay_total"]
                     - pending_cost - evald["travel_cost"] - food_to_horizon)
        if projected < 100:
            return False
        new_continent = card["city"]["continent"] not in state.continents_done
        # priorité : nouveau continent si on en a déjà 3+
        if new_continent and len(state.continents_done) >= 3:
            return evald["profit"] > -200  # accepte même légèrement déficitaire pour le succès
        # avec gros buffer, refuse les petits profits
        if state.balance > 2000:
            return evald["profit"] > 150
        # avec buffer moyen, refuse le négatif
        if state.balance > 800:
            return evald["profit"] > 0
        # buffer faible : prend tout ce qui est survivable
        return True
    raise ValueError(name)

# ======================= BOUCLE DE JEU =======================

def resolve_endings(state: GameState):
    ending = [m for m in state.agenda if m["start_week"] + m["duration_weeks"] == state.week]
    for m in ending:
        # paiement déjà perçu au démarrage. Ici on ne crédite que les points.
        state.points += m["points"]
        state.completed.append(m)

        t = m["type"]
        state.type_count[t] += 1

        # animaux
        anim = ANIMAL_FOR_TYPE[t]
        if anim:
            state.animals_done.add(anim)

        # continents
        state.continents_done.add(m["city"]["continent"])

        # potes
        if m.get("has_potes"):
            state.potes_count += 1

        # déclenchement de succès
        if state.type_count["dog"] >= 5 and "expert_chien" not in state.achievements:
            state.achievements.add("expert_chien"); state.points += ACHIEVEMENT_POINTS["expert_chien"]
        if state.type_count["cat"] >= 5 and "expert_chat" not in state.achievements:
            state.achievements.add("expert_chat"); state.points += ACHIEVEMENT_POINTS["expert_chat"]
        if state.type_count["house"] >= 5 and "ermite" not in state.achievements:
            state.achievements.add("ermite"); state.points += ACHIEVEMENT_POINTS["ermite"]
        if state.animals_done >= {"chien", "chat", "oiseau"} and "bestiaire" not in state.achievements:
            state.achievements.add("bestiaire"); state.points += ACHIEVEMENT_POINTS["bestiaire"]
        if len(state.continents_done) >= 6 and "globetrotter" not in state.achievements:
            state.achievements.add("globetrotter"); state.points += ACHIEVEMENT_POINTS["globetrotter"]
        if state.potes_count >= 5 and "kiffeur" not in state.achievements:
            state.achievements.add("kiffeur"); state.points += ACHIEVEMENT_POINTS["kiffeur"]

    # purge
    state.agenda = [m for m in state.agenda if m["start_week"] + m["duration_weeks"] > state.week]

def resolve_starts(state: GameState):
    starting = [m for m in state.agenda if m["start_week"] == state.week]
    for m in starting:
        # paiement total + coût de transport au démarrage
        state.balance += m["pay_total"]
        state.balance -= m["travel_cost"]

def simulate_game(strategy: str = "smart", seed: Optional[int] = None) -> dict:
    rng = random.Random(seed)
    state = GameState(start_city=rng.choice(CITIES))

    while state.week < MAX_WEEKS:
        state.week += 1

        resolve_endings(state)
        resolve_starts(state)

        # nourriture hebdomadaire
        state.balance -= WEEKLY_FOOD_COST

        # défaite
        if state.balance < 0:
            return summary(state, "defeat")

        # victoire
        if state.points >= VICTORY_POINTS:
            return summary(state, "victory")

        # tirage carte
        if rng.random() < P_OPPORTUNITY:
            state.cards_seen += 1

            biases = set()
            if "expert_chien" in state.achievements: biases.add("dog")
            if "expert_chat" in state.achievements: biases.add("cat")
            if "ermite" in state.achievements: biases.add("house")

            card = gen_card(state.week, biases, rng)

            # Biais géographique : P_LOCAL_CARD chance que la carte tombe dans le continent
            # du joueur. On détermine la position courante en tenant compte de l'agenda.
            cur_city = state.start_city
            cur_end = state.week
            for m in sorted(state.agenda, key=lambda x: x["start_week"] + x["duration_weeks"]):
                end = m["start_week"] + m["duration_weeks"]
                if end > cur_end:
                    cur_end = end
                    cur_city = m["city"]
            if rng.random() < P_LOCAL_CARD:
                same = [c for c in CITIES if c["continent"] == cur_city["continent"] and c["name"] != cur_city["name"]]
                if same:
                    card["city"] = rng.choice(same)

            evald = evaluate_card(card, state)

            if evald is None:
                state.cards_refused += 1
                continue

            if strategy_decide(strategy, evald, card, state):
                m = dict(card)
                m["pay_total"] = evald["pay_total"]
                m["travel_cost"] = evald["travel_cost"]
                state.agenda.append(m)
                state.cards_accepted += 1
            else:
                state.cards_refused += 1

    return summary(state, "timeout")

def summary(state: GameState, result: str) -> dict:
    return {
        "result": result,
        "weeks": state.week,
        "points": state.points,
        "balance": round(state.balance, 2),
        "missions_completed": len(state.completed),
        "cards_seen": state.cards_seen,
        "cards_accepted": state.cards_accepted,
        "cards_refused": state.cards_refused,
        "achievements": sorted(state.achievements),
        "type_count": dict(state.type_count),
        "continents": sorted(state.continents_done),
    }

# ======================= BATCH =======================

def run_batch(strategy: str, n: int) -> dict:
    results = [simulate_game(strategy, seed=i) for i in range(n)]
    wins = [r for r in results if r["result"] == "victory"]
    defs = [r for r in results if r["result"] == "defeat"]
    tos  = [r for r in results if r["result"] == "timeout"]

    def avg(xs, key):
        if not xs: return float("nan")
        return statistics.mean(r[key] for r in xs)

    achievement_rate = {}
    for ach in ACHIEVEMENT_POINTS:
        achievement_rate[ach] = sum(1 for r in results if ach in r["achievements"]) / n

    return {
        "strategy": strategy,
        "N": n,
        "win_rate": len(wins) / n,
        "defeat_rate": len(defs) / n,
        "timeout_rate": len(tos) / n,
        "avg_weeks_win": avg(wins, "weeks"),
        "avg_weeks_defeat": avg(defs, "weeks"),
        "avg_points_all": avg(results, "points"),
        "avg_balance_end_all": avg(results, "balance"),
        "avg_missions_all": avg(results, "missions_completed"),
        "avg_cards_accepted_all": avg(results, "cards_accepted"),
        "avg_cards_refused_all": avg(results, "cards_refused"),
        "achievement_rates": achievement_rate,
    }

# ======================= MAIN =======================

def fmt_pct(x): return f"{x*100:5.1f}%"
def fmt_n(x):   return "n/a  " if math.isnan(x) else f"{x:6.1f}"

def print_report(stats: dict):
    s = stats
    print(f"\n=== Stratégie : {s['strategy']}  (N={s['N']}) ===")
    print(f"  Victoires : {fmt_pct(s['win_rate'])}    Défaites : {fmt_pct(s['defeat_rate'])}    Timeout : {fmt_pct(s['timeout_rate'])}")
    print(f"  Durée moy victoire (sem) : {fmt_n(s['avg_weeks_win'])}    durée moy défaite : {fmt_n(s['avg_weeks_defeat'])}")
    print(f"  Pts moy : {fmt_n(s['avg_points_all'])}   Solde fin moy : {s['avg_balance_end_all']:.0f} €")
    print(f"  Missions/partie : {fmt_n(s['avg_missions_all'])}   accept/refus : {fmt_n(s['avg_cards_accepted_all'])} / {fmt_n(s['avg_cards_refused_all'])}")
    print(f"  Taux de succès débloqués :")
    for ach, rate in s["achievement_rates"].items():
        print(f"    - {ach:14s} {fmt_pct(rate)}")

if __name__ == "__main__":
    N = 1000
    print(f"\n=== Simulation Pet Sitter — {N} parties par stratégie ===")
    print(f"Constantes : solde initial={INITIAL_BALANCE}€  P_opp={P_OPPORTUNITY}  victoire={VICTORY_POINTS}pts  food={WEEKLY_FOOD_COST:.1f}€/sem")

    for strat in ["accept_all", "positive", "min100", "safe", "smart"]:
        stats = run_batch(strat, N)
        print_report(stats)
