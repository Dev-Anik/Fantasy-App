// "My season": how the season has gone and what the data shows about the
// squad. Four tabs, each answering one question: Overview (how am I doing),
// Squad (how each player stands), Decisions (how my calls worked out) and
// History (week by week).
//
// Style: quiet and typographic. Plain sections with small headings and thin
// dividers; colour only where a number is good or bad.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSymbol } from "./AppSymbol";
import { PlayerArt } from "./Pitch";
import { ScreenBackground, THEME } from "./theme";
import { analyseSeason, loadSeason } from "./insights";
import type {
  Action,
  Finding,
  GameweekSummary,
  SeasonInsights as Insights,
  SquadPlayer,
  UpcomingFixture,
} from "./insights";

const BG = THEME.bg;
const SURFACE = THEME.surface;
const LINE = THEME.line;
const INK = THEME.ink;
const SOFT = THEME.soft;
const MUTED = THEME.muted;
const GOOD = THEME.good;
const BAD = THEME.bad;
const WARN = "#f2c14e";
const CHART_HEIGHT = 110;
const POSITIONS = ["", "GKP", "DEF", "MID", "FWD"];

type Tab = "overview" | "squad" | "decisions" | "history";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "squad", label: "Squad" },
  { id: "decisions", label: "Decisions" },
  { id: "history", label: "History" },
];

const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const money = (tenths: number) => `£${(tenths / 10).toFixed(1)}m`;
const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}`;
const compactRank = (rank: number | null) => {
  if (!rank) return "—";
  if (rank >= 1_000_000) return `${(rank / 1_000_000).toFixed(2)}m`;
  if (rank >= 10_000) return `${Math.round(rank / 1000)}k`;
  return formatNumber(rank);
};

const DIFFICULTY = {
  easy: { fill: "#00e676", ink: "#04210f" },
  average: { fill: "#e9efe9", ink: "#12241a" },
  hard: { fill: "#f02d55", ink: "#ffffff" },
};

// Squad status labels: descriptive, not instructions.
const STATUS = {
  sell: { color: BAD, label: "Flagged", hint: "Injured, suspended, unlikely to play or badly out of form." },
  watch: { color: WARN, label: "Watch", hint: "A fitness doubt, low form, tough fixtures or a falling price." },
  keep: { color: GOOD, label: "Good", hint: "Available, with steady or strong form or good fixtures." },
};

const KIND_LABEL: Record<Action["kind"], string> = {
  transfer: "Squad",
  captain: "Captaincy",
  chip: "Chips",
  lineup: "Lineup",
  money: "Budget",
  habit: "Pattern",
};

const DISCLAIMER =
  "These are observations from FPL data, not recommendations. Every decision about your team is yours.";

// Where the rank puts the manager, in words.
function standing(rank: number | null, total: number | null) {
  if (!rank || !total) return null;
  const pct = (rank / total) * 100;
  const top = pct < 1 ? pct.toFixed(1) : String(Math.max(1, Math.ceil(pct)));
  return { top, color: pct <= 25 ? GOOD : pct <= 50 ? INK : BAD };
}

// --- Building blocks -----------------------------------------------------------

function Heading({ children, first = false }: { children: string; first?: boolean }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: THEME.accent,
        fontSize: 11.5,
        fontWeight: "500",
        letterSpacing: 2,
        textTransform: "uppercase",
        marginTop: first ? 4 : 28,
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  );
}

function Note({ children }: { children: string }) {
  return <Text style={{ color: MUTED, fontSize: 12, lineHeight: 17, marginTop: -4, marginBottom: 10 }}>{children}</Text>;
}

// A plain surface; rows inside are separated by thin lines.
function Panel({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: SURFACE, borderRadius: 12, paddingHorizontal: 14 }}>{children}</View>;
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: LINE }} />;
}

// Figures side by side: a label above a number.
function Stats({ items }: { items: { label: string; value: string; note?: string; color?: string }[] }) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: SURFACE, borderRadius: 12, paddingVertical: 12 }}>
      {items.map((item, index) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}${item.note ? `, ${item.note}` : ""}`}
          style={{
            flex: 1,
            paddingHorizontal: 14,
            borderLeftWidth: index === 0 ? 0 : 1,
            borderLeftColor: LINE,
          }}
        >
          <Text style={{ color: MUTED, fontSize: 11, fontWeight: "600" }}>{item.label}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: item.color ?? INK, fontSize: 19, fontWeight: "700", marginTop: 3, fontVariant: ["tabular-nums"] }}
          >
            {item.value}
          </Text>
          {!!item.note && <Text style={{ color: MUTED, fontSize: 11, marginTop: 1 }}>{item.note}</Text>}
        </View>
      ))}
    </View>
  );
}

