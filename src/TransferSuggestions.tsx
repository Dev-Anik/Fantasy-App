// Suggested transfers on the Transfers page: a round button on the pitch
// opens a sheet with the best few swaps, why, and a button to make each one. The figures
// are the app's own estimate (see transferAdvice.ts), shown as advice, not
// a promise.
import { Animated, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PlayerFixture, Row } from "./fpl";
import { availability } from "./availability";
import { AppSymbol } from "./AppSymbol";
import { PlayerArt } from "./Pitch";
import { THEME, fdrColor } from "./theme";
import { useSwipeToClose } from "./useSwipeToClose";
import { HORIZON, nextFixtures } from "./transferAdvice";
import type { TransferAdvice, TransferSuggestion } from "./transferAdvice";

const INK = THEME.ink;
const SOFT = THEME.soft;
const MUTED = THEME.muted;
const POINTS = "#ffd400";
const FDR_OF = { easy: 2, average: 3, hard: 4 } as const;

const money = (value: number) => `£${(value / 10).toFixed(1)}m`;
const one = (value: number) => value.toFixed(1);

function FixtureChips({ fixtures }: { fixtures: PlayerFixture[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 3, flexWrap: "wrap" }}>
      {fixtures.map((fixture) => {
        const colour = fdrColor(fixture.fdr ?? FDR_OF[fixture.difficulty]);
        return (
          <View
            key={`${fixture.event}-${fixture.opponent}`}
            style={{ paddingHorizontal: 4, height: 16, borderRadius: 4, justifyContent: "center", backgroundColor: colour.fill }}
          >
            <Text style={{ color: colour.ink, fontSize: 9, fontWeight: "800" }}>{`${fixture.opponent} (${fixture.venue})`}</Text>
          </View>
        );
      })}
    </View>
  );
}

// One side of a swap: who, why, and his matches ahead.
function Side({ row, label, points, tone, event }: { row: Row; label: string; points: number; tone: string; event: number }) {
  const flag = availability(row.status, row.chance);
  const form = parseFloat(row.form ?? "");
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <PlayerArt team={row.team} size={22} goalkeeper={row.type === 1} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: INK, fontSize: 12.5, fontWeight: "700" }}>
            <Text style={{ color: tone, fontSize: 8.5, letterSpacing: 1 }}>{`${label}  `}</Text>
            {row.name}
          </Text>
          <Text numberOfLines={1} style={{ color: flag ? flag.color : MUTED, fontSize: 9.5, fontWeight: flag ? "700" : "500" }}>
            {flag ? flag.label : `${row.team} · form ${Number.isFinite(form) ? one(form) : "—"}`}
          </Text>
        </View>
      </View>
      <FixtureChips fixtures={nextFixtures(row.fixtures, event)} />
      <Text style={{ color: MUTED, fontSize: 9.5 }}>
        {"Est. "}
        <Text style={{ color: POINTS, fontWeight: "800" }}>{one(points)}</Text>
        {` pts in ${HORIZON} GWs`}
      </Text>
    </View>
  );
}

function SuggestionCard({
  suggestion,
  event,
  hitCost,
  onMake,
}: {
  suggestion: TransferSuggestion;
  event: number;
  hitCost: number;
  onMake: () => void;
}) {
  return (
    <View style={{ backgroundColor: THEME.surface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, gap: 7 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Side row={suggestion.out} label="SELL" points={suggestion.outPoints} tone={THEME.bad} event={event} />
        <View style={{ width: 1, backgroundColor: THEME.line }} />
        <Side row={suggestion.innRow} label="BUY" points={suggestion.inPoints} tone={THEME.good} event={event} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {/* The gain: how many more points the signing is expected to score
            than the player sold, over the gameweeks counted. */}
        <Text style={{ flex: 1, color: MUTED, fontSize: 10.5 }} numberOfLines={1}>
          <Text style={{ color: THEME.good, fontSize: 12.5, fontWeight: "800" }}>{`+${one(suggestion.gain)}`}</Text>
          {` pts more in ${HORIZON} GWs · ${money(suggestion.bankLeft)} left${suggestion.paid ? ` · −${hitCost} hit` : ""}`}
        </Text>
        <Pressable
          onPress={onMake}
          accessibilityRole="button"
          accessibilityLabel={`Sell ${suggestion.out.name}, buy ${suggestion.inn.name}`}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            height: 30,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? THEME.accentLine : THEME.accent,
          })}
        >
          <Text style={{ color: THEME.onAccent, fontSize: 12, fontWeight: "700" }}>Make transfer</Text>
        </Pressable>
      </View>
    </View>
  );
}

