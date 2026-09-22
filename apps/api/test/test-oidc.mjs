import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OidcAuthenticator } from "../lib/oidc-auth.mjs";
import { createApiServer } from "../server.mjs";

export const fixedNow = () => new Date("2030-01-01T08:00:00.000Z");

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function createTestOidc(now = fixedNow) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const issuer = "https://identity.test.example";
  const audience = "xuecheng-api-test";
  const jwksUrl = "https://identity.test.example/keys";
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key-1", use: "sig", alg: "RS256" };
  const authenticator = new OidcAuthenticator({
    configuration: { issuer, audience, jwksUrl },
    now,
    fetchImpl: async url => {
      if (url !== jwksUrl) return new Response(null, { status: 404 });
      return new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const tokenFor = subject => {
    const header = base64Url({ alg: "RS256", typ: "JWT", kid: jwk.kid });
    const claims = base64Url({ iss: issuer, aud: audience, sub: subject, exp: Math.floor(now().getTime() / 1000) + 3600 });
    const signature = sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), privateKey).toString("base64url");
    return `${header}.${claims}.${signature}`;
  };
  return {
    authenticator,
    headersFor: (subject, extra = {}) => ({ authorization: `Bearer ${tokenFor(subject)}`, ...extra }),
  };
}

export async function withApi(run, { now = fixedNow } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "xuecheng-api-phase2-"));
  const oidc = createTestOidc(now);
  const server = createApiServer({ dataDirectory: directory, now, authenticator: oidc.authenticator });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await run({ origin: `http://127.0.0.1:${port}`, directory, headersFor: oidc.headersFor, now, oidc });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

export function versionFrom(response) {
  const match = /^W\/"(\d+)"$/.exec(String(response.headers.get("etag") || ""));
  if (!match) throw new Error("response did not include an ETag data version");
  return Number(match[1]);
}
