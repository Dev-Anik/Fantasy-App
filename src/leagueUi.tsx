// Shared look for the league screens: the same quiet style as My season and
// More (small headings, plain grouped lists with thin dividers).
import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";
import { THEME } from "./theme";

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
export function Stats({ items }: { items: { label: string; value: string; note?: string; color?: string; noteColor?: string }[] }) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: UI.surface, borderRadius: 12, paddingVertical: 12 }}>
      {items.map((item, index) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}${item.note ? `, ${item.note}` : ""}`}
          style={{ flex: 1, paddingHorizontal: 14, borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: UI.line }}
        >
          <Text style={{ color: UI.muted, fontSize: 11, fontWeight: "600" }}>{item.label}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: item.color ?? UI.ink, fontSize: 19, fontWeight: "700", marginTop: 3, fontVariant: ["tabular-nums"] }}
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
