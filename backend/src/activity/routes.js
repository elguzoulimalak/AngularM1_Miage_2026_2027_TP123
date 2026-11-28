import { Activity } from "../models/Activity.js";
import { Friendship } from "../models/Friendship.js";
import { friendshipsOfFilter } from "../friends/logic.js";
import { buildFeed, feedFilter, friendIdsOf, parseFeedLimit } from "./logic.js";

/** Déclare la route du fil d'activité des amis (TP4 étape 3). */
export function registerActivityRoutes(app, auth) {
  /**
   * Dernières actions de mes amis : pistes rendues publiques et pistes
   * partagées avec moi, des plus récentes aux plus anciennes.
   */
  app.get("/api/activity", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const limit = parseFeedLimit(req.query.limit);

      const friendships = await Friendship.find({
        ...friendshipsOfFilter(me),
        status: "accepted",
      })
        .select("requester recipient")
        .lean();
      const friendIds = friendIdsOf(friendships, me);
      if (friendIds.length === 0) {
        console.log(`[activity] Aucun ami pour ${me} : fil vide`);
        return res.json({ items: [] });
      }

      // On lit plus d'événements que demandé, car certains seront filtrés
      // (piste supprimée, redevenue privée, partage arrêté, doublons).
      const activities = await Activity.find(feedFilter(friendIds, me))
        .sort({ createdAt: -1 })
        .limit(limit * 3)
        .populate("actor", "name")
        .populate("track", "title visibility sharedWith ownerId")
        .lean();

      const items = buildFeed(activities, me, limit);
      console.log(`[activity] ${items.length} événement(s) envoyé(s) à ${me}`);
      res.json({ items });
    } catch (error) {
      console.error("[activity] Erreur de lecture du fil", error);
      next(error);
    }
  });
}
