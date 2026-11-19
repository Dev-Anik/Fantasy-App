// Sign-in with the official Premier League account service.
//
// FPL signs users in with OpenID Connect (authorization code + PKCE) and its
// API takes the resulting access token in an `X-API-Authorization` header.
// The app runs that flow itself and keeps the tokens in the device keychain,
// so a user stays signed in until they log out: the access token is renewed
// with the refresh token whenever it is about to expire. No password is ever
// seen or stored by the app.
import * as SecureStore from "expo-secure-store";

const AUTHORITY = "https://account.premierleague.com/as";
// The FPL website's own public client, so tokens are accepted by the FPL API.
const CLIENT_ID = "bfcbaf69-aade-4c1b-8f00-c1cb8a193030";
export const REDIRECT_URI = "https://fantasy.premierleague.com/";
const SCOPE = "openid profile email offline_access p1:update:user consent interest";

// Two entries, because a keychain value should stay small and tokens are long.
const STORAGE_REFRESH = "profpl_session_refresh";
const STORAGE_ACCESS = "profpl_session_access";
// Renew this long before the access token actually expires.
const RENEW_MARGIN_MS = 120_000;
const REQUEST_TIMEOUT_MS = 20_000;

type Session = {
  accessToken: string;
  refreshToken: string;
  // Epoch milliseconds.
  expiresAt: number;
};

export type PendingSignIn = { url: string; state: string; verifier: string };

// The refresh token was rejected: the user really has to sign in again.
export class SessionExpiredError extends Error {
  constructor() {
    super("FPL session expired");
    this.name = "SessionExpiredError";
  }
}

let session: Session | null = null;
let loaded = false;
let refreshing: Promise<string> | null = null;

// --- PKCE helpers ----------------------------------------------------------

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64Url(bytes: number[]) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64URL[a >> 2];
    out += B64URL[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) out += B64URL[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) out += B64URL[c & 63];
  }
  return out;
}

function randomString(length: number) {
  const bytes = new Uint8Array(length);
  const secure = (globalThis as any).crypto?.getRandomValues;
  if (typeof secure === "function") {
    (globalThis as any).crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < length; i += 1) out += B64URL[bytes[i] & 63];
  return out;
}

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

// SHA-256 of an ASCII string, as bytes. Small and dependency-free: PKCE needs
// one hash per sign-in and a native crypto module would force a new app build.
export function sha256(text: string) {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) bytes.push(text.charCodeAt(i) & 0xff);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i -= 1) bytes.push(i >= 4 ? 0 : (bitLength >>> (i * 8)) & 0xff);

  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const w = new Array<number>(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = offset + i * 4;
      w[i] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3];
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + K[i] + w[i]) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + hh) | 0;
  }
  const out: number[] = [];
  h.forEach((word) => {
    out.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
  });
  return out;
}

export function pkceChallenge(verifier: string) {
  return base64Url(sha256(verifier));
}

// --- Storage ---------------------------------------------------------------

const KEYCHAIN = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

async function persist(next: Session | null) {
  session = next;
  loaded = true;
  try {
    if (next) {
      await SecureStore.setItemAsync(
        STORAGE_REFRESH,
        JSON.stringify({ refreshToken: next.refreshToken, expiresAt: next.expiresAt }),
        KEYCHAIN,
      );
      await SecureStore.setItemAsync(STORAGE_ACCESS, next.accessToken, KEYCHAIN);
    } else {
      await SecureStore.deleteItemAsync(STORAGE_REFRESH);
      await SecureStore.deleteItemAsync(STORAGE_ACCESS);
    }
  } catch {}
}

async function load() {
  if (loaded) return session;
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_REFRESH);
    if (stored) {
      const parsed = JSON.parse(stored);
      const accessToken = (await SecureStore.getItemAsync(STORAGE_ACCESS)) || "";
      if (parsed?.refreshToken) {
        session = {
          refreshToken: parsed.refreshToken,
          accessToken,
          // Without the access token, force a renewal on first use.
          expiresAt: accessToken ? Number(parsed.expiresAt) || 0 : 0,
        };
      }
    }
  } catch {}
  loaded = true;
  return session;
}

// --- Token endpoint --------------------------------------------------------

