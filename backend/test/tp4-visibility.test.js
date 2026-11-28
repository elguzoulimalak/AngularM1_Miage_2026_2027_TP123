/*
 * TP4 — étape 1 : visibilité public/privé et recherche.
 * Les fonctions pures sont testées directement. Les routes sont testées via
 * HTTP en remplaçant les méthodes Mongoose par des doublures (mock), ce qui
 * évite d'avoir besoin d'une base MongoDB pendant les tests.
 */
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { Track } from "../src/models/Track.js";
import {
  escapeRegex,
  myTracksFilter,
  parseSearch,
  parseVisibility,
  publicTracksFilter,
  readableTrackFilter,
} from "../src/tracks/query.js";
import { fakeQuery } from "./helpers.js";

const SECRET = process.env.JWT_SECRET || "tp1-development-secret";
const userId = new mongoose.Types.ObjectId().toString();
const trackId = new mongoose.Types.ObjectId().toString();
const headers = {
  Authorization: `Bearer ${jwt.sign({ sub: userId, email: "a@b.fr" }, SECRET)}`,
  "Content-Type": "application/json",
};

let server, base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());
test.afterEach(() => mock.restoreAll());

// ---------- Fonctions pures ----------

test("parseVisibility accepte public/private et applique la valeur par défaut", () => {
  assert.equal(parseVisibility("public"), "public");
  assert.equal(parseVisibility("private"), "private");
  assert.equal(parseVisibility(undefined, "private"), "private");
  assert.equal(parseVisibility("", "private"), "private");
  assert.equal(parseVisibility("friends"), null);
  assert.equal(parseVisibility({ $ne: "x" }), null);
});

test("escapeRegex neutralise les caractères spéciaux", () => {
  assert.equal(escapeRegex("a.*(b)"), "a\\.\\*\\(b\\)");
  assert.ok(new RegExp(escapeRegex("x+y")).test("x+y"));
});

test("parseSearch nettoie, limite la longueur et refuse les tableaux", () => {
  assert.equal(parseSearch(undefined), "");
  assert.equal(parseSearch("  blues  "), "blues");
  assert.equal(parseSearch(["a", "b"]), null);
  assert.equal(parseSearch("x".repeat(101)), null);
});

test("les filtres limitent bien la portée des requêtes", () => {
  assert.deepEqual(myTracksFilter("u1"), { ownerId: "u1" });
  assert.deepEqual(myTracksFilter("u1", "blu"), {
    ownerId: "u1",
    title: { $regex: "blu", $options: "i" },
  });
  assert.deepEqual(publicTracksFilter(), { visibility: "public" });
  assert.deepEqual(readableTrackFilter("t1", "u1"), {
    _id: "t1",
    $or: [{ ownerId: "u1" }, { visibility: "public" }, { sharedWith: "u1" }],
  });
});

test("le schéma Track est privé par défaut et refuse une visibilité inconnue", async () => {
  const base = {
    ownerId: new mongoose.Types.ObjectId(),
    title: "Blues",
    originalName: "b.mp3",
    storedName: "x.mp3",
    mimeType: "audio/mpeg",
    size: 42,
  };
  const t = new Track(base);
  assert.equal(t.visibility, "private");
  assert.equal(t.toPublic().visibility, "private");
  const bad = new Track({ ...base, visibility: "friends" });
  await assert.rejects(bad.validate(), (error) => Boolean(error.errors.visibility));
});

// ---------- Routes HTTP ----------

test("GET /api/tracks/public exige un JWT", async () => {
  const r = await fetch(base + "/api/tracks/public");
  assert.equal(r.status, 401);
});

