# Rapport d'usage de l'IA - TP1

Pour chaque mission, détailler et fournir des explications concernant : objectif; prompt principal; plan proposé par l'agent; vérifications réalisées par le binôme; erreurs ou propositions rejetées; fichiers effectivement modifiés; preuve de fonctionnement; ce que chaque membre sait maintenant expliquer sans l'agent.


**Assistant utilisé** : Claude (claude.ai), modèle Claude Sonnet 4.5, dans l'interface chat.

---

## Préparation — Configuration MongoDB Atlas et setup du backend

**Objectif** : configurer un cluster MongoDB Atlas, connecter le backend à ce cluster, et démarrer l'API en local.

**Prompt principal** : « avant je veux configurer mon atlas [mongodb] », suivi de questions ponctuelles au fil des erreurs rencontrées (où trouver Network Access, comment vérifier `git status`, résolution d'erreurs de connexion).

**Plan proposé par l'agent** : suivre `ATLAS_SETUP.md` étape par étape (création du compte/projet/cluster, récupération des identifiants, autorisation réseau, récupération de l'URI, configuration de `.env`, test de connexion).

**Vérifications réalisées par le binôme** : test réel de `npm start`, lecture des messages d'erreur retournés par le terminal, vérification dans MongoDB Atlas (Browse Collections) que la base et les collections existaient bien.

**Erreurs rencontrées et corrigées avec l'aide de l'agent** :
- URI mal formée (`option guitar-practice-cloud is not supported`) : le nom de la base avait été placé après le `?` au lieu d'être placé comme chemin avant les paramètres de requête.
- `certificate is not yet valid` (`CERT_NOT_YET_VALID`) : diagnostiqué comme un problème d'horloge système Windows désynchronisée, corrigé en resynchronisant l'heure.
- Erreur `node: .env: not found` : le fichier `.env` n'avait pas encore été créé par copie de `.env.example`.

**Fichiers effectivement modifiés** : `backend/.env` (créé et complété avec `MONGODB_URI`, `JWT_SECRET`, `PORT`).

**Point de vigilance signalé par l'agent et suivi** : le mot de passe MongoDB a été collé en clair par erreur à deux reprises dans le chat ; l'agent a recommandé de le changer dans Atlas par précaution.

**Preuve de fonctionnement** : `GET http://localhost:3000/api/health` répond `{"status":"ok"}` ; Browse Collections dans Atlas confirme la présence de la base `guitar-practice-cloud` avec les collections `tracks` et `users`.

**Ce que chaque membre du binôme sait maintenant expliquer sans l'agent** :
- La structure d'une URI de connexion MongoDB (`mongodb+srv://user:password@host/database?options`).
- Pourquoi `.env` ne doit jamais être commité (vérification via `.gitignore` et `git status`).
- Le rôle de `Network Access` (IP whitelist) dans Atlas.

---

## Mission 0 — Cartographier l'application

**Objectif** : identifier la structure du frontend Angular (composant racine, routes, `HttpClient`, modèles, services, pages, mécanisme JWT) sans modifier le code, et produire un schéma annoté du flux de connexion.

**Prompt principal** : « Mission 0 », suivi de l'envoi progressif du contenu de plusieurs fichiers (`routes.ts`, `auth.service.ts`, `auth.interceptor.ts`, `main.ts`) obtenus via des commandes `cat` fournies par l'agent.

**Plan proposé par l'agent** :
1. Lister les fichiers `.ts` du projet (`find src/app -type f -name "*.ts" | grep -v spec`) pour repérer où se trouve chaque responsabilité.
2. Faire correspondre chaque fichier trouvé aux éléments demandés (composant racine, routes, services, modèles, interceptor).
3. Lire dans l'ordre `routes.ts` → `auth.service.ts` → `auth.interceptor.ts` → configuration de `HttpClient` (recherchée via `grep -rl "provideHttpClient" src` car absente d'un `app.config.ts` classique, trouvée dans `main.ts`).
4. Synthétiser un schéma annoté du flux "clic sur Se connecter" et une table récapitulative des fichiers.

**Vérifications réalisées par le binôme** : lecture réelle du contenu de chaque fichier via le terminal (`cat`), comparaison avec les explications fournies par l'agent, confirmation que le schéma proposé correspondait bien au code lu.

**Erreurs ou propositions rejetées** : aucune erreur — l'exploration s'est faite fichier par fichier sans modification de code, conformément à la consigne "sans modifier le code au début".

**Fichiers effectivement modifiés** : aucun (mission de lecture uniquement).

