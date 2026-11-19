import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { AppSymbol } from "./AppSymbol";
import { THEME } from "./theme";

const GREEN = THEME.good;
const MUTED = THEME.muted;
const RED = THEME.bad;
const GOLD = "#ffd400";

type Props = {
  gameweek: number;
  deadlineDate: string | null;
  // The deadline; the time left is counted down here, once a second.
  deadlineIso: string | null;
  // null means unlimited (wildcard / free hit / pre-season).
  freeTransfers: number | null;
  pendingCount: number;
  // Bank after the pending transfers, in tenths of a million.
  bank: number;
  // Points this set of transfers would cost.
  pointsCost: number;
  chipLabel: string | null;
  squadValue: number;
};

const money = (value: number) => `£${(value / 10).toFixed(1)}m`;

function formatRemainingTime(isoString: string | null, nowMs: number) {
  if (!isoString) return null;
  const deadlineMs = new Date(isoString).getTime();
  if (isNaN(deadlineMs)) return null;
  const diff = deadlineMs - nowMs;
  if (diff <= 0) return "Deadline Passed";
  const totalSecs = Math.floor(diff / 1000);
  const days = Math.floor(totalSecs / (3600 * 24));
  const hours = Math.floor((totalSecs % (3600 * 24)) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  return `${hours}h ${mins}m ${secs}s`;
}

// The time left before the deadline, re-read every second. Only this bar
// redraws as it ticks, not the pitch or the rest of the screen.
function useTimeLeft(deadlineIso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineIso) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadlineIso]);
  return formatRemainingTime(deadlineIso, now);
}

// Labels are single short words so four cells fit on the narrowest phones
// without truncating; the unit sits beside the number instead.
function Cell({
  label,
  value,
  unit,
  color = "#ffffff",
  accessibilityLabel,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  accessibilityLabel: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{ flex: 1, alignItems: "center", paddingVertical: 5, paddingHorizontal: 2 }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        maxFontSizeMultiplier={1.1}
        style={{ color: MUTED, fontSize: 8, fontWeight: "800", letterSpacing: 0.3 }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={1.1}
        style={{ color, fontSize: 13, lineHeight: 16, fontWeight: "900", marginTop: 1 }}
      >
        {value}
        {!!unit && (
          <Text style={{ color: MUTED, fontSize: 9, fontWeight: "700" }}> {unit}</Text>
        )}
      </Text>
    </View>
  );
}

const Divider = () => (
  <View style={{ width: 1, marginVertical: 6, backgroundColor: "rgba(255, 255, 255, 0.12)" }} />
);

// Everything a manager needs to judge a transfer, above the pitch: the
// deadline, transfers left, money left and what the moves would cost.
export function TransferSummaryBar({
  gameweek,
  deadlineDate,
  deadlineIso,
  freeTransfers,
  pendingCount,
  bank,
  pointsCost,
  chipLabel,
  squadValue,
}: Props) {
  const deadlineRemaining = useTimeLeft(deadlineIso);
  const unlimited = freeTransfers == null || !!chipLabel;
  const freeLeft = unlimited ? null : Math.max((freeTransfers ?? 0) - pendingCount, 0);

  return (
    <View
      style={{
        borderRadius: 12,
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: THEME.line,
        overflow: "hidden",
      }}
    >
      <View
        accessible
        accessibilityLabel={`Gameweek ${gameweek} deadline${deadlineDate ? ` ${deadlineDate}` : ""}${
          deadlineRemaining ? `, ${deadlineRemaining} left` : ""
        }`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 4,
          backgroundColor: "rgba(255, 255, 255, 0.03)",
          borderBottomWidth: 1,
          borderBottomColor: THEME.line,
        }}
      >
        <AppSymbol name={{ ios: "clock.fill", android: "schedule", web: "schedule" }} color={THEME.accent} size={12} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          maxFontSizeMultiplier={1.1}
          style={{ flex: 1, color: "#ffffff", fontSize: 10, fontWeight: "800" }}
        >
          GW {gameweek}
          <Text style={{ color: MUTED, fontWeight: "700" }}>
            {deadlineDate ? `  ·  ${deadlineDate}` : "  deadline"}
          </Text>
        </Text>
        {!!deadlineRemaining && (
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.1}
            style={{ color: GOLD, fontSize: 11, fontWeight: "900" }}
          >
            {deadlineRemaining}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        <Cell
          label="TRANSFERS"
          value={unlimited ? "Unlimited" : String(freeLeft)}
          unit={unlimited ? undefined : "free"}
          color={!unlimited && freeLeft === 0 ? GOLD : "#ffffff"}
          accessibilityLabel={
            unlimited
              ? `Unlimited transfers${chipLabel ? `, ${chipLabel}` : ""}`
              : `${freeLeft} free transfers left`
          }
        />
        <Divider />
        <Cell
          label="BANK"
          value={money(bank)}
          color={bank < 0 ? RED : "#ffffff"}
          accessibilityLabel={`In the bank: ${money(bank)}`}
        />
        <Divider />
        <Cell
          label="COST"
          value={pointsCost > 0 ? `-${pointsCost}` : "0"}
          unit="pts"
          color={pointsCost > 0 ? RED : GREEN}
          accessibilityLabel={`Points cost: ${pointsCost}`}
        />
        <Divider />
        <Cell
          label="VALUE"
          value={money(squadValue)}
          accessibilityLabel={`Squad value: ${money(squadValue)}`}
        />
      </View>
    </View>
  );
}
