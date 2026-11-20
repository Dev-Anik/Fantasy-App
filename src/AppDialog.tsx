import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { AppSymbol } from "./AppSymbol";
import { THEME } from "./theme";
import type { SymbolViewProps } from "expo-symbols";

export type DialogButton = {
  text: string;
  style?: "cancel" | "destructive";
  onPress?: () => void;
};

export type DialogKind = "success" | "warning" | "danger" | "confirm";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  buttons: DialogButton[];
  kind?: DialogKind;
  // Extra content under the message, e.g. substitution rows.
  content?: ReactNode;
  onDismiss: () => void;
};

const GREEN = THEME.accent;
const AMBER = "#f2c14e";
const RED = THEME.bad;

// A small icon beside the title marks the outcome; plain questions have none.
const KIND_ICONS: Partial<Record<DialogKind, { icon: SymbolViewProps["name"]; color: string }>> = {
  success: {
    icon: { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" },
    color: GREEN,
  },
  warning: {
    icon: { ios: "exclamationmark.triangle.fill", android: "warning", web: "warning" },
    color: AMBER,
  },
  danger: {
    icon: { ios: "exclamationmark.circle.fill", android: "error", web: "error" },
    color: RED,
  },
};

const IN_COLOR = THEME.good;
const OUT_COLOR = THEME.bad;

// One substitution: the player coming in (green, up arrow), a swap icon,
// then the player going out (red, down arrow). Either side may be missing.
export function SubstitutionRow({ inName, outName }: { inName?: string; outName?: string }) {
  const side = (name: string, coming: boolean) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 1 }}>
      <AppSymbol
        name={
          coming
            ? { ios: "arrow.up", android: "arrow_upward", web: "arrow_upward" }
            : { ios: "arrow.down", android: "arrow_downward", web: "arrow_downward" }
        }
        color={coming ? IN_COLOR : OUT_COLOR}
        size={13}
      />
      <Text
        numberOfLines={1}
        style={{ flexShrink: 1, color: coming ? IN_COLOR : OUT_COLOR, fontSize: 14, fontWeight: "800" }}
      >
        {name}
      </Text>
    </View>
  );
  return (
    <View
      accessible
      accessibilityLabel={[inName && `${inName} in`, outName && `${outName} out`].filter(Boolean).join(", ")}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 }}
    >
      {!!inName && side(inName, true)}
      {!!inName && !!outName && (
        <AppSymbol
          name={{ ios: "arrow.left.arrow.right", android: "swap_horiz", web: "swap_horiz" }}
          color={THEME.muted}
          size={15}
        />
      )}
      {!!outName && side(outName, false)}
    </View>
  );
}

// A calm, centred dialog in the app's navy: an icon in a soft circle (for
// outcomes and warnings), the title, a short message, then full-width pill
// buttons. Cancel is outlined; the main action is filled (soft red when it
// is destructive). Three or more buttons stack.
export function AppDialog({
  visible,
  title,
  message,
  buttons,
  kind = "confirm",
  content,
  onDismiss,
}: Props) {
  const marker = KIND_ICONS[kind];
  const stacked = buttons.length > 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 28,
          backgroundColor: "rgba(3, 5, 12, 0.72)",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          onPress={onDismiss}
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 330,
            paddingTop: marker ? 22 : 24,
            paddingHorizontal: 22,
            paddingBottom: 18,
            borderRadius: 22,
            alignItems: "center",
            backgroundColor: THEME.surfaceRaised,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
            elevation: 18,
            shadowColor: "#000",
            shadowOpacity: 0.45,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
          }}
        >
          {marker && (
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
                backgroundColor: `${marker.color}1f`,
                borderWidth: 1,
                borderColor: `${marker.color}40`,
              }}
            >
              <AppSymbol name={marker.icon} color={marker.color} size={22} />
            </View>
          )}

          <Text
            accessibilityRole="header"
            style={{
              color: THEME.ink,
              fontSize: 17,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {title}
          </Text>

          {!!message && (
            <Text
              style={{
                color: THEME.soft,
                fontSize: 14,
                lineHeight: 20,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              {message}
            </Text>
          )}

          {!!content && <View style={{ marginTop: 12, alignSelf: "stretch", alignItems: "center" }}>{content}</View>}

          <View
            style={{
              alignSelf: "stretch",
              flexDirection: stacked ? "column" : "row",
              gap: 10,
              marginTop: 22,
            }}
          >
            {buttons.map((button, index) => {
              const isCancel =
                button.style === "cancel" ||
                (index === 0 && buttons.length > 1 && !button.style);
              const isDestructive = button.style === "destructive";
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  accessibilityRole="button"
                  onPress={() => {
                    onDismiss();
                    button.onPress?.();
                  }}
                  style={({ pressed }) => ({
                    flex: stacked ? undefined : 1,
                    height: 46,
                    paddingHorizontal: 14,
                    borderRadius: 23,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isCancel
                      ? pressed
                        ? "rgba(255, 255, 255, 0.07)"
                        : "transparent"
                      : isDestructive
                        ? "rgba(255, 107, 125, 0.16)"
                        : GREEN,
                    borderWidth: isCancel || isDestructive ? 1 : 0,
                    borderColor: isDestructive ? "rgba(255, 107, 125, 0.5)" : "rgba(255, 255, 255, 0.16)",
                    opacity: !isCancel && pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: isCancel ? THEME.ink : isDestructive ? RED : THEME.onAccent,
                      fontSize: 14.5,
                      fontWeight: isCancel ? "600" : "700",
                    }}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
