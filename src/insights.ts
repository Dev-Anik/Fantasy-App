// "My season": a manager's season so far, what it says about their
// strengths and weak spots, and what to do next. Reads FPL's public endpoints
// directly (no sign-in needed) and turns them into figures, a squad review
// and plain-language advice.

const API = "https://fantasy.premierleague.com/api/";

export type GameweekSummary = {
  event: number;
  points: number;
  average: number | null;
  highest: number | null;
  rank: number | null;
  overallRank: number | null;
  benchPoints: number;
  hitCost: number;
  transfers: number;
  value: number;
  bank: number;
  chip: string | null;
  // Points the armband added, and the most it could have added with the
  // best scorer among the players who counted that week.
  captainName: string | null;
  captainBonus: number;
  bestCaptainName: string | null;
  bestCaptainBonus: number;
};

export type TransferSummary = {
  event: number;
  inName: string;
  outName: string;
  // Points of the player bought minus the player sold, in that gameweek.
  gain: number;
};

export type TransferVerdict = TransferSummary & {
  // In minus out over the move's week and the two after it.
  gain3: number;
  weeks: number;
};

export type Finding = { title: string; detail: string };

// A fixture ahead, from the player's point of view.
export type UpcomingFixture = {
  event: number;
  opponent: string;
  home: boolean;
  difficulty: "easy" | "average" | "hard";
};

// A player in the current squad, with a plain verdict.
export type SquadPlayer = {
  id: number;
  name: string;
  team: string;
  position: number;
  price: number;
  // Price change since the season started, in tenths of a million.
  priceChange: number;
  // Fell in price this gameweek.
  falling: boolean;
  form: number;
  totalPoints: number;
  // Points he has scored while in your team and counted (armband included).
  pointsForYou: number;
  starter: boolean;
  // Chance of playing next round (null: no doubt reported).
  chance: number | null;
  status: string;
  news: string;
  // FPL's expected points for the next gameweek.
  expected: number;
  fixtures: UpcomingFixture[];
  verdict: "sell" | "watch" | "keep";
  reason: string;
};

// One recommended step, most useful first.
export type Action = {
  kind: "transfer" | "captain" | "chip" | "lineup" | "money" | "habit";
  title: string;
  detail: string;
};

export type CaptainMiss = {
  event: number;
  captain: string;
  captainPoints: number;
  best: string;
  bestPoints: number;
};

export type SeasonInsights = {
  gameweeks: GameweekSummary[];
  totalPoints: number;
  overallRank: number | null;
  bestGw: GameweekSummary | null;
  worstGw: GameweekSummary | null;
  aboveAverage: number;
  averagePoints: number;
  averageOfAll: number | null;
  benchTotal: number;
  hitsTotal: number;
  transfersTotal: number;
  transferGain: number;
  transfers: TransferSummary[];
  captainTotal: number;
  bestCaptainTotal: number;
  // Points by position (1 GK .. 4 FWD), from players who counted.
  positionPoints: Record<number, number>;
  // FPL's team value includes the bank. The starting budget (£100.0m), the
  // total now, and the bank, all after the last gameweek played.
  valueStart: number | null;
  valueNow: number | null;
  bankNow: number | null;
  // Everyone who scored for you this season (counted, armband included),
  // sold players too, most points first.
  topScorers: { id: number; name: string; points: number; inSquad: boolean }[];
  chips: { name: string; event: number; points: number | null }[];
  strengths: Finding[];
  weaknesses: Finding[];
  // Everyone playing FPL this season, for "top X%".
  totalPlayers: number | null;
  // Overall rank change in the last gameweek (positive: climbed).
  rankMove: number | null;
  nextEvent: number | null;
  squad: SquadPlayer[];
  actions: Action[];
  captainMisses: CaptainMiss[];
  bestTransfers: TransferVerdict[];
  worstTransfers: TransferVerdict[];
  // All transfers, in minus out over three weeks each.
  transferGain3: number;
  // The weeks the most points were left on the bench.
  benchWeeks: GameweekSummary[];
  // Chips still to play in the current window, and the window's last week.
  chipsLeft: string[];
  chipDeadline: number | null;
};

