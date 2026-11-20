// Chips and captain for the coming gameweek: plain, checkable observations
// from FPL's own data (form, season average, fixtures, availability).
// The one estimate is simple and stated on screen: average of form and
// season points per match, adjusted for the fixture and position. Nothing
// here is a recommendation: the screen says so, and every reading lists the
// facts behind it.
import type { PlayerFixture, Row } from "./fpl";

export type ChipKey = "wildcard" | "freehit" | "bboost" | "3xc";
export const CHIP_NAMES: Record<ChipKey, string> = {
  "3xc": "Triple Captain",
  bboost: "Bench Boost",
  freehit: "Free Hit",
  wildcard: "Wildcard",
};
const CHIP_ORDER: ChipKey[] = ["3xc", "bboost", "freehit", "wildcard"];

export type Verdict = "consider" | "save" | "active" | "unavailable";

export type CaptainOption = {
  row: Row;
  expected: number;
  fixtures: PlayerFixture[];
  reasons: string[];
};

export type ChipReading = {
  key: ChipKey;
  name: string;
  verdict: Verdict;
  headline: string;
  reasons: string[];
};

export type GameweekAdvice = {
  event: number;
  captains: CaptainOption[];
  currentCaptain: CaptainOption | null;
  chips: ChipReading[];
  // True when the season averages were missing (an old saved squad), so the
  // estimates use form alone.
  formOnly: boolean;
};

export type ChipWindow = { name: string; start: number; stop: number };

const UNAVAILABLE = new Set(["i", "s", "u", "n"]);
const one = (value: number) => value.toFixed(1);

export function fixturesIn(row: Row, event: number) {
  return (row.fixtures ?? []).filter((fixture) => fixture.event === event);
}

// Out for the gameweek: injured, suspended or unavailable with no chance given,
// or a 0% chance of playing.
function ruledOut(row: Row) {
  if (row.chance === 0) return true;
  return !!row.status && UNAVAILABLE.has(row.status) && row.chance == null;
}

// Estimated points for the gameweek: the average of recent form and the
// season's points per match, for each match (difficulty 1 counts 120%, 5 counts
// 80%; home 105%, away 95%). Defenders and keepers count 85%: their big scores
// rest on clean sheets, which repeat less reliably. Doubtful players are
// scaled by their chance of playing; no match or ruled out is 0.
function expectedPoints(row: Row, event: number) {
  const fixtures = fixturesIn(row, event);
  if (!fixtures.length || ruledOut(row)) return 0;
  const form = parseFloat(row.form ?? "") || 0;
  const base = row.ppg != null && Number.isFinite(row.ppg) ? (form + row.ppg) / 2 : form;
  const perMatch = fixtures.reduce(
    (sum, f) => sum + (1.3 - 0.1 * (f.fdr ?? 3)) * (f.venue === "H" ? 1.05 : 0.95),
    0,
  );
  const position = row.type === 1 || row.type === 2 ? 0.85 : 1;
  const chance = row.status === "d" ? (row.chance ?? 50) / 100 : 1;
  return base * perMatch * position * chance;
}

// The same estimate, for the player cards on the home pitch.
export const estimatePoints = expectedPoints;

function describeFixtures(fixtures: PlayerFixture[]) {
  return fixtures.map((f) => `${f.opponent} (${f.venue})`).join(" and ");
}

