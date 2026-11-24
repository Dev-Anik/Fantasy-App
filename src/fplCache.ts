// One shared read of each public FPL file. Every screen asking for the same
// file within `maxAge` gets the same request (or its answer), so opening a
// page doesn't download again what another page has just fetched, and a
// page can be drawn at once from what is already in (peekFpl).
//
// A failed read is not kept: the next request tries again, and the last good
// answer stays available to peekFpl meanwhile.

const API = "https://fantasy.premierleague.com/api/";

// How long an answer is reused, by how often FPL changes it.
export const FRESH = {
  // Live numbers: matches in play.
  live: 20_000,
  // Player data, deadlines, injury news.
  bootstrap: 60_000,
  // A finished gameweek, a player's history, fixture lists.
  settled: 10 * 60_000,
} as const;

type Entry = { at: number; promise: Promise<unknown>; value?: unknown; has: boolean };
const entries = new Map<string, Entry>();

export function fplJson<T = any>(path: string, maxAge: number = FRESH.bootstrap): Promise<T> {
  const hit = entries.get(path);
  if (hit && Date.now() - hit.at < maxAge) return hit.promise as Promise<T>;
  const promise = fetch(API + path, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(`FPL returned ${response.status}`);
    return response.json();
  });
  const entry: Entry = { at: Date.now(), promise, value: hit?.value, has: !!hit?.has };
  entries.set(path, entry);
  promise.then(
    (value) => {
      entry.value = value;
      entry.has = true;
    },
    () => {
      if (entries.get(path) !== entry) return;
      // Keep the last good answer for peekFpl, but read again next time.
      if (entry.has) entries.set(path, { ...entry, at: 0, promise: Promise.resolve(entry.value) });
      else entries.delete(path);
    },
  );
  return promise as Promise<T>;
}

// fplJson, given up on (rejected) after `ms`, for callers with a time limit.
export function fplJsonTimed<T = any>(path: string, maxAge: number, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("FPL timed out")), ms);
    fplJson<T>(path, maxAge).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// The last answer for this file, if one has arrived (however old).
export function peekFpl<T = any>(path: string): T | undefined {
  const entry = entries.get(path);
  return entry?.has ? (entry.value as T) : undefined;
}

// Settles to the answer, or to null once `ms` pass or the read fails, for
// waits that must not hold a screen forever.
export function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}
