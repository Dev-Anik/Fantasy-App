// The match-day worker. Run every minute by pg_cron (see the schedule
// migration). Each run:
//   1. takes a lock, so two runs never overlap;
//   2. stops at once when no match is close (most of the week);
//   3. refreshes the gameweek and player names a few times a day;
//   4. after the deadline, fetches followed teams' picks, a few per run;
//   5. reads FPL's live data ONCE and compares it with the last run;
//   6. sends each phone one notification with what changed for its team;
//   7. saves the new state.
// The first look at a gameweek only records the state (no alerts), so
// nobody gets a burst of old news.
import { adminClient, isSecretCaller, json } from "../_shared/auth.ts";

const FPL = "https://fantasy.premierleague.com/api/";
const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";
const PICKS_PER_RUN = 60;
const LOCK_SECONDS = 55;

type Stats = { m: number; g: number; a: number; y: number; r: number; og: number; ps: number; pm: number; p: number };
type Pick = { e: number; m: number; p: number };
type Settings = { started: boolean; goals: boolean; cards: boolean; fulltime: boolean; bench: boolean };
const DEFAULT_SETTINGS: Settings = { started: true, goals: true, cards: true, fulltime: true, bench: false };

async function fpl(path: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(FPL + path, {
      headers: { "User-Agent": "Skippr live alerts" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`FPL ${response.status} for ${path}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function inBatches<T, R>(items: T[], size: number, task: (item: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(task))));
  return out;
}

const compact = (s: Record<string, number>): Stats => ({
  m: s.minutes ?? 0,
  g: s.goals_scored ?? 0,
  a: s.assists ?? 0,
  y: s.yellow_cards ?? 0,
  r: s.red_cards ?? 0,
  og: s.own_goals ?? 0,
  ps: s.penalties_saved ?? 0,
  pm: s.penalties_missed ?? 0,
  p: s.total_points ?? 0,
});

Deno.serve(async (req) => {
  if (!isSecretCaller(req)) return json({ error: "Not allowed." }, 401);
  const db = adminClient();
  const now = new Date();

  // 1. Lock (and the cheap idle check) in one step: only a run that finds
  // the row unlocked and not idle goes on.
  const { data: state } = await db
    .from("alert_state")
    .update({ locked_until: new Date(now.getTime() + LOCK_SECONDS * 1000).toISOString() })
    .eq("id", 1)
    .lt("locked_until", now.toISOString())
    .lt("idle_until", now.toISOString())
    .select()
    .maybeSingle();
  if (!state) return json({ ok: true, skipped: "locked or idle" });

  const release = (extra: Record<string, unknown> = {}) =>
    db.from("alert_state").update({ locked_until: "epoch", updated_at: new Date().toISOString(), ...extra }).eq("id", 1);

  try {
    // 3. Gameweek, deadline and names, a few times a day.
    let { event, deadline, players, teams } = state as {
      event: number | null;
      deadline: string | null;
      players: Record<string, [string, number, number]>;
      teams: Record<string, string>;
    };
    // Hourly, so a new gameweek is noticed well before its first kick-off.
    const stale = !state.players_at || now.getTime() - new Date(state.players_at).getTime() > 3600_000;
    const refreshed: Record<string, unknown> = {};
    if (stale || !event) {
      const bs = await fpl("bootstrap-static/");
      const current = bs.events.find((e: { is_current: boolean }) => e.is_current) ??
        bs.events.find((e: { is_next: boolean }) => e.is_next);
      players = {};
      for (const p of bs.elements) players[p.id] = [p.web_name, p.team, p.element_type];
      teams = {};
      for (const t of bs.teams) teams[t.id] = t.short_name;
      Object.assign(refreshed, { players, teams, players_at: now.toISOString() });
      if (current && current.id !== event) {
        // A new gameweek: start its record fresh (the first look is silent).
        event = current.id;
        deadline = current.deadline_time;
        Object.assign(refreshed, { event, deadline, live: {}, fixtures: {} });
        state.live = {};
        state.fixtures = {};
        // Earlier gameweeks' picks are no longer needed: keep only what the
        // alerts use.
        await db.from("alert_picks").delete().lt("event", event);
      }
    }
    if (!event) {
      await release(refreshed);
      return json({ ok: true, skipped: "no gameweek" });
    }

    // 4. Followed teams' picks for this gameweek (public, after the deadline),
    // a batch per run from the deadline on, so they're ready by kick-off.
    const { data: devices } = await db.from("alert_devices").select("token, entry, settings");
    const deviceList = (devices ?? []) as { token: string; entry: number; settings: Partial<Settings> }[];
    const entries = [...new Set(deviceList.map((d) => d.entry))];
    const { data: picksRows } = await db.from("alert_picks").select("entry, picks").eq("event", event);
    const picksByEntry = new Map<number, Pick[]>((picksRows ?? []).map((r: { entry: number; picks: Pick[] }) => [r.entry, r.picks]));
    const deadlinePassed = !!deadline && new Date(deadline) < now;
    let stillMissing = 0;
    if (deadlinePassed) {
      const allMissing = entries.filter((e) => !picksByEntry.has(e));
      const missing = allMissing.slice(0, PICKS_PER_RUN);
      stillMissing = allMissing.length - missing.length;
      const fetched = await inBatches(missing, 6, async (entry) => {
        try {
          const data = await fpl(`entry/${entry}/event/${event}/picks/`);
          const picks: Pick[] = (data.picks ?? []).map((p: { element: number; multiplier: number; position: number }) => ({
            e: p.element,
            m: p.multiplier,
            p: p.position,
          }));
          return { entry, event, picks, chip: data.active_chip ?? null };
        } catch {
          return null; // Tried again next run.
        }
      });
      const rows = fetched.filter((r): r is NonNullable<typeof r> => r !== null);
      if (rows.length) {
        await db.from("alert_picks").upsert(rows, { onConflict: "entry,event" });
        for (const r of rows) picksByEntry.set(r.entry, r.picks);
      }
      stillMissing += missing.length - rows.length;
    }

    // 2. Is anything close? Matches from 10 minutes before kick-off until
    // FPL marks them finished.
    const fixtures = await fpl(`fixtures/?event=${event}`);
    const soon = now.getTime() + 10 * 60_000;
    const active = fixtures.filter((f: { kickoff_time: string | null; finished_provisional: boolean }) =>
      f.kickoff_time && new Date(f.kickoff_time).getTime() <= soon && !f.finished_provisional
    );
    const prevFixtures = state.fixtures as Record<string, { s: boolean; f: boolean }>;
    const justFinished = fixtures.filter((f: { id: number; finished_provisional: boolean }) =>
      f.finished_provisional && prevFixtures[f.id] && !prevFixtures[f.id].f
    );
    // First look at this gameweek (nothing recorded yet): record silently.
    const firstLook = Object.keys(prevFixtures).length === 0;
    const nextFixtures: Record<string, { s: boolean; f: boolean }> = {};
    for (const f of fixtures) nextFixtures[f.id] = { s: !!f.started, f: !!f.finished_provisional };
    if (!active.length && !justFinished.length) {
      // Nothing on: sleep until 10 minutes before the next kick-off (at most
      // an hour), or just a minute while teams' picks are still being read.
      const nextKickoff = fixtures
        .map((f: { kickoff_time: string | null }) => (f.kickoff_time ? new Date(f.kickoff_time).getTime() : Infinity))
        .filter((t: number) => t > now.getTime())
        .sort((a: number, b: number) => a - b)[0] ?? Infinity;
      const wake = stillMissing > 0
        ? now.getTime() + 60_000
        : Math.min(nextKickoff - 10 * 60_000, now.getTime() + 3600_000);
      await release({
        ...refreshed,
        fixtures: nextFixtures,
        idle_until: new Date(Math.max(wake, now.getTime() + 60_000)).toISOString(),
      });
      return json({ ok: true, skipped: "no match close", picksStillMissing: stillMissing });
    }

    // 5. The live data, once for everyone, compared with the last run.
    const live = await fpl(`event/${event}/live/`);
    const prev = state.live as Record<string, Stats>;
    const next: Record<string, Stats> = {};
    const changed = new Map<number, { before: Stats | null; after: Stats }>();
    for (const element of live.elements ?? []) {
      const after = compact(element.stats ?? {});
      if (after.m === 0 && after.p === 0) continue; // Not played: not stored.
      next[element.id] = after;
      const before = prev[element.id] ?? null;
      if (!before || JSON.stringify(before) !== JSON.stringify(after)) changed.set(element.id, { before, after });
    }

    // 6. One notification per phone with what changed for its team.
    const messages: {
      to: string;
      title: string;
      body: string;
      sound: string;
      channelId: string;
      priority: "high";
      ttl: number;
      data: unknown;
    }[] = [];
    if (!firstLook) {
      const name = (id: number) => players[id]?.[0] ?? "A player";
      const scoreOf = (teamId: number) => {
        const f = fixtures.find((x: { team_h: number; team_a: number; started: boolean }) =>
          x.started && (x.team_h === teamId || x.team_a === teamId)
        );
        return f ? `${teams[f.team_h] ?? "?"} ${f.team_h_score ?? 0}–${f.team_a_score ?? 0} ${teams[f.team_a] ?? "?"}` : "";
      };
      for (const device of deviceList) {
        const picks = picksByEntry.get(device.entry);
        if (!picks) continue;
        const settings = { ...DEFAULT_SETTINGS, ...(device.settings ?? {}) };
        const lines: string[] = [];
        const startedNow: string[] = [];
        for (const pick of picks) {
          if (pick.m === 0 && !settings.bench) continue;
          const change = changed.get(pick.e);
          if (!change) continue;
          const b = change.before ?? { m: 0, g: 0, a: 0, y: 0, r: 0, og: 0, ps: 0, pm: 0, p: 0 };
          const a = change.after;
          const who = name(pick.e);
          const armband = pick.m >= 2 ? ` (C ×${pick.m})` : "";
          const pts = `${a.p * Math.max(1, pick.m)} pts`;
          if (settings.started && b.m === 0 && a.m > 0) startedNow.push(who);
          if (settings.goals && a.g > b.g) {
            const score = scoreOf(players[pick.e]?.[1] ?? 0);
            lines.push(`⚽ ${who} scored${armband} · ${pts}${score ? ` · ${score}` : ""}`);
          }
          if (settings.goals && a.a > b.a) lines.push(`🅰️ ${who} assist${armband} · ${pts}`);
          if (settings.goals && a.ps > b.ps) lines.push(`🧤 ${who} saved a penalty · ${pts}`);
          if (settings.cards && a.y > b.y) lines.push(`🟨 ${who} booked · ${pts}`);
          if (settings.cards && a.r > b.r) lines.push(`🟥 ${who} sent off · ${pts}`);
          if (settings.cards && a.og > b.og) lines.push(`😬 ${who} own goal · ${pts}`);
          if (settings.cards && a.pm > b.pm) lines.push(`❌ ${who} missed a penalty · ${pts}`);
        }
        if (startedNow.length) lines.unshift(`✅ Playing now: ${startedNow.join(", ")}`);
        // Full time: the team's players in each match that just ended.
        if (settings.fulltime) {
          for (const f of justFinished) {
            const own = picks.filter((pick) =>
              pick.m > 0 && [f.team_h, f.team_a].includes(players[pick.e]?.[1] ?? -1)
            );
            if (!own.length) continue;
            const summary = own
              .map((pick) => `${name(pick.e)} ${(next[pick.e]?.p ?? 0) * Math.max(1, pick.m)}`)
              .join(", ");
            lines.push(
              `🏁 FT ${teams[f.team_h] ?? "?"} ${f.team_h_score ?? 0}–${f.team_a_score ?? 0} ${teams[f.team_a] ?? "?"}: ${summary}`,
            );
          }
        }
        if (!lines.length) continue;
        messages.push({
          to: device.token,
          title: lines.length === 1 ? lines[0] : `${lines.length} updates for your team`,
          body: lines.length === 1 ? "Tap to see your live points" : lines.join("\n"),
          sound: "default",
          channelId: "live",
          // Without this Expo sends Android messages at normal priority,
          // which a sleeping phone (screen off, app closed) holds back until
          // it next wakes: the alerts only showed while the app was open.
          priority: "high",
          // A goal alert hours late is noise: drop it if the phone stays
          // unreachable for an hour.
          ttl: 3600,
          data: { screen: "points", event },
        });
      }
    }

    // Send (100 per request, as Expo allows). Phones that uninstalled the app
    // are removed.
    let sent = 0;
    const gone: string[] = [];
    const expoToken = Deno.env.get("EXPO_ACCESS_TOKEN");
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      try {
        const response = await fetch(EXPO_PUSH, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
          },
          body: JSON.stringify(batch),
        });
        const result = await response.json().catch(() => null);
        (result?.data ?? []).forEach((ticket: { status: string; details?: { error?: string } }, index: number) => {
          if (ticket.status === "ok") sent += 1;
          else if (ticket.details?.error === "DeviceNotRegistered") gone.push(batch[index].to);
        });
      } catch {
        // Expo unreachable: these alerts are skipped; the next run carries on.
      }
    }
    if (gone.length) await db.from("alert_devices").delete().in("token", gone);

    // 7. Save the new state and unlock.
    await release({ ...refreshed, live: next, fixtures: nextFixtures, idle_until: "epoch" });
    return json({ ok: true, event, changed: changed.size, messages: messages.length, sent, firstLook });
  } catch (error) {
    await release();
    return json({ ok: false, error: error instanceof Error ? error.message : "failed" }, 500);
  }
});
