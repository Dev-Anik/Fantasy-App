import { Modal, Pressable, Text, View } from "react-native";

export type DialogButton = {
  text: string;
  style?: "cancel" | "destructive";
  onPress?: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  message: string;
  buttons: DialogButton[];
  onDismiss: () => void;
};

const GREEN = "#00d982";

export function AppDialog({
  visible,
  title,
  message,
  buttons,
  onDismiss,
}: Props) {
  const isWarning =
    title.toLowerCase().includes("can't") ||
    title.toLowerCase().includes("remove") ||
    title.toLowerCase().includes("discard") ||
    title.toLowerCase().includes("sure") ||
    title.toLowerCase().includes("delete") ||
    title.toLowerCase().includes("could not") ||
    title.toLowerCase().includes("undo");

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
          padding: 16,
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
            maxWidth: 240,
            padding: 14,
            borderRadius: 16,
            backgroundColor: "#11261d",
            borderWidth: 1.5,
            borderColor: "rgba(0, 217, 130, 0.25)",
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
              top: 8,
              right: 8,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#b0c4b8", fontSize: 11, fontWeight: "900", includeFontPadding: false }}>✕</Text>
          </Pressable>

          {/* Top Icon Circle */}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(0, 217, 130, 0.12)",
              borderWidth: 1.5,
              borderColor: "rgba(0, 217, 130, 0.45)",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 2,
              marginBottom: 10,
              shadowColor: GREEN,
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 16, includeFontPadding: false }}>{isWarning ? "⚠️" : "🗑️"}</Text>
          </View>

          {/* Title */}
          <Text
            style={{
              color: "#ffffff",
              fontSize: 15,
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
              color: "#9db3a6",
              fontSize: 11,
              lineHeight: 15,
              textAlign: "center",
              marginTop: 4,
              marginBottom: 14,
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
              gap: 8,
            }}
          >
            {buttons.map((button, index) => {
              const isCancel = button.style === "cancel" || index === 0;
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
                    minHeight: 34,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isCancel ? "#1a3325" : GREEN,
                    borderWidth: isCancel ? 1 : 0,
                    borderColor: isCancel ? "rgba(255, 255, 255, 0.15)" : "transparent",
                    shadowColor: isCancel ? "transparent" : GREEN,
                    shadowOpacity: isCancel ? 0 : 0.25,
                    shadowRadius: 4,
                    elevation: isCancel ? 0 : 2,
                  }}
                >
                  <Text
                    style={{
                      color: isCancel ? "#ffffff" : "#051a0f",
                      fontSize: 12,
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