// A row of a list: text on the left, a figure on the right, a line under.
function Row({
  title,
  value,
  sub,
  valueColor = INK,
  first,
}: {
  title: string;
  value?: string;
  sub?: string;
  valueColor?: string;
  first?: boolean;
}) {
  return (
    <>
      {!first && <Divider />}
      <View
        accessible
        accessibilityLabel={`${title}${value ? `, ${value}` : ""}${sub ? `. ${sub}` : ""}`}
        style={{ paddingVertical: 11 }}
      >
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
          <Text style={{ flex: 1, color: INK, fontSize: 14, fontWeight: "600", lineHeight: 19 }}>{title}</Text>
          {!!value && (
            <Text style={{ color: valueColor, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
              {value}
            </Text>
          )}
        </View>
        {!!sub && <Text style={{ color: MUTED, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{sub}</Text>}
      </View>
    </>
  );
}

function SmallLabel({ children, color = MUTED }: { children: string; color?: string }) {
  return (
    <Text style={{ color, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, marginTop: 12, marginBottom: 2 }}>
      {children.toUpperCase()}
    </Text>
  );
}

function FixtureChips({ fixtures }: { fixtures: UpcomingFixture[] }) {
  if (fixtures.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", gap: 3, marginTop: 5 }}>
      {fixtures.map((fixture) => (
        <View
          key={`${fixture.event}-${fixture.opponent}`}
          style={{
            minWidth: 34,
            paddingHorizontal: 3,
            paddingVertical: 1,
            borderRadius: 3,
            alignItems: "center",
            backgroundColor: DIFFICULTY[fixture.difficulty].fill,
          }}
        >
          <Text style={{ color: DIFFICULTY[fixture.difficulty].ink, fontSize: 9, fontWeight: "700" }}>
            {`${fixture.opponent}${fixture.home ? "" : " (A)"}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Disclaimer() {
  return (
    <View
      accessible
      accessibilityLabel={DISCLAIMER}
      style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 10 }}
    >
      <AppSymbol name={{ ios: "info.circle", android: "info", web: "info" }} color={MUTED} size={14} />
      <Text style={{ flex: 1, color: MUTED, fontSize: 11.5, lineHeight: 16 }}>{DISCLAIMER}</Text>
    </View>
  );
}

// --- Overview ------------------------------------------------------------------

function Overview({ data }: { data: Insights }) {
  const where = standing(data.overallRank, data.totalPlayers);
  const move = data.rankMove;
  const counted = data.gameweeks.filter((gw) => gw.average != null).length;
  return (
    <>
      {/* Rank, plainly */}
      <View style={{ marginTop: 6 }}>
        <Text style={{ color: MUTED, fontSize: 12, fontWeight: "600" }}>Overall rank</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 2 }}>
          <Text style={{ color: INK, fontSize: 34, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
            {data.overallRank ? formatNumber(data.overallRank) : "—"}
          </Text>
          {where && (
            <Text style={{ color: where.color, fontSize: 14, fontWeight: "700" }}>{`Top ${where.top}%`}</Text>
          )}
        </View>
        {move != null && move !== 0 && (
          <Text style={{ color: move > 0 ? GOOD : BAD, fontSize: 12.5, fontWeight: "600", marginTop: 2 }}>
            {`${move > 0 ? "▲" : "▼"} ${compactRank(Math.abs(move))} in GW ${data.gameweeks[data.gameweeks.length - 1]?.event ?? ""}`}
          </Text>
        )}
      </View>

      <View style={{ marginTop: 16 }}>
        <Stats
          items={[
            { label: "Points", value: formatNumber(data.totalPoints) },
            {
              label: "Per week",
              value: data.averagePoints.toFixed(1),
              note: data.averageOfAll != null ? `average ${data.averageOfAll.toFixed(1)}` : undefined,
            },
            { label: "Beat average", value: `${data.aboveAverage} of ${counted}`, note: "gameweeks" },
          ]}
        />
      </View>

      <Heading>Worth knowing</Heading>
      {data.actions.length === 0 ? (
        <Panel>
          <Row first title="Nothing stands out in the data this week." />
        </Panel>
      ) : (
        <Panel>
          {data.actions.map((action, index) => (
            <View key={action.title}>
              {index > 0 && <Divider />}
              <View
                accessible
                accessibilityLabel={`${KIND_LABEL[action.kind]}: ${action.title}. ${action.detail}`}
                style={{ paddingVertical: 12 }}
              >
                <Text style={{ color: MUTED, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6 }}>
                  {KIND_LABEL[action.kind].toUpperCase()}
                </Text>
                <Text style={{ color: INK, fontSize: 14, fontWeight: "600", marginTop: 3, lineHeight: 19 }}>
                  {action.title}
                </Text>
                <Text style={{ color: SOFT, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{action.detail}</Text>
              </View>
            </View>
          ))}
        </Panel>
      )}
      <Disclaimer />

      <Heading>Last 5 gameweeks</Heading>
      <View style={{ flexDirection: "row", backgroundColor: SURFACE, borderRadius: 12, paddingVertical: 12 }}>
        {data.gameweeks.slice(-5).map((gw, index) => {
          const diff = gw.average != null ? gw.points - gw.average : null;
          return (
            <View
              key={gw.event}
              accessible
              accessibilityLabel={`Gameweek ${gw.event}: ${gw.points} points${diff != null ? `, ${signed(diff)} against the average` : ""}`}
              style={{ flex: 1, alignItems: "center", borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: LINE }}
            >
              <Text style={{ color: MUTED, fontSize: 11 }}>{`GW ${gw.event}`}</Text>
              <Text style={{ color: INK, fontSize: 17, fontWeight: "700", marginTop: 2, fontVariant: ["tabular-nums"] }}>
                {gw.points}
              </Text>
              {diff != null && (
                <Text style={{ color: diff >= 0 ? GOOD : BAD, fontSize: 11, fontWeight: "600" }}>{signed(diff)}</Text>
              )}
            </View>
          );
        })}
      </View>
      <Text style={{ color: MUTED, fontSize: 11.5, marginTop: 6 }}>Under each score: points above or below the average manager.</Text>

      {data.strengths.length > 0 && (
        <>
          <Heading>Going well</Heading>
          <FindingList findings={data.strengths} />
        </>
      )}
      {data.weaknesses.length > 0 && (
        <>
          <Heading>Costing points</Heading>
          <FindingList findings={data.weaknesses} />
        </>
      )}
    </>
  );
}

function FindingList({ findings }: { findings: Finding[] }) {
  return (
    <Panel>
      {findings.map((finding, index) => (
        <Row key={finding.title} first={index === 0} title={finding.title} sub={finding.detail} />
      ))}
    </Panel>
  );
}

// --- Squad ---------------------------------------------------------------------

function PlayerRow({ player, first }: { player: SquadPlayer; first: boolean }) {
  const status = STATUS[player.verdict];
  return (
    <>
      {!first && <Divider />}
      <View
        accessible
        accessibilityLabel={`${player.name}, ${POSITIONS[player.position]}, ${player.team}, ${money(player.price)}. ${status.label}: ${player.reason}. Form ${player.form.toFixed(1)}. ${player.pointsForYou} points for you.`}
        style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 }}
      >
        <PlayerArt team={player.team} size={36} goalkeeper={player.position === 1} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: INK, fontSize: 14, fontWeight: "600" }}>
            {player.name}
            {!player.starter && <Text style={{ color: MUTED, fontSize: 11, fontWeight: "500" }}>{"  bench"}</Text>}
          </Text>
          <Text style={{ color: MUTED, fontSize: 12, marginTop: 1 }}>
            {`${POSITIONS[player.position]} · ${player.team} · ${money(player.price)}`}
          </Text>
          <Text numberOfLines={2} style={{ color: SOFT, fontSize: 12, marginTop: 4, lineHeight: 16 }}>
            <Text style={{ color: status.color, fontWeight: "700" }}>{"● "}</Text>
            {player.reason}
          </Text>
          <FixtureChips fixtures={player.fixtures} />
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: INK, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
            {player.form.toFixed(1)}
          </Text>
          <Text style={{ color: MUTED, fontSize: 10.5 }}>form</Text>
          <Text style={{ color: SOFT, fontSize: 12, fontWeight: "600", marginTop: 6, fontVariant: ["tabular-nums"] }}>
            {player.pointsForYou}
          </Text>
          <Text style={{ color: MUTED, fontSize: 10.5 }}>pts for you</Text>
        </View>
      </View>
    </>
  );
}

function PositionBars({ points }: { points: Record<number, number> }) {
  const total = Math.max(1, points[1] + points[2] + points[3] + points[4]);
  const rows = [
    { type: 1, label: "Goalkeepers" },
    { type: 2, label: "Defenders" },
    { type: 3, label: "Midfielders" },
    { type: 4, label: "Forwards" },
  ];
  return (
    <Panel>
      {rows.map((row, index) => {
        const share = (points[row.type] ?? 0) / total;
        return (
          <View key={row.type}>
            {index > 0 && <Divider />}
            <View
              accessible
              accessibilityLabel={`${row.label}: ${points[row.type]} points, ${Math.round(share * 100)} percent`}
              style={{ paddingVertical: 10 }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ color: INK, fontSize: 13, fontWeight: "600" }}>{row.label}</Text>
                <Text style={{ color: MUTED, fontSize: 12.5, fontVariant: ["tabular-nums"] }}>
                  {`${points[row.type]} pts · ${Math.round(share * 100)}%`}
                </Text>
              </View>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: LINE }}>
                <View style={{ width: `${share * 100}%`, height: 4, borderRadius: 2, backgroundColor: SOFT }} />
              </View>
            </View>
          </View>
        );
      })}
    </Panel>
  );
}

function Squad({ data }: { data: Insights }) {
  if (data.squad.length === 0) {
    return (
      <Panel>
        <Row first title="Your squad appears here after your first gameweek." />
      </Panel>
    );
  }
  const groups = (["sell", "watch", "keep"] as const)
    .map((verdict) => ({
      verdict,
      players: data.squad
        .filter((player) => player.verdict === verdict)
        .sort((a, b) => Number(b.starter) - Number(a.starter) || b.form - a.form),
    }))
    .filter((group) => group.players.length > 0);
  const top = [...data.squad].sort((a, b) => b.pointsForYou - a.pointsForYou).slice(0, 5);

  return (
    <>
      <View style={{ marginTop: 6 }}>
        <Stats
          items={(["sell", "watch", "keep"] as const).map((verdict) => ({
            label: STATUS[verdict].label,
            value: String(data.squad.filter((player) => player.verdict === verdict).length),
            color: STATUS[verdict].color,
          }))}
        />
      </View>
      <Text style={{ color: MUTED, fontSize: 11.5, lineHeight: 16, marginTop: 8 }}>
        Grouped by fitness, form (points a game over the last month), price movement and the next
        three fixtures (green easy, grey average, red hard).
      </Text>
      <Disclaimer />

      {groups.map((group) => (
        <View key={group.verdict}>
          <Heading>{`${STATUS[group.verdict].label} · ${group.players.length}`}</Heading>
          <Note>{STATUS[group.verdict].hint}</Note>
          <Panel>
            {group.players.map((player, index) => (
              <PlayerRow key={player.id} player={player} first={index === 0} />
            ))}
          </Panel>
        </View>
      ))}

      <Heading>Top scorers for you</Heading>
      <Note>Points earned while in your team, armband included.</Note>
      <Panel>
        {top.map((player, index) => (
          <Row key={player.id} first={index === 0} title={player.name} value={`${player.pointsForYou}`} />
        ))}
      </Panel>

      <Heading>Points by position</Heading>
      <Note>A typical team gets around 40% of its points from midfield.</Note>
      <PositionBars points={data.positionPoints} />
    </>
  );
}

// --- Decisions -------------------------------------------------------------------

function Decisions({ data }: { data: Insights }) {
  const captainShare =
    data.bestCaptainTotal > 0 ? Math.round((data.captainTotal / data.bestCaptainTotal) * 100) : null;
  const benchPerWeek = data.gameweeks.length ? data.benchTotal / data.gameweeks.length : 0;
  const valueChange = data.valueStart != null && data.valueNow != null ? data.valueNow - data.valueStart : null;
  const last = data.gameweeks[data.gameweeks.length - 1];
  const net = data.transferGain3 - data.hitsTotal;

  return (
    <>
      <Heading first>Captaincy</Heading>
      <Note>Armband points compared with captaining your top scorer each week.</Note>
      <Stats
        items={[
          { label: "Armband points", value: String(data.captainTotal), note: `best possible ${data.bestCaptainTotal}` },
          {
            label: "Accuracy",
            value: captainShare != null ? `${captainShare}%` : "—",
            color: captainShare == null ? INK : captainShare >= 75 ? GOOD : captainShare < 55 ? BAD : INK,
          },
        ]}
      />
      {data.captainMisses.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Panel>
            <SmallLabel>Biggest differences</SmallLabel>
            {data.captainMisses.map((miss, index) => (
              <Row
                key={miss.event}
                first={index === 0}
                title={`GW ${miss.event} · ${miss.captain} ${miss.captainPoints}`}
                value={`−${miss.bestPoints - miss.captainPoints}`}
                valueColor={BAD}
                sub={`${miss.best} scored ${miss.bestPoints} as captain`}
              />
            ))}
          </Panel>
        </View>
      )}

      <Heading>Transfers</Heading>
      <Note>Each transfer compares the player in with the player out over three gameweeks.</Note>
      <Stats
        items={[
          { label: "Transfers", value: String(data.transfersTotal), note: `${data.hitsTotal} pts in hits` },
          { label: "Net gain", value: signed(net), color: net > 0 ? GOOD : net < 0 ? BAD : INK, note: "after hits" },
        ]}
      />
      {(data.bestTransfers.length > 0 || data.worstTransfers.length > 0) && (
        <View style={{ marginTop: 8 }}>
          <Panel>
            {data.bestTransfers.length > 0 && <SmallLabel>Best</SmallLabel>}
            {data.bestTransfers.map((move, index) => (
              <Row
                key={`best-${move.event}-${move.inName}`}
                first={index === 0}
                title={`${move.inName} for ${move.outName}`}
                value={signed(move.gain3)}
                valueColor={GOOD}
                sub={`GW ${move.event} · ${move.weeks} week${move.weeks === 1 ? "" : "s"}`}
              />
            ))}
            {data.worstTransfers.length > 0 && <SmallLabel>Worst</SmallLabel>}
            {data.worstTransfers.map((move, index) => (
              <Row
                key={`worst-${move.event}-${move.inName}`}
                first={index === 0}
                title={`${move.inName} for ${move.outName}`}
                value={signed(move.gain3)}
                valueColor={BAD}
                sub={`GW ${move.event} · ${move.weeks} week${move.weeks === 1 ? "" : "s"}`}
              />
            ))}
          </Panel>
        </View>
      )}

      <Heading>Bench</Heading>
      <Stats
        items={[
          { label: "Bench points", value: String(data.benchTotal), note: `${benchPerWeek.toFixed(1)} a week` },
          {
            label: "Highest week",
            value: data.benchWeeks[0] ? String(data.benchWeeks[0].benchPoints) : "—",
            note: data.benchWeeks[0] ? `GW ${data.benchWeeks[0].event}` : "none above 6",
          },
        ]}
      />

      <Heading>Chips</Heading>
      <Panel>
        {data.chipsLeft.length > 0 && (
          <Row
            first
            title={data.chipsLeft.join(", ")}
            value="Available"
            valueColor={GOOD}
            sub={data.chipDeadline != null ? `Expires after GW ${data.chipDeadline}` : undefined}
          />
        )}
        {data.chips.map((chip, index) => (
          <Row
            key={`${chip.name}-${chip.event}`}
            first={index === 0 && data.chipsLeft.length === 0}
            title={chip.name}
            value={chip.points != null ? `${chip.points} pts` : undefined}
            sub={`Played in GW ${chip.event}`}
          />
        ))}
        {data.chipsLeft.length === 0 && data.chips.length === 0 && <Row first title="No chips played yet." />}
      </Panel>

      <Heading>Budget</Heading>
      <Stats
        items={[
          {
            label: "Team value",
            value: data.valueNow != null ? money(data.valueNow) : "—",
            note: valueChange != null ? `${valueChange >= 0 ? "+" : "−"}${money(Math.abs(valueChange))} this season` : undefined,
          },
          { label: "In the bank", value: last ? money(last.bank) : "—" },
        ]}
      />
    </>
  );
}

// --- History -------------------------------------------------------------------

const CHIP_LABELS: Record<string, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};
const chipName = (chip: string) => CHIP_LABELS[chip] ?? chip;

// Points per gameweek as bars, the average manager as a tick. Tap a bar to
// read that week.
function PointsChart({ gameweeks }: { gameweeks: GameweekSummary[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...gameweeks.map((gw) => Math.max(gw.points, gw.average ?? 0)));
  const shown = gameweeks.find((gw) => gw.event === selected) ?? gameweeks[gameweeks.length - 1];
  const scale = (value: number) => Math.max(2, Math.round((value / max) * CHART_HEIGHT));

  return (
    <View style={{ backgroundColor: SURFACE, borderRadius: 12, padding: 14 }}>
      {shown && (
        <Text style={{ color: INK, fontSize: 13, fontWeight: "600", marginBottom: 12 }}>
          {`GW ${shown.event} · ${shown.points} pts`}
          <Text style={{ color: MUTED, fontWeight: "400" }}>
            {shown.average != null ? `   average ${shown.average}` : ""}
            {shown.chip ? `   ${chipName(shown.chip)}` : ""}
          </Text>
        </Text>
      )}
      <View style={{ height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
        {gameweeks.map((gw) => {
          const active = gw.event === shown?.event;
          return (
            <Pressable
              key={gw.event}
              onPress={() => setSelected(gw.event)}
              accessibilityRole="button"
              accessibilityLabel={`Gameweek ${gw.event}, ${gw.points} points${gw.average != null ? `, average ${gw.average}` : ""}`}
              style={{ flex: 1, height: CHART_HEIGHT, justifyContent: "flex-end", alignItems: "center" }}
            >
              <View
                style={{
                  width: "64%",
                  maxWidth: 16,
                  height: scale(gw.points),
                  borderTopLeftRadius: 2,
                  borderTopRightRadius: 2,
                  backgroundColor: active ? INK : "rgba(242, 245, 243, 0.32)",
                }}
              />
              {gw.average != null && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    bottom: scale(gw.average) - 1,
                    width: "86%",
                    maxWidth: 20,
                    height: 2,
                    backgroundColor: GOOD,
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 3, marginTop: 5 }}>
        {gameweeks.map((gw) => (
          <Text key={gw.event} style={{ flex: 1, textAlign: "center", color: MUTED, fontSize: 8.5 }}>
            {gw.event}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 1, backgroundColor: "rgba(242, 245, 243, 0.5)" }} />
          <Text style={{ color: MUTED, fontSize: 11 }}>Your points</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 12, height: 2, backgroundColor: GOOD }} />
          <Text style={{ color: MUTED, fontSize: 11 }}>Average manager</Text>
        </View>
      </View>
    </View>
  );
}

const TABLE_WIDTHS = [0.1, 0.15, 0.12, 0.19, 0.12, 0.32];

function TableRow({ cells, header = false }: { cells: string[]; header?: boolean }) {
  return (
    <View
      accessible={!header}
      accessibilityLabel={header ? undefined : cells.join(", ")}
      style={{
        flexDirection: "row",
        paddingHorizontal: 12,
        paddingVertical: header ? 8 : 9,
        borderTopWidth: header ? 0 : 1,
        borderTopColor: LINE,
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
            fontSize: header ? 10.5 : 12,
            fontWeight: header ? "700" : "500",
            fontVariant: ["tabular-nums"],
          }}
        >
          {cell}
        </Text>
      ))}
    </View>
  );
}

function History({ data }: { data: Insights }) {
  return (
    <>
      <Heading first>Points by gameweek</Heading>
      <PointsChart gameweeks={data.gameweeks} />
      <View style={{ marginTop: 8 }}>
        <Stats
          items={[
            { label: "Best week", value: data.bestGw ? `${data.bestGw.points}` : "—", note: data.bestGw ? `GW ${data.bestGw.event}` : undefined },
            { label: "Lowest week", value: data.worstGw ? `${data.worstGw.points}` : "—", note: data.worstGw ? `GW ${data.worstGw.event}` : undefined },
          ]}
        />
      </View>

      <Heading>Gameweek by gameweek</Heading>
      <View style={{ backgroundColor: SURFACE, borderRadius: 12, overflow: "hidden" }}>
        <TableRow header cells={["GW", "PTS", "AVG", "RANK", "BENCH", "CAPTAIN"]} />
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
    </>
  );
}

// --- Page ----------------------------------------------------------------------

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
  const [tab, setTab] = useState<Tab>("overview");

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

  const ready = !!data && data.gameweeks.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
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
          My season
        </Text>
        <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{teamName}</Text>

        {ready && (
          <View
            accessibilityRole="tablist"
            style={{ flexDirection: "row", marginTop: 16, borderBottomWidth: 1, borderBottomColor: LINE }}
          >
            {TABS.map((item) => {
              const active = item.id === tab;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setTab(item.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={{ marginRight: 22, paddingBottom: 10 }}
                >
                  <Text style={{ color: active ? INK : MUTED, fontSize: 14, fontWeight: active ? "700" : "500" }}>
                    {item.label}
                  </Text>
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: -1,
                      height: 2,
                      backgroundColor: active ? THEME.accent : "transparent",
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {!data && !error && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
          <ActivityIndicator color={SOFT} />
          <Text style={{ color: MUTED, fontSize: 12.5 }}>Reading your season…</Text>
        </View>
      )}

      {!data && !!error && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, gap: 14 }}>
          <Text style={{ color: SOFT, fontSize: 13.5, textAlign: "center", lineHeight: 19 }}>{error}</Text>
          <Pressable
            onPress={() => {
              setError("");
              setAttempt((n) => n + 1);
            }}
            accessibilityRole="button"
            style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: LINE }}
          >
            <Text style={{ color: INK, fontWeight: "600" }}>Try again</Text>
          </Pressable>
        </View>
      )}

      {data && data.gameweeks.length === 0 && (
        <Text style={{ color: MUTED, fontSize: 13, textAlign: "center", marginTop: 40 }}>
          Your season starts after your first gameweek.
        </Text>
      )}

      {ready && (
        <ScrollView
          key={tab}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 90 }}
        >
          {tab === "overview" && <Overview data={data} />}
          {tab === "squad" && <Squad data={data} />}
          {tab === "decisions" && <Decisions data={data} />}
          {tab === "history" && <History data={data} />}
        </ScrollView>
      )}
    </View>
  );
}
