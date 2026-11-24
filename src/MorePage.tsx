// The "More" tab: the manager's account, My season, notifications and app
// details. Plain settings-style lists, matching the My season page.
import { Linking, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import * as Device from "expo-device";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { AppSymbol } from "./AppSymbol";
import type { NotificationSettings, PermissionState } from "./notifications";
import { SUPPORT_EMAIL } from "./appInfo";
import { liveAlertsAvailable } from "./liveAlerts";
import { THEME } from "./theme";

const SURFACE = THEME.surface;
const LINE = THEME.line;
const INK = THEME.ink;
const MUTED = THEME.muted;
const SOFT = THEME.soft;
// Switches: green when on, like the rest of the accents.
const GOOD = THEME.accent;
const DANGER = THEME.bad;

// Copies the manager's team ID (to join leagues, share with friends or use
// on other FPL sites). Shows a tick and "Copied" for a moment after.
function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = () => {
    Clipboard.setStringAsync(id)
      .then(() => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1600);
      })
      // Couldn't reach the clipboard: nothing to say, the user can retry.
      .catch(() => {});
  };
  return (
    <Pressable
      onPress={copy}
      accessibilityRole="button"
      accessibilityLabel={copied ? "Team ID copied" : `Copy team ID ${id}`}
      accessibilityLiveRegion="polite"
      hitSlop={10}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        marginLeft: 6,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: pressed ? "rgba(255, 255, 255, 0.08)" : "transparent",
      })}
    >
      <AppSymbol
        name={
          copied
            ? { ios: "checkmark", android: "check", web: "check" }
            : { ios: "doc.on.doc", android: "content_copy", web: "content_copy" }
        }
        color={copied ? GOOD : SOFT}
        size={14}
      />
      {copied && <Text style={{ color: GOOD, fontSize: 11.5, fontWeight: "600" }}>Copied</Text>}
    </Pressable>
  );
}

const NOTIFICATIONS:{ key: keyof NotificationSettings; title: string; detail: string }[] = [
  { key: "deadline24h", title: "24 hours before the deadline", detail: "Time to plan transfers" },
  { key: "deadline1h", title: "1 hour before the deadline", detail: "A last reminder, naming any flagged starters" },
  { key: "news", title: "Squad news", detail: "Injuries, suspensions and returns for your players" },
];

// Sent by the Skippr server while matches are played (see liveAlerts.ts).
const LIVE_ALERTS: { key: keyof NotificationSettings; title: string; detail: string }[] = [
  { key: "liveStarted", title: "Players starting", detail: "When your players come on" },
  { key: "liveGoals", title: "Goals and assists", detail: "Goals, assists and penalty saves, with points" },
  { key: "liveCards", title: "Cards and mistakes", detail: "Bookings, red cards, own goals, missed penalties" },
  { key: "liveFulltime", title: "Full time", detail: "The score and your players' points" },
  { key: "liveBench", title: "Include bench players", detail: "Also tell me about players on my bench" },
];

function Heading({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      // Grey, not the accent: a label for the group, quieter than the rows
      // (green is kept for meaning: on, good, yours).
      style={{
        color: MUTED,
        fontSize: 11,
        fontWeight: "600",
        letterSpacing: 1.4,
        textTransform: "uppercase",
        marginTop: 28,
        marginBottom: 8,
        marginLeft: 2,
      }}
    >
      {children}
    </Text>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: SURFACE, borderRadius: 12, overflow: "hidden" }}>{children}</View>;
}

function Divider({ inset = 16 }: { inset?: number }) {
  return <View style={{ height: 1, marginLeft: inset, backgroundColor: LINE }} />;
}
// One line of a list: a title, an optional line under it, and something on
// the right (a chevron, a switch or a value). `strong` marks the app's
// features (Insights) apart from settings.
function Item({
  title,
  detail,
  right,
  onPress,
  color = INK,
  strong = false,
  accessibilityLabel,
}: {
  title: string;
  detail?: string;
  right?: ReactNode;
  onPress?: () => void;
  color?: string;
  strong?: boolean;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ color, fontSize: 15, fontWeight: strong ? "600" : "500" }}>{title}</Text>
        {!!detail && <Text style={{ color: MUTED, fontSize: 12, marginTop: 2, lineHeight: 16 }}>{detail}</Text>}
      </View>
      {right}
    </>
  );
  const style = { flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 16, paddingVertical: 13 };
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [style, { backgroundColor: pressed ? "rgba(255, 255, 255, 0.04)" : "transparent" }]}
    >
      {body}
    </Pressable>
  );
}

