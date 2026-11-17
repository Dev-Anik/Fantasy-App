// A player's availability for the next gameweek, from FPL's status, chance of
// playing and news. Shared by the pitch, the player sheet and the transfer
// list so they always agree.

export type Availability = {
  // "doubtful": may play; "out": injured, suspended or otherwise unavailable.
  level: "doubtful" | "out";
  // Short text for a small badge: "75%", "INJ", "SUS", "OUT".
  short: string;
  // Words for labels and screen readers: "75% chance of playing", "Injured".
  label: string;
  color: string;
  // Text on top of `color`.
  ink: string;
};

const YELLOW = "#ffd400";
const ORANGE = "#ff9f1c";
const RED = "#ff3b5c";

export function availability(
  status: string | undefined,
  chance: number | null | undefined,
): Availability | null {
  switch (status) {
    case "i":
      return { level: "out", short: "INJ", label: "Injured", color: RED, ink: "#ffffff" };
    case "s":
      return { level: "out", short: "SUS", label: "Suspended", color: RED, ink: "#ffffff" };
    case "u":
    case "n":
      return { level: "out", short: "OUT", label: "Unavailable", color: RED, ink: "#ffffff" };
    case "d": {
      const percent = typeof chance === "number" ? chance : null;
      if (percent === 0) {
        return { level: "out", short: "0%", label: "Not expected to play", color: RED, ink: "#ffffff" };
      }
      const color = percent == null || percent >= 75 ? YELLOW : percent >= 50 ? ORANGE : RED;
      return {
        level: "doubtful",
        short: percent == null ? "?" : `${percent}%`,
        label: percent == null ? "Doubtful" : `${percent}% chance of playing`,
        color,
        ink: color === RED ? "#ffffff" : "#1b1600",
      };
    }
    default:
      return null;
  }
}
