# Rapport d’usage de l’IA - TP2

**Assistant utilisé** : assistant IA dans VS Code avec le Copilot SDK.

Ce rapport reprend la structure demandée dans `RAPPORT_IA_MODELE.md`. Les captures
présentes dans le dossier `screen/` constituent les preuves visuelles du travail.

## Mission 2 - Bibliothèque paginée

**Objectif** : afficher les pistes avec une pagination côté serveur, sans charger
toutes les pistes puis les découper dans Angular.

**Prompt principal** : « Implémenter la bibliothèque audio paginée du TP2 en
respectant le contrat `GET /api/tracks?page=...&limit=...`, avec des Signals,
`@for`, `@empty`, `@if` et les boutons de navigation. »

**Plan proposé par l’agent** :

1. Vérifier le modèle `Page<Track>` et le contrat de l’API.
2. Faire passer `page` et `limit` dans `TrackService.list()`.
3. Charger les résultats à chaque changement de page.
4. Représenter la liste, la page courante, le nombre de pages, le chargement et
   l’erreur avec des Signals.
5. Vérifier les bornes des boutons « Préc. » et « Suiv. ».

**Vérifications réalisées par le binôme** : lecture du code de
`TrackService` et de `TracksPageComponent`, vérification du paramètre
`GET /api/tracks?page=1&limit=5` dans Network et vérification visuelle de la
bibliothèque et de ses boutons de pagination.

**Erreurs ou propositions rejetées** : la proposition consistant à récupérer
toutes les pistes puis à les découper localement a été rejetée, car elle ne
respecte pas le sujet. Le backend n’a pas été modifié.

**Fichiers effectivement modifiés** :

- `frontend-starter/src/app/shared/services/track.service.ts`
- `frontend-starter/src/app/components/tracks-page/tracks-page.ts`
- `frontend-starter/src/app/components/tracks-page/tracks-page.html`

**Preuve de fonctionnement** : la capture Network de la requête paginée est
présente dans les captures du projet ; une requête `GET /api/tracks?page=1&limit=5`
a été observée avec une réponse HTTP exploitable par la page.

**Ce que chaque membre sait maintenant expliquer sans l’agent** :

- pourquoi la pagination doit être faite par le serveur ;
- comment `HttpParams` transmet `page` et `limit` ;
- comment les Signals déclenchent la mise à jour de l’interface ;
- pourquoi un changement de page lance une nouvelle requête HTTP ;
- le rôle de `@empty` lorsque la page ne contient aucune piste.

## Mission 3 - Upload et lecture audio

**Objectif** : compléter l’interface d’upload et utiliser la lecture audio
authentifiée existante, sans modifier le contrat HTTP.

**Prompt principal** : « Analyser puis compléter l’upload et la lecture audio du
frontend : validation du fichier, FormData avec `audio` et `title`, états de
chargement, erreurs, succès, lecture Blob/ObjectURL et libération des URLs. »

**Plan proposé par l’agent** :

1. Identifier le choix du fichier, la construction du `FormData` et les appels
   de `TrackService`.
2. Vérifier les contraintes frontend : formats audio acceptés et limite de 25 Mo.
3. Ajouter les états d’upload et empêcher les doubles soumissions.
4. Afficher les pistes sous forme de cards avec leurs métadonnées.
5. Télécharger le Blob uniquement lors de l’action de lecture.
6. Révoquer l’ancien ObjectURL pendant une nouvelle lecture et à la destruction
   du composant.

**Vérifications réalisées par le binôme** :

- vérification du multipart dans `TrackService.upload()` ;
- vérification des champs exacts `audio` et `title` ;
- vérification du chargement, de la progression, du succès et de l’erreur ;
- vérification du téléchargement audio avec `responseType: 'blob'` ;
- vérification de la présence du header JWT via l’intercepteur ;
- vérification visuelle avec `upload-payload.png` et `upload-progress.png` ;
- vérification des cards, des formats, tailles, dates et actions de lecture.

**Erreurs ou propositions rejetées** : il a été décidé de ne pas réimplémenter
le backend ni de modifier le contrat HTTP. Une URL audio placée directement dans
`src` n’a pas été retenue, car le navigateur ne lui ajoute pas automatiquement
le header `Authorization` de l’intercepteur Angular.

**Fichiers effectivement modifiés** :

- `frontend-starter/src/app/shared/services/track.service.ts`
- `frontend-starter/src/app/components/tracks-page/tracks-page.ts`
- `frontend-starter/src/app/components/tracks-page/tracks-page.html`
- `frontend-starter/src/app/components/tracks-page/tracks-page.css`

**Preuves de fonctionnement** :

- `screen/upload-payload.png` montre le payload multipart ;
- `screen/upload-progress.png` montre l’état de progression ;
- les captures de Network montrent la requête de pagination et les échanges
  avec l’API ;
- le lecteur audio reçoit un ObjectURL créé à partir d’un Blob authentifié.

**Réponses aux questions mémoire, buffering et streaming** :

- Le backend utilise `res.sendFile()` : le fichier peut être envoyé depuis le
  disque sans être enregistré dans MongoDB comme contenu binaire.
- Avec `responseType: 'blob'`, le composant reçoit généralement la réponse Blob
  lorsque le téléchargement HTTP est terminé.
- Les fichiers audio ne sont pas tous chargés à l’affichage : seul le Blob de la
  piste choisie est demandé par `play()`.
- Avec 100 éléments `<audio>` utilisant directement des URLs HTTP, le navigateur
  pourrait gérer plusieurs chargements et requêtes indépendantes selon son
  comportement de préchargement.
- `URL.revokeObjectURL()` libère la référence vers la ressource Blob et évite
  l’accumulation d’URLs inutilisées.

**Ce que chaque membre sait maintenant expliquer sans l’agent** :

- pourquoi la validation frontend améliore l’expérience mais ne remplace pas
  celle du backend ;
- la différence entre un Blob téléchargé et du streaming progressif ;
- le rôle de `URL.createObjectURL()` et de `URL.revokeObjectURL()` ;
- pourquoi le bouton d’envoi est désactivé pendant l’upload ;
- pourquoi le JWT est ajouté par l’intercepteur plutôt que par la balise audio.
