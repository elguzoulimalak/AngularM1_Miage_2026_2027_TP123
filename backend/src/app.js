import express from "express";
import cors from "cors";
import multer from "multer";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { User } from "./models/User.js";
import { Track } from "./models/Track.js";
import { Friendship } from "./models/Friendship.js";
import { registerFriendRoutes } from "./friends/routes.js";
import { friendshipBetweenFilter } from "./friends/logic.js";
import { recordActivity } from "./activity/record.js";
import { registerActivityRoutes } from "./activity/routes.js";
import {
  myTracksFilter,
  ownerNameFilter,
  parsePagination,
  parseTrackQuery,
  sortOptions,
  parseVisibility,
  publicTracksFilter,
  readableTrackFilter,
  sharedWithMeFilter,
} from "./tracks/query.js";

// Les fichiers audio restent sur le disque du serveur dans ce TP.
// MongoDB ne conserve que leurs métadonnées : titre, nom, taille, etc.
const UPLOADS = path.resolve("data/uploads");

try {
  // mkdirSync est utilisé au démarrage : l'application doit disposer de ce
  // dossier avant de pouvoir accepter le premier upload.
  fs.mkdirSync(UPLOADS, { recursive: true });
  console.log(`[startup] Dossier des uploads prêt : ${UPLOADS}`);
} catch (error) {
  console.error("[startup] Impossible de créer le dossier des uploads", error);
  throw error;
}

// Ce secret reste côté serveur. Il ne doit jamais être copié dans Angular.
const SECRET = process.env.JWT_SECRET || "tp1-development-secret";

// La taille maximale d'un fichier audio est de 25 Mo. Les fichiers plus gros
// sont refusés par Multer avant d'être écrits sur le disque.
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Les types MIME autorisés correspondent aux formats demandés dans le sujet.
const allowed = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
]);

/**
 * Crée un jeton JWT contenant uniquement l'identité nécessaire à l'API.
 * Le mot de passe n'est jamais placé dans le token. `sub` signifie subject
 * et contient l'identifiant MongoDB de l'utilisateur.
 */
function token(user) {
  console.log(`[auth] Création d'un token pour l'utilisateur ${user.id}`);
  return jwt.sign({ sub: user.id, email: user.email }, SECRET, {
    expiresIn: "2h",
  });
}

/** Middleware Express qui protège les routes privées. */
function auth(req, res, next) {
  const raw = req.headers.authorization;

  // Le token est transmis dans l'en-tête Authorization sous la forme
    // "Authorization: Bearer <token>". Le préfixe "Bearer " est obligatoire pour que
    // le middleware sache qu'il s'agit d'un JWT et non d'un autre type de jeton.
  if (!raw?.startsWith("Bearer ")) {
    console.warn(`[auth] Authorization absente pour ${req.method} ${req.path}`);
    return res.status(401).json({ message: "Authentification requise" });
  }

  try {
    // jwt.verify vérifie la signature et la date d'expiration du token.
    // On ne logue jamais sa valeur, car un JWT permettrait une usurpation.
    req.auth = jwt.verify(raw.slice(7), SECRET);
    console.log(`[auth] Token accepté pour ${req.auth.sub}`);
    next();
  } catch (error) {
    console.error("[auth] Token invalide ou expiré", error);
    return res.status(401).json({ message: "Jeton invalide ou expiré" });
  }
}

/*
 * Multer transforme une requête HTTP multipart/form-data en données exploitables
 * par Express et traite les fichiers envoyés par un formulaire HTML.
 * Documentation officielle : https://github.com/expressjs/multer
 *
 * diskStorage indique que Multer écrit directement le fichier sur disque.
 * Chaque callback doit appeler cb(error, value) : null signifie qu'il n'y a
 * pas d'erreur. Le nom aléatoire évite les collisions entre utilisateurs.
 */
const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    console.debug(`[multer] Destination sélectionnée : ${UPLOADS}`);
    callback(null, UPLOADS);
  },
  filename: (_request, file, callback) => {
    const filename =
      crypto.randomUUID() + path.extname(file.originalname).toLowerCase();
    console.log(`[multer] Nom de stockage généré pour ${file.originalname}`);
    callback(null, filename);
  },
});

