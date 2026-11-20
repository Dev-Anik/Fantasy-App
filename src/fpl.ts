export type Row = {
  id: number;
  pos: number;
  name: string;
  team: string;
  teamId: number;
  type: number;
  cap: boolean;
  vice: boolean;
  sell: number;
  buy: number;
  price?: number;
  form?: string;
  ownership?: string;
  priceChange?: number;
  displayPoints?: number;
  multiplier?: number;
  minutes?: number;
  formMood?: "good" | "bad";
  fixtures?: PlayerFixture[];
  // Brought in by a transfer that hasn't been confirmed yet.
  pendingIn?: boolean;
  // Next-gameweek availability, from FPL: status "a" available, "d" doubtful,
  // "i" injured, "s" suspended, "u"/"n" unavailable.
  status?: string;
  // Percentage chance of playing next round when FPL has set one.
  chance?: number | null;
  news?: string;
  // Points view, live gameweek: projected automatic substitution.
  autoSub?: "in" | "out";
  // Points view, live gameweek: bonus from matches still in play.
  provisionalBonus?: number;
  // FPL's expected points for the next gameweek (ep_next), and the season total.
  epNext?: number | null;
  totalPoints?: number;
  // Season points per match, and expected goal involvements per 90 minutes.
  ppg?: number | null;
  xgi90?: number | null;
};

export type PlayerFixture = {
  event: number;
  opponent: string;
  venue: "H" | "A";
  difficulty: "easy" | "average" | "hard";
  // FPL's difficulty rating, 1 (easiest) to 5.
  fdr?: number;
  started?: boolean;
  finished?: boolean;
};

export type Player = {
  id: number;
  name: string;
  team: string;
  teamId: number;
  type: number;
  cost: number;
  pts: number;
  form: string;
  ownership: string;
  priceChange: number;
  status: string;
  chance?: number | null;
  news?: string;
  formMood?: "good" | "bad";
  // FPL's expected points for the next gameweek.
  epNext?: number | null;
  ppg?: number | null;
  xgi90?: number | null;
};

export type Squad = {
  entry: number;
  teamName: string;
  managerName: string;
  totalPoints: number;
  // Optional: squads cached by older app versions don't have these yet.
  overallRank?: number | null;
  eventPoints?: number | null;
  eventId?: number | null;
  gw: number;
  currentGw: number;
  bank: number;
  value: number;
  freeTransfers: number | null;
  hitCost: number;
  made: number;
  chip: string | null;
  availableChips: string[];
  chipStatuses: Record<string, string>;
  picks: Row[];
  pool: Player[];
  fixturesByTeam: Record<number, PlayerFixture[]>;
  leagues: FplLeague[];
  gameweeks: Gameweek[];
};

export type Gameweek = {
  id: number;
  name: string;
  finished: boolean;
  isCurrent: boolean;
  isNext?: boolean;
  deadlineTime?: string | null;
  // FPL's figures for the gameweek: the average score, the highest score and
  // the team (entry id) that scored it. Null until FPL has them.
  averageScore?: number | null;
  highestScore?: number | null;
  highestEntry?: number | null;
};

// Season label such as "26-27", derived from the first gameweek's deadline.
// Falls back to the calendar (seasons start in August) if no deadline is known.
export function seasonLabel(gameweeks: Gameweek[]): string {
  const firstDeadline = gameweeks.find((gw) => gw.id === 1)?.deadlineTime;
  const parsed = firstDeadline ? new Date(firstDeadline) : null;
  const startYear =
    parsed && !Number.isNaN(parsed.getTime())
      ? parsed.getFullYear()
      : new Date().getMonth() >= 6
        ? new Date().getFullYear()
        : new Date().getFullYear() - 1;
  const short = (year: number) => String(year % 100).padStart(2, "0");
  return `${short(startYear)}-${short(startYear + 1)}`;
}

export type LeagueType = "classic" | "h2h";

// How leagues are grouped on the leagues screen. "general" covers the leagues
// FPL enrols every manager in automatically (Overall, country, favourite club,
// gameweek leagues...), which the API reports with league_type "s" (system).
export type LeagueCategory = "classic" | "h2h" | "general";

export function leagueCategory(league: FplLeague): LeagueCategory {
  if (league.league_type === "s") return "general";
  return league.kind;
}

