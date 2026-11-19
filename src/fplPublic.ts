// FPL's public player and club list (bootstrap-static), read once per app
// session and shared by the screens that need names: the live league table
// and the match centre. It is a large file, so it is never fetched twice.

const API = "https://fantasy.premierleague.com/api/";

export type PlayerInfo = { name: string; team: string; teamId: number; type: number };
export type TeamInfo = { short: string; name: string };
export type ChipWindowInfo = { name: string; start: number; stop: number };
export type FplBasics = {
  players: Map<number, PlayerInfo>;
  teams: Map<number, TeamInfo>;
  // When each chip can be played (FPL splits the season into two halves).
  chipWindows: ChipWindowInfo[];
};

let basics: Promise<FplBasics> | null = null;

export function loadFplBasics(): Promise<FplBasics> {
  if (!basics) {
    basics = fetch(API + "bootstrap-static/")
      .then((response) => {
        if (!response.ok) throw new Error(`FPL returned ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const teams = new Map<number, TeamInfo>(
          (data.teams ?? []).map((team: { id: number; short_name: string; name: string }) => [
            team.id,
            { short: team.short_name, name: team.name },
          ]),
        );
        const players = new Map<number, PlayerInfo>(
          (data.elements ?? []).map((e: { id: number; web_name: string; team: number; element_type: number }) => [
            e.id,
            { name: e.web_name, team: teams.get(e.team)?.short ?? "", teamId: e.team, type: e.element_type },
          ]),
        );
        const chipWindows: ChipWindowInfo[] = (data.chips ?? [])
          .filter((chip: { name?: string; start_event?: number; stop_event?: number }) => chip.name && chip.start_event && chip.stop_event)
          .map((chip: { name: string; start_event: number; stop_event: number }) => ({
            name: chip.name,
            start: chip.start_event,
            stop: chip.stop_event,
          }));
        return { players, teams, chipWindows };
      });
    // A failed read is not remembered: the next screen tries again.
    basics.catch(() => {
      basics = null;
    });
  }
  return basics;
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
