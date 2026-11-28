# TP4 — Conception du mini-projet

Ce document correspond à la phase de discussion demandée par le sujet du TP4,
avant l'implémentation : fonctionnalités, interfaces, choix techniques et
découpage du travail.

## 0. Orientation choisie

**Guitar Practice Cloud devient une appli musicale de partage de backing tracks.**
Le prototype (TP1 à TP3) gère déjà les utilisateurs et l'upload, l'écoute et
la suppression de fichiers audio. On garde ce thème musical et on ajoute le
partage entre musiciens : pistes publiques, recherche, amis et partage privé.

## 1. Fonctionnalités souhaitées

| # | Fonctionnalité | Priorité |
|---|---|---|
| F1 | Chaque piste est **privée** (par défaut) ou **publique** ; le propriétaire peut changer ce choix à tout moment | Indispensable |
| F2 | **Rechercher** une piste par titre, dans ses propres pistes et dans les pistes publiques | Indispensable |
| F3 | Écouter une piste publique d'un autre utilisateur | Indispensable |
| F4 | Voir les **pistes publiques récemment ajoutées** | Indispensable |
| F5 | **Amis** : inviter un utilisateur, accepter ou refuser une invitation, retirer un ami | Indispensable |
| F6 | **Partager** une piste privée avec un ou plusieurs amis, et **arrêter un partage** | Indispensable |
| F7 | Voir **l'activité de ses amis** (nouvelles pistes publiques ou partagées avec moi) | Souhaitable |
| F8 | Recherche avancée : par format, par propriétaire, tri | Bonus |

## 2. Interfaces proposées

- **Backing tracks** (`/tracks`, existante) : on ajoute un choix « Privée / Publique » dans le formulaire d'import, un badge de visibilité et un bouton « Rendre publique / privée » sur chaque carte, et une barre de recherche au-dessus de « Mes pistes ».
- **Découvrir** (`/discover`, nouvelle) : barre de recherche, puis liste des pistes publiques de tout le monde. Sans recherche, la liste s'intitule « Récemment ajoutées » (les plus récentes d'abord). Chaque ligne affiche le titre, le propriétaire, la date et un bouton de lecture.
- **Amis** (`/friends`, étape 3) : champ « Inviter par email », invitations reçues (Accepter / Refuser), invitations envoyées, liste des amis avec « Retirer ».
- **Partage** (étape 4) : sur une piste privée, un bouton « Partager » ouvre une boîte de dialogue avec la liste des amis à cocher ; les partages existants peuvent être retirés. Un onglet « Partagées avec moi » s'ajoute dans Découvrir.
- **Activité** (étape 5) : un fil simple sur Découvrir : « Alice a publié *Blues en A* ».

Alternatives envisagées : un seul écran avec onglets « Mes pistes / Publiques / Partagées » (plus compact, mais page déjà chargée) ; une recherche instantanée à chaque frappe (plus fluide, mais une requête par caractère). On garde des pages séparées et une recherche validée par Entrée ou par le bouton, plus simple à tester et à observer dans l'onglet Network.

## 3. Choix techniques

- **Visibilité** : un champ `visibility` (`"private"` | `"public"`, défaut `"private"`) sur `Track`, avec un `enum` Mongoose. Une piste sans ce champ (créée avant le TP4) est traitée comme privée : aucune migration n'est nécessaire.
- **Recherche** : une regex insensible à la casse sur `title`, avec les caractères spéciaux **échappés** (sinon `a.*` ou `(` deviendraient une regex) et une longueur maximale de 100 caractères. Un index texte MongoDB (`$text`) serait plus performant sur de gros volumes, mais il ne trouve pas les débuts de mots (« blu » ne trouve pas « blues »). La regex suffit pour ce projet.
- **Contrôle d'accès** : il est fait **dans la requête MongoDB elle-même** (`{ _id, $or: [{ ownerId: moi }, { visibility: "public" }] }`). Une piste privée d'un autre utilisateur renvoie `404`, pas `403`, pour ne pas révéler son existence. L'étape 4 ajoutera simplement `{ sharedWith: moi }` dans ce `$or`.
- **Routes** : `GET /api/tracks/public` (liste publique paginée, avec `ownerName` grâce à `populate`) et `PATCH /api/tracks/:id` (changer la visibilité) ; `q` est ajouté à `GET /api/tracks`. Tout est documenté dans `API_CONTRACT.md`.
- **Amis (étape 3)** : une collection `Friendship { requester, recipient, status: pending|accepted }`, avec un index unique sur la paire. Une collection séparée évite de dupliquer la relation dans les deux documents `User`.
- **Partage (étape 4)** : un tableau `sharedWith: [ObjectId]` sur `Track`. Arrêter un partage revient à faire `$pull` ; retirer un ami retire aussi ses partages.
- **Tests** : les fonctions de filtrage et de validation sont extraites dans `backend/src/tracks/query.js` et testées sans base de données. Les routes sont testées en HTTP avec des doublures (`mock.method`) des méthodes Mongoose, ce qui permet de lancer `npm test` sans MongoDB Atlas. Côté Angular, on utilise Vitest avec `HttpTestingController`.

## 4. Découpage du travail

1. **Étape 1 : visibilité public/privé et recherche** (F1 à F4), traitée dans cette PR.
2. **Étape 2 : amis.** Modèle `Friendship`, routes d'invitation, d'acceptation et de suppression, page `/friends`.
3. **Étape 3 : partage privé.** `sharedWith`, routes de partage et de retrait, dialogue « Partager », onglet « Partagées avec moi ».
4. **Étape 4 : activité des amis.** Fil d'activité calculé à partir des pistes récentes des amis.
5. **Étape 5 : finitions.** Recherche avancée (F8), compléments au `REPORT.md`, captures Network.

Chaque étape fait l'objet d'une branche, de tests unitaires et d'une mise à jour de `REPORT.md`.
