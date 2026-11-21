// Shared look for the league screens: the same quiet style as My season and
// More (small headings, plain grouped lists with thin dividers).
import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";
import { THEME } from "./theme";
import { LiveDot } from "./LiveDot";

export const LEAGUE_UI = {
  surface: THEME.surface,
  pressed: "rgba(255, 255, 255, 0.04)",
  line: THEME.line,
  ink: THEME.ink,
  soft: THEME.soft,
  muted: THEME.muted,
  good: THEME.good,
  bad: THEME.bad,
  accent: THEME.accent,
  gold: "#f2c14e",
  // The signed-in manager's row.
  mine: "rgba(0, 217, 130, 0.08)",
};
const UI = LEAGUE_UI;

// The signed-in manager's row or match: a soft green-to-blue band with
// rounded ends, set in from the card's edges.
export const MINE_BAND = {
  borderRadius: 12,
  backgroundColor: "rgba(0, 217, 130, 0.12)",
  backgroundImage: "linear-gradient(90deg, rgba(0, 217, 130, 0.30) 0%, rgba(56, 120, 248, 0.16) 100%)",
  borderWidth: 1,
  borderColor: "rgba(0, 217, 130, 0.32)",
} as const;

// Table type scale, shared by every league table.
export const TABLE = {
  header: { color: UI.muted, fontSize: 12, fontWeight: "600" as const },
  name: { color: UI.ink, fontSize: 13.5, fontWeight: "700" as const },
  sub: { color: UI.soft, fontSize: 12.5, marginTop: 2 },
  figure: { color: UI.soft, fontSize: 13.5, fontVariant: ["tabular-nums" as const] },
  total: { color: UI.ink, fontSize: 13.5, fontWeight: "800" as const, fontVariant: ["tabular-nums" as const] },
  rowPaddingV: 13,
};

// Rank movement: a small round badge, ▲ green, ▼ red, or a dash.
export function MovementBadge({ value }: { value: "up" | "down" | "same" }) {
  const color = value === "up" ? UI.good : value === "down" ? UI.bad : UI.muted;
  return (
    <View
      accessible
      accessibilityLabel={value === "up" ? "Moved up" : value === "down" ? "Moved down" : "No change"}
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: value === "same" ? "rgba(255, 255, 255, 0.08)" : value === "up" ? "rgba(0, 217, 130, 0.16)" : "rgba(255, 92, 119, 0.16)",
      }}
    >
      <Text style={{ color, fontSize: value === "same" ? 11 : 8, fontWeight: "800", marginTop: value === "same" ? -1 : 0 }}>
        {value === "up" ? "▲" : value === "down" ? "▼" : "–"}
      </Text>
    </View>
  );
}

// Two or three choices in a rounded track; the chosen one is a raised pill.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; live?: boolean }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: "row", padding: 4, borderRadius: 14, backgroundColor: UI.surface, marginBottom: 14 }}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({
              flex: 1,
              height: 38,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? THEME.surfaceRaised : pressed ? UI.pressed : "transparent",
              borderWidth: active ? 1 : 0,
              borderColor: "rgba(255, 255, 255, 0.1)",
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {option.live && <LiveDot color={UI.good} />}
              <Text style={{ color: active ? UI.ink : UI.muted, fontSize: 14, fontWeight: active ? "700" : "500" }}>
                {option.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Heading({ children, hint, first = false }: { children: string; hint?: string; first?: boolean }) {
  return (
    <View style={{ marginTop: first ? 4 : 26, marginBottom: 8, marginLeft: 2 }}>
      <Text
        accessibilityRole="header"
        style={{ color: UI.accent, fontSize: 11.5, fontWeight: "500", letterSpacing: 2, textTransform: "uppercase" }}
      >
        {children}
      </Text>
      {!!hint && <Text style={{ color: UI.muted, fontSize: 12, marginTop: 3 }}>{hint}</Text>}
    </View>
  );
}

export function Group({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: UI.surface, borderRadius: 12, overflow: "hidden" }}>{children}</View>;
}

export function Divider({ inset = 16 }: { inset?: number }) {
  return <View style={{ height: 1, marginLeft: inset, backgroundColor: UI.line }} />;
}

// A plain button: outlined, or filled for the main action of a form.
export function Button({
  label,
  onPress,
  disabled = false,
  primary = false,
  active = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      style={({ pressed }) => ({
        flex: 1,
        height: 44,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: primary ? UI.accent : pressed || active ? "rgba(255, 255, 255, 0.06)" : "transparent",
        borderWidth: primary ? 0 : 1,
        borderColor: active ? UI.soft : "rgba(255, 255, 255, 0.14)",
        opacity: disabled ? 0.45 : pressed && primary ? 0.85 : 1,
      })}
    >
      <Text style={{ color: primary ? THEME.onAccent : UI.ink, fontSize: 14, fontWeight: primary ? "700" : "500" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: UI.soft, fontSize: 12.5, fontWeight: "600", marginBottom: 6 }}>{label}</Text>
      <TextInput
        placeholderTextColor="#5f6b66"
        selectionColor={UI.good}
        {...input}
        style={{
          height: 44,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.12)",
          color: UI.ink,
          fontSize: 14,
        }}
      />
      {!!hint && <Text style={{ color: UI.muted, fontSize: 11.5, lineHeight: 16, marginTop: 6 }}>{hint}</Text>}
    </View>
  );
}

// Figures side by side: a label above each number.
export function Stats({
  items,
  compact = false,
}: {
  // `spoken` is read by screen readers instead of a shortened label.
  items: { label: string; spoken?: string; value: string; note?: string; color?: string; noteColor?: string }[];
  compact?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: UI.surface,
        borderRadius: compact ? 10 : 12,
        paddingVertical: compact ? 8 : 12,
      }}
    >
      {items.map((item, index) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.spoken ?? item.label}: ${item.value}${item.note ? `, ${item.note}` : ""}`}
          style={{
            flex: 1,
            paddingHorizontal: compact ? 12 : 14,
            borderLeftWidth: index === 0 ? 0 : 1,
            borderLeftColor: UI.line,
          }}
        >
          <Text style={{ color: UI.muted, fontSize: compact ? 10.5 : 11, fontWeight: "600" }}>{item.label}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              color: item.color ?? UI.ink,
              fontSize: compact ? 15.5 : 19,
              fontWeight: "700",
              marginTop: compact ? 2 : 3,
              fontVariant: ["tabular-nums"],
            }}
          >
            {item.value}
          </Text>
          {!!item.note && <Text style={{ color: item.noteColor ?? UI.muted, fontSize: 11, marginTop: 1 }}>{item.note}</Text>}
        </View>
      ))}
    </View>
  );
}

// A short line of text that reads as a link.
export function TextButton({
  label,
  onPress,
  disabled = false,
  color = UI.soft,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: disabled ? 0.35 : pressed ? 0.6 : 1, paddingVertical: 6 })}
    >
      <Text style={{ color, fontSize: 14, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}
