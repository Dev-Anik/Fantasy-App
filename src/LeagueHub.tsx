import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ScrollViewInstance } from "react-native";
import { leagueCategory } from "./fpl";
import type {
  FplLeague,
  Gameweek,
  H2hMatch,
  LeagueCategory,
  LeagueStanding,
  LeagueStandings,
  LeagueType,
} from "./fpl";
import { AppSymbol } from "./AppSymbol";
import { LeagueCard } from "./LeagueCard";
import { LeagueDetails } from "./LeagueDetails";
import { FadeIn } from "./FadeIn";
import { THEME } from "./theme";
import { Button, Divider, Field, Group, LEAGUE_UI as UI } from "./leagueUi";

const LEAGUE_SECTIONS: { category: LeagueCategory; title: string; hint: string }[] = [
  { category: "classic", title: "Classic", hint: "Ranked by total points" },
  { category: "h2h", title: "Head-to-head", hint: "A match against another manager each gameweek" },
  { category: "general", title: "General", hint: "Overall, country, club and gameweek leagues" },
];

type Props = {
  leagues: FplLeague[];
  selectedLeague: FplLeague | null;
  standings: LeagueStandings | null;
  h2hMatches: H2hMatch[];
  h2hEvent: number | null;
  h2hLoading: boolean;
  userStanding: LeagueStanding | null;
  userTotalPoints: number | null;
  liveEventId: number | null;
  liveEventPoints: number | null;
  onSelectH2hEvent: (league: FplLeague, event: number) => void;
  onCloseLeague: () => void;
  loading: boolean;
  error: string;
  gameweeks: Gameweek[];
  userEntryId?: number;
  onSelectLeague: (league: FplLeague, page?: number) => void;
  onJoin: (code: string) => void;
  onCreate: (
    name: string,
    type: LeagueType,
    startEvent?: number,
    knockoutRounds?: number,
    maxEntries?: number,
  ) => void;
  inviteCode: string | null;
  onGetInviteCode: (league: FplLeague) => void;
  onViewMember: (entry: number, event: number, teamName?: string, managerName?: string) => void;
  successSignal?: number;
};

const KNOCKOUT_OPTIONS = [
  { rounds: 1, label: "1 round", detail: "Top 2 teams, final in GW 38" },
  { rounds: 2, label: "2 rounds", detail: "Top 4 teams, semi-finals and final in GW 37–38" },
  { rounds: 3, label: "3 rounds", detail: "Top 8 teams, quarter-finals to final in GW 36–38" },
];

