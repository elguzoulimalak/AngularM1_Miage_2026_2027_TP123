/*
 * TP4 — étape 2 : amis et partage révocable.
 * Comme pour l'étape 1, les méthodes Mongoose sont remplacées par des
 * doublures : les tests tournent sans MongoDB.
 */
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { Friendship } from "../src/models/Friendship.js";
import { Track } from "../src/models/Track.js";
import { Activity } from "../src/models/Activity.js";
import { User } from "../src/models/User.js";
import {
  friendshipBetweenFilter,
  parseEmail,
  splitFriendships,
} from "../src/friends/logic.js";
import { sharedWithMeFilter } from "../src/tracks/query.js";
import { fakeQuery } from "./helpers.js";

const SECRET = process.env.JWT_SECRET || "tp1-development-secret";
const oid = () => new mongoose.Types.ObjectId().toString();
const me = oid();
const friend = oid();
const trackId = oid();
const headers = {
  Authorization: `Bearer ${jwt.sign({ sub: me, email: "moi@test.fr" }, SECRET)}`,
  "Content-Type": "application/json",
};

let server, base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());
// Le journal d'activité (étape 3) est simulé : pas d'écriture MongoDB.
test.beforeEach(() => mock.method(Activity, "create", () => Promise.resolve({})));
test.afterEach(() => mock.restoreAll());

const call = (method, url, body) =>
  fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

function makeTrack(extra = {}) {
  return new Track({
    _id: trackId,
    ownerId: me,
    title: "Blues",
    originalName: "b.mp3",
    storedName: "x.mp3",
    mimeType: "audio/mpeg",
    size: 42,
    ...extra,
  });
}

// ---------- Fonctions pures ----------

test("parseEmail normalise et refuse les valeurs invalides", () => {
  assert.equal(parseEmail("  Alice@Test.FR "), "alice@test.fr");
  assert.equal(parseEmail("pas-un-email"), null);
  assert.equal(parseEmail({ $ne: "" }), null);
});

test("friendshipBetweenFilter couvre les deux sens", () => {
  assert.deepEqual(friendshipBetweenFilter("a", "b"), {
    $or: [
      { requester: "a", recipient: "b" },
      { requester: "b", recipient: "a" },
    ],
  });
});

test("splitFriendships range amis, invitations reçues et envoyées", () => {
  const alice = { _id: "alice", name: "Alice", email: "a@t.fr" };
  const bob = { _id: "bob", name: "Bob", email: "b@t.fr" };
  const carl = { _id: "carl", name: "Carl", email: "c@t.fr" };
  const meDoc = { _id: "me", name: "Moi", email: "m@t.fr" };
  const result = splitFriendships(
    [
      { _id: "f1", requester: meDoc, recipient: alice, status: "accepted" },
      { _id: "f2", requester: bob, recipient: meDoc, status: "pending" },
      { _id: "f3", requester: meDoc, recipient: carl, status: "pending" },
    ],
    "me",
  );
  assert.deepEqual(result.friends.map((f) => f.user.name), ["Alice"]);
  assert.deepEqual(result.incoming.map((f) => [f.id, f.user.name]), [["f2", "Bob"]]);
  assert.deepEqual(result.outgoing.map((f) => [f.id, f.user.name]), [["f3", "Carl"]]);
});

test("sharedWithMeFilter cible les pistes partagées avec moi", () => {
  assert.deepEqual(sharedWithMeFilter("u1"), { sharedWith: "u1" });
});

test("Track.toPublic expose sharedWith en chaînes, vide par défaut", () => {
  assert.deepEqual(makeTrack().toPublic().sharedWith, []);
  assert.deepEqual(makeTrack({ sharedWith: [friend] }).toPublic().sharedWith, [friend]);
});

// ---------- Invitations ----------

test("GET /api/friends exige un JWT", async () => {
  const r = await fetch(base + "/api/friends");
  assert.equal(r.status, 401);
});

