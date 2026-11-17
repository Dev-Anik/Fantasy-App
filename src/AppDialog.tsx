import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { AppSymbol } from "./AppSymbol";
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

const GREEN = "#00d982";
const AMBER = "#ffb020";
const RED = "#ff5a5f";

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

const IN_COLOR = "#00d982";
const OUT_COLOR = "#ff6b7a";

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
          color="#6f877a"
          size={15}
        />
      )}
      {!!outName && side(outName, false)}
    </View>
  );
}

// A compact, left-aligned dialog: title, short message, and actions on the
// right. Cancel is a quiet text button; the main action is a solid button.
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
          padding: 24,
          backgroundColor: "rgba(2, 10, 6, 0.7)",
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
            maxWidth: 340,
            paddingTop: 20,
            paddingHorizontal: 20,
            paddingBottom: 14,
            borderRadius: 16,
            backgroundColor: "#0f1f17",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
            elevation: 16,
            shadowColor: "#000",
            shadowOpacity: 0.35,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {marker && <AppSymbol name={marker.icon} color={marker.color} size={18} />}
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                color: "#ffffff",
                fontSize: 16,
                fontWeight: "800",
                letterSpacing: -0.1,
              }}
            >
              {title}
            </Text>
          </View>

          {!!message && (
            <Text
              style={{
                color: "#a9beb3",
                fontSize: 13.5,
                lineHeight: 20,
                marginTop: 8,
              }}
            >
              {message}
            </Text>
          )}

          {!!content && <View style={{ marginTop: 10 }}>{content}</View>}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 6,
              marginTop: 18,
            }}
          >
            {buttons.map((button, index) => {
              const isCancel =
                button.style === "cancel" ||
                (index === 0 && buttons.length > 1 && !button.style);
              const isDestructive = button.style === "destructive";
              const solid = isDestructive ? RED : GREEN;
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  accessibilityRole="button"
                  onPress={() => {
                    onDismiss();
                    button.onPress?.();
                  }}
                  style={({ pressed }) => ({
                    minHeight: 38,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isCancel
                      ? pressed
                        ? "rgba(255, 255, 255, 0.08)"
                        : "transparent"
                      : solid,
                    opacity: !isCancel && pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: isCancel ? "#c7d8ce" : isDestructive ? "#ffffff" : "#04210f",
                      fontSize: 13.5,
                      fontWeight: isCancel ? "700" : "800",
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
