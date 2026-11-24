// "My career": a manager's whole FPL history, season by season (see
// career.ts). Headline numbers, a few plain facts, a chart of where each
// season finished, the best and worst seasons, and every season listed.
// Same quiet style as My season: small headings, colour only where it means
// something (how high a season finished).
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSymbol } from "./AppSymbol";
import { ScreenBackground, THEME } from "./theme";
import { loadCareerShared, peekCareer } from "./career";
import type { Career, CareerSeason } from "./career";

const INK = THEME.ink;
const SOFT = THEME.soft;
const MUTED = THEME.muted;
const LINE = THEME.line;
const CHART_HEIGHT = 120;

const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const compactRank = (rank: number | null) => {
  if (!rank) return "—";
  if (rank >= 1_000_000) return `${(rank / 1_000_000).toFixed(2)}m`;
  if (rank >= 10_000) return `${Math.round(rank / 1000)}k`;
  return formatNumber(rank);
};
// "2018/19" → "18/19", for the chart.
const shortSeason = (name: string) => name.replace(/^\d{2}/, "");

// How high a season finished, as a colour: top 1% gold, top 10% green, top
// half blue, the rest grey.
function tier(topPercent: number | null) {
  if (topPercent == null) return { color: MUTED, label: "—" };
  if (topPercent <= 1) return { color: "#f2c14e", label: `Top ${topPercent}%` };
  if (topPercent <= 10) return { color: THEME.good, label: `Top ${topPercent}%` };
  if (topPercent <= 50) return { color: "#5b8cff", label: `Top ${topPercent}%` };
  return { color: "#8a90a2", label: `Top ${topPercent}%` };
}

