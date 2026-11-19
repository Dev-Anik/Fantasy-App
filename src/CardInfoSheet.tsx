// A bottom sheet for choosing up to two extra figures to show on the home
// pitch's player cards. The choice is saved by the caller.
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSymbol } from "./AppSymbol";
import { CARD_STAT_OPTIONS, MAX_CARD_STATS } from "./cardStats";
import type { CardStatKey } from "./cardStats";
import { THEME } from "./theme";

export function CardInfoSheet({
  visible,
  selected,
  onChange,
  onClose,
}: {
  visible: boolean;
  selected: CardStatKey[];
  onChange: (keys: CardStatKey[]) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const full = selected.length >= MAX_CARD_STATS;

  const toggle = (key: CardStatKey) => {
    if (selected.includes(key)) onChange(selected.filter((k) => k !== key));
    else if (!full) onChange([...selected, key]);
    // Already two: replace the older choice with this one.
    else onChange([...selected.slice(1), key]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(3, 5, 12, 0.55)" }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "80%",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: THEME.surfaceRaised,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: "rgba(255, 255, 255, 0.08)",
            paddingTop: 10,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <View style={{ alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(255, 255, 255, 0.18)" }} />
          <View style={{ flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={{ color: THEME.ink, fontSize: 18, fontWeight: "700" }}>
                Card info
              </Text>
              <Text style={{ color: THEME.muted, fontSize: 13, marginTop: 3 }}>
                {`Show up to ${MAX_CARD_STATS} extra figures on your player cards`}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              hitSlop={10}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                height: 32,
                borderRadius: 16,
                justifyContent: "center",
                backgroundColor: THEME.accent,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: THEME.onAccent, fontSize: 13.5, fontWeight: "700" }}>Done</Text>
            </Pressable>
          </View>

          <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 12 }}>
            {/* None: clears every choice, so the cards show nothing extra. */}
            <Pressable
              onPress={() => onChange([])}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected.length === 0 }}
              accessibilityLabel="None. Show nothing extra on the cards"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 10,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: pressed
                  ? "rgba(255, 255, 255, 0.05)"
                  : selected.length === 0
                    ? THEME.accentSoft
                    : "transparent",
              })}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected.length === 0 ? THEME.accent : "transparent",
                  borderWidth: selected.length === 0 ? 0 : 1.5,
                  borderColor: "rgba(255, 255, 255, 0.25)",
                }}
              >
                {selected.length === 0 && (
                  <AppSymbol name={{ ios: "checkmark", android: "check", web: "check" }} color={THEME.onAccent} size={14} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: THEME.ink, fontSize: 15, fontWeight: "600" }}>None</Text>
                <Text style={{ color: THEME.muted, fontSize: 12.5, marginTop: 2 }}>Show nothing extra on the cards</Text>
              </View>
            </Pressable>
            <View style={{ height: 1, marginHorizontal: 10, marginVertical: 4, backgroundColor: THEME.line }} />
            {CARD_STAT_OPTIONS.map((option) => {
              const on = selected.includes(option.key);
              const order = selected.indexOf(option.key);
              return (
                <Pressable
                  key={option.key}
                  onPress={() => toggle(option.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${option.title}. ${option.detail}`}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: pressed ? "rgba(255, 255, 255, 0.05)" : on ? THEME.accentSoft : "transparent",
                  })}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: on ? THEME.accent : "transparent",
                      borderWidth: on ? 0 : 1.5,
                      borderColor: "rgba(255, 255, 255, 0.25)",
                    }}
                  >
                    {on && <Text style={{ color: THEME.onAccent, fontSize: 12, fontWeight: "800" }}>{order + 1}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: THEME.ink, fontSize: 15, fontWeight: "600" }}>{option.title}</Text>
                    <Text style={{ color: THEME.muted, fontSize: 12.5, marginTop: 2 }}>{option.detail}</Text>
                  </View>
                  {!!option.short && (
                    <Text style={{ color: THEME.muted, fontSize: 10.5, fontWeight: "700", letterSpacing: 1 }}>
                      {option.short}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 22, marginTop: 10 }}>
            <AppSymbol name={{ ios: "info.circle", android: "info", web: "info" }} color={THEME.muted} size={14} />
            <Text style={{ flex: 1, color: THEME.muted, fontSize: 12, lineHeight: 17 }}>
              {selected.length
                ? "1 shows in the top-left corner of each card, 2 in the top-right. Your choice is saved on this phone."
                : "Nothing extra is shown. Your choice is saved on this phone."}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