function captainReasons(row: Row, fixtures: PlayerFixture[]) {
  const reasons: string[] = [];
  if (!fixtures.length) {
    reasons.push("No match this gameweek");
    return reasons;
  }
  if (fixtures.length > 1) reasons.push(`Plays twice: ${describeFixtures(fixtures)}`);
  else {
    const f = fixtures[0];
    reasons.push(
      `${f.venue === "H" ? "Home" : "Away"} vs ${f.opponent}${f.fdr ? `, difficulty ${f.fdr} of 5` : ""}`,
    );
  }
  const form = parseFloat(row.form ?? "");
  if (Number.isFinite(form)) {
    reasons.push(
      row.ppg != null && Number.isFinite(row.ppg)
        ? `Form ${one(form)} in the last 30 days, ${one(row.ppg)} per match this season`
        : `Form ${one(form)} (points per match, last 30 days)`,
    );
  }
  if ((row.type === 3 || row.type === 4) && row.xgi90 != null && row.xgi90 > 0) {
    reasons.push(`${row.xgi90.toFixed(2)} expected goals + assists per 90 minutes`);
  }
  if (row.type === 1 || row.type === 2) reasons.push("Defender or keeper: big scores need a clean sheet");
  if (row.status === "d" && row.chance != null) reasons.push(`${row.chance}% chance of playing`);
  if (ruledOut(row)) reasons.push(row.news || "Ruled out");
  const owned = parseFloat(row.ownership ?? "");
  if (Number.isFinite(owned)) {
    if (owned >= 30) reasons.push(`Owned by ${one(owned)}% of managers: many rivals will have him`);
    else if (owned < 10) reasons.push(`Owned by ${one(owned)}%: few rivals have him`);
  }
  return reasons;
}

