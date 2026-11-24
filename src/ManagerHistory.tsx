import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Gameweek, MemberSquad, PlayerFixture, Row } from "./fpl";
import { AppSymbol } from "./AppSymbol";
import { GameweekPicker } from "./GameweekPicker";
import { computeLive } from "./live";
import { clubsPlaying } from "./squadPlaying";
import { Pitch } from "./Pitch";
import { PointsBadge } from "./PointsBadge";
import { PlayerMatchSheet } from "./PlayerMatchSheet";
import { CameraIcon, SquadSnapshot } from "./SquadSnapshot";
import type { PlayerMatchTarget } from "./PlayerMatchSheet";
import { PITCH_PANEL, ScreenBackground, THEME } from "./theme";
import { loadEstimateSnapshot } from "./estimateSnapshots";
import { rebuildEstimates } from "./estimateRebuild";

type Props = {
  title: string;
  managerName: string;
  entry: number;
  gameweeks: Gameweek[];
  selectedEvent: number;
  data: MemberSquad | null;
  loading: boolean;
  error: string;
  showBlankSquadOnError?: boolean;
  fixturesByTeam?: Record<number, PlayerFixture[]>;
  onBack: () => void;
  onSelectEvent: (event: number) => void;
  // Opens another team's page (the gameweek's highest scorer).
  onViewEntry?: (entry: number, event: number) => void;
  // Pull down to reload this gameweek.
  refreshing?: boolean;
  onRefresh?: () => void;
  // The signed-in user's team: on its own page, a line compares the
  // estimates saved before the deadline with the points scored.
  ownEntry?: number;
};

// How accurate Skippr's estimates were for the players who counted: the
// share whose points came within 2 of the estimate (each player checked on
// his own, so one big miss can't hide behind another's surprise). Uses the
// estimates saved before the deadline, or rebuilt ones. Shown once the
// gameweek is over, and only when most of the players have an estimate.
function EstimateCheck({
  counted,
  estimates,
  finished,
}: {
  counted: { id: number; points: number }[];
  estimates: Record<number, number>;
  finished: boolean;
}) {
  const matched = counted.filter((pick) => estimates[pick.id] != null);
  if (!finished || matched.length < 8) return null;
  const close = matched.filter((pick) => Math.abs(estimates[pick.id] - pick.points) <= 2).length;
  const percent = Math.round((100 * close) / matched.length);
  return (
    <View
      accessible
      accessibilityLabel={`Skippr's estimates were ${percent}% accurate this gameweek: within 2 points for ${close} of your ${matched.length} players.`}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}
    >
      <AppSymbol name={{ ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }} color="#f2c14e" size={12} />
      <Text numberOfLines={1} style={{ flexShrink: 1, color: THEME.muted, fontSize: 11 }}>
        {"Skippr's estimates were "}
        <Text style={{ color: THEME.ink, fontWeight: "700" }}>{`${percent}% accurate`}</Text>
        {" this gameweek"}
      </Text>
    </View>
  );
}

// The estimate accuracy line on the user's own Points page (EstimateCheck).
// Hidden for now, to be revealed later: set to true to show it again. The
// estimates keep being saved before each deadline (index.tsx) meanwhile.
const SHOW_ESTIMATE_ACCURACY = false;

const GREEN = THEME.accent;
const DARK_GREEN = THEME.bg;

// Small status lines under the points badge.
// Between the points card and the lines under it.
const STATUS_GAP = 4;

const STATUS_TEXT = {
  color: THEME.soft,
  fontSize: 8.5,
  fontWeight: "800" as const,
  backgroundColor: "rgba(11, 16, 32, 0.88)",
  borderRadius: 7,
  paddingHorizontal: 6,
  paddingVertical: 1.5,
  overflow: "hidden" as const,
};

type Size = { width: number; height: number };
// A measured size, kept as the same object when it hasn't really changed (so
// measuring doesn't re-render forever).
const sameSize = (current: Size | null, next: Size): Size => {
  const rounded = { width: Math.ceil(next.width), height: Math.ceil(next.height) };
  return current && current.width === rounded.width && current.height === rounded.height ? current : rounded;
};

const CHIP_LABELS: Record<string, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};

