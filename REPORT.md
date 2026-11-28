# REPORT — Mini-projet TP4

Projet : **Guitar Practice Cloud**, une appli de partage de backing tracks entre musiciens.
La conception (fonctionnalités, interfaces, choix techniques et découpage) est
détaillée dans [`md/TP4_CONCEPTION.md`](md/TP4_CONCEPTION.md).

## Étape 1 : visibilité public/privé et recherche

### Travail effectué

**Backend (`backend/`)**
- `models/Track.js` : nouveau champ `visibility` (`private` par défaut, `enum`) et index `{ visibility, createdAt }`. `toPublic()` renvoie la visibilité.
- `src/tracks/query.js` (nouveau) : fonctions pures de validation et de construction des filtres (`parseVisibility`, `parseSearch`, `escapeRegex`, `myTracksFilter`, `publicTracksFilter`, `readableTrackFilter`, `parsePagination`).
- `app.js` :
  - `GET /api/tracks` accepte `q`, une recherche par titre ;
  - nouvelle route `GET /api/tracks/public` : pistes publiques paginées, les plus récentes d'abord, avec `ownerName` ;
  - nouvelle route `PATCH /api/tracks/:id` : changement de visibilité, réservé au propriétaire ;
  - `POST /api/tracks` accepte un champ `visibility` et supprime le fichier reçu si la valeur est invalide ;
  - `GET /api/tracks/:id/audio` autorise désormais aussi la lecture des pistes publiques.
- `API_CONTRACT.md` mis à jour avec les nouvelles routes : paramètres, réponses et erreurs.

**Frontend (`frontend-starter/`)**
- `Track` : champs `visibility`, `ownerId` et `ownerName`.
- `TrackService` : `list(page, limit, q)`, `listPublic(...)`, `setVisibility(id, v)`, et `upload(..., visibility)`.
- Page **Backing tracks** : choix de la visibilité à l'import, badge « Privée / Publique », bouton « Rendre publique / privée », recherche dans mes pistes.
- Nouvelle page **Découvrir** (`/discover`, protégée par `authGuard`) : « Récemment ajoutées », recherche, pagination, lecture, mention « (vous) » sur ses propres pistes.

### Choix techniques

- **Privé par défaut** : rien n'est publié sans action explicite de l'utilisateur. Les anciennes pistes sans champ restent privées.
- **Regex échappée plutôt qu'index `$text`** : elle permet la recherche par préfixe (« blu » trouve « blues ») et l'échappement empêche l'injection d'expressions régulières. La longueur est limitée à 100 caractères.
- **Contrôle d'accès dans la requête MongoDB** : une piste privée d'un autre utilisateur renvoie `404`, ce qui ne révèle pas son existence.
- **Tests sans MongoDB** : la logique est extraite en fonctions pures, et les routes sont testées avec des doublures Mongoose (`node:test` `mock.method`).

### Résultats des tests

| Partie | Commande | Résultat |
|---|---|---|
| Backend | `cd backend && npm test` | **16 / 16** tests réussis (2 existants + 14 nouveaux) |
| Frontend | `cd frontend-starter && npm test` | **30 / 30** tests réussis (9 fichiers ; 11 nouveaux tests) |
| Frontend | `npm run build` | build OK |

Les nouveaux tests backend couvrent la validation de la visibilité et de la recherche, l'échappement des regex, les filtres d'accès, la valeur par défaut du schéma, le `401` sans JWT, le `400` pour une visibilité ou une recherche invalide, le `404` pour une piste d'un autre utilisateur ou un identifiant mal formé, et le fait que `storedName` n'est jamais exposé.

