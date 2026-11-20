// Loads the signed-in user's team straight from FPL with the app's own
// network stack, using the sign-in token. This is the main route; the hidden
// FPL web page (buildFetchJs in fpl.ts) is only the fallback.
//
// Why: the web page route only works once the FPL website has fully loaded
// inside the hidden WebView. On a slow connection, or while the site is busy,
// a request sent too early is blocked by the browser and looks like "no
// internet", so signing in could fail although nothing was wrong. Requests
// made here don't depend on any page.
//
// The result has exactly the shape of the web page script's message, so the
// app handles both the same way. It must stay in step with buildFetchJs.
import type { Squad } from "./fpl";

const API = "https://fantasy.premierleague.com/api/";
// Kept short enough that, if this route hangs, the fallback still has time.
const TIMEOUT_MS = 15_000;
const SIGN_IN_CHECK_TIMEOUT_MS = 10_000;

export type DirectSquadResult =
  | { ok: true; squad: Squad }
  // Anything else: the caller falls back to the web page route, which has its
  // own handling for sign-in refusals, outages and missing teams.
  | { ok: false; reason: string };

async function getJson(path: string, token: string, timeout = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(API + path, {
      headers: { "X-API-Authorization": `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${path} -> ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const moodFor = (value: unknown): "good" | "bad" | undefined => {
  const form = typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  return Number.isFinite(form) ? (form >= 6 ? "good" : form <= 2 ? "bad" : undefined) : undefined;
};

const numberOrNull = (value: unknown) =>
  value == null || value === "" ? null : Number(value);

export async function loadSquadDirect(token: string): Promise<DirectSquadResult> {
  try {
    const me = await getJson("me/", token, SIGN_IN_CHECK_TIMEOUT_MS);
    const entry = me?.player?.entry;
    // Not accepted, or no team yet: the web page route decides what that means.
    if (!entry) return { ok: false, reason: "no entry" };

    const [bs, d, fixtures, entryData] = await Promise.all([
      getJson("bootstrap-static/", token),
      getJson(`my-team/${entry}/`, token),
      getJson("fixtures/", token),
      getJson(`entry/${entry}/`, token),
    ]);
    if (!bs?.events?.length || !Array.isArray(d?.picks) || !Array.isArray(fixtures) || !entryData) {
      return { ok: false, reason: "unexpected answer" };
    }

    const currentEvent = bs.events.find((e: any) => e.is_current && !e.finished);
    const nextEvent = bs.events.find((e: any) => e.is_next && !e.finished);
    const activeEvent = currentEvent || nextEvent || bs.events.find((e: any) => !e.finished) || bs.events[0];
    const nextGameweek = nextEvent || activeEvent;
    const leagues = [
      ...(entryData.leagues?.classic || []).map((l: any) => ({ ...l, kind: "classic" })),
      ...(entryData.leagues?.h2h || []).map((l: any) => ({ ...l, kind: "h2h" })),
    ];
    const gameweeks = bs.events.map((e: any) => ({
      id: e.id,
      name: e.name,
      finished: e.finished,
      isCurrent: Boolean(e.is_current),
      isNext: Boolean(e.is_next),
      deadlineTime:
        e.deadline_time || (e.deadline_time_epoch ? new Date(e.deadline_time_epoch * 1000).toISOString() : null),
      averageScore: typeof e.average_entry_score === "number" ? e.average_entry_score : null,
      highestScore: typeof e.highest_score === "number" ? e.highest_score : null,
      highestEntry: typeof e.highest_scoring_entry === "number" ? e.highest_scoring_entry : null,
    }));
    const players: Record<number, any> = {};
    bs.elements.forEach((p: any) => {
      players[p.id] = p;
    });
    const teams: Record<number, string> = {};
    bs.teams.forEach((t: any) => {
      teams[t.id] = t.short_name;
    });

    const fixturesByTeam: Record<number, any[]> = {};
    const fixturesFor = (teamId: number) => {
      if (!fixturesByTeam[teamId]) {
        fixturesByTeam[teamId] = fixtures
          .filter((f: any) => f.event != null && (f.team_h === teamId || f.team_a === teamId))
          .sort((a: any, b: any) => a.event - b.event || a.id - b.id)
          .map((f: any) => {
            const isHome = f.team_h === teamId;
            const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
            return {
              event: f.event,
              opponent: teams[isHome ? f.team_a : f.team_h] || "",
              venue: isHome ? "H" : "A",
              difficulty: difficulty <= 2 ? "easy" : difficulty === 3 ? "average" : "hard",
              fdr: difficulty,
              started: f.started ?? false,
              finished: f.finished ?? false,
            };
          });
      }
      return fixturesByTeam[teamId];
    };
    bs.teams.forEach((team: any) => fixturesFor(team.id));

    // A pick FPL lists but the player list lacks would break the screen: let
    // the fallback route deal with such an odd answer.
    if (d.picks.some((p: any) => !players[p.element])) return { ok: false, reason: "unknown player" };

    const picks = d.picks.map((p: any) => {
      const player = players[p.element];
      return {
        id: p.element,
        pos: p.position,
        name: player.web_name,
        team: teams[player.team],
        teamId: player.team,
        type: player.element_type,
        cap: p.is_captain,
        vice: p.is_vice_captain,
        sell: p.selling_price,
        buy: p.purchase_price,
        price: player.now_cost,
        form: player.form,
        ownership: player.selected_by_percent,
        priceChange: player.cost_change_event,
        displayPoints: player.event_points ?? null,
        formMood: moodFor(player.form),
        status: player.status,
        chance: player.chance_of_playing_next_round,
        news: player.news || "",
        fixtures: fixturesFor(player.team),
        epNext: numberOrNull(player.ep_next),
        totalPoints: player.total_points,
        ppg: numberOrNull(player.points_per_game),
        xgi90: numberOrNull(player.expected_goal_involvements_per_90),
      };
    });

    const pool = bs.elements.map((p: any) => ({
      id: p.id,
      name: p.web_name,
      team: teams[p.team],
      teamId: p.team,
      type: p.element_type,
      cost: p.now_cost,
      pts: p.total_points,
      form: p.form,
      ownership: p.selected_by_percent,
      priceChange: p.cost_change_event,
      status: p.status,
      chance: p.chance_of_playing_next_round,
      news: p.news || "",
      formMood: moodFor(p.form),
      epNext: numberOrNull(p.ep_next),
      ppg: numberOrNull(p.points_per_game),
      xgi90: numberOrNull(p.expected_goal_involvements_per_90),
    }));

    const t = d.transfers || {};
    const chips: any[] = d.chips || [];
    const activeChip = chips.find((c) => c.status_for_entry === "active");
    const availableChips = chips.filter((c) => c.status_for_entry === "available").map((c) => c.name);
    const chipStatuses: Record<string, string> = {};
    chips.forEach((c) => {
      const currentStatus = chipStatuses[c.name];
      if (
        currentStatus !== "available" &&
        (c.status_for_entry === "available" ||
          (currentStatus !== "active" && c.status_for_entry === "active") ||
          (currentStatus !== "played" && c.status_for_entry === "played"))
      ) {
        chipStatuses[c.name] = c.status_for_entry;
      } else if (!currentStatus) {
        chipStatuses[c.name] = c.status_for_entry;
      }
    });

    return {
      ok: true,
      squad: {
        entry,
        teamName: entryData.name || "",
        managerName: entryData.player_name || "",
        totalPoints: entryData.summary_overall_points || 0,
        overallRank: entryData.summary_overall_rank || null,
        eventPoints: entryData.summary_event_points == null ? null : entryData.summary_event_points,
        eventId: entryData.current_event || null,
        gw: nextGameweek.id,
        currentGw: activeEvent.id,
        bank: t.bank,
        value: t.value,
        freeTransfers: t.limit == null ? null : Math.max(t.limit - (t.made || 0), 0),
        hitCost: t.cost == null ? 4 : t.cost,
        made: t.made || 0,
        chip: activeChip ? activeChip.name : null,
        availableChips,
        chipStatuses,
        picks,
        pool,
        fixturesByTeam,
        leagues,
        gameweeks,
      } as Squad,
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "failed" };
  }
}
