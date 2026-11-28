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