test("GET /api/friends renvoie amis et invitations sans données sensibles", async () => {
  const find = mock.method(Friendship, "find", () =>
    fakeQuery([
      {
        _id: oid(),
        requester: { _id: me, name: "Moi", email: "moi@test.fr" },
        recipient: { _id: friend, name: "Alice", email: "alice@test.fr" },
        status: "accepted",
      },
    ]),
  );
  const r = await call("GET", "/api/friends");
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.deepEqual(find.mock.calls[0].arguments[0], { $or: [{ requester: me }, { recipient: me }] });
  assert.equal(body.friends[0].user.name, "Alice");
  assert.equal(body.friends[0].user.passwordHash, undefined);
  assert.deepEqual(body.incoming, []);
});

test("POST /api/friends/requests refuse un email invalide", async () => {
  const r = await call("POST", "/api/friends/requests", { email: "nope" });
  assert.equal(r.status, 400);
});

test("POST /api/friends/requests renvoie 404 pour un email inconnu", async () => {
  mock.method(User, "findOne", () => Promise.resolve(null));
  const r = await call("POST", "/api/friends/requests", { email: "x@test.fr" });
  assert.equal(r.status, 404);
});

test("POST /api/friends/requests refuse de s'inviter soi-même", async () => {
  mock.method(User, "findOne", () => Promise.resolve(new User({ _id: me, name: "Moi", email: "moi@test.fr" })));
  const r = await call("POST", "/api/friends/requests", { email: "moi@test.fr" });
  assert.equal(r.status, 400);
});

test("POST /api/friends/requests crée une invitation en attente", async () => {
  mock.method(User, "findOne", () => Promise.resolve(new User({ _id: friend, name: "Alice", email: "alice@test.fr" })));
  mock.method(Friendship, "findOne", () => Promise.resolve(null));
  const create = mock.method(Friendship, "create", (doc) => Promise.resolve(new Friendship(doc)));

  const r = await call("POST", "/api/friends/requests", { email: "ALICE@test.fr" });
  assert.equal(r.status, 201);
  const body = await r.json();
  assert.equal(body.status, "pending");
  assert.equal(body.user.name, "Alice");
  assert.deepEqual(create.mock.calls[0].arguments[0], { requester: me, recipient: friend });
});

test("POST /api/friends/requests renvoie 409 si déjà amis ou déjà invité", async () => {
  mock.method(User, "findOne", () => Promise.resolve(new User({ _id: friend, name: "Alice", email: "alice@test.fr" })));
  const findOne = mock.method(Friendship, "findOne", () =>
    Promise.resolve(new Friendship({ requester: me, recipient: friend, status: "accepted" })),
  );
  assert.equal((await call("POST", "/api/friends/requests", { email: "alice@test.fr" })).status, 409);

  findOne.mock.mockImplementation(() =>
    Promise.resolve(new Friendship({ requester: me, recipient: friend, status: "pending" })),
  );
  assert.equal((await call("POST", "/api/friends/requests", { email: "alice@test.fr" })).status, 409);
});

test("POST /api/friends/requests accepte une invitation croisée", async () => {
  mock.method(User, "findOne", () => Promise.resolve(new User({ _id: friend, name: "Alice", email: "alice@test.fr" })));
  const pending = new Friendship({ requester: friend, recipient: me, status: "pending" });
  const save = mock.method(pending, "save", () => Promise.resolve(pending));
  mock.method(Friendship, "findOne", () => Promise.resolve(pending));

  const r = await call("POST", "/api/friends/requests", { email: "alice@test.fr" });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, "accepted");
  assert.equal(save.mock.callCount(), 1);
});

test("POST /api/friends/requests/:id/accept n'accepte que les invitations reçues", async () => {
  const requestId = oid();
  const update = mock.method(Friendship, "findOneAndUpdate", () => Promise.resolve(null));
  const r = await call("POST", `/api/friends/requests/${requestId}/accept`);
  assert.equal(r.status, 404);
  assert.deepEqual(update.mock.calls[0].arguments[0], { _id: requestId, recipient: me, status: "pending" });
});

test("DELETE /api/friends/requests/:id refuse ou annule une invitation", async () => {
  const requestId = oid();
  const del = mock.method(Friendship, "findOneAndDelete", () => Promise.resolve(new Friendship({ _id: requestId })));
  const r = await call("DELETE", `/api/friends/requests/${requestId}`);
  assert.equal(r.status, 204);
  assert.deepEqual(del.mock.calls[0].arguments[0], {
    _id: requestId,
    status: "pending",
    $or: [{ requester: me }, { recipient: me }],
  });
});

