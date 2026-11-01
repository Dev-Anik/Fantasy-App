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
  status: string;
};

export type Squad = {
  entry: number;
  gw: number;
  bank: number;
  value: number;
  freeTransfers: number | null;
  hitCost: number;
  made: number;
  chip: string | null;
  picks: Row[];
  pool: Player[];
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
    const bs = await j("https://fantasy.premierleague.com/api/bootstrap-static/");
    const d = await j("https://fantasy.premierleague.com/api/my-team/" + entry + "/");
    const ev = bs.events.find(e => e.is_next) || bs.events.find(e => e.is_current) || bs.events[0];

    const players = {};
    bs.elements.forEach(p => { players[p.id] = p; });
    const teams = {};
    bs.teams.forEach(t => { teams[t.id] = t.short_name; });

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
      buy: p.purchase_price
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
      status: p.status
    }));

    const t = d.transfers || {};
    const activeChip = (d.chips || []).find(c => c.status_for_entry === "active");
    send({
      ok: true,
      squad: {
        entry,
        gw: ev.id,
        bank: t.bank,
        value: t.value,
        freeTransfers: t.limit == null ? null : Math.max(t.limit - (t.made || 0), 0),
        hitCost: t.cost == null ? 4 : t.cost,
        made: t.made || 0,
        chip: activeChip ? activeChip.name : null,
        picks,
        pool
      }
    });
  } catch (e) {
    send({ ok: false, error: String(e) });
  }
})();
true;
`;

export function buildSaveJs(entry: number, picks: Row[]) {
  const body = {
    chip: null,
    picks: picks.map((p) => ({
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
) {
  const body = {
    chip: null,
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
