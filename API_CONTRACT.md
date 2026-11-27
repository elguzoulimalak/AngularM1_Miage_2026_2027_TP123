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

`Page<Track>` contient `items`, `page`, `limit`, `total` et `pages`. Formats acceptés : MP3, WAV, OGG et M4A, 25 Mo maximum.

Erreurs courantes : `400` validation, `401` authentification, `404` ressource, `409` email déjà utilisé.


## TP4 - visibilité et recherche

`Track` contient désormais `visibility` : `"private"` (valeur par défaut) ou `"public"`. Une piste créée avant le TP4, sans ce champ, est traitée comme privée.

- **`GET /tracks`** (JWT) : pistes de l'utilisateur connecté, des plus récentes aux plus anciennes. Paramètres : `page` (≥ 1, défaut 1), `limit` (1 à 20, défaut 5), `q` optionnel (recherche insensible à la casse dans le titre, 100 caractères maximum). Erreurs : `400` si `q` est invalide, `401`.
- **`GET /tracks/public`** (JWT) : pistes publiques de tous les utilisateurs, des plus récentes aux plus anciennes (« récemment ajoutées »). Mêmes paramètres et erreurs que `GET /tracks`. Chaque élément contient en plus `ownerName`.
- **`POST /tracks`** (JWT, multipart) : champ texte optionnel `visibility` (`public` ou `private`, défaut `private`). Erreur `400` si la valeur est inconnue ; le fichier reçu est alors supprimé du disque.
- **`PATCH /tracks/:id`** (JWT) : corps `{ "visibility": "public" | "private" }`. Seul le propriétaire peut modifier sa piste. Réponses : `200 Track`. Erreurs : `400` visibilité invalide, `401`, `404` piste inconnue, identifiant mal formé ou piste d'un autre utilisateur.
- **`GET /tracks/:id/audio`** (JWT) : autorisé pour le propriétaire, ou pour tout utilisateur connecté si la piste est publique. Sinon `404` (on ne révèle pas l'existence d'une piste privée).
