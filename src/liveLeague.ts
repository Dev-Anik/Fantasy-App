// Live mini-league: every manager on a league page scored live, with the same
// engine as the points page (auto-subs, armband; confirmed bonus only), and
// re-ranked. Reads FPL's public data directly, like My season.
//
// Totals: FPL's league tables update late during a gameweek, so the live
// total comes from each manager's own record instead: the season total
// before this gameweek (with any hit already taken off) plus the live score.
import { computeLive } from "./live";
import type { LiveFixture, LeagueStanding, MemberPick } from "./fpl";
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

export type LiveLeague = { event: number; entries: LiveEntry[]; updatedAt: number };

// The live table for these league rows (plus the signed-in manager, so the
// comparison works even when they're on another page).
// The last live table per league page, and the one being worked out: the
// league page reads it before opening (so it opens complete), and the table
// then starts from it instead of working it out again.
const liveTables = new Map<string, LiveLeague>();
const liveTablesPending = new Map<string, Promise<LiveLeague>>();

export function liveLeagueKey(rows: LeagueStanding[], event: number, extraEntry?: number) {
  return `${event}:${extraEntry ?? ""}:${rows.map((row) => row.entry).join(",")}`;
}

export function peekLiveLeague(key: string): LiveLeague | null {
  return liveTables.get(key) ?? null;
}

export function loadLiveLeague(
  rows: LeagueStanding[],
  event: number,
  extra?: { entry: number; teamName: string; managerName: string },
): Promise<LiveLeague> {
  const key = liveLeagueKey(rows, event, extra?.entry);
  let pending = liveTablesPending.get(key);
  if (!pending) {
    pending = workOutLiveLeague(rows, event, extra).then((table) => {
      liveTables.set(key, table);
      return table;
    });
    const clear = () => {
      if (liveTablesPending.get(key) === pending) liveTablesPending.delete(key);
    };
    pending.then(clear, clear);
    liveTablesPending.set(key, pending);
  }
  return pending;
}

async function workOutLiveLeague(
  rows: LeagueStanding[],
  event: number,
  extra?: { entry: number; teamName: string; managerName: string },
): Promise<LiveLeague> {
  const people = rows.map((row) => ({
    entry: row.entry,
    teamName: row.entry_name || row.player_name,
    managerName: row.player_name,
    officialRank: row.rank,
    lastRank: row.last_rank ?? 0,
  }));
  if (extra && !people.some((person) => person.entry === extra.entry)) {
    people.push({ ...extra, officialRank: 0, lastRank: 0 });
  }

  const { info, stats, fixtures } = await loadEventData(event);

  const scored = await inBatches(people, 6, async (person) => {
    const score = await scoreEntry(person.entry, event, info, stats, fixtures);
    return score ? ({ ...person, liveRank: 0, ...score } satisfies LiveEntry) : null;
  });

  const entries = scored.filter((entry): entry is LiveEntry => entry !== null);
  // Live ranks among the league's teams (the extra manager, if not in these
  // rows, isn't ranked).
  const ranked = entries
    .filter((entry) => entry.officialRank > 0)
    .sort((a, b) => b.liveTotal - a.liveTotal || a.officialRank - b.officialRank);
  // Teams level on live points share a rank (1, 2, 2, 4) and keep FPL's
  // order between them. (FPL's own tie-breaks only apply once it updates its
  // table; the official Standings show those.)
  ranked.forEach((entry, index) => {
    const previous = ranked[index - 1];
    entry.liveRank = previous && previous.liveTotal === entry.liveTotal ? previous.liveRank : index + 1;
  });
  // A page further down the table starts at its first official rank.
  const offset = rows.length ? Math.max(0, Math.min(...rows.map((row) => row.rank)) - 1) : 0;
  ranked.forEach((entry) => {
    entry.liveRank += offset;
  });
  return { event, entries, updatedAt: Date.now() };
}

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

// What separates two teams this gameweek: for each player, how many more
// times he counts for one side than the other (owned by only one of them,
// or captained by only one), with the live points that difference is worth.
export function differentials(mine: LiveEntry, theirs: LiveEntry) {
  const points = (player: LivePlayer) => player.points * player.multiplier;
  const myMultiplier = new Map(mine.counted.map((player) => [player.id, player.multiplier]));
  const theirMultiplier = new Map(theirs.counted.map((player) => [player.id, player.multiplier]));
  // `multiplier` here is the difference: 1 for a player only one side has
  // (2 if captained), 1 for the extra armband on a player both have.
  const edge = (side: LivePlayer[], other: Map<number, number>) =>
    side
      .map((player) => ({ ...player, multiplier: player.multiplier - (other.get(player.id) ?? 0) }))
      .filter((player) => player.multiplier > 0)
      .sort((a, b) => points(b) - points(a));
  return {
    onlyThem: edge(theirs.counted, myMultiplier),
    onlyMe: edge(mine.counted, theirMultiplier),
    points,
    // Both own him, so only the armband differs.
    armbandOnly: (player: LivePlayer, side: "them" | "me") =>
      (side === "them" ? myMultiplier : theirMultiplier).has(player.id),
  };
}
