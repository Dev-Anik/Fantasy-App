// FPL's public player and club list (bootstrap-static), read once per app
// session and shared by the screens that need names: the live league table
// and the match centre. It is a large file, so it is never fetched twice
// (the download itself is shared with the rest of the app: fplCache.ts).
import { FRESH, fplJson } from "./fplCache";

const API = "https://fantasy.premierleague.com/api/";

// `form`: FPL's recent points average (NaN when FPL gives none).
export type PlayerInfo = { name: string; team: string; teamId: number; type: number; form: number };
export type TeamInfo = { short: string; name: string };
export type ChipWindowInfo = { name: string; start: number; stop: number };
export type FplBasics = {
  players: Map<number, PlayerInfo>;
  teams: Map<number, TeamInfo>;
  // When each chip can be played (FPL splits the season into two halves).
  chipWindows: ChipWindowInfo[];
};

let basics: Promise<FplBasics> | null = null;
let basicsValue: FplBasics | null = null;

// The names, once they have arrived (for drawing a page at once).
export function peekFplBasics(): FplBasics | null {
  return basicsValue;
}

export function loadFplBasics(): Promise<FplBasics> {
  if (!basics) {
    basics = fplJson("bootstrap-static/", FRESH.settled)
      .then((data) => {
        const teams = new Map<number, TeamInfo>(
          (data.teams ?? []).map((team: { id: number; short_name: string; name: string }) => [
            team.id,
            { short: team.short_name, name: team.name },
          ]),
        );
        const players = new Map<number, PlayerInfo>(
          (data.elements ?? []).map(
            (e: { id: number; web_name: string; team: number; element_type: number; form?: string }) => [
              e.id,
              {
                name: e.web_name,
                team: teams.get(e.team)?.short ?? "",
                teamId: e.team,
                type: e.element_type,
                form: typeof e.form === "string" && e.form.trim() !== "" ? Number(e.form) : Number.NaN,
              },
            ],
          ),
        );
        const chipWindows: ChipWindowInfo[] = (data.chips ?? [])
          .filter((chip: { name?: string; start_event?: number; stop_event?: number }) => chip.name && chip.start_event && chip.stop_event)
          .map((chip: { name: string; start_event: number; stop_event: number }) => ({
            name: chip.name,
            start: chip.start_event,
            stop: chip.stop_event,
          }));
        basicsValue = { players, teams, chipWindows };
        return basicsValue;
      });
    // A failed read is not remembered: the next screen tries again.
    basics.catch(() => {
      basics = null;
    });
  }
  return basics;
}

// A team's overall rank after each gameweek played (public entry history).
// Resolves to an empty list if FPL can't be reached.
export type RankPoint = { event: number; rank: number };
export function loadOverallRanks(entry: number): Promise<RankPoint[]> {
  return fplJson(`entry/${entry}/history/`, FRESH.bootstrap)
    .then((data) =>
      Array.isArray(data?.current)
        ? data.current
            .filter((row: { overall_rank?: number | null }) => typeof row.overall_rank === "number" && row.overall_rank > 0)
            .map((row: { event: number; overall_rank: number }) => ({ event: row.event, rank: row.overall_rank }))
        : [],
    )
    .catch(() => []);
}

// A team's name and its manager's name (public entry data), cached for the
// session. Resolves to null if FPL can't be reached.
export type EntryName = { teamName: string; managerName: string };
const entryNames = new Map<number, Promise<EntryName | null>>();

export function loadEntryName(entry: number): Promise<EntryName | null> {
  let pending = entryNames.get(entry);
  if (!pending) {
    pending = fetch(`${API}entry/${entry}/`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && typeof data.name === "string"
          ? {
              teamName: data.name,
              managerName: [data.player_first_name, data.player_last_name].filter(Boolean).join(" "),
            }
          : null,
      )
      .catch(() => null);
    // Only successful answers are kept; a failure is tried again next time.
    pending.then((result) => {
      if (!result) entryNames.delete(entry);
    });
    entryNames.set(entry, pending);
  }
  return pending;
}
