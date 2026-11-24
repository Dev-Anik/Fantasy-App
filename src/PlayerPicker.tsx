// The transfer market: every player who can fill the chosen spot, laid out
// like a market table (form, points, price tag), with the deal at the top:
// who is being sold, what he sells for, and the budget for the new signing.
// Tapping a player opens his profile, where he can be signed.
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Player, PlayerFixture, Row } from "./fpl";
import { availability } from "./availability";
import { PlayerArt } from "./Pitch";
import { AppSymbol } from "./AppSymbol";
import { PlayerDetailsSheet } from "./PlayerDetailsSheet";
import { FRESH, fplJson } from "./fplCache";
import type { FplElement } from "./PlayerProfile";
import { ScreenBackground, THEME, fdrColor } from "./theme";

const ACCENT = THEME.accent;
const INK = THEME.ink;
const SOFT = THEME.soft;
const MUTED = THEME.muted;
const BAD = THEME.bad;
const GOOD = THEME.good;
const POS = ["", "GKP", "DEF", "MID", "FWD"];
// Column widths of the market table.
const COL_FORM = 38;
const COL_PTS = 38;
const COL_PRICE = 74;

type SortMode = "pts" | "form" | "cost-desc" | "cost-asc";

const money = (value: number) => `£${(value / 10).toFixed(1)}m`;
const FDR_OF = { easy: 2, average: 3, hard: 4 } as const;
// Upcoming matches shown under each player.
const NEXT_MATCHES = 3;

