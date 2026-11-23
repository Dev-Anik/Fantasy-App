// The points estimates for the user's squad, saved on the phone before each
// deadline, so the Points page can later show how close they came. Saved
// rather than worked out again afterwards: form and the season averages move
// once the gameweek is played, so a fresh estimate would not be the one the
// user saw.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "profpl_estimate_snapshots";
// Gameweeks kept per team (older ones are dropped).
const KEEP = 8;

type Snapshot = { savedAt: number; est: Record<string, number> };
type Store = Record<string, Snapshot>;

const keyFor = (entry: number, event: number) => `${entry}:${event}`;

async function readStore(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// Saves (or replaces) the estimates for a team's gameweek: player id to
// estimated points. Call only before that gameweek's deadline.
export async function saveEstimateSnapshot(entry: number, event: number, est: Record<number, number>) {
  const store = await readStore();
  store[keyFor(entry, event)] = { savedAt: Date.now(), est };
  const mine = Object.keys(store)
    .filter((key) => key.startsWith(`${entry}:`))
    .sort((a, b) => Number(b.split(":")[1]) - Number(a.split(":")[1]));
  mine.slice(KEEP).forEach((key) => delete store[key]);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Nothing to do: the Points page then simply has no comparison.
  }
}

// The saved estimates for a team's gameweek, or null if none were saved
// (the app wasn't opened before that deadline).
export async function loadEstimateSnapshot(entry: number, event: number): Promise<Record<number, number> | null> {
  const snapshot = (await readStore())[keyFor(entry, event)];
  if (!snapshot) return null;
  return Object.fromEntries(Object.entries(snapshot.est).map(([id, value]) => [Number(id), value]));
}