/*
 * limits.fileSize protège le serveur contre les fichiers trop volumineux.
 * fileFilter est appelé avant l'enregistrement : accepter le fichier appelle
 * callback(null, true), le refuser transmet une vraie Error à Express.
 */
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_request, file, callback) => {
    // Seuls les types MIME audio demandés dans le sujet sont acceptés.
    if (allowed.has(file.mimetype)) {
      console.log(`[multer] Type accepté : ${file.mimetype}`);
      return callback(null, true);
    }

    const error = new Error("Format audio non accepté");
    console.error(`[multer] Type refusé : ${file.mimetype}`, error);
    return callback(error);
  },
});

/** Supprime un fichier reçu par Multer quand l'upload est finalement refusé. */
async function removeUploadedFile(file) {
  const uploadedPath = path.join(UPLOADS, file.filename);
  try {
    await fsPromises.unlink(uploadedPath);
    console.log(`[tracks] Fichier temporaire supprimé : ${uploadedPath}`);
  } catch (cleanupError) {
    console.error(
      `[tracks] Impossible de supprimer le fichier temporaire ${uploadedPath}`,
      cleanupError,
    );
  }
}

/**
 * Construit l'application Express sans ouvrir de port.
 * Cette séparation permet au serveur réel et aux tests de créer la même
 * application. Le port est ouvert uniquement dans server.js.
 */
