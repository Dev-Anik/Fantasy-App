// Facts for the Insights panel on Home (see ScoutPanel.tsx): quick reads
// on the coming gameweek, worked out on the phone from FPL data the app
// already holds (every player's FPL record, every club's fixtures, the
// user's squad). Plain readings from the data, not recommendations: the
// estimates are the app's own (estimatePoints), as on Home and in "Chips &
// captain", clean sheet chances included.
import { cleanSheetChance, estimatePoints, teamXgcFromElements } from "./gameweekAdvice";
import type { PlayerFixture, Row } from "./fpl";
import type { FplElement } from "./PlayerProfile";

// The fields of FPL's player record used here, beyond those FplElement
// names (the app keeps the whole record).
export type ScoutElement = FplElement & {
  web_name: string;
  team: number;
  form: string;
  status: string;
  chance_of_playing_next_round: number | null;
  news: string;
};

// A fixture as shown in a coloured difficulty chip.
export type FactFixture = { opponent: string; venue: "H" | "A"; fdr: number };

// What the value on the right is, which sets its colour: estimated points,
// ownership, a difficulty (coloured like FPL's ratings), or a rise or fall.
export type FactTone = "points" | "ownership" | "fdr" | "good" | "bad" | "defence";

export type FactItem = {
  // Shown in bold, with the club beside it.
  name: string;
  club?: string;
  // The fixtures as difficulty chips under the name.
  fixtures?: FactFixture[];
  // A short note under the name (after the chips, if any).
  note?: string;
  // On the right.
  value: string;
  tone: FactTone;
  // For the "fdr" tone: the difficulty that colours the value.
  fdr?: number;
};

export type Fact = {
  key: string;
  title: string;
  // One short line on what the figures mean.
  caption: string;
  items: FactItem[];
};

// Players with fewer minutes than this (about three full matches) are left
// out of the rankings: a couple of good games make their averages too high.
const MIN_MINUTES = 270;
// "Differential": owned by fewer than this share of managers.
const DIFFERENTIAL_OWNERSHIP = 5;
// Fixture runs: this many gameweeks from the next one.
const RUN_LENGTH = 3;

const one = (value: number) => value.toFixed(1);

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function chips(fixtures: PlayerFixture[]): FactFixture[] {
  return fixtures.map((f) => ({ opponent: f.opponent, venue: f.venue, fdr: f.fdr ?? 3 }));
}