export function ManagerHistory({
  title,
  managerName,
  entry,
  gameweeks,
  selectedEvent,
  data,
  loading,
  error,
  showBlankSquadOnError = false,
  fixturesByTeam,
  onBack,
  onSelectEvent,
  onViewEntry,
  refreshing = false,
  onRefresh,
  ownEntry,
}: Props) {
  const insets = useSafeAreaInsets();
  const [pickerOpen, setPickerOpen] = useState(false);
  // The points card and the average/highest card measure themselves; both
  // then take the larger width and height, so they match and neither clips.
  const [badgeSize, setBadgeSize] = useState<Size | null>(null);
  const [statsSize, setStatsSize] = useState<Size | null>(null);
  const [statusHeight, setStatusHeight] = useState(0);
  // The right-hand column's height as drawn (card and the lines under it).
  const [columnDrawn, setColumnDrawn] = useState<number | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  // The player whose match is open (tapped on the pitch).
  const [openPlayer, setOpenPlayer] = useState<PlayerMatchTarget | null>(null);
  const ownData = data?.entry === entry ? data : null;
  const [estimates, setEstimates] = useState<{ key: string; est: Record<number, number> | null } | null>(null);
  // While another gameweek loads, keep the previous one on screen (dimmed)
  // instead of blanking the pitch and popping the new one in.
  const stale = !!ownData && ownData.event !== selectedEvent;
  const currentData = ownData && (!stale || loading) ? ownData : null;
  const shownEvent = currentData?.event ?? selectedEvent;
  const selectedGwData = gameweeks.find((gw) => gw.id === shownEvent);
  const isLive = Boolean(selectedGwData?.isCurrent && !selectedGwData.finished);
  const isOwnTeam = ownEntry != null && ownEntry === entry;
  const estimateKey = `${entry}:${shownEvent}`;
  // The estimates saved before the deadline; for a gameweek without them
  // (played before saving began, or the app wasn't opened in time), rebuilt
  // from the players' match histories as they stood at the deadline.
  const deadline = selectedGwData?.deadlineTime ?? null;
  const squadPlayers = currentData && currentData.event === shownEvent ? currentData.picks : null;
  const squadKey = squadPlayers?.map((pick) => pick.id).join(",") ?? "";
  useEffect(() => {
    if (!SHOW_ESTIMATE_ACCURACY || !isOwnTeam || !squadPlayers) return;
    let active = true;
    loadEstimateSnapshot(entry, shownEvent)
      .then((saved) =>
        saved ??
        (deadline
          ? rebuildEstimates(
              squadPlayers.map((pick) => ({ id: pick.id, type: pick.elementType, teamId: pick.teamId })),
              shownEvent,
              deadline,
              fixturesByTeam ?? {},
            )
          : null),
      )
      .then((est) => {
        if (active) setEstimates({ key: estimateKey, est });
      });
    return () => {
      active = false;
    };
    // `squadKey` stands for `squadPlayers`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnTeam, entry, shownEvent, estimateKey, squadKey, deadline, fixturesByTeam]);
  const shownEstimates = isOwnTeam && estimates?.key === estimateKey ? estimates.est : null;
  // Projected auto-subs and the armband, as FPL will
  // settle them. For a finished gameweek these match what FPL applied.
  const live = currentData
    ? computeLive(currentData.picks, currentData.fixtures ?? [], currentData.chip)
    : null;
  // The right-hand column is the points card plus the "still to play" / hit
  // lines under it; together they stand exactly as tall as the average and
  // highest card on the left, and both cards share one width.
  const statusShown = !!currentData && (isLive || (currentData.history.transferCost ?? 0) > 0);
  // What the lines under the card actually take, gap included: the whole
  // right-hand column as drawn, less the card (measured, not added up, so
  // margins and rounding can't leave a gap under the lines).
  const statusSpace =
    statusShown && statusHeight > 0
      ? columnDrawn != null && badgeSize && columnDrawn > badgeSize.height
        ? columnDrawn - badgeSize.height
        : statusHeight + STATUS_GAP
      : 0;
  const columnHeight =
    badgeSize && statsSize ? Math.max(statsSize.height, badgeSize.height + statusSpace) : null;
  const sharedSize =
    badgeSize && statsSize && columnHeight != null
      ? { width: Math.max(badgeSize.width, statsSize.width), height: columnHeight }
      : null;
  // The two cards stay invisible until they have measured each other, so
  // they appear at their shared size instead of resizing on screen.
  const cardsSized =
    !!badgeSize && (!selectedGwData || !!statsSize) && (!statusShown || statusHeight > 0);
  const picks: Row[] =
    live?.picks.map((pick) => {
      // Bench players show their own points; only counted ones are multiplied.
      const shownMultiplier = Math.max(1, pick.effectiveMultiplier);
      return {
        id: pick.id,
        pos: pick.position,
        name: pick.name,
        team: pick.team,
        teamId: pick.teamId,
        type: pick.elementType,
        cap: pick.captain || !!pick.actingCaptain,
        vice: pick.viceCaptain && !pick.actingCaptain,
        multiplier: pick.effectiveMultiplier,
        minutes: pick.minutes,
        sell: 0,
        buy: 0,
        displayPoints: pick.livePoints * shownMultiplier,
        formMood: pick.formMood,
        fixtures: fixturesByTeam?.[pick.teamId] ?? [],
        autoSub: pick.autoSub,
        provisionalBonus: pick.provisionalBonus,
        matchStarted: (currentData?.fixtures ?? []).some(
          (fixture) => fixture.started && (fixture.teamH === pick.teamId || fixture.teamA === pick.teamId),
        ),
      };
    }) ?? [];
  // For finished gameweeks FPL's own figure is authoritative; while one is in
  // play its total lags, so use the live calculation.
  const totalPts =
    selectedGwData?.finished && currentData?.history.points != null
      ? currentData.history.points
      : (live?.total ?? 0);
  const showBlankSquad =
    showBlankSquadOnError &&
    !loading &&
    error.includes("has not published") &&
    !currentData;
  const blankPicks: Row[] = Array.from({ length: 15 }, (_, index) => {
    const position = index + 1;
    const type =
      position === 1 || position === 12
        ? 1
        : position <= 5 || position === 13
          ? 2
          : position <= 8 || position === 14
            ? 3
            : 4;
    return {
      id: -position,
      pos: position,
      name: "",
      team: "",
      teamId: 0,
      type,
      cap: false,
      vice: false,
      sell: 0,
      buy: 0,
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: DARK_GREEN }}>
      <ScreenBackground />

      {/* Top Header Section */}
      <View
        style={{
          paddingTop: insets.top ? insets.top + 6 : 12,
          paddingHorizontal: 12,
          paddingBottom: 6,
          zIndex: 2,
        }}
      >
        {/* Row 1: Back Button & GW Selector Badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Pressable
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              height: 34,
              marginLeft: -4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppSymbol
              name={{ ios: "chevron.left", android: "chevron_left", web: "chevron_left" }}
              color={THEME.soft}
              size={20}
            />
            <Text style={{ color: THEME.soft, fontSize: 14, fontWeight: "500" }}>Back</Text>
          </Pressable>

          <View style={{ flex: 1 }} />
          {/* A picture of this gameweek's squad to share */}
          {!!currentData && !stale && (
            <Pressable
              onPress={() => {
                setOpenPlayer(null);
                setSnapshotOpen(true);
              }}
              disabled={snapshotOpen}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Share a picture of this squad"
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                borderRadius: 17,
                marginRight: 8,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
                backgroundColor: pressed ? THEME.surfaceRaised : THEME.surface,
              })}
            >
              <CameraIcon color={THEME.ink} size={16} />
            </Pressable>
          )}
          <Pressable
            onPress={() => setPickerOpen(true)}
            disabled={gameweeks.length === 0}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Gameweek ${selectedEvent}. Change gameweek`}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              height: 34,
              borderRadius: 17,
              paddingLeft: 14,
              paddingRight: 10,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
              backgroundColor: pressed ? THEME.surfaceRaised : THEME.surface,
            })}
          >
            <Text style={{ color: THEME.ink, fontSize: 13.5, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
              {`GW ${selectedEvent}`}
            </Text>
            <AppSymbol
              name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }}
              color={THEME.muted}
              size={18}
            />
          </Pressable>
        </View>

        {/* Row 2: Team Name with Green Accent Bar & Manager Name */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={{ color: THEME.ink, fontSize: 17, fontWeight: "700" }}
            >
              {title}
            </Text>
            {!!managerName && (
              <Text
                numberOfLines={1}
                style={{ color: THEME.muted, fontSize: 12, marginTop: 1 }}
              >
                {managerName}
              </Text>
            )}
          </View>
          {/* The chip played this gameweek: here in the header, clear of the
              players on the pitch. */}
          {!!currentData?.chip && (
            <View
              accessible
              accessibilityLabel={`Chip played: ${CHIP_LABELS[currentData.chip] ?? currentData.chip}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginLeft: 10,
                paddingHorizontal: 10,
                height: 26,
                borderRadius: 13,
                backgroundColor: THEME.accentSoft,
                borderWidth: 1,
                borderColor: THEME.accentLine,
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.accent }} />
              <Text style={{ color: THEME.accent, fontWeight: "700", fontSize: 11, letterSpacing: 0.4 }}>
                {CHIP_LABELS[currentData.chip] ?? currentData.chip}
              </Text>
            </View>
          )}
        </View>
        {SHOW_ESTIMATE_ACCURACY && !!shownEstimates && !!live && !stale && (
          <EstimateCheck
            counted={live.picks
              .filter((pick) => pick.effectiveMultiplier > 0)
              .map((pick) => ({ id: pick.id, points: pick.livePoints }))}
            estimates={shownEstimates}
            finished={Boolean(selectedGwData?.finished)}
          />
        )}
      </View>

      <PlayerMatchSheet player={openPlayer} event={shownEvent} onClose={() => setOpenPlayer(null)} />

      <GameweekPicker
        visible={pickerOpen}
        gameweeks={gameweeks.filter((gw) => gw.finished || gw.isCurrent)}
        selected={selectedEvent}
        onSelect={onSelectEvent}
        onClose={() => setPickerOpen(false)}
      />

      {/* Main Pitch View with Top-Right Points Overlay or Empty State. It
          fits the screen and doesn't scroll, but a pull down reloads it. */}
      <ScrollView
        style={{ flex: 1 }}
        scrollEnabled={!!onRefresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          width: "100%",
          paddingBottom: insets.bottom + 62,
          justifyContent: !loading && !currentData && !showBlankSquad ? "center" : "flex-start",
          position: "relative",
        }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[GREEN]}
              tintColor={GREEN}
              progressBackgroundColor={THEME.surfaceRaised}
            />
          ) : undefined
        }
      >
        {loading && !currentData && (
          <ActivityIndicator color={GREEN} style={{ marginTop: 28 }} />
        )}

        {currentData || showBlankSquad ? (
          <View style={{ flex: 1, width: "100%" }}>
          <View style={{ flex: 1, width: "100%", opacity: stale ? 0.4 : 1 }}>
          <Pitch
            picks={currentData ? picks : blankPicks}
            selectedGw={shownEvent}
            selectedPos={null}
            layoutId="points"
            onPress={
              currentData
                ? (row) =>
                    setOpenPlayer({
                      id: row.id,
                      name: row.name,
                      team: row.team,
                      teamId: row.teamId,
                      type: row.type,
                      multiplier: row.multiplier ?? 1,
                      captain: row.cap,
                    })
                : undefined
            }
            overlay={
              <>
                <View
                  pointerEvents="none"
                  onLayout={(event) => {
                    const height = Math.ceil(event.nativeEvent.layout.height);
                    setColumnDrawn((current) => (current === height ? current : height));
                  }}
                  style={{ position: "absolute", top: 8, right: 8, zIndex: 10, opacity: cardsSized ? 1 : 0 }}
                >
                  {/* Measured, so the average/highest card can match its size. */}
                  <View
                    onLayout={(event) => {
                      const layout = event.nativeEvent.layout;
                      setBadgeSize((size) => sameSize(size, layout));
                    }}
                  >
                  <PointsBadge
                    minSize={sharedSize ? { width: sharedSize.width, height: sharedSize.height - statusSpace } : null}
                    gameweek={shownEvent}
                    points={currentData ? totalPts : null}
                    live={isLive}
                    // Pulses only while one of this team's players has a match on.
                    blink={!!currentData && clubsPlaying(picks.map((pick) => pick.teamId), currentData.fixtures ?? [])}
                  />
                  </View>
                  {currentData && (isLive || (currentData.history.transferCost ?? 0) > 0) && (
                    <View
                      onLayout={(event) => {
                        const height = Math.ceil(event.nativeEvent.layout.height);
                        setStatusHeight((current) => (current === height ? current : height));
                      }}
                      style={{
                        marginTop: STATUS_GAP,
                        alignSelf: "flex-end",
                        alignItems: "flex-end",
                        gap: 2,
                      }}
                    >
                      {isLive && live && (
                        <Text style={STATUS_TEXT}>
                          {live.stillToPlay > 0
                            ? `${live.stillToPlay} still to play`
                            : "All played"}
                        </Text>
                      )}
                      {(currentData.history.transferCost ?? 0) > 0 && (
                        <Text style={[STATUS_TEXT, { color: "#ff8a9c" }]}>
                          {`−${currentData.history.transferCost} hit`}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
                <View
                  pointerEvents="box-none"
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    zIndex: 10,
                    alignItems: "flex-start",
                    gap: 6,
                    opacity: cardsSized ? 1 : 0,
                  }}
                >
                  {selectedGwData && (
                    <GameweekStats
                      size={sharedSize}
                      onMeasure={(layout) => setStatsSize((size) => sameSize(size, layout))}
                      average={selectedGwData.averageScore ?? null}
                      highest={selectedGwData.highestScore ?? null}
                      onOpenHighest={
                        onViewEntry && selectedGwData.highestEntry && selectedGwData.highestEntry !== entry
                          ? () => onViewEntry(selectedGwData.highestEntry as number, selectedGwData.id)
                          : undefined
                      }
                    />
                  )}
                </View>
              </>
            }
          />
          </View>
          {stale && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator
                color={GREEN}
                size="large"
                accessibilityLabel={`Loading gameweek ${selectedEvent}`}
              />
            </View>
          )}
          </View>
        ) : !loading ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
            <Text
              style={{
                color: THEME.muted,
                fontSize: 14,
                fontWeight: "600",
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              No past gameweek history available.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {snapshotOpen && currentData && (
        <SquadSnapshot
          picks={picks}
          selectedGw={shownEvent}
          showPrice={false}
          gameweekName={selectedGwData?.name ?? `Gameweek ${shownEvent}`}
          chip={currentData.chip}
          points={totalPts}
          manager={{
            teamName: title,
            managerName,
            overallRank: currentData.history.overallRank ?? null,
          }}
          onDone={() => setSnapshotOpen(false)}
        />
      )}
    </View>
  );
}


// The gameweek's average and highest score across all FPL teams, in the
// pitch's top-left corner. Tapping the highest opens that team.
function GameweekStats({
  size,
  onMeasure,
  average,
  highest,
  onOpenHighest,
}: {
  // The size both cards share (the larger of the two), once measured.
  size: { width: number; height: number } | null;
  onMeasure: (layout: { width: number; height: number }) => void;
  average: number | null;
  highest: number | null;
  onOpenHighest?: () => void;
}) {
  // FPL reports 0 before a gameweek has scores.
  const avg = average != null && average > 0 ? String(average) : "—";
  const top = highest != null && highest > 0 ? String(highest) : "—";
  const canOpen = !!onOpenHighest && top !== "—";
  const label = {
    color: THEME.muted,
    fontSize: 6.5,
    lineHeight: 8,
    fontWeight: "500" as const,
    letterSpacing: 1.2,
    includeFontPadding: false,
  };
  const value = {
    color: THEME.ink,
    fontSize: 12,
    lineHeight: 13,
    fontWeight: "700" as const,
    fontVariant: ["tabular-nums" as const],
    includeFontPadding: false,
  };
  // Each half shares out any extra height, its text centred like the
  // points card's; never less than its own padding, so nothing is clipped.
  const half = {
    flexGrow: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 6,
    paddingVertical: 6,
  };
  return (
    <View
      onLayout={(event) => onMeasure(event.nativeEvent.layout)}
      style={{
        // At least the points card's size: both cards grow to the larger.
        minWidth: Math.max(44, size?.width ?? 0),
        minHeight: size?.height,
        borderRadius: 10,
        overflow: "hidden",
        ...PITCH_PANEL,
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}
    >
      <View
        accessible
        accessibilityLabel={`Average score: ${avg === "—" ? "not available yet" : `${avg} points`}`}
        style={half}
      >
        <Text maxFontSizeMultiplier={1.2} style={label}>AVERAGE</Text>
        <Text maxFontSizeMultiplier={1.2} style={[value, { marginTop: 2 }]}>{avg}</Text>
      </View>
      <View style={{ height: 1, marginHorizontal: 10, backgroundColor: "rgba(255, 255, 255, 0.08)" }} />
      <Pressable
        onPress={onOpenHighest}
        disabled={!canOpen}
        accessibilityRole={canOpen ? "button" : undefined}
        accessibilityLabel={`Highest score: ${top === "—" ? "not available yet" : `${top} points`}`}
        accessibilityHint={canOpen ? "Shows the team that scored it" : undefined}
        style={({ pressed }) => ({
          ...half,
          backgroundColor: pressed ? THEME.accentSoft : "transparent",
        })}
      >
        <Text maxFontSizeMultiplier={1.2} style={label}>HIGHEST</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 }}>
          <Text maxFontSizeMultiplier={1.2} style={[value, { color: canOpen ? THEME.accent : THEME.ink }]}>{top}</Text>
          {canOpen && (
            <AppSymbol name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} color={THEME.accent} size={13} />
          )}
        </View>
      </Pressable>
    </View>
  );
}
