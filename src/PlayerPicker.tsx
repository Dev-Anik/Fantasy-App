import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Player } from "./fpl";
import { TEAM_AVATARS } from "./Pitch";
import { AppSymbol } from "./AppSymbol";

const GREEN = "#00d982";
const POS = ["", "GKP", "DEF", "MID", "FWD"];

type SortMode = "pts" | "form" | "cost-desc" | "cost-asc";

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

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const f = candidates.filter(
      (c) =>
        !s ||
        c.name.toLowerCase().includes(s) ||
        c.team.toLowerCase().includes(s),
    );
    return [...f].sort((a, b) => {
      if (sort === "pts") return b.pts - a.pts;
      if (sort === "form") return parseFloat(b.form) - parseFloat(a.form);
      if (sort === "cost-desc") return b.cost - a.cost;
      if (sort === "cost-asc") return a.cost - b.cost;
      return 0;
    });
  }, [candidates, q, sort]);

  const togglePriceSort = () => {
    if (sort === "cost-desc") {
      setSort("cost-asc");
    } else {
      setSort("cost-desc");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#071818", paddingTop: insets.top }}>
        <Image
          source={require("../assets/images/background-texture.png")}
          contentFit="cover"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            opacity: 0.6,
          }}
        />

        {/* Header Box */}
        <View
          style={{
            marginHorizontal: 12,
            marginTop: 8,
            marginBottom: 10,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 14,
            backgroundColor: "rgba(14, 38, 26, 0.95)",
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: "rgba(0, 217, 130, 0.25)",
            elevation: 6,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#ffffff" }}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 14,
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.2)",
              }}
            >
              <Text style={{ fontSize: 13, color: GREEN, fontWeight: "800" }}>Close</Text>
            </Pressable>
          </View>

          {!!subtitle && (
            <Text style={{ color: "#9db3a6", fontSize: 12, fontWeight: "600", marginTop: 4 }}>
              {subtitle}
            </Text>
          )}

          {/* Search Bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(0, 217, 130, 0.3)",
              borderRadius: 14,
              backgroundColor: "rgba(5, 20, 16, 0.85)",
              paddingHorizontal: 12,
              height: 42,
              marginTop: 12,
            }}
          >
            <AppSymbol
              name={{ ios: "magnifyingglass", android: "search", web: "search" }}
              color="#8a7490"
              size={16}
            />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search player or club"
              placeholderTextColor="#8a7490"
              style={{
                flex: 1,
                color: "#ffffff",
                fontSize: 14,
                marginLeft: 8,
                paddingVertical: 0,
              }}
            />
          </View>

          {/* Sort Filter Chips */}
          <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
            <Pressable
              onPress={() => setSort("pts")}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: sort === "pts" ? GREEN : "rgba(255, 255, 255, 0.1)",
                borderWidth: 1,
                borderColor: sort === "pts" ? GREEN : "rgba(255, 255, 255, 0.15)",
              }}
            >
              <Text
                style={{
                  color: sort === "pts" ? "#051a0f" : "#ffffff",
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                Points
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSort("form")}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: sort === "form" ? GREEN : "rgba(255, 255, 255, 0.1)",
                borderWidth: 1,
                borderColor: sort === "form" ? GREEN : "rgba(255, 255, 255, 0.15)",
              }}
            >
              <Text
                style={{
                  color: sort === "form" ? "#051a0f" : "#ffffff",
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                Form
              </Text>
            </Pressable>

            {/* Price Sort Chip with Toggle (High to Low / Low to High) */}
            <Pressable
              onPress={togglePriceSort}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor:
                  sort === "cost-desc" || sort === "cost-asc"
                    ? GREEN
                    : "rgba(255, 255, 255, 0.1)",
                borderWidth: 1,
                borderColor:
                  sort === "cost-desc" || sort === "cost-asc"
                    ? GREEN
                    : "rgba(255, 255, 255, 0.15)",
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text
                style={{
                  color:
                    sort === "cost-desc" || sort === "cost-asc"
                      ? "#051a0f"
                      : "#ffffff",
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {sort === "cost-desc"
                  ? "Price High → Low"
                  : sort === "cost-asc"
                    ? "Price Low → High"
                    : "Price"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Player List */}
        <FlatList
          data={list}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: "#9db3a6", marginTop: 40, fontSize: 14 }}>
              No players found.
            </Text>
          }
          renderItem={({ item }) => {
            const tooPricey = item.cost > maxCost;
            const clubFull = fullClubs.includes(item.teamId);
            const avatarSource =
              item.team && TEAM_AVATARS[item.team]
                ? TEAM_AVATARS[item.team]
                : require("../assets/images/final-avatar/no-club.png");

            return (
              <Pressable
                onPress={() => onPick(item)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: "rgba(14, 38, 26, 0.95)",
                  marginHorizontal: 12,
                  marginTop: 6,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: tooPricey || clubFull
                    ? "rgba(255, 82, 111, 0.3)"
                    : "rgba(0, 217, 130, 0.22)",
                  opacity: pressed ? 0.75 : tooPricey || clubFull ? 0.5 : 1,
                  elevation: 3,
                })}
              >
                {/* Team Avatar */}
                <Image
                  source={avatarSource}
                  contentFit="contain"
                  style={{
                    width: 42,
                    height: 42,
                    marginRight: 12,
                  }}
                />

                {/* Player Details */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#ffffff" }}>
                    {item.name}
                    {item.status !== "a" ? `  ⚠ ${item.status.toUpperCase()}` : ""}
                  </Text>
                  <Text style={{ color: "#9db3a6", fontSize: 12, marginTop: 2, fontWeight: "600" }}>
                    {item.team} · {POS[item.type]} · Form {item.form}
                  </Text>
                  {clubFull ? (
                    <Text style={{ color: "#ff526f", fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                      Club limit reached (3 players)
                    </Text>
                  ) : tooPricey ? (
                    <Text style={{ color: "#ff526f", fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                      Over budget
                    </Text>
                  ) : null}
                </View>

                {/* Price & Points */}
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "900",
                      color: tooPricey ? "#ff526f" : "#ffd400",
                    }}
                  >
                    £{(item.cost / 10).toFixed(1)}m
                  </Text>
                  <Text style={{ color: "#9db3a6", fontSize: 12, fontWeight: "700", marginTop: 2 }}>
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