export function adviseGameweek({
  rows,
  event,
  chipStatuses,
  activeChip,
  chipWindows,
}: {
  rows: Row[];
  event: number;
  chipStatuses: Record<string, string>;
  activeChip: string | null;
  chipWindows?: ChipWindow[];
}): GameweekAdvice {
  const formOnly = rows.some((row) => row.ppg == null);
  const option = (row: Row): CaptainOption => {
    const fixtures = fixturesIn(row, event);
    const expected = expectedPoints(row, event);
    return { row, expected, fixtures, reasons: captainReasons(row, fixtures) };
  };

  const starters = rows.filter((row) => row.pos <= 11);
  const bench = rows.filter((row) => row.pos > 11).sort((a, b) => a.pos - b.pos);
  const ranked = starters.map(option).sort((a, b) => b.expected - a.expected);
  const captains = ranked.slice(0, 3);
  const capRow = starters.find((row) => row.cap);
  const currentCaptain = capRow ? (ranked.find((o) => o.row.id === capRow.id) ?? null) : null;

  // ---- Chip readings ----
  const readings: Record<ChipKey, Omit<ChipReading, "key" | "name">> = {} as never;
  const top = captains[0];

  // Triple Captain
  {
    const reasons: string[] = [];
    let verdict: Verdict = "save";
    let headline = "Probably save it";
    if (top) {
      const twice = top.fixtures.length > 1;
      reasons.push(`Best captain option: ${top.row.name}, about ${one(top.expected)} points by our estimate`);
      if (twice) reasons.push(`${top.row.name} plays twice this gameweek`);
      reasons.push(`Triple Captain would add about ${one(top.expected)} points over a normal captain`);
      if ((twice && top.expected >= 7) || top.expected >= 9) {
        verdict = "consider";
        headline = "Worth considering";
      } else {
        reasons.push("It usually pays most in a double gameweek, or when a captain is estimated 9+ points");
      }
    }
    readings["3xc"] = { verdict, headline, reasons };
  }

  // Bench Boost
  {
    const reasons: string[] = [];
    const benchExpected = bench.map((row) => ({ row, expected: expectedPoints(row, event), fixtures: fixturesIn(row, event) }));
    const total = benchExpected.reduce((sum, b) => sum + b.expected, 0);
    const blanks = benchExpected.filter((b) => b.fixtures.length === 0);
    const out = benchExpected.filter((b) => b.fixtures.length > 0 && ruledOut(b.row));
    const doubles = benchExpected.filter((b) => b.fixtures.length > 1);
    reasons.push(`By our estimate, your bench would add about ${one(total)} points`);
    benchExpected.forEach((b) =>
      reasons.push(
        `${b.row.name}: ${b.fixtures.length === 0 ? "no match" : ruledOut(b.row) ? "ruled out" : `${one(b.expected)} pts${b.fixtures.length > 1 ? ", plays twice" : ""}`}`,
      ),
    );
    let verdict: Verdict = "save";
    let headline = "Probably save it";
    if (blanks.length || out.length) {
      reasons.push(`${blanks.length + out.length} bench ${blanks.length + out.length === 1 ? "player won't" : "players won't"} play`);
    } else if (total >= 14 || doubles.length >= 2) {
      verdict = "consider";
      headline = "Worth considering";
    } else {
      reasons.push("It usually pays most when all four play, ideally twice, for 14+ points");
    }
    readings.bboost = { verdict, headline, reasons };
  }

  // Free Hit
  {
    const reasons: string[] = [];
    const blanks = starters.filter((row) => fixturesIn(row, event).length === 0);
    const out = starters.filter((row) => fixturesIn(row, event).length > 0 && ruledOut(row));
    const missing = blanks.length + out.length;
    if (blanks.length) reasons.push(`${blanks.length} in your starting XI ${blanks.length === 1 ? "has" : "have"} no match: ${blanks.map((r) => r.name).join(", ")}`);
    if (out.length) reasons.push(`${out.length} ruled out: ${out.map((r) => r.name).join(", ")}`);
    if (!missing) reasons.push("Everyone in your starting XI has a match and is available");
    const consider = missing >= 4;
    if (!consider) reasons.push("It usually pays most when 4 or more starters can't play");
    readings.freehit = {
      verdict: consider ? "consider" : "save",
      headline: consider ? "Worth considering" : "Probably save it",
      reasons,
    };
  }

  // Wildcard
  {
    const reasons: string[] = [];
    const out = rows.filter(ruledOut);
    const doubtful = rows.filter((row) => !ruledOut(row) && row.status === "d");
    const poorForm = starters.filter((row) => !ruledOut(row) && (parseFloat(row.form ?? "") || 0) < 2);
    const hardRun = rows.filter((row) => {
      const next = (row.fixtures ?? []).filter((f) => f.event >= event && f.event < event + 4 && f.fdr);
      if (next.length < 3) return false;
      return next.reduce((sum, f) => sum + (f.fdr ?? 3), 0) / next.length >= 3.7;
    });
    const flagged = new Set([...out, ...doubtful, ...poorForm, ...hardRun].map((row) => row.id));
    if (out.length) reasons.push(`Ruled out: ${out.map((r) => r.name).join(", ")}`);
    if (doubtful.length) reasons.push(`Doubtful: ${doubtful.map((r) => r.name).join(", ")}`);
    if (poorForm.length) reasons.push(`Starters with form under 2.0: ${poorForm.map((r) => r.name).join(", ")}`);
    if (hardRun.length) reasons.push(`Hard fixtures over the next 4 gameweeks: ${hardRun.map((r) => r.name).join(", ")}`);
    const consider = flagged.size >= 5;
    if (!flagged.size) reasons.push("No injuries, poor form or hard runs in your squad");
    else reasons.push(`${flagged.size} of your 15 players ${flagged.size === 1 ? "has" : "have"} an issue`);
    if (!consider) reasons.push("It usually pays most when 5 or more players need changing");
    readings.wildcard = {
      verdict: consider ? "consider" : "save",
      headline: consider ? "Worth considering" : "Probably save it",
      reasons,
    };
  }

  const chips: ChipReading[] = CHIP_ORDER.map((key) => {
    const name = CHIP_NAMES[key];
    if (activeChip === key) {
      return { key, name, verdict: "active", headline: "Active this gameweek", reasons: [] };
    }
    if (chipStatuses[key] !== "available") {
      return {
        key,
        name,
        verdict: "unavailable",
        headline: chipStatuses[key] === "played" ? "Already used" : "Not available",
        reasons: [],
      };
    }
    if (activeChip) {
      return { key, name, verdict: "unavailable", headline: "One chip per gameweek", reasons: [`${CHIP_NAMES[activeChip as ChipKey] ?? "Another chip"} is already active`] };
    }
    const reading = readings[key];
    // Use it or lose it: the chip's window closes soon.
    const window = chipWindows?.find((w) => w.name === key && w.start <= event && event <= w.stop);
    const reasons = [...reading.reasons];
    if (window && window.stop - event <= 3) {
      reasons.unshift(
        window.stop === event
          ? "This is the last gameweek to use it before it expires"
          : `Expires after GW ${window.stop}: ${window.stop - event + 1} gameweeks left to use it`,
      );
    }
    return { key, name, ...reading, reasons };
  });

  return { event, captains, currentCaptain, chips, formOnly };
}