export function buildFacts({
  elements,
  teamNames,
  fixturesByTeam,
  squad,
  event,
}: {
  elements: Record<number, ScoutElement>;
  // Club short names by FPL team id.
  teamNames: Record<number, string>;
  fixturesByTeam: Record<number, PlayerFixture[]>;
  // The user's 15 (starters are positions 1 to 11).
  squad: Row[];
  // The next gameweek (the deadline's).
  event: number;
}): Fact[] {
  const all = Object.values(elements);
  if (!all.length) return [];
  const runEvents = Array.from({ length: RUN_LENGTH }, (_, i) => event + i);
  const fixturesIn = (teamId: number, events: number[]) =>
    (fixturesByTeam[teamId] ?? []).filter((f) => events.includes(f.event));

  // Each club's expected goals conceded per 90, for the clean sheet part of
  // the shared estimate and the clean sheet card.
  const teamXgc = teamXgcFromElements(all, MIN_MINUTES);

  // FPL's record as the Row the shared estimate reads.
  const asRow = (el: ScoutElement): Row => ({
    id: el.id,
    pos: 0,
    name: el.web_name,
    team: teamNames[el.team] ?? "",
    teamId: el.team,
    type: el.element_type,
    cap: false,
    vice: false,
    sell: el.now_cost,
    buy: el.now_cost,
    form: el.form,
    ppg: Number(el.points_per_game),
    status: el.status,
    chance: el.chance_of_playing_next_round,
    news: el.news,
    fixtures: fixturesIn(el.team, [event]),
    cleanSheets: el.clean_sheets,
    starts: el.starts,
    teamXgc: teamXgc.get(el.team) ?? null,
  });

  const estimates = new Map<number, number>();
  const estimate = (el: ScoutElement) => {
    let value = estimates.get(el.id);
    if (value == null) {
      value = estimatePoints(asRow(el), event);
      estimates.set(el.id, value);
    }
    return value;
  };
  const ownership = (el: ScoutElement) => Number(el.selected_by_percent) || 0;
  const club = (el: ScoutElement) => teamNames[el.team] ?? "";
  const regulars = all.filter((el) => el.minutes >= MIN_MINUTES);
  const byEstimate = (a: ScoutElement, b: ScoutElement) => estimate(b) - estimate(a);
  const nextChips = (el: ScoutElement): FactFixture[] => chips(fixturesIn(el.team, [event]));
  const estimateItem = (el: ScoutElement, note?: string): FactItem => {
    const fixtures = nextChips(el);
    return {
      name: el.web_name,
      club: club(el),
      fixtures,
      note: note ?? (fixtures.length ? undefined : "No match this gameweek"),
      value: `${one(estimate(el))} pts`,
      tone: "points",
    };
  };

  const facts: Fact[] = [];

  // 1. Highest estimate for the gameweek, every position (keepers and
  // defenders rank by their clean sheet chance too).
  const top = [...regulars].sort(byEstimate).slice(0, 3).filter((el) => estimate(el) > 0);
  if (top.length) {
    facts.push({
      key: "top",
      title: "Top estimates",
      caption: `Highest estimated points in Gameweek ${event}, clean sheet chances included`,
      items: top.map((el) => estimateItem(el)),
    });
  }

  // Clean sheet chances: the clubs most likely to keep one this gameweek
  // (for a double gameweek, the better of the two). Clubs without a match
  // are left out.
  const cleanSheets = [...teamXgc.keys()]
    .map((teamId) => {
      const fixtures = fixturesIn(teamId, [event]);
      const xgc = teamXgc.get(teamId) ?? 0;
      const chance = Math.max(0, ...fixtures.map((f) => cleanSheetChance(xgc, f)));
      return { teamId, fixtures, chance };
    })
    .filter((row) => row.fixtures.length > 0)
    .sort((a, b) => b.chance - a.chance)
    .slice(0, 3);
  if (cleanSheets.length) {
    facts.push({
      key: "cleansheets",
      title: "Clean sheet chances",
      caption: "From each club's expected goals conceded and this match's difficulty",
      items: cleanSheets.map((row) => ({
        name: teamNames[row.teamId] ?? "",
        fixtures: chips(row.fixtures),
        value: `${Math.round(row.chance * 100)}%`,
        tone: "defence" as const,
      })),
    });
  }

  // 2. Easiest fixture run: easier fixtures score more, a double gameweek
  // counts twice, a blank counts nothing (as in the Fixture planner).
  const runs = Object.keys(teamNames)
    .map(Number)
    .map((teamId) => {
      const fixtures = fixturesIn(teamId, runEvents);
      const ease = fixtures.reduce((sum, f) => sum + (6 - (f.fdr ?? 3)), 0);
      const average = fixtures.length ? fixtures.reduce((sum, f) => sum + (f.fdr ?? 3), 0) / fixtures.length : null;
      return { teamId, fixtures, ease, average };
    })
    .filter((run) => run.fixtures.length > 0)
    .sort((a, b) => b.ease - a.ease)
    .slice(0, 3);
  if (runs.length) {
    facts.push({
      key: "fixtures",
      title: "Easiest fixtures",
      caption: `Gameweeks ${runEvents[0]} to ${runEvents[runEvents.length - 1]}, by FPL's difficulty ratings`,
      items: runs.map((run) => ({
        name: teamNames[run.teamId] ?? "",
        fixtures: chips(run.fixtures),
        value: run.average == null ? "—" : `avg ${one(run.average)}`,
        tone: "fdr" as const,
        fdr: run.average ?? 3,
      })),
    });
  }

  // 3. Differentials: few managers own them, but the estimate is high.
  const differentials = regulars
    .filter((el) => ownership(el) < DIFFERENTIAL_OWNERSHIP && estimate(el) > 0)
    .sort(byEstimate)
    .slice(0, 3);
  if (differentials.length) {
    facts.push({
      key: "differentials",
      title: "Differentials",
      caption: `Owned by under ${DIFFERENTIAL_OWNERSHIP}% of managers, highest estimates`,
      items: differentials.map((el) => estimateItem(el, `Owned by ${one(ownership(el))}%`)),
    });
  }

  // 4. Most bought and sold this gameweek.
  const bought = [...all].sort((a, b) => b.transfers_in_event - a.transfers_in_event).slice(0, 2);
  const sold = [...all].sort((a, b) => b.transfers_out_event - a.transfers_out_event).slice(0, 2);
  if (bought[0]?.transfers_in_event || sold[0]?.transfers_out_event) {
    facts.push({
      key: "transfers",
      title: "Most bought and sold",
      caption: "Transfers this gameweek: busy players often change price",
      items: [
        ...bought
          .filter((el) => el.transfers_in_event > 0)
          .map<FactItem>((el) => ({
            name: el.web_name,
            club: club(el),
            note: "Bought this gameweek",
            value: `+${compact(el.transfers_in_event)}`,
            tone: "good",
          })),
        ...sold
          .filter((el) => el.transfers_out_event > 0)
          .map<FactItem>((el) => ({
            name: el.web_name,
            club: club(el),
            note: "Sold this gameweek",
            value: `−${compact(el.transfers_out_event)}`,
            tone: "bad",
          })),
      ],
    });
  }

  // Facts about the user's own squad (its players' current FPL records).
  const mine = squad.map((row) => elements[row.id]).filter((el): el is ScoutElement => !!el);
  const starters = squad
    .filter((row) => row.pos <= 11)
    .map((row) => elements[row.id])
    .filter((el): el is ScoutElement => !!el);

  // 5. Best captain among the starters.
  const captains = [...starters].sort(byEstimate).slice(0, 2).filter((el) => estimate(el) > 0);
  if (captains.length) {
    facts.push({
      key: "captain",
      title: "Your best captain",
      caption: "Your starters with the highest estimates",
      items: captains.map((el) => estimateItem(el)),
    });
  }

  // 6. The user's players with the hardest run (highest average difficulty).
  const hardest = mine
    .map((el) => {
      const fixtures = fixturesIn(el.team, runEvents);
      const average = fixtures.length ? fixtures.reduce((sum, f) => sum + (f.fdr ?? 3), 0) / fixtures.length : null;
      return { el, fixtures, average };
    })
    .filter((run): run is { el: ScoutElement; fixtures: PlayerFixture[]; average: number } => run.average != null)
    .sort((a, b) => b.average - a.average)
    .slice(0, 2);
  if (hardest.length) {
    facts.push({
      key: "hardest",
      title: "Your toughest fixtures",
      caption: `Your players' hardest runs, Gameweeks ${runEvents[0]} to ${runEvents[runEvents.length - 1]}`,
      items: hardest.map((run) => ({
        name: run.el.web_name,
        club: club(run.el),
        fixtures: chips(run.fixtures),
        value: `avg ${one(run.average)}`,
        tone: "fdr" as const,
        fdr: run.average,
      })),
    });
  }

  // 7. The most owned players the user doesn't have.
  const owned = new Set(squad.map((row) => row.id));
  const missing = [...all]
    .filter((el) => !owned.has(el.id))
    .sort((a, b) => ownership(b) - ownership(a))
    .slice(0, 2);
  if (missing.length) {
    facts.push({
      key: "missing",
      title: "Popular, not in your team",
      caption: "The most owned players you don't have",
      items: missing.map((el) => ({
        name: el.web_name,
        club: club(el),
        fixtures: nextChips(el),
        value: `${one(ownership(el))}%`,
        tone: "ownership" as const,
      })),
    });
  }

  return facts;
}
