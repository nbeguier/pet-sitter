# Stack et architecture actuelles

## 1. Réalité technique

Le projet n’est pas une app React.  
La version active est un **jeu standalone en HTML/CSS/JavaScript vanilla**.

Source principale :

- `game/pet-sitter.html`

Assets :

- `game/world_map_with_nations.svg`
- `game/music/launch.mp3`
- `game/music/ingame.mp3`

Autres fichiers utiles :

- `spec/00-overview.md`
- `spec/02-balance.md`
- `spec/sim/current_balance_sim.js`

`game/index.html` existe, mais n’est pas la vraie entrée du jeu aujourd’hui.

## 2. Organisation du repo

```
game/
  pet-sitter.html            # jeu complet : UI + données + moteur
  world_map_with_nations.svg # fond de carte
  music/
    launch.mp3
    ingame.mp3

spec/
  00-overview.md
  01-tech.md
  02-balance.md
  sim/
    current_balance_sim.js   # simulateur actuel
    balance_sim.py           # legacy / archive
    balance_tweaks.py        # legacy / archive
```

## 3. Architecture interne de `pet-sitter.html`

Même si tout est dans un seul fichier, le code est structuré par grandes zones :

1. `CSS`
   - DA complète du jeu
   - styles de modales, panneaux, calendrier, map, etc.
2. `Markup statique`
   - bouton `?`
   - conteneur `#app`
   - overlay d’aide
3. `Constantes et données`
   - balance
   - coût de vie
   - transports
   - villes
   - templates d’annonces
   - logements
   - perks
   - succès
4. `Helpers`
   - formatage
   - hasard pondéré
   - distance
   - calculs de dates / semaines
   - coût de vie / estimation (`currentWeeklyFood`, `averageWeeklyFood`)
5. `État global`
   - `STATE`
   - `buildDefaultState()`
   - persistence `localStorage`
6. `Moteur planning / transport`
   - model de mission
   - recalcul d’agenda
   - segments de trajet
   - annulations
7. `Génération de cartes`
   - opportunités
   - cartes Chance
   - retour chez les parents
   - souvenirs / événements narratifs
8. `Actions`
   - accepter / refuser
   - annuler mission
   - tour suivant
   - retour menu
9. `Render`
   - sidebar
   - agenda
   - map
   - modales
   - calendrier

## 4. Modèle d’état principal

Le store est un simple objet global `STATE`.

Champs importants :

- `phase`
  - `menu`
  - `playing`
  - `over`
- `week`
- `balance`
- `points`
- `startCity`
- `currentCity`
- `agenda`
- `completed`
- `petsSeen`
- `petsSeenIndex`
- `pendingCard`
- `pendingCardMinimized`
- `pendingCardTab`
- `refusedCount`
- `acceptedCount`
- `endReason`
- `activePerk`
- `socialStarBlocked`
- `friendInsiderMilestoneResolved`
- `digitalNomadMilestoneResolved`
- `accountantMilestoneResolved`
- `socialStarMilestoneResolved`
- `offerFilter`
- `atParents`
- `lastReturnHomeWeek`
- `under1000StreakWeeks`
- `reputationPenaltyUntil`
- `typeCount`
- `potesCount`
- `nomadLastIncomeWeek`
- `urssafYearMarked`
- `parentsHomeAvailable`
- `inheritanceResolved`
- `memories`
- `memoryFlags`
- `romanceThread`
- `friendshipThread`
- `narrativeEventCooldown`
- `memorySpotlight`
- sets de progression :
  - `achievements`
  - `animalsDone`
  - `housingsDone`
  - `continentsDone`
  - `transportModesDone`

Clés `localStorage` à connaître :

- `petsitter_save_v2`
- `petsitter_scores_v1`

## 5. Modèle de mission

Une mission future peut embarquer deux couches de trajet :

- `travel*`
  - trajet principal
- `access*`
  - trajet d’approche vers un départ déjà réservé

Champs structurants :

- `travelMode`
- `travelCancellable`
- `travelDays`
- `travelCost`
- `travelStartDay`
- `travelFrom`
- `travelLocked`
- `accessMode`
- `accessCancellable`
- `accessDays`
- `accessCost`
- `accessStartDay`
- `accessFrom`
- `accessTo`

C’est le cœur des cas compliqués du jeu.

## 5.1. Album d’animaux

Le jeu maintient aussi un mini “CRM animaux” dans `STATE.petsSeen`.