Les nouveaux tests frontend couvrent les paramètres HTTP du service (`q` n'est envoyé que s'il n'est pas vide, `PATCH`, le multipart avec `visibility`), le basculement de visibilité (succès et erreur), la recherche qui revient à la page 1, la page Découvrir (liste, recherche vide, « (vous) », piste devenue privée, erreur serveur).

### Reste à vérifier manuellement

Avec MongoDB Atlas : créer deux comptes, rendre une piste publique avec le premier, puis la retrouver et l'écouter depuis Découvrir avec le second. Ensuite, la rendre privée et vérifier que la lecture renvoie `404`. Ces vérifications se font dans l'onglet Network.

Vérification manuelle faite par l'équipe : inscription, upload public/privé, Découvrir, recherche, et lecture audio par un autre compte. Tout fonctionne.

## Étape 2 : amis et partage révocable

### Travail effectué

**Backend (`backend/`)**
- `models/Friendship.js` (nouveau) : `{ requester, recipient, status: pending | accepted }`, avec un index unique sur la paire.
- `models/Track.js` : nouveau champ `sharedWith` (amis destinataires, index). `toPublic()` le renvoie au propriétaire.
- `src/friends/logic.js` (nouveau) : fonctions pures `friendshipBetweenFilter`, `friendshipsOfFilter`, `splitFriendships`, `publicUser`, `parseEmail`.
- `src/friends/routes.js` (nouveau), routes amis :
  - `GET /api/friends` ;
  - `POST /api/friends/requests` (invitation par email ; une invitation croisée est acceptée automatiquement) ;
  - `POST /api/friends/requests/:id/accept` ;
  - `DELETE /api/friends/requests/:id` (refuser ou annuler) ;
  - `DELETE /api/friends/:userId` (retirer un ami et arrêter tous les partages entre les deux).
- `app.js`, routes de partage :
  - `PUT /api/tracks/:id/shares/:userId` (ami accepté uniquement, sinon `403`) ;
  - `DELETE /api/tracks/:id/shares/:userId` (arrêter le partage) ;
  - `GET /api/tracks/shared` (pistes partagées avec moi).
  - Les listes publique et partagée utilisent le même handler (`othersTracksHandler`).
  - L'accès audio inclut désormais `{ sharedWith: moi }`.
- `API_CONTRACT.md` documente les 8 nouvelles routes : méthode, authentification, corps, réponses et erreurs.

**Frontend (`frontend-starter/`)**
- `FriendService` et modèles `Friend`, `FriendRequest`, `FriendsOverview`.
- `TrackService` : `listShared`, `share`, `unshare`.
- Nouvelle page **Amis** (`/friends`) : formulaire d'invitation validé, invitations reçues (Accepter / Refuser), invitations envoyées (Annuler), liste des amis (Retirer, avec confirmation).
- **Backing tracks** : bouton « Partager (n) » sur chaque piste. Il ouvre un panneau avec une case à cocher par ami. Décocher arrête le partage.
- **Découvrir** : onglets « Publiques » et « Partagées avec moi ».
- `README.md` : il faut lancer le front avec `npm start`, sinon le proxy n'est pas chargé et `/api` renvoie `404`.

### Choix techniques

- **Une collection `Friendship`** plutôt qu'un tableau d'amis dans `User`. La relation existe une seule fois, et le statut `pending` / `accepted` couvre invitations et amitiés. Refuser, annuler ou retirer supprime simplement le document.
- **`sharedWith` sur `Track`** plutôt qu'une collection `Share`. Les requêtes restent simples (`{ sharedWith: moi }`), `$addToSet` évite les doublons et `$pull` arrête un partage en une opération.
- **Partage réservé aux amis acceptés** : le backend vérifie l'amitié avant d'écrire, et répond `403` sinon.
- **Retirer un ami arrête tous les partages, dans les deux sens.** Sinon, un ancien ami garderait l'accès à des pistes privées.
- **Confidentialité** : `sharedWith` n'est renvoyé qu'au propriétaire. Les listes publique et partagée ne révèlent pas avec qui d'autre une piste est partagée.
- **Invitation croisée** : si B invite A alors que A avait déjà invité B, l'invitation de A est acceptée, au lieu de créer une deuxième invitation inverse.

### Résultats des tests

| Partie | Commande | Résultat |
|---|---|---|
| Backend | `cd backend && npm test` | **39 / 39** réussis (23 nouveaux dans `test/tp4-friends.test.js`) |
| Frontend | `cd frontend-starter && npm test` | **44 / 44** réussis (11 fichiers ; 14 nouveaux) |
| Frontend | `npm run build` | build OK, sans avertissement |

Côté backend, les nouveaux tests couvrent :
- la validation des emails ;
- le rangement amis / invitations reçues / invitations envoyées ;
- l'invitation : `400` pour un email invalide ou soi-même, `404` pour un inconnu, `409` si déjà amis ou déjà invité, l'invitation croisée acceptée ;
- l'acceptation réservée au destinataire ;
- le refus ou l'annulation ;
- le retrait d'un ami, qui arrête les partages dans les deux sens ;
- le partage refusé à un non-ami (`403`) ;
- `$addToSet` et `$pull` ;
- la liste « partagées avec moi », qui ne contient pas `sharedWith`.

Côté frontend, les nouveaux tests couvrent :
- les routes du `FriendService` ;
- la page Amis : affichage, email invalide, invitation, erreur `404`, acceptation, retrait seulement après confirmation ;
- le panneau de partage : chargement unique des amis, partage puis arrêt, erreur `403` ;
- l'onglet « Partagées avec moi ».

### À vérifier manuellement (MongoDB Atlas)

1. Avec deux comptes A et B, A invite B, puis B accepte depuis « Amis ».
2. A partage une piste privée avec B. B la voit dans Découvrir, onglet « Partagées avec moi », et peut l'écouter.
3. A décoche B. B ne voit plus la piste, et la lecture renvoie `404`.
4. A partage de nouveau, puis retire B de ses amis. Le partage disparaît aussi.

Vérification manuelle faite par l'équipe sur MongoDB Atlas : invitation, acceptation, partage, lecture et révocation. Tout fonctionne.

## Étape 3 : fil d'activité des amis

### Travail effectué

**Backend (`backend/`)**
- `models/Activity.js` (nouveau) : journal `{ actor, type: track_published | track_shared, track, target, createdAt }`, avec un index `{ actor, createdAt }`.
- `src/activity/record.js` : `recordActivity()` enregistre un événement en « best effort ». Une erreur est journalisée sans faire échouer l'upload ou le partage.
- Les événements sont enregistrés à trois moments :
  - upload d'une piste publique ;
  - passage d'une piste en public (`PATCH`) ;
  - partage avec un ami (`PUT .../shares/:userId`).
- `src/activity/logic.js` : fonctions pures `parseFeedLimit`, `friendIdsOf`, `feedFilter`, `isStillVisible` et `buildFeed`.
- `src/activity/routes.js` : `GET /api/activity?limit=`. La route récupère les amis acceptés, lit leurs événements (publications, et partages faits avec moi), puis filtre ceux qui ne sont plus valables, supprime les doublons et applique la limite.
- `API_CONTRACT.md` et `README.md` sont mis à jour.

**Frontend (`frontend-starter/`)**
- Modèle `ActivityItem` et `FriendService.activity(limit)`.
- **Découvrir** : un bloc « Activité de mes amis » à droite (en dessous sur mobile), avec un bouton Actualiser. On y lit « Alice vous a partagé « Riff funk » » ou « Bob a publié « Blues lent en E » », avec la date et un bouton de lecture. Si le fil est vide, un lien invite à ajouter des amis.

### Choix techniques

- **Un journal d'événements plutôt qu'un calcul à partir des pistes.** `Track` ne garde ni la date de passage en public ni la date d'un partage : `createdAt` est la date d'upload, et `updatedAt` change à chaque modification. Le journal garde la vraie date de chaque action.
- **Le journal n'est jamais modifié, le filtrage se fait à la lecture** (`isStillVisible`). Arrêter un partage, rendre une piste privée ou la supprimer fait disparaître l'événement du fil, sans code supplémentaire dans ces routes. Retirer un ami aussi, puisque le fil ne lit que les événements des amis actuels.
- **Confidentialité** : je ne vois que les partages faits **avec moi**, jamais ceux faits avec d'autres personnes. La réponse ne contient ni `sharedWith` ni la visibilité.
- **Doublons** : si une piste passe plusieurs fois en public, seul l'événement le plus récent est gardé.
- **Lecture de `limit × 3` événements** avant le filtrage, pour que le fil reste plein même si certains événements sont écartés. C'est un compromis simple. Sur un très gros volume, il faudrait paginer.
- **« Best effort » pour l'écriture** : l'action principale a déjà réussi, donc une panne du journal ne doit pas la faire échouer. Elle est journalisée côté serveur.

### Résultats des tests

| Partie | Commande | Résultat |
|---|---|---|
| Backend | `cd backend && npm test` | **51 / 51** réussis (12 nouveaux dans `test/tp4-activity.test.js`) |
| Frontend | `cd frontend-starter && npm test` | **48 / 48** réussis (4 nouveaux) |
| Frontend | `npm run build` | build OK, sans avertissement |

Côté backend, les nouveaux tests couvrent :
- les bornes de `limit` ;
- le calcul des amis ;
- le filtre MongoDB ;
- `isStillVisible` : piste supprimée, redevenue privée, plus partagée, ou changée de propriétaire ;
- la suppression des doublons et la limite ;
- `recordActivity`, qui n'échoue pas si l'écriture échoue ;
- `GET /api/activity` : `401`, fil vide sans amis (sans lecture du journal), filtrage des événements invalides, pas de `sharedWith` dans la réponse ;
- l'enregistrement de `track_published` lors d'un `PATCH` public (et rien lors d'un `PATCH` privé) ;
- l'enregistrement de `track_shared` avec le destinataire.

Les tests des étapes 1 et 2 simulent maintenant `Activity.create`, ce qui évite toute écriture MongoDB pendant les tests.

Côté frontend, les nouveaux tests couvrent :
- `FriendService.activity()` ;
- l'affichage du fil ;
- la lecture d'une piste depuis le fil ;
- le fil vide (lien vers Amis) et l'erreur serveur.

### À vérifier manuellement (MongoDB Atlas)

1. A et B sont amis. A rend une piste publique : B voit « A a publié … » dans Découvrir.
2. A partage une piste privée avec B : B voit « A vous a partagé … » et peut l'écouter depuis le fil.
3. A arrête le partage ou rend la piste privée : après « Actualiser », l'événement disparaît chez B.

Note : les actions faites avant cette étape n'apparaissent pas dans le fil, car le journal commence avec cette version.

Vérification manuelle faite par l'équipe sur MongoDB Atlas : le fil d'activité fonctionne.

## Finition : recherche avancée

### Travail effectué

**Backend (`backend/`)**
- `src/tracks/query.js` :
  - tables `FORMATS` (format vers types MIME) et `SORTS` ;
  - fonctions pures `parseFormat`, `parseSort`, `parseTrackQuery` (valide `q`, `format`, `sort` et `owner` en une fois), `sortOptions` et `ownerNameFilter` ;
  - `myTracksFilter`, `publicTracksFilter` et `sharedWithMeFilter` acceptent un format.
- `app.js` : les trois listes (`/tracks`, `/tracks/public`, `/tracks/shared`) acceptent `format` et `sort`. Les listes publique et partagée acceptent aussi `owner`. Pour ce dernier, on cherche d'abord les utilisateurs dont le nom correspond, puis on filtre sur `ownerId: { $in: ... }`.
- `API_CONTRACT.md` et `README.md` sont mis à jour.

**Frontend (`frontend-starter/`)**
- Nouveau composant réutilisable **`app-track-filters`** : un bouton « Filtres avancés » avec le nombre de filtres actifs, et un panneau avec Format, Trier par, Propriétaire (en option) et Réinitialiser.
- Le composant est utilisé dans **Backing tracks** (sans propriétaire) et dans **Découvrir** (avec propriétaire). Les filtres sont gardés quand on change d'onglet.
- `TrackService.list`, `listPublic` et `listShared` acceptent un objet `TrackFilters`. Seuls les paramètres utiles sont envoyés : pas de `format` vide, ni de `sort=recent`.

### Choix techniques

- **Un format correspond à une liste de types MIME** (`$in`), car un même format peut arriver avec plusieurs types (`audio/wav` et `audio/x-wav`, par exemple).
- **Liste blanche pour le tri** : seules les clés de `SORTS` sont acceptées, donc l'utilisateur ne peut jamais trier sur un champ arbitraire. `Object.hasOwn` évite que `toString` ou `constructor` passent pour des valeurs valides.
- **Collation française seulement pour le tri par titre** : « école » et « Ecole » sont rangés ensemble. Les autres tris n'en ont pas, ce qui laisse MongoDB utiliser les index existants.
- **Recherche par propriétaire en deux temps** (utilisateurs, puis pistes) plutôt qu'un `$lookup` : c'est plus simple, et chaque requête peut utiliser son index. Le nombre de propriétaires est limité à 100 par recherche.
- **Un composant de filtres partagé**, pour ne pas dupliquer le formulaire entre deux pages. Il n'émet que si les filtres changent vraiment.

### Résultats des tests

| Partie | Commande | Résultat |
|---|---|---|
| Backend | `cd backend && npm test` | **63 / 63** réussis (12 nouveaux dans `test/tp4-advanced-search.test.js`) |
| Frontend | `cd frontend-starter && npm test` | **57 / 57** réussis (12 fichiers ; 9 nouveaux) |
| Frontend | `npm run build` | build OK, sans avertissement |

Côté backend, les nouveaux tests couvrent :
- la validation de `format` et `sort`, y compris `toString` et un tableau ;
- les messages d'erreur de `parseTrackQuery` ;
- le filtre `$in` sur les types MIME ;
- la collation, utilisée seulement pour le tri par titre ;
- l'échappement de `owner` ;
- les routes : format avec tri par titre, ordre par défaut, `400` sans lecture de la base, filtre par propriétaire, page vide sans propriétaire correspondant, combinaison partage + format + taille.

Côté frontend, les nouveaux tests couvrent :
- les paramètres envoyés par le service ;
- le composant de filtres : ouverture, émission, pas de doublon, champ propriétaire, réinitialisation ;
- la page Découvrir : retour à la page 1, message « aucun résultat », filtres gardés en changeant d'onglet ;
- la page Backing tracks : recherche et filtres combinés, pas de champ propriétaire.

### À vérifier manuellement (MongoDB Atlas)

Dans Découvrir, ouvrir « Filtres avancés », choisir un format, trier par titre et saisir une partie du nom d'un ami. Vérifier dans l'onglet Network que `GET /api/tracks/public?...&format=...&sort=title&owner=...` renvoie les bonnes pistes.