// --- Raw FPL shapes (only the fields used) ---------------------------------

type HistoryRow = {
  event: number;
  points: number;
  rank: number | null;
  overall_rank: number | null;
  bank: number;
  value: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
};

type RawElement = {
  id: number;
  web_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  cost_change_start: number;
  cost_change_event: number;
  form: string;
  total_points: number;
  status: string;
  chance_of_playing_next_round: number | null;
  news: string;
  ep_next: string | null;
};

export type RawSeason = {
  history: { current: HistoryRow[]; chips: { name: string; event: number }[] };
  transfers: { element_in: number; element_out: number; event: number }[];
  // Per gameweek: the picks as FPL settled them, and every player's points.
  weeks: Record<
    number,
    {
      chip: string | null;
      picks: { element: number; multiplier: number; element_type: number; position?: number }[];
      points: Record<number, number>;
    }
  >;
  events: {
    id: number;
    average_entry_score: number;
    highest_score: number | null;
    is_next?: boolean;
  }[];
  names: Record<number, string>;
  elements: RawElement[];
  teams: Record<number, string>;
  totalPlayers: number | null;
  // Every chip and the gameweeks it can be played in.
  chipRules: { name: string; start_event: number; stop_event: number }[];
  // Matches still to come.
  fixtures: {
    event: number | null;
    team_h: number;
    team_a: number;
    team_h_difficulty: number;
    team_a_difficulty: number;
  }[];
};

// --- Loading -----------------------------------------------------------------

async function getJson(path: string) {
  const response = await fetch(API + path);
  if (!response.ok) throw new Error(`FPL returned ${response.status} for ${path}`);
  return response.json();
}

// Runs tasks a few at a time, so a long season doesn't flood FPL.
async function inBatches<T, R>(items: T[], size: number, task: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(task))));
  }
  return results;
}

export async function loadSeason(entry: number): Promise<RawSeason> {
  const [history, transfers, bootstrap, fixtures] = await Promise.all([
    getJson(`entry/${entry}/history/`),
    getJson(`entry/${entry}/transfers/`),
    getJson("bootstrap-static/"),
    // Upcoming fixtures are a nice-to-have: the rest works without them.
    getJson("fixtures/?future=1").catch(() => []),
  ]);
  const played: number[] = (history.current ?? []).map((row: HistoryRow) => row.event);
  const weekList = await inBatches(played, 4, async (event) => {
    const [picks, live] = await Promise.all([
      getJson(`entry/${entry}/event/${event}/picks/`),
      getJson(`event/${event}/live/`),
    ]);
    const points: Record<number, number> = {};
    (live.elements ?? []).forEach((element: { id: number; stats: { total_points: number } }) => {
      points[element.id] = element.stats?.total_points ?? 0;
    });
    return { event, chip: picks.active_chip ?? null, picks: picks.picks ?? [], points };
  });
  const weeks: RawSeason["weeks"] = {};
  weekList.forEach(({ event, ...week }) => {
    weeks[event] = week;
  });
  const names: Record<number, string> = {};
  (bootstrap.elements ?? []).forEach((element: { id: number; web_name: string }) => {
    names[element.id] = element.web_name;
  });
  const teams: Record<number, string> = {};
  (bootstrap.teams ?? []).forEach((team: { id: number; short_name: string }) => {
    teams[team.id] = team.short_name;
  });
  return {
    history: { current: history.current ?? [], chips: history.chips ?? [] },
    transfers: transfers ?? [],
    weeks,
    events: bootstrap.events ?? [],
    names,
    elements: bootstrap.elements ?? [],
    teams,
    totalPlayers: bootstrap.total_players ?? null,
    chipRules: bootstrap.chips ?? [],
    fixtures: Array.isArray(fixtures) ? fixtures : [],
  };
}

// --- Analysis ------------------------------------------------------------------

