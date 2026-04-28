# Équilibrage actuel

> Ce document décrit l’équilibrage **présent dans le code** au 28 avril 2026.  
> La référence chiffrée est `game/pet-sitter.html`, et le simulateur de référence est `spec/sim/current_balance_sim.js`.

## 1. Valeurs globales

| Élément | Valeur actuelle |
|---|---:|
| Solde initial | `2000 €` |
| Coût de vie mensuel | `500 €` |
| Coût de vie hebdo appliqué | `500 * 12 / 52` soit `≈ 115,38 €` |
| Chance d’opportunité par tour | `45 %` |
| Chance de carte Chance | `2 %` |
| Seuil de victoire | `100 pts` |
| Bonus continent éloigné | `+20 %` |
| Logement rare | `25 %` |
| `Potes invités` | `30 %` |
| Bonus `Potes invités` | `+1 pt` |
| Surcoût billet annulable | `+15 %` |
| Fenêtre annulation sans malus | `8 semaines` |
| Durée du malus réputation | `26 semaines` |

## 2. Génération des opportunités

## 2.1. Composition du pool

| Type | Poids |
|---|---:|
| Dog sitting | `0,60` |
| Cat sitting | `0,18` |
| House sitting | `0,17` |
| Bird sitting | `0,05` |

Effets de succès :

- `Expert Chien` double le poids des dogs
- `Ermite` double le poids des house sittings

## 2.2. Horizon temporel

Répartition actuelle des dates de départ :

| Bucket | Part | Fenêtre |
|---|---:|---|
| `urgent` | `40 %` | `1 à 2 semaines` |
| `near` | `10 %` | `3 à 22 semaines` |
| `far` | `40 %` | `23 à 39 semaines` |
| `very_far` | `10 %` | `40 à 52 semaines` |

## 2.3. Durée

Répartition actuelle :

- `60 %` : `7 à 21 jours`
- `25 %` : `22 à 60 jours`
- `10 %` : `61 à 90 jours`
- `5 %` : `5 à 6 jours`

## 2.4. Géographie

Mode standard :

- `60 %` de cartes locales au continent courant
- `40 %` de cartes mondiales

Filtre manuel disponible :

- `N’importe où`
- `À proximité`

Le mode `À proximité` restreint le tirage à un sous-pool de villes proches.

## 2.5. Reroll des cartes impossibles

Le jeu **n’élimine pas** les cartes impossibles en général.  
Exception actuelle :

- si la carte est impossible à rejoindre ;
- et qu’elle démarre dans `2 semaines ou moins` ;
- alors elle peut être rerollée.

## 3. Paiements et points de mission

## 3.1. Paiements journaliers

| Type | Fourchette |
|---|---:|
| Dog sitting | `35–55 €/jour` |
| Cat sitting | `25–40 €/jour` |
| Bird sitting | `30–50 €/jour` |
| House sitting | `20–35 €/jour` |

Le paiement total est :

```text
payPerDay * durationDays * (1.2 si continent différent, sinon 1)
```

## 3.2. Points de satisfaction

| Type | Fourchette |
|---|---:|
| Dog sitting | `2–4 pts` |
| Cat sitting | `4–7 pts` |
| Bird sitting | `5–8 pts` |
| House sitting | `3–5 pts` |

Modificateurs :

- logement rare : `+2 pts`
- `Potes invités` : `+1 pt`

## 3.3. Moment de résolution

- l’argent est versé **au démarrage**
- les points sont crédités **à la fin**

## 4. Transport

## 4.1. Coût et vitesse par mode

| Mode | Coût/km | Vitesse |
|---|---:|---:|
| Auto-stop | `0,005 €` | `60 km/j` |
| Bateau-stop | `0,01 €` | `80 km/j` |
| Avion | `0,03 €` | `22 000 km/j` |
| Bus | `0,05 €` | `200 km/j` |
| Train | `0,08 €` | `400 km/j` |
| Ferry | `0,09 €` | `200 km/j` |

Ordre économique réel actuellement :

```text
Train / Ferry > Bus > Avion > Bateau-stop > Auto-stop
```

## 4.2. Disponibilité des modes

Terrestre :

- `hitch`
- `bus`
- `train`

Trans-océanique :

- `boatstop`
- `plane`
- `ferry`

## 4.3. Billets annulables

Modes auto-annulables :

- `Auto-stop`
- `Bateau-stop`
- `Sur place`

Autres modes :

- version standard
- version annulable avec `+15 %`

## 4.4. Effets de `Star des réseaux`

Pour les legs `train`, `ferry`, `boatstop`, `bus` :

- `50 %` de chance que le coût tombe à `0`

