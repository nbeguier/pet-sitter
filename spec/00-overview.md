# Pet Sitter — Vue d’ensemble du jeu

> Ce document décrit le **jeu tel qu’il existe aujourd’hui** dans `game/pet-sitter.html`.  
> L’ancienne vision “React + Zustand” n’est plus la référence produit. La source de vérité actuelle est le jeu standalone HTML/CSS/JS.

## 1. Pitch

`Pet Sitter` est un jeu solo navigateur, au tour par tour, dans lequel on incarne un·e sitter itinérant·e.  
On enchaîne des missions de `Dog sitting`, `Cat sitting`, `Bird sitting` ou `House sitting`, on planifie ses déplacements à l’avance, on essaie de ne jamais finir à découvert, et on vise `100 points` de satisfaction/succès.

Le ton est volontairement léger, un peu carnet de voyage / petites annonces, mais le cœur du jeu est un **jeu de planning** :

- accepter une mission rentable tout de suite ou attendre mieux ;
- garder assez de cash pour survivre ;
- choisir des transports lents et peu chers ou rapides et coûteux ;
- réorganiser un agenda déjà réservé sans tout faire exploser.

## 2. Réalité du projet aujourd’hui

- Le jeu jouable est dans `game/pet-sitter.html`.
- Il n’y a **pas** de build front, pas de TypeScript, pas de React.
- Le jeu est un gros fichier unique qui contient :
  - le CSS ;
  - les données ;
  - le moteur ;
  - le rendu ;
  - les handlers UI.
- Les assets externes utilisés aujourd’hui sont :
  - `game/world_map_with_nations.svg`
  - `game/music/launch.mp3`
  - `game/music/ingame.mp3`

## 3. Boucle de jeu

Chaque tour représente **1 semaine**.

Ordre logique actuel :

1. Si une carte est ouverte, le joueur doit soit la traiter, soit la réduire avec `Réfléchir`.
2. Si une carte réduite reste en attente et qu’on clique `Tour suivant`, elle est perdue.
3. La semaine avance de 1.
4. Les missions qui se terminent donnent leurs points de satisfaction et alimentent les compteurs de succès.
5. Les missions qui démarrent :
   - versent leur paiement total immédiatement ;
   - débitent leurs coûts de transport au démarrage ;
   - déplacent la position courante.
6. Les revenus / événements de perk éventuels se résolvent.
7. Le coût de vie hebdomadaire est prélevé, sauf si le joueur est `chez les parents`.
8. Si le solde passe sous `0`, la partie est perdue.
9. Si les points atteignent `100`, la partie est gagnée.
10. Avec `45 %` de chance de base, une nouvelle carte apparaît.

## 4. Types de cartes

Le jeu manipule aujourd’hui **3 familles** de cartes.

### 4.1. Carte Opportunité

C’est la carte principale du jeu.

Elle décrit une mission avec :

- type de mission ;
- ville / continent ;
- type de logement ;
- date de début ;
- durée ;
- paiement total ;
- points de satisfaction ;
- texte d’annonce ;
- parfois la mention `Potes invités` ;
- parfois un animal **déjà gardé** (cœur 💛 affiché à côté du nom). Probabilité fixe `30 %` qu'un tirage du même type retombe sur un pensionnaire connu.

Le joueur peut :

- `Accepter`
- `Refuser`
- `Réfléchir`
- parfois `Accepter en annulant`

La popup d’opportunité est structurée en onglets :

- `Présentation`
- `Planification`
- `⚠ Mission à annuler` quand nécessaire

Un mini-calendrier reste visible à droite pendant toute la consultation.

### 4.2. Carte Chance

Avec `2 %` de chance, un tirage d’opportunité devient une carte `Chance`.

Règles :

- une seule carte Chance active à la fois ;
- on peut la refuser ;
- elle dure toute la partie tant qu’elle n’est pas retirée par sa propre logique.

Perks actuels :

- `Un ami qui s’y connaît`
  - affiche une lecture qualitative de la rémunération (`Arnaque`, `Moyen`, `Bon deal`, `Excellent`)
- `Digital Nomad`
  - revenu freelance aléatoire environ mensuel
  - risque de coup URSSAF en fin d’été / rentrée
- `Star des réseaux`
  - `+20 points` de chance d’opportunité
  - cartes plus lointaines
  - `50 %` de chance que `train`, `ferry`, `boatstop` ou `bus` soient offerts
  - est perdue au premier avion
  - devient définitivement indisponible pour le reste de la partie après un avion

Déblocages automatiques actuels :

- après `10` pet sittings terminés, une proposition spéciale de `Un ami qui s’y connaît` apparaît ;
- après `13 semaines` consécutives sous `1000 €`, une proposition spéciale de `Digital Nomad` apparaît ;
- après `2 ans` de jeu (`104 semaines`), une proposition spéciale de `Star des réseaux` apparaît ;
- ces cartes peuvent être refusées ;
- elles respectent la même contrainte que les cartes Chance normales : pas de seconde carte si un perk est déjà actif.

### 4.3. Retour chez les parents

Le bloc latéral `Retour chez les parents` permet de déclencher une carte spéciale.

