# Contrat HTTP - TP1 à TP4

Base : `/api`. Sauf inscription et connexion, envoyer `Authorization: Bearer <token>`.

Le contrat HTTP ne dépend pas du choix de persistance : le backend fourni utilise Mongoose et MongoDB. MongoDB conserve les utilisateurs et métadonnées ; les octets des fichiers audio restent sur le disque du serveur.

| Méthode | Route | Requête | Réponse principale |
|---|---|---|---|
| GET | `/health` | - | `{ "status": "ok" }` |
| POST | `/auth/register` | `{name,email,password}` | `201 {token,user}` |
| POST | `/auth/login` | `{email,password}` | `200 {token,user}` |
| GET | `/users/me` | JWT | `200 User` |
| PUT | `/users/me` | `{name}` + JWT | `200 User` |
| GET | `/tracks?page=1&limit=5&q=blues` | JWT | `Page<Track>` (mes pistes) |
| GET | `/tracks/public?page=1&limit=5&q=blues` | JWT | `Page<Track>` (pistes publiques, avec `ownerName`) |
| POST | `/tracks` | multipart : `audio`, `title`, `visibility` | `201 Track` |
| PATCH | `/tracks/:id` | `{visibility}` + JWT | `200 Track` |
| GET | `/tracks/:id/audio` | JWT | flux audio |
| DELETE | `/tracks/:id` | JWT | `204` (bonus) |
| GET | `/tracks/shared?page=1&limit=5&q=` | JWT | `Page<Track>` (partagées avec moi, avec `ownerName`) |
| PUT | `/tracks/:id/shares/:userId` | JWT | `200 Track` |
| DELETE | `/tracks/:id/shares/:userId` | JWT | `200 Track` |
| GET | `/friends` | JWT | `200 {friends, incoming, outgoing}` |
| POST | `/friends/requests` | `{email}` + JWT | `201` ou `200 {id,status,user}` |
| POST | `/friends/requests/:id/accept` | JWT | `200 {id,status}` |
| DELETE | `/friends/requests/:id` | JWT | `204` |
| DELETE | `/friends/:userId` | JWT | `204` |
| GET | `/activity?limit=10` | JWT | `200 {items: ActivityItem[]}` |

`Page<Track>` contient `items`, `page`, `limit`, `total` et `pages`. Formats acceptés : MP3, WAV, OGG et M4A, 25 Mo maximum.

Erreurs courantes : `400` validation, `401` authentification, `404` ressource, `409` email déjà utilisé.


## TP4 - visibilité et recherche

`Track` contient désormais `visibility` : `"private"` (valeur par défaut) ou `"public"`. Une piste créée avant le TP4, sans ce champ, est traitée comme privée.

- **`GET /tracks`** (JWT) : pistes de l'utilisateur connecté, des plus récentes aux plus anciennes. Paramètres : `page` (≥ 1, défaut 1), `limit` (1 à 20, défaut 5), `q` optionnel (recherche insensible à la casse dans le titre, 100 caractères maximum). Erreurs : `400` si `q` est invalide, `401`.
- **`GET /tracks/public`** (JWT) : pistes publiques de tous les utilisateurs, des plus récentes aux plus anciennes (« récemment ajoutées »). Mêmes paramètres et erreurs que `GET /tracks`. Chaque élément contient en plus `ownerName`.
- **`POST /tracks`** (JWT, multipart) : champ texte optionnel `visibility` (`public` ou `private`, défaut `private`). Erreur `400` si la valeur est inconnue ; le fichier reçu est alors supprimé du disque.
- **`PATCH /tracks/:id`** (JWT) : corps `{ "visibility": "public" | "private" }`. Seul le propriétaire peut modifier sa piste. Réponses : `200 Track`. Erreurs : `400` visibilité invalide, `401`, `404` piste inconnue, identifiant mal formé ou piste d'un autre utilisateur.
- **`GET /tracks/:id/audio`** (JWT) : autorisé pour le propriétaire, pour tout utilisateur connecté si la piste est publique, ou pour un ami avec qui la piste est partagée (étape 2). Sinon `404` (on ne révèle pas l'existence d'une piste privée).