function Heading({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{ color: SOFT, fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginTop: 22, marginBottom: 8 }}
    >
      {children}
    </Text>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ""}`}
      style={{ width: "48.5%", padding: 12, borderRadius: 12, backgroundColor: THEME.surface }}
    >
      <Text style={{ color: MUTED, fontSize: 10.5, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: INK, fontSize: 20, fontWeight: "800", marginTop: 3, fontVariant: ["tabular-nums"] }}>{value}</Text>
      {!!note && <Text style={{ color: MUTED, fontSize: 10.5, marginTop: 1 }}>{note}</Text>}
    </View>
  );
}

function TierTag({ topPercent }: { topPercent: number | null }) {
  const t = tier(topPercent);
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: `${t.color}26` }}>
      <Text style={{ color: t.color, fontSize: 10.5, fontWeight: "800" }}>{t.label}</Text>
    </View>
  );
}

// How tall a finish stands, on a log scale so the top end has room: top 1%
// is full height, top 10% half, top 100% nothing (a straight percentage
// squeezes every good season into the last sliver).
const barShare = (topPercent: number) =>
  Math.min(1, Math.max(0.05, 1 - Math.log10(Math.max(1, topPercent)) / 2));
const GUIDES = [1, 10, 50];
const BAR_WIDTH = 30;

// Each season as a slim rounded bar over guide lines at the top 1%, 10% and
// 50%: the higher it finished, the taller. The season in play is outlined,
// as it isn't final.
function FinishChart({ seasons }: { seasons: CareerSeason[] }) {
  const shown = seasons.filter((season) => season.topPercent != null);
  if (shown.length < 2) return null;
  return (
    <View style={{ paddingVertical: 14, paddingRight: 14, paddingLeft: 8, borderRadius: 14, backgroundColor: THEME.surface }}>
      <View style={{ flexDirection: "row" }}>
        {/* Guide labels */}
        <View style={{ width: 46, height: CHART_HEIGHT, marginTop: 18 }}>
          {GUIDES.map((guide) => (
            <Text
              key={guide}
              style={{
                position: "absolute",
                right: 6,
                top: CHART_HEIGHT * (1 - barShare(guide)) - 6,
                color: MUTED,
                fontSize: 9,
                fontWeight: "600",
              }}
            >
              {`Top ${guide}%`}
            </Text>
          ))}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ height: CHART_HEIGHT + 18, justifyContent: "flex-end" }}>
            {/* Guide lines, and the baseline */}
            {GUIDES.map((guide) => (
              <View
                key={guide}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 18 + CHART_HEIGHT * (1 - barShare(guide)),
                  borderTopWidth: 1,
                  borderStyle: "dashed",
                  borderColor: "rgba(255, 255, 255, 0.1)",
                }}
              />
            ))}
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, backgroundColor: "rgba(255, 255, 255, 0.16)" }} />

            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around" }}>
              {shown.map((season) => {
                const t = tier(season.topPercent);
                const height = Math.round(CHART_HEIGHT * barShare(season.topPercent ?? 100));
                return (
                  <View
                    key={season.name}
                    accessible
                    accessibilityLabel={`${season.name}${season.inPlay ? ", so far" : ""}: top ${season.topPercent}%`}
                    style={{ alignItems: "center", width: BAR_WIDTH + 18 }}
                  >
                    <Text numberOfLines={1} style={{ color: t.color, fontSize: 9.5, fontWeight: "800", marginBottom: 4 }}>
                      {`Top ${season.topPercent}%`}
                    </Text>
                    <View
                      style={{
                        width: BAR_WIDTH,
                        height,
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                        overflow: "hidden",
                        backgroundColor: season.inPlay ? `${t.color}33` : t.color,
                        borderWidth: season.inPlay ? 1.5 : 0,
                        borderBottomWidth: 0,
                        borderStyle: "dashed",
                        borderColor: t.color,
                      }}
                    >
                      {/* A soft sheen on the top of a finished bar */}
                      {!season.inPlay && (
                        <View style={{ height: Math.min(10, height / 2), backgroundColor: "rgba(255, 255, 255, 0.18)" }} />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 6 }}>
            {shown.map((season) => (
              <View key={season.name} style={{ width: BAR_WIDTH + 18, alignItems: "center" }}>
                <Text style={{ color: season.inPlay ? THEME.accent : SOFT, fontSize: 10.5, fontWeight: "700" }}>
                  {season.inPlay ? "Now" : shortSeason(season.name)}
                </Text>
                <Text style={{ color: MUTED, fontSize: 9, marginTop: 1 }}>{compactRank(season.rank)}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Key */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, marginLeft: 8 }}>
        {[
          { label: "Top 1%", color: tier(1).color },
          { label: "Top 10%", color: tier(10).color },
          { label: "Top 50%", color: tier(50).color },
          { label: "Lower", color: tier(90).color },
        ].map((item) => (
          <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: item.color }} />
            <Text style={{ color: MUTED, fontSize: 9.5 }}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SeasonHighlight({ title, season, tone }: { title: string; season: CareerSeason; tone: string }) {
  return (
    <View style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: THEME.surface, gap: 3 }}>
      <Text style={{ color: tone, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 }}>{title}</Text>
      <Text style={{ color: INK, fontSize: 16, fontWeight: "800" }}>{season.name}</Text>
      <Text style={{ color: SOFT, fontSize: 11.5 }}>{`${formatNumber(season.points)} pts · rank ${compactRank(season.rank)}`}</Text>
      <View style={{ flexDirection: "row", marginTop: 3 }}>
        <TierTag topPercent={season.topPercent} />
      </View>
    </View>
  );
}

function Body({ career }: { career: Career }) {
  const all = [...career.past, ...(career.current ? [career.current] : [])];
  const first = all[0];
  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
        <Tile label="Seasons played" value={String(all.length)} note={first ? `Since ${first.name}` : undefined} />
        <Tile label="Career points" value={formatNumber(career.totalPoints)} note="All seasons, this one included" />
        <Tile
          label="Average a season"
          value={career.averagePoints != null ? formatNumber(career.averagePoints) : "—"}
          note="Finished seasons"
        />
        <Tile
          label="Best finish"
          value={compactRank(career.best?.rank ?? null)}
          note={career.best ? career.best.name : "No finished season yet"}
        />
      </View>

      {career.facts.length > 0 && (
        <>
          <Heading>AT A GLANCE</Heading>
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: THEME.surface, gap: 8 }}>
            {career.facts.map((fact) => (
              <View key={fact.text} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    marginTop: 6,
                    backgroundColor: fact.tone === "good" ? THEME.good : fact.tone === "bad" ? THEME.bad : SOFT,
                  }}
                />
                <Text style={{ flex: 1, color: INK, fontSize: 13, lineHeight: 18 }}>{fact.text}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {all.length >= 2 && (
        <>
          <Heading>WHERE EACH SEASON FINISHED</Heading>
          <FinishChart seasons={all} />
        </>
      )}

      {career.best && career.worst && career.best !== career.worst && (
        <>
          <Heading>BEST AND WORST</Heading>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SeasonHighlight title="BEST" season={career.best} tone={THEME.good} />
            <SeasonHighlight title="TOUGHEST" season={career.worst} tone={THEME.bad} />
          </View>
        </>
      )}

      <Heading>EVERY SEASON</Heading>
      <View style={{ borderRadius: 12, backgroundColor: THEME.surface, overflow: "hidden" }}>
        {[...all].reverse().map((season, index) => (
          <View
            key={season.name}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: LINE,
              gap: 10,
            }}
          >
            <View style={{ width: 72 }}>
              <Text style={{ color: INK, fontSize: 13.5, fontWeight: "700" }}>{season.name}</Text>
              {season.inPlay && <Text style={{ color: THEME.accent, fontSize: 9.5, fontWeight: "700" }}>SO FAR</Text>}
            </View>
            <Text style={{ flex: 1, color: SOFT, fontSize: 12.5, fontVariant: ["tabular-nums"] }}>
              <Text style={{ color: "#ffd400", fontWeight: "800" }}>{formatNumber(season.points)}</Text>
              {" pts"}
            </Text>
            <Text style={{ width: 62, textAlign: "right", color: SOFT, fontSize: 12.5, fontVariant: ["tabular-nums"] }}>
              {compactRank(season.rank)}
            </Text>
            <View style={{ width: 70, alignItems: "flex-end" }}>
              <TierTag topPercent={season.topPercent} />
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

export function CareerPage({ entry, teamName, onBack }: { entry: number; teamName: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  // Read before the page opens (see openWhenReady), so it starts complete.
  const [career, setCareer] = useState<Career | null>(() => peekCareer(entry));
  const [failed, setFailed] = useState(false);
  const firstSeason = career ? (career.past[0] ?? career.current)?.name : undefined;
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadCareerShared(entry).then(
      (result) => {
        if (!active) return;
        setCareer(result);
        setFailed(false);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [entry, attempt]);

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
          My career
        </Text>
        <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{teamName}</Text>
        {/* The first season played, not FPL's "joined" date: FPL makes a new
            team each season, so that date is only this season's. */}
        {!!firstSeason && (
          <Text style={{ color: SOFT, fontSize: 12, marginTop: 2 }}>{`Playing FPL since ${firstSeason}`}</Text>
        )}
      </View>

      {career ? (
        career.past.length === 0 && !career.current ? (
          <Text style={{ color: MUTED, fontSize: 13, textAlign: "center", marginTop: 40, paddingHorizontal: 30 }}>
            Your career starts after your first gameweek.
          </Text>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 90 }}>
            <Body career={career} />
          </ScrollView>
        )
      ) : failed ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, gap: 14 }}>
          <Text style={{ color: SOFT, fontSize: 13.5, textAlign: "center", lineHeight: 19 }}>
            {"Couldn't load your FPL history. Check your connection and try again."}
          </Text>
          <Pressable
            onPress={() => setAttempt((n) => n + 1)}
            accessibilityRole="button"
            style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: LINE }}
          >
            <Text style={{ color: INK, fontWeight: "600" }}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={SOFT} />
        </View>
      )}
    </View>
  );
}
