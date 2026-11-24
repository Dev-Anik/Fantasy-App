// Suggested transfers for the Transfers page: for each player in the squad,
// the best player of the same position the user could sign instead (within
// the budget and the three-per-club rule), compared on the app's own points
// estimate over the next few gameweeks (estimatePoints: form, points per
// match, fixture difficulty, home or away, clean sheet chances, and
// availability). The best few swaps are offered; a points hit is only
// suggested when the gain clearly outweighs it, and with nothing worth
// doing the advice is to keep the transfer.
//
// Everything comes from data the app already holds: no extra downloads.
import type { Player, PlayerFixture, Row } from "./fpl";
import { estimatePoints, withCleanSheetData } from "./gameweekAdvice";

// Gameweeks looked ahead.
export const HORIZON = 3;
// Swaps offered at most.
const MAX_SUGGESTIONS = 3;
// A free transfer is worth suggesting from this gain (points over HORIZON).
const MIN_GAIN_FREE = 1.5;
// A paid transfer must beat its hit by this much on top.
const HIT_MARGIN = 1;
// Players listed as available but with a low chance of playing, and players
// who haven't played this season, aren't suggested as signings.
const MIN_CHANCE = 75;

export type TransferSuggestion = {
  out: Row;
  inn: Player;
  // The signing as a squad row (fixtures and clean sheet data added).
  innRow: Row;
  outPoints: number;
  inPoints: number;
  gain: number;
  // Money left in the bank after this swap.
  bankLeft: number;
  // Costs a points hit (no free transfer left for it).
  paid: boolean;
};

export type TransferAdvice = {
  suggestions: TransferSuggestion[];
  // Free transfers still unused (null: FPL didn't say).
  freeLeft: number | null;
  // Nothing clearly worth doing: keep (roll) the transfer.
  roll: boolean;
};

type PlayerRecord = {
  clean_sheets: number;
  starts: number;
  minutes: number;
  expected_goals_per_90?: number | string | null;
  expected_assists_per_90?: number | string | null;
};
type Records = Record<number, PlayerRecord | undefined>;

// The next HORIZON gameweeks' fixtures, from `fromEvent`.
export function nextFixtures(fixtures: PlayerFixture[] | undefined, fromEvent: number) {
  return (fixtures ?? []).filter((f) => f.event >= fromEvent && f.event < fromEvent + HORIZON && !f.finished);
}

// FPL's availability news is for the next gameweek only. After it, a
// suspended player is counted back (a ban is usually one match) and an
// injured one at half (return dates are rarely known); a player who has
// left or is otherwise unavailable stays out.
function laterRow(row: Row): Row {
  if (row.status === "s") return { ...row, status: "a", chance: null };
  if (row.status === "i") return { ...row, status: "d", chance: 50 };
  return row;
}

function pointsAhead(row: Row, fromEvent: number) {
  const later = laterRow(row);
  let total = 0;
  for (let event = fromEvent; event < fromEvent + HORIZON; event += 1) {
    total += estimatePoints(event === fromEvent ? row : later, event);
  }
  return total;
}

export function rowFromPlayer(player: Player, fixtures: PlayerFixture[]): Row {
  return {
    id: player.id,
    pos: 0,
    name: player.name,
    team: player.team,
    teamId: player.teamId,
    type: player.type,
    cap: false,
    vice: false,
    sell: player.cost,
    buy: player.cost,
    price: player.cost,
    form: player.form,
    ownership: player.ownership,
    priceChange: player.priceChange,
    formMood: player.formMood,
    status: player.status,
    chance: player.chance,
    news: player.news,
    fixtures,
    epNext: player.epNext ?? null,
    ppg: player.ppg ?? null,
    xgi90: player.xgi90 ?? null,
    totalPoints: player.pts,
  };
}

export function adviseTransfers({
  squad,
  pool,
  bank,
  fixturesByTeam,
  records,
  teamXgc,
  fromEvent,
  freeTransfers,
  pendingCount,
  hitCost,
  unlimited,
}: {
  // The squad as it stands with any transfers already made on the page.
  squad: Row[];
  pool: Player[];
  bank: number;
  fixturesByTeam: Record<number, PlayerFixture[]>;
  records: Records;
  teamXgc: Map<number, number>;
  fromEvent: number;
  freeTransfers: number | null;
  pendingCount: number;
  hitCost: number;
  // Wildcard or Free Hit: transfers cost nothing.
  unlimited: boolean;
}): TransferAdvice {
  const freeLeft = unlimited ? null : freeTransfers == null ? null : Math.max(0, freeTransfers - pendingCount);
  const paid = !unlimited && freeLeft === 0;
  const needed = paid ? hitCost + HIT_MARGIN : MIN_GAIN_FREE;

  const inSquad = new Set(squad.map((row) => row.id));
  const clubCount: Record<number, number> = {};
  squad.forEach((row) => {
    clubCount[row.teamId] = (clubCount[row.teamId] ?? 0) + 1;
  });

  // Who could be signed at all, worked out once: estimated points ahead.
  const signable = pool
    .filter((player) => {
      if (inSquad.has(player.id)) return false;
      if ((records[player.id]?.minutes ?? 0) <= 0) return false;
      if (player.status && player.status !== "a") return false;
      return player.chance == null || player.chance >= MIN_CHANCE;
    })
    .map((player) => {
      const row = withCleanSheetData(rowFromPlayer(player, fixturesByTeam[player.teamId] ?? []), records, teamXgc);
      return { player, row, points: pointsAhead(row, fromEvent) };
    })
    .sort((a, b) => b.points - a.points);

  const options: TransferSuggestion[] = [];
  squad.forEach((out) => {
    // A player just brought in on this page isn't swapped again.
    if (out.pendingIn) return;
    const outRow = withCleanSheetData(out, records, teamXgc);
    const outPoints = pointsAhead(outRow, fromEvent);
    const budget = bank + out.sell;
    const best = signable.find(
      ({ player }) =>
        player.type === out.type &&
        player.cost <= budget &&
        (clubCount[player.teamId] ?? 0) - (player.teamId === out.teamId ? 1 : 0) < 3,
    );
    if (!best) return;
    options.push({
      out,
      inn: best.player,
      innRow: best.row,
      outPoints,
      inPoints: best.points,
      gain: best.points - outPoints,
      bankLeft: budget - best.player.cost,
      paid,
    });
  });

  // The biggest gains, each signing and each sale once.
  const suggestions: TransferSuggestion[] = [];
  const usedIn = new Set<number>();
  options
    .filter((option) => option.gain >= needed)
    .sort((a, b) => b.gain - a.gain)
    .forEach((option) => {
      if (suggestions.length >= MAX_SUGGESTIONS || usedIn.has(option.inn.id)) return;
      usedIn.add(option.inn.id);
      suggestions.push(option);
    });

  return { suggestions, freeLeft, roll: suggestions.length === 0 };
}
