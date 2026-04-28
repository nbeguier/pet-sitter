# Pet Sitter — Spécifications du jeu

> Jeu navigateur en React. Le joueur incarne un·e pet-sitter (et plus rarement house/bird/cat-sitter) qui voyage de mission en mission. Le but : enchaîner les opportunités, gérer son argent, et accumuler des points de succès — sans jamais finir à découvert.

## 1. Pitch

Le joueur pioche au tour par tour des cartes **Opportunité**. La grande majorité concerne du **Dog sitting**, mais on tombe parfois sur des cartes plus originales : **Cat sitting**, **House sitting**, **Bird sitting**, etc.

Chaque carte propose un contrat avec un lieu, un type de logement, un paiement, une durée et une date de début. Le joueur peut accepter ou refuser — refuser, c'est parier qu'une meilleure opportunité arrivera bientôt.

## 2. Boucle de jeu

À chaque tour (= 1 semaine) :

1. Le temps avance d'une semaine.
2. Avec une probabilité **P_opportunité = 45%**, une carte Opportunité est piochée et présentée.
3. Si une carte est proposée, le joueur choisit : **accepter** ou **refuser** (refuser = la carte disparaît).
4. Les coûts récurrents (vie courante) et ponctuels (déplacements) sont prélevés.
5. Si une mission acceptée **démarre** ce tour : paiement total versé et coût de transport débité.
6. Si une mission acceptée **se termine** ce tour : points de satisfaction crédités.
7. Les succès éventuellement débloqués déclenchent des points.
8. Condition de défaite vérifiée : si le solde passe sous 0, fin de partie.
9. Condition de victoire vérifiée : si points ≥ 100, fin de partie.

**Note** : pendant qu'une mission est en cours, les tours continuent normalement et le joueur peut piocher / accepter d'**autres** cartes futures — tant qu'aucun chevauchement temporel n'existe entre deux sittings.

## 3. Cartes Opportunité

### 3.1. Type de mission (avec probabilités indicatives)

- **Dog sitting** — très fréquent (~60%) — bien payé, mais satisfaction faible.
- **Cat sitting** — peu fréquent (~18%) — moins bien payé, mais satisfaction plus élevée.
- **House sitting** (= garder un logement **sans animal**) — rare (~12%). 5 réussis → succès **Ermite**.
- **Bird sitting** — très rare (~5%).
- *(types additionnels possibles plus tard : plant sitting, fish sitting, exotic sitting…)*

### 3.2. Champs d'une carte

- **Lieu** : ville + pays + continent.
- **Type de logement** : appartement, maison, villa, château, péniche, cabane, etc.
- **Paiement** : montant total (calculé depuis le tarif journalier × durée).
- **Durée** : exprimée en jours ou en mois.
- **Date de début** : peut être proche ou très éloignée de la date courante.
- **Points de satisfaction** : valeur fixe créditée à la fin de la mission.
- **Mention "potes invités"** (optionnelle) : drapeau pour le succès Kiffeur.

### 3.3. Anatomie visuelle d'une carte (UI)

Chaque carte Opportunité affichée à l'écran ressemble à une petite annonce, dans le style atlas / carnet de voyage :

1. **Image du logement** en haut (illustration ou photo retouchée sépia).
2. **Bloc caractéristiques** structuré :
   - Type de mission (Dog / Cat / Bird / House sitting) + animal·aux concerné·s
   - Lieu (ville, pays, continent)
   - Type de logement
   - Date de début + durée
   - Paiement total
   - Points de satisfaction
   - Mention "potes invités" si applicable
3. **Zone de texte d'ambiance** (2 à 3 phrases) : description rédigée de l'annonce, ton "leboncoin" / petite annonce — purement décorative, pour donner du caractère. Exemples :
   > "Cherche personne de confiance pour s'occuper de Maurice, golden retriever de 8 ans très calme. Le logement donne sur le canal, plantes à arroser deux fois par semaine. Possibilité d'inviter des amis."

   > "Petite maison perchée dans la vallée, à garder pendant mon voyage. Pas d'animaux, juste les volets à ouvrir et le courrier à relever. Endroit idéal pour les amateurs de silence."

