// "Chips & captain": for the coming gameweek, the strongest captain options
// in the user's lineup and a reading on each chip, with the facts behind them.
// Observations from FPL data only; the decision stays with the user.
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Row } from "./fpl";
import { AppSymbol } from "./AppSymbol";
import { PlayerArt } from "./Pitch";
import { FOOTER_HEIGHT, ScreenBackground, THEME } from "./theme";
import { Divider, Group, Heading } from "./leagueUi";
import { adviseGameweek } from "./gameweekAdvice";
import type { ChipReading, ChipWindow, Verdict } from "./gameweekAdvice";
import { loadFplBasics } from "./fplPublic";

const INK = THEME.ink;
const SOFT = THEME.soft;
const MUTED = THEME.muted;
const DISCLAIMER =
  "These are observations from FPL data, not recommendations. Every decision about your team is yours.";

const VERDICT_STYLE: Record<Verdict, { color: string; background: string }> = {
  consider: { color: THEME.accent, background: THEME.accentSoft },
  save: { color: SOFT, background: "rgba(255, 255, 255, 0.07)" },
  active: { color: "#f2c14e", background: "rgba(242, 193, 78, 0.14)" },
  unavailable: { color: MUTED, background: "transparent" },
};

function Reasons({ items }: { items: string[] }) {
  return (
    <View style={{ marginTop: 6, gap: 3 }}>
      {items.map((text) => (
        <View key={text} style={{ flexDirection: "row", gap: 7 }}>
          <Text style={{ color: MUTED, fontSize: 12.5, lineHeight: 18 }}>•</Text>
          <Text style={{ flex: 1, color: SOFT, fontSize: 12.5, lineHeight: 18 }}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

function ChipRow({ chip }: { chip: ChipReading }) {
  const style = VERDICT_STYLE[chip.verdict];
  const dim = chip.verdict === "unavailable";
  return (
    <View
      accessible
      accessibilityLabel={`${chip.name}: ${chip.headline}. ${chip.reasons.join(". ")}`}
      style={{ paddingHorizontal: 14, paddingVertical: 13, opacity: dim ? 0.6 : 1 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: INK, fontSize: 15, fontWeight: "600" }}>{chip.name}</Text>
        <View
          style={{
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: 10,
            backgroundColor: style.background,
            borderWidth: chip.verdict === "unavailable" ? 1 : 0,
            borderColor: "rgba(255, 255, 255, 0.12)",
          }}
        >
          <Text style={{ color: style.color, fontSize: 11.5, fontWeight: "600" }}>{chip.headline}</Text>
        </View>
      </View>
      {chip.reasons.length > 0 && <Reasons items={chip.reasons} />}
    </View>
  );
}

export function GameweekHelper({
  rows,
  event,
  eventName,
  chipStatuses,
  activeChip,
  onBack,
}: {
  // The lineup as it stands in the app, unsaved changes included.
  rows: Row[];
  event: number;
  eventName: string;
  chipStatuses: Record<string, string>;
  activeChip: string | null;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [chipWindows, setChipWindows] = useState<ChipWindow[] | undefined>(undefined);

  useEffect(() => {
    let active = true;
    loadFplBasics()
      .then((basics) => {
        if (active) setChipWindows(basics.chipWindows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const advice = useMemo(
    () => adviseGameweek({ rows, event, chipStatuses, activeChip, chipWindows }),
    [rows, event, chipStatuses, activeChip, chipWindows],
  );
  const top = advice.captains[0];
  const current = advice.currentCaptain;
  const captainIsTop = !!top && !!current && top.row.id === current.row.id;

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      <ScreenBackground />
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16 }}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            paddingVertical: 6,
            marginLeft: -4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <AppSymbol name={{ ios: "chevron.left", android: "chevron_left", web: "chevron_left" }} color={SOFT} size={20} />
          <Text style={{ color: SOFT, fontSize: 14, fontWeight: "500" }}>Back</Text>
        </Pressable>
        <Text accessibilityRole="header" style={{ color: INK, fontSize: 24, fontWeight: "700", marginTop: 6 }}>
          Chips & captain
        </Text>
        <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{`${eventName}, for your current lineup`}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + FOOTER_HEIGHT + 28 }}>
        <Heading first hint="Ranked by Skippr's own estimate, not an FPL figure (how it works is below)">
          Captain
        </Heading>
        <Group>
          {advice.captains.map((option, index) => (
            <View key={option.row.id}>
              {index > 0 && <Divider />}
              <View
                accessible
                accessibilityLabel={`${index + 1}. ${option.row.name}, ${option.row.team}. ${option.reasons.join(". ")}`}
                style={{ paddingHorizontal: 14, paddingVertical: 13 }}
              >
              {/* Top: avatar, name and estimate. Below: the reasons, across
                  the card's full width. */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <PlayerArt team={option.row.team} size={40} goalkeeper={option.row.type === 1} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, color: INK, fontSize: 15, fontWeight: "600" }}>
                      {option.row.name}
                    </Text>
                    {index === 0 && (
                      <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: THEME.accentSoft }}>
                        <Text style={{ color: THEME.accent, fontSize: 10.5, fontWeight: "600" }}>Highest estimate</Text>
                      </View>
                    )}
                    {option.row.cap && (
                      <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#f2c14e" }}>
                        <Text style={{ color: THEME.onAccent, fontSize: 10, fontWeight: "800" }}>C</Text>
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={1} style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                    {option.row.team}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: index === 0 ? THEME.accent : INK, fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                    {option.expected.toFixed(1)}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: 10, letterSpacing: 1 }}>EST PTS</Text>
                </View>
              </View>
              <Reasons items={option.reasons} />
              </View>
            </View>
          ))}
        </Group>
        {!!current && !captainIsTop && (
          <Text style={{ color: MUTED, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 2 }}>
            {`Your captain now is ${current.row.name} (${current.expected.toFixed(1)} estimated points). If you decide to switch, the armband can be moved on the Lineup page.`}
          </Text>
        )}
        {captainIsTop && (
          <Text style={{ color: MUTED, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 2 }}>
            Your captain already has the highest estimate in your lineup.
          </Text>
        )}

        <Heading hint="One chip per gameweek. Each reading lists the facts behind it.">Chips</Heading>
        <Group>
          {advice.chips.map((chip, index) => (
            <View key={chip.key}>
              {index > 0 && <Divider />}
              <ChipRow chip={chip} />
            </View>
          ))}
        </Group>

        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginTop: 20,
            padding: 12,
            borderRadius: 12,
            backgroundColor: "rgba(255, 255, 255, 0.04)",
          }}
        >
          <AppSymbol name={{ ios: "info.circle", android: "info", web: "info" }} color={MUTED} size={15} />
          <Text style={{ flex: 1, color: MUTED, fontSize: 12, lineHeight: 17 }}>
            {`Estimated points are Skippr's own calculation, not a figure from FPL: the average of a player's form and his points per match this season, adjusted for fixture difficulty and home or away. Defenders and keepers count 85%, doubtful players are scaled by their chance of playing${advice.formOnly ? " (season averages load with your next refresh; form alone is used until then)" : ""}. It is a rule of thumb, not a forecast.

${DISCLAIMER}`}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
