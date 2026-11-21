-- Skippr live alerts: push notifications while Premier League matches are
-- played (a player starts, scores, assists, is booked; full-time summaries).
--
-- Only the Edge Functions use these tables, with the project's secret key.
-- Row Level Security is on with no policies, so nothing else (not even the
-- app's publishable key) can read or change them.

-- A phone that wants alerts: its Expo push token, the FPL team it follows,
-- and which alerts it wants. No passwords, emails or FPL sign-in tokens.
create table public.alert_devices (
  token text primary key,
  entry integer not null check (entry > 0),
  platform text not null default 'android' check (platform in ('android', 'ios')),
  -- { started, goals, cards, fulltime, bench } booleans; missing keys use
  -- the defaults in the worker.
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index alert_devices_entry_idx on public.alert_devices (entry);

-- Each followed team's picks for a gameweek (public FPL data), fetched once
-- after the deadline: [{ "e": element, "m": multiplier, "p": position }].
create table public.alert_picks (
  entry integer not null,
  event integer not null,
  picks jsonb not null,
  chip text,
  fetched_at timestamptz not null default now(),
  primary key (entry, event)
);

-- The worker's memory between runs (a single row): the gameweek, every
-- player's stats at the last look, each fixture's state, player names, and
-- a lock so two runs never overlap.
create table public.alert_state (
  id integer primary key default 1 check (id = 1),
  event integer,
  deadline timestamptz,
  -- element id -> compact stats { m, g, a, y, r, og, ps, pm, p }
  live jsonb not null default '{}'::jsonb,
  -- fixture id -> { s: started, f: finished }
  fixtures jsonb not null default '{}'::jsonb,
  -- element id -> [web name, team id, position type]
  players jsonb not null default '{}'::jsonb,
  -- team id -> short name
  teams jsonb not null default '{}'::jsonb,
  players_at timestamptz,
  -- Nothing to do before this time (no match close): runs return at once.
  idle_until timestamptz not null default 'epoch',
  locked_until timestamptz not null default 'epoch',
  updated_at timestamptz not null default now()
);
insert into public.alert_state (id) values (1);

alter table public.alert_devices enable row level security;
alter table public.alert_picks enable row level security;
alter table public.alert_state enable row level security;

-- Access, stated outright rather than left to the project's default
-- settings: only service_role (the Edge Functions' secret key) may use these
-- tables; anon and authenticated (anyone with the app's publishable key)
-- get nothing.
revoke all on table public.alert_devices, public.alert_picks, public.alert_state from anon, authenticated;
grant select, insert, update, delete on table public.alert_devices, public.alert_picks, public.alert_state to service_role;

-- Old gameweeks' picks are no longer needed.
create index alert_picks_event_idx on public.alert_picks (event);