Règles :

- disponible seulement si :
  - aucune mission n’est en cours ;
  - aucune autre carte n’est déjà ouverte ;
  - le joueur n’est pas déjà chez ses parents ;
- la destination est toujours la **ville de départ** ;
- il faut payer le trajet pour y aller ;
- une fois sur place :
  - les charges hebdomadaires deviennent `0 €` ;
  - cet état dure jusqu’au prochain trajet qui repart de la ville de départ vers une mission future ;
- la carte reprend la même UX qu’une opportunité :
  - `Présentation`
  - `Planification`
  - `Mission à annuler` si besoin
  - calendrier à droite

Le retour maison peut :

- recalculer le trajet du sitting suivant ;
- remplacer le trajet déjà réservé du sitting suivant ;
- nécessiter l’annulation d’un sitting qui tombe pendant le retour ou qui bloque le redépart.

## 5. Génération des missions

### 5.1. Types de mission

Pool actuel :

- `Dog sitting` : `60 %`
- `Cat sitting` : `18 %`
- `House sitting` : `17 %`
- `Bird sitting` : `5 %`

### 5.2. Lieux

Le jeu utilise aujourd’hui `32 villes` réparties sur `6 continents` :

- `Europe`
- `Africa`
- `Asia`
- `N.America`
- `S.America`
- `Oceania`

### 5.3. Biais géographique

En mode normal :

- `60 %` de chances qu’une carte soit “locale” au continent courant ;
- `40 %` qu’elle soit mondiale.

Le panneau `Annonces` permet aussi un filtre manuel :

- `N’importe où`
- `À proximité`

Le mode `À proximité` restreint le tirage à un petit pool de villes proches de la position actuelle.  
Le choix est pris en compte au prochain clic sur `Tour suivant`.

### 5.4. Horizon de départ

Répartition actuelle des dates de début :

- `40 %` : urgence, départ dans `1 à 2 semaines`
- `10 %` : départ dans `3 à 22 semaines`
- `40 %` : départ dans `23 à 39 semaines`
- `10 %` : départ dans `40 à 52 semaines`

### 5.5. Durée

Répartition actuelle :

- majorité entre `7` et `21 jours`
- une part moyenne entre `22` et `60 jours`
- une petite part longue jusqu’à `90 jours`
- une très petite part ultra courte (`5 à 6 jours`)

### 5.6. Variantes de mission

- logement rare : `25 %`
  - donne `+2 pts`
- `Potes invités` : `30 %`
  - donne `+1 pt` immédiat sur la carte
  - alimente le succès `Kiffeur`
- bonus de rémunération continent lointain : `+20 %`

## 6. Agenda et planification

Le jeu repose sur un agenda de missions futures.

Règles générales :

- on peut réserver plusieurs missions à l’avance ;
- les missions ne peuvent pas se chevaucher si on veut les garder toutes ;
- le temps de transport est une vraie contrainte ;
- une mission peut être acceptée même si elle force à en annuler une autre.

### 6.1. Deux couches de trajet

Le modèle actuel distingue :

- le **trajet principal** d’une mission ;
- éventuellement un **trajet d’approche** pour rejoindre un départ déjà réservé.

Exemple :

- un ferry vers Rio déjà booké au départ de Vienne ;
- une mission intermédiaire acceptée à Athènes ;
- le jeu peut proposer un trajet `Athènes -> Vienne` pour attraper le ferry déjà réservé.

### 6.2. Remplacement vs rattrapage

Quand une nouvelle carte s’insère avant une mission future, le moteur peut :

- **rattraper un trajet réservé**
  - on garde le trajet principal déjà booké ;
  - on ajoute un trajet d’approche vers sa ville de départ
- **remplacer un trajet réservé**
  - l’ancien trajet est jeté ;
  - un nouveau segment est choisi

### 6.3. Billets annulables

Certains transports peuvent être pris en version `annulable`.

Règles :

- surcoût de `+15 %`
- permet de remplacer / annuler le trajet sans perdre son coût

Exceptions :

- `Auto-stop`
- `Bateau-stop`
- `Sur place`

Ces modes sont annulables d’office, sans surcoût.

### 6.4. Annulation d’une mission future

Le joueur peut annuler une mission déjà bookée.

- si elle commence dans plus de `8 semaines` :
  - aucune pénalité de réputation
- si elle commence dans moins de `8 semaines` :
  - malus de réputation pendant `26 semaines`
  - `-10 %` de chance d’opportunité pendant cette durée

Dans tous les cas :

- si des trajets non annulables étaient déjà réservés, leur coût est perdu

## 7. Transports

### 7.1. Modes disponibles

Trajets terrestres :

- `Auto-stop`
- `Bus`
- `Train`

Trajets trans-océaniques :

- `Bateau-stop`
- `Avion`
- `Ferry`

### 7.2. Coût et vitesse actuels

| Mode | Coût/km | Vitesse |
|---|---:|---:|
| Auto-stop | 0,005 € | 60 km/j |
| Bateau-stop | 0,01 € | 80 km/j |
| Avion | 0,03 € | 22 000 km/j |
| Bus | 0,05 € | 200 km/j |
| Train | 0,08 € | 400 km/j |
| Ferry | 0,09 € | 200 km/j |

