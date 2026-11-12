import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Gameweek } from "./fpl";

const GREEN = "#00d982";
const DARK_GREEN = "#071b12";
const MUTED = "#9db3a6";
const ROW_HEIGHT = 46;

type Props = {
  visible: boolean;
  // Gameweeks the user may pick from (newest first reads best for history).
  gameweeks: Gameweek[];
  selected: number;
  onSelect: (gameweek: number) => void;
  onClose: () => void;
};

function statusFor(gameweek: Gameweek) {
  if (gameweek.isCurrent && !gameweek.finished) return { text: "Live", color: GREEN };
  if (gameweek.isCurrent) return { text: "Current", color: GREEN };
  if (gameweek.finished) return { text: "Finished", color: MUTED };
  return { text: "Upcoming", color: MUTED };
}

// Dropdown-style gameweek list anchored under the top-right of the header.
export function GameweekPicker({ visible, gameweeks, selected, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const items = [...gameweeks].sort((a, b) => b.id - a.id);
  const selectedIndex = Math.max(0, items.findIndex((gw) => gw.id === selected));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close gameweek selector"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.45)" }}
      >
        <Pressable
          // Swallow taps inside the panel so they don't close it.
          onPress={() => {}}
          style={{
            position: "absolute",
            top: insets.top + 50,
            right: 12,
            width: 210,
            maxHeight: "65%",
            backgroundColor: "#0b2117",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "rgba(0, 217, 130, 0.35)",
            overflow: "hidden",
            elevation: 16,
            shadowColor: "#000",
            shadowOpacity: 0.4,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>Select gameweek</Text>
          </View>
          <FlatList
            data={items}
            keyExtractor={(gw) => String(gw.id)}
            initialScrollIndex={selectedIndex}
            getItemLayout={(_, index) => ({
              length: ROW_HEIGHT,
              offset: ROW_HEIGHT * index,
              index,
            })}
            renderItem={({ item }) => {
              const isSelected = item.id === selected;
              const status = statusFor(item);
              return (
                <Pressable
                  onPress={() => {
                    onClose();
                    if (!isSelected) onSelect(item.id);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Gameweek ${item.id}, ${status.text}`}
                  android_ripple={{ color: "rgba(0, 217, 130, 0.2)" }}
                  style={{
                    height: ROW_HEIGHT,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 14,
                    backgroundColor: isSelected ? GREEN : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? DARK_GREEN : "#fff",
                      fontSize: 13,
                      fontWeight: isSelected ? "900" : "700",
                    }}
                  >
                    GW {item.id}
                  </Text>
                  <Text
                    style={{
                      color: isSelected ? DARK_GREEN : status.color,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {status.text}
                  </Text>
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
