// A team's gameweek (picks, live points, matches) read straight from FPL's
// public data, without the hidden web page: much quicker, and the large player
// list is shared with the rest of the app (fplPublic.ts) instead of being read
// again for every page. Throws on anything unexpected; the caller then uses the
// web page route, which also explains private or missing picks.
import type { LiveFixture, MemberPick, MemberSquad } from "./fpl";
import { loadFplBasics } from "./fplPublic";

const API = "https://fantasy.premierleague.com/api/";
const TIMEOUT_MS = 12_000;

async function getJson(path: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API + path, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`FPL returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

type Stats = {
  total_points?: number;
  minutes?: number;
  goals_scored?: number;
  assists?: number;
  clean_sheets?: number;
  bonus?: number;
};

export async function loadManagerGameweekDirect(entry: number, event: number): Promise<MemberSquad> {
  const [basics, live, fixturesRaw, squad] = await Promise.all([
    loadFplBasics(),
    getJson(`event/${event}/live/`),
    getJson(`fixtures/?event=${event}`),
    getJson(`entry/${entry}/event/${event}/picks/`),
  ]);
  const stats = new Map<number, Stats>(
    (live?.elements ?? []).map((element: { id: number; stats: Stats }) => [element.id, element.stats]),
  );
  if (!Array.isArray(squad?.picks)) throw new Error("No picks");

  const picks: MemberPick[] = squad.picks.map(
    (pick: { element: number; position: number; multiplier: number; is_captain: boolean; is_vice_captain: boolean }) => {
      const player = basics.players.get(pick.element);
      const stat = stats.get(pick.element);
      // Same rule as the web page route: anything missing means try that.
      if (!player || !stat) throw new Error(`No data for player ${pick.element}`);
      const form = player.form;
      return {
        id: pick.element,
        position: pick.position,
        name: player.name,
        team: player.team,
        teamId: player.teamId,
        elementType: player.type,
        captain: pick.is_captain,
        viceCaptain: pick.is_vice_captain,
        multiplier: pick.multiplier,
        points: stat.total_points ?? 0,
        minutes: stat.minutes ?? 0,
        goals: stat.goals_scored ?? 0,
        assists: stat.assists ?? 0,
        cleanSheets: stat.clean_sheets ?? 0,
        bonus: stat.bonus ?? 0,
        formMood: Number.isFinite(form) ? (form >= 6 ? "good" : form <= 2 ? "bad" : undefined) : undefined,
      } satisfies MemberPick;
    },
  );

  const fixtures: LiveFixture[] = (fixturesRaw ?? []).map(
    (f: {
      id: number;
      team_h: number;
      team_a: number;
      started: boolean;
      finished: boolean;
      finished_provisional: boolean;
      stats?: { identifier: string; h?: { element: number; value: number }[]; a?: { element: number; value: number }[] }[];
    }) => {
      const bps = (f.stats ?? []).find((stat) => stat.identifier === "bps");
      return {
        id: f.id,
        teamH: f.team_h,
        teamA: f.team_a,
        started: !!f.started,
        finished: !!f.finished,
        finishedProvisional: !!f.finished_provisional,
        bps: bps ? [...(bps.h ?? []), ...(bps.a ?? [])].map((row) => ({ element: row.element, value: row.value })) : [],
      };
    },
  );

  const history = squad.entry_history ?? null;
  return {
    entry,
    event,
    chip: squad.active_chip || null,
    fixtures,
    history: {
      points: history?.points ?? null,
      totalPoints: history?.total_points ?? null,
      rank: history?.rank ?? null,
      overallRank: history?.overall_rank ?? null,
      bank: history?.bank ?? null,
      value: history?.value ?? null,
      transfers: history?.event_transfers ?? null,
      transferCost: history?.event_transfers_cost ?? null,
      pointsOnBench: history?.points_on_bench ?? null,
    },
    picks,
  };
}