// The round button on the Transfers pitch (top right) that opens the
// suggestions, in the spot Home keeps for Insights: it takes no room from
// the pitch. A small dot shows how many swaps are suggested.
export function SuggestionsButton({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? `Suggested transfers: ${count}` : "Suggested transfers: none clearly worth making"
      }
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: count > 0 ? THEME.accentLine : "rgba(255, 255, 255, 0.14)",
        backgroundColor: pressed ? THEME.surfaceRaised : THEME.surface,
        elevation: 5,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      })}
    >
      <AppSymbol
        name={{ ios: "arrow.left.arrow.right", android: "swap_horiz", web: "swap_horiz" }}
        color={count > 0 ? THEME.accent : INK}
        size={18}
      />
      {count > 0 && (
        <View
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 3,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: THEME.accent,
            borderWidth: 1.5,
            borderColor: THEME.bg,
          }}
        >
          <Text style={{ color: THEME.onAccent, fontSize: 9, fontWeight: "800" }}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

// The sheet with the suggested swaps.
export function TransferSuggestions({
  advice,
  event,
  hitCost,
  open,
  onClose,
  onMake,
}: {
  advice: TransferAdvice;
  // The first gameweek counted (the one the transfers are for).
  event: number;
  hitCost: number;
  open: boolean;
  onClose: () => void;
  onMake: (suggestion: TransferSuggestion) => void;
}) {
  const insets = useSafeAreaInsets();
  const close = onClose;
  const swipe = useSwipeToClose(close, open);

  return (
    <>
      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={close}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(3, 5, 12, 0.55)" }}
          />
          <Animated.View
            accessibilityViewIsModal
            {...swipe.panHandlers}
            style={{
              transform: swipe.transform,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: THEME.surfaceRaised,
              paddingTop: 10,
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 20,
              gap: 10,
            }}
          >
            <View style={{ alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(255, 255, 255, 0.18)" }} />
            <View>
              <Text accessibilityRole="header" style={{ color: INK, fontSize: 18, fontWeight: "700" }}>
                Suggested transfers
              </Text>
              <Text style={{ color: SOFT, fontSize: 11.5, lineHeight: 16, marginTop: 3 }}>
                {`Skippr's estimate for the next ${HORIZON} gameweeks (GW ${event}–${event + HORIZON - 1}): form, points per match, fixtures, clean sheet chances and injury news. A guide, not a guarantee.`}
              </Text>
            </View>
            {advice.suggestions.length > 0 ? (
              advice.suggestions.map((suggestion) => (
                <SuggestionCard
                  key={`${suggestion.out.id}-${suggestion.inn.id}`}
                  suggestion={suggestion}
                  event={event}
                  hitCost={hitCost}
                  onMake={() => {
                    close();
                    onMake(suggestion);
                  }}
                />
              ))
            ) : (
              <View style={{ backgroundColor: THEME.surface, borderRadius: 14, padding: 14, gap: 4 }}>
                <Text style={{ color: INK, fontSize: 14, fontWeight: "700" }}>Keep your transfer</Text>
                <Text style={{ color: SOFT, fontSize: 12, lineHeight: 17 }}>
                  {advice.freeLeft === 0
                    ? `No swap gains clearly more than the −${hitCost} it would cost.`
                    : "No swap clearly improves your team. Rolling it gives you an extra free transfer next week."}
                </Text>
              </View>
            )}
            {advice.freeLeft === 0 && advice.suggestions.length > 0 && (
              <Text style={{ color: MUTED, fontSize: 11 }}>{`No free transfers left: each of these costs −${hitCost} (the gains shown are before it).`}</Text>
            )}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
