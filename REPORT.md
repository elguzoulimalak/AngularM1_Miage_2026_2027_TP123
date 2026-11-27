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
