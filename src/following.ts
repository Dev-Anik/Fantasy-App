// Managers the user follows: other FPL teams, followed from their team page
// or found by team ID, listed on the Following page. Kept on the phone (FPL
// has no following of its own), so the list stays between visits.
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FRESH, fplJson } from "./fplCache";

const KEY = "profpl_following";

export type Followed = { entry: number; teamName: string; managerName: string };

let list: Followed[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

// Read once at launch; the page and the follow buttons draw from memory.
export async function loadFollowing(): Promise<Followed[]> {
  if (loaded) return list;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    list = Array.isArray(parsed)
      ? parsed.filter((item): item is Followed => typeof item?.entry === "number")
      : [];
  } catch {
    list = [];
  }
  loaded = true;
  notify();
  return list;
}

function save() {
  AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
  notify();
}

export function follow(team: Followed) {
  if (list.some((item) => item.entry === team.entry)) return;
  list = [team, ...list];
  save();
}

export function unfollow(entry: number) {
  list = list.filter((item) => item.entry !== entry);
  save();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => list;

// The followed managers, kept current on every screen that shows them.
export function useFollowing() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

// A team's public summary: names, this gameweek's points, season total and
// overall rank. null if FPL has no team with that ID; a failed read throws.
export type TeamSummary = {
  entry: number;
  teamName: string;
  managerName: string;
  eventPoints: number | null;
  totalPoints: number | null;
  overallRank: number | null;
};

export async function loadTeamSummary(entry: number): Promise<TeamSummary | null> {
  try {
    const data = await fplJson(`entry/${entry}/`, FRESH.bootstrap);
    if (!data || typeof data.name !== "string") return null;
    return {
      entry,
      teamName: data.name,
      managerName: [data.player_first_name, data.player_last_name].filter(Boolean).join(" "),
      eventPoints: typeof data.summary_event_points === "number" ? data.summary_event_points : null,
      totalPoints: typeof data.summary_overall_points === "number" ? data.summary_overall_points : null,
      overallRank: typeof data.summary_overall_rank === "number" ? data.summary_overall_rank : null,
    };
  } catch (error) {
    // FPL answers 404 for an ID with no team; anything else is a failed read.
    if (error instanceof Error && error.message.includes("404")) return null;
    throw error;
  }
}

// Summaries of every followed team, read before the page opens (and kept,
// so it opens complete). A few at a time, so a long list doesn't flood FPL.
const summaries = new Map<number, TeamSummary>();

export async function loadFollowingSummaries(): Promise<void> {
  const teams = await loadFollowing();
  for (let i = 0; i < teams.length; i += 6) {
    const batch = await Promise.all(teams.slice(i, i + 6).map((team) => loadTeamSummary(team.entry).catch(() => null)));
    batch.forEach((summary) => {
      if (summary) summaries.set(summary.entry, summary);
    });
  }
}

export function peekSummary(entry: number): TeamSummary | null {
  return summaries.get(entry) ?? null;
}

export function rememberSummary(summary: TeamSummary) {
  summaries.set(summary.entry, summary);
}