4. **Boutons** : `Accepter` / `Refuser`.

Ces 2-3 phrases sont **générées à partir de templates** (avec variables : nom de l'animal, type de logement, lieu, mentions diverses) pour éviter d'avoir à rédiger 150 textes uniques. Quelques dizaines de templates suffisent à produire de la variété perçue.

## 4. Économie

- **Solde** : argent disponible du joueur.
- **Solde de départ** : équivalent à **3 mois de coûts de vie** (= 1500€ avec un coût de vie de 500€/mois).
- **Revenus** : paiements des missions acceptées et terminées.
- **Coûts de vie (nourriture)** : **500 €/mois fixes**, prélevés en mission **comme** hors mission. La nourriture est toujours à la charge du joueur.
- **Logement** : gratuit pendant un sitting (le joueur loge dans le logement de la mission). Hors sitting, pas de coût de logement (le joueur est censé bouger / dormir où il peut, c'est abstrait).
- **Coûts de déplacement** : selon la distance × le mode de transport choisi (voir §8).
- **Défaite** : solde < 0.

## 5. Points & Succès

Les points ne se confondent pas avec l'argent. On en gagne via :

- **Satisfaction de la mission** : chaque carte indique un nombre de points fixe gagnés en fin de mission.
- **Succès débloqués** : voir §15 ci-dessous.

## 6. Temps & tours

- **Unité d'un tour : 1 semaine.**
- Calendrier interne : date courante du jeu, qui avance d'une semaine à chaque tour.
- Les missions ont une date de début future ; le joueur peut **réserver des missions à l'avance**.

## 7. Agenda / planning

- Le joueur dispose d'un **agenda visuel** (calendrier).
- Il peut empiler plusieurs missions futures tant qu'elles **ne se chevauchent pas dans le temps** (et qu'il a le temps de voyager entre les deux — voir §8).
- Les missions acceptées sont visibles dans l'agenda avec leurs dates et lieux.

## 8. Carte du monde & déplacements

- **Carte interactive 2D** du monde réel, esthétique d'**atlas / carnet de voyage vintage** (papier vieilli, typo sérif).
- Les villes sont des points cliquables.
- Le joueur a une position courante ; les déplacements tracent une ligne sur la carte.
- **Distance** : à vol d'oiseau entre les deux points.
- **Modes de transport au choix** :
  - Avion : rapide, cher.
  - Train : intermédiaire.
  - Bus / voiture : lent, économique.
  - Auto-stop / lent : très long, presque gratuit.
- **Règle clé** : le **coût d'un transport est proportionnel à sa rapidité**. Avoir beaucoup de temps entre deux missions permet de voyager presque gratuitement. À l'inverse, si on a accepté deux missions trop rapprochées (ex: 3 jours d'écart) sur des continents éloignés, on est **forcé de prendre l'avion**, donc de payer cher.
- L'agenda doit donc être planifié en pensant au temps de transit nécessaire.

## 9. Conditions de fin de partie

- **Victoire** : atteindre **100 points** (seuil ajustable selon équilibrage).
- **Défaite** : solde d'argent < 0.
- À voir : possibilité de continuer après victoire pour un high-score.

## 10. Système de points

Les points proviennent de plusieurs sources :

- **Satisfaction de la mission** : chaque carte Opportunité indique un **nombre de points fixe** gagné à la fin de la mission (en plus du paiement). C'est la "satisfaction" du sitting.
- **Succès géographiques** : ex. visiter tous les continents → bonus de points.
- **Autres succès** : à définir (séries, types de missions rares, etc.).

## 11. Génération & présentation des cartes

- **Pool biaisé géographiquement** : à chaque tirage, **60 % de chances** que la carte tombe dans le **continent courant du joueur** (cartes "locales"), **40 % de chances** qu'elle vienne de n'importe où dans le monde (cartes "lointaines"). Cela donne une activité régulière à proximité tout en gardant le frisson des grandes opportunités.
- **Une seule carte par tour** : le joueur voit l'opportunité, et choisit **accepter** ou **refuser**. Une carte refusée disparaît définitivement.
- La probabilité **P_opportunité = 45 %** d'avoir une carte au tour : certains tours, rien ne sort.

## 12. Direction artistique

- **Style atlas / carnet de voyage vintage** : papier vieilli, encre sépia, typographie sérif (genre Playfair, Cormorant), traits dessinés à la plume.
- Les cartes Opportunité reprennent ce style mais sont structurées comme des **petites annonces** (voir §3.3) : photo du logement, caractéristiques, texte d'ambiance.
- Les icônes (chien, chat, oiseau, château, appartement…) en pictogrammes au trait.

## 13. Démarrage de partie

- **Choix d'un personnage** : purement cosmétique (avatar, prénom). Aucun effet sur les stats / l'économie.
- **Position de départ** : ville **aléatoire** parmi un set défini.
- **Solde de départ** : équivalent à 3 mois de coûts de vie.

## 14. Sauvegarde

- **Mode solo uniquement** (multijoueur potentiellement plus tard).
- **Auto-save dans le `localStorage`** : la partie en cours est persistée en continu, on reprend où on en était au prochain lancement.

## 15. Succès & système d'Expertise

### 15.1. Succès géographiques

- **Globe-trotter** : avoir gardé sur **chaque continent**. Modèle retenu : **6 continents sans Antarctique** : Europe, Afrique, Asie, **Amérique du Nord**, **Amérique du Sud**, Océanie.

### 15.2. Bestiaire

- **Bestiaire complet** : avoir gardé chaque type d'animal au moins une fois (chien, chat, oiseau, et tous les types ajoutés).

### 15.3. Système d'Expert (mécanique transverse)

Quand le joueur a réussi **5 sittings du même type**, il débloque une **carte Expert** correspondante :

- 5 dog sittings → **Expert Chien**
- 5 cat sittings → **Expert Chat**
- 5 House sittings → **Ermite** (un House sitting est par définition un sitting **sans animal**).

Note : pas d'Expert Oiseau (Bird sitting reste dans le pool de base, sans biais possible).

**Effet d'une carte Expert** : tant que le joueur la possède, le **pool de tirage est biaisé en faveur de ce type de carte** (la proba qu'**une fois** une carte est tirée, elle soit de ce type augmente). Cela **ne change pas** la probabilité globale `P_opportunité = 45%` — juste la composition du pool. Plusieurs Expert cumulables.

Chaque carte Expert débloquée donne aussi un **bonus de points**.

### 15.4. Succès "Kiffeur"

Certaines cartes Opportunité portent la mention **"potes invités"**. Aucun impact économique ou ludique : c'est purement un drapeau narratif. Après **5 sittings réussis avec cette mention**, le succès **Kiffeur** est débloqué (bonus de points + carte Kiffeur affichée).

### 15.5. UI des succès

- Un **panneau "Mes cartes"** liste les cartes Expert obtenues (Chien, Chat, Oiseau, Ermite, Kiffeur, Globe-trotter, etc.).
- Visuel : style carte d'identité / blason.

## 16. Aide

- **Pas de tutoriel interactif**. Au premier lancement, on entre directement dans la partie.
- Un bouton **"Aide"** (icône `?`) ouvre une **page d'aide dédiée** récapitulant : la boucle de tour, l'agenda, la carte, les coûts, les succès, les conditions de victoire/défaite.

## 17. Décisions ouvertes restantes

- Échelle économique exacte (€/mois de vie, paiements types, tarifs de transport au km × mode)
- Distribution des points de satisfaction par carte (range typique pour atteindre 100 pts)
- Valeur en points des succès débloqués (Globe-trotter, Bestiaire, Experts, Kiffeur)
- Liste précise des types de logement et types d'animaux (pour les data files)
- Liste de villes (combien ? quelles villes ?)