Important :

- le train et le ferry sont volontairement les plus chers ;
- l’avion est plus cher que le bus sur certains segments, mais moins que train/ferry ;
- l’auto-stop et le bateau-stop sont les vraies options low-cost.

### 7.3. Affichage

Le temps de transport apparaît :

- dans la carte d’opportunité ;
- dans l’agenda ;
- dans le calendrier latéral ;
- en gris hachuré quand le segment est annulable.

## 8. Économie

### 8.1. Valeurs globales

- solde initial : `1000 €`
- coût de vie : `500 €/mois` au démarrage, avec **inflation linéaire de +1 €/semaine**
- formule réelle : `currentWeeklyFood(week) = 500 * 12 / 52 + week`, soit environ `115,38 € + numéro de semaine`
- ordre de grandeur : `~167 € / semaine` après 1 an, `~219 € / semaine` après 2 ans
- victoire : `100 pts`

### 8.2. Paiement des missions

Le paiement est versé **au démarrage** de la mission.  
Les points, eux, sont gagnés **à la fin**.

Le `bénéfice net estimé` affiché sur une opportunité tient compte de cette inflation via un coût moyen de nourriture sur la durée prévue du sitting, pour éviter de surévaluer les missions lointaines.

Tarifs journaliers actuels :

- Dog : `35-55 €/jour`
- Cat : `25-40 €/jour`
- Bird : `30-50 €/jour`
- House : `20-35 €/jour`

### 8.3. Défaite

La partie s’arrête dès que le solde passe sous `0`.

## 9. Succès

Succès actuels :

- `Globe-trotter` : 6 continents, `+30`
- `Bestiaire` : les 3 types d’animaux (`chien`, `chat`, `oiseau`), `+20`
- `Agent Immobilier` : tous les types de logement, `+20`
- `Pékin Express` : tous les transports sauf avion, `+20`
- `Kiffeur` : 5 missions avec `Potes invités`, `+20`
- `Loin du nid` : `52 semaines` sans retour chez les parents, `+20`
- `Écolo` : actif dès le départ, `+25`, perdu au premier avion
- `Expert Chien` : 5 dog sittings, `+7`
- `Ermite` : 5 house sittings, `+7`

Précision :

- utiliser `Retour chez les parents` remet la progression de `Loin du nid` à zéro ;
- une fois débloqué, le succès reste acquis.

Effets spéciaux associés :

- `Expert Chien`
  - double le poids des `Dog sitting`
- `Ermite`
  - double le poids des `House sitting`
- `Écolo`
  - retiré dès qu’un avion est pris

Affichage :

- panneau de succès sous forme de cartes ;
- progression visuelle par icônes grisées plutôt que par simples compteurs.

## 10. Interface actuelle

## 10.1. Menu

- saisie du prénom
- choix d’avatar
- lancement de la partie
- reprise de sauvegarde si présente
- musique `launch.mp3`
- **Tableau des 5 meilleures parties** (clé localStorage `petsitter_scores_v1`) — victoires d'abord, triées par durée la plus courte, puis défaites par points décroissants

## 10.2. Écran de jeu

Colonne centrale :

- carte du monde
- journal

Colonne droite :

- `Agenda`
- `Annonces`
- `Succès`
- `Carte Chance`
- `Retour chez les parents`
- `Album` — historique des animaux gardés, avec icône cœur 💛 et compteur quand un même pensionnaire a été gardé plusieurs fois

## 10.3. Opportunités

Une opportunité ouverte masque le jeu dans une grande modale.

Le joueur peut :

- consulter les onglets
- changer les transports
- réduire la popup avec `Réfléchir`
- rouvrir la carte plus tard via le bandeau d’attente

## 10.4. Fin de partie

La modale de fin affiche :

- victoire ou défaite
- stats globales (missions, refus, continents, succès, solde final)
- stats détaillées (km parcourus, total gagné/transport/nourriture, mode de transport favori, ville préférée, animaux gardés dont nombre revus)
- carte du voyage façon carnet / polarsteps
- succès obtenus
- pourcentage de progression des succès manquants

Le score de la partie est automatiquement enregistré dans le tableau du menu (top 5).

## 11. Sauvegarde, audio, aide

- auto-save continu dans `localStorage`
- musique d’intro au menu
- musique de boucle en partie
- écran d’aide intégré

## 12. Ce qu’un autre dev doit garder en tête

Les zones les plus sensibles du jeu sont :

- la génération d’offre ;
- le recalcul d’agenda ;
- la gestion des trajets réservés / remplacés / rattrapés ;
- les états spéciaux `pendingCard`, `atParents`, `activePerk` ;
- le calendrier latéral, qui sert d’explication visuelle du moteur.

Quand on modifie une règle de transport ou de planning, il faut toujours vérifier :

- la carte d’opportunité ;
- l’agenda ;
- le calendrier ;
- le coût réellement débité au démarrage ;
- les cas d’annulation ;
- les cas `Retour chez les parents`.