const CHIP_NAMES: Record<string, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};
// Every FPL team starts the season with £100.0m (in tenths of a million).
const STARTING_BUDGET = 1000;
const POSITION_NAMES =["", "Goalkeepers", "Defenders", "Midfielders", "Forwards"];
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function analyseSeason(raw: RawSeason): SeasonInsights {
  const events = new Map(raw.events.map((event) => [event.id, event]));
  const chipByEvent = new Map(raw.history.chips.map((chip) => [chip.event, chip.name]));
  const positionPoints: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

  const gameweeks: GameweekSummary[] = raw.history.current.map((row) => {
    const week = raw.weeks[row.event];
    const event = events.get(row.event);
    let captainName: string | null = null;
    let captainBonus = 0;
    let bestCaptainName: string | null = null;
    let bestCaptainBonus = 0;
    if (week) {
      const counted = week.picks.filter((pick) => pick.multiplier > 0);
      const armband = counted.find((pick) => pick.multiplier >= 2);
      const extra = armband ? armband.multiplier - 1 : 1;
      counted.forEach((pick) => {
        const points = week.points[pick.element] ?? 0;
        positionPoints[pick.element_type] =
          (positionPoints[pick.element_type] ?? 0) + points * pick.multiplier;
      });
      if (armband) {
        captainName = raw.names[armband.element] ?? null;
        captainBonus = (week.points[armband.element] ?? 0) * extra;
      }
      const best = counted.reduce<{ element: number; points: number } | null>((top, pick) => {
        const points = week.points[pick.element] ?? 0;
        return !top || points > top.points ? { element: pick.element, points } : top;
      }, null);
      if (best) {
        bestCaptainName = raw.names[best.element] ?? null;
        bestCaptainBonus = best.points * extra;
      }
    }
    return {
      event: row.event,
      points: row.points,
      average: event?.average_entry_score ?? null,
      highest: event?.highest_score ?? null,
      rank: row.rank,
      overallRank: row.overall_rank,
      benchPoints: row.points_on_bench,
      hitCost: row.event_transfers_cost,
      transfers: row.event_transfers,
      value: row.value,
      bank: row.bank,
      chip: chipByEvent.get(row.event) ?? week?.chip ?? null,
      captainName,
      captainBonus,
      bestCaptainName,
      bestCaptainBonus,
    };
  });

  // Transfers, leaving out Free Hit and Wildcard weeks (reshuffles, not
  // single calls). Judged on the move's own week and on three weeks.
  const verdicts: TransferVerdict[] = raw.transfers
    .filter((transfer) => raw.weeks[transfer.event])
    .filter((transfer) => {
      const chip = chipByEvent.get(transfer.event);
      return chip !== "freehit" && chip !== "wildcard";
    })
    .map((transfer) => {
      let gain3 = 0;
      let weeks = 0;
      for (let event = transfer.event; event < transfer.event + 3; event += 1) {
        const week = raw.weeks[event];
        if (!week) continue;
        weeks += 1;
        gain3 += (week.points[transfer.element_in] ?? 0) - (week.points[transfer.element_out] ?? 0);
      }
      const points = raw.weeks[transfer.event].points;
      return {
        event: transfer.event,
        inName: raw.names[transfer.element_in] ?? "?",
        outName: raw.names[transfer.element_out] ?? "?",
        gain: (points[transfer.element_in] ?? 0) - (points[transfer.element_out] ?? 0),
        gain3,
        weeks,
      };
    });
  const transfers: TransferSummary[] = verdicts.map(({ event, inName, outName, gain }) => ({
    event,
    inName,
    outName,
    gain,
  }));

  const withAverage = gameweeks.filter((gw) => gw.average != null);
  const aboveAverage = withAverage.filter((gw) => gw.points > (gw.average ?? 0)).length;
  const last = gameweeks[gameweeks.length - 1] ?? null;
  const first = gameweeks[0] ?? null;
  const byPoints = [...gameweeks].sort((a, b) => b.points - a.points);

  const result: SeasonInsights = {
    gameweeks,
    totalPoints: sum(gameweeks.map((gw) => gw.points - gw.hitCost)),
    overallRank: last?.overallRank ?? null,
    bestGw: byPoints[0] ?? null,
    worstGw: byPoints[byPoints.length - 1] ?? null,
    aboveAverage,
    averagePoints: gameweeks.length ? sum(gameweeks.map((gw) => gw.points)) / gameweeks.length : 0,
    averageOfAll: withAverage.length
      ? sum(withAverage.map((gw) => gw.average ?? 0)) / withAverage.length
      : null,
    benchTotal: sum(gameweeks.map((gw) => gw.benchPoints)),
    hitsTotal: sum(gameweeks.map((gw) => gw.hitCost)),
    transfersTotal: sum(gameweeks.map((gw) => gw.transfers)),
    transferGain: sum(transfers.map((transfer) => transfer.gain)),
    transfers,
    captainTotal: sum(gameweeks.map((gw) => gw.captainBonus)),
    bestCaptainTotal: sum(gameweeks.map((gw) => gw.bestCaptainBonus)),
    positionPoints,
    // Every manager starts with £100.0m; the first week's value already
    // includes that week's price changes.
    valueStart: first ? STARTING_BUDGET : null,
    valueNow: last?.value ?? null,
    bankNow: last?.bank ?? null,
    topScorers: [],
    chips: raw.history.chips.map((chip) => ({
      name: CHIP_NAMES[chip.name] ?? chip.name,
      event: chip.event,
      points: gameweeks.find((gw) => gw.event === chip.event)?.points ?? null,
    })),
    strengths: [],
    weaknesses: [],
    totalPlayers: raw.totalPlayers,
    rankMove: null,
    nextEvent: raw.events.find((event) => event.is_next)?.id ?? null,
    squad: [],
    actions: [],
    captainMisses: [],
    bestTransfers: verdicts.filter((v) => v.gain3 > 0).sort((a, b) => b.gain3 - a.gain3).slice(0, 3),
    worstTransfers: verdicts.filter((v) => v.gain3 < 0).sort((a, b) => a.gain3 - b.gain3).slice(0, 3),
    transferGain3: sum(verdicts.map((verdict) => verdict.gain3)),
    // Bench Boost weeks count the bench on purpose, so they are left out.
    benchWeeks: gameweeks
      .filter((gw) => gw.chip !== "bboost" && gw.benchPoints >= 6)
      .sort((a, b) => b.benchPoints - a.benchPoints)
      .slice(0, 3),
    chipsLeft: [],
    chipDeadline: null,
  };

  // Rank movement in the last gameweek.
  const ranked = gameweeks.filter((gw) => gw.overallRank);
  if (ranked.length >= 2) {
    result.rankMove =
      (ranked[ranked.length - 2].overallRank ?? 0) - (ranked[ranked.length - 1].overallRank ?? 0);
  }

  // Captaincy: the weeks the armband cost the most.
  result.captainMisses = gameweeks
    .filter((gw) => gw.captainName && gw.bestCaptainName && gw.bestCaptainBonus > gw.captainBonus)
    .sort((a, b) => b.bestCaptainBonus - b.captainBonus - (a.bestCaptainBonus - a.captainBonus))
    .slice(0, 3)
    .map((gw) => ({
      event: gw.event,
      captain: gw.captainName ?? "?",
      captainPoints: gw.captainBonus,
      best: gw.bestCaptainName ?? "?",
      bestPoints: gw.bestCaptainBonus,
    }));

  // Chips still available in the current window (FPL lists each chip with
  // the gameweeks it can be played in).
  const nextEvent = result.nextEvent ?? (last ? last.event + 1 : 1);
  const window = raw.chipRules.filter(
    (rule) => rule.start_event <= nextEvent && nextEvent <= rule.stop_event,
  );
  result.chipsLeft = window
    .filter(
      (rule) =>
        !raw.history.chips.some(
          (used) =>
            used.name === rule.name &&
            used.event >= rule.start_event &&
            used.event <= rule.stop_event,
        ),
    )
    .map((rule) => CHIP_NAMES[rule.name] ?? rule.name);
  result.chipDeadline = window.length ? Math.max(...window.map((rule) => rule.stop_event)) : null;

  result.squad = currentSquad(raw, nextEvent);
  const inSquad = new Set(result.squad.map((player) => player.id));
  result.topScorers = Object.entries(pointsForYou(raw))
    .map(([id, points]) => ({
      id: Number(id),
      name: raw.names[Number(id)] ?? "?",
      points,
      inSquad: inSquad.has(Number(id)),
    }))
    .filter((player) => player.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 8);
  const { strengths, weaknesses } = findings(result);
  result.strengths = strengths;
  result.weaknesses = weaknesses;
  result.actions = nextSteps(result, last?.bank ?? null);
  return result;
}

