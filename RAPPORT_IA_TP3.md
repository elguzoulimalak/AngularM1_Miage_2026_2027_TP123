# Rapport d’usage de l’IA - TP3

**Assistant utilisé** : assistant IA dans VS Code avec le Copilot SDK.

## Mission 5 - Suppression d’une piste

**Objectif** : permettre la suppression sécurisée d’une piste depuis sa card,
avec confirmation, état de chargement, notification et rafraîchissement.

**Prompt principal** : « Ajouter la suppression d’une piste côté frontend via
`TrackService`, avec confirmation, SnackBar, prévention des doubles clics,
rafraîchissement et gestion des réponses 404/401. »

**Plan proposé par l’agent** :

1. Ajouter `delete(id)` dans `TrackService`.
2. Ajouter le bouton « Supprimer » dans chaque card.
3. Demander une confirmation avant l’appel HTTP.
4. Utiliser un Signal `deletingId` pour bloquer les doubles clics.
5. Afficher les résultats avec `MatSnackBar`.
6. Recharger la page après suppression et revenir à la page précédente si elle
   devient vide.

**Vérifications réalisées par le binôme** : lecture du flux composant-service,
vérification de la requête `DELETE /api/tracks/:id`, vérification de la
confirmation et vérification du rafraîchissement après une réponse 204.

**Erreurs ou propositions rejetées** : le composant n’appelle pas directement
`HttpClient`. La sécurité n’a pas été confiée au seul guard ou à l’interface :
le backend reste responsable de vérifier le JWT et le propriétaire de la piste.

**Fichiers effectivement modifiés** :

- `frontend-starter/src/app/shared/services/track.service.ts`
- `frontend-starter/src/app/components/tracks-page/tracks-page.ts`
- `frontend-starter/src/app/components/tracks-page/tracks-page.html`
- `frontend-starter/src/app/components/tracks-page/tracks-page.spec.ts`

**Preuve de fonctionnement** : le test du composant vérifie l’appel DELETE, le
rechargement de la liste, la notification de succès et l’absence d’appel lorsque
la confirmation est annulée. Le cas 404 est affiché à l’utilisateur puis la
liste est rechargée.

**Ce que chaque membre sait maintenant expliquer sans l’agent** :

- pourquoi l’appel passe par `TrackService` ;
- pourquoi le frontend ne suffit pas à sécuriser une suppression ;
- comment empêcher deux suppressions simultanées ;
- pourquoi une réponse 404 peut signifier que la piste a été supprimée ailleurs.

## Mission 6 - Progression de l’upload

**Objectif** : afficher la progression réelle de l’upload et distinguer les
états inactif, en cours, réussi et échoué.

**Prompt principal** : « Faire évoluer l’upload pour utiliser les événements
HTTP Angular, calculer le pourcentage et afficher les états sans exposer de
mot de passe ou de JWT. »

**Plan proposé par l’agent** :

1. Configurer `reportProgress: true` et `observe: 'events'`.
2. Traiter `UploadProgress` et calculer
   `loaded / total * 100`.
3. Traiter l’événement final `Response`.
4. Désactiver le formulaire pendant l’envoi.
5. Afficher les erreurs et le succès.
6. Vider le formulaire puis recharger la première page après réussite.

**Vérifications réalisées par le binôme** : vérification du progress bar,
du bouton désactivé pendant l’envoi, du message de succès, de l’erreur serveur
et de la capture `upload-progress.png`.

**Erreurs ou propositions rejetées** : traiter l’upload comme une requête qui
ne renvoie qu’une réponse finale a été rejeté, car cela empêcherait d’afficher
l’avancement intermédiaire.

**Fichiers effectivement modifiés** :

- `frontend-starter/src/app/shared/services/track.service.ts`
- `frontend-starter/src/app/components/tracks-page/tracks-page.ts`
- `frontend-starter/src/app/components/tracks-page/tracks-page.html`

**Preuve de fonctionnement** : `screen/upload-progress.png` montre la
progression ; le code traite séparément `HttpEventType.UploadProgress` et
`HttpEventType.Response`.

**Ce que chaque membre sait maintenant expliquer sans l’agent** :

- pourquoi une requête avec progression émet plusieurs événements ;
- comment Angular calcule le pourcentage ;
- pourquoi les contrôles doivent être désactivés pendant l’envoi ;
- pourquoi aucune donnée sensible ne doit apparaître dans les messages ou la
  console.

## Mission 7 - Tests automatisés

**Objectif** : ajouter des tests frontend isolés, reproductibles et
indépendants de MongoDB.

**Prompt principal** : « Ajouter au moins trois tests frontend ciblés avec
`HttpTestingController` et vérifier URL, méthode, paramètres, headers et
résultats simulés. »

**Plan proposé par l’agent** :

1. Tester `TrackService.list()` avec `page` et `limit`.
2. Tester `TrackService.delete()` et l’upload multipart.
3. Tester l’intercepteur avec et sans token, ainsi que la réponse 401.
4. Tester l’erreur de chargement et la suppression dans le composant.
5. Utiliser des réponses HTTP simulées avec `HttpTestingController`.

**Vérifications réalisées par le binôme** : lecture des assertions dans les
tests de service, d’intercepteur et de composant. Les tests vérifient notamment
les méthodes HTTP, les URLs, les paramètres, le header `Authorization`, les
champs `FormData`, la notification et le rechargement.

**Erreurs ou propositions rejetées** : aucun test ne démarre le backend ou
MongoDB. Les tests d’intégration backend facultatifs n’ont pas été ajoutés,
car les tests frontend ciblés couvrent les missions obligatoires.

**Fichiers effectivement modifiés** :

- `frontend-starter/src/app/shared/services/track.service.spec.ts`
- `frontend-starter/src/app/shared/interceptors/auth.interceptor.spec.ts`
- `frontend-starter/src/app/components/tracks-page/tracks-page.spec.ts`

**Preuve de fonctionnement** : les suites contiennent des tests ciblés pour la
pagination, l’upload multipart, la suppression, la confirmation, l’erreur
HTTP, l’ajout du JWT et la gestion du 401. La commande prévue est :
`npm test -- --run`.

**Résultats d’exécution** : la commande n’a pas pu être exécutée dans
l’environnement utilisé pour la rédaction, car `npm` n’était pas disponible
dans le PATH Windows. Ce point doit être relancé dans le terminal Node.js du
binôme avant la remise, avec `npm test -- --run` puis `npm run build`.

**Ce que chaque membre sait maintenant expliquer sans l’agent** :

- pourquoi `HttpTestingController` évite d’avoir MongoDB en fonctionnement ;
- la différence entre un test unitaire et un test d’intégration ;
- ce que vérifie un test d’intercepteur ;
- pourquoi une assertion utile doit contrôler le résultat attendu et pas
  seulement l’absence d’erreur.

