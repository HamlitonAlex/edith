const AUTH_STATUSES = new Set(["not_configured", "signed_out", "signing_in", "authenticated", "expired", "failed", "forbidden", "service_unavailable"]);
const defaultScope = "openid profile";

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function base64UrlJson(value) {
  try {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

function tokenClaims(token) {
  return base64UrlJson(String(token || "").split(".")[1]);
}

function validConfig(value) {
  const config = safeObject(value);
  const required = ["authorizationEndpoint", "tokenEndpoint", "clientId", "redirectUri"];
  return required.every(key => typeof config[key] === "string" && config[key].trim());
}

function randomVerifier(cryptoImpl) {
  const bytes = new Uint8Array(48);
  cryptoImpl.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function challengeFor(verifier, cryptoImpl) {
  const bytes = new TextEncoder().encode(verifier);
  const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function transactionKey(clientId) {
  return `xuecheng:oidc:transaction:${clientId}`;
}

export function authConfigFromWindow(windowRef = window) {
  const configured = safeObject(windowRef.__XUECHENG_OIDC_CONFIG__);
  if (validConfig(configured)) return configured;
  const meta = name => windowRef.document?.querySelector(`meta[name="${name}"]`)?.content?.trim() || "";
  const fromMeta = {
    authorizationEndpoint: meta("xuecheng-oidc-authorization-endpoint"),
    tokenEndpoint: meta("xuecheng-oidc-token-endpoint"),
    clientId: meta("xuecheng-oidc-client-id"),
    redirectUri: meta("xuecheng-oidc-redirect-uri") || windowRef.location?.href?.split("?")[0] || "",
    issuer: meta("xuecheng-oidc-issuer"),
    scope: meta("xuecheng-oidc-scope") || defaultScope,
  };
  return validConfig(fromMeta) ? fromMeta : null;
}

export function createAuthSession({ configuration = null, fetchImpl = globalThis.fetch, storage = globalThis.sessionStorage, locationRef = globalThis.location, historyRef = globalThis.history, cryptoImpl = globalThis.crypto, now = () => Date.now() } = {}) {
  let session = null;
  let status = configuration ? "signed_out" : "not_configured";
  let failure = null;
  const listeners = new Set();
  const emit = () => listeners.forEach(listener => listener(snapshot()));

  function snapshot() {
    const expiresAt = Number(session?.expiresAt || 0);
    const expired = Boolean(session && expiresAt && expiresAt <= now());
    if (expired && status === "authenticated") status = "expired";
    return {
      status,
      configured: Boolean(configuration),
      authenticated: status === "authenticated" && !expired,
      expires_at: expiresAt || null,
      identity: session?.identity ? { ...session.identity } : null,
      failure,
    };
  }

  function setStatus(next, nextFailure = null) {
    if (AUTH_STATUSES.has(next)) status = next;
    failure = nextFailure;
    emit();
  }

  function clearTransaction() {
    if (configuration) storage?.removeItem(transactionKey(configuration.clientId));
  }

  async function completeTokenResponse(payload) {
    const values = safeObject(payload);
    const accessToken = typeof values.access_token === "string" ? values.access_token.trim() : "";
    const expiresIn = Number(values.expires_in || 0);
    const claims = tokenClaims(values.id_token || accessToken);
    const identity = claims?.sub && (!configuration?.issuer || !claims.iss || claims.iss === configuration.issuer)
      ? { issuer: claims.iss || configuration?.issuer || "", subject: claims.sub }
      : null;
    if (!accessToken || !identity) {
      session = null;
      setStatus("failed", "identity_unavailable");
      return snapshot();
    }
    session = {
      accessToken,
      expiresAt: expiresIn > 0 ? now() + expiresIn * 1000 : Number(claims.exp || 0) * 1000,
      identity,
    };
    setStatus("authenticated");
    return snapshot();
  }

  async function beginLogin() {
    if (!configuration) {
      setStatus("not_configured", "auth_not_configured");
      return { started: false, reason: "auth_not_configured" };
    }
    if (!cryptoImpl?.subtle || !cryptoImpl?.getRandomValues) {
      setStatus("failed", "secure_browser_features_unavailable");
      return { started: false, reason: "secure_browser_features_unavailable" };
    }
    const state = randomVerifier(cryptoImpl);
    const verifier = randomVerifier(cryptoImpl);
    const challenge = await challengeFor(verifier, cryptoImpl);
    storage?.setItem(transactionKey(configuration.clientId), JSON.stringify({ state, verifier, createdAt: now() }));
    const url = new URL(configuration.authorizationEndpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", configuration.clientId);
    url.searchParams.set("redirect_uri", configuration.redirectUri);
    url.searchParams.set("scope", configuration.scope || defaultScope);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    setStatus("signing_in");
    locationRef.assign(url.toString());
    return { started: true };
  }

  async function restoreFromRedirect() {
    if (!configuration || !locationRef?.search) return snapshot();
    const parameters = new URLSearchParams(locationRef.search);
    const code = parameters.get("code");
    const returnedState = parameters.get("state");
    const error = parameters.get("error");
    if (!code && !error) return snapshot();
    let transaction = {};
    try { transaction = JSON.parse(storage?.getItem(transactionKey(configuration.clientId)) || "{}"); } catch { transaction = {}; }
    clearTransaction();
    historyRef?.replaceState?.({}, "", configuration.redirectUri);
    if (error || !transaction.state || transaction.state !== returnedState || !transaction.verifier) {
      setStatus("failed", error || "invalid_login_callback");
      return snapshot();
    }
    setStatus("signing_in");
    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: configuration.clientId,
        code,
        redirect_uri: configuration.redirectUri,
        code_verifier: transaction.verifier,
      });
      const response = await fetchImpl(configuration.tokenEndpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body });
      if (!response.ok) throw new Error("token_exchange_failed");
      return completeTokenResponse(await response.json());
    } catch {
      setStatus("failed", "token_exchange_failed");
      return snapshot();
    }
  }

  function accessToken() {
    const current = snapshot();
    return current.authenticated ? session.accessToken : null;
  }

  function handleRemoteStatus(statusCode) {
    if (statusCode === 401) setStatus("expired", "identity_required");
    if (statusCode === 403) setStatus("forbidden", "identity_override_forbidden");
    if (statusCode === 503) setStatus("service_unavailable", "auth_not_configured");
  }

  function signOut() {
    session = null;
    clearTransaction();
    setStatus(configuration ? "signed_out" : "not_configured");
  }

  return {
    getState: snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    beginLogin,
    restoreFromRedirect,
    accessToken,
    handleRemoteStatus,
    signOut,
    // The callback remains internal to real OIDC redirects; tests use it to exercise expiry and account scope without a provider.
    completeTokenResponse,
  };
}