export type FplLeague = {
  id: number;
  name: string;
  kind: LeagueType;
  scoring: string;
  league_type: string;
  rank: number | null;
  entry_rank: number | null;
  entry_last_rank: number | null;
  rank_count: number;
  // First gameweek that counts towards this league's table.
  start_event?: number;
  has_cup?: boolean;
  entry_can_invite?: boolean;
};

export type LeagueStanding = {
  entry: number;
  entry_name: string;
  player_name: string;
  rank: number;
  last_rank: number | null;
  total: number;
  event_total: number;
  // h2h standings only
  matches_played?: number;
  matches_won?: number;
  matches_drawn?: number;
  matches_lost?: number;
  points_for?: number;
};

// One head-to-head fixture. An entry id of null is FPL's "AVERAGE" opponent,
// used when a league has an odd number of teams.
export type H2hMatch = {
  id: number;
  event: number;
  entry_1_entry: number | null;
  entry_1_name: string;
  entry_1_player_name: string;
  entry_1_points: number;
  entry_2_entry: number | null;
  entry_2_name: string;
  entry_2_player_name: string;
  entry_2_points: number;
  is_knockout?: boolean;
  winner?: number | null;
};

// Fresh headline numbers for the logged-in manager, read with their leagues.
export type EntrySummary = {
  totalPoints: number;
  overallRank: number | null;
  eventPoints: number | null;
  eventId: number | null;
};

export type LeagueStandings = {
  league: {
    id: number;
    name: string;
    scoring: string;
  };
  standings: {
    page: number;
    has_next: boolean;
    results: LeagueStanding[];
  };
};
export type MemberPick = {
  id: number;
  position: number;
  name: string;
  team: string;
  teamId: number;
  elementType: number;
  captain: boolean;
  viceCaptain: boolean;
  multiplier: number;
  points: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  bonus: number;
  formMood?: "good" | "bad";
};

export type MemberSquad = {
  entry: number;
  event: number;
  chip: string | null;
  history: {
    points: number | null;
    totalPoints: number | null;
    rank: number | null;
    overallRank: number | null;
    bank: number | null;
    value: number | null;
    transfers: number | null;
    transferCost: number | null;
    pointsOnBench: number | null;
  };
  picks: MemberPick[];
  // The gameweek's matches, for live bonus and automatic substitutions.
  fixtures?: LiveFixture[];
};

export type LiveFixture = {
  id: number;
  teamH: number;
  teamA: number;
  started: boolean;
  finished: boolean;
  // Final whistle blown; FPL marks it finished once the data is checked.
  finishedProvisional: boolean;
  // Bonus points system scores of everyone who played.
  bps: { element: number; value: number }[];
};
// The session is renewed by the app before a script runs (see auth.ts), so a
// script that is still refused has nothing left to try. Kept as a small stub
// so the save and transfer scripts keep their existing shape.
const NO_RELOGIN = `
    const attemptRelogin = async () => false;
    const hasStoredCreds = false;
  `;