test("GET /api/tracks/public renvoie les pistes publiques avec le nom du propriétaire", async () => {
  const doc = {
    _id: trackId,
    ownerId: { _id: userId, name: "Malak" },
    title: "Blues en A",
    originalName: "blues.mp3",
    mimeType: "audio/mpeg",
    size: 10,
    visibility: "public",
    createdAt: "2026-11-27T00:00:00.000Z",
  };
  const query = fakeQuery([doc]);
  const find = mock.method(Track, "find", () => query);
  mock.method(Track, "countDocuments", () => Promise.resolve(1));

  const r = await fetch(base + "/api/tracks/public?q=blu&page=1&limit=5", { headers });
  assert.equal(r.status, 200);
  const body = await r.json();

  assert.deepEqual(find.mock.calls[0].arguments[0], {
    visibility: "public",
    title: { $regex: "blu", $options: "i" },
  });
  assert.deepEqual(query.calls.sort, [{ createdAt: -1 }]);
  assert.equal(body.total, 1);
  assert.equal(body.items[0].ownerName, "Malak");
  assert.equal(body.items[0].id, trackId);
  assert.equal(body.items[0].storedName, undefined);
});

test("GET /api/tracks filtre par propriétaire et par titre", async () => {
  const find = mock.method(Track, "find", () => fakeQuery([]));
  mock.method(Track, "countDocuments", () => Promise.resolve(0));

  const r = await fetch(base + "/api/tracks?q=" + encodeURIComponent("a.*"), { headers });
  assert.equal(r.status, 200);
  assert.deepEqual(find.mock.calls[0].arguments[0], {
    ownerId: userId,
    title: { $regex: "a\\.\\*", $options: "i" },
  });
});

test("GET /api/tracks refuse une recherche trop longue", async () => {
  const r = await fetch(base + "/api/tracks?q=" + "x".repeat(101), { headers });
  assert.equal(r.status, 400);
});

test("PATCH /api/tracks/:id refuse une visibilité invalide sans toucher la base", async () => {
  const update = mock.method(Track, "findOneAndUpdate", () => Promise.resolve(null));
  const r = await fetch(`${base}/api/tracks/${trackId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ visibility: "friends" }),
  });
  assert.equal(r.status, 400);
  assert.equal(update.mock.callCount(), 0);
});

test("PATCH /api/tracks/:id ne modifie que les pistes du propriétaire", async () => {
  const update = mock.method(Track, "findOneAndUpdate", () => Promise.resolve(null));
  const r = await fetch(`${base}/api/tracks/${trackId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ visibility: "public" }),
  });
  assert.equal(r.status, 404);
  assert.deepEqual(update.mock.calls[0].arguments[0], { _id: trackId, ownerId: userId });
  assert.deepEqual(update.mock.calls[0].arguments[1], { $set: { visibility: "public" } });
});

test("PATCH /api/tracks/:id renvoie la piste mise à jour", async () => {
  const updated = new Track({
    _id: trackId,
    ownerId: userId,
    title: "Blues",
    originalName: "b.mp3",
    storedName: "x.mp3",
    mimeType: "audio/mpeg",
    size: 42,
    visibility: "public",
  });
  mock.method(Track, "findOneAndUpdate", () => Promise.resolve(updated));
  const r = await fetch(`${base}/api/tracks/${trackId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ visibility: "public" }),
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.visibility, "public");
  assert.equal(body.storedName, undefined);
});

test("PATCH /api/tracks/:id renvoie 404 pour un identifiant mal formé", async () => {
  const r = await fetch(`${base}/api/tracks/pas-un-id`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ visibility: "public" }),
  });
  assert.equal(r.status, 404);
});

test("GET /api/tracks/:id/audio autorise le propriétaire, une piste publique ou partagée", async () => {
  const findOne = mock.method(Track, "findOne", () => fakeQuery(null));
  const r = await fetch(`${base}/api/tracks/${trackId}/audio`, { headers });
  assert.equal(r.status, 404);
  assert.deepEqual(findOne.mock.calls[0].arguments[0], {
    _id: trackId,
    $or: [{ ownerId: userId }, { visibility: "public" }, { sharedWith: userId }],
  });
});
