// Live head-to-head scores: managers scored live with the same engine as the
// points page (auto-subs, armband; confirmed bonus only), from FPL's public
// data, for head-to-head matches during a gameweek.
import { computeLive } from "./live";
import type { LiveFixture, MemberPick } from "./fpl";
import { loadFplBasics } from "./fplPublic";

const API = "https://fantasy.premierleague.com/api/";

async function getJson(path: string, fresh = false) {
  const response = await fetch(API + path, fresh ? { cache: "no-store" } : undefined);
  if (!response.ok) throw new Error(`FPL returned ${response.status}`);
  return response.json();
}

// Runs tasks a few at a time, so a 50-team page doesn't flood FPL.
async function inBatches<T, R>(items: T[], size: number, task: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(task))));
  }
  return results;
}

type RawPicks = {
  active_chip: string | null;
  entry_history: { points: number; total_points: number; event_transfers_cost: number };
  picks: { element: number; position: number; multiplier: number; is_captain: boolean; is_vice_captain: boolean }[];
};

// Picks don't change once a gameweek has started: fetched once each.
const picksCache = new Map<string, Promise<RawPicks | null>>();
function loadPicks(entry: number, event: number) {
  const key = `${entry}-${event}`;
  let cached = picksCache.get(key);
  if (!cached) {
    cached = fetch(`${API}entry/${entry}/event/${event}/picks/`).then(
      (response) => {
        // A manager who joined after this deadline has no picks: FPL says
        // so (404), and that answer is kept.
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`FPL returned ${response.status}`);
        return response.json() as Promise<RawPicks>;
      },
    );
    // Anything else (no signal, FPL busy) is not kept: this refresh leaves
    // the manager out, and the next one asks again.
    const attempt = cached.catch(() => {
      picksCache.delete(key);
      return null;
    });
    picksCache.set(key, attempt);
    return attempt;
  }
  return cached;
}

export type LivePlayer = { id: number; name: string; team: string; points: number; multiplier: number };

export type LiveEntry = {
  entry: number;
  teamName: string;
  managerName: string;
  officialRank: number;
  // Rank at the end of the last gameweek (0 if new): what the movement
  // arrow compares the live rank with, as FPL's own arrows do.
  lastRank: number;
  liveRank: number;
  // Gameweek score so far, before hits (as FPL shows it).
  gwPoints: number;
  hits: number;
  liveTotal: number;
  captain: string | null;
  chip: string | null;
  // Players in the counting eleven still to play.
  stillToPlay: number;
  // Who counts this gameweek (after auto-subs), with their points so far.
  counted: LivePlayer[];
};


// Live head-to-head scores: each team's gameweek points so far with any
// transfer hit taken off, as FPL counts a head-to-head match. FPL's own match
// scores only move every so often during a gameweek. Teams that couldn't be
// read are left out (the caller keeps FPL's number for them).
export type LiveScore = { points: number; stillToPlay: number };
export async function loadLiveScores(entries: number[], event: number): Promise<Map<number, LiveScore>> {
  const { info, stats, fixtures } = await loadEventData(event);
  const scores = new Map<number, LiveScore>();
  await inBatches([...new Set(entries)], 6, async (entry) => {
    const score = await scoreEntry(entry, event, info, stats, fixtures);
    if (score) scores.set(entry, { points: score.gwPoints - score.hits, stillToPlay: score.stillToPlay });
  });
  return scores;
}

type PlayerStats = { total_points: number; minutes: number; bonus: number };
type PlayerInfoMap = Awaited<ReturnType<typeof loadFplBasics>>["players"];

// The gameweek's live player numbers and matches, shared by every team scored.
async function loadEventData(event: number) {
  const [info, live, fixturesRaw] = await Promise.all([
    loadFplBasics().then((basics) => basics.players),
    getJson(`event/${event}/live/`, true),
    getJson(`fixtures/?event=${event}`, true),
  ]);
  const stats = new Map<number, PlayerStats>(
    (live.elements ?? []).map((e: { id: number; stats: PlayerStats }) => [e.id, e.stats]),
  );
  const fixtures: LiveFixture[] = (fixturesRaw ?? []).map(
    (f: {
      id: number;
      team_h: number;
      team_a: number;
      started: boolean;
      finished: boolean;
      finished_provisional: boolean;
      stats?: { identifier: string; h: { element: number; value: number }[]; a: { element: number; value: number }[] }[];
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
  return { info, stats, fixtures };
}

// One team scored live with the points page's engine.
async function scoreEntry(
  entry: number,
  event: number,
  info: PlayerInfoMap,
  stats: Map<number, PlayerStats>,
  fixtures: LiveFixture[],
) {
  const raw = await loadPicks(entry, event);
  if (!raw) return null;
  const picks: MemberPick[] = raw.picks.map((pick) => {
    const player = info.get(pick.element);
    const stat = stats.get(pick.element);
    return {
      id: pick.element,
      position: pick.position,
      name: player?.name ?? "?",
      team: player?.team ?? "",
      teamId: player?.teamId ?? 0,
      elementType: player?.type ?? 0,
      captain: pick.is_captain,
      viceCaptain: pick.is_vice_captain,
      multiplier: pick.multiplier,
      points: stat?.total_points ?? 0,
      minutes: stat?.minutes ?? 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      bonus: stat?.bonus ?? 0,
    };
  });
  const result = computeLive(picks, fixtures, raw.active_chip);
  const history = raw.entry_history;
  const counted = result.picks
    .filter((pick) => pick.effectiveMultiplier > 0)
    .map((pick) => ({
      id: pick.id,
      name: pick.name,
      team: pick.team,
      points: pick.livePoints,
      multiplier: pick.effectiveMultiplier,
    }));
  const captain = result.picks.find((pick) => pick.effectiveMultiplier >= 2);
  return {
    gwPoints: result.total,
    hits: history.event_transfers_cost ?? 0,
    // Season total before this gameweek, hits already off, plus live points.
    liveTotal: history.total_points - history.points + result.total,
    captain: captain?.name ?? null,
    chip: raw.active_chip,
    stillToPlay: result.stillToPlay,
    counted,
  };
}