// Runs inside the WebView, as a page on the FPL site. The caller wraps it with
// `withAuth`, which gives its `fetch` calls the access token.
export function buildFetchJs() {
  return `
(async () => {
  const send = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
  try {
    // null = FPL says nobody is signed in. Anything else that goes wrong (the
    // game updating, a server error, no network) throws, so an outage is never
    // mistaken for a sign-out.
    const getMe = async () => {
      const r = await fetch("https://fantasy.premierleague.com/api/me/", { credentials: "include", cache: "no-store" });
      if (r.status === 401 || r.status === 403) return null;
      if (!r.ok) throw new Error("api/me -> " + r.status);
      return r.json();
    };
    const me = await getMe();
    // FPL answers a rejected session with 200 and an empty player, so this
    // covers both that and a 401/403.
    if (!(me && me.player)) { send({ ok: false, notLoggedIn: true }); return; }
    const entry = me && me.player && me.player.entry;
    // A signed-in account with no entry has not created an FPL team yet.
    if (!entry) { send({ ok: false, notLoggedIn: true, noTeam: true }); return; }

    const j = async (u) => {
      const r = await fetch(u, { credentials: "include" });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        const error = new Error(
          u.replace("https://fantasy.premierleague.com/api/", "") + " -> " + r.status +
            (body ? " " + body.slice(0, 80) : "")
        );
        // FPL refused the sign-in for this call: the app renews it and retries.
        error.authRejected = r.status === 401 || r.status === 403;
        throw error;
      }
      return r.json();
    };
    const [bs, d, fixtures, entryData] = await Promise.all([
      j("https://fantasy.premierleague.com/api/bootstrap-static/"),
      j("https://fantasy.premierleague.com/api/my-team/" + entry + "/"),
      j("https://fantasy.premierleague.com/api/fixtures/"),
      j("https://fantasy.premierleague.com/api/entry/" + entry + "/")
    ]);
    const currentEvent = bs.events.find(e => e.is_current && !e.finished);
    const nextEvent = bs.events.find(e => e.is_next && !e.finished);
    const activeEvent = currentEvent || nextEvent || bs.events.find(e => !e.finished) || bs.events[0];
    const nextGameweek = nextEvent || activeEvent;
    const leagues = [
      ...(entryData.leagues.classic || []).map(l => ({ ...l, kind: "classic" })),
      ...(entryData.leagues.h2h || []).map(l => ({ ...l, kind: "h2h" }))
    ];
    const gameweeks = bs.events.map(e => ({
      id: e.id,
      name: e.name,
      finished: e.finished,
      isCurrent: Boolean(e.is_current),
      isNext: Boolean(e.is_next),
      deadlineTime: e.deadline_time || (e.deadline_time_epoch ? new Date(e.deadline_time_epoch * 1000).toISOString() : null),
      averageScore: typeof e.average_entry_score === "number" ? e.average_entry_score : null,
      highestScore: typeof e.highest_score === "number" ? e.highest_score : null,
      highestEntry: typeof e.highest_scoring_entry === "number" ? e.highest_scoring_entry : null
    }));
    const players = {};
    bs.elements.forEach(p => { players[p.id] = p; });
    const teams = {};
    bs.teams.forEach(t => { teams[t.id] = t.short_name; });
    const moodFor = value => {
      const form = typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
      return Number.isFinite(form)
        ? form >= 6
          ? "good"
          : form <= 2
            ? "bad"
            : undefined
        : undefined;
    };
    const fixturesByTeam = {};
    const fixturesFor = teamId => {
      if (!fixturesByTeam[teamId]) {
        fixturesByTeam[teamId] = fixtures
          .filter(fixture =>
            fixture.event != null &&
            (fixture.team_h === teamId || fixture.team_a === teamId)
          )
          .sort((a, b) => a.event - b.event || a.id - b.id)
          .map(fixture => {
            const isHome = fixture.team_h === teamId;
            const difficulty = isHome
              ? fixture.team_h_difficulty
              : fixture.team_a_difficulty;
            return {
              event: fixture.event,
              opponent: teams[isHome ? fixture.team_a : fixture.team_h] || "",
              venue: isHome ? "H" : "A",
              difficulty: difficulty <= 2
                ? "easy"
                : difficulty === 3
                  ? "average"
                  : "hard",
              fdr: difficulty,
              started: fixture.started ?? false,
              finished: fixture.finished ?? false,
            };
          });
      }
      return fixturesByTeam[teamId];
    };
    bs.teams.forEach(team => fixturesFor(team.id));

    const picks = d.picks.map(p => ({
      id: p.element,
      pos: p.position,
      name: players[p.element].web_name,
      team: teams[players[p.element].team],
      teamId: players[p.element].team,
      type: players[p.element].element_type,
      cap: p.is_captain,
      vice: p.is_vice_captain,
      sell: p.selling_price,
      buy: p.purchase_price,
      price: players[p.element].now_cost,
      form: players[p.element].form,
      ownership: players[p.element].selected_by_percent,
      priceChange: players[p.element].cost_change_event,
      displayPoints: players[p.element].event_points ?? null,
      formMood: moodFor(players[p.element].form),
      status: players[p.element].status,
      chance: players[p.element].chance_of_playing_next_round,
      news: players[p.element].news || "",
      fixtures: fixturesFor(players[p.element].team),
      epNext: players[p.element].ep_next == null || players[p.element].ep_next === "" ? null : Number(players[p.element].ep_next),
      totalPoints: players[p.element].total_points,
      ppg: players[p.element].points_per_game == null ? null : Number(players[p.element].points_per_game),
      xgi90: players[p.element].expected_goal_involvements_per_90 == null ? null : Number(players[p.element].expected_goal_involvements_per_90)
    }));

    const pool = bs.elements.map(p => ({
      id: p.id,
      name: p.web_name,
      team: teams[p.team],
      teamId: p.team,
      type: p.element_type,
      cost: p.now_cost,
      pts: p.total_points,
      form: p.form,
      ownership: p.selected_by_percent,
      priceChange: p.cost_change_event,
      status: p.status,
      chance: p.chance_of_playing_next_round,
      news: p.news || "",
      formMood: moodFor(p.form),
      epNext: p.ep_next == null || p.ep_next === "" ? null : Number(p.ep_next),
      ppg: p.points_per_game == null ? null : Number(p.points_per_game),
      xgi90: p.expected_goal_involvements_per_90 == null ? null : Number(p.expected_goal_involvements_per_90)
    }));

    const t = d.transfers || {};
    const activeChip = (d.chips || []).find(c => c.status_for_entry === "active");
    const availableChips = (d.chips || [])
      .filter(c => c.status_for_entry === "available")
      .map(c => c.name);
    const chipStatuses = {};
    (d.chips || []).forEach(c => {
      const currentStatus = chipStatuses[c.name];
      if (
        currentStatus !== "available" &&
        (c.status_for_entry === "available" ||
          (currentStatus !== "active" && c.status_for_entry === "active") ||
          (currentStatus !== "played" && c.status_for_entry === "played"))
      ) {
        chipStatuses[c.name] = c.status_for_entry;
      } else if (!currentStatus) {
        chipStatuses[c.name] = c.status_for_entry;
      }
    });
    send({
      ok: true,
      squad: {
        entry,
        teamName: entryData.name || "",
        managerName: entryData.player_name || "",
        totalPoints: entryData.summary_overall_points || 0,
        overallRank: entryData.summary_overall_rank || null,
        eventPoints: entryData.summary_event_points == null ? null : entryData.summary_event_points,
        eventId: entryData.current_event || null,
        gw: nextGameweek.id,
        currentGw: activeEvent.id,
        bank: t.bank,
        value: t.value,
        freeTransfers: t.limit == null ? null : Math.max(t.limit - (t.made || 0), 0),
        hitCost: t.cost == null ? 4 : t.cost,
        made: t.made || 0,
        chip: activeChip ? activeChip.name : null,
        availableChips,
        chipStatuses,
        picks,
        pool,
        fixturesByTeam,
        leagues,
        gameweeks
      }
    });
  } catch (e) {
    send({ ok: false, error: String(e), authRejected: !!(e && e.authRejected) });
  }
})();
true;
`;
}

