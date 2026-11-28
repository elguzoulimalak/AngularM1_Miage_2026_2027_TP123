/*
 * TP4 — étape 3 : fil d'activité des amis.
 * Fonctions pures testées directement ; routes testées avec des doublures
 * Mongoose, sans base de données.
 */
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { Activity } from "../src/models/Activity.js";
import { Friendship } from "../src/models/Friendship.js";
import { Track } from "../src/models/Track.js";
import {
  buildFeed,
  feedFilter,
  friendIdsOf,
  isStillVisible,
  parseFeedLimit,
} from "../src/activity/logic.js";
import { recordActivity } from "../src/activity/record.js";
import { fakeQuery } from "./helpers.js";

const SECRET = process.env.JWT_SECRET || "tp1-development-secret";
const oid = () => new mongoose.Types.ObjectId().toString();
const me = oid();
const alice = oid();
const trackId = oid();
const headers = {
  Authorization: `Bearer ${jwt.sign({ sub: me, email: "moi@test.fr" }, SECRET)}`,
  "Content-Type": "application/json",
};

let server, base;
let create;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());
test.beforeEach(() => {
  create = mock.method(Activity, "create", () => Promise.resolve({}));
});
test.afterEach(() => mock.restoreAll());

/** Événement tel que renvoyé par find().populate().lean(). */
function event(type, extra = {}, trackExtra = {}) {
  return {
    _id: oid(),
    type,
    createdAt: "2026-11-28T10:00:00.000Z",
    actor: { _id: alice, name: "Alice" },
    track: {
      _id: trackId,
      title: "Blues en A",
      ownerId: alice,
      visibility: "public",
      sharedWith: [],
      ...trackExtra,
    },
    ...extra,
  };
}

// ---------- Fonctions pures ----------

test("parseFeedLimit borne la limite entre 1 et 50, 10 par défaut", () => {
  assert.equal(parseFeedLimit(undefined), 10);
  assert.equal(parseFeedLimit("abc"), 10);
  assert.equal(parseFeedLimit("0"), 10);
  assert.equal(parseFeedLimit("5"), 5);
  assert.equal(parseFeedLimit("500"), 50);
});

test("friendIdsOf renvoie l'autre personne de chaque relation", () => {
  assert.deepEqual(
    friendIdsOf(
      [
        { requester: "me", recipient: "a" },
        { requester: "b", recipient: "me" },
      ],
      "me",
    ),
    ["a", "b"],
  );
});

test("feedFilter ne garde que les publications et les partages faits avec moi", () => {
  assert.deepEqual(feedFilter(["a"], "me"), {
    actor: { $in: ["a"] },
    $or: [{ type: "track_published" }, { type: "track_shared", target: "me" }],
  });
});

test("isStillVisible écarte les pistes supprimées, redevenues privées ou plus partagées", () => {
  assert.equal(isStillVisible(event("track_published"), me), true);
  assert.equal(isStillVisible(event("track_published", {}, { visibility: "private" }), me), false);
  assert.equal(isStillVisible(event("track_published", { track: null }), me), false);
  assert.equal(isStillVisible(event("track_shared", {}, { visibility: "private", sharedWith: [me] }), me), true);
  assert.equal(isStillVisible(event("track_shared", {}, { visibility: "private", sharedWith: [] }), me), false);
  assert.equal(isStillVisible(event("track_published", {}, { ownerId: oid() }), me), false);
});

test("buildFeed supprime les doublons, garde le plus récent et respecte la limite", () => {
  const recent = event("track_published", { createdAt: "2026-11-28T12:00:00.000Z" });
  const older = event("track_published", { createdAt: "2026-11-27T12:00:00.000Z" });
  const other = event("track_published", {}, { _id: oid(), title: "Riff" });
  const feed = buildFeed([recent, older, other], me, 10);
  assert.equal(feed.length, 2);
  assert.equal(feed[0].at, "2026-11-28T12:00:00.000Z");
  assert.deepEqual(feed[0].user, { id: alice, name: "Alice" });
  assert.deepEqual(feed[1].track.title, "Riff");
  assert.equal(buildFeed([recent, other], me, 1).length, 1);
});

test("recordActivity n'interrompt pas l'action si l'écriture échoue", async () => {
  create.mock.mockImplementation(() => Promise.reject(new Error("panne")));
  await assert.doesNotReject(recordActivity({ actor: me, type: "track_published", track: trackId }));
});

// ---------- Route GET /api/activity ----------

test("GET /api/activity exige un JWT", async () => {
  const r = await fetch(base + "/api/activity");
  assert.equal(r.status, 401);
});

test("GET /api/activity renvoie un fil vide sans amis, sans lire le journal", async () => {
  mock.method(Friendship, "find", () => fakeQuery([]));
  const find = mock.method(Activity, "find", () => fakeQuery([]));
  const r = await fetch(base + "/api/activity", { headers });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { items: [] });
  assert.equal(find.mock.callCount(), 0);
});

test("GET /api/activity renvoie les événements encore visibles de mes amis", async () => {
  const friendships = mock.method(Friendship, "find", () =>
    fakeQuery([{ requester: me, recipient: alice }]),
  );
  const query = fakeQuery([
    event("track_shared", {}, { _id: oid(), title: "Riff privé", visibility: "private", sharedWith: [me] }),
    event("track_published", {}, { visibility: "private" }), // redevenue privée : filtrée
  ]);
  const find = mock.method(Activity, "find", () => query);

  const r = await fetch(base + "/api/activity?limit=5", { headers });
  assert.equal(r.status, 200);
  const body = await r.json();

  assert.deepEqual(friendships.mock.calls[0].arguments[0], {
    $or: [{ requester: me }, { recipient: me }],
    status: "accepted",
  });
  assert.deepEqual(find.mock.calls[0].arguments[0], feedFilter([alice], me));
  assert.deepEqual(query.calls.limit, [15]);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].type, "track_shared");
  assert.equal(body.items[0].track.title, "Riff privé");
  assert.equal(body.items[0].user.name, "Alice");
  assert.equal(body.items[0].track.sharedWith, undefined);
});

// ---------- Enregistrement des événements ----------

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

test("rendre une piste publique enregistre track_published", async () => {
  mock.method(Track, "findOneAndUpdate", () => Promise.resolve(makeTrack({ visibility: "public" })));
  const r = await fetch(`${base}/api/tracks/${trackId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ visibility: "public" }),
  });
  assert.equal(r.status, 200);
  assert.deepEqual(create.mock.calls[0].arguments[0], {
    actor: me,
    type: "track_published",
    track: trackId,
    target: undefined,
  });
});

test("rendre une piste privée n'enregistre rien", async () => {
  mock.method(Track, "findOneAndUpdate", () => Promise.resolve(makeTrack({ visibility: "private" })));
  const r = await fetch(`${base}/api/tracks/${trackId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ visibility: "private" }),
  });
  assert.equal(r.status, 200);
  assert.equal(create.mock.callCount(), 0);
});

test("partager une piste enregistre track_shared avec le destinataire", async () => {
  mock.method(Friendship, "findOne", () => Promise.resolve(new Friendship({ status: "accepted" })));
  mock.method(Track, "findOneAndUpdate", () => Promise.resolve(makeTrack({ sharedWith: [alice] })));
  const r = await fetch(`${base}/api/tracks/${trackId}/shares/${alice}`, { method: "PUT", headers });
  assert.equal(r.status, 200);
  assert.deepEqual(create.mock.calls[0].arguments[0], {
    actor: me,
    type: "track_shared",
    track: trackId,
    target: alice,
  });
});
