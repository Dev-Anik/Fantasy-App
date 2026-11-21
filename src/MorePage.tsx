// The "More" tab: the manager's account, My season, notifications and app
// details. Plain settings-style lists, matching the My season page.
import { Linking, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import * as Device from "expo-device";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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
      style={{
        color: THEME.accent,
        fontSize: 11.5,
        fontWeight: "500",
        letterSpacing: 2,
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

function Divider() {
  return <View style={{ height: 1, marginLeft: 16, backgroundColor: LINE }} />;
}

// One line of a list: a title, an optional line under it, and something on
// the right (a chevron, a switch or a value).
function Item({
  title,
  detail,
  right,
  onPress,
  color = INK,
  accessibilityLabel,
}: {
  title: string;
  detail?: string;
  right?: ReactNode;
  onPress?: () => void;
  color?: string;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ color, fontSize: 15, fontWeight: "500" }}>{title}</Text>
        {!!detail && <Text style={{ color: MUTED, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{detail}</Text>}
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
          detail="Captain options and chip readings for this gameweek"
          right={<Chevron />}
          onPress={onOpenHelper}
        />
        <Divider />
        <Item
          title="Matches"
          detail="Live scores, results and kick-off times"
          right={<Chevron />}
          onPress={onOpenMatches}
        />
        <Divider />
        <Item
          title="My season"
          detail="Rank, squad review, decisions and history"
          right={<Chevron />}
          onPress={onOpenSeason}
        />
        <Divider />
        <Item
          title="Fixture planner"
          detail="Every club's upcoming fixtures and difficulty"
          right={<Chevron />}
          onPress={onOpenPlanner}
        />
      </Group>

      <Heading>Notifications</Heading>
      <Group>
        {notifPermission === "denied" && (
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
        {NOTIFICATIONS.map((row, index) => {
          const on = notifSettings[row.key] && notifPermission === "granted";
          return (
            <View key={row.key}>
              {index > 0 && <Divider />}
              <Item
                title={row.title}
                detail={row.detail}
                right={
                  <Switch
                    value={on}
                    onValueChange={() => onToggleNotification(row.key)}
                    accessibilityLabel={row.title}
                    trackColor={{ false: "rgba(255, 255, 255, 0.16)", true: GOOD }}
                    thumbColor="#ffffff"
                    ios_backgroundColor="rgba(255, 255, 255, 0.16)"
                  />
                }
              />
            </View>
          );
        })}
      </Group>

      {liveAlertsAvailable && (
        <>
          <Heading>Live match alerts</Heading>
          <Group>
            {LIVE_ALERTS.map((row, index) => {
              const on = notifSettings[row.key] && notifPermission === "granted";
              return (
                <View key={row.key}>
                  {index > 0 && <Divider />}
                  <Item
                    title={row.title}
                    detail={row.detail}
                    right={
                      <Switch
                        value={on}
                        onValueChange={() => onToggleNotification(row.key)}
                        accessibilityLabel={row.title}
                        trackColor={{ false: "rgba(255, 255, 255, 0.16)", true: GOOD }}
                        thumbColor="#ffffff"
                        ios_backgroundColor="rgba(255, 255, 255, 0.16)"
                      />
                    }
                  />
                </View>
              );
            })}
          </Group>
          <Text style={{ color: MUTED, fontSize: 11.5, lineHeight: 16, marginTop: 6, marginLeft: 2 }}>
            Sent while matches are played, a minute or two after FPL updates.
          </Text>
        </>
      )}

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
