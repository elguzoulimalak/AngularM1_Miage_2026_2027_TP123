import mongoose from "mongoose";
import { Friendship } from "../models/Friendship.js";
import { Track } from "../models/Track.js";
import { User } from "../models/User.js";
import {
  friendshipBetweenFilter,
  friendshipsOfFilter,
  parseEmail,
  publicUser,
  splitFriendships,
} from "./logic.js";

/**
 * Déclare les routes « amis » (TP4 étape 2) sur l'application Express.
 * `auth` est le middleware JWT défini dans app.js.
 */
export function registerFriendRoutes(app, auth) {
  /** Amis, invitations reçues et invitations envoyées de l'utilisateur connecté. */
  app.get("/api/friends", auth, async (req, res, next) => {
    try {
      const friendships = await Friendship.find(friendshipsOfFilter(req.auth.sub))
        .sort({ updatedAt: -1 })
        .populate("requester", "name email")
        .populate("recipient", "name email")
        .lean();
      const overview = splitFriendships(friendships, req.auth.sub);
      console.log(
        `[friends] ${overview.friends.length} ami(s), ${overview.incoming.length} reçue(s), ${overview.outgoing.length} envoyée(s) pour ${req.auth.sub}`,
      );
      res.json(overview);
    } catch (error) {
      console.error("[friends] Erreur de lecture des amis", error);
      next(error);
    }
  });

  /**
   * Invite un utilisateur par son email.
   * Si cette personne m'avait déjà invité·e, l'invitation est acceptée directement.
   */
  app.post("/api/friends/requests", auth, async (req, res, next) => {
    try {
      const email = parseEmail(req.body?.email);
      if (!email) {
        console.warn("[friends] Invitation refusée : email invalide");
        return res.status(400).json({ message: "Email invalide" });
      }

      const target = await User.findOne({ email });
      if (!target) {
        console.warn("[friends] Invitation refusée : utilisateur inconnu");
        return res.status(404).json({ message: "Aucun utilisateur avec cet email" });
      }
      if (target.id === req.auth.sub) {
        console.warn(`[friends] ${req.auth.sub} essaie de s'inviter lui-même`);
        return res.status(400).json({ message: "Vous ne pouvez pas vous inviter vous-même" });
      }

      const existing = await Friendship.findOne(friendshipBetweenFilter(req.auth.sub, target.id));
      if (existing?.status === "accepted") {
        return res.status(409).json({ message: "Vous êtes déjà amis" });
      }
      if (existing && String(existing.requester) === req.auth.sub) {
        return res.status(409).json({ message: "Invitation déjà envoyée" });
      }
      if (existing) {
        // L'autre personne m'avait déjà invité·e : on accepte son invitation.
        existing.status = "accepted";
        await existing.save();
        console.log(`[friends] Invitation croisée acceptée : ${existing.id}`);
        return res.status(200).json({ id: existing.id, status: "accepted", user: publicUser(target) });
      }

      const created = await Friendship.create({ requester: req.auth.sub, recipient: target.id });
      console.log(`[friends] Invitation ${created.id} envoyée par ${req.auth.sub}`);
      res.status(201).json({ id: created.id, status: "pending", user: publicUser(target) });
    } catch (error) {
      if (error?.code === 11000) {
        console.warn("[friends] Invitation en double (index unique)");
        return res.status(409).json({ message: "Invitation déjà envoyée" });
      }
      console.error("[friends] Erreur d'invitation", error);
      next(error);
    }
  });

  /** Accepte une invitation reçue (seul son destinataire peut le faire). */
  app.post("/api/friends/requests/:id/accept", auth, async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(404).json({ message: "Invitation inconnue" });
      }
      const friendship = await Friendship.findOneAndUpdate(
        { _id: req.params.id, recipient: req.auth.sub, status: "pending" },
        { $set: { status: "accepted" } },
        { new: true },
      );
      if (!friendship) {
        console.warn(`[friends] Acceptation impossible : ${req.params.id}`);
        return res.status(404).json({ message: "Invitation inconnue" });
      }
      console.log(`[friends] Invitation ${friendship.id} acceptée`);
      res.json({ id: friendship.id, status: "accepted" });
    } catch (error) {
      console.error("[friends] Erreur d'acceptation", error);
      next(error);
    }
  });

  /** Refuse une invitation reçue, ou annule une invitation envoyée. */
  app.delete("/api/friends/requests/:id", auth, async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(404).json({ message: "Invitation inconnue" });
      }
      const deleted = await Friendship.findOneAndDelete({
        _id: req.params.id,
        status: "pending",
        $or: [{ requester: req.auth.sub }, { recipient: req.auth.sub }],
      });
      if (!deleted) {
        console.warn(`[friends] Suppression d'invitation impossible : ${req.params.id}`);
        return res.status(404).json({ message: "Invitation inconnue" });
      }
      console.log(`[friends] Invitation ${deleted.id} refusée ou annulée`);
      res.status(204).end();
    } catch (error) {
      console.error("[friends] Erreur de suppression d'invitation", error);
      next(error);
    }
  });

  /**
   * Retire un ami. Les partages dans les deux sens sont arrêtés : l'ancien ami
   * ne voit plus mes pistes privées, et je ne vois plus les siennes.
   */
  app.delete("/api/friends/:userId", auth, async (req, res, next) => {
    try {
      const other = req.params.userId;
      if (!mongoose.isValidObjectId(other)) {
        return res.status(404).json({ message: "Ami inconnu" });
      }
      const deleted = await Friendship.findOneAndDelete({
        ...friendshipBetweenFilter(req.auth.sub, other),
        status: "accepted",
      });
      if (!deleted) {
        console.warn(`[friends] Retrait impossible : ${other} n'est pas ami avec ${req.auth.sub}`);
        return res.status(404).json({ message: "Ami inconnu" });
      }

      await Promise.all([
        Track.updateMany({ ownerId: req.auth.sub, sharedWith: other }, { $pull: { sharedWith: other } }),
        Track.updateMany({ ownerId: other, sharedWith: req.auth.sub }, { $pull: { sharedWith: req.auth.sub } }),
      ]);
      console.log(`[friends] ${req.auth.sub} et ${other} ne sont plus amis ; partages arrêtés`);
      res.status(204).end();
    } catch (error) {
      console.error("[friends] Erreur de retrait d'ami", error);
      next(error);
    }
  });
}
