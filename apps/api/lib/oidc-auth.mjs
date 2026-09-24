import { createPublicKey, verify } from "node:crypto";
import { ApiError } from "./http.mjs";

const CACHE_WINDOW_MS = 5 * 60 * 1000;

function base64UrlJson(part) {
  try {
    const text = Buffer.from(String(part || ""), "base64url").toString("utf8");
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value;
  } catch {
    throw new ApiError(401, "invalid_token", "登录凭据无效或已过期。");
  }
}

function bearerToken(request) {
  const value = String(request.headers.authorization || "").trim();
  const match = /^Bearer\s+(.+)$/i.exec(value);
  if (!match) throw new ApiError(401, "identity_required", "请先登录后再访问个人数据。");
  return match[1];
}

function audienceMatches(actual, expected) {
  const values = Array.isArray(actual) ? actual : [actual];
  return values.includes(expected);
}

function validateClaims(claims, { issuer, audience, now }) {
  if (claims.iss !== issuer || !audienceMatches(claims.aud, audience) || typeof claims.sub !== "string" || !claims.sub.trim()) {
    throw new ApiError(401, "invalid_token", "登录凭据不属于当前服务。");
  }
  const clock = Math.floor(now().getTime() / 1000);
  if (!Number.isFinite(claims.exp) || claims.exp <= clock - 30 || (Number.isFinite(claims.nbf) && claims.nbf > clock + 30)) {
    throw new ApiError(401, "invalid_token", "登录凭据无效或已过期。");
  }
}

function configurationFromEnvironment(environment = process.env) {
  const issuer = String(environment.XUECHENG_OIDC_ISSUER || "").trim();
  const audience = String(environment.XUECHENG_OIDC_AUDIENCE || "").trim();
  const jwksUrl = String(environment.XUECHENG_OIDC_JWKS_URL || "").trim();
  return issuer && audience && jwksUrl ? { issuer, audience, jwksUrl } : null;
}

export class OidcAuthenticator {
  #configuration;
  #fetch;
  #now;
  #cache = null;

  constructor({ configuration = configurationFromEnvironment(), fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
    this.#configuration = configuration;
    this.#fetch = fetchImpl;
    this.#now = now;
  }

  get configured() {
    return Boolean(this.#configuration?.issuer && this.#configuration?.audience && this.#configuration?.jwksUrl);
  }

  async #keys() {
    const now = this.#now().getTime();
    if (this.#cache?.expiresAt > now) return this.#cache.keys;
    let response;
    try {
      response = await this.#fetch(this.#configuration.jwksUrl, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new ApiError(503, "identity_provider_unavailable", "登录服务暂时不可用，请稍后重试。");
    }
    if (!response?.ok) throw new ApiError(503, "identity_provider_unavailable", "登录服务暂时不可用，请稍后重试。");
    let body;
    try { body = await response.json(); }
    catch { throw new ApiError(503, "identity_provider_unavailable", "登录服务暂时不可用，请稍后重试。"); }
    if (!Array.isArray(body?.keys)) throw new ApiError(503, "identity_provider_unavailable", "登录服务暂时不可用，请稍后重试。");
    const keys = body.keys.filter(key => key?.kty === "RSA" && key?.kid && key?.n && key?.e);
    this.#cache = { keys, expiresAt: now + CACHE_WINDOW_MS };
    return keys;
  }

  async authenticate(request) {
    const token = bearerToken(request);
    if (!this.configured) {
      throw new ApiError(503, "auth_not_configured", "服务器尚未配置登录验证，不能接收私人数据。");
    }
    const [encodedHeader, encodedClaims, encodedSignature, ...extra] = token.split(".");
    if (!encodedHeader || !encodedClaims || !encodedSignature || extra.length) {
      throw new ApiError(401, "invalid_token", "登录凭据无效或已过期。");
    }
    const header = base64UrlJson(encodedHeader);
    const claims = base64UrlJson(encodedClaims);
    if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
      throw new ApiError(401, "invalid_token", "登录凭据使用了不受支持的签名方式。");
    }
    validateClaims(claims, { ...this.#configuration, now: this.#now });
    const key = (await this.#keys()).find(candidate => candidate.kid === header.kid);
    if (!key) throw new ApiError(401, "invalid_token", "登录凭据的签名密钥不可用。");
    let valid = false;
    try {
      valid = verify("RSA-SHA256", Buffer.from(`${encodedHeader}.${encodedClaims}`), createPublicKey({ key, format: "jwk" }), Buffer.from(encodedSignature, "base64url"));
    } catch {
      valid = false;
    }
    if (!valid) throw new ApiError(401, "invalid_token", "登录凭据无效或已过期。");
    return { issuer: claims.iss, subject: claims.sub };
  }
}

export function oidcConfigurationFromEnvironment(environment = process.env) {
  return configurationFromEnvironment(environment);
}