// Points each player scored while in the team and counted (armband
// included), over every gameweek played: sold players too.
function pointsForYou(raw: RawSeason): Record<number, number> {
  const forYou: Record<number, number> = {};
  Object.values(raw.weeks).forEach((w) => {
    w.picks.forEach((pick) => {
      if (pick.multiplier > 0) {
        forYou[pick.element] =
          (forYou[pick.element] ?? 0) + (w.points[pick.element] ?? 0) * pick.multiplier;
      }
    });
  });
  return forYou;
}

const difficultyOf = (fdr: number): UpcomingFixture["difficulty"] =>
  fdr <= 2 ? "easy" : fdr >= 4 ? "hard" : "average";

// The squad as it stands for the next gameweek: the last gameweek's picks
// (the week before a Free Hit, which does not last), plus transfers made
// since.
function currentSquad(raw: RawSeason, nextEvent: number): SquadPlayer[] {
  const played = Object.keys(raw.weeks)
    .map(Number)
    .sort((a, b) => a - b);
  const lastPlayed = played[played.length - 1];
  let base = lastPlayed;
  if (base != null && raw.weeks[base]?.chip === "freehit" && played.length > 1) {
    base = played[played.length - 2];
  }
  const week = base != null ? raw.weeks[base] : null;
  if (!week) return [];
  const slots = week.picks.map((pick, index) => ({
    element: pick.element,
    starter: (pick.position ?? index + 1) <= 11,
  }));
  [...raw.transfers]
    .filter((transfer) => transfer.event > (lastPlayed ?? 0))
    .sort((a, b) => a.event - b.event)
    .forEach((transfer) => {
      const slot = slots.find((entry) => entry.element === transfer.element_out);
      if (slot) slot.element = transfer.element_in;
    });

  const forYou = pointsForYou(raw);

  const elements = new Map(raw.elements.map((element) => [element.id, element]));
  const squad: SquadPlayer[] = [];
  slots.forEach(({ element: id, starter }) => {
    const element = elements.get(id);
    if (!element) return;
    const fixtures = raw.fixtures
      .filter(
        (fixture) =>
          fixture.event != null &&
          fixture.event >= nextEvent &&
          (fixture.team_h === element.team || fixture.team_a === element.team),
      )
      .sort((a, b) => (a.event ?? 0) - (b.event ?? 0))
      .slice(0, 3)
      .map((fixture) => {
        const home = fixture.team_h === element.team;
        return {
          event: fixture.event ?? 0,
          opponent: raw.teams[home ? fixture.team_a : fixture.team_h] ?? "?",
          home,
          difficulty: difficultyOf(home ? fixture.team_h_difficulty : fixture.team_a_difficulty),
        };
      });
    const player: SquadPlayer = {
      id,
      name: element.web_name,
      team: raw.teams[element.team] ?? "",
      position: element.element_type,
      price: element.now_cost,
      priceChange: element.cost_change_start,
      falling: element.cost_change_event < 0,
      form: Number(element.form) || 0,
      totalPoints: element.total_points,
      pointsForYou: forYou[id] ?? 0,
      starter,
      chance: element.chance_of_playing_next_round,
      status: element.status,
      news: element.news,
      expected: Number(element.ep_next) || 0,
      fixtures,
      verdict: "keep",
      reason: "",
    };
    squad.push({ ...player, ...verdictFor(player) });
  });
  return squad;
}

