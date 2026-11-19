// The "More" tab: the manager's account, My season, notifications and app
// details. Plain settings-style lists, matching the My season page.
import { Linking, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import * as Device from "expo-device";
import type { ReactNode } from "react";
import { AppSymbol } from "./AppSymbol";
import type { NotificationSettings, PermissionState } from "./notifications";
import { SUPPORT_EMAIL } from "./appInfo";
import { THEME } from "./theme";

const SURFACE = THEME.surface;
const LINE = THEME.line;
const INK = THEME.ink;
const MUTED = THEME.muted;
const SOFT = THEME.soft;
// Switches: green when on, like the rest of the accents.
const GOOD = THEME.accent;
const DANGER = THEME.bad;

const NOTIFICATIONS: { key: keyof NotificationSettings; title: string; detail: string }[] = [
  { key: "deadline24h", title: "24 hours before the deadline", detail: "Time to plan transfers" },
  { key: "deadline1h", title: "1 hour before the deadline", detail: "A last reminder, naming any flagged starters" },
  { key: "news", title: "Squad news", detail: "Injuries, suspensions and returns for your players" },
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
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("ProFPL feedback")}&body=${encodeURIComponent(body)}`,
    ).catch(() => {});
  };

  return (
    <ScrollView
      style={{ flex: 1, width: "100%" }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Account */}
      <View
        accessible
        accessibilityLabel={`${teamName}, managed by ${managerName}, team ID ${entry}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
      >
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
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: INK, fontSize: 19, fontWeight: "700" }}>
            {teamName}
          </Text>
          <Text numberOfLines={1} style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>
            {`${managerName} · ID ${entry}`}
          </Text>
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
              detail="Allow them for ProFPL in your phone's settings."
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
        ProFPL is not affiliated with the Premier League.
      </Text>

      <View style={{ marginTop: 28 }}>
        <Group>
          <Item title="Log out" color={DANGER} onPress={onLogout} accessibilityLabel="Log out of your FPL account" />
        </Group>
      </View>
    </ScrollView>
  );
}
