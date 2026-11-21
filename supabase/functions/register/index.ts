// The app signs a phone up for live alerts, changes its choices, or stops
// them (on log out).
//
//   POST { token, entry, platform, settings }   sign up / update
//   POST { token, remove: true }                stop (log out)
//
// `token` is the phone's Expo push token; `entry` its FPL team ID. Nothing
// else about the user is sent or kept.
import { adminClient, isAppCaller, json } from "../_shared/auth.ts";

const TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{8,200}\]$/;
const SETTING_KEYS = ["started", "goals", "cards", "fulltime", "bench"] as const;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!isAppCaller(req)) return json({ error: "Not allowed." }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected JSON." }, 400);
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!TOKEN.test(token)) return json({ error: "Invalid push token." }, 400);

  const db = adminClient();

  if (body.remove === true) {
    const { error } = await db.from("alert_devices").delete().eq("token", token);
    return error ? json({ error: "Could not remove." }, 500) : json({ ok: true, removed: true });
  }

  const entry = Number(body.entry);
  if (!Number.isInteger(entry) || entry < 1 || entry > 50_000_000) {
    return json({ error: "Invalid team ID." }, 400);
  }
  const platform = body.platform === "ios" ? "ios" : "android";
  // Only known on/off choices are kept.
  const raw = (body.settings && typeof body.settings === "object" ? body.settings : {}) as Record<string, unknown>;
  const settings: Record<string, boolean> = {};
  for (const key of SETTING_KEYS) {
    if (typeof raw[key] === "boolean") settings[key] = raw[key] as boolean;
  }

  const { error } = await db.from("alert_devices").upsert(
    { token, entry, platform, settings, updated_at: new Date().toISOString() },
    { onConflict: "token" },
  );
  return error ? json({ error: "Could not save." }, 500) : json({ ok: true });
});
