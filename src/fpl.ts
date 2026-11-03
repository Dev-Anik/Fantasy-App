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
  formMood?: "good" | "bad";
  fixtures?: PlayerFixture[];
};

export type PlayerFixture = {
  event: number;
  opponent: string;
  venue: "H" | "A";
  difficulty: "easy" | "average" | "hard";
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
  formMood?: "good" | "bad";
};

export type Squad = {
  entry: number;
  teamName: string;
  managerName: string;
  totalPoints: number;
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
};

export type LeagueType = "classic" | "h2h";

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
};
// Runs inside the WebView, because the login session lives there
export const FETCH_JS = `
(async () => {
  const send = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
  try {
    const meRes = await fetch("https://fantasy.premierleague.com/api/me/", { credentials: "include" });
    if (meRes.status === 401 || meRes.status === 403) { send({ ok: false, notLoggedIn: true }); return; }
    const me = await meRes.json().catch(() => null);
    const entry = me && me.player && me.player.entry;
    if (!entry) { send({ ok: false, notLoggedIn: true }); return; }

    const j = async (u) => {
      const r = await fetch(u, { credentials: "include" });
      if (!r.ok) throw new Error(u + " -> " + r.status);
      return r.json();
    };
    const [bs, d, fixtures] = await Promise.all([
      j("https://fantasy.premierleague.com/api/bootstrap-static/"),
      j("https://fantasy.premierleague.com/api/my-team/" + entry + "/"),
      j("https://fantasy.premierleague.com/api/fixtures/")
    ]);
    const currentEvent = bs.events.find(e => e.is_current && !e.finished);
    const nextEvent = bs.events.find(e => e.is_next && !e.finished);
    const activeEvent = currentEvent || nextEvent || bs.events.find(e => !e.finished) || bs.events[0];
    const nextGameweek = nextEvent || activeEvent;
    const entryData = await j("https://fantasy.premierleague.com/api/entry/" + entry + "/");
    const leagues = [
      ...(entryData.leagues.classic || []).map(l => ({ ...l, kind: "classic" })),
      ...(entryData.leagues.h2h || []).map(l => ({ ...l, kind: "h2h" }))
    ];
    const gameweeks = bs.events.map(e => ({
      id: e.id,
      name: e.name,
      finished: e.finished,
      isCurrent: e.id === activeEvent.id
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
                  : "hard"
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
      formMood: moodFor(players[p.element].form),
      fixtures: fixturesFor(players[p.element].team)
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
      formMood: moodFor(p.form)
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
    send({ ok: false, error: String(e) });
  }
})();
true;
`;

export function buildSaveJs(entry: number, picks: Row[], chip: string | null = null) {
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
  try {
    const r = await fetch("https://fantasy.premierleague.com/api/my-team/${entry}/", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(${JSON.stringify(body)})
    });
    const text = await r.text();
    if (r.ok) send({ saved: true });
    else send({ ok: false, saveError: "Status " + r.status + ": " + text.slice(0, 150) });
  } catch (e) {
    send({ ok: false, saveError: String(e) });
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
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch("https://fantasy.premierleague.com/api/transfers/", {
      method: "POST",
      credentials: "include",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(${JSON.stringify(body)})
    });
    clearTimeout(timer);
    const text = await r.text();
    if (r.ok) send({ transferred: true });
    else send({ transferError: "Status " + r.status + ": " + text.slice(0, 200) });
  } catch (e) {
    send({
      transferError: (e && e.name === "AbortError")
        ? "Timed out. The transfer may or may not have gone through. Check the FPL site before trying again."
        : String(e)
    });
  }
})();
true;
`;
}
type LeagueAction =
  | { action: "standings"; league: FplLeague; page: number }
  | { action: "join"; code: string }
  | {
      action: "create";
      name: string;
      leagueType: LeagueType;
      startEvent: number;
    }
  | { action: "invite-code"; leagueId: number }
  | { action: "manager-gameweek"; entry: number; event: number };

export function buildLeagueActionJs(action: LeagueAction) {
  return `
(async () => {
  const send = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
  const action = ${JSON.stringify(action)};
  const api = "https://fantasy.premierleague.com/api/";

  const request = async (path, method, body) => {
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
      throw new Error("FPL returned " + response.status + ": " + String(text).slice(0, 250));
    }
    return data;
  };

  try {
    if (action.action === "standings") {
      const path = action.league.kind === "classic"
        ? "leagues-classic/" + action.league.id + "/standings/?page_standings=" + action.page
        : "leagues-h2h/" + action.league.id + "/standings/?page_standings=" + action.page;
      const data = await request(path, "GET");
      send({ leagueAction: "standings", data });
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
  const [bootstrap, live, response] = await Promise.all([
    request("bootstrap-static/", "GET"),
    request("event/" + action.event + "/live/", "GET"),
    fetch(
      api + "entry/" + action.entry + "/event/" + action.event + "/picks/",
      { credentials: "include" }
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

  send({
    leagueAction: "manager-gameweek",
    data: {
      entry: action.entry,
      event: action.event,
      chip: squadData.active_chip || null,
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

    const created = await request(path, "POST", body);
    const leagueId = created && (created.id || (created.league && created.league.id));
    let inviteCode = null;
    let inviteCodeError = null;

    if (leagueId) {
      try {
        const codeResponse = await request("league/" + leagueId + "/code/", "GET");
        inviteCode = codeResponse && codeResponse.code;
      } catch (e) {
        inviteCodeError = String(e);
      }
    }

    send({ leagueAction: "created", leagueId, inviteCode, inviteCodeError });
  } catch (e) {
    send({
      leagueAction: "error",
      action: action.action,
      entry: action.entry,
      event: action.event,
      error: String(e)
    });
  }
})();
true;
`;
}
