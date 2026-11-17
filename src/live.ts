// Live gameweek scoring: provisional bonus and projected automatic
// substitutions, worked out the way FPL will once the gameweek is processed.
// Pure functions, so they can be checked without the app.
import type { LiveFixture, MemberPick } from "./fpl";

export type LivePick = MemberPick & {
  // Points shown for the player, including provisional bonus. Not multiplied.
  livePoints: number;
  // Bonus from matches still in play, not yet added by FPL.
  provisionalBonus: number;
  // What the player's points count for after subs and the armband: 0 = not
  // counted, 1, 2 (captain) or 3 (triple captain).
  effectiveMultiplier: number;
  // Projected automatic substitution.
  autoSub?: "in" | "out";
  // Wears the armband after a projected switch from captain to vice.
  actingCaptain?: boolean;
  // All of this player's matches this gameweek are over (or he has none).
  done: boolean;
};

export type LiveResult = {
  picks: LivePick[];
  // Gameweek points before transfer hits, as FPL shows them.
  total: number;
  // Players in the counting eleven whose matches are not over yet.
  stillToPlay: number;
};

// Bonus for one match from its BPS table: 3, 2 and 1 for the top three, where
// tied players share the higher award and the next award is skipped, as in FPL
// (two tied for first get 3 each and the next player 1).
export function matchBonus(bps: { element: number; value: number }[]) {
  const awards: Record<number, number> = {};
  bps.forEach(({ element, value }) => {
    const rank = 1 + bps.filter((other) => other.value > value).length;
    const points = rank === 1 ? 3 : rank === 2 ? 2 : rank === 3 ? 1 : 0;
    if (points > 0) awards[element] = (awards[element] ?? 0) + points;
  });
  return awards;
}

// Bonus from every match that has kicked off but whose bonus FPL has not
// added yet (it is added once a match is marked finished).
export function provisionalBonus(fixtures: LiveFixture[]) {
  const totals: Record<number, number> = {};
  fixtures
    .filter((fixture) => fixture.started && !fixture.finished && fixture.bps.length > 0)
    .forEach((fixture) => {
      Object.entries(matchBonus(fixture.bps)).forEach(([element, points]) => {
        totals[Number(element)] = (totals[Number(element)] ?? 0) + points;
      });
    });
  return totals;
}

function teamDone(teamId: number, fixtures: LiveFixture[]) {
  return fixtures
    .filter((fixture) => fixture.teamH === teamId || fixture.teamA === teamId)
    .every((fixture) => fixture.finished || fixture.finishedProvisional);
}

// A starting eleven must keep 1 GK, 3+ DEF, 2+ MID and 1+ FWD.
function validFormation(types: number[]) {
  const count = (type: number) => types.filter((t) => t === type).length;
  return count(1) === 1 && count(2) >= 3 && count(3) >= 2 && count(4) >= 1;
}

export function computeLive(
  picks: MemberPick[],
  fixtures: LiveFixture[],
  chip: string | null,
): LiveResult {
  const bonus = provisionalBonus(fixtures);
  const benchBoost = chip === "bboost";
  const captainMultiplier =
    chip === "3xc"
      ? 3
      : Math.max(2, ...picks.filter((p) => p.captain).map((p) => p.multiplier || 0));

  const live: LivePick[] = [...picks]
    .sort((a, b) => a.position - b.position)
    .map((pick) => {
      const provisional = bonus[pick.id] ?? 0;
      return {
        ...pick,
        provisionalBonus: provisional,
        livePoints: (pick.points ?? 0) + provisional,
        effectiveMultiplier: pick.position <= 11 || benchBoost ? 1 : 0,
        done: teamDone(pick.teamId, fixtures),
      };
    });

  const played = (p: LivePick) => (p.minutes ?? 0) > 0;
  // Definitely will not play: no minutes and every match of his is over.
  const missed = (p: LivePick) => !played(p) && p.done;

  // Projected automatic substitutions (none with Bench Boost: all 15 count).
  if (!benchBoost) {
    const eleven = live.filter((p) => p.position <= 11);
    const bench = live.filter((p) => p.position > 11);
    const used = new Set<number>();
    eleven.forEach((starter) => {
      if (!missed(starter)) return;
      for (const sub of bench) {
        if (used.has(sub.id)) continue;
        // Goalkeepers only swap with goalkeepers.
        if ((starter.elementType === 1) !== (sub.elementType === 1)) continue;
        const types = live
          .filter((p) => p.effectiveMultiplier > 0 && p.id !== starter.id)
          .map((p) => p.elementType)
          .concat(sub.elementType);
        if (!validFormation(types)) continue;
        if (played(sub)) {
          used.add(sub.id);
          starter.effectiveMultiplier = 0;
          starter.autoSub = "out";
          sub.effectiveMultiplier = 1;
          sub.autoSub = "in";
          return;
        }
        // An earlier bench player may still come on: FPL would pick him, so
        // nothing can be projected for this starter yet.
        if (!sub.done) return;
      }
    });
  }

  // The armband passes to the vice-captain if the captain does not play.
  const captain = live.find((p) => p.captain);
  const vice = live.find((p) => p.viceCaptain);
  const wearer = captain && missed(captain) && vice && !missed(vice) ? vice : captain;
  if (wearer && wearer.effectiveMultiplier > 0) {
    wearer.effectiveMultiplier = captainMultiplier;
    wearer.actingCaptain = wearer !== captain;
  }

  const counting = live.filter((p) => p.effectiveMultiplier > 0);
  return {
    picks: live,
    total: counting.reduce((sum, p) => sum + p.livePoints * p.effectiveMultiplier, 0),
    stillToPlay: counting.filter((p) => !p.done).length,
  };
}
