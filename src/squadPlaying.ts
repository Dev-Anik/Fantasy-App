// Whether a match involving one of the signed-in manager's players is under
// way right now. Live dots only pulse while it is (see LiveDot); set from the
// home screen's live reading of the squad.
import { useSyncExternalStore } from "react";
import type { LiveFixture } from "./fpl";

let playing = false;
const listeners = new Set<() => void>();

export function setSquadPlaying(next: boolean) {
  if (next === playing) return;
  playing = next;
  listeners.forEach((listener) => listener());
}

export function useSquadPlaying() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => playing,
  );
}

// A match of one of these clubs has kicked off and not reached full time.
export function clubsPlaying(teamIds: number[], fixtures: LiveFixture[]) {
  const clubs = new Set(teamIds);
  return fixtures.some(
    (fixture) =>
      fixture.started &&
      !fixture.finished &&
      !fixture.finishedProvisional &&
      (clubs.has(fixture.teamH) || clubs.has(fixture.teamA)),
  );
}