export function buildSaveJs(
  entry: number,
  picks: Row[],
  chip: string | null = null,
) {
  const body = {
    chip,
    picks: [...picks]
      .sort((a, b) => a.pos - b.pos)
      .map((p) => ({
        element: p.id,
        position: p.pos,
        is_captain: p.cap,
        is_vice_captain: p.vice,
      })),
  };
  return `
(async () => {
  const send = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
  ${NO_RELOGIN}
  const getCsrf = () => {
    const parts = document.cookie.split(";").map((p) => p.trim());
    const c = parts.find((p) => p.startsWith("csrftoken="));
    if (c) return decodeURIComponent(c.slice("csrftoken=".length));
    const alt = parts.find((p) => p.toLowerCase().includes("csrf"));
    if (alt) return decodeURIComponent(alt.split("=")[1] || "");
    return "";
  };

  const doSave = async () => {
    const headers = { "Content-Type": "application/json" };
    const csrf = getCsrf();
    if (csrf) headers["X-CSRFToken"] = csrf;

    return await fetch("https://fantasy.premierleague.com/api/my-team/${entry}/", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(${JSON.stringify(body)})
    });
  };

  try {
    let r = await doSave();
    let reloginAttempted = false;

    if (r.status === 403 || r.status === 401) {
      reloginAttempted = hasStoredCreds;
      const relogged = await attemptRelogin();
      if (relogged) r = await doSave();
    }

    const text = await r.text();
    if (r.ok || r.status === 200) send({ saved: true });
    else send({ saveError: true, status: r.status, detail: text.slice(0, 300), reloginAttempted });
  } catch (e) {
    send({ saveError: true, status: null, detail: String(e) });
  }
})();
true;
`;
}
export type TransferItem = {
  out: number;
  inn: number;
  purchase: number; // price of the player coming in
  selling: number; // selling price of the player going out
};

