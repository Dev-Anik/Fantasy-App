// Extra information the user can choose to show on the home pitch's player
// cards (up to two), remembered on the device.
import { createContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Row } from "./fpl";
import { estimatePoints } from "./gameweekAdvice";

export type CardStatKey = "est" | "form" | "price" | "total" | "ppg" | "owned";

export const MAX_CARD_STATS = 2;
const STORAGE_KEY = "profpl_card_stats";

export const CARD_STAT_OPTIONS: { key: CardStatKey; title: string; detail: string; short: string }[] = [
  {
    key: "est",
    title: "Estimated points",
    detail: "ProFPL's own estimate for the next gameweek, not an FPL figure",
    short: "EST",
  },
  { key: "form", title: "Form", detail: "Average points per match over the last 30 days", short: "FORM" },
  { key: "price", title: "Price", detail: "Current price, in millions", short: "£M" },
  { key: "total", title: "Total points", detail: "Points this season", short: "PTS" },
  { key: "ppg", title: "Points per match", detail: "Season average", short: "PPM" },
  { key: "owned", title: "Selected by", detail: "Share of managers who own the player", short: "SEL" },
];

const KEYS = new Set<CardStatKey>(CARD_STAT_OPTIONS.map((option) => option.key));

// The value printed on the card, or null when FPL has none for the player.
export function cardStatValue(key: CardStatKey, row: Row, event: number | undefined): string | null {
  switch (key) {
    case "est":
      return event == null ? null : estimatePoints(row, event).toFixed(1);
    case "form": {
      const form = parseFloat(row.form ?? "");
      return Number.isFinite(form) ? form.toFixed(1) : null;
    }
    case "price": {
      const price = row.price ?? row.buy;
      // Short, to fit beside the head; the label says £M.
      return price ? (price / 10).toFixed(1) : null;
    }
    case "total":
      return row.totalPoints == null ? null : String(row.totalPoints);
    case "ppg":
      return row.ppg == null || !Number.isFinite(row.ppg) ? null : row.ppg.toFixed(1);
    case "owned": {
      const owned = parseFloat(row.ownership ?? "");
      return Number.isFinite(owned) ? `${owned < 10 ? owned.toFixed(1) : Math.round(owned)}%` : null;
    }
  }
}

export async function loadCardStats(): Promise<CardStatKey[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((key): key is CardStatKey => KEYS.has(key)).slice(0, MAX_CARD_STATS)
      : [];
  } catch {
    return [];
  }
}

export function saveCardStats(keys: CardStatKey[]) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keys)).catch(() => {});
}

// The chosen stats, for the cards on the home pitch (empty elsewhere).
export const CardStatsContext = createContext<CardStatKey[]>([]);