Chaque entrée ressemble à :

- `type`
- `name`
- `animal`
- `firstCity`
- `lastCity`
- `firstWeek`
- `lastWeek`
- `count`

Cette structure sert à trois choses :

- afficher l’album dans la sidebar ;
- permettre les opportunités “animal déjà gardé” ;
- enrichir les stats de fin de partie.

## 5.2. Tableau des scores

Le menu garde un top 5 persistant via `recordScore()`.

Tri actuel :

- victoires d’abord, par durée croissante ;
- puis défaites, par points décroissants.

## 6. Invariants métier importants

Quand on touche au planning, il faut préserver ces règles :

### 6.1. Une mission peut avoir un trajet déjà “figé”

Si un trajet a déjà été réservé, une nouvelle carte peut soit :

- le conserver et ajouter un trajet d’approche ;
- le remplacer ;
- rendre la mission infaisable ;
- imposer une annulation.

### 6.2. Le rendu doit refléter la vraie logique

À chaque changement de transport, il faut que :

- l’agenda ;
- le mini-calendrier ;
- le calcul du net estimé ;
- le coût débité au démarrage

restent cohérents entre eux.

### 6.3. `Retour chez les parents` est un état à part

Ce n’est pas juste un changement de ville.

Il impacte :

- le coût de vie hebdo ;
- le prochain trajet ;
- les cas d’annulation ;
- le calendrier ;
- la sortie de cet état, qui arrive au moment du prochain départ.

### 6.4. Les souvenirs narratifs transportent aussi de l’état

Même s’ils sont surtout là pour le ton, ils ne sont pas juste “cosmétiques”.

Ils impactent :

- le journal ;
- le récap de fin de partie ;
- certains flags persistants (`tatouage`, `surf`, etc.) ;
- les fils `romance` et `amitié`, qui peuvent maintenant aller jusqu’à `5 étapes` dans leur ville dédiée ;
- le cas spécial `Héritage`, qui désactive définitivement `Retour chez les parents`.

## 7. Fonctions sensibles à connaître

Pour un dev qui reprend le projet, les zones à lire en premier sont :

- `currentWeeklyFood()`
- `averageWeeklyFood()`
- `generateRawMission()`
- `buildMissionOffer()`
- `refreshPendingMissionSelections()`
- `refreshPendingHomeSelections()`
- `recomputeAgenda()`
- `nextTurn()`
- `maybeTriggerNarrativeEvent()`
- `recordScore()`
- `applyMissionCancellation()`
- `renderCalendarPane()`
- `renderPetsAlbum()`
- `renderOpportunityPlanning()`
- `renderEndModal()`
- `renderPendingCardModal()`

## 8. Exécution locale

Le jeu peut être ouvert directement dans un navigateur, mais un petit serveur statique est plus confortable.

Exemples :

```bash
cd /Users/nicolas/perso/Lucile
python3 -m http.server 8000
```

Puis ouvrir :

- `http://localhost:8000/game/pet-sitter.html`

## 9. Vérifications rapides utiles

### 9.1. Sanity check syntaxe

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('game/pet-sitter.html','utf8');const m=html.match(/<script>([\\s\\S]*)<\\/script>/); new Function(m[1]); console.log('syntax ok');"
```

### 9.2. Simulation d’équilibrage

Le simulateur actuel exécute le vrai moteur JS du jeu :

```bash
node spec/sim/current_balance_sim.js --n 500 --json
```

Notes :

- c’est le simulateur de référence aujourd’hui ;
- les scripts Python dans `spec/sim/` sont des restes d’une ancienne phase et ne doivent plus être considérés comme source de vérité.

## 10. Conseils de reprise

### 10.1. Avant de toucher au moteur

Toujours identifier si le changement impacte :

- mission simple ;
- mission avec trajet remplacé ;
- mission avec trajet rattrapé (`catch-booked`) ;
- mission annulée ;
- retour chez les parents.

### 10.2. Après un changement

Toujours vérifier manuellement :

- une opportunité simple ;
- une opportunité qui chevauche ;
- un trajet annulable ;
- un trajet non annulable ;
- un cas “retour maison” ;
- un cas “sitting suivant recalculé”.

### 10.3. Si un refactor est envisagé plus tard

La meilleure extraction future serait probablement :

- `data.js`
- `engine.js`
- `render.js`
- `sim/`

Mais aujourd’hui il vaut mieux **garder la cohérence du moteur** que lancer un gros refactor structurel.
