import assert from "node:assert/strict";
import test from "node:test";
import { authConfigFromWindow, createAuthSession } from "../lib/auth-session.js";

const configuration = {
  authorizationEndpoint: "https://identity.example/authorize",
  tokenEndpoint: "https://identity.example/token",
  clientId: "xuecheng-web",
  redirectUri: "https://app.example/",
  issuer: "https://identity.example",
};

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    values,
  };
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function idToken(claims = {}) {
  return `${base64Url({ alg: "RS256", typ: "JWT" })}.${base64Url({ iss: configuration.issuer, sub: "user-a", exp: 2_000_000_000, ...claims })}.signature`;
}

test("public configuration is optional and a missing provider never creates a fake login", async () => {
  const session = createAuthSession({ configuration: null, storage: memoryStorage() });
  const result = await session.beginLogin();
  assert.deepEqual(result, { started: false, reason: "auth_not_configured" });
  assert.equal(session.getState().status, "not_configured");
  assert.equal(session.accessToken(), null);
  assert.equal(authConfigFromWindow({ document: { querySelector: () => null }, location: { href: "https://app.example/" } }), null);
});

test("OIDC completion keeps the bearer token in memory and exposes only a verified identity", async () => {
  const storage = memoryStorage();
  const session = createAuthSession({ configuration, storage, now: () => 1_000 });
  const state = await session.completeTokenResponse({ access_token: "access-secret", expires_in: 300, id_token: idToken() });
  assert.equal(state.authenticated, true);
  assert.deepEqual(state.identity, { issuer: configuration.issuer, subject: "user-a" });
  assert.equal(session.accessToken(), "access-secret");
  assert.equal(JSON.stringify([...storage.values.entries()]).includes("access-secret"), false);
  assert.equal("accessToken" in state, false);
});

test("401, 403 and 503 have distinct user-visible authentication states", async () => {
  const session = createAuthSession({ configuration, storage: memoryStorage() });
  await session.completeTokenResponse({ access_token: "access-secret", expires_in: 300, id_token: idToken() });
  session.handleRemoteStatus(401);
  assert.equal(session.getState().status, "expired");
  session.handleRemoteStatus(403);
  assert.equal(session.getState().status, "forbidden");
  session.handleRemoteStatus(503);
  assert.equal(session.getState().status, "service_unavailable");
});