// Keep, watch or sell, with the main reason in a few words.
function verdictFor(player: SquadPlayer): Pick<SquadPlayer, "verdict" | "reason"> {
  const hard = player.fixtures.filter((fixture) => fixture.difficulty === "hard").length;
  const easy = player.fixtures.filter((fixture) => fixture.difficulty === "easy").length;
  const unavailable =
    ["i", "s", "u", "n"].includes(player.status) || (player.chance ?? 100) <= 25;
  if (unavailable) {
    return {
      verdict: "sell",
      reason: player.news || (player.status === "s" ? "Suspended" : "Unavailable"),
    };
  }
  if (player.form < 2 && (hard >= 2 || player.price >= 55)) {
    return {
      verdict: "sell",
      reason: `Poor form (${player.form.toFixed(1)})${hard >= 2 ? " and tough fixtures" : ""}`,
    };
  }
  if ((player.chance ?? 100) < 100) {
    return { verdict: "watch", reason: player.news || `${player.chance}% chance of playing` };
  }
  // A player in great form is kept even through tough fixtures.
  if (player.form >= 6) {
    return {
      verdict: "keep",
      reason: `In great form (${player.form.toFixed(1)})${
        easy >= 2 ? ", good fixtures" : hard >= 2 ? ", though tough fixtures ahead" : ""
      }`,
    };
  }
  if (hard >= 2) return { verdict: "watch", reason: "Tough fixtures ahead" };
  if (player.form < 3 && player.starter) {
    return { verdict: "watch", reason: `Low form (${player.form.toFixed(1)})` };
  }
  if (player.falling) return { verdict: "watch", reason: "Price falling" };
  if (easy >= 2) return { verdict: "keep", reason: "Good fixtures ahead" };
  return { verdict: "keep", reason: "Steady" };
}