async function tokenRequest(params: Record<string, string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const body = Object.entries({ ...params, client_id: CLIENT_ID })
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
    const response = await fetch(`${AUTHORITY}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    const json: any = await response.json().catch(() => null);
    return { status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function toSession(json: any, previousRefreshToken = ""): Session | null {
  if (!json?.access_token) return null;
  const refreshToken = json.refresh_token || previousRefreshToken;
  if (!refreshToken) return null;
  return {
    accessToken: json.access_token,
    refreshToken,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  };
}

// --- Public API ------------------------------------------------------------

export async function hasSession() {
  return Boolean(await load());
}

// Start a sign-in: the returned URL is the official login page.
export function beginSignIn(): PendingSignIn {
  const verifier = randomString(64);
  const state = randomString(24);
  const query = [
    ["response_type", "code"],
    ["client_id", CLIENT_ID],
    ["redirect_uri", REDIRECT_URI],
    ["scope", SCOPE],
    ["state", state],
    ["code_challenge", pkceChallenge(verifier)],
    ["code_challenge_method", "S256"],
    // Always ask for credentials, so logging out really allows a different
    // account to sign in.
    ["prompt", "login"],
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return { url: `${AUTHORITY}/authorize?${query}`, state, verifier };
}

// True for the redirect that ends a sign-in started with `beginSignIn`.
export function isSignInRedirect(url: string) {
  return url.startsWith(REDIRECT_URI) && /[?&](code|error)=/.test(url);
}

function queryParam(url: string, name: string) {
  const match = url.match(new RegExp(`[?&]${name}=([^&#]*)`));
  return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
}

// Finish a sign-in from the redirect URL. Throws with a user-facing message.
export async function completeSignIn(redirectUrl: string, pending: PendingSignIn) {
  const error = queryParam(redirectUrl, "error");
  if (error) {
    throw new Error(
      error === "access_denied"
        ? "Sign in was cancelled."
        : "FPL could not sign you in. Please try again.",
    );
  }
  const code = queryParam(redirectUrl, "code");
  if (!code || queryParam(redirectUrl, "state") !== pending.state) {
    throw new Error("Sign in could not be verified. Please try again.");
  }
  let result;
  try {
    result = await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: pending.verifier,
    });
  } catch {
    throw new Error("Couldn't reach FPL to finish signing in. Check your connection and try again.");
  }
  const next = toSession(result.json);
  if (!next) throw new Error("FPL could not sign you in. Please try again.");
  await persist(next);
}

// A valid access token, renewed if needed. Returns null when nobody is signed
// in, throws SessionExpiredError when the session can no longer be renewed,
// and any other error when the renewal failed for network reasons.
// `force` renews even a token that still looks valid: used when FPL has
// just refused it, which happens if FPL ends a token early.
export async function getAccessToken(
  options: { force?: boolean } = {},
): Promise<string | null> {
  const current = await load();
  if (!current) return null;
  if (
    !options.force &&
    current.accessToken &&
    current.expiresAt - Date.now() > RENEW_MARGIN_MS
  ) {
    return current.accessToken;
  }
  // One renewal at a time: refresh tokens may be single-use.
  if (!refreshing) {
    refreshing = (async () => {
      const result = await tokenRequest({
        grant_type: "refresh_token",
        refresh_token: current.refreshToken,
      });
      const next = toSession(result.json, current.refreshToken);
      if (next) {
        await persist(next);
        return next.accessToken;
      }
      // Only an explicit rejection ends the session; a server hiccup does not.
      if (result.status === 400 || result.status === 401) {
        if (result.json?.error === "invalid_grant" || result.json?.error === "invalid_client") {
          await persist(null);
          throw new SessionExpiredError();
        }
      }
      throw new Error("Token renewal failed");
    })().finally(() => {
      refreshing = null;
    });
  }
  try {
    return await refreshing;
  } catch (error) {
    if (error instanceof SessionExpiredError) throw error;
    // Offline or FPL is down: the current token may still have time left
    // (not when forced: FPL has just refused that token).
    if (!options.force && current.accessToken && current.expiresAt > Date.now()) {
      return current.accessToken;
    }
    throw error;
  }
}

// Forget the session on this device and, best effort, revoke it at FPL.
export async function signOut() {
  const current = await load();
  await persist(null);
  if (!current) return;
  tokenRevoke(current.refreshToken).catch(() => {});
}

async function tokenRevoke(token: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    await fetch(`${AUTHORITY}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `token=${encodeURIComponent(token)}&token_type_hint=refresh_token&client_id=${CLIENT_ID}`,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Wraps a script for the FPL WebView so its `fetch` calls carry the access
// token. It uses a clean `fetch` taken from a hidden frame: the FPL page
// replaces `window.fetch` with one that wipes its session and reloads the
// page whenever any API call answers 401/403.
export function withAuth(script: string, accessToken: string | null) {
  return `
(function () {
  var token = ${JSON.stringify(accessToken || "")};
  var native = window.__profplFetch;
  if (!native) {
    try {
      var frame = document.createElement("iframe");
      frame.style.display = "none";
      document.documentElement.appendChild(frame);
      native = frame.contentWindow.fetch.bind(frame.contentWindow);
    } catch (e) {
      native = window.fetch.bind(window);
    }
    window.__profplFetch = native;
  }
  var fetch = function (url, options) {
    var next = Object.assign({}, options || {});
    var target = String(url && url.url ? url.url : url);
    if (token && /^(https:\\/\\/fantasy\\.premierleague\\.com)?\\/api\\//.test(target)) {
      next.headers = Object.assign({}, next.headers || {}, {
        "X-API-Authorization": "Bearer " + token,
      });
    }
    return native(url, next);
  };
  ${script}
})();
true;
`;
}
