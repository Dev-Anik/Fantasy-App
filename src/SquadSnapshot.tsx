// A picture of the squad to share: only the pitch and the Skippr logo.
//
// Shown over the screen: the squad is drawn again without any buttons or
// selection, captured, and shown as it will be saved. Nothing is saved until
// the user taps Save: on Android the phone's folder picker opens, on iPhone
// the system sheet (Save Image, Files and so on).
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  Text,
  useAnimatedValue,
  useWindowDimensions,
  View,
} from "react-native";
import type { HostInstance } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { Directory, File } from "expo-file-system";
import { AppSymbol } from "./AppSymbol";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Row } from "./fpl";
import { Pitch } from "./Pitch";
import { ScreenBackground, THEME, Wordmark } from "./theme";

// Long enough for the cards and avatars (already cached) to fade in.
const SETTLE_MS = 1500;

export const CHIP_NAMES: Record<string, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};

const money = (tenths: number) => `£${(tenths / 10).toFixed(1)}m`;

// A small figure under the logo: "BANK £1.5m".
function Tag({ label, value, accent = false }: { label?: string; value: string; accent?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 26,
        paddingHorizontal: 11,
        borderRadius: 13,
        backgroundColor: accent ? THEME.accentSoft : "rgba(11, 16, 32, 0.78)",
        borderWidth: 1,
        borderColor: accent ? THEME.accentLine : "rgba(255, 255, 255, 0.12)",
      }}
    >
      {accent && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.accent }} />}
      {!!label && (
        <Text style={{ color: THEME.muted, fontSize: 10, fontWeight: "600", letterSpacing: 1.2 }}>{label}</Text>
      )}
      <Text
        style={{
          color: accent ? THEME.accent : THEME.ink,
          fontSize: 12.5,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function SquadSnapshot({
  picks,
  selectedGw,
  showPrice,
  gameweekName,
  chip,
  bank,
  freeTransfers,
  points,
  onDone,
}: {
  picks: Row[];
  selectedGw?: number;
  // The transfer page's cards show prices; the others don't.
  showPrice: boolean;
  // Shown under the logo: the gameweek, the chip played (an FPL chip id),
  // the bank (transfers) and the points scored (points page).
  gameweekName: string;
  chip?: string | null;
  bank?: number | null;
  // Transfer page: free transfers left after the pending ones (null:
  // unlimited, with a Wildcard or Free Hit). Left out elsewhere.
  freeTransfers?: number | null;
  points?: number | null;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const shot = useRef<HostInstance>(null);
  const fade = useAnimatedValue(0);
  const [phase, setPhase] = useState<"preparing" | "ready" | "saving" | "saved">("preparing");
  const [imageUri, setImageUri] = useState<string | null>(null);
  // The folder the picture was saved to (Android), for the confirmation.
  const [savedTo, setSavedTo] = useState("");
  // Kept current, so callbacks below always call the latest one.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  // Make the picture once the squad has drawn, then wait for the user.
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!shot.current) return;
      captureRef(shot.current, { format: "png", quality: 1, result: "tmpfile" })
        .then((uri) => {
          if (cancelled) return;
          setImageUri(uri);
          setPhase("ready");
        })
        // Couldn't make the picture: just close, quietly.
        .catch(() => {
          if (!cancelled) done.current();
        });
    }, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fade]);

  const save = async () => {
    if (!imageUri || phase === "saving") return;
    setPhase("saving");
    try {
      if (Platform.OS === "android") {
        // The phone's own folder picker: the user chooses where it goes.
        const folder = await Directory.pickDirectoryAsync();
        const name = `Skippr ${gameweekName}`.replace(/[^\w\s-]/g, "").trim() + ".png";
        const file = folder.createFile(name, "image/png");
        await file.write(await new File(imageUri).bytes());
        setSavedTo(folder.name);
        setPhase("saved");
      } else {
        // iPhone: the system sheet, with Save Image, Files and the rest.
        await Sharing.shareAsync(imageUri, { mimeType: "image/png", UTI: "public.png" });
        setPhase("ready");
      }
    } catch {
      // Picker closed without choosing, or the save failed: try again.
      setPhase("ready");
    }
  };

  // The buttons' row; the picture takes all the height above it, so the
  // cards come out as large as the screen allows.
  const BAR = 64;
  const shotHeight = Math.max(320, height - insets.top - 4 - BAR - insets.bottom - 8);

  return (
    // A modal sits above everything, the tab bar included, on every phone.
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => done.current()}
    >
    <Animated.View
      accessibilityViewIsModal
      style={{
        flex: 1,
        opacity: fade,
        backgroundColor: THEME.bg,
        paddingTop: insets.top + 4,
        paddingBottom: insets.bottom + 8,
        alignItems: "center",
      }}
    >
      {/* Everything inside this view is the picture. */}
      <View
        ref={shot}
        collapsable={false}
        style={{ width, height: shotHeight, backgroundColor: THEME.bg, overflow: "hidden" }}
      >
        <ScreenBackground />
        {/* One compact row, so the pitch keeps as much height as it can. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 4,
          }}
        >
          <Wordmark size={21} weight="900" />
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 5 }}>
            <Tag value={gameweekName} />
            {points != null && <Tag label="PTS" value={String(points)} />}
            {bank != null && <Tag label="BANK" value={money(bank)} />}
            {freeTransfers !== undefined && (
              <Tag label="FT" value={freeTransfers === null ? "Unlimited" : `${freeTransfers} left`} />
            )}
            {!!chip && <Tag accent value={CHIP_NAMES[chip] ?? chip} />}
          </View>
        </View>
        <View pointerEvents="none" style={{ flex: 1, paddingBottom: 4 }}>
          <Pitch
            picks={picks}
            selectedGw={selectedGw}
            selectedPos={null}
            showPrice={showPrice}
            layoutId={showPrice ? "snapshot-transfers" : "snapshot"}
          />
        </View>
      </View>

      <View
        style={{
          width: "100%",
          height: BAR,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        {phase === "preparing" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator color={THEME.accent} size="small" />
            <Text style={{ color: THEME.soft, fontSize: 13, fontWeight: "500" }}>Preparing your squad picture…</Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => done.current()}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => ({
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.14)",
                backgroundColor: pressed ? THEME.surfaceRaised : THEME.surface,
              })}
            >
              <AppSymbol name={{ ios: "xmark", android: "close", web: "close" }} color={THEME.ink} size={18} />
            </Pressable>
            <Pressable
              onPress={phase === "saved" ? () => done.current() : save}
              disabled={phase === "saving"}
              accessibilityRole="button"
              accessibilityLabel={phase === "saved" ? `Saved to ${savedTo}. Done` : "Save picture"}
              style={({ pressed }) => ({
                flex: 1,
                maxWidth: 280,
                height: 48,
                borderRadius: 24,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: phase === "saved" ? THEME.surface : THEME.accent,
                borderWidth: phase === "saved" ? 1 : 0,
                borderColor: THEME.accentLine,
                opacity: pressed ? 0.85 : phase === "saving" ? 0.75 : 1,
              })}
            >
              {phase === "saving" ? (
                <ActivityIndicator color={THEME.onAccent} size="small" />
              ) : (
                <AppSymbol
                  name={
                    phase === "saved"
                      ? { ios: "checkmark", android: "check", web: "check" }
                      : { ios: "square.and.arrow.down", android: "download", web: "download" }
                  }
                  color={phase === "saved" ? THEME.accent : THEME.onAccent}
                  size={18}
                />
              )}
              <Text
                numberOfLines={1}
                style={{
                  flexShrink: 1,
                  color: phase === "saved" ? THEME.accent : THEME.onAccent,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                {phase === "saved" ? `Saved${savedTo ? ` to ${savedTo}` : ""}` : phase === "saving" ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </Animated.View>
    </Modal>
  );
}

// A camera drawn from plain shapes, so it sits exactly in the middle of its
// button (the icon fonts' camera glyphs are drawn off centre).
export function CameraIcon({ size = 18, color }: { size?: number; color: string }) {
  const line = Math.max(1.5, size * 0.1);
  const bodyHeight = Math.round(size * 0.68);
  const lens = Math.round(size * 0.36);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* the viewfinder bump; the body below covers its bottom edge */}
      <View
        style={{
          width: Math.round(size * 0.36),
          height: Math.round(size * 0.16),
          marginBottom: -1,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: size,
          height: bodyHeight,
          borderRadius: size * 0.16,
          borderWidth: line,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={{ width: lens, height: lens, borderRadius: lens / 2, borderWidth: line, borderColor: color }} />
      </View>
    </View>
  );
}