export function buildTransferJs(
  entry: number,
  event: number,
  items: TransferItem[],
  chip: string | null = null,
) {
  const body = {
    chip,
    entry,
    event,
    transfers: items.map((i) => ({
      element_in: i.inn,
      element_out: i.out,
      purchase_price: i.purchase,
      selling_price: i.selling,
    })),
  };
  return `
(async () => {
  const send = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
  ${NO_RELOGIN}
  const getCsrf = () => {
    const parts = document.cookie.split(";").map((p) => p.trim());
    const c = parts.find((p) => p.startsWith("csrftoken="));
    if (c) return decodeURIComponent(c.slice("csrftoken=".length));
    const alt = parts.find((p) => p.toLowerCase().includes("csrf"));
    if (alt) return decodeURIComponent(alt.split("=")[1] || "");
    return "";
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);

  const doTransfer = async () => {
    const headers = { "Content-Type": "application/json" };
    const csrf = getCsrf();
    if (csrf) headers["X-CSRFToken"] = csrf;

    return await fetch("https://fantasy.premierleague.com/api/transfers/", {
      method: "POST",
      credentials: "include",
      signal: ctrl.signal,
      headers,
      body: JSON.stringify(${JSON.stringify(body)})
    });
  };

  try {
    let r = await doTransfer();
    let reloginAttempted = false;

    if (r.status === 403 || r.status === 401) {
      reloginAttempted = hasStoredCreds;
      const relogged = await attemptRelogin();
      if (relogged) r = await doTransfer();
    }

    clearTimeout(timer);
    const text = await r.text();
    if (r.ok || r.status === 200) send({ transferred: true });
    else send({ transferError: true, status: r.status, detail: text.slice(0, 300), reloginAttempted });
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === "AbortError") {
      send({ transferError: true, timedOut: true, detail: "timeout" });
    } else {
      send({ transferError: true, status: null, detail: String(e) });
    }
  }
})();
true;
`;
}
export type LeagueAction =
  | { action: "leagues"; entry: number }
  // silent: background refresh; its errors are not shown to the user.
  | { action: "standings"; league: FplLeague; page: number; silent?: boolean }
  | { action: "h2h-matches"; leagueId: number; event: number; silent?: boolean }
  | { action: "join"; code: string }
  | {
      action: "create";
      name: string;
      leagueType: LeagueType;
      startEvent: number;
      knockoutRounds?: number;
      maxEntries?: number;
    }
  | { action: "invite-code"; leagueId: number }
  | {
      action: "manager-gameweek";
      entry: number;
      event: number;
      // Background refresh: errors are not shown.
      silent?: boolean;
      // "home": the signed-in manager's live total for the home screen.
      target?: "home";
    };

