// The privacy policy and the terms and conditions, readable in the app (from
// More, or before signing in). Both share this layout; their text lives in
// privacyText.ts and termsText.ts, which also build the web pages in docs/.
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSymbol } from "./AppSymbol";
import { ScreenBackground, THEME } from "./theme";
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from "./appInfo";
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_UPDATED } from "./privacyText";
import { TERMS_INTRO, TERMS_SECTIONS, TERMS_UPDATED } from "./termsText";

const INK = THEME.ink;
const SOFT = THEME.soft;
const MUTED = THEME.muted;

function LegalPage({
  title,
  updated,
  intro,
  sections,
  url,
  contactLabel,
  onBack,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: { title: string; body: string[] }[];
  url: string;
  contactLabel: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
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
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: insets.bottom + 40 }}>
        <Text accessibilityRole="header" style={{ color: INK, fontSize: 24, fontWeight: "700" }}>
          {title}
        </Text>
        <Text style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>{`Last updated ${updated}`}</Text>
        <Text style={{ color: SOFT, fontSize: 14.5, lineHeight: 22, marginTop: 16 }}>{intro}</Text>

        {sections.map((section) => (
          <View key={section.title} style={{ marginTop: 24 }}>
            <Text accessibilityRole="header" style={{ color: INK, fontSize: 16, fontWeight: "700", marginBottom: 6 }}>
              {section.title}
            </Text>
            {section.body.map((paragraph) => (
              <Text key={paragraph.slice(0, 40)} style={{ color: SOFT, fontSize: 14, lineHeight: 21, marginTop: 6 }}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}

        {(!!SUPPORT_EMAIL || !!url) && (
          <View style={{ marginTop: 24 }}>
            <Text accessibilityRole="header" style={{ color: INK, fontSize: 16, fontWeight: "700", marginBottom: 6 }}>
              Contact
            </Text>
            {!!SUPPORT_EMAIL && (
              <Text style={{ color: SOFT, fontSize: 14, lineHeight: 21, marginTop: 6 }}>
                {`${contactLabel}: `}
                <Text
                  accessibilityRole="link"
                  onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
                  style={{ color: INK, textDecorationLine: "underline" }}
                >
                  {SUPPORT_EMAIL}
                </Text>
              </Text>
            )}
            {!!url && (
              <Text style={{ color: SOFT, fontSize: 14, lineHeight: 21, marginTop: 6 }}>
                {"Online version: "}
                <Text
                  accessibilityRole="link"
                  onPress={() => Linking.openURL(url)}
                  style={{ color: INK, textDecorationLine: "underline" }}
                >
                  {url}
                </Text>
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  return (
    <LegalPage
      title="Privacy policy"
      updated={PRIVACY_UPDATED}
      intro={PRIVACY_INTRO}
      sections={PRIVACY_SECTIONS}
      url={PRIVACY_URL}
      contactLabel="Questions about this policy"
      onBack={onBack}
    />
  );
}

export function TermsAndConditions({ onBack }: { onBack: () => void }) {
  return (
    <LegalPage
      title="Terms and conditions"
      updated={TERMS_UPDATED}
      intro={TERMS_INTRO}
      sections={TERMS_SECTIONS}
      url={TERMS_URL}
      contactLabel="Questions about these terms"
      onBack={onBack}
    />
  );
}
