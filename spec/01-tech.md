# Stack technique

## Choix recommandé

- **Vite + React 18 + TypeScript** — setup standard 2025, build rapide, typage utile pour les cartes et l'état du jeu.
- **Gestion d'état** : **Zustand** (léger, simple, parfait pour une seule store globale du jeu). Alternative envisageable : `useReducer` + Context si on veut zéro dépendance.
- **Routing** : non nécessaire (mono-écran avec panneaux).
- **Carte interactive 2D** : **react-simple-maps** (basé sur D3, projection mondiale, supporte le style vintage via CSS / SVG filters). Alternative : **Leaflet** + tuiles custom si on veut du zoom continent fluide.
- **Persistence** : `localStorage` direct, ou middleware `zustand/persist` pour serialization auto.
- **Style** : **Tailwind CSS** + une palette sépia / papier vieilli + une font sérif (Cormorant, Playfair Display via Google Fonts).
- **Icônes** : `lucide-react` pour les icônes système, **SVG custom** au trait pour les pictos thématiques (chien, chat, château…).
- **Lint / format** : ESLint + Prettier.
- **Tests** : Vitest pour la logique de jeu (tirage, économie, succès) — la logique métier doit être testable pure (séparée de React).

## Architecture

```
src/
  app/                # Composants racine, layout, providers
  components/         # Composants UI réutilisables (Card, MapView, AgendaPanel...)
  features/
    cards/            # Génération et logique des cartes Opportunité
    economy/          # Calcul coûts vie, déplacements, paiements
    achievements/     # Détection et déblocage des succès
    map/              # Carte interactive et déplacements
    agenda/           # Planning des missions
  game/               # Cœur de la logique de jeu (pur, sans React)
    engine.ts         # Boucle de tour, état, transitions
    types.ts          # Types : Card, Mission, GameState, Achievement
    rng.ts            # Génération aléatoire seedée (pour reproductibilité tests)
  store/              # Zustand store + persist
  data/               # JSON statiques : villes, types de logements, types d'animaux
  styles/             # Tailwind config, fonts
  assets/             # Pictogrammes SVG, textures papier
```

## Principes

- **Logique métier découplée de React** : tout le calcul du tour (`advanceTurn(state) -> newState`) vit dans `game/`. Les composants n'appellent que des actions du store.
- **RNG seedé** : permet le rejeu déterministe (utile pour debug et tests).
- **Données séparées** : la liste des villes, types d'animaux, types de logements vit dans `data/*.json` pour que l'équilibrage soit modifiable sans toucher au code.