export function buildLeagueActionJs(action: LeagueAction) {
  return `
(async () => {
  const send = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
  const action = ${JSON.stringify(action)};
  const api = "https://fantasy.premierleague.com/api/";

  // fresh: skip the WebView HTTP cache, for data that changes during a gameweek.
  const request = async (path, method, body, fresh) => {
    const headers = {};
    if (method === "POST") {
  headers["Content-Type"] = "application/json";

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("csrftoken="));

  if (cookie) {
    headers["X-CSRFToken"] = decodeURIComponent(
      cookie.slice("csrftoken=".length)
    );
  }
}
    const response = await fetch(api + path, {
      method,
      credentials: "include",
      headers,
      ...(fresh ? { cache: "no-store" } : {}),
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      let detail = null;
      if (data && typeof data === "object") {
        if (typeof data.detail === "string") {
          detail = data.detail;
        } else {
          const parts = Object.values(data)
            .map((value) =>
              Array.isArray(value)
                ? value.filter((v) => typeof v === "string").join(" ")
                : typeof value === "string"
                  ? value
                  : null
            )
            .filter(Boolean);
          if (parts.length) detail = parts.join(" ");
        }
      } else if (typeof data === "string" && data.trim()) {
        detail = data.trim().slice(0, 200);
      }
      throw new Error(
        detail ||
          (response.status === 401 || response.status === 403
            ? "You need to be logged in to do that."
            : "FPL rejected this request (status " + response.status + ").")
      );
    }
    return data;
  };

  try {
    if (action.action === "leagues") {
      // Bypass the WebView HTTP cache so ranks reflect FPL's latest table update.
      const response = await fetch(api + "entry/" + action.entry + "/", {
        credentials: "include",
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error("FPL rejected this request (status " + response.status + ").");
      }
      const entryData = await response.json();
      const source = (entryData && entryData.leagues) || {};
      send({
        leagueAction: "leagues",
        entry: action.entry,
        summary: {
          totalPoints: entryData.summary_overall_points || 0,
          overallRank: entryData.summary_overall_rank || null,
          eventPoints: entryData.summary_event_points == null ? null : entryData.summary_event_points,
          eventId: entryData.current_event || null
        },
        leagues: [
          ...(source.classic || []).map((l) => ({ ...l, kind: "classic" })),
          ...(source.h2h || []).map((l) => ({ ...l, kind: "h2h" }))
        ]
      });
      return;
    }

    if (action.action === "standings") {
      const path = action.league.kind === "classic"
        ? "leagues-classic/" + action.league.id + "/standings/?page_standings=" + action.page
        : "leagues-h2h/" + action.league.id + "/standings/?page_standings=" + action.page;
      const data = await request(path, "GET", undefined, true);
      // Echo what was asked for so a slow response can't land on another league.
      send({
        leagueAction: "standings",
        leagueId: action.league.id,
        kind: action.league.kind,
        page: action.page,
        silent: !!action.silent,
        data
      });
      return;
    }

    if (action.action === "h2h-matches") {
      // Big leagues split a gameweek's fixtures across pages; read them all.
      const results = [];
      for (let page = 1; page <= 20; page++) {
        const data = await request(
          "leagues-h2h-matches/league/" + action.leagueId + "/?event=" + action.event + "&page=" + page,
          "GET",
          undefined,
          true
        );
        results.push(...((data && data.results) || []));
        if (!data || !data.has_next) break;
      }
      send({
        leagueAction: "h2h-matches",
        leagueId: action.leagueId,
        event: action.event,
        silent: !!action.silent,
        results
      });
      return;
    }

    if (action.action === "invite-code") {
  const result = await request("league/" + action.leagueId + "/code/", "GET");
  if (!result || !result.code) {
    throw new Error("FPL did not return an invite code for this league.");
  }
  send({
    leagueAction: "invite-code",
    leagueId: action.leagueId,
    inviteCode: result.code
  });
  return;
}

if (action.action === "manager-gameweek") {
  const [bootstrap, live, gameweekFixtures, response] = await Promise.all([
    request("bootstrap-static/", "GET"),
    // Live data changes by the minute during matches: skip the cache.
    request("event/" + action.event + "/live/", "GET", undefined, true),
    request("fixtures/?event=" + action.event, "GET", undefined, true),
    fetch(
      api + "entry/" + action.entry + "/event/" + action.event + "/picks/",
      { credentials: "include", cache: "no-store" }
    )
  ]);
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 403) {
      throw new Error("This manager's picks are private for gameweek " + action.event + ".");
    }
    if (response.status === 404) {
      throw new Error("FPL has not published this manager's picks for gameweek " + action.event + ".");
    }
    throw new Error(
      "FPL returned " + response.status + ": " + text.slice(0, 250)
    );
  }
  const squadData = await response.json();

  const players = {};
  bootstrap.elements.forEach(player => {
    players[player.id] = player;
  });

  const teams = {};
  bootstrap.teams.forEach(team => {
    teams[team.id] = team.short_name;
  });

  const liveElements = {};
  live.elements.forEach(element => {
    liveElements[element.id] = element.stats;
  });

  const picks = squadData.picks.map(pick => {
    const player = players[pick.element];
    if (!player) {
      throw new Error("FPL did not return details for player " + pick.element);
    }
    const stats = pick.stats || liveElements[pick.element];
    if (!stats) {
      throw new Error(
        "FPL did not return gameweek stats for player " + player.web_name
      );
    }
    const form =
      typeof player.form === "string" && player.form.trim() !== ""
        ? Number(player.form)
        : Number.NaN;
    const formMood = Number.isFinite(form)
      ? form >= 6
        ? "good"
        : form <= 2
          ? "bad"
          : undefined
      : undefined;

    return {
      id: pick.element,
      position: pick.position,
      name: player.web_name,
      team: teams[player.team] || "",
      teamId: player.team,
      elementType: player.element_type,
      captain: pick.is_captain,
      viceCaptain: pick.is_vice_captain,
      multiplier: pick.multiplier,
      points: stats.points == null ? stats.total_points || 0 : stats.points,
      minutes: stats.minutes || 0,
      goals: stats.goals_scored || 0,
      assists: stats.assists || 0,
      cleanSheets: stats.clean_sheets || 0,
      bonus: stats.bonus || 0,
      formMood
    };
  });

  const fixtures = (gameweekFixtures || []).map(fixture => {
    const bpsStat = (fixture.stats || []).find(stat => stat.identifier === "bps");
    const bps = bpsStat
      ? [...(bpsStat.h || []), ...(bpsStat.a || [])].map(row => ({
          element: row.element,
          value: row.value
        }))
      : [];
    return {
      id: fixture.id,
      teamH: fixture.team_h,
      teamA: fixture.team_a,
      started: !!fixture.started,
      finished: !!fixture.finished,
      finishedProvisional: !!fixture.finished_provisional,
      bps
    };
  });

  send({
    leagueAction: "manager-gameweek",
    silent: !!action.silent,
    target: action.target || null,
    data: {
      entry: action.entry,
      event: action.event,
      chip: squadData.active_chip || null,
      fixtures,
      history: {
        points: squadData.entry_history ? squadData.entry_history.points : null,
        totalPoints: squadData.entry_history ? squadData.entry_history.total_points : null,
        rank: squadData.entry_history ? squadData.entry_history.rank : null,
        overallRank: squadData.entry_history ? squadData.entry_history.overall_rank : null,
        bank: squadData.entry_history ? squadData.entry_history.bank : null,
        value: squadData.entry_history ? squadData.entry_history.value : null,
        transfers: squadData.entry_history ? squadData.entry_history.event_transfers : null,
        transferCost: squadData.entry_history ? squadData.entry_history.event_transfers_cost : null,
        pointsOnBench: squadData.entry_history ? squadData.entry_history.points_on_bench : null
      },
      picks
    }
  });
  return;
}
    if (action.action === "join") {
      await request("league/code-check/", "POST", { code: action.code });
      await request("leagues-private/join/", "POST", { code: action.code });
      send({ leagueAction: "joined" });
      return;
    }

    const path = action.leagueType === "classic"
      ? "leagues-classic/"
      : "leagues-h2h/";
    const body = action.leagueType === "classic"
      ? { name: action.name, has_cup: true, start_event: action.startEvent }
      : { name: action.name, start_event: action.startEvent };
    if (action.maxEntries) body.max_entries = action.maxEntries;
    if (action.leagueType === "h2h" && action.knockoutRounds) {
      body.ko_rounds = action.knockoutRounds;
    }

    const created = await request(path, "POST", body);
    const leagueId = created && (created.id || (created.league && created.league.id));
    let inviteCode = null;
    let inviteCodeError = null;

    if (leagueId) {
      try {
        const codeResponse = await request("league/" + leagueId + "/code/", "GET");
        inviteCode = codeResponse && codeResponse.code;
      } catch (e) {
        inviteCodeError = (e && e.message) || String(e);
      }
    }

    send({ leagueAction: "created", leagueId, inviteCode, inviteCodeError });
  } catch (e) {
    send({
      leagueAction: "error",
      action: action.action,
      entry: action.entry,
      event: action.event,
      leagueId: action.leagueId || (action.league && action.league.id),
      silent: !!action.silent,
      target: action.target || null,
      error: (e && e.message) || String(e)
    });
  }
})();
true;
`;
}
