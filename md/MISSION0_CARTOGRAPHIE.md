# Mission 0 — Cartographie de l'application

TP1 — Architecture Authentification et Profil (Guitar Practice Cloud)

## 1. Éléments repérés

| Élément | Fichier |
|---|---|
| Composant racine | `src/app/components/app/app.ts` |
| Bootstrap + configuration globale (`HttpClient`, routes, interceptor) | `src/main.ts` |
| Configuration des routes | `src/app/routes.ts` |
| Service d'authentification | `src/app/shared/services/auth.service.ts` |
| Interceptor JWT | `src/app/shared/interceptors/auth.interceptor.ts` |
| Guard de protection des routes | `src/app/shared/guards/auth.guard.ts` |
| Modèles | `src/app/shared/models/*.model.ts` (`auth-response`, `page`, `track`, `user`) |
| Service pistes audio | `src/app/shared/services/track.service.ts` |
| Pages | `login-page`, `register-page`, `profile-page`, `tracks-page` (dans `src/app/components/`) |

## 2. Routes publiques vs protégées

D'après `routes.ts` :

- **Routes publiques** : `/login`, `/register`
- **Routes protégées** (via `canActivate: [authGuard]`) : `/profile`, `/tracks`
- `''` et `**` redirigent vers `/tracks` (qui redirige elle-même vers `/login` si non connecté)

## 3. Schéma annoté — flux "clic sur Se connecter"

```
1. L'utilisateur clique "Se connecter" dans login-page.ts
        ↓
2. Le composant appelle AuthService.login(email, password)
   (auth.service.ts)
        ↓
3. AuthService exécute : http.post('/api/auth/login', { email, password })
   → passe par HttpClient (injecté via inject())
        ↓
4. authInterceptor intercepte la requête sortante
   (auth.interceptor.ts) — pas encore de token à ce stade,
   donc la requête part sans header Authorization
        ↓
5. Requête envoyée via proxy.conf.json → backend Express
   POST http://localhost:3000/api/auth/login
        ↓
6. Le backend Express vérifie l'email et le mot de passe
   contre la base MongoDB (Atlas)
        ↓
7. Le backend renvoie { token, user } (AuthResponse)
        ↓
8. AuthService.storeAuthentication() :
   - localStorage.setItem('gpc_token', token)
   - Signal token.set(token)
   - Signal currentUser.set(user)
        ↓
9. Toute future requête protégée (ex : /tracks, /profile) passera
   par authInterceptor, qui ajoutera automatiquement
   Authorization: Bearer <token>
```

## 4. Mécanisme d'ajout du JWT aux requêtes protégées

Fichier : `auth.interceptor.ts`

- Fonction interceptor (`HttpInterceptorFn`, syntaxe Angular moderne)
- Lit le token depuis le Signal `AuthService.token()`
- Si un token existe → clone la requête en ajoutant l'en-tête `Authorization: Bearer <token>`
- Sinon → laisse passer la requête sans modification

Enregistré dans `main.ts` via :
```ts
provideHttpClient(withInterceptors([authInterceptor]))
```

## 5. Enregistrement de HttpClient et des routes

Fichier : `main.ts` (pas de `app.config.ts` séparé dans ce projet — tout est centralisé au bootstrap)

```ts
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
}).catch(console.error);
```

## 6. Notes

- Les composants ne font jamais d'appel `HttpClient` directement : ils passent systématiquement par `AuthService` ou `TrackService`.
- Deux Signals centraux dans `AuthService` : `currentUser` (données du profil) et `token` (JWT, initialisé depuis `localStorage` au démarrage).
