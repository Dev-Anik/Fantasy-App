import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import type { GestureResponderEvent } from "react-native";
import type { SymbolViewProps } from "expo-symbols";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Player } from "./fpl";
import { availability } from "./availability";
import { PlayerArt } from "./Pitch";
import { AppSymbol } from "./AppSymbol";

const GREEN = "#00d982";
const DARK_GREEN = "#051a0f";
const MUTED = "#9db3a6";
const RED = "#ff526f";
const POS = ["", "GKP", "DEF", "MID", "FWD"];

// FPL availability codes, in words.

const GOLD_TEXT = "#ffd400";
const TIP_WIDTH = 210;

// Icons that stand in for text labels in a player row. Tapping one shows
// its meaning in a tooltip.
type IconName = SymbolViewProps["name"];
const ICONS: Record<string, { name: IconName; tip: string }> = {
  form: {
    name: { ios: "chart.line.uptrend.xyaxis", android: "trending_up", web: "trending_up" },
    tip: "Form: average points per match over the last 30 days",
  },
  owned: {
    name: { ios: "person.2.fill", android: "group", web: "group" },
    tip: "Ownership: share of all managers who own this player",
  },
  points: {
    name: { ios: "star.fill", android: "star", web: "star" },
    tip: "Total points this season",
  },
  clubFull: {
    name: { ios: "nosign", android: "block", web: "block" },
    tip: "Club limit reached: you already have 3 players from this club",
  },
  overBudget: {
    name: { ios: "banknote.fill", android: "payments", web: "payments" },
    tip: "Over budget: costs more than you can spend on this spot",
  },
  inSquad: {
    name: { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" },
    tip: "Already in your squad",
  },
  replacing: {
    name: { ios: "arrow.left.arrow.right", android: "swap_horiz", web: "swap_horiz" },
    tip: "The player you are replacing",
  },
};

type ShowTip = (text: string, event: GestureResponderEvent) => void;

// An icon with its value. The icon replaces a text label; tapping explains it.
function IconStat({
  icon,
  value,
  color = MUTED,
  onTip,
  size = 12,
  bold = false,
}: {
  icon: keyof typeof ICONS;
  value?: string;
  color?: string;
  onTip: ShowTip;
  size?: number;
  bold?: boolean;
}) {
  const { name, tip } = ICONS[icon];
  return (
    <Pressable
      onPress={(event) => onTip(tip, event)}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={`${tip}${value ? `: ${value}` : ""}`}
      accessibilityHint="Shows what this icon means"
      style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
    >
      <AppSymbol name={name} color={color} size={size + 1} />
      {!!value && (
        <Text style={{ color, fontSize: size, fontWeight: bold ? "800" : "600" }}>{value}</Text>
      )}
    </Pressable>
  );
}

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
  squadIds = [],
  outgoingId = null,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  candidates: Player[];
  maxCost: number;
  fullClubs: number[];
  // Players already in the squad: listed, but can't be picked again.
  squadIds?: number[];
  // The squad player this transfer replaces.
  outgoingId?: number | null;
  onPick: (p: Player) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("pts");
  const [affordableOnly, setAffordableOnly] = useState(false);

  // Tooltip for a tapped icon, anchored above the touch point.
  const { width: windowWidth } = useWindowDimensions();
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTip = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = null;
    setTip(null);
  };
  const showTip: ShowTip = (text, event) => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    setTip({ text, x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
    tipTimer.current = setTimeout(() => setTip(null), 3000);
  };
  useEffect(() => () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
  }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = candidates.filter(
      (c) =>
        (!s || c.name.toLowerCase().includes(s) || c.team.toLowerCase().includes(s)) &&
        (!affordableOnly ||
          (c.cost <= maxCost && !fullClubs.includes(c.teamId) && !squadIds.includes(c.id))),
    );
    return filtered.sort((a, b) => {
      if (sort === "pts") return b.pts - a.pts;
      if (sort === "form") return (parseFloat(b.form) || 0) - (parseFloat(a.form) || 0);
      if (sort === "cost-desc") return b.cost - a.cost;
      return a.cost - b.cost;
    });
  }, [candidates, q, sort, affordableOnly, maxCost, fullClubs, squadIds]);

  // Start each visit with a clean search; the sort and filter are kept.
  const close = () => {
    hideTip();
    setQ("");
    onClose();
  };
  const pick = (player: Player) => {
    hideTip();
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
          onScrollBeginDrag={hideTip}
          renderItem={({ item }) => {
            const inSquad = squadIds.includes(item.id);
            const outgoing = item.id === outgoingId;
            const tooPricey = !inSquad && item.cost > maxCost;
            const clubFull = !inSquad && fullClubs.includes(item.teamId);
            const blocked = tooPricey || clubFull;
            const flag = availability(item.status, item.chance);
            const status = flag
              ? {
                  // Doubtful players show their chance of playing, e.g. "75%".
                  text: flag.level === "doubtful" ? flag.short : flag.label,
                  label: flag.label,
                  color: flag.color,
                }
              : undefined;

            return (
              <Pressable
                onPress={() => pick(item)}
                disabled={inSquad}
                accessibilityRole="button"
                accessibilityState={{ disabled: inSquad }}
                accessibilityLabel={`${item.name}, ${item.team}, ${money(item.cost)}, ${item.pts} points, form ${item.form}, owned by ${item.ownership} percent${
                  status ? `, ${status.label}` : ""
                }${
                  outgoing
                    ? ", the player you are replacing"
                    : inSquad
                      ? ", already in your squad"
                      : clubFull
                        ? ", club limit reached"
                        : tooPricey
                          ? ", over budget"
                          : ""
                }`}
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
                  borderColor: inSquad
                    ? "rgba(0, 217, 130, 0.35)"
                    : blocked
                      ? "rgba(255, 82, 111, 0.3)"
                      : "rgba(255, 255, 255, 0.1)",
                  opacity: pressed ? 0.75 : inSquad ? 0.6 : blocked ? 0.55 : 1,
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 3 }}>
                    <Text numberOfLines={1} style={{ color: MUTED, fontSize: 12, fontWeight: "700" }}>
                      {item.team} · {POS[item.type]}
                    </Text>
                    <IconStat icon="form" value={item.form} onTip={showTip} />
                    <IconStat icon="owned" value={`${item.ownership}%`} onTip={showTip} />
                    {inSquad && (
                      <IconStat
                        icon={outgoing ? "replacing" : "inSquad"}
                        color={outgoing ? GOLD_TEXT : GREEN}
                        onTip={showTip}
                      />
                    )}
                    {clubFull && <IconStat icon="clubFull" color={RED} onTip={showTip} />}
                    {tooPricey && !clubFull && (
                      <IconStat
                        icon="overBudget"
                        value={`+${money(item.cost - maxCost)}`}
                        color={RED}
                        bold
                        onTip={showTip}
                      />
                    )}
                  </View>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: tooPricey ? RED : "#ffffff" }}>
                    {money(item.cost)}
                  </Text>
                  <View style={{ marginTop: 3 }}>
                    <IconStat icon="points" value={String(item.pts)} color={GREEN} bold onTip={showTip} />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
        {tip && (
          <Pressable
            onPress={hideTip}
            accessibilityRole="button"
            accessibilityLabel={`${tip.text}. Dismiss`}
            style={{
              position: "absolute",
              // Above the finger, kept inside the screen edges.
              top: Math.max(8, tip.y - 58),
              left: Math.min(Math.max(8, tip.x - TIP_WIDTH / 2), windowWidth - TIP_WIDTH - 8),
              width: TIP_WIDTH,
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 10,
              backgroundColor: "#f4fbf7",
              borderWidth: 1,
              borderColor: "rgba(0, 217, 130, 0.6)",
              elevation: 12,
              shadowColor: "#000",
              shadowOpacity: 0.35,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              zIndex: 50,
            }}
          >
            <Text style={{ color: DARK_GREEN, fontSize: 12, fontWeight: "700", lineHeight: 16 }}>
              {tip.text}
            </Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}