## TP4 étape 2 - amis et partage révocable

`Track` contient aussi `sharedWith` : la liste des identifiants des amis avec qui la piste est partagée. Ce champ n'est renvoyé qu'au propriétaire (`GET /tracks`, `PATCH`, `PUT`/`DELETE` des partages). Les listes `/tracks/public` et `/tracks/shared` ne l'exposent jamais.

`FriendUser` = `{ id, name, email }`.

- **`GET /friends`** (JWT) : réponse `200 { friends: [{ friendshipId, user: FriendUser, since }], incoming: [{ id, user, createdAt }], outgoing: [{ id, user, createdAt }] }`. `incoming` contient les invitations reçues, `outgoing` les invitations envoyées. Erreur : `401`.
- **`POST /friends/requests`** (JWT) : corps `{ "email": "ami@exemple.fr" }`. Réponse `201 { id, status: "pending", user }`. Si cette personne m'avait déjà invité·e, son invitation est acceptée et la réponse est `200 { id, status: "accepted", user }`. Erreurs : `400` email invalide ou s'inviter soi-même, `404` aucun utilisateur avec cet email, `409` déjà amis ou invitation déjà envoyée.
- **`POST /friends/requests/:id/accept`** (JWT) : seul le destinataire d'une invitation en attente peut l'accepter. Réponse `200 { id, status: "accepted" }`. Erreurs : `401`, `404` invitation inconnue ou destinée à quelqu'un d'autre.
- **`DELETE /friends/requests/:id`** (JWT) : le destinataire refuse l'invitation, ou l'expéditeur l'annule. Réponse `204`. Erreurs : `401`, `404`.
- **`DELETE /friends/:userId`** (JWT) : retire un ami. **Tous les partages entre les deux utilisateurs sont arrêtés**, dans les deux sens. Réponse `204`. Erreurs : `401`, `404` si ce n'est pas un ami.
- **`GET /tracks/shared`** (JWT) : pistes que des amis m'ont partagées, les plus récentes d'abord. Mêmes paramètres (`page`, `limit`, `q`) et erreurs que `GET /tracks/public`.
- **`PUT /tracks/:id/shares/:userId`** (JWT) : partage une de mes pistes avec un ami. L'opération est idempotente (`$addToSet`). Réponse `200 Track`. Erreurs : `401`, `403` si `userId` n'est pas un ami accepté, `404` si la piste est inconnue ou appartient à un autre utilisateur.
- **`DELETE /tracks/:id/shares/:userId`** (JWT) : arrête le partage. L'ami ne voit plus la piste et ne peut plus l'écouter. Réponse `200 Track`. Erreurs : `401`, `404`.


## TP4 étape 3 - fil d'activité des amis

- **`GET /activity`** (JWT) : dernières actions de mes amis acceptés, des plus récentes aux plus anciennes. Paramètre `limit` optionnel (1 à 50, défaut 10 ; une valeur invalide donne 10). Réponse `200 { items: ActivityItem[] }`, avec `ActivityItem` = `{ id, type, at, user: { id, name }, track: { id, title } }`. Erreur : `401`.
  - `type: "track_published"` : l'ami a rendu une piste publique, à l'upload ou avec `PATCH /tracks/:id`.
  - `type: "track_shared"` : l'ami a partagé une piste **avec moi** (`PUT /tracks/:id/shares/:userId`). Les partages avec d'autres personnes ne sont jamais montrés.
  - Un événement disparaît du fil dès que la piste est supprimée, redevient privée ou n'est plus partagée avec moi. Il disparaît aussi si l'auteur n'est plus mon ami. Pour une même piste et un même type, seul l'événement le plus récent est gardé.
  - Les événements sont enregistrés par `POST /tracks` (si `visibility = public`), `PATCH /tracks/:id` (passage en public) et `PUT /tracks/:id/shares/:userId`. Ces routes ne changent pas de contrat : si l'enregistrement de l'événement échoue, l'erreur est journalisée et la réponse reste un succès.