Pour un avion :

- perte du perk ;
- blocage définitif de son retour ;
- retrait du succès `Écolo` s’il était encore actif ;
- effet bad buzz : malus financier additionnel basé sur le solde courant.

## 5. Annulations et réputation

## 5.1. Annulation manuelle

Une mission future peut être annulée à tout moment.

Effets :

- si le départ est dans plus de `8 semaines`
  - pas de malus de réputation
- si le départ est dans moins de `8 semaines`
  - réputation pénalisée pendant `26 semaines`
  - `-10 %` de chance d’opportunité pendant la pénalité

Dans tous les cas :

- les transports non annulables déjà réservés sont perdus

## 5.2. Annulation indirecte via une carte

Une opportunité ou un retour chez les parents peut proposer :

- `Accepter en annulant`
- `Rentrer en annulant`

Le coût perdu inclut :

- le trajet principal non annulable ;
- le trajet d’approche non annulable s’il existe.

## 6. Succès et bonus

| Succès | Condition | Bonus |
|---|---|---:|
| Globe-trotter | 6 continents | `+30` |
| Bestiaire | chien + chat + oiseau | `+20` |
| Agent Immobilier | tous les logements | `+20` |
| Pékin Express | tous les transports sauf avion | `+20` |
| Kiffeur | 5 missions `Potes invités` | `+20` |
| Écolo | actif au départ, perdu au 1er avion | `+25` |
| Expert Chien | 5 dog sittings | `+7` |
| Ermite | 5 house sittings | `+7` |

Le succès `Expert Chat` n’existe plus.

## 7. Cartes Chance

Perks actuels :

| Perk | Effet principal |
|---|---|
| Un ami qui s’y connaît | révèle la qualité relative d’une mission |
| Digital Nomad | revenus freelance ponctuels + risque URSSAF |
| Star des réseaux | plus d’opportunités, plus de lointain, certains transports offerts |

Contraintes :

- une seule carte active à la fois
- elle peut être refusée

## 8. Retour chez les parents

Cette mécanique n’existait pas dans les anciennes specs, mais elle fait maintenant partie du vrai jeu.

Règles actuelles :

- accessible depuis la sidebar
- destination fixe : ville de départ
- il faut payer le trajet pour y aller
- une fois rentré :
  - `0 €` de coût de vie hebdo
  - cet état dure jusqu’au prochain trajet qui repart de chez les parents
- la carte peut :
  - recalculer le transport du sitting suivant ;
  - remplacer un trajet déjà prévu ;
  - imposer une annulation si le calendrier est trop serré

## 9. Mesures de simulation

### 9.1. Source

Commande exécutée le **28 avril 2026** :

```bash
node spec/sim/current_balance_sim.js --n 500 --json
```

### 9.2. Résultat

Résultats obtenus avec le bot `balanced_bot` :

| Indicateur | Valeur |
|---|---:|
| `winRate` | `7,6 %` |
| `defeatRate` | `92,2 %` |
| `timeoutRate` | `0,2 %` |
| `defeatRateFirst4Months` | `0,4 %` |
| `medianWeekDefeat` | `29 semaines` |
| `medianBalanceYear1Carry` | `-43,70 €` |
| `medianBalanceWeek52Survivors` | `2135,02 €` |
| `week52SurvivorRate` | `33,4 %` |

### 9.3. Lecture

En l’état :

- le jeu reste assez exigeant ;
- la majorité des runs bot meurent avant d’atteindre la victoire ;
- la défaite arrive médianement vers la semaine `29`, donc avant la cible historique “1 an” ;
- la mort très précoce est rare ;
- les survivants à `S52` sont souvent redevenus confortables en cash.

### 9.4. Limite importante

Le simulateur actuel :

- joue les opportunités ;
- gère les annulations proposées ;
- gère les cartes Chance ;

mais il **n’exploite pas activement** le bouton manuel `Retour chez les parents`.  
Les chiffres ci-dessus décrivent donc surtout le baseline “sans optimisation manuelle maison”.

## 10. Leviers d’équilibrage principaux

Si quelqu’un reprend l’équilibrage, les gros boutons utiles sont :

1. `P_OPPORTUNITY`
2. `INITIAL_BALANCE`
3. `WEEKLY_FOOD`
4. `PAY_RANGES`
5. `POINT_RANGES`
6. `FAR_BONUS`
7. distribution des dates de départ
8. tarifs / vitesses de transport
9. poids des logements rares et `Potes invités`
10. valeur des succès

Les zones les plus explosives sont :

- les transports ;
- les dates de départ ;
- les règles d’annulation ;
- les cas “trajet déjà réservé” ;
- le retour chez les parents.