**Fichier livrable généré** : `MISSION0_CARTOGRAPHIE.md` (schéma annoté du flux de connexion, table des fichiers, distinction routes publiques/protégées).

**Preuve de fonctionnement** : sortie des commandes `find` et `cat` collée directement dans la conversation, confirmant le contenu réel des fichiers analysés.

**Ce que chaque membre du binôme sait maintenant expliquer sans l'agent** :
- Le trajet complet d'une requête de connexion : composant → `AuthService` → `HttpClient` → interceptor → backend Express → MongoDB → retour du JWT → mise à jour des Signals.
- La distinction entre routes publiques (`/login`, `/register`) et protégées (`/profile`, `/tracks` via `canActivate: [authGuard]`).
- Le rôle de l'interceptor (`authInterceptor`) dans l'ajout automatique du header `Authorization`.
- Pourquoi `HttpClient` est enregistré dans `main.ts` via `provideHttpClient` plutôt que dans un fichier `app.config.ts` séparé dans ce projet.

---

## Mission 1 — Inscription, Connexion et Profil

**Objectif** : compléter la partie utilisateur du frontend (formulaires réactifs, gestion du JWT, Signal `currentUser`, déconnexion, gestion du `401`).

**Prompt principal** : « avant tout est ce que je dois lancer l'app » puis lecture progressive de `login-page.ts`, `register-page.ts`, `profile-page.ts`, `app.ts`, `app.html`, `auth.guard.ts` pour établir un état des lieux, suivi de « 2 » (choix de la proposition « code corrigé à copier-coller avec explication »).

**Plan proposé par l'agent** :
1. Lire chaque composant existant (login, register, profil, app racine, guard) avant d'écrire du code, pour identifier ce qui était déjà fonctionnel dans le starter fourni par l'enseignant.
2. Dresser un bilan des manques identifiés : absence de bouton de déconnexion, absence de gestion globale du `401`, nav non conditionnelle.
3. Proposer deux modes de travail (coder soi-même vs. code fourni à comprendre) ; le binôme a choisi le second.
4. Fournir le code pour : `logout()` dans `AppComponent` + template conditionnel (`@if (auth.currentUser())`), interception du `401` dans `auth.interceptor.ts` via `catchError`, option de chargement automatique du profil (`ngOnInit`, non retenue explicitement).

**Vérifications réalisées par le binôme** : application des modifications dans le vrai projet, rechargement via `ng serve` (hot-reload), test visuel du changement de nav selon l'état de connexion (capture d'écran validée par le binôme).

**Erreurs rencontrées et diagnostiquées avec l'aide de l'agent** :
- Après inscription puis déconnexion, la reconnexion échouait (`401`, `{"message":"Identifiants incorrects"}`). Diagnostic fait en inspectant directement le document MongoDB de l'utilisateur créé : l'email enregistré était `safae@exemple` (faute de frappe, domaine incomplet et en français) alors que `safae@example.com` était saisi à la connexion. Confirmé comme erreur de saisie, pas un bug de code.

**Fichiers effectivement modifiés** :
- `src/app/components/app/app.ts` (injection de `AuthService`/`Router`, méthode `logout()`)
- `src/app/components/app/app.html` (nav conditionnelle selon `auth.currentUser()`)
- `src/app/shared/interceptors/auth.interceptor.ts` (gestion du `401` via `catchError`, `logout()` + redirection)

**Fichier livrable généré** : `MISSION1_AUTH_PROFIL.md` (état initial du starter, code ajouté avec explications, résumé du bug d'inscription/connexion, différence Signal vs `localStorage`, réponses aux questions sur les routes utilisées).

**Preuve de fonctionnement** : capture d'écran de la nav (bouton "Déconnexion" affiché uniquement si connecté) confirmée par le binôme ; puis 3 captures Network du Checkpoint (connexion réussie 200, connexion refusée 401, `PUT /api/users/me` 200 avec header `Authorization`) — voir `CHECKPOINT.md`.

**Ce que chaque membre du binôme sait maintenant expliquer sans l'agent** :
- Pourquoi un interceptor Angular peut agir à la fois sur la requête sortante (ajout du header) et sur la réponse (gestion des erreurs via `catchError`).
- La différence entre un Signal (état réactif en mémoire, perdu au rechargement) et `localStorage` (persistant, utilisé ici uniquement pour réhydrater le token au démarrage).
- Pourquoi une erreur "Identifiants incorrects" peut provenir d'une simple faute de frappe à l'inscription plutôt que d'un bug côté serveur, et comment le vérifier directement dans MongoDB Atlas (Browse Collections).
- Les 4 routes du backend utilisées par le frontend : `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/users/me`, `PUT /api/users/me`.