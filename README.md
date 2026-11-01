# Guitar Practice Cloud

Application web de gestion de morceaux audio réalisée dans le cadre des
travaux pratiques Angular du master MIAGE.

Le projet associe un frontend Angular à une API REST Node.js/Express. Il
permet de créer un compte, de se connecter, de gérer son profil et de
stocker, consulter, écouter et supprimer ses propres pistes audio.

## Binôme

- **EL GUZOULI Malak**
- **AIT AHMED Safae**

## Fonctionnalités

### Authentification et profil

- inscription et connexion avec JWT ;
- protection des routes Angular ;
- ajout automatique du header `Authorization` ;
- consultation et modification du profil ;
- déconnexion et gestion des réponses `401`.

### Bibliothèque audio

- pagination côté serveur ;
- upload multipart avec titre et fichier audio ;
- validation frontend des formats et de la taille ;
- suivi de la progression de l’upload ;
- affichage des pistes sous forme de cards ;
- lecture audio authentifiée ;
- suppression avec confirmation et notification ;
- gestion des erreurs et des états de chargement.

### Tests

Le frontend contient des tests ciblés pour :

- les services HTTP ;
- la pagination et l’upload multipart ;
- l’intercepteur JWT ;
- le guard d’authentification ;
- les erreurs et la suppression d’une piste.

## Technologies

| Partie | Technologies |
|---|---|
| Frontend | Angular, TypeScript, Angular Material, RxJS |
| Backend | Node.js, Express |
| Base de données | MongoDB Atlas avec Mongoose |
| Authentification | JSON Web Token, bcryptjs |
| Fichiers audio | Multer et stockage sur disque |
| Tests | Vitest, Angular HTTP testing, Node.js Test Runner |

## Prérequis

- Node.js 22 ou une version plus récente ;
- npm ;
- MongoDB Atlas ;
- un navigateur récent ;
- Git.

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/elguzoulimalak/AngularM1_Miage_2026_2027_TP123.git
cd AngularM1_Miage_2026_2027_TP123
```

### 2. Configurer le backend

```bash
cd backend
cp .env.example .env
npm install
```

Modifier ensuite `backend/.env` avec les valeurs locales :

```env
MONGODB_URI=******votre-cluster.mongodb.net/guitar-practice-cloud
JWT_SECRET=votre-secret-local
PORT=3000
```

Le fichier `.env` est local et ne doit jamais être publié sur GitHub.

### 3. Installer le frontend

Dans un autre terminal :

```bash
cd frontend-starter
npm install
```

## Lancement

### Backend

Depuis le dossier `backend/` :

```bash
npm start
```

L’API est disponible sur `http://localhost:3000`.

### Frontend

Depuis le dossier `frontend-starter/` :

```bash
npm start
```

L’application est disponible sur `http://localhost:4200`.
Le proxy Angular redirige les appels `/api` vers le backend local.

## Tests et build

### Tests backend

```bash
cd backend
npm test
```

### Tests frontend

```bash
cd frontend-starter
npm test
```

### Build frontend

```bash
cd frontend-starter
npm run build
```

## Contrat API principal

Toutes les routes sont préfixées par `/api`.

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/health` | Vérification de l’état de l’API |
| `POST` | `/auth/register` | Création d’un compte |
| `POST` | `/auth/login` | Connexion et obtention du JWT |
| `GET` | `/users/me` | Récupération du profil connecté |
| `PUT` | `/users/me` | Modification du profil |
| `GET` | `/tracks?page=1&limit=5` | Liste paginée des pistes |
| `POST` | `/tracks` | Upload d’une piste audio |
| `GET` | `/tracks/:id/audio` | Lecture audio authentifiée |
| `DELETE` | `/tracks/:id` | Suppression d’une piste |

Les formats audio acceptés sont MP3, WAV, OGG et M4A, avec une taille
maximale de 25 Mo.

La documentation complète est disponible dans
[`API_CONTRACT.md`](API_CONTRACT.md).

## Structure du projet

```text
.
├── backend/              # API Express, modèles Mongoose et tests backend
├── frontend-starter/     # Application Angular et tests frontend
├── md/                   # Analyses et preuves du TP1
├── screen/               # Captures d’écran du projet
├── API_CONTRACT.md       # Contrat HTTP
├── SUJET_ETUDIANT_TP1.md
├── SUJET_ETUDIANT_TP2.md
├── SUJET_ETUDIANT_TP3.md
├── RAPPORT_IA_TP2.md
└── RAPPORT_IA_TP3.md
```

## Documents du projet

- [`SUJET_ETUDIANT_TP1.md`](SUJET_ETUDIANT_TP1.md) — sujet du TP1 ;
- [`SUJET_ETUDIANT_TP2.md`](SUJET_ETUDIANT_TP2.md) — pagination, upload et
  lecture audio ;
- [`SUJET_ETUDIANT_TP3.md`](SUJET_ETUDIANT_TP3.md) — suppression, progression
  et tests ;
- [`API_CONTRACT.md`](API_CONTRACT.md) — endpoints et formats échangés ;
- [`RAPPORT_IA_TP2.md`](RAPPORT_IA_TP2.md) — rapport d’usage de l’IA du TP2 ;
- [`RAPPORT_IA_TP3.md`](RAPPORT_IA_TP3.md) — rapport d’usage de l’IA du TP3 ;
- [`ATLAS_SETUP.md`](ATLAS_SETUP.md) — configuration MongoDB Atlas ;
- [`CONSEILS_POUR_UTIISER_ASSISTANT_AI.md`](CONSEILS_POUR_UTIISER_ASSISTANT_AI.md)
  — recommandations pour l’utilisation d’un assistant IA.

## Sécurité

- les mots de passe sont hachés côté backend ;
- les routes protégées vérifient le JWT ;
- l’accès aux pistes est limité à leur propriétaire ;
- aucun secret ne doit être ajouté au code ou au dépôt ;
- les fichiers audio sont stockés sur le serveur et leurs métadonnées dans
  MongoDB.