// Observations worth knowing before the next deadline, most pressing first.
// Worded as facts from the data, not instructions: the manager decides.
function nextSteps(s: SeasonInsights, bank: number | null): Action[] {
  const actions: Action[] = [];
  const starters = s.squad.filter((player) => player.starter);

  // 1. Flagged players: doubts and poor form, starters first.
  [...s.squad]
    .filter((player) => player.verdict === "sell")
    .sort((a, b) => Number(b.starter) - Number(a.starter))
    .slice(0, 2)
    .forEach((player) => {
      const doubt = ["i", "s", "u", "n"].includes(player.status) || (player.chance ?? 100) <= 25;
      actions.push({
        kind: "transfer",
        title: doubt ? `${player.name} is a doubt` : `${player.name} is out of form`,
        detail: `${player.reason}.${player.starter ? " Currently in your starting XI." : ""}`,
      });
    });

  // 2. The starter with the highest expected points next gameweek.
  const captain = [...starters]
    .filter((player) => player.verdict !== "sell")
    .sort((a, b) => b.expected - a.expected || b.form - a.form)[0];
  if (captain) {
    const next = captain.fixtures[0];
    actions.push({
      kind: "captain",
      title: `${captain.name} has your highest expected points${s.nextEvent ? ` for GW ${s.nextEvent}` : ""}`,
      detail: `${captain.expected.toFixed(1)} expected${
        next ? `, ${next.opponent} ${next.home ? "at home" : "away"}` : ""
      }, form ${captain.form.toFixed(1)}.`,
    });
  }

  // 3. A benched outfield player expected to outscore a starter.
  const weakestStarter = [...starters]
    .filter((player) => player.position !== 1)
    .sort((a, b) => a.expected - b.expected)[0];
  const bestBench = s.squad
    .filter((player) => !player.starter && player.position !== 1 && player.verdict !== "sell")
    .sort((a, b) => b.expected - a.expected)[0];
  if (bestBench && weakestStarter && bestBench.expected >= weakestStarter.expected + 1.5) {
    actions.push({
      kind: "lineup",
      title: `${bestBench.name} (bench) is expected to outscore ${weakestStarter.name}`,
      detail: `${bestBench.expected.toFixed(1)} expected against ${weakestStarter.expected.toFixed(1)}.`,
    });
  }

  // 4. Chips about to expire.
  if (s.chipsLeft.length && s.chipDeadline && s.nextEvent) {
    const left = s.chipDeadline - s.nextEvent + 1;
    if (left <= 6) {
      actions.push({
        kind: "chip",
        title: `${s.chipsLeft.join(" and ")} ${s.chipsLeft.length === 1 ? "expires" : "expire"} after GW ${s.chipDeadline}`,
        detail: `${left} gameweek${left === 1 ? "" : "s"} left in which to play ${
          s.chipsLeft.length === 1 ? "it" : "them"
        }.`,
      });
    }
  }

  // 5. Money not in the team.
  if (bank != null && bank >= 20) {
    actions.push({
      kind: "money",
      title: `£${(bank / 10).toFixed(1)}m is unspent`,
      detail: "Money in the bank earns no points until it is used.",
    });
  }

  // 6. Patterns from the season so far.
  if (s.bestCaptainTotal > 0 && s.captainTotal / s.bestCaptainTotal < 0.55) {
    actions.push({
      kind: "habit",
      title: `Captains have earned ${Math.round((s.captainTotal / s.bestCaptainTotal) * 100)}% of the best possible`,
      detail: `${s.bestCaptainTotal - s.captainTotal} points below captaining your top scorer each week.`,
    });
  }
  if (s.hitsTotal >= 8 && s.transferGain3 < s.hitsTotal) {
    actions.push({
      kind: "habit",
      title: `Hits have cost more than transfers gained`,
      detail: `${s.hitsTotal} points paid in hits; transfers gained ${s.transferGain3} over three weeks.`,
    });
  }
  if (s.gameweeks.length >= 3 && s.benchTotal / s.gameweeks.length >= 7) {
    actions.push({
      kind: "habit",
      title: `${(s.benchTotal / s.gameweeks.length).toFixed(1)} points a week left on the bench`,
      detail: `${s.benchTotal} bench points this season, above the usual 3 to 5 a week.`,
    });
  }
  return actions.slice(0, 6);
}

