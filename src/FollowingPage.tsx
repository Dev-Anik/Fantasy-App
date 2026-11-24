// The Following page (from More): FPL managers the user follows, with this
// gameweek's points, season total and overall rank; a tap opens the team.
// Managers are followed from their team page (the star by the name) or
// found here by team ID.
import { useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSymbol } from "./AppSymbol";
import { ScreenBackground, THEME } from "./theme";
import {
  follow,
  loadTeamSummary,
  peekSummary,
  rememberSummary,
  unfollow,
  useFollowing,
} from "./following";
import type { Followed, TeamSummary } from "./following";

const INK = THEME.ink;
const SOFT = THEME.soft;
const MUTED = THEME.muted;
const LINE = THEME.line;

const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Ranks of a million or more, shortened so every column keeps its width.
const shortRank = (rank: number) => (rank >= 1_000_000 ? `${(rank / 1_000_000).toFixed(2)}m` : formatNumber(rank));

// Fixed column widths, so the figures line up from row to row.
const COLUMN = { gw: 34, total: 48, rank: 64 } as const;

function Figure({ label, value, width, gold = false }: { label: string; value: string; width: number; gold?: boolean }) {
  return (
    <View style={{ width, alignItems: "flex-end" }}>
      <Text style={{ color: gold ? "#ffd400" : INK, fontSize: 13.5, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text style={{ color: MUTED, fontSize: 9, fontWeight: "700", letterSpacing: 0.8, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

// The follow toggle: a star, filled when followed.
export function FollowButton({ followed, onPress }: { followed: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: followed }}
      accessibilityLabel={followed ? "Following. Tap to unfollow" : "Follow this manager"}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        height: 30,
        paddingHorizontal: 11,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: followed ? "rgba(242, 193, 78, 0.6)" : "rgba(255, 255, 255, 0.16)",
        backgroundColor: pressed ? THEME.surfaceRaised : followed ? "rgba(242, 193, 78, 0.12)" : THEME.surface,
      })}
    >
      <AppSymbol
        name={followed ? { ios: "star.fill", android: "star", web: "star" } : { ios: "star", android: "star_border", web: "star_border" }}
        color={followed ? "#f2c14e" : SOFT}
        size={15}
      />
      <Text style={{ color: followed ? "#f2c14e" : INK, fontSize: 12, fontWeight: "700" }}>
        {followed ? "Following" : "Follow"}
      </Text>
    </Pressable>
  );
}

function TeamRow({
  team,
  summary,
  onOpen,
  onUnfollow,
  first,
}: {
  team: Followed;
  summary: TeamSummary | null;
  onOpen: () => void;
  onUnfollow: () => void;
  first: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", borderTopWidth: first ? 0 : 1, borderTopColor: LINE }}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${summary?.teamName ?? team.teamName}, ${summary?.managerName ?? team.managerName}. Opens their team`}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingLeft: 14,
          paddingVertical: 11,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: INK, fontSize: 14, fontWeight: "700" }}>
            {summary?.teamName ?? team.teamName}
          </Text>
          <Text numberOfLines={1} style={{ color: MUTED, fontSize: 11.5, marginTop: 1 }}>
            {summary?.managerName ?? team.managerName}
          </Text>
        </View>
        <Figure
          label="GW"
          width={COLUMN.gw}
          value={summary?.eventPoints != null ? String(summary.eventPoints) : "—"}
          gold
        />
        <Figure
          label="TOTAL"
          width={COLUMN.total}
          value={summary?.totalPoints != null ? formatNumber(summary.totalPoints) : "—"}
        />
        <Figure label="OV. RANK" width={COLUMN.rank} value={summary?.overallRank ? shortRank(summary.overallRank) : "—"} />
      </Pressable>
      <Pressable
        onPress={onUnfollow}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Unfollow ${summary?.teamName ?? team.teamName}`}
        style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 14, opacity: pressed ? 0.5 : 1 })}
      >
        <AppSymbol name={{ ios: "xmark", android: "close", web: "close" }} color={MUTED} size={14} />
      </Pressable>
    </View>
  );
}

export function FollowingPage({
  ownEntry,
  onOpenTeam,
  onBack,
}: {
  ownEntry: number;
  onOpenTeam: (entry: number, teamName: string, managerName: string) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const following = useFollowing();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<TeamSummary | null>(null);
  const [searchError, setSearchError] = useState("");

  const search = async () => {
    const id = Number(query.trim());
    Keyboard.dismiss();
    setFound(null);
    setSearchError("");
    if (!Number.isInteger(id) || id <= 0) {
      setSearchError("Enter a team ID: the number in the team's FPL link.");
      return;
    }
    if (id === ownEntry) {
      setSearchError("That's your own team.");
      return;
    }
    setSearching(true);
    try {
      const summary = await loadTeamSummary(id);
      if (summary) {
        rememberSummary(summary);
        setFound(summary);
      } else {
        setSearchError(`No FPL team has the ID ${id}.`);
      }
    } catch {
      setSearchError("Couldn't reach FPL. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  };

  const foundFollowed = !!found && following.some((team) => team.entry === found.entry);

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
          Following
        </Text>
        <Text style={{ color: MUTED, fontSize: 12.5, marginTop: 2 }}>
          Managers you follow, with their latest scores.
        </Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 90 }}
      >
        {/* Find a team by ID */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              height: 42,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <AppSymbol name={{ ios: "magnifyingglass", android: "search", web: "search" }} color={MUTED} size={16} />
            <TextInput
              value={query}
              onChangeText={(text) => setQuery(text.replace(/[^0-9]/g, ""))}
              onSubmitEditing={search}
              placeholder="Team ID"
              placeholderTextColor={MUTED}
              keyboardType="number-pad"
              returnKeyType="search"
              selectionColor={THEME.accent}
              accessibilityLabel="Team ID"
              style={{ flex: 1, color: INK, fontSize: 14, marginLeft: 8, paddingVertical: 0 }}
            />
          </View>
          <Pressable
            onPress={search}
            disabled={searching || !query.trim()}
            accessibilityRole="button"
            style={({ pressed }) => ({
              height: 42,
              paddingHorizontal: 16,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: THEME.accent,
              opacity: searching || !query.trim() ? 0.45 : pressed ? 0.85 : 1,
            })}
          >
            {searching ? (
              <ActivityIndicator color={THEME.onAccent} size="small" />
            ) : (
              <Text style={{ color: THEME.onAccent, fontSize: 13.5, fontWeight: "700" }}>Find</Text>
            )}
          </Pressable>
        </View>

        {!!searchError && <Text style={{ color: THEME.bad, fontSize: 12, marginTop: 8 }}>{searchError}</Text>}

        {found && (
          <View
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 12,
              backgroundColor: THEME.surface,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Pressable
              onPress={() => onOpenTeam(found.entry, found.teamName, found.managerName)}
              accessibilityRole="button"
              style={{ flex: 1 }}
            >
              <Text numberOfLines={1} style={{ color: INK, fontSize: 14, fontWeight: "700" }}>
                {found.teamName}
              </Text>
              <Text numberOfLines={1} style={{ color: MUTED, fontSize: 11.5, marginTop: 1 }}>
                {`${found.managerName}${found.overallRank ? ` · Rank ${formatNumber(found.overallRank)}` : ""}`}
              </Text>
            </Pressable>
            <FollowButton
              followed={foundFollowed}
              onPress={() =>
                foundFollowed
                  ? unfollow(found.entry)
                  : follow({ entry: found.entry, teamName: found.teamName, managerName: found.managerName })
              }
            />
          </View>
        )}

        <Text
          accessibilityRole="header"
          style={{ color: SOFT, fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginTop: 24, marginBottom: 8 }}
        >
          {`FOLLOWING${following.length ? ` · ${following.length}` : ""}`}
        </Text>
        {following.length === 0 ? (
          <View style={{ padding: 16, borderRadius: 12, backgroundColor: THEME.surface, gap: 4 }}>
            <Text style={{ color: INK, fontSize: 13.5, fontWeight: "700" }}>No one yet</Text>
            <Text style={{ color: SOFT, fontSize: 12, lineHeight: 17 }}>
              Find a manager by their team ID above, or tap Follow on any team page (from a league table, for example).
            </Text>
          </View>
        ) : (
          <View style={{ borderRadius: 12, backgroundColor: THEME.surface, overflow: "hidden" }}>
            {following.map((team, index) => (
              <TeamRow
                key={team.entry}
                team={team}
                summary={peekSummary(team.entry)}
                first={index === 0}
                onOpen={() => onOpenTeam(team.entry, team.teamName, team.managerName)}
                onUnfollow={() => unfollow(team.entry)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
