// League data read straight from FPL with the access token, like the squad
// (squadDirect.ts), instead of through the hidden FPL web page. That page can
// be moved off the FPL site (the site sends signed-in visitors to the account
// page now and then), and its requests then fail as if offline: "Couldn't
// reach FPL" with a perfectly good connection. Only reading is done here;
// creating and joining leagues still go through the page (they need its
// cookies). Any failure throws, and the caller falls back to the page.
import type { FplLeague, H2hMatch } from "./fpl";
import { getAccessToken } from "./auth";

const API = "https://fantasy.premierleague.com/api/";
const TIMEOUT_MS = 15_000;

async function getJson(path: string, token: string | null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API + path, {
      cache: "no-store",
      headers: token ? { "X-API-Authorization": `Bearer ${token}` } : undefined,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`FPL returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export type DirectLeagueAction =
  | { action: "leagues"; entry: number }
  | { action: "standings"; league: FplLeague; page: number; silent?: boolean }
  | { action: "h2h-matches"; leagueId: number; event: number; silent?: boolean }
  | { action: "invite-code"; leagueId: number };

// The same message the web page would have sent for this action.
export async function runLeagueActionDirect(action: DirectLeagueAction, token: string | null) {
  if (action.action === "leagues") {
    const entryData = await getJson(`entry/${action.entry}/`, token);
    const source = entryData?.leagues ?? {};
    return {
      leagueAction: "leagues",
      entry: action.entry,
      summary: {
        totalPoints: entryData.summary_overall_points || 0,
        overallRank: entryData.summary_overall_rank || null,
        eventPoints: entryData.summary_event_points == null ? null : entryData.summary_event_points,
        eventId: entryData.current_event || null,
      },
      leagues: [
        ...(source.classic ?? []).map((league: object) => ({ ...league, kind: "classic" })),
        ...(source.h2h ?? []).map((league: object) => ({ ...league, kind: "h2h" })),
      ],
    };
  }

  if (action.action === "standings") {
    const kind = action.league.kind === "classic" ? "leagues-classic" : "leagues-h2h";
    const data = await getJson(`${kind}/${action.league.id}/standings/?page_standings=${action.page}`, token);
    return {
      leagueAction: "standings",
      leagueId: action.league.id,
      kind: action.league.kind,
      page: action.page,
      silent: !!action.silent,
      data,
    };
  }

  if (action.action === "h2h-matches") {
    // Big leagues split a gameweek's fixtures across pages; read them all.
    const results: unknown[] = [];
    for (let page = 1; page <= 20; page++) {
      const data = await getJson(
        `leagues-h2h-matches/league/${action.leagueId}/?event=${action.event}&page=${page}`,
        token,
      );
      results.push(...(data?.results ?? []));
      if (!data?.has_next) break;
    }
    return {
      leagueAction: "h2h-matches",
      leagueId: action.leagueId,
      event: action.event,
      silent: !!action.silent,
      results,
    };
  }

  const result = await getJson(`league/${action.leagueId}/code/`, token);
  if (!result?.code) throw new Error("No invite code");
  return { leagueAction: "invite-code", leagueId: action.leagueId, inviteCode: result.code };
}

// --- Cups ---------------------------------------------------------------------
// A classic league's cup is a knockout run as a head-to-head league of its own
// (its id: the league's cup_league, once FPL has drawn the cup). The FPL Cup
// comes with the manager's own entry. These read with the access token like
// the rest of this file, renewing it if needed; they throw on any failure.

async function cupToken() {
  return getAccessToken().catch(() => null);
}

// The cup's first round (gameweek) and name.
export async function loadCupLeague(cupLeagueId: number): Promise<{ startEvent: number; name: string }> {
  const data = await getJson(`leagues-h2h/${cupLeagueId}/standings/?page_standings=1`, await cupToken());
  return { startEvent: Number(data?.league?.start_event) || 1, name: String(data?.league?.name ?? "") };
}

// One round's matches (all pages).
export async function loadCupMatches(cupLeagueId: number, event: number): Promise<H2hMatch[]> {
  const token = await cupToken();
  const results: H2hMatch[] = [];
  for (let page = 1; page <= 20; page++) {
    const data = await getJson(`leagues-h2h-matches/league/${cupLeagueId}/?event=${event}&page=${page}`, token);
    results.push(...(data?.results ?? []));
    if (!data?.has_next) break;
  }
  return results;
}

export type FplCup = {
  matches: H2hMatch[];
  // FPL's qualification details; all null until the cup is under way.
  qualificationEvent: number | null;
  qualificationState: string | null;
  qualificationRank: number | null;
};

// The manager's FPL Cup: their matches so far, and how qualifying went.
// The last answer per team, so the Leagues page draws its cup card at once
// (it is read ahead, once Home is up).
const lastCup = new Map<number, FplCup>();

export function peekFplCup(entry: number): FplCup | null {
  return lastCup.get(entry) ?? null;
}

export async function loadFplCup(entry: number): Promise<FplCup> {
  const data = await getJson(`entry/${entry}/`, await cupToken());
  const cup = data?.leagues?.cup ?? {};
  const status = cup.status ?? {};
  const result: FplCup = {
    matches: Array.isArray(cup.matches) ? cup.matches : [],
    qualificationEvent: status.qualification_event ?? null,
    qualificationState: status.qualification_state ?? null,
    qualificationRank: status.qualification_rank ?? null,
  };
  lastCup.set(entry, result);
  return result;
}
