// "My season": a manager's season so far, and what it says about their
// strengths and weak spots. Reads FPL's public endpoints directly (no sign-in
// needed) and turns them into figures and plain-language findings.

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

export type Finding = { title: string; detail: string };

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
  valueStart: number | null;
  valueNow: number | null;
  chips: { name: string; event: number; points: number | null }[];
  strengths: Finding[];
  weaknesses: Finding[];
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

export type RawSeason = {
  history: { current: HistoryRow[]; chips: { name: string; event: number }[] };
  transfers: { element_in: number; element_out: number; event: number }[];
  // Per gameweek: the picks as FPL settled them, and every player's points.
  weeks: Record<
    number,
    {
      chip: string | null;
      picks: { element: number; multiplier: number; element_type: number }[];
      points: Record<number, number>;
    }
  >;
  events: { id: number; average_entry_score: number; highest_score: number | null }[];
  names: Record<number, string>;
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
  const [history, transfers, bootstrap] = await Promise.all([
    getJson(`entry/${entry}/history/`),
    getJson(`entry/${entry}/transfers/`),
    getJson("bootstrap-static/"),
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
  return {
    history: { current: history.current ?? [], chips: history.chips ?? [] },
    transfers: transfers ?? [],
    weeks,
    events: bootstrap.events ?? [],
    names,
  };
}

// --- Analysis ------------------------------------------------------------------

const CHIP_NAMES: Record<string, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};
const POSITION_NAMES = ["", "Goalkeepers", "Defenders", "Midfielders", "Forwards"];

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

  const transfers: TransferSummary[] = raw.transfers
    .filter((transfer) => raw.weeks[transfer.event])
    .map((transfer) => {
      const points = raw.weeks[transfer.event].points;
      return {
        event: transfer.event,
        inName: raw.names[transfer.element_in] ?? "?",
        outName: raw.names[transfer.element_out] ?? "?",
        gain: (points[transfer.element_in] ?? 0) - (points[transfer.element_out] ?? 0),
      };
    })
    // Free Hit and Wildcard weeks are reshuffles, not single calls.
    .filter((transfer) => {
      const chip = chipByEvent.get(transfer.event);
      return chip !== "freehit" && chip !== "wildcard";
    });

  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
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
    valueStart: first?.value ?? null,
    valueNow: last?.value ?? null,
    chips: raw.history.chips.map((chip) => ({
      name: CHIP_NAMES[chip.name] ?? chip.name,
      event: chip.event,
      points: gameweeks.find((gw) => gw.event === chip.event)?.points ?? null,
    })),
    strengths: [],
    weaknesses: [],
  };
  const { strengths, weaknesses } = findings(result);
  result.strengths = strengths;
  result.weaknesses = weaknesses;
  return result;
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
        detail: `You beat the average in only ${s.aboveAverage} of ${withAverage} gameweeks. Look at which positions score least for you below.`,
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
        detail: `Picking your best scorer each week would have added ${missed} more points. Favour in-form players with easy fixtures.`,
      });
    }
  }

  // Bench.
  const benchPerWeek = s.benchTotal / weeks;
  if (benchPerWeek >= 7) {
    weaknesses.push({
      title: "Points left on the bench",
      detail: `${s.benchTotal} points sat on your bench (${benchPerWeek.toFixed(1)} a week). Check your starting eleven against fixtures each week.`,
    });
  } else if (benchPerWeek <= 3 && weeks >= 3) {
    strengths.push({
      title: "Good team selection",
      detail: `Only ${benchPerWeek.toFixed(1)} bench points a week: you usually start the right players.`,
    });
  }

  // Transfers and hits.
  if (s.hitsTotal >= 8 && s.transferGain < s.hitsTotal) {
    weaknesses.push({
      title: "Costly hits",
      detail: `You paid ${s.hitsTotal} points in hits but your transfers gained ${s.transferGain} in the week they were made. Save transfers instead of taking hits.`,
    });
  }
  if (s.transfers.length >= 3) {
    if (s.transferGain - s.hitsTotal > 0) {
      strengths.push({
        title: "Good transfers",
        detail: `Players you brought in outscored those you sold by ${s.transferGain} points in their first week${s.hitsTotal ? `, ${s.transferGain - s.hitsTotal} after hits` : ""}.`,
      });
    } else if (s.transferGain < 0) {
      weaknesses.push({
        title: "Transfers backfiring",
        detail: `Players you sold outscored those you bought by ${-s.transferGain} points in the week of the move. Avoid chasing last week's points.`,
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
        detail: `Your squad has lost £${(-growth / 10).toFixed(1)}m in value. Sell falling players before their price drops.`,
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
        detail: "Your overall rank has fallen over the last three gameweeks. Compare your team with the managers above you.",
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
        detail: `Only ${Math.round((totals[weakest.type] / all) * 100)}% of your points come from your ${POSITION_NAMES[weakest.type].toLowerCase()}. Consider upgrading there.`,
      });
    }
  }

  return { strengths, weaknesses };
}