type SwitchRow = { key: keyof NotificationSettings; title: string; detail: string };

// Every notification switch (deadline reminders and live match alerts) in one
// card that starts closed, showing only how many are on, so the More page
// isn't a long list of switches. Blocked notifications are always shown.
function NotificationsSection({
  settings,
  permission,
  onToggle,
  onOpenSettings,
}: {
  settings: NotificationSettings;
  permission: PermissionState;
  onToggle: (key: keyof NotificationSettings) => void;
  onOpenSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Opening and closing: the switches' height grows from 0 to their natural
  // height (measured below) while they fade in, and the arrow turns over.
  // Animating the height moves the sections below smoothly too.
  const [bodyHeight, setBodyHeight] = useState(0);
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [open, progress]);
  const bodyStyle = useAnimatedStyle(() => ({ height: progress.value * bodyHeight, opacity: progress.value }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 180}deg` }] }));
  const live = liveAlertsAvailable ? LIVE_ALERTS : [];
  const isOn = (row: SwitchRow) => settings[row.key] && permission === "granted";
  // "Include bench players" changes other alerts rather than being one.
  const counted = [...NOTIFICATIONS, ...live].filter((row) => row.key !== "liveBench");
  const onCount = counted.filter(isOn).length;
  const summary =
    permission === "denied"
      ? "Blocked in your phone's settings"
      : onCount === 0
        ? "All off"
        : `${onCount} of ${counted.length} on`;

  const switchRow = (row: SwitchRow, index: number) => (
    <View key={row.key}>
      {index > 0 && <Divider />}
      <Item
        title={row.title}
        detail={row.detail}
        right={
          <Switch
            value={isOn(row)}
            onValueChange={() => onToggle(row.key)}
            accessibilityLabel={row.title}
            trackColor={{ false: "rgba(255, 255, 255, 0.16)", true: GOOD }}
            thumbColor="#ffffff"
            ios_backgroundColor="rgba(255, 255, 255, 0.16)"
          />
        }
      />
    </View>
  );

  return (
    <>
      <Heading>Notifications</Heading>
      <Group>
        {permission === "denied" && (
          <>
            <Item
              title="Notifications are blocked"
              detail="Allow them for Skippr in your phone's settings."
              color="#f2c14e"
              right={<Chevron />}
              onPress={onOpenSettings}
            />
            <Divider />
          </>
        )}
        <Pressable
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`Notification settings, ${summary}`}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 13,
            backgroundColor: pressed ? "rgba(255, 255, 255, 0.04)" : "transparent",
          })}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: INK, fontSize: 15, fontWeight: "500" }}>Reminders and alerts</Text>
            <Text style={{ color: MUTED, fontSize: 12, marginTop: 2, lineHeight: 16 }}>{summary}</Text>
          </View>
          <Animated.View style={arrowStyle}>
            <AppSymbol name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }} color={MUTED} size={18} />
          </Animated.View>
        </Pressable>
        <Animated.View
          style={[{ overflow: "hidden" }, bodyStyle]}
          // Closed: out of reach of taps and screen readers.
          pointerEvents={open ? "auto" : "none"}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? "auto" : "no-hide-descendants"}
        >
          {/* Laid out at full height whatever the box's current height, so
              it can be measured for the animation. */}
          <View
            style={{ position: "absolute", top: 0, left: 0, right: 0 }}
            onLayout={(event) => setBodyHeight(event.nativeEvent.layout.height)}
          >
            <Divider />
            {NOTIFICATIONS.map(switchRow)}
            {live.length > 0 && (
              <>
                <Divider />
                <Text
                  accessibilityRole="header"
                  style={{
                    color: MUTED,
                    fontSize: 10.5,
                    fontWeight: "600",
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    paddingHorizontal: 16,
                    paddingTop: 14,
                    paddingBottom: 2,
                  }}
                >
                  Live match alerts
                </Text>
                {live.map(switchRow)}
                <Text style={{ color: MUTED, fontSize: 11.5, lineHeight: 16, paddingHorizontal: 16, paddingBottom: 14 }}>
                  Sent while matches are played, a minute or two after FPL updates.
                </Text>
              </>
            )}
          </View>
        </Animated.View>
      </Group>
    </>
  );
}

const Chevron = () => (
  <AppSymbol name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} color={MUTED} size={16} />
);

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "FC";
}

export function MorePage({
  teamName,
  managerName,
  entry,
  version,
  notifSettings,
  notifPermission,
  onToggleNotification,
  onOpenSettings,
  onOpenSeason,
  onOpenCareer,
  onOpenFollowing,
  onOpenPlanner,
  onOpenMatches,
  onOpenHelper,
  onOpenPrivacy,
  onOpenTerms,
  onLogout,
}: {
  teamName: string;
  managerName: string;
  entry: number;
  version: string;
  notifSettings: NotificationSettings;
  notifPermission: PermissionState;
  onToggleNotification: (key: keyof NotificationSettings) => void;
  onOpenSettings: () => void;
  onOpenSeason: () => void;
  onOpenCareer: () => void;
  onOpenFollowing: () => void;
  onOpenPlanner: () => void;
  onOpenMatches: () => void;
  onOpenHelper: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onLogout: () => void;
}) {
  // An email to support with what helps to look into a problem: the app
  // version and the phone. Nothing else about the user is included.
  const sendFeedback = () => {
    const details = [
      `App version: ${version}`,
      `Phone: ${[Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || "unknown"}`,
      `System: ${Platform.OS === "ios" ? "iOS" : "Android"} ${Device.osVersion ?? Platform.Version}`,
    ].join("\n");
    const body = `\n\n\n---\n${details}`;
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Skippr feedback")}&body=${encodeURIComponent(body)}`,
    ).catch(() => {});
  };

  return (
    <ScrollView
      style={{ flex: 1, width: "100%" }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Account */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: SURFACE,
            borderWidth: 1,
            borderColor: LINE,
          }}
        >
          <Text style={{ color: SOFT, fontSize: 16, fontWeight: "700" }}>{initials(teamName)}</Text>
        </View>
        {/* Not grouped for screen readers, so the copy button stays reachable. */}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: INK, fontSize: 19, fontWeight: "700" }}>
            {teamName}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, color: MUTED, fontSize: 13 }}>
              {`${managerName} · ID ${entry}`}
            </Text>
            <CopyIdButton id={String(entry)} />
          </View>
        </View>
      </View>

      <Heading>Insights</Heading>
      <Group>
        <Item
          title="Chips & captain"
          strong
          detail="Captain options and chip readings for this gameweek"
          right={<Chevron />}
          onPress={onOpenHelper}
        />
        <Divider />
        <Item
          title="Matches"
          strong
          detail="Live scores, results and kick-off times"
          right={<Chevron />}
          onPress={onOpenMatches}
        />
        <Divider />
        <Item
          title="My season"
          strong
          detail="Rank, squad review, decisions and history"
          right={<Chevron />}
          onPress={onOpenSeason}
        />
        <Divider />
        <Item
          title="My career"
          strong
          detail="Every FPL season you've played: points, ranks and best finishes"
          right={<Chevron />}
          onPress={onOpenCareer}
        />
        <Divider />
        <Item
          title="Following"
          strong
          detail="Managers you follow and their latest scores"
          right={<Chevron />}
          onPress={onOpenFollowing}
        />
        <Divider />
        <Item
          title="Fixture planner"
          strong
          detail="Every club's upcoming fixtures and difficulty"
          right={<Chevron />}
          onPress={onOpenPlanner}
        />
      </Group>

      <NotificationsSection
        settings={notifSettings}
        permission={notifPermission}
        onToggle={onToggleNotification}
        onOpenSettings={onOpenSettings}
      />

      <Heading>Support</Heading>
      <Group>
        {!!SUPPORT_EMAIL && (
          <>
            <Item
              title="Send feedback"
              detail="Report a problem or suggest an idea"
              right={<Chevron />}
              onPress={sendFeedback}
            />
            <Divider />
          </>
        )}
        <Item title="Privacy policy" right={<Chevron />} onPress={onOpenPrivacy} />
        <Divider />
        <Item title="Terms and conditions" right={<Chevron />} onPress={onOpenTerms} />
      </Group>

      <Heading>About</Heading>
      <Group>
        <Item title="Version" right={<Text style={{ color: MUTED, fontSize: 14 }}>{version}</Text>} />
      </Group>
      <Text style={{ color: MUTED, fontSize: 11.5, lineHeight: 16, marginTop: 8, marginLeft: 2 }}>
        Skippr is not affiliated with the Premier League.
      </Text>

      <View style={{ marginTop: 28 }}>
        <Group>
          <Item title="Log out" color={DANGER} onPress={onLogout} accessibilityLabel="Log out of your FPL account" />
        </Group>
      </View>
    </ScrollView>
  );
}
