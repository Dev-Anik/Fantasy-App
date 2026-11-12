import { Text, View } from "react-native";
import { AppSymbol } from "./AppSymbol";

const GREEN = "#00d982";
const MUTED = "#9db3a6";
const RED = "#ff526f";
const GOLD = "#ffd400";

type Props = {
  gameweek: number;
  deadlineDate: string | null;
  deadlineRemaining: string | null;
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
      style={{ flex: 1, alignItems: "center", paddingVertical: 8, paddingHorizontal: 2 }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        maxFontSizeMultiplier={1.1}
        style={{ color: MUTED, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.3 }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={1.1}
        style={{ color, fontSize: 16, lineHeight: 20, fontWeight: "900", marginTop: 2 }}
      >
        {value}
        {!!unit && (
          <Text style={{ color: MUTED, fontSize: 10, fontWeight: "700" }}> {unit}</Text>
        )}
      </Text>
    </View>
  );
}

const Divider = () => (
  <View style={{ width: 1, marginVertical: 8, backgroundColor: "rgba(255, 255, 255, 0.12)" }} />
);

// Everything a manager needs to judge a transfer, above the pitch: the
// deadline, transfers left, money left and what the moves would cost.
export function TransferSummaryBar({
  gameweek,
  deadlineDate,
  deadlineRemaining,
  freeTransfers,
  pendingCount,
  bank,
  pointsCost,
  chipLabel,
  squadValue,
}: Props) {
  const unlimited = freeTransfers == null || !!chipLabel;
  const freeLeft = unlimited ? null : Math.max((freeTransfers ?? 0) - pendingCount, 0);

  return (
    <View
      style={{
        borderRadius: 12,
        backgroundColor: "rgba(4, 16, 10, 0.85)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.12)",
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
          paddingVertical: 7,
          backgroundColor: "rgba(0, 217, 130, 0.1)",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(0, 217, 130, 0.25)",
        }}
      >
        <AppSymbol name={{ ios: "clock.fill", android: "schedule", web: "schedule" }} color={GREEN} size={14} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          maxFontSizeMultiplier={1.1}
          style={{ flex: 1, color: "#ffffff", fontSize: 11, fontWeight: "800" }}
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
            style={{ color: GOLD, fontSize: 12, fontWeight: "900" }}
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
