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
  onDismiss: () => void;
};

const GREEN = "#00d982";
const AMBER = "#ffb020";
const RED = "#ef4444";
const NEUTRAL = "#cfead9";

const KIND_STYLES: Record<
  DialogKind,
  { icon: SymbolViewProps["name"]; color: string }
> = {
  success: {
    icon: { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" },
    color: GREEN,
  },
  warning: {
    icon: { ios: "exclamationmark.triangle.fill", android: "warning", web: "warning" },
    color: AMBER,
  },
  danger: {
    icon: { ios: "exclamationmark.octagon.fill", android: "error", web: "error" },
    color: RED,
  },
  confirm: {
    icon: { ios: "questionmark.circle.fill", android: "help", web: "help" },
    color: NEUTRAL,
  },
};

export function AppDialog({
  visible,
  title,
  message,
  buttons,
  kind = "confirm",
  onDismiss,
}: Props) {
  const { icon, color } = KIND_STYLES[kind];

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
          padding: 20,
          backgroundColor: "rgba(5, 18, 11, 0.75)",
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
            maxWidth: 320,
            padding: 20,
            borderRadius: 20,
            backgroundColor: "#11261d",
            borderWidth: 1.5,
            borderColor: "rgba(255, 255, 255, 0.1)",
            alignItems: "center",
            elevation: 20,
            shadowColor: "#000",
            shadowOpacity: 0.4,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          {/* Close X Button in top right */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close dialog"
            onPress={onDismiss}
            hitSlop={8}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppSymbol
              name={{ ios: "xmark", android: "close", web: "close" }}
              color="#b0c4b8"
              size={13}
            />
          </Pressable>

          {/* Top Icon Circle */}
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: `${color}1f`,
              borderWidth: 1.5,
              borderColor: `${color}73`,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 4,
              marginBottom: 14,
              shadowColor: color,
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <AppSymbol name={icon} color={color} size={22} />
          </View>

          {/* Title */}
          <Text
            style={{
              color: "#ffffff",
              fontSize: 17,
              fontWeight: "900",
              textAlign: "center",
              letterSpacing: -0.2,
            }}
          >
            {title}
          </Text>

          {/* Message */}
          <Text
            style={{
              color: "#a9beb3",
              fontSize: 13,
              lineHeight: 19,
              textAlign: "center",
              marginTop: 6,
              marginBottom: 18,
              paddingHorizontal: 2,
            }}
          >
            {message}
          </Text>

          {/* Buttons Row */}
          <View
            style={{
              flexDirection: "row",
              width: "100%",
              gap: 10,
            }}
          >
            {buttons.map((button, index) => {
              const isCancel = button.style === "cancel" || (index === 0 && buttons.length > 1 && !button.style);
              const isDestructive = button.style === "destructive";
              const backgroundColor = isDestructive ? RED : isCancel ? "#1a3325" : GREEN;
              const textColor = isDestructive ? "#ffffff" : isCancel ? "#ffffff" : "#051a0f";
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  accessibilityRole="button"
                  onPress={() => {
                    onDismiss();
                    button.onPress?.();
                  }}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor,
                    borderWidth: isCancel ? 1 : 0,
                    borderColor: isCancel ? "rgba(255, 255, 255, 0.15)" : "transparent",
                    shadowColor: isCancel ? "transparent" : backgroundColor,
                    shadowOpacity: isCancel ? 0 : 0.25,
                    shadowRadius: 4,
                    elevation: isCancel ? 0 : 2,
                  }}
                >
                  <Text
                    style={{
                      color: textColor,
                      fontSize: 13,
                      fontWeight: "900",
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
