// "My season": a manager's season so far with strengths and weak spots.
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSymbol } from "./AppSymbol";
import { analyseSeason, loadSeason } from "./insights";
import type { Finding, GameweekSummary, SeasonInsights as Insights } from "./insights";

const GREEN = "#00d982";
const MUTED = "#9db3a6";
const INK = "#ffffff";
const RED = "#ff5a72";
const CARD = "rgba(5, 20, 16, 0.85)";
const BORDER = "rgba(255, 255, 255, 0.08)";
const CHART_HEIGHT = 120;

const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const money = (tenths: number) => `£${(tenths / 10).toFixed(1)}m`;
const compactRank = (rank: number | null) => {
  if (!rank) return "—";
  if (rank >= 1_000_000) return `${(rank / 1_000_000).toFixed(2)}m`;
  if (rank >= 10_000) return `${Math.round(rank / 1000)}k`;
  return formatNumber(rank);
};

function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{ color: INK, fontSize: 13, fontWeight: "900", letterSpacing: 0.3, marginTop: 20, marginBottom: 8 }}
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
      style={{
        width: "48.5%",
        padding: 10,
        borderRadius: 14,
        backgroundColor: CARD,
        borderWidth: 1,
        borderColor: BORDER,
      }}
    >
      <Text style={{ color: MUTED, fontSize: 10, fontWeight: "800" }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: INK, fontSize: 20, fontWeight: "900", marginTop: 2 }}>
        {value}
      </Text>
      {!!note && <Text style={{ color: MUTED, fontSize: 10, fontWeight: "700", marginTop: 1 }}>{note}</Text>}
    </View>
  );
}

