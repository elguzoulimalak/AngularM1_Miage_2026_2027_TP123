# Mission 1 — Inscription, Connexion et Profil

TP1 — Architecture Authentification et Profil (Guitar Practice Cloud)

## 1. État initial du projet (avant modifications)

Le starter fourni par l'enseignant contenait déjà une implémentation quasi complète :

| Fonctionnalité | État initial |
|---|---|
| `AuthService` (login, register, profile, update, logout, storage JWT) | ✅ Déjà complet |
| `login-page.ts` (formulaire réactif, validations, gestion d'erreur, redirection) | ✅ Déjà complet |
| `register-page.ts` (formulaire réactif, validations, gestion d'erreur, redirection) | ✅ Déjà complet |
| `profile-page.ts` (chargement + modification du nom) | ✅ Déjà complet (chargement manuel via bouton) |
| `auth.interceptor.ts` (ajout du JWT aux requêtes) | ✅ Déjà complet |
| `auth.guard.ts` (protection des routes) | ✅ Déjà complet |
| Bouton de déconnexion | ❌ Absent |
| Gestion du `401` (retour auto vers `/login`) | ❌ Absent |
| Nav conditionnelle selon l'état de connexion | ❌ Absent |

## 2. Modifications apportées

### a. Bouton de déconnexion (`app.ts` + `app.html`)

`AppComponent` injecte désormais `AuthService` et `Router`, avec une méthode `logout()` qui appelle `AuthService.logout()` (nettoyage du token et du Signal `currentUser`) puis redirige vers `/login`.

Le template (`app.html`) affiche conditionnellement la navigation selon `auth.currentUser()` :
- **Connecté** : liens "Backing tracks", "Profil", bouton "Déconnexion"
- **Non connecté** : liens "Connexion", "Inscription"

```html
<nav aria-label="Navigation principale">
  @if (auth.currentUser()) {
    <a routerLink="/tracks">Backing tracks</a>
    <a routerLink="/profile">Profil</a>
    <button type="button" (click)="logout()">Déconnexion</button>
  } @else {
    <a routerLink="/login">Connexion</a>
    <a routerLink="/register">Inscription</a>
  }
</nav>
```

### b. Gestion globale du 401 (`auth.interceptor.ts`)

L'interceptor gère désormais la requête **et** la réponse : en cas d'erreur `401` (token invalide ou expiré), il appelle `AuthService.logout()` et redirige automatiquement vers `/login`, où que l'utilisateur se trouve dans l'application.

```ts
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();

  const authorizedRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.logout();
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
```

## 3. Test du flux complet

- Inscription d'un nouveau compte → succès (`POST /api/auth/register`, redirection vers `/profile`)
- Déconnexion → nav repasse en mode "non connecté", `localStorage` nettoyé
- Tentative de connexion avec le nouveau compte → échec initial (`401`, `{"message":"Identifiants incorrects"}`)
  - **Cause identifiée** : erreur de saisie lors de l'inscription — email enregistré `safae@exemple` (sans `.com`) au lieu de `safae@example.com` tapé ensuite au login. Après correction de la saisie, connexion réussie.
- Modification du nom via `/profile` → `PUT /api/users/me` → Signal `currentUser` mis à jour

## 4. Différence Signal vs localStorage

- **Signal** (`currentUser`, `token`) : état réactif **en mémoire**, propre à la session du navigateur en cours. Angular re-render automatiquement les composants qui lisent le Signal dès qu'il change. Perdu au rechargement complet de la page (sauf réinitialisation explicite).
- **`localStorage`** : stockage **persistant** côté navigateur, survit au rechargement de page et à la fermeture de l'onglet. Utilisé ici uniquement pour conserver le JWT (`gpc_token`) entre deux sessions, afin de réhydrater le Signal `token` au démarrage de l'app (`signal<string | null>(localStorage.getItem('gpc_token'))`).

En résumé : le Signal pilote l'affichage réactif pendant que l'app tourne ; `localStorage` permet de ne pas perdre la connexion après un rafraîchissement de page.

## 5. Routes du backend utilisées

- `POST /api/auth/register` — inscription
- `POST /api/auth/login` — connexion
- `GET /api/users/me` — lecture du profil (route protégée, nécessite le JWT)
- `PUT /api/users/me` — modification du nom (route protégée, nécessite le JWT)

## 6. Où s'effectue la mise à jour du profil utilisateur ?

| Côté | Fichier(s) |
|---|---|
| **Frontend** | `profile-page.ts` (méthode `save()`) → `auth.service.ts` (méthode `update()`, appelle `PUT /api/users/me`) |
| **Backend** | route `PUT /api/users/me` définie côté Express (voir `API_CONTRACT.md` pour le détail des fichiers serveur exacts) |