test("DELETE /api/friends/:userId retire l'ami et arrête les partages dans les deux sens", async () => {
  mock.method(Friendship, "findOneAndDelete", () => Promise.resolve(new Friendship({ status: "accepted" })));
  const updateMany = mock.method(Track, "updateMany", () => Promise.resolve({ modifiedCount: 1 }));

  const r = await call("DELETE", `/api/friends/${friend}`);
  assert.equal(r.status, 204);
  const filters = updateMany.mock.calls.map((c) => c.arguments[0]);
  assert.deepEqual(filters, [
    { ownerId: me, sharedWith: friend },
    { ownerId: friend, sharedWith: me },
  ]);
});

test("DELETE /api/friends/:userId renvoie 404 si ce n'est pas un ami", async () => {
  mock.method(Friendship, "findOneAndDelete", () => Promise.resolve(null));
  const updateMany = mock.method(Track, "updateMany", () => Promise.resolve({}));
  const r = await call("DELETE", `/api/friends/${friend}`);
  assert.equal(r.status, 404);
  assert.equal(updateMany.mock.callCount(), 0);
});

// ---------- Partage ----------

test("PUT /api/tracks/:id/shares/:userId refuse un non-ami (403)", async () => {
  mock.method(Friendship, "findOne", () => Promise.resolve(null));
  const update = mock.method(Track, "findOneAndUpdate", () => Promise.resolve(null));
  const r = await call("PUT", `/api/tracks/${trackId}/shares/${friend}`);
  assert.equal(r.status, 403);
  assert.equal(update.mock.callCount(), 0);
});

test("PUT /api/tracks/:id/shares/:userId partage avec un ami", async () => {
  mock.method(Friendship, "findOne", () => Promise.resolve(new Friendship({ status: "accepted" })));
  const update = mock.method(Track, "findOneAndUpdate", () => Promise.resolve(makeTrack({ sharedWith: [friend] })));
  const r = await call("PUT", `/api/tracks/${trackId}/shares/${friend}`);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).sharedWith, [friend]);
  assert.deepEqual(update.mock.calls[0].arguments[0], { _id: trackId, ownerId: me });
  assert.deepEqual(update.mock.calls[0].arguments[1], { $addToSet: { sharedWith: friend } });
});

test("PUT /api/tracks/:id/shares/:userId renvoie 404 pour la piste d'un autre", async () => {
  mock.method(Friendship, "findOne", () => Promise.resolve(new Friendship({ status: "accepted" })));
  mock.method(Track, "findOneAndUpdate", () => Promise.resolve(null));
  const r = await call("PUT", `/api/tracks/${trackId}/shares/${friend}`);
  assert.equal(r.status, 404);
});

test("DELETE /api/tracks/:id/shares/:userId arrête le partage", async () => {
  const update = mock.method(Track, "findOneAndUpdate", () => Promise.resolve(makeTrack()));
  const r = await call("DELETE", `/api/tracks/${trackId}/shares/${friend}`);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).sharedWith, []);
  assert.deepEqual(update.mock.calls[0].arguments[1], { $pull: { sharedWith: friend } });
});

test("GET /api/tracks/shared liste les pistes partagées avec moi, sans sharedWith", async () => {
  const find = mock.method(Track, "find", () =>
    fakeQuery([
      {
        _id: trackId,
        ownerId: { _id: friend, name: "Alice" },
        title: "Riff",
        originalName: "riff.mp3",
        mimeType: "audio/mpeg",
        size: 5,
        visibility: "private",
        sharedWith: [me, oid()],
        createdAt: "2026-11-28T00:00:00.000Z",
      },
    ]),
  );
  mock.method(Track, "countDocuments", () => Promise.resolve(1));

  const r = await call("GET", "/api/tracks/shared?q=rif");
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.deepEqual(find.mock.calls[0].arguments[0], {
    sharedWith: me,
    title: { $regex: "rif", $options: "i" },
  });
  assert.equal(body.items[0].ownerName, "Alice");
  assert.equal(body.items[0].sharedWith, undefined);
});