export function createApp() {
  const app = express();

  // Journaliser la fin de chaque requête permet de suivre méthode, URL,
  // statut et durée sans exposer les corps contenant des mots de passe.
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      console.log(
        `[http] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt} ms)`,
      );
    });
    next();
  });

  // CORS est nécessaire pour que le frontend Angular puisse appeler l'API.
  // C'est-à-dire que le navigateur autorise les requêtes cross-origin depuis localhost:4200.
  // Dans un vrai projet, il est recommandé de limiter les origines autorisées.
  app.use(cors());

  // Express ne gère pas nativement le JSON : ce middleware transforme le corps JSON en objet JavaScript 
  // accessible via req.body.
  // Il est placé avant les routes pour que toutes les requêtes JSON soient traitées.
  app.use(express.json());

  /** Endpoint public utilisé pour vérifier que l'API répond. */
  app.get("/api/health", (_req, res) => {
    console.log("[health] Vérification de l'API");
    res.json({ status: "ok" });
  });

  /** Requête POST pour "insertion" de donnée.
   * Inscrit un utilisateur et renvoie un token avec ses données publiques. 
   * @param {Object} req - La requête HTTP.
   * @param {Object} res - La réponse HTTP.
   * @param {Function} next - La fonction de middleware suivante.
   */
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { name, email, password } = req.body || {};
      console.log(`[auth] Tentative d'inscription pour ${email || "email absent"}`);

      if (!name || !email || !password || password.length < 8) {
        console.warn("[auth] Inscription refusée : données invalides ou incomplètes");
        return res.status(400).json({
          message: "Nom, email et mot de passe de 8 caractères requis",
        });
      }

      // Vérifie si l'email est déjà utilisé avant de créer un nouvel utilisateur.
      if (await User.exists({ email: String(email).toLowerCase() })) {
        console.warn(`[auth] Email déjà utilisé : ${email}`);
        return res.status(409).json({ message: "Email déjà utilisé" });
      }

      // Crée l'utilisateur et le stocke dans MongoDB. Le mot de passe est haché
      // par le hook pre('validate') défini dans le schéma Mongoose.
      const user = await User.create({ name, email, password });
      console.log(`[auth] Utilisateur créé : ${user.id}`);
      res.status(201).json({ token: token(user), user: user.toPublic() });
    } catch (error) {
      console.error("[auth] Erreur pendant l'inscription", error);
      next(error);
    }
  });

  /** Vérifie les identifiants et ouvre une session JWT. Les identifiants sont envoyés dans le corps de la 
   * requête par un HTTP POST. */
  app.post("/api/auth/login", async (req, res, next) => {
    try {
        // req.body est déjà un objet JavaScript grâce au middleware express.json() placé plus haut.
        // il contient les champs email et password envoyés par le frontend Angular.
      const email = String(req.body?.email || "").toLowerCase();
      console.log(`[auth] Tentative de connexion pour ${email || "email absent"}`);

      // Sélectionne le mot de passe haché pour vérifier les identifiants.
      // User est un modèle Mongoose qui correspond au schéma défini dans models/User.js.
      // on envoie les requête à MongoDB via cet objet. Le mot de passe haché est stocké dans 
      // passwordHash, mais il n'est pas renvoyé par défaut dans les requêtes pour 
      // des raisons de sécurité.
      const user = await User.findOne({ email }).select("+passwordHash");

      if (!user || !(await user.verifyPassword(req.body?.password || ""))) {
        console.warn(`[auth] Identifiants incorrects pour ${email}`);
        return res.status(401).json({ message: "Identifiants incorrects" });
      }

      console.log(`[auth] Connexion réussie : ${user.id}`);
      res.json({ token: token(user), user: user.toPublic() });
    } catch (error) {
      console.error("[auth] Erreur pendant la connexion", error);
      next(error);
    }
  });

  /** Retourne le profil public de l'utilisateur identifié par le JWT. 
   * Les paramètres sont :
   * @param auth - Le middleware qui vérifie le JWT et ajoute req.auth. 
   * @param {Object} req - La requête HTTP.
   * @param {Object} res - La réponse HTTP.
   * @param {Function} next - La fonction de middleware suivante.
  */
  app.get("/api/users/me", auth, async (req, res, next) => {
    try {
        // req.auth.sub contient l'identifiant MongoDB de l'utilisateur 
        // extrait du JWT par le middleware auth. ici req.auth est un objet ajouté par le middleware 
        // auth à la requête, et sub est la propriété qui contient l'identifiant de l'utilisateur.
      const user = await User.findById(req.auth.sub);
      if (!user) {
        console.warn(`[user] Profil introuvable : ${req.auth.sub}`);
        return res.status(404).json({ message: "Utilisateur inconnu" });
      }

      console.log(`[user] Profil envoyé : ${user.id}`);
      res.json(user.toPublic());
    } catch (error) {
      console.error("[user] Erreur de lecture du profil", error);
      next(error);
    }
  });

  /** Modifie uniquement le nom de l'utilisateur connecté. */
  app.put("/api/users/me", auth, async (req, res, next) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.auth.sub,
        { $set: { name: req.body?.name } },
        { new: true, runValidators: true },
      );

      if (!user) {
        console.warn(`[user] Mise à jour impossible : ${req.auth.sub}`);
        return res.status(404).json({ message: "Utilisateur inconnu" });
      }

      console.log(`[user] Nom mis à jour : ${user.id}`);
      res.json(user.toPublic());
    } catch (error) {
      console.error("[user] Erreur de mise à jour du profil", error);
      next(error);
    }
  });

  /**
   * Applique le tri et, pour le tri par titre, la collation française.
   * `collation` n'est appelée que si nécessaire (voir sortOptions).
   */
  function sorted(query, sort) {
    const options = sortOptions(sort);
    const result = query.sort(options.sort);
    return options.collation ? result.collation(options.collation) : result;
  }

  /**
   * Retourne une page des pistes appartenant exclusivement à l'utilisateur.
   * TP4 : paramètres optionnels `q` (titre), `format` (mp3, wav, ogg, m4a)
   * et `sort` (recent, oldest, title, size).
   */
  app.get("/api/tracks", auth, async (req, res, next) => {
    try {
      const { page, limit } = parsePagination(req.query);
      const parsed = parseTrackQuery(req.query);
      if (parsed.error) {
        console.warn(`[tracks] Recherche refusée : ${parsed.error}`);
        return res.status(400).json({ message: parsed.error });
      }
      const { search, format, sort } = parsed;

      const filter = myTracksFilter(req.auth.sub, search, format);
      console.log(
        `[tracks] Lecture page=${page}, limit=${limit}, q="${search}", format="${format}", sort=${sort}, user=${req.auth.sub}`,
      );

      // La lecture des pistes et le comptage total sont parallélisés pour réduire la latence.
      const [items, total] = await Promise.all([
        sorted(Track.find(filter), sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .select("-storedName")
          .lean(),
        Track.countDocuments(filter),
      ]);

      // _id devient id ; les pistes créées avant le TP4 n'ont pas de champ
      // visibility et sont donc considérées comme privées.
      const publicItems = items.map((track) => ({
        ...track,
        id: String(track._id),
        _id: undefined,
        __v: undefined,
        ownerId: String(track.ownerId),
        visibility: track.visibility ?? "private",
        sharedWith: (track.sharedWith ?? []).map(String),
      }));

      console.log(`[tracks] ${publicItems.length} piste(s) envoyée(s) sur ${total}`);
      res.json({
        items: publicItems,
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (error) {
      console.error("[tracks] Erreur de pagination", error);
      next(error);
    }
  });

  /**
   * Fabrique un handler qui liste les pistes d'autres utilisateurs (publiques
   * ou partagées avec moi), avec le nom de leur propriétaire.
   * Paramètres optionnels : `q` (titre), `format`, `sort` et `owner`
   * (partie du nom du propriétaire).
   * La liste `sharedWith` n'est jamais renvoyée : elle ne regarde que le propriétaire.
   */
  function othersTracksHandler(label, buildFilter) {
    return async (req, res, next) => {
      try {
        const { page, limit } = parsePagination(req.query);
        const parsed = parseTrackQuery(req.query);
        if (parsed.error) {
          console.warn(`[tracks] Recherche ${label} refusée : ${parsed.error}`);
          return res.status(400).json({ message: parsed.error });
        }
        const { search, format, sort, owner } = parsed;

        let filter = buildFilter(req, search, format);
        if (owner) {
          // Recherche par propriétaire : on cherche d'abord les utilisateurs
          // dont le nom correspond, puis leurs pistes.
          const owners = await User.find(ownerNameFilter(owner)).select("_id").limit(100).lean();
          if (owners.length === 0) {
            console.log(`[tracks] Aucun propriétaire ne correspond à "${owner}"`);
            return res.json({ items: [], page, limit, total: 0, pages: 1 });
          }
          filter = { ...filter, ownerId: { $in: owners.map((u) => u._id) } };
        }
        console.log(
          `[tracks] Lecture ${label} page=${page}, limit=${limit}, q="${search}", format="${format}", sort=${sort}, owner="${owner}"`,
        );

        const [items, total] = await Promise.all([
          sorted(Track.find(filter), sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .select("-storedName")
            // populate remplace ownerId par le document User, limité à son nom.
            .populate("ownerId", "name")
            .lean(),
          Track.countDocuments(filter),
        ]);

        const publicItems = items.map((track) => ({
          id: String(track._id),
          ownerId: String(track.ownerId?._id ?? track.ownerId),
          ownerName: track.ownerId?.name ?? "Utilisateur inconnu",
          title: track.title,
          originalName: track.originalName,
          mimeType: track.mimeType,
          size: track.size,
          visibility: track.visibility ?? "private",
          createdAt: track.createdAt,
        }));

        console.log(`[tracks] ${publicItems.length} piste(s) ${label} envoyée(s) sur ${total}`);
        res.json({
          items: publicItems,
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        });
      } catch (error) {
        console.error(`[tracks] Erreur de lecture des pistes (${label})`, error);
        next(error);
      }
    };
  }

  /** TP4 : pistes publiques de tous les utilisateurs. */
  app.get(
    "/api/tracks/public",
    auth,
    othersTracksHandler("publique(s)", (_req, search, format) => publicTracksFilter(search, format)),
  );

  /** TP4 étape 2 : pistes que des amis ont partagées avec moi. */
  app.get(
    "/api/tracks/shared",
    auth,
    othersTracksHandler("partagée(s) avec moi", (req, search, format) => sharedWithMeFilter(req.auth.sub, search, format)),
  );

  /**
   * TP4 étape 2 : partage une piste avec un ami. Seul le propriétaire peut
   * partager, et seulement avec un ami accepté. $addToSet évite les doublons.
   */
  app.put("/api/tracks/:id/shares/:userId", auth, async (req, res, next) => {
    try {
      const { id, userId } = req.params;
      if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
        return res.status(404).json({ message: "Piste ou ami inconnu" });
      }

      const friendship = await Friendship.findOne({
        ...friendshipBetweenFilter(req.auth.sub, userId),
        status: "accepted",
      });
      if (!friendship) {
        console.warn(`[shares] Partage refusé : ${userId} n'est pas ami avec ${req.auth.sub}`);
        return res.status(403).json({ message: "Vous ne pouvez partager qu'avec vos amis" });
      }

      const track = await Track.findOneAndUpdate(
        { _id: id, ownerId: req.auth.sub },
        { $addToSet: { sharedWith: userId } },
        { new: true },
      );
      if (!track) {
        console.warn(`[shares] Piste inconnue ou interdite : ${id}`);
        return res.status(404).json({ message: "Piste inconnue" });
      }

      console.log(`[shares] Piste ${track.id} partagée avec ${userId}`);
      await recordActivity({ actor: req.auth.sub, type: "track_shared", track: track.id, target: userId });
      res.json(track.toPublic());
    } catch (error) {
      console.error("[shares] Erreur de partage", error);
      next(error);
    }
  });

  /** TP4 étape 2 : arrête le partage d'une piste avec un utilisateur. */
  app.delete("/api/tracks/:id/shares/:userId", auth, async (req, res, next) => {
    try {
      const { id, userId } = req.params;
      if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
        return res.status(404).json({ message: "Piste ou ami inconnu" });
      }

      const track = await Track.findOneAndUpdate(
        { _id: id, ownerId: req.auth.sub },
        { $pull: { sharedWith: userId } },
        { new: true },
      );
      if (!track) {
        console.warn(`[shares] Arrêt de partage impossible : ${id}`);
        return res.status(404).json({ message: "Piste inconnue" });
      }

      console.log(`[shares] Partage de ${track.id} avec ${userId} arrêté`);
      res.json(track.toPublic());
    } catch (error) {
      console.error("[shares] Erreur d'arrêt de partage", error);
      next(error);
    }
  });

  /**
   * TP4 : change la visibilité d'une piste. Seul son propriétaire peut le faire.
   * Corps attendu : { "visibility": "public" | "private" }.
   */
  app.patch("/api/tracks/:id", auth, async (req, res, next) => {
    try {
      const visibility = parseVisibility(req.body?.visibility);
      if (!visibility) {
        console.warn(`[tracks] Visibilité invalide pour ${req.params.id}`);
        return res.status(400).json({ message: 'Visibilité attendue : "public" ou "private"' });
      }
      if (!mongoose.isValidObjectId(req.params.id)) {
        console.warn(`[tracks] Identifiant invalide : ${req.params.id}`);
        return res.status(404).json({ message: "Piste inconnue" });
      }

      const track = await Track.findOneAndUpdate(
        { _id: req.params.id, ownerId: req.auth.sub },
        { $set: { visibility } },
        { new: true, runValidators: true },
      );

      if (!track) {
        console.warn(`[tracks] Visibilité non modifiée (inconnue ou interdite) : ${req.params.id}`);
        return res.status(404).json({ message: "Piste inconnue" });
      }

      console.log(`[tracks] Visibilité de ${track.id} : ${visibility}`);
      if (visibility === "public") {
        await recordActivity({ actor: req.auth.sub, type: "track_published", track: track.id });
      }
      res.json(track.toPublic());
    } catch (error) {
      console.error("[tracks] Erreur de changement de visibilité", error);
      next(error);
    }
  });

  /**
   * Reçoit le champ multipart audio et le champ texte title.
   * upload.single("audio") traite un seul fichier et le place dans req.file,
   * tandis que req.body.title contient le champ texte associé.
   * C'est ici qu'est fait l'upload de fichiers sur le serveur. 
   * Le middleware auth vérifie le JWT avant d'accepter l'upload.
   * Le middleware upload.single("audio") traite le fichier audio envoyé dans le champ "audio" du formulaire
   * ou de l'appel depuis le frontend avec un objet FormData.
   * Si le fichier est accepté, il est stocké sur le disque et ses métadonnées sont enregistrées 
   * dans MongoDB.
   */
  app.post(
    "/api/tracks",
    auth,
    upload.single("audio"),
    async (req, res, next) => {
      try {
        if (!req.file) {
          console.warn(`[tracks] Upload sans fichier par ${req.auth.sub}`);
          return res.status(400).json({ message: "Fichier audio requis" });
        }

        // TP4 : champ texte optionnel `visibility`, privé par défaut.
        const visibility = parseVisibility(req.body.visibility, "private");
        if (!visibility) {
          console.warn(`[tracks] Upload refusé : visibilité invalide par ${req.auth.sub}`);
          await removeUploadedFile(req.file);
          return res.status(400).json({ message: 'Visibilité attendue : "public" ou "private"' });
        }

        const track = await Track.create({
          ownerId: req.auth.sub,
          title: req.body.title || req.file.originalname,
          originalName: req.file.originalname,
          storedName: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
          visibility,
        });

        console.log(`[tracks] Upload enregistré : ${track.id}`);
        if (visibility === "public") {
          await recordActivity({ actor: req.auth.sub, type: "track_published", track: track.id });
        }
        res.status(201).json(track.toPublic());
      } catch (error) {
        console.error("[tracks] Erreur après l'enregistrement du fichier", error);

        // Si MongoDB échoue après l'écriture sur disque, on tente de nettoyer
        // le fichier orphelin. L'erreur de nettoyage est elle aussi loguée.
        if (req.file) await removeUploadedFile(req.file);
        next(error);
      }
    },
  );

  /**
   * Envoie le contenu binaire d'une piste.
   * TP4 : autorisé pour son propriétaire, ou pour tout utilisateur connecté
   * si la piste est publique.
   */
  app.get("/api/tracks/:id/audio", auth, async (req, res, next) => {
    try {
      const track = await Track.findOne(
        readableTrackFilter(req.params.id, req.auth.sub),
      ).select("+storedName");

      if (!track) {
        console.warn(`[tracks] Audio introuvable ou interdit : ${req.params.id}`);
        return res.status(404).json({ message: "Piste inconnue" });
      }

      const audioPath = path.join(UPLOADS, track.storedName);
      res.type(track.mimeType);
      // Ce callback permet de loguer le succès ou l'erreur du transfert.
      res.sendFile(audioPath, (error) => {
        if (error) {
          console.error(`[tracks] Erreur d'envoi audio ${track.id}`, error);
          if (!res.headersSent) next(error);
          return;
        }
        console.log(`[tracks] Audio envoyé : ${track.id}`);
      });
    } catch (error) {
      console.error("[tracks] Erreur de préparation du flux audio", error);
      next(error);
    }
  });

  /** Supprime la métadonnée et le fichier physique correspondant. */
  app.delete("/api/tracks/:id", auth, async (req, res, next) => {
    try {
      const track = await Track.findOneAndDelete({
        _id: req.params.id,
        ownerId: req.auth.sub,
      }).select("+storedName");

      if (!track) {
        console.warn(`[tracks] Suppression impossible : ${req.params.id}`);
        return res.status(404).json({ message: "Piste inconnue" });
      }

      const audioPath = path.join(UPLOADS, track.storedName);
      try {
        await fsPromises.unlink(audioPath);
        console.log(`[tracks] Fichier supprimé : ${audioPath}`);
      } catch (error) {
        // L'exception n'est volontairement pas ignorée : l'administrateur doit
        // voir ce fichier orphelin si sa suppression échoue.
        console.error(`[tracks] Fichier audio non supprimé : ${audioPath}`, error);
        return res.status(500).json({
          message: "Métadonnée supprimée, mais fichier audio non supprimé",
        });
      }

      res.status(204).end();
    } catch (error) {
      console.error("[tracks] Erreur de suppression", error);
      next(error);
    }
  });

  // TP4 étape 2 : invitations, amis et retrait d'un ami.
  registerFriendRoutes(app, auth);
  // TP4 étape 3 : fil d'activité des amis.
  registerActivityRoutes(app, auth);

  /** Gestionnaire central des erreurs connues de l'application. */
  app.use((error, _req, res, next) => {
    console.error("[error] Erreur reçue par le gestionnaire central", error);

    if (
      error instanceof multer.MulterError ||
      error?.message === "Format audio non accepté"
    ) {
      return res.status(400).json({ message: error.message });
    }
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    if (error?.name === "CastError") {
      return res.status(404).json({ message: "Ressource inconnue" });
    }

    next(error);
  });

  return app;
}
