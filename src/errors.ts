// Turns any error from FPL, the network or the app into a short, plain
// message for the user. Raw server text, status codes, addresses and
// programming errors are never shown: they are mapped to a friendly line by
// what kind of problem they are.

export const MESSAGES = {
  busy: "FPL is busy at the moment. Please try again in a few minutes.",
  updating: "FPL is updating the game right now. Please try again in a few minutes.",
  offline: "Couldn't reach FPL. Check your internet connection and try again.",
  signIn: "Your FPL sign-in needs renewing. Please sign in again.",
  generic: "Something went wrong talking to FPL. Please try again.",
};

export type ErrorKind = "busy" | "updating" | "offline" | "signIn" | "other";

// Anything that reads like it came from a server or the code rather than a
// person: status codes, addresses, "->", stack and parser messages, HTML.
const TECHNICAL = [
  /->/,
  /\b(status|error)\s*\d{3}\b/i,
  /\b[45]\d{2}\b/,
  /https?:\/\//i,
  /\bapi\//i,
  /upstream|reset reason|disconnect|connection termination|overflow/i,
  /typeerror|referenceerror|syntaxerror|undefined|null\b|nan\b/i,
  /unexpected token|json|parse/i,
  /failed to fetch|network request failed|load failed|aborted?|timed? ?out/i,
  /<\/?[a-z][\s\S]*>/i,
  /\bentry\/\d+|event\/\d+/i,
];

// Which kind of problem this is.
export function errorKind(raw: unknown, status?: number | null): ErrorKind {
  const text = typeof raw === "string" ? raw : raw instanceof Error ? raw.message : "";
  if (/being updated|game is updating/i.test(text)) return "updating";
  if (status === 401 || status === 403) return "signIn";
  if ((status != null && status >= 500) || /\b5\d{2}\b|upstream|reset reason|disconnect|bad gateway|service unavailable|gateway time/i.test(text)) {
    return "busy";
  }
  if (/failed to fetch|network request failed|load failed|internet|offline|timed? ?out|aborted?/i.test(text)) return "offline";
  return "other";
}

// A temporary problem worth retrying on its own (FPL busy or updating, or
// the connection dropping), as opposed to a real refusal.
export function isTemporary(raw: unknown, status?: number | null) {
  const kind = errorKind(raw, status);
  return kind === "busy" || kind === "updating" || kind === "offline";
}

// The message to show. Plain sentences (from FPL's own validation, like
// "You are already in this league", or from the app) are kept; anything
// technical becomes a friendly line for its kind, or `fallback`.
export function userMessage(raw: unknown, fallback: string = MESSAGES.generic, status?: number | null): string {
  const text = (typeof raw === "string" ? raw : raw instanceof Error ? raw.message : "").trim();
  const kind = errorKind(text, status);
  if (kind === "busy") return MESSAGES.busy;
  if (kind === "updating") return MESSAGES.updating;
  if (kind === "offline") return MESSAGES.offline;
  if (!text || text.length > 220 || TECHNICAL.some((pattern) => pattern.test(text))) return fallback;
  return text;
}
