// Rebuilds the points estimates for a past (or live) gameweek, for a
// gameweek with no estimates saved before its deadline (see
// estimateSnapshots.ts): each player's inputs are worked out from his FPL
// match history as they stood at the deadline (form, points per match,
// clean sheets, starts, expected goals conceded), then put through the same
// estimate. Availability news from back then isn't kept by FPL, so every
// player counts as available.
import { estimatePoints } from "./gameweekAdvice";
import type { PlayerFixture, Row } from "./fpl";

const API = "https://fantasy.premierleague.com/api/";
const DAY = 86_400_000;
// The club's xGC is read from the player's own (enough minutes to trust).
const MIN_MINUTES = 270;

type MatchRow = {
  kickoff_time: string;
  minutes: number;
  total_points: number;
  clean_sheets?: number;
  starts?: number;
  expected_goals_conceded?: string;
};

// Each player's match history, read once per app session.
const histories = new Map<number, Promise<MatchRow[]>>();

function loadHistory(id: number): Promise<MatchRow[]> {
  let pending = histories.get(id);
  if (!pending) {
    pending = fetch(`${API}element-summary/${id}/`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`FPL ${response.status}`))))
      .then((data) => (Array.isArray(data?.history) ? data.history : []));
    // A failure isn't kept: the next try reads again.
    pending.catch(() => histories.delete(id));
    histories.set(id, pending);
  }
  return pending;
}

export type RebuildPlayer = { id: number; type: number; teamId: number };

// Player id to estimated points, or null when FPL couldn't be reached.
export async function rebuildEstimates(
  players: RebuildPlayer[],
  event: number,
  deadline: string,
  fixturesByTeam: Record<number, PlayerFixture[]>,
): Promise<Record<number, number> | null> {
  const cut = Date.parse(deadline);
  if (!Number.isFinite(cut)) return null;
  try {
    const entries = await Promise.all(
      players.map(async (player) => {
        const before = (await loadHistory(player.id)).filter((match) => Date.parse(match.kickoff_time) < cut);
        const minutes = before.reduce((sum, match) => sum + match.minutes, 0);
        const played = before.filter((match) => match.minutes > 0);
        const ppg = played.length ? played.reduce((sum, match) => sum + match.total_points, 0) / played.length : null;
        // FPL's form: points per match over the last 30 days.
        const recent = before.filter((match) => Date.parse(match.kickoff_time) >= cut - 30 * DAY);
        const form = recent.length ? recent.reduce((sum, match) => sum + match.total_points, 0) / recent.length : 0;
        const xgc = before.reduce((sum, match) => sum + (Number(match.expected_goals_conceded) || 0), 0);
        const row: Row = {
          id: player.id,
          pos: 0,
          name: "",
          team: "",
          teamId: player.teamId,
          type: player.type,
          cap: false,
          vice: false,
          sell: 0,
          buy: 0,
          form: form.toFixed(1),
          ppg,
          status: "a",
          fixtures: fixturesByTeam[player.teamId] ?? [],
          cleanSheets: before.reduce((sum, match) => sum + (match.clean_sheets ?? 0), 0),
          starts: before.reduce((sum, match) => sum + (match.starts ?? 0), 0),
          teamXgc: minutes >= MIN_MINUTES ? (xgc / minutes) * 90 : null,
        };
        return [player.id, Math.round(estimatePoints(row, event) * 10) / 10] as const;
      }),
    );
    return Object.fromEntries(entries);
  } catch {
    return null;
  }
}