function FindingCard({ finding, good }: { finding: Finding; good: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${good ? "Strength" : "To improve"}: ${finding.title}. ${finding.detail}`}
      style={{
        flexDirection: "row",
        gap: 10,
        padding: 12,
        marginBottom: 6,
        borderRadius: 14,
        backgroundColor: CARD,
        borderWidth: 1,
        borderColor: good ? "rgba(0, 217, 130, 0.35)" : "rgba(255, 90, 114, 0.35)",
      }}
    >
      <View style={{ marginTop: 1 }}>
        <AppSymbol
          name={
            good
              ? { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" }
              : { ios: "exclamationmark.triangle.fill", android: "warning", web: "warning" }
          }
          color={good ? GREEN : RED}
          size={18}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: INK, fontSize: 13.5, fontWeight: "900" }}>{finding.title}</Text>
        <Text style={{ color: "#d7e6dd", fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{finding.detail}</Text>
      </View>
    </View>
  );
}

// Points per gameweek: your score as bars, the average manager as a white
// tick. Tap a bar to read that week.
function PointsChart({ gameweeks }: { gameweeks: GameweekSummary[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...gameweeks.map((gw) => Math.max(gw.points, gw.average ?? 0)));
  const shown = gameweeks.find((gw) => gw.event === selected) ?? gameweeks[gameweeks.length - 1];
  const scale = (value: number) => Math.max(2, Math.round((value / max) * CHART_HEIGHT));

  return (
    <View style={{ padding: 12, borderRadius: 14, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER }}>
      {shown && (
        <Text style={{ color: INK, fontSize: 12.5, fontWeight: "800", marginBottom: 10 }}>
          {`GW ${shown.event}: ${shown.points} pts`}
          <Text style={{ color: MUTED, fontWeight: "700" }}>
            {shown.average != null ? `  ·  average ${shown.average}` : ""}
            {shown.chip ? `  ·  ${chipName(shown.chip)}` : ""}
          </Text>
        </Text>
      )}
      <View style={{ height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
        {gameweeks.map((gw) => {
          const active = gw.event === shown?.event;
          return (
            <Pressable
              key={gw.event}
              onPress={() => setSelected(gw.event)}
              accessibilityRole="button"
              accessibilityLabel={`Gameweek ${gw.event}, ${gw.points} points${
                gw.average != null ? `, average ${gw.average}` : ""
              }`}
              style={{ flex: 1, height: CHART_HEIGHT, justifyContent: "flex-end", alignItems: "center" }}
            >
              <View
                style={{
                  width: "70%",
                  maxWidth: 18,
                  height: scale(gw.points),
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  backgroundColor: GREEN,
                  opacity: active ? 1 : 0.55,
                }}
              />
              {gw.average != null && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    bottom: scale(gw.average) - 1,
                    width: "90%",
                    maxWidth: 22,
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: INK,
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 2, marginTop: 4 }}>
        {gameweeks.map((gw) => (
          <Text key={gw.event} style={{ flex: 1, textAlign: "center", color: MUTED, fontSize: 8.5, fontWeight: "700" }}>
            {gw.event}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: GREEN }} />
          <Text style={{ color: MUTED, fontSize: 10.5, fontWeight: "700" }}>Your points</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 12, height: 2, borderRadius: 1, backgroundColor: INK }} />
          <Text style={{ color: MUTED, fontSize: 10.5, fontWeight: "700" }}>Average manager</Text>
        </View>
      </View>
    </View>
  );
}

const CHIP_LABELS: Record<string, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};
const chipName = (chip: string) => CHIP_LABELS[chip] ?? chip;

// Share of points by position, as labelled bars.
function PositionBars({ points }: { points: Record<number, number> }) {
  const total = Math.max(1, points[1] + points[2] + points[3] + points[4]);
  const rows = [
    { type: 1, label: "Goalkeepers" },
    { type: 2, label: "Defenders" },
    { type: 3, label: "Midfielders" },
    { type: 4, label: "Forwards" },
  ];
  return (
    <View style={{ padding: 12, borderRadius: 14, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, gap: 10 }}>
      {rows.map((row) => {
        const share = (points[row.type] ?? 0) / total;
        return (
          <View
            key={row.type}
            accessible
            accessibilityLabel={`${row.label}: ${points[row.type]} points, ${Math.round(share * 100)} percent`}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ color: INK, fontSize: 12, fontWeight: "800" }}>{row.label}</Text>
              <Text style={{ color: MUTED, fontSize: 12, fontWeight: "800" }}>
                {`${points[row.type]} pts · ${Math.round(share * 100)}%`}
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255, 255, 255, 0.08)" }}>
              <View style={{ width: `${share * 100}%`, height: 8, borderRadius: 4, backgroundColor: GREEN }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const TABLE_WIDTHS = [0.1, 0.13, 0.13, 0.2, 0.12, 0.32];

function TableRow({ cells, header = false }: { cells: string[]; header?: boolean }) {
  return (
    <View
      accessible={!header}
      accessibilityLabel={header ? undefined : cells.join(", ")}
      style={{
        flexDirection: "row",
        paddingHorizontal: 10,
        paddingVertical: header ? 6 : 7,
        backgroundColor: header ? "rgba(0, 217, 130, 0.12)" : "transparent",
        borderTopWidth: header ? 0 : 1,
        borderTopColor: "rgba(255, 255, 255, 0.06)",
      }}
    >
      {cells.map((cell, index) => (
        <Text
          key={index}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{
            width: `${TABLE_WIDTHS[index] * 100}%`,
            textAlign: index === cells.length - 1 ? "left" : "center",
            color: header ? MUTED : INK,
            fontSize: header ? 9.5 : 11.5,
            fontWeight: header ? "900" : "700",
          }}
        >
          {cell}
        </Text>
      ))}
    </View>
  );
}

export function SeasonInsights({
  entry,
  teamName,
  onBack,
}: {
  entry: number;
  teamName: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadSeason(entry)
      .then((raw) => {
        if (active) setData(analyseSeason(raw));
      })
      .catch(() => {
        if (active) setError("Couldn't load your season from FPL. Check your connection and try again.");
      });
    return () => {
      active = false;
    };
  }, [entry, attempt]);

  const captainShare =
    data && data.bestCaptainTotal > 0 ? Math.round((data.captainTotal / data.bestCaptainTotal) * 100) : null;
  const valueChange = data && data.valueStart != null && data.valueNow != null ? data.valueNow - data.valueStart : null;
  const last = data?.gameweeks[data.gameweeks.length - 1];

  return (
    <View style={{ flex: 1, backgroundColor: "#071b12" }}>
      <Image
        source={require("../assets/images/background-texture.png")}
        contentFit="cover"
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 14, paddingBottom: 8 }}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            height: 34,
            paddingHorizontal: 14,
            borderRadius: 16,
            backgroundColor: "rgba(0, 217, 130, 0.15)",
            borderWidth: 1,
            borderColor: "rgba(0, 217, 130, 0.4)",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <AppSymbol name={{ ios: "chevron.left", android: "chevron_left", web: "chevron_left" }} color={GREEN} size={16} />
          <Text style={{ color: INK, fontSize: 13, fontWeight: "800" }}>Back</Text>
        </Pressable>
        <Text accessibilityRole="header" style={{ color: INK, fontSize: 22, fontWeight: "900", marginTop: 12 }}>
          My season
        </Text>
        <Text style={{ color: MUTED, fontSize: 12.5, marginTop: 2 }}>{teamName}</Text>
      </View>

      {!data && !error && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
          <ActivityIndicator color={GREEN} />
          <Text style={{ color: MUTED, fontSize: 12 }}>Analysing your season…</Text>
        </View>
      )}

      {!data && !!error && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, gap: 12 }}>
          <Text style={{ color: INK, fontSize: 13, textAlign: "center" }}>{error}</Text>
          <Pressable
            onPress={() => {
              setError("");
              setAttempt((n) => n + 1);
            }}
            style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: GREEN }}
          >
            <Text style={{ color: "#04210f", fontWeight: "900" }}>Try again</Text>
          </Pressable>
        </View>
      )}

      {data && data.gameweeks.length === 0 && (
        <Text style={{ color: MUTED, fontSize: 13, textAlign: "center", marginTop: 40 }}>
          Your season starts after your first gameweek.
        </Text>
      )}

      {data && data.gameweeks.length > 0 && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 90 }}>
          {/* Headline numbers */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            <Tile label="Total points" value={formatNumber(data.totalPoints)} note={`after ${data.gameweeks.length} gameweeks`} />
            <Tile label="Overall rank" value={compactRank(data.overallRank)} note={last?.rank ? `GW ${last.event} rank ${compactRank(last.rank)}` : undefined} />
            <Tile
              label="Points a week"
              value={data.averagePoints.toFixed(1)}
              note={data.averageOfAll != null ? `average manager ${data.averageOfAll.toFixed(1)}` : undefined}
            />
            <Tile
              label="Best week"
              value={data.bestGw ? `${data.bestGw.points} pts` : "—"}
              note={data.bestGw ? `GW ${data.bestGw.event}${data.worstGw ? ` · worst ${data.worstGw.points} (GW ${data.worstGw.event})` : ""}` : undefined}
            />
          </View>

          {data.strengths.length > 0 && (
            <>
              <SectionTitle>STRENGTHS</SectionTitle>
              {data.strengths.map((finding) => (
                <FindingCard key={finding.title} finding={finding} good />
              ))}
            </>
          )}
          {data.weaknesses.length > 0 && (
            <>
              <SectionTitle>TO IMPROVE</SectionTitle>
              {data.weaknesses.map((finding) => (
                <FindingCard key={finding.title} finding={finding} good={false} />
              ))}
            </>
          )}

          <SectionTitle>POINTS BY GAMEWEEK</SectionTitle>
          <PointsChart gameweeks={data.gameweeks} />

          <SectionTitle>CAPTAINCY</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Tile label="Armband points" value={String(data.captainTotal)} note={`best possible ${data.bestCaptainTotal}`} />
            <Tile label="Captain accuracy" value={captainShare != null ? `${captainShare}%` : "—"} note="of the best choice each week" />
          </View>

          <SectionTitle>TRANSFERS</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Tile label="Transfers made" value={String(data.transfersTotal)} note={`${data.hitsTotal} pts spent on hits`} />
            <Tile
              label="Transfer gain"
              value={`${data.transferGain > 0 ? "+" : ""}${data.transferGain}`}
              note="in vs out, week of the move"
            />
          </View>
          {data.transfers.length > 0 && (
            <View style={{ marginTop: 8, borderRadius: 14, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, overflow: "hidden" }}>
              {data.transfers.slice(0, 6).map((transfer, index) => (
                <View
                  key={`${transfer.event}-${transfer.inName}-${index}`}
                  accessible
                  accessibilityLabel={`Gameweek ${transfer.event}: ${transfer.inName} in for ${transfer.outName}, ${transfer.gain} points`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: "rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <Text style={{ color: MUTED, fontSize: 11, fontWeight: "800", width: 42 }}>{`GW ${transfer.event}`}</Text>
                  <Text numberOfLines={1} style={{ flex: 1, color: INK, fontSize: 12.5, fontWeight: "700" }}>
                    {`${transfer.inName}  ←  ${transfer.outName}`}
                  </Text>
                  <Text
                    style={{
                      color: transfer.gain > 0 ? GREEN : transfer.gain < 0 ? RED : MUTED,
                      fontSize: 12.5,
                      fontWeight: "900",
                    }}
                  >
                    {`${transfer.gain > 0 ? "+" : ""}${transfer.gain}`}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <SectionTitle>POINTS BY POSITION</SectionTitle>
          <PositionBars points={data.positionPoints} />

          <SectionTitle>BENCH, VALUE & CHIPS</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Tile
              label="Bench points"
              value={String(data.benchTotal)}
              note={`${(data.benchTotal / data.gameweeks.length).toFixed(1)} a week left unused`}
            />
            <Tile
              label="Team value"
              value={data.valueNow != null ? money(data.valueNow) : "—"}
              note={
                valueChange != null
                  ? `${valueChange >= 0 ? "+" : "−"}${money(Math.abs(valueChange))} this season${last ? ` · bank ${money(last.bank)}` : ""}`
                  : undefined
              }
            />
          </View>
          <View style={{ marginTop: 8, padding: 12, borderRadius: 14, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, gap: 4 }}>
            {data.chips.length === 0 ? (
              <Text style={{ color: MUTED, fontSize: 12.5 }}>No chips played yet.</Text>
            ) : (
              data.chips.map((chip) => (
                <Text key={`${chip.name}-${chip.event}`} style={{ color: INK, fontSize: 12.5, fontWeight: "700" }}>
                  {`${chip.name}  ·  GW ${chip.event}${chip.points != null ? `  ·  ${chip.points} pts` : ""}`}
                </Text>
              ))
            )}
          </View>

          <SectionTitle>GAMEWEEK BY GAMEWEEK</SectionTitle>
          <View style={{ borderRadius: 14, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, overflow: "hidden" }}>
            <TableRow header cells={["GW", "Pts", "Avg", "Rank", "Bench", "Captain"]} />
            {[...data.gameweeks].reverse().map((gw) => (
              <TableRow
                key={gw.event}
                cells={[
                  String(gw.event),
                  `${gw.points}${gw.hitCost ? ` (−${gw.hitCost})` : ""}`,
                  gw.average != null ? String(gw.average) : "—",
                  compactRank(gw.overallRank),
                  String(gw.benchPoints),
                  gw.captainName ? `${gw.captainName} ${gw.captainBonus}` : "—",
                ]}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
