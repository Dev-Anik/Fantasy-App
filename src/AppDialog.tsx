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

const PURPLE = "#37003c";
const GREEN = "#00d982";

export function AppDialog({
  visible,
  title,
  message,
  buttons,
  onDismiss,
}: Props) {
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
          backgroundColor: "rgba(19, 12, 24, 0.62)",
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
            maxWidth: 420,
            padding: 22,
            borderRadius: 24,
            backgroundColor: "#fff",
            elevation: 18,
            shadowColor: "#150b19",
            shadowOpacity: 0.22,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
          }}
        >
          <View
            style={{
              width: 42,
              height: 5,
              borderRadius: 3,
              backgroundColor: GREEN,
              marginBottom: 18,
            }}
          />
          <Text
            style={{
              color: PURPLE,
              fontSize: 20,
              fontWeight: "800",
              letterSpacing: -0.3,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: "#5e5662",
              fontSize: 15,
              lineHeight: 22,
              marginTop: 10,
            }}
          >
            {message}
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              marginTop: 24,
            }}
          >
            {buttons.map((button, index) => {
              const primary =
                button.style !== "cancel" &&
                (index === buttons.length - 1 || buttons.length === 1);
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  accessibilityRole="button"
                  onPress={() => {
                    onDismiss();
                    button.onPress?.();
                  }}
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    paddingHorizontal: 16,
                    borderRadius: 16,
                    marginLeft: 8,
                    backgroundColor: primary
                      ? button.style === "destructive"
                        ? "#b3261e"
                        : PURPLE
                      : "#f1edf3",
                  }}
                >
                  <Text
                    style={{
                      color: primary ? "#fff" : PURPLE,
                      fontSize: 14,
                      fontWeight: "800",
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
