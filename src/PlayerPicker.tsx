import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Player } from "./fpl";
import { PlayerArt } from "./Pitch";
import { AppSymbol } from "./AppSymbol";

const GREEN = "#00d982";
const DARK_GREEN = "#051a0f";
const MUTED = "#9db3a6";
const RED = "#ff526f";
const GOLD = "#ffd400";
const POS = ["", "GKP", "DEF", "MID", "FWD"];

// FPL availability codes, in words.
const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  d: { text: "Doubtful", color: GOLD },
  i: { text: "Injured", color: RED },
  s: { text: "Suspended", color: RED },
  u: { text: "Unavailable", color: RED },
  n: { text: "Not available", color: RED },
};

type SortMode = "pts" | "form" | "cost-desc" | "cost-asc";

const money = (value: number) => `£${(value / 10).toFixed(1)}m`;

function Chip({
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={{
        paddingHorizontal: 13,
        height: 32,
        justifyContent: "center",
        borderRadius: 16,
        backgroundColor: active ? GREEN : "rgba(255, 255, 255, 0.08)",
        borderWidth: 1,
        borderColor: active ? GREEN : "rgba(255, 255, 255, 0.15)",
      }}
    >
      <Text style={{ color: active ? DARK_GREEN : "#ffffff", fontSize: 12, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PlayerPicker({
  visible,
  title,
  subtitle,
  candidates,
  maxCost,
  fullClubs,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  candidates: Player[];
  maxCost: number;
  fullClubs: number[];
  onPick: (p: Player) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("pts");
  const [affordableOnly, setAffordableOnly] = useState(false);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = candidates.filter(
      (c) =>
        (!s || c.name.toLowerCase().includes(s) || c.team.toLowerCase().includes(s)) &&
        (!affordableOnly || (c.cost <= maxCost && !fullClubs.includes(c.teamId))),
    );
    return filtered.sort((a, b) => {
      if (sort === "pts") return b.pts - a.pts;
      if (sort === "form") return (parseFloat(b.form) || 0) - (parseFloat(a.form) || 0);
      if (sort === "cost-desc") return b.cost - a.cost;
      return a.cost - b.cost;
    });
  }, [candidates, q, sort, affordableOnly, maxCost, fullClubs]);

  // Start each visit with a clean search; the sort and filter are kept.
  const close = () => {
    setQ("");
    onClose();
  };
  const pick = (player: Player) => {
    setQ("");
    onPick(player);
  };

  const priceSorted = sort === "cost-desc" || sort === "cost-asc";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: "#071818", paddingTop: insets.top }}>
        <Image
          source={require("../assets/images/background-texture.png")}
          contentFit="cover"
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.6 }}
        />

        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "900", color: "#ffffff" }}>
                {title}
              </Text>
              {!!subtitle && (
                <Text numberOfLines={1} style={{ color: MUTED, fontSize: 12, fontWeight: "600", marginTop: 2 }}>
                  {subtitle}
                </Text>
              )}
            </View>
            <Pressable
              onPress={close}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close player list"
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.1)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.18)",
              })}
            >
              <AppSymbol name={{ ios: "xmark", android: "close", web: "close" }} color="#ffffff" size={18} />
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(0, 217, 130, 0.3)",
              borderRadius: 14,
              backgroundColor: "rgba(5, 20, 16, 0.85)",
              paddingHorizontal: 12,
              height: 44,
              marginTop: 12,
            }}
          >
            <AppSymbol
              name={{ ios: "magnifyingglass", android: "search", web: "search" }}
              color={MUTED}
              size={18}
            />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search player or club"
              placeholderTextColor="#7a9988"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search player or club"
              style={{ flex: 1, color: "#ffffff", fontSize: 14, marginLeft: 8, paddingVertical: 0 }}
            />
            {q.length > 0 && (
              <Pressable
                onPress={() => setQ("")}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <AppSymbol name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }} color={MUTED} size={18} />
              </Pressable>
            )}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10, gap: 8 }}>
            <Chip label="Points" active={sort === "pts"} onPress={() => setSort("pts")} accessibilityLabel="Sort by total points" />
            <Chip label="Form" active={sort === "form"} onPress={() => setSort("form")} accessibilityLabel="Sort by form" />
            <Chip
              label={sort === "cost-asc" ? "Price ↑" : "Price ↓"}
              active={priceSorted}
              onPress={() => setSort(sort === "cost-desc" ? "cost-asc" : "cost-desc")}
              accessibilityLabel={
                sort === "cost-desc" ? "Sorted by price, highest first. Tap to reverse" : "Sort by price"
              }
            />
            <Chip
              label="Can afford"
              active={affordableOnly}
              onPress={() => setAffordableOnly((value) => !value)}
              accessibilityLabel="Only show players you can sign"
            />
          </View>

          <Text style={{ color: MUTED, fontSize: 11, fontWeight: "700", marginTop: 10 }}>
            {list.length} {list.length === 1 ? "player" : "players"}
          </Text>
        </View>

        <FlatList
          data={list}
          keyExtractor={(p) => String(p.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={9}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: MUTED, marginTop: 40, fontSize: 14 }}>
              {affordableOnly
                ? "No players you can afford match. Try turning off \"Can afford\"."
                : "No players found."}
            </Text>
          }
          renderItem={({ item }) => {
            const tooPricey = item.cost > maxCost;
            const clubFull = fullClubs.includes(item.teamId);
            const blocked = tooPricey || clubFull;
            const status = item.status !== "a" ? STATUS_LABELS[item.status] : undefined;

            return (
              <Pressable
                onPress={() => pick(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.team}, ${money(item.cost)}, ${item.pts} points${
                  status ? `, ${status.text}` : ""
                }${clubFull ? ", club limit reached" : tooPricey ? ", over budget" : ""}`}
                android_ripple={{ color: "rgba(0, 217, 130, 0.18)" }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: "rgba(14, 38, 26, 0.95)",
                  marginTop: 6,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: blocked ? "rgba(255, 82, 111, 0.3)" : "rgba(255, 255, 255, 0.1)",
                  opacity: pressed ? 0.75 : blocked ? 0.55 : 1,
                })}
              >
                <View style={{ marginRight: 12 }}>
                  <PlayerArt team={item.team} goalkeeper={item.type === 1} size={42} />
                </View>

                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: "800", color: "#ffffff" }}>
                      {item.name}
                    </Text>
                    {status && (
                      <View
                        style={{
                          borderRadius: 6,
                          paddingHorizontal: 5,
                          paddingVertical: 1,
                          borderWidth: 1,
                          borderColor: status.color,
                        }}
                      >
                        <Text style={{ color: status.color, fontSize: 9, fontWeight: "900" }}>
                          {status.text.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={1} style={{ color: MUTED, fontSize: 12, marginTop: 2, fontWeight: "600" }}>
                    {item.team} · {POS[item.type]} · Form {item.form} · {item.ownership}% owned
                  </Text>
                  {blocked && (
                    <Text style={{ color: RED, fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                      {clubFull
                        ? "Club limit reached (3 players)"
                        : `Over budget by ${money(item.cost - maxCost)}`}
                    </Text>
                  )}
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: tooPricey ? RED : "#ffffff" }}>
                    {money(item.cost)}
                  </Text>
                  <Text style={{ color: GREEN, fontSize: 12, fontWeight: "800", marginTop: 2 }}>
                    {item.pts} pts
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}