// The next few opponents, each coloured by difficulty: a small line under
// the club.
function NextMatches({ next }: { next: PlayerFixture[] }) {
  if (next.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 }}>
      {next.map((fixture) => {
        const colour = fdrColor(fixture.fdr ?? FDR_OF[fixture.difficulty]);
        return (
          <View
            key={`${fixture.event}-${fixture.opponent}`}
            style={{ paddingHorizontal: 4, height: 17, borderRadius: 5, justifyContent: "center", backgroundColor: colour.fill }}
          >
            <Text style={{ color: colour.ink, fontSize: 9.5, fontWeight: "800" }}>
              {`${fixture.opponent} (${fixture.venue})`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// A section of the segmented sort control.
function SortTab({
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        flex: 1,
        height: 32,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? THEME.surfaceRaised : pressed ? "rgba(255, 255, 255, 0.04)" : "transparent",
        borderWidth: active ? 1 : 0,
        borderColor: "rgba(255, 255, 255, 0.1)",
      })}
    >
      <Text style={{ color: active ? INK : MUTED, fontSize: 12.5, fontWeight: active ? "700" : "500" }}>{label}</Text>
    </Pressable>
  );
}

function ColumnHead({ label, width, active, align = "center" }: { label: string; width?: number; active: boolean; align?: "left" | "center" | "right" }) {
  return (
    <Text
      style={{
        width,
        flex: width ? undefined : 1,
        textAlign: align,
        color: active ? ACCENT : MUTED,
        fontSize: 9.5,
        fontWeight: "600",
        letterSpacing: 1.4,
      }}
    >
      {label}
    </Text>
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
  sellPrice,
  onPick,
  onClose,
  fixturesByTeam = {},
  nextEvent,
  elements = {},
  elementFailed = false,
  onRetryElement,
  teamNames = {},
  currentGw,
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
  // What the outgoing player sells for (tenths of a million).
  sellPrice?: number;
  onPick: (p: Player) => void;
  onClose: () => void;
  fixturesByTeam?: Record<number, PlayerFixture[]>;
  // The first gameweek still to be played (the next few from it are shown).
  nextEvent: number;
  // For the profile opened from the list.
  elements?: Record<number, FplElement>;
  elementFailed?: boolean;
  onRetryElement?: () => void;
  teamNames?: Record<number, string>;
  currentGw: number;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  // The player whose profile is open.
  const [viewing, setViewing] = useState<Player | null>(null);
  const nextMatches = (teamId: number) =>
    (fixturesByTeam[teamId] ?? []).filter((f) => f.event >= nextEvent && !f.finished).slice(0, NEXT_MATCHES);
  const [sort, setSort] = useState<SortMode>("pts");
  const [affordableOnly, setAffordableOnly] = useState(false);

  const outgoing = useMemo(
    () => (outgoingId == null ? null : (candidates.find((c) => c.id === outgoingId) ?? null)),
    [candidates, outgoingId],
  );

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
    setQ("");
    setViewing(null);
    onClose();
  };
  const pick = (player: Player) => {
    setQ("");
    setViewing(null);
    onPick(player);
  };
  // The open profile, in the sheet's terms.
  const viewingRow: Row | null = viewing
    ? {
        id: viewing.id,
        pos: 0,
        name: viewing.name,
        team: viewing.team,
        teamId: viewing.teamId,
        type: viewing.type,
        cap: false,
        vice: false,
        sell: viewing.cost,
        buy: viewing.cost,
        price: viewing.cost,
        form: viewing.form,
        ownership: viewing.ownership,
        priceChange: viewing.priceChange,
        status: viewing.status,
        chance: viewing.chance,
        news: viewing.news,
        fixtures: fixturesByTeam[viewing.teamId] ?? [],
        totalPoints: viewing.pts,
        ppg: viewing.ppg,
      }
    : null;
  // Why the open player can't be signed, if he can't.
  const viewingBlock = !viewing
    ? null
    : squadIds.includes(viewing.id)
      ? "Already in your squad"
      : fullClubs.includes(viewing.teamId)
        ? "3 from this club already"
        : viewing.cost > maxCost
          ? `${money(viewing.cost - maxCost)} over budget`
          : null;

  const priceSorted = sort === "cost-desc" || sort === "cost-asc";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: THEME.bg, paddingTop: insets.top }}>
        <ScreenBackground />

        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          {/* Title and close */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: ACCENT, fontSize: 10.5, fontWeight: "600", letterSpacing: 2.2 }}>TRANSFER MARKET</Text>
              <Text numberOfLines={1} style={{ color: INK, fontSize: 21, fontWeight: "700", marginTop: 4 }}>
                {title}
              </Text>
            </View>
            <Pressable
              onPress={close}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close transfer market"
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.07)",
              })}
            >
              <AppSymbol name={{ ios: "xmark", android: "close", web: "close" }} color={SOFT} size={17} />
            </Pressable>
          </View>

          {/* The deal: who goes out, and what there is to spend */}
          <View
            accessible
            accessibilityLabel={`${outgoing ? `Selling ${outgoing.name}${sellPrice != null ? ` for ${money(sellPrice)}` : ""}. ` : ""}Budget for the new player: up to ${money(maxCost)}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 14,
              borderRadius: 16,
              backgroundColor: THEME.surface,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.07)",
              overflow: "hidden",
            }}
          >
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
              {outgoing ? (
                <>
                  <PlayerArt team={outgoing.team} size={38} goalkeeper={outgoing.type === 1} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <AppSymbol name={{ ios: "arrow.down", android: "arrow_downward", web: "arrow_downward" }} color={BAD} size={11} />
                      <Text style={{ color: BAD, fontSize: 9.5, fontWeight: "600", letterSpacing: 1.4 }}>SELLING</Text>
                    </View>
                    <Text numberOfLines={1} style={{ color: INK, fontSize: 14.5, fontWeight: "600", marginTop: 2 }}>
                      {outgoing.name}
                    </Text>
                    {sellPrice != null && (
                      <Text style={{ color: MUTED, fontSize: 11.5, marginTop: 1 }}>{`Sells for ${money(sellPrice)}`}</Text>
                    )}
                  </View>
                </>
              ) : (
                <Text style={{ color: SOFT, fontSize: 13 }}>{subtitle}</Text>
              )}
            </View>
            <View
              style={{
                alignSelf: "stretch",
                justifyContent: "center",
                alignItems: "flex-end",
                paddingHorizontal: 14,
                backgroundColor: THEME.accentSoft,
                borderLeftWidth: 1,
                borderLeftColor: THEME.accentLine,
              }}
            >
              <Text style={{ color: ACCENT, fontSize: 9.5, fontWeight: "600", letterSpacing: 1.4 }}>BUDGET</Text>
              <Text style={{ color: INK, fontSize: 20, fontWeight: "700", marginTop: 2, fontVariant: ["tabular-nums"] }}>
                {money(maxCost)}
              </Text>
            </View>
          </View>

          {/* Search */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 12,
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.08)",
              paddingHorizontal: 12,
              height: 42,
              marginTop: 12,
            }}
          >
            <AppSymbol name={{ ios: "magnifyingglass", android: "search", web: "search" }} color={MUTED} size={17} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search player or club"
              placeholderTextColor={MUTED}
              selectionColor={ACCENT}
              cursorColor={ACCENT}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search player or club"
              style={{ flex: 1, color: INK, fontSize: 14, marginLeft: 8, paddingVertical: 0 }}
            />
            {q.length > 0 && (
              <Pressable onPress={() => setQ("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                <AppSymbol name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }} color={MUTED} size={17} />
              </Pressable>
            )}
          </View>

          {/* Sort */}
          <View
            style={{
              flexDirection: "row",
              gap: 4,
              padding: 3,
              marginTop: 10,
              borderRadius: 12,
              backgroundColor: "rgba(255, 255, 255, 0.04)",
            }}
          >
            <SortTab label="Points" active={sort === "pts"} onPress={() => setSort("pts")} accessibilityLabel="Sort by total points" />
            <SortTab label="Form" active={sort === "form"} onPress={() => setSort("form")} accessibilityLabel="Sort by form" />
            <SortTab
              label={sort === "cost-asc" ? "Price ↑" : "Price ↓"}
              active={priceSorted}
              onPress={() => setSort(sort === "cost-desc" ? "cost-asc" : "cost-desc")}
              accessibilityLabel={sort === "cost-desc" ? "Sorted by price, highest first. Tap to reverse" : "Sort by price"}
            />
          </View>

          {/* Count and the affordability filter */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <Text style={{ color: MUTED, fontSize: 12 }}>
              {list.length} {list.length === 1 ? "player" : "players"}
            </Text>
            <Pressable
              onPress={() => setAffordableOnly((value) => !value)}
              accessibilityRole="switch"
              accessibilityState={{ checked: affordableOnly }}
              accessibilityLabel="Only show players you can sign"
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text style={{ color: affordableOnly ? INK : SOFT, fontSize: 12.5, fontWeight: "500" }}>Can afford</Text>
              <View
                style={{
                  width: 34,
                  height: 20,
                  borderRadius: 10,
                  padding: 2,
                  backgroundColor: affordableOnly ? ACCENT : "rgba(255, 255, 255, 0.14)",
                  alignItems: affordableOnly ? "flex-end" : "flex-start",
                }}
              >
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: affordableOnly ? THEME.onAccent : SOFT }} />
              </View>
            </Pressable>
          </View>

          {/* Table head */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 12,
              paddingBottom: 8,
              paddingHorizontal: 4,
              borderBottomWidth: 1,
              borderBottomColor: THEME.line,
            }}
          >
            <ColumnHead label="PLAYER" active={false} align="left" />
            <ColumnHead label="FORM" width={COL_FORM} active={sort === "form"} />
            <ColumnHead label="PTS" width={COL_PTS} active={sort === "pts"} />
            <ColumnHead label="PRICE" width={COL_PRICE} active={priceSorted} align="right" />
          </View>
        </View>

        <FlatList
          data={list}
          keyExtractor={(p) => String(p.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={9}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, marginLeft: 52, backgroundColor: THEME.line }} />}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: MUTED, marginTop: 40, fontSize: 14 }}>
              {affordableOnly ? "No players you can afford match. Try turning off \"Can afford\"." : "No players found."}
            </Text>
          }
          renderItem={({ item }) => {
            const inSquad = squadIds.includes(item.id);
            const isOutgoing = item.id === outgoingId;
            const tooPricey = !inSquad && item.cost > maxCost;
            const clubFull = !inSquad && fullClubs.includes(item.teamId);
            const blocked = tooPricey || clubFull;
            const flag = availability(item.status, item.chance);
            // A note under the name: why the player can't be signed, or his squad status.
            const note = isOutgoing
              ? { text: "Selling", color: "#f2c14e" }
              : inSquad
                ? { text: "In your squad", color: MUTED }
                : clubFull
                  ? { text: "3 from this club already", color: BAD }
                  : null;
            const change = item.priceChange;

            return (
              <Pressable
                // Start reading his record as the finger lands, so the
                // profile opens sooner.
                onPressIn={() => {
                  fplJson(`element-summary/${item.id}/`, FRESH.settled).catch(() => {});
                }}
                onPress={() => setViewing(item)}
                accessibilityRole="button"
                accessibilityHint="Opens his profile"
                accessibilityLabel={`${item.name}, ${item.team}, ${POS[item.type]}, ${money(item.cost)}, ${item.pts} points, form ${item.form}, owned by ${item.ownership} percent${
                  flag ? `, ${flag.label}` : ""
                }${
                  isOutgoing
                    ? ", the player you are replacing"
                    : inSquad
                      ? ", already in your squad"
                      : clubFull
                        ? ", club limit reached"
                        : tooPricey
                          ? `, ${money(item.cost - maxCost)} over budget`
                          : ""
                }`}
                android_ripple={{ color: "rgba(255, 255, 255, 0.06)" }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 4,
                  borderRadius: 10,
                  backgroundColor: pressed ? "rgba(255, 255, 255, 0.04)" : "transparent",
                  opacity: inSquad ? 0.5 : blocked ? 0.6 : 1,
                })}
              >
                {/* The avatar, with the position as a small tag on its lower
                    edge (kept out of the text line, so nothing is cut off). */}
                <View style={{ width: 40, alignItems: "center" }}>
                  <PlayerArt team={item.team} size={40} goalkeeper={item.type === 1} />
                  <View
                    style={{
                      position: "absolute",
                      bottom: -3,
                      paddingHorizontal: 4,
                      paddingVertical: 0.5,
                      borderRadius: 4,
                      backgroundColor: THEME.surfaceRaised,
                      borderWidth: 0.5,
                      borderColor: "rgba(255, 255, 255, 0.16)",
                    }}
                  >
                    <Text
                      allowFontScaling={false}
                      style={{ color: SOFT, fontSize: 8, fontWeight: "700", letterSpacing: 0.4, includeFontPadding: false }}
                    >
                      {POS[item.type]}
                    </Text>
                  </View>
                </View>

                <View style={{ flex: 1, marginLeft: 10, paddingRight: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, color: INK, fontSize: 14.5, fontWeight: "600" }}>
                      {item.name}
                    </Text>
                    {flag && (
                      <View style={{ borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: `${flag.color}26` }}>
                        <Text style={{ color: flag.color, fontSize: 9, fontWeight: "700" }}>
                          {(flag.level === "doubtful" ? flag.short : flag.label).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  {/* Club and ownership: short enough to fit in full on any
                      phone (the position is on the avatar). */}
                  <Text numberOfLines={1} style={{ color: MUTED, fontSize: 11.5, marginTop: 2 }}>
                    {`${item.team} · ${item.ownership}% owned`}
                  </Text>
                  {note && (
                    <Text numberOfLines={1} style={{ color: note.color, fontSize: 11, fontWeight: "600", marginTop: 2 }}>
                      {note.text}
                    </Text>
                  )}
                  <NextMatches next={nextMatches(item.teamId)} />
                </View>

                <Text
                  style={{
                    width: COL_FORM,
                    textAlign: "center",
                    color: sort === "form" ? INK : SOFT,
                    fontSize: 13.5,
                    fontWeight: sort === "form" ? "700" : "500",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {item.form}
                </Text>
                <Text
                  style={{
                    width: COL_PTS,
                    textAlign: "center",
                    color: sort === "pts" ? INK : SOFT,
                    fontSize: 13.5,
                    fontWeight: sort === "pts" ? "700" : "500",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {item.pts}
                </Text>

                {/* Price tag */}
                <View style={{ width: COL_PRICE, alignItems: "flex-end" }}>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: tooPricey ? "rgba(255, 107, 125, 0.12)" : THEME.accentSoft,
                      borderWidth: 1,
                      borderColor: tooPricey ? "rgba(255, 107, 125, 0.4)" : THEME.accentLine,
                    }}
                  >
                    <Text
                      style={{
                        color: tooPricey ? BAD : INK,
                        fontSize: 13.5,
                        fontWeight: "700",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {money(item.cost)}
                    </Text>
                  </View>
                  {tooPricey ? (
                    <Text style={{ color: BAD, fontSize: 10.5, fontWeight: "600", marginTop: 3 }}>
                      {`+${money(item.cost - maxCost)}`}
                    </Text>
                  ) : change !== 0 && !!change ? (
                    <Text style={{ color: change > 0 ? GOOD : BAD, fontSize: 10.5, fontWeight: "600", marginTop: 3 }}>
                      {`${change > 0 ? "▲" : "▼"} ${(Math.abs(change) / 10).toFixed(1)}`}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      </View>
      {/* His profile, over the market (inside this Modal, so it shows on top). */}
      <PlayerDetailsSheet
        visible={!!viewingRow}
        player={viewingRow}
        currentGw={currentGw}
        bottomInset={insets.bottom}
        isTransferMode
        isReplaced={false}
        actionsEnabled
        onClose={() => setViewing(null)}
        onSetRole={() => {}}
        onTransfer={() => {}}
        onUndoTransfer={() => {}}
        onStartSubstitution={() => {}}
        element={viewing ? (elements[viewing.id] ?? null) : null}
        elementFailed={elementFailed}
        onRetryElement={onRetryElement}
        teamNames={teamNames}
        signAction={
          viewing
            ? {
                label: `Sign for ${money(viewing.cost)}`,
                blockedReason: viewingBlock,
                onPress: () => pick(viewing),
              }
            : undefined
        }
      />
    </Modal>
  );
}
