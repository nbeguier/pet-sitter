# Équilibrage chiffré

## 1. Cibles globales

- **Durée de partie cible** : ~1 an de jeu = ~52 tours (1 tour = 1 semaine).
- **Victoire** : 100 points.
- **Solde de départ** : 1500 € (= 3 mois × 500 € de nourriture).
- **Probabilité d'opportunité par tour** : 45 %.

## 2. Coûts de vie

| Poste | Montant |
|---|---|
| Nourriture | **500 €/mois** (≈ 125 €/semaine), fixes, toujours |
| Logement hors mission | 0 € (abstrait) |
| Logement en mission | 0 € (offert par le client) |

Implémentation : prélever ~115 €/tour (semaine) ou cumuler par mois. À trancher au coding mais la règle utilisateur reste "500 €/mois".

## 3. Paiements de mission

**Le paiement est versé en intégralité au démarrage de la mission** (en même temps que le coût de transport est débité). Les points de satisfaction, eux, sont crédités à la fin.

Échelle proposée (à ajuster) — la mission doit couvrir **plus** que les coûts de vie + transport pour rester rentable. Le Dog sitting est le travail "alimentaire" du jeu : payé mais peu gratifiant. Le Cat est plus rare, moins payé, mais plus satisfaisant.

| Type | Tarif journalier | Bonus continent éloigné |
|---|---|---|
| Dog sitting | 35-55 €/jour | +20 % |
| Cat sitting | 25-40 €/jour | +20 % |
| Bird sitting | 30-50 €/jour | +20 % |
| House sitting (sans animal) | 20-35 €/jour | +20 % |

Durée typique : 5 jours à 3 mois. Distribution plus dense sur **7-21 jours**.

Exemple : 14 jours de Dog sitting à 45 €/j à Bangkok depuis Paris = **630 € de paiement** ; coût de vie pendant la mission ≈ 230 € ; il reste à couvrir le transport, qui peut largement dépasser le bénéfice si on a peu de temps.

## 4. Transport

Coût ≈ **f(distance, vitesse)** où vitesse est choisie par le joueur. Formule indicative :

```
coût = distance_km × tarif_par_km(mode)
durée = distance_km / vitesse(mode)
```

| Mode | Tarif/km | Vitesse moy. | Notes |
|---|---|---|---|
| Avion | 0,15 €/km | 800 km/jour effectif | Seul mode pour > 3000 km en peu de jours |
| Train | 0,08 €/km | 400 km/jour | Limité aux continents avec rail dense |
| Bus / voiture | 0,04 €/km | 200 km/jour | Disponible partout sauf trans-océans |
| Auto-stop / lent | 0,005 €/km | 60 km/jour | Quasi gratuit, très long, indispo trans-océans |

**Règle clé** : si le temps disponible avant la prochaine mission < temps minimal du mode le moins cher, le jeu **force** le joueur à prendre un mode plus rapide (et plus cher). Avoir du temps libre = grosse économie.

**Trans-océanique** : avion uniquement (Atlantique, Pacifique).

## 5. Points de satisfaction

Cible : ~100 pts en ~10-15 missions réussies + quelques succès débloqués.

| Source | Points |
|---|---|
| Mission Dog | 2-4 pts (peu satisfaisant mais bien payé) |
| Mission Cat | 4-7 pts (plus satisfaisant, moins bien payé) |
| Mission Bird | 5-8 pts (rare et satisfaisant) |
| Mission House (sans animal) | 3-5 pts |
| Bonus logement rare (château, péniche, yourte…) | +2 pts |

## 6. Bonus de succès (one-shot)

| Succès | Points |
|---|---|
| Globe-trotter (6 continents) | +30 |
| Bestiaire complet | +20 |
| Expert Chien (5 sittings) | +7 |
| Expert Chat | +7 |
| Ermite (5 House sittings sans animal) | +7 |
| Kiffeur (5 missions "potes invités") | +20 |

## 7. Pool de cartes — biais géographique et biais Expert

Quand un tirage est déclenché (proba P_opportunité = 45%), **deux biais** s'appliquent en parallèle :

### 7.1. Biais géographique (60% local / 40% mondial)

- **60 %** : la carte tombe dans le **continent courant** du joueur (ville aléatoire de ce continent).
- **40 %** : la carte est **mondiale** (n'importe quelle ville).

Effet : un flux régulier de missions accessibles, ponctué d'opportunités lointaines.

### 7.2. Biais Expert (composition par type de mission)

Sans Expert : composition du pool (par tirage, après que P_opportunité=45% a été franchie) :

| Type | Probabilité |
|---|---|
| Dog sitting | 60 % |
| Cat sitting | 18 % |
| House sitting (sans animal) | 17 % |
| Bird sitting | 5 % |

Avec un ou plusieurs Expert : la probabilité du / des type(s) "Expert" est doublée (puis re-normalisée), au détriment proportionnel des autres types.

## 8. Données à produire

- `data/cities.json` : ~150 villes avec `{ name, country, continent, lat, lng }`.
- `data/animals.json` : 8+ animaux avec `{ id, name, rarity }`.
- `data/housings.json` : 10+ logements avec `{ id, name, isRare }`.

Liste proposée (à valider) :

**Animaux** : chien, chat, oiseau, lapin, poisson, reptile, furet, NAC exotique.
**Logements** : studio, appartement, loft, maison, villa, château, péniche, cabane, yourte, tiny house, van/caravane, bateau.

Logements "rares" donnant un bonus de points : château, péniche, yourte, cabane, tiny house, van, bateau.
