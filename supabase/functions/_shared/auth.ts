// Shared by the Edge Functions: the admin database client, and checks on the
// key a caller sends.
//
// Supabase's current keys: publishable (sb_publishable_..., safe in the app)
// and secret (sb_secret_..., server only). They are sent in the `apikey`
// header. With them, the platform's JWT check is off for these functions
// (see config.toml) and each function checks the key itself, as Supabase
// recommends.
import { createClient } from "npm:@supabase/supabase-js@2";

function keysFrom(name: string): string[] {
  try {
    const parsed = JSON.parse(Deno.env.get(name) ?? "{}");
    return Object.values(parsed).filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

const SECRET_KEYS = keysFrom("SUPABASE_SECRET_KEYS");
const PUBLISHABLE_KEYS = keysFrom("SUPABASE_PUBLISHABLE_KEYS");

// Compares without stopping at the first difference, so timing reveals
// nothing about a key.
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sentKey(req: Request) {
  const header = req.headers.get("apikey") ?? "";
  if (header) return header;
  const bearer = req.headers.get("authorization") ?? "";
  return bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
}

// Only our own scheduler (with the secret key) may run the worker.
export function isSecretCaller(req: Request) {
  const key = sentKey(req);
  return !!key && SECRET_KEYS.some((secret) => same(key, secret));
}

// The app calls with the publishable key (public, but it keeps out random
// traffic); the secret key works too, for testing.
export function isAppCaller(req: Request) {
  const key = sentKey(req);
  return !!key && [...PUBLISHABLE_KEYS, ...SECRET_KEYS].some((known) => same(key, known));
}

// Full access to the alert tables (Row Level Security has no policies).
export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = SECRET_KEYS[0] ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
