// "My career": every FPL season a manager has played, from FPL's public
// entry history (one row per finished season: points, overall rank and the
// share of managers finishing above) plus this season so far. FPL keeps
// nothing finer for past seasons (no transfers, captains or weekly scores),
// so this is a season-by-season summary. Two small reads.
import { FRESH, fplJson } from "./fplCache";

export type CareerSeason = {
  // "2018/19".
  name: string;
  points: number;
  rank: number | null;
  // Finished in the top this many percent (FPL's figure; worked out for the
  // season in play).
  topPercent: number | null;
  // The season still being played.
  inPlay: boolean;
};

export type CareerFact = { text: string; tone: "good" | "bad" | "plain" };

export type Career = {
  // Finished seasons, oldest first.
  past: CareerSeason[];
  current: CareerSeason | null;
  totalPoints: number;
  // Over finished seasons only.
  averagePoints: number | null;
  best: CareerSeason | null;
  worst: CareerSeason | null;
  facts: CareerFact[];
};

type PastRow = { season_name: string; total_points: number; rank: number | null; rank_percentage?: string | null };
type CurrentRow = { event: number; total_points: number; overall_rank: number | null };

const percentOf = (value: string | null | undefined) => {
  const number = Number(value);
  // FPL gives 0 for the very top (under 1%): shown as top 1%.
  return value != null && value !== "" && Number.isFinite(number) ? Math.max(1, number) : null;
};

// The season in play, named like FPL's past seasons ("2026/27"), from the
// first deadline's year.
function seasonName(events: { deadline_time?: string }[]) {
  const year = new Date(events[0]?.deadline_time ?? Date.now()).getFullYear();
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function factsFor(past: CareerSeason[], current: CareerSeason | null): CareerFact[] {
  const facts: CareerFact[] = [];
  const ranked = past.filter((season) => season.topPercent != null);
  if (ranked.length >= 2) {
    const topTen = ranked.filter((season) => (season.topPercent ?? 100) <= 10).length;
    if (topTen > 0) {
      facts.push({
        text: `Top 10% in ${topTen} of your ${ranked.length} finished seasons.`,
        tone: "good",
      });
    }
    const topOne = ranked.filter((season) => (season.topPercent ?? 100) <= 1).length;
    if (topOne > 0) facts.push({ text: `Top 1% ${topOne === 1 ? "once" : `${topOne} times`}.`, tone: "good" });
  }

  // Rank improving (or slipping) in a row, up to the last finished season.
  const withRank = past.filter((season) => season.rank);
  let streak = 0;
  let direction = 0;
  for (let i = withRank.length - 1; i > 0; i -= 1) {
    const step = Math.sign((withRank[i - 1].rank ?? 0) - (withRank[i].rank ?? 0));
    if (step === 0 || (direction !== 0 && step !== direction)) break;
    direction = step;
    streak += 1;
  }
  if (streak >= 2) {
    facts.push(
      direction > 0
        ? { text: `Your overall rank has improved ${streak} seasons in a row.`, tone: "good" }
        : { text: `Your overall rank has slipped ${streak} seasons in a row.`, tone: "bad" },
    );
  }

  // This season against your usual finish.
  const usual = ranked.length
    ? [...ranked].map((season) => season.topPercent as number).sort((a, b) => a - b)[Math.floor(ranked.length / 2)]
    : null;
  if (current?.topPercent != null && usual != null) {
    const now = current.topPercent;
    facts.push(
      now < usual
        ? { text: `This season you're in the top ${now}%, ahead of your usual top ${usual}%.`, tone: "good" }
        : now > usual
          ? { text: `This season you're in the top ${now}%, behind your usual top ${usual}%.`, tone: "bad" }
          : { text: `This season you're right on your usual top ${usual}%.`, tone: "plain" },
    );
  }

  const bestPoints = past.reduce<CareerSeason | null>((top, season) => (!top || season.points > top.points ? season : top), null);
  if (bestPoints && past.length >= 2) {
    facts.push({ text: `Most points in a season: ${formatNumber(bestPoints.points)} in ${bestPoints.name}.`, tone: "plain" });
  }
  return facts;
}

export async function loadCareer(entry: number): Promise<Career> {
  const [history, bootstrap] = await Promise.all([
    fplJson(`entry/${entry}/history/`, FRESH.bootstrap),
    fplJson("bootstrap-static/", FRESH.bootstrap).catch(() => null),
  ]);

  const past: CareerSeason[] = ((history?.past ?? []) as PastRow[]).map((row) => ({
    name: row.season_name,
    points: row.total_points,
    rank: row.rank || null,
    topPercent: percentOf(row.rank_percentage),
    inPlay: false,
  }));

  const rows = (history?.current ?? []) as CurrentRow[];
  const last = rows[rows.length - 1];
  const totalPlayers = Number(bootstrap?.total_players) || null;
  const current: CareerSeason | null = last
    ? {
        name: seasonName(bootstrap?.events ?? []),
        points: last.total_points,
        rank: last.overall_rank || null,
        topPercent:
          last.overall_rank && totalPlayers
            ? Math.max(1, Math.ceil((last.overall_rank / totalPlayers) * 100))
            : null,
        inPlay: true,
      }
    : null;

  const ranked = past.filter((season) => season.rank);
  const best = ranked.reduce<CareerSeason | null>((top, s) => (!top || (s.rank ?? 0) < (top.rank ?? 0) ? s : top), null);
  const worst = ranked.reduce<CareerSeason | null>((low, s) => (!low || (s.rank ?? 0) > (low.rank ?? 0) ? s : low), null);
  const pastPoints = past.reduce((sum, season) => sum + season.points, 0);

  return {
    past,
    current,
    totalPoints: pastPoints + (current?.points ?? 0),
    averagePoints: past.length ? Math.round(pastPoints / past.length) : null,
    best,
    worst: ranked.length >= 2 ? worst : null,
    facts: factsFor(past, current),
  };
}

// The last result per team, so the page opens complete (it is read before
// the page opens).
const careers = new Map<number, Career>();

export function loadCareerShared(entry: number): Promise<Career> {
  return loadCareer(entry).then((career) => {
    careers.set(entry, career);
    return career;
  });
}

export function peekCareer(entry: number): Career | null {
  return careers.get(entry) ?? null;
}