// Plain-language strengths and weak spots. Thresholds are rules of thumb.
function findings(s: SeasonInsights) {
  const strengths: Finding[] = [];
  const weaknesses: Finding[] = [];
  const weeks = s.gameweeks.length;
  if (weeks === 0) return { strengths, weaknesses };

  // Beating the average manager.
  const withAverage = s.gameweeks.filter((gw) => gw.average != null).length;
  if (withAverage >= 3) {
    const share = s.aboveAverage / withAverage;
    if (share >= 0.6) {
      strengths.push({
        title: "Consistent scorer",
        detail: `You beat the average manager in ${s.aboveAverage} of ${withAverage} gameweeks.`,
      });
    } else if (share <= 0.4) {
      weaknesses.push({
        title: "Below-average weeks",
        detail: `You beat the average in only ${s.aboveAverage} of ${withAverage} gameweeks.`,
      });
    }
  }

  // Captaincy: armband points against the best choice each week.
  if (s.bestCaptainTotal > 0) {
    const efficiency = s.captainTotal / s.bestCaptainTotal;
    const missed = s.bestCaptainTotal - s.captainTotal;
    if (efficiency >= 0.75) {
      strengths.push({
        title: "Strong captaincy",
        detail: `Your captains earned ${Math.round(efficiency * 100)}% of the best possible armband points.`,
      });
    } else if (efficiency < 0.55) {
      weaknesses.push({
        title: "Captain choices",
        detail: `Picking your best scorer each week would have added ${missed} more points.`,
      });
    }
  }

  // Bench.
  const benchPerWeek = s.benchTotal / weeks;
  if (benchPerWeek >= 7) {
    weaknesses.push({
      title: "Points left on the bench",
      detail: `${s.benchTotal} points sat on your bench (${benchPerWeek.toFixed(1)} a week).`,
    });
  } else if (benchPerWeek <= 3 && weeks >= 3) {
    strengths.push({
      title: "Good team selection",
      detail: `Only ${benchPerWeek.toFixed(1)} bench points a week: you usually start the right players.`,
    });
  }

  // Transfers and hits, judged over three weeks.
  if (s.hitsTotal >= 8 && s.transferGain3 < s.hitsTotal) {
    weaknesses.push({
      title: "Costly hits",
      detail: `You paid ${s.hitsTotal} points in hits, but your transfers gained ${s.transferGain3} over three weeks.`,
    });
  }
  if (s.transfers.length >= 3) {
    if (s.transferGain3 - s.hitsTotal > 0) {
      strengths.push({
        title: "Good transfers",
        detail: `Players you brought in outscored those you sold by ${s.transferGain3} points over three weeks each${
          s.hitsTotal ? `, ${s.transferGain3 - s.hitsTotal} after hits` : ""
        }.`,
      });
    } else if (s.transferGain3 < 0) {
      weaknesses.push({
        title: "Transfers backfiring",
        detail: `Players you sold outscored those you bought by ${-s.transferGain3} points over three weeks.`,
      });
    }
  }

  // Team value.
  if (s.valueStart != null && s.valueNow != null && weeks >= 4) {
    const growth = s.valueNow - s.valueStart;
    if (growth >= 10) {
      strengths.push({
        title: "Growing team value",
        detail: `Your squad has risen £${(growth / 10).toFixed(1)}m in value, giving you more to spend.`,
      });
    } else if (growth <= -5) {
      weaknesses.push({
        title: "Falling team value",
        detail: `Your squad has lost £${(-growth / 10).toFixed(1)}m in value.`,
      });
    }
  }

  // Recent form of overall rank.
  const ranks = s.gameweeks.map((gw) => gw.overallRank).filter((rank): rank is number => !!rank);
  if (ranks.length >= 4) {
    const before = ranks[ranks.length - 4];
    const now = ranks[ranks.length - 1];
    if (now < before * 0.8) {
      strengths.push({
        title: "Climbing",
        detail: "Your overall rank has improved clearly over the last three gameweeks.",
      });
    } else if (now > before * 1.25) {
      weaknesses.push({
        title: "Slipping",
        detail: "Your overall rank has fallen over the last three gameweeks.",
      });
    }
  }

  // Positions: the weakest-scoring line, against a typical share.
  const totals = s.positionPoints;
  const all = totals[1] + totals[2] + totals[3] + totals[4];
  if (all > 0 && weeks >= 3) {
    // Typical shares of a squad's points: GK ~10%, DEF ~25%, MID ~40%, FWD ~25%.
    const typical: Record<number, number> = { 1: 0.1, 2: 0.25, 3: 0.4, 4: 0.25 };
    const ratios = [1, 2, 3, 4].map((type) => ({ type, ratio: totals[type] / all / typical[type] }));
    const strongest = [...ratios].sort((a, b) => b.ratio - a.ratio)[0];
    const weakest = [...ratios].sort((a, b) => a.ratio - b.ratio)[0];
    if (strongest.ratio >= 1.2) {
      strengths.push({
        title: `${POSITION_NAMES[strongest.type]} delivering`,
        detail: `${Math.round((totals[strongest.type] / all) * 100)}% of your points come from your ${POSITION_NAMES[strongest.type].toLowerCase()}, more than usual.`,
      });
    }
    if (weakest.ratio <= 0.7) {
      weaknesses.push({
        title: `${POSITION_NAMES[weakest.type]} underperforming`,
        detail: `Only ${Math.round((totals[weakest.type] / all) * 100)}% of your points come from your ${POSITION_NAMES[weakest.type].toLowerCase()}.`,
      });
    }
  }

  return { strengths, weaknesses };
}