// A field that opens a short list of choices below it.
function Picker<T extends string | number>({
  label,
  value,
  open,
  onToggle,
  options,
  onSelect,
  hint,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  options: { value: T; label: string; detail?: string }[];
  onSelect: (value: T) => void;
  hint?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: UI.soft, fontSize: 12.5, fontWeight: "600", marginBottom: 6 }}>{label}</Text>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityState={{ expanded: open }}
        style={{
          height: 44,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          borderWidth: 1,
          borderColor: open ? UI.soft : "rgba(255, 255, 255, 0.12)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: UI.ink, fontSize: 14 }}>{value}</Text>
        <AppSymbol
          name={
            open
              ? { ios: "chevron.up", android: "expand_less", web: "expand_less" }
              : { ios: "chevron.down", android: "expand_more", web: "expand_more" }
          }
          color={UI.muted}
          size={18}
        />
      </Pressable>
      {open && (
        <View
          style={{
            marginTop: 6,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.12)",
            backgroundColor: THEME.surfaceRaised,
            maxHeight: 220,
            overflow: "hidden",
          }}
        >
          <ScrollView nestedScrollEnabled>
            {options.map((option, index) => {
              const selected = option.label === value;
              return (
                <View key={String(option.value)}>
                  {index > 0 && <Divider inset={12} />}
                  <Pressable
                    onPress={() => onSelect(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 11,
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: pressed ? UI.pressed : "transparent",
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: UI.ink, fontSize: 14, fontWeight: selected ? "600" : "400" }}>
                        {option.label}
                      </Text>
                      {!!option.detail && <Text style={{ color: UI.muted, fontSize: 12, marginTop: 1 }}>{option.detail}</Text>}
                    </View>
                    {selected && (
                      <AppSymbol name={{ ios: "checkmark", android: "check", web: "check" }} color={UI.good} size={16} />
                    )}
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
      {!!hint && <Text style={{ color: UI.muted, fontSize: 11.5, lineHeight: 16, marginTop: 6 }}>{hint}</Text>}
    </View>
  );
}

export function LeagueHub({
  leagues,
  selectedLeague,
  standings,
  h2hMatches,
  h2hEvent,
  h2hLoading,
  userStanding,
  userTotalPoints,
  liveEventId,
  liveEventPoints,
  onSelectH2hEvent,
  onCloseLeague,
  loading,
  error,
  gameweeks,
  userEntryId,
  onSelectLeague,
  onJoin,
  onCreate,
  inviteCode,
  onGetInviteCode,
  onViewMember,
  successSignal,
}: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [leagueType, setLeagueType] = useState<LeagueType>("classic");

  const currentGw = gameweeks.find((gw) => gw.isCurrent)?.id ?? gameweeks[0]?.id ?? 1;
  const seasonGameweeks = Array.from({ length: 38 }, (_, i) => {
    const id = i + 1;
    const existing = gameweeks.find((gw) => gw.id === id);
    return existing ?? { id, name: `Gameweek ${id}`, finished: id < currentGw, isCurrent: id === currentGw };
  }).filter((gw) => !gw.finished || gw.isCurrent);

  const [scoringStartGw, setScoringStartGw] = useState<number>(seasonGameweeks[0]?.id ?? currentGw);
  const [maxPlayers, setMaxPlayers] = useState<string>("");
  const [knockoutRounds, setKnockoutRounds] = useState<number>(2);
  const [showGwDropdown, setShowGwDropdown] = useState(false);
  const [showKnockoutDropdown, setShowKnockoutDropdown] = useState(false);
  const [actionModal, setActionModal] = useState<"none" | "create" | "join">("none");
  const [showLeagueDetails, setShowLeagueDetails] = useState(false);
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  // A league opens once its table has arrived (or the request has failed);
  // until then the list stays put and the tapped row shows a spinner.
  const detailsReady = showLeagueDetails && !!selectedLeague && (!!standings || !!error || !loading);
  const openingLeague = showLeagueDetails && !detailsReady ? selectedLeague : null;

  // A join or create succeeded: close the form and clear it (while
  // rendering, rather than in an effect that would draw the old form once).
  const [handledSignal, setHandledSignal] = useState(successSignal);
  if (successSignal !== handledSignal) {
    setHandledSignal(successSignal);
    if (successSignal) {
      setActionModal("none");
      setCode("");
      setName("");
    }
  }

  // Jump to the top when a different league or standings page is shown, but
  // not when the same page is quietly refreshed in the background.
  const standingsLeagueId = standings?.league?.id;
  const standingsPage = standings?.standings?.page;
  useEffect(() => {
    if (standingsLeagueId == null) return;
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [standingsLeagueId, standingsPage]);

  const openLeague = (league: FplLeague) => {
    setShowLeagueDetails(true);
    onSelectLeague(league);
  };
  // The league type shown. Until the user picks one, the first type they
  // have leagues in.
  const [category, setCategory] = useState<LeagueCategory | null>(null);
  const counts: Record<LeagueCategory, number> = { classic: 0, h2h: 0, general: 0 };
  for (const league of leagues) counts[leagueCategory(league)] += 1;
  const shownCategory =
    category ?? LEAGUE_SECTIONS.find((section) => counts[section.category] > 0)?.category ?? "classic";
  const activeSection = LEAGUE_SECTIONS.find((section) => section.category === shownCategory) ?? LEAGUE_SECTIONS[0];
  const shownLeagues = leagues.filter((league) => leagueCategory(league) === shownCategory);

  const knockout = KNOCKOUT_OPTIONS.find((option) => option.rounds === knockoutRounds) ?? KNOCKOUT_OPTIONS[1];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {!detailsReady && (
          <>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                label="Join a league"
                active={actionModal === "join"}
                onPress={() => setActionModal(actionModal === "join" ? "none" : "join")}
              />
              <Button
                label="Create a league"
                active={actionModal === "create"}
                onPress={() => setActionModal(actionModal === "create" ? "none" : "create")}
              />
            </View>

            {actionModal === "join" && (
              <View style={{ marginTop: 12, padding: 16, borderRadius: 12, backgroundColor: UI.surface }}>
                <Field
                  label="League code"
                  hint="Ask the league's admin for its invite code."
                  value={code}
                  onChangeText={setCode}
                  placeholder="e.g. abc123"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={() => code.trim() && onJoin(code.trim())}
                />
                <View style={{ flexDirection: "row" }}>
                  <Button primary label="Join" disabled={loading || !code.trim()} onPress={() => onJoin(code.trim())} />
                </View>
              </View>
            )}

            {actionModal === "create" && (
              <View style={{ marginTop: 12, padding: 16, borderRadius: 12, backgroundColor: UI.surface }}>
                <Field label="League name" value={name} onChangeText={setName} placeholder="Up to 30 characters" maxLength={30} />

                <Text style={{ color: UI.soft, fontSize: 12.5, fontWeight: "600", marginBottom: 6 }}>Type</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                  <Button label="Classic" active={leagueType === "classic"} onPress={() => setLeagueType("classic")} />
                  <Button label="Head-to-head" active={leagueType === "h2h"} onPress={() => setLeagueType("h2h")} />
                </View>
                <Text style={{ color: UI.muted, fontSize: 11.5, lineHeight: 16, marginBottom: 14 }}>
                  {leagueType === "classic"
                    ? "Teams are ranked by total points. A cup starts in the second half of the season."
                    : "Teams play one match a week; the higher score wins. Knockout rounds end the season."}
                </Text>

                <Picker
                  label="Scoring starts"
                  value={`Gameweek ${scoringStartGw}`}
                  open={showGwDropdown}
                  onToggle={() => setShowGwDropdown((visible) => !visible)}
                  options={seasonGameweeks.map((gw) => ({ value: gw.id, label: `Gameweek ${gw.id}` }))}
                  onSelect={(gw) => {
                    setScoringStartGw(gw);
                    setShowGwDropdown(false);
                  }}
                />

                <Field
                  label="Maximum teams"
                  hint="Leave empty for no limit."
                  value={maxPlayers}
                  onChangeText={(text) => setMaxPlayers(text.replace(/[^0-9]/g, ""))}
                  placeholder="No limit"
                  keyboardType="number-pad"
                />

                {leagueType === "h2h" && (
                  <Picker
                    label="Knockout rounds"
                    value={knockout.label}
                    open={showKnockoutDropdown}
                    onToggle={() => setShowKnockoutDropdown((visible) => !visible)}
                    options={KNOCKOUT_OPTIONS.map((option) => ({
                      value: option.rounds,
                      label: option.label,
                      detail: option.detail,
                    }))}
                    onSelect={(rounds) => {
                      setKnockoutRounds(rounds);
                      setShowKnockoutDropdown(false);
                    }}
                    hint={knockout.detail}
                  />
                )}

                <View style={{ flexDirection: "row" }}>
                  <Button
                    primary
                    label="Create league"
                    disabled={loading || !name.trim()}
                    onPress={() =>
                      onCreate(
                        name.trim(),
                        leagueType,
                        scoringStartGw,
                        leagueType === "h2h" ? knockoutRounds : undefined,
                        Number(maxPlayers) >= 2 ? Number(maxPlayers) : undefined,
                      )
                    }
                  />
                </View>
              </View>
            )}

            {!!error && (
              <Text style={{ color: UI.bad, fontSize: 13, lineHeight: 18, marginTop: 12 }}>{error}</Text>
            )}

            {leagues.length === 0 ? (
              <Text style={{ color: UI.muted, marginTop: 24, fontSize: 13, textAlign: "center" }}>
                {"You aren't in any leagues yet."}
              </Text>
            ) : (
              <>
                {/* One type of league at a time; the tabs switch between them. */}
                <View
                  accessibilityRole="tablist"
                  style={{ flexDirection: "row", marginTop: 22, borderBottomWidth: 1, borderBottomColor: UI.line }}
                >
                  {LEAGUE_SECTIONS.map((section) => {
                    const active = section.category === shownCategory;
                    const count = counts[section.category];
                    return (
                      <Pressable
                        key={section.category}
                        onPress={() => setCategory(section.category)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${section.title}, ${count} ${count === 1 ? "league" : "leagues"}`}
                        hitSlop={{ top: 8, bottom: 4 }}
                        style={{ marginRight: 20, paddingBottom: 10 }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ color: active ? UI.ink : UI.muted, fontSize: 14, fontWeight: active ? "700" : "500" }}>
                            {section.title}
                          </Text>
                          <View
                            style={{
                              minWidth: 18,
                              height: 18,
                              paddingHorizontal: 5,
                              borderRadius: 9,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: active ? THEME.accentSoft : "rgba(255, 255, 255, 0.06)",
                              borderWidth: 1,
                              borderColor: active ? THEME.accentLine : "rgba(255, 255, 255, 0.08)",
                            }}
                          >
                            <Text
                              style={{
                                color: active ? THEME.accent : UI.muted,
                                fontSize: 10.5,
                                fontWeight: "700",
                                fontVariant: ["tabular-nums"],
                              }}
                            >
                              {count}
                            </Text>
                          </View>
                        </View>
                        <View
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: -1,
                            height: 2,
                            backgroundColor: active ? UI.ink : "transparent",
                          }}
                        />
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={{ color: UI.muted, fontSize: 12, lineHeight: 17, marginTop: 10, marginBottom: 10 }}>
                  {activeSection.hint}
                </Text>
                {shownLeagues.length === 0 ? (
                  <Text style={{ color: UI.muted, marginTop: 14, fontSize: 13, textAlign: "center" }}>
                    {`You aren't in any ${activeSection.title.toLowerCase()} leagues yet.`}
                  </Text>
                ) : (
                  <FadeIn key={shownCategory} offsetX={0} offsetY={6}>
                    <Group>
                      {shownLeagues.map((league, index) => (
                        <LeagueCard
                          key={`${league.kind}-${league.id}`}
                          league={league}
                          first={index === 0}
                          loading={openingLeague?.id === league.id && openingLeague.kind === league.kind}
                          onPress={openLeague}
                        />
                      ))}
                    </Group>
                  </FadeIn>
                )}
              </>
            )}
          </>
        )}

        {selectedLeague && detailsReady && (
          <FadeIn key={`${selectedLeague.kind}-${selectedLeague.id}`} offsetX={24} offsetY={0}>
            <LeagueDetails
              // Remount per league so the Standings/Matches tab starts fresh.
              key={`${selectedLeague.kind}-${selectedLeague.id}`}
              league={selectedLeague}
              standings={standings}
              userStanding={userStanding}
              userEntryId={userEntryId}
              userTotalPoints={userTotalPoints}
              liveEventId={liveEventId}
              liveEventPoints={liveEventPoints}
              h2hMatches={h2hMatches}
              h2hEvent={h2hEvent}
              h2hLoading={h2hLoading}
              gameweeks={gameweeks}
              loading={loading}
              error={error}
              inviteCode={inviteCode}
              onBack={() => {
                setShowLeagueDetails(false);
                onCloseLeague();
              }}
              onPage={(page) => onSelectLeague(selectedLeague, page)}
              onGetInviteCode={() => onGetInviteCode(selectedLeague)}
              onSelectH2hEvent={(event) => onSelectH2hEvent(selectedLeague, event)}
              onViewMember={onViewMember}
            />
          </FadeIn>
        )}
      </ScrollView>
    </View>
  );
}
