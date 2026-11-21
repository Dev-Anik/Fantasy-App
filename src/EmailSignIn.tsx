// Sign in with an email address and password, in the app's own form.
//
// FPL accounts sign in on the Premier League account page (OpenID Connect).
// To keep that official, secure flow while letting the user type into the
// app, the page is loaded out of sight in a WebView: the app fills in the
// email and password, presses its Sign In button and reads any error it
// shows. Success ends in the usual redirect with a sign-in code, which the
// parent swaps for tokens. If the page asks for anything else (a
// verification step, say), it is shown so the user can finish there.
//
// The password is never logged. With "Remember me" on (the default) it is
// saved, after the Premier League accepts it, in the device's encrypted
// storage only (see rememberedLogin.ts), and used to sign in again by itself.
import { useEffect, useRef, useState } from "react";
import type { ComponentRef, ReactNode, Ref } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import type { TextInputProps } from "react-native";
import type { SymbolViewProps } from "expo-symbols";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppSymbol } from "./AppSymbol";
import { isSignInRedirect } from "./auth";
import { userMessage } from "./errors";
import { THEME } from "./theme";
import {
  forgetRememberedLogin,
  loadRememberedLogin,
  pauseAutoSignIn,
  saveRememberedLogin,
} from "./rememberedLogin";

type TextInputRef = ComponentRef<typeof TextInput>;

// Accent (green) and the dark ink on it.
const GREEN = THEME.accent;
const INK = THEME.onAccent;
const MUTED = THEME.muted;
const FIELD = "rgba(255, 255, 255, 0.06)";
const EDGE = "rgba(255, 255, 255, 0.12)";
const RED = "#ff6b81";
const STORAGE_EMAIL = "profpl_last_email";
// The page usually answers within a few seconds; give slow networks room.
export const ATTEMPT_TIMEOUT_MS = 40_000;
export const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

type Phase = "idle" | "working" | "finish";

// Runs in the sign-in page: fills the form once it is drawn, submits it, then
// reports an error, or that the page wants something from the user.
export function signInScript(attempt: string, email: string, password: string) {
  return `
(function () {
  if (window.__profplSignIn) return;
  window.__profplSignIn = true;
  var A = ${JSON.stringify(attempt)};
  var EMAIL = ${JSON.stringify(email)};
  var PASSWORD = ${JSON.stringify(password)};
  var KEY = "profplSubmitted";
  function post(type, message) {
    try {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ profplSignIn: A, type: type, message: message || "" })
      );
    } catch (e) {}
  }
  function shown(el) {
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }
  // The form is drawn by a script that listens for typing, so set values the
  // way typing does.
  function type(el, value) {
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, value);
    ["input", "change", "blur"].forEach(function (name) {
      el.dispatchEvent(new Event(name, { bubbles: true }));
    });
  }
  var submitted = false;
  try { submitted = sessionStorage.getItem(KEY) === A; } catch (e) {}
  var since = Date.now();
  var timer = setInterval(function () {
    // The account service's own error page (e.g. "INVALID_REQUEST ...
    // parameter name is 'nonce'"): a broken sign-in session on its side.
    // Report it, so the app starts a fresh attempt instead of showing it.
    var body = document.body ? document.body.innerText || "" : "";
    if (/\\bINVALID_[A-Z_]+\\b/.test(body) && !shown(document.getElementById("username"))) {
      clearInterval(timer);
      post("pageError", body.slice(0, 300));
      return;
    }
    var error = document.querySelector(".ping-sso__error");
    var user = document.getElementById("username");
    var pass = document.getElementById("password");
    var button = document.getElementById("btnSignIn");
    var formShown = shown(user);
    if (submitted && shown(error) && error.textContent.trim()) {
      clearInterval(timer);
      post("error", error.textContent.trim());
      return;
    }
    if (!submitted && formShown && pass && button) {
      type(user, EMAIL);
      type(pass, PASSWORD);
      submitted = true;
      try { sessionStorage.setItem(KEY, A); } catch (e) {}
      since = Date.now();
      button.click();
      return;
    }
    var waited = Date.now() - since;
    // Signed in pages redirect away, which the app catches. Anything else
    // left on screen after the form has gone needs the user: but only a page
    // that has finished loading and stayed a while, so a slow redirect isn't
    // mistaken for one.
    if (submitted && !formShown && waited > 10000 && document.readyState === "complete") {
      clearInterval(timer);
      post("needsUser");
    } else if (submitted && formShown && waited > 20000) {
      clearInterval(timer);
      post("error", "");
    } else if (!submitted && waited > 15000) {
      // The form never appeared (the page may have changed): let the user
      // sign in on it directly.
      clearInterval(timer);
      post("needsUser");
    }
  }, 250);
})();
true;
`;
}

// The page's own wording, made friendlier where we know it.
function friendlyError(message: string) {
  if (!message) return "Couldn't sign you in. Please try again.";
  message = userMessage(message, "Couldn't sign you in. Please try again.");
  if (/invalid\s+username|password/i.test(message)) {
    return "That email or password is incorrect.";
  }
  return message;
}

function Field({
  icon,
  label,
  right,
  inputRef,
  ...input
}: TextInputProps & {
  icon: SymbolViewProps["name"];
  label: string;
  right?: ReactNode;
  inputRef?: Ref<TextInputRef>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: MUTED, fontSize: 11, fontWeight: "700", marginBottom: 5, marginLeft: 2 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 46,
          paddingHorizontal: 12,
          borderRadius: 12,
          backgroundColor: FIELD,
          borderWidth: 1.5,
          borderColor: focused ? GREEN : EDGE,
          opacity: input.editable === false ? 0.6 : 1,
        }}
      >
        <AppSymbol name={icon} color={focused ? GREEN : MUTED} size={16} />
        <TextInput
          ref={inputRef}
          placeholderTextColor={THEME.muted}
          selectionColor={GREEN}
          cursorColor={GREEN}
          maxFontSizeMultiplier={1.3}
          {...input}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          style={{ flex: 1, color: "#ffffff", fontSize: 14.5, fontWeight: "600", marginLeft: 10, paddingVertical: 0 }}
        />
        {right}
      </View>
    </View>
  );
}

export function EmailSignIn({
  topInset,
  bottomInset,
  version,
  loading,
  error,
  squadLoadFailed,
  begin,
  onRedirect,
  onOtherMethods,
  onRetrySquad,
  onDismissSquadFailure,
  onBack,
  onOpenPrivacy,
  onOpenTerms,
}: {
  topInset: number;
  bottomInset: number;
  version: string;
  // Signed in, the team is loading (set by the parent).
  loading: boolean;
  // Errors from the parent: finishing the sign-in or loading the team.
  error: string;
  errorDetail?: string;
  squadLoadFailed: boolean;
  // Starts a sign-in and returns the official page's address.
  begin: () => string;
  // The page has redirected back with a sign-in code.
  onRedirect: (url: string) => void;
  // Google, Apple, Facebook, X or a forgotten password: the official page.
  onOtherMethods: () => void;
  onRetrySquad: () => void;
  onDismissSquadFailure: () => void;
  onBack: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [localError, setLocalError] = useState("");
  // The sign-in page for the attempt in progress (null: none loaded).
  const [attempt, setAttempt] = useState<{ id: string; url: string; script: string } | null>(null);
  const [remember, setRemember] = useState(true);
  const passwordRef = useRef<TextInputRef>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finished = useRef(false);
  // The details of the attempt in progress, saved once the page accepts them.
  const attemptLogin = useRef<{ email: string; password: string; remember: boolean; auto: boolean } | null>(null);
  const autoTried = useRef(false);
  // One automatic fresh start per sign-in after the service's error page.
  const pageRetried = useRef(false);


  const stopTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stopTimer, []);

  // `rejected`: the Premier League page itself refused the details.
  const endAttempt = (message?: string, rejected = false) => {
    stopTimer();
    setAttempt(null);
    setPhase("idle");
    if (message !== undefined) setLocalError(message);
    // An automatic sign-in the page refused (a changed password, say): don't
    // try again by itself, let the user check the details. A slow or dropped
    // connection is not a reason: Remember me keeps working next time.
    if (rejected && attemptLogin.current?.auto) pauseAutoSignIn();
  };

  const busy = phase !== "idle" || loading;
  const shownError = localError || error;

  // `saved`: an automatic sign-in with the remembered login.
  const submit = (saved?: { email: string; password: string; auto: boolean }) => {
    if (busy && !saved) return;
    const address = (saved?.email ?? email).trim();
    const secret = saved?.password ?? password;
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setLocalError("Enter the email address of your FPL account.");
      return;
    }
    if (!secret) {
      setLocalError("Enter your password.");
      passwordRef.current?.focus();
      return;
    }
    Keyboard.dismiss();
    setLocalError("");
    if (squadLoadFailed) onDismissSquadFailure();
    AsyncStorage.setItem(STORAGE_EMAIL, address).catch(() => {});
    pageRetried.current = false;
    restart({ email: address, password: secret, remember: saved ? true : remember, auto: !!saved });
  };

  // Loads the sign-in page afresh and fills it in with these details.
  const restart = (login: { email: string; password: string; remember: boolean; auto: boolean }) => {
    attemptLogin.current = login;
    finished.current = false;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setAttempt({ id, url: begin(), script: signInScript(id, login.email, login.password) });
    setPhase("working");
    stopTimer();
    timer.current = setTimeout(() => {
      endAttempt("Signing in is taking too long. Check your connection and try again.");
    }, ATTEMPT_TIMEOUT_MS);
  };

  // Fill in the saved login (or just the email used last time). If it was
  // saved with Remember me, sign in with it straight away.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadRememberedLogin();
      if (cancelled) return;
      if (saved) {
        setEmail(saved.email);
        setPassword(saved.password);
        if (saved.auto && !squadLoadFailed && !autoTried.current) {
          autoTried.current = true;
          submit({ email: saved.email, password: saved.password, auto: true });
        }
        return;
      }
      const lastEmail = await AsyncStorage.getItem(STORAGE_EMAIL).catch(() => null);
      if (!cancelled && lastEmail) setEmail((current) => current || lastEmail);
    })();
    return () => {
      cancelled = true;
    };
    // Runs once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRedirect = (url: string) => {
    if (finished.current) return;
    finished.current = true;
    // The Premier League accepted the details: remember them, or forget any
    // saved before if Remember me was switched off.
    const login = attemptLogin.current;
    if (login?.remember) saveRememberedLogin(login.email, login.password);
    else if (login) forgetRememberedLogin();
    endAttempt("");
    onRedirect(url);
  };

  const onMessage = (data: string) => {
    let message: { profplSignIn?: string; type?: string; message?: string } | null = null;
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }
    if (!message || !attempt || message.profplSignIn !== attempt.id) return;
    if (message.type === "pageError") {
      // The account service showed its own error page: start over once with
      // a fresh sign-in (same details), then give a plain message, never
      // that page.
      const login = attemptLogin.current;
      if (login && !pageRetried.current) {
        pageRetried.current = true;
        restart(login);
      } else {
        endAttempt("Couldn't sign you in just now. Please try again.");
      }
    } else if (message.type === "error") {
      // With text, the page showed an error (wrong details); without, it
      // just never answered.
      endAttempt(friendlyError(message.message ?? ""), !!message.message);
    } else if (message.type === "needsUser") {
      // Show the page so the user can finish there.
      stopTimer();
      setPhase("finish");
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 22,
            paddingTop: topInset + 10,
            paddingBottom: bottomInset + 18,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={onBack}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={{ alignSelf: "flex-start", padding: 4, marginLeft: -4, opacity: busy ? 0.4 : 1 }}
          >
            <AppSymbol
              name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
              color={THEME.soft}
              size={22}
            />
          </Pressable>

          <View style={{ marginTop: 18, marginBottom: 24 }}>
            <Text accessibilityRole="header" style={{ color: THEME.ink, fontSize: 24, fontWeight: "800" }}>
              Sign in
            </Text>
            <Text style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>Use your FPL account.</Text>
          </View>

          {!!shownError && (
            <View
              accessibilityLiveRegion="polite"
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 16,
                borderRadius: 12,
                backgroundColor: "rgba(255, 82, 111, 0.12)",
                borderWidth: 1,
                borderColor: "rgba(255, 82, 111, 0.35)",
              }}
            >
              <AppSymbol
                name={{ ios: "exclamationmark.circle.fill", android: "error", web: "error" }}
                color={RED}
                size={17}
              />
              <Text style={{ flex: 1, color: "#ffc2cc", fontSize: 13, fontWeight: "600", lineHeight: 18 }}>
                {shownError}

              </Text>
            </View>
          )}

          {squadLoadFailed && !busy ? (
            // Signed in, but the team didn't load: try loading it again.
            <>
              <Pressable
                onPress={onRetrySquad}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  height: 48,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: GREEN,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: INK, fontSize: 15, fontWeight: "800" }}>Try again</Text>
              </Pressable>
              <Pressable
                onPress={onDismissSquadFailure}
                accessibilityRole="button"
                hitSlop={8}
                style={{ alignSelf: "center", marginTop: 14 }}
              >
                <Text style={{ color: GREEN, fontSize: 14, fontWeight: "800" }}>
                  Sign in again instead
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Field
                icon={{ ios: "envelope.fill", android: "mail", web: "mail" }}
                label="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (localError) setLocalError("");
                }}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                importantForAutofill="yes"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!busy}
                accessibilityLabel="Email address"
              />
              <Field
                inputRef={passwordRef}
                icon={{ ios: "lock.fill", android: "lock", web: "lock" }}
                label="Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (localError) setLocalError("");
                }}
                placeholder="Your password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                importantForAutofill="yes"
                returnKeyType="go"
                onSubmitEditing={() => submit()}
                editable={!busy}
                accessibilityLabel="Password"
                right={
                  <Pressable
                    onPress={() => setShowPassword((shown) => !shown)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    hitSlop={10}
                    style={{ paddingLeft: 8 }}
                  >
                    <AppSymbol
                      name={
                        showPassword
                          ? { ios: "eye.slash", android: "visibility_off", web: "visibility_off" }
                          : { ios: "eye", android: "visibility", web: "visibility" }
                      }
                      color={MUTED}
                      size={19}
                    />
                  </Pressable>
                }
              />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: -2,
                  marginBottom: 18,
                }}
              >
                <Pressable
                  onPress={() => setRemember((on) => !on)}
                  disabled={busy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: remember, disabled: busy }}
                  accessibilityLabel="Remember me"
                  accessibilityHint="Saves your email and password on this device so the app can sign you in by itself"
                  hitSlop={8}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    opacity: busy ? 0.5 : pressed ? 0.7 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: remember ? GREEN : "transparent",
                      borderWidth: 1.5,
                      borderColor: remember ? GREEN : EDGE,
                    }}
                  >
                    {remember && (
                      <AppSymbol name={{ ios: "checkmark", android: "check", web: "check" }} color={INK} size={12} />
                    )}
                  </View>
                  <Text style={{ color: THEME.soft, fontSize: 12.5, fontWeight: "600" }}>Remember me</Text>
                </Pressable>

                <Pressable onPress={onOtherMethods} disabled={busy} accessibilityRole="link" hitSlop={8}>
                  <Text style={{ color: GREEN, fontSize: 12.5, fontWeight: "700" }}>Forgot password?</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => submit()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                accessibilityState={{ busy }}
                style={({ pressed }) => ({
                  height: 48,
                  borderRadius: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  backgroundColor: GREEN,
                  opacity: pressed ? 0.85 : busy ? 0.75 : 1,
                })}
              >
                {busy && <ActivityIndicator color={INK} size="small" />}
                <Text style={{ color: INK, fontSize: 15, fontWeight: "800" }}>
                  {loading ? "Loading your team…" : busy ? "Signing in…" : "Sign in"}
                </Text>
              </Pressable>

              {/* Google, Apple, Facebook or X: a quiet link, not a second form. */}
              <Pressable
                onPress={onOtherMethods}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Other ways to sign in: Google, Apple, Facebook or X"
                accessibilityHint="Opens the Premier League sign-in page"
                hitSlop={8}
                style={({ pressed }) => ({
                  alignSelf: "center",
                  marginTop: 18,
                  paddingVertical: 6,
                  opacity: busy ? 0.5 : pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ color: THEME.soft, fontSize: 13, fontWeight: "600" }}>Other sign-in options</Text>
              </Pressable>
            </>
          )}

          <View style={{ flex: 1, minHeight: 24 }} />
          {/* One small footer line. */}
          <View style={{ flexDirection: "row", alignSelf: "center", alignItems: "center", gap: 8 }}>
            <Pressable onPress={onOpenPrivacy} accessibilityRole="link" accessibilityLabel="Privacy policy" hitSlop={8}>
              <Text style={{ color: MUTED, fontSize: 11 }}>Privacy</Text>
            </Pressable>
            <Text style={{ color: "rgba(255, 255, 255, 0.25)", fontSize: 11 }}>·</Text>
            <Pressable onPress={onOpenTerms} accessibilityRole="link" accessibilityLabel="Terms and conditions" hitSlop={8}>
              <Text style={{ color: MUTED, fontSize: 11 }}>Terms</Text>
            </Pressable>
            <Text style={{ color: "rgba(255, 255, 255, 0.25)", fontSize: 11 }}>·</Text>
            <Text style={{ color: "rgba(255, 255, 255, 0.32)", fontSize: 11 }}>{`v${version}`}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* The official sign-in page: out of sight while the app fills it in,
          shown only if it asks the user for something more. */}
      {attempt && (
        <View
          pointerEvents={phase === "finish" ? "auto" : "none"}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            opacity: phase === "finish" ? 1 : 0,
            backgroundColor: THEME.bg,
            paddingTop: topInset,
          }}
        >
          <View
            style={{
              height: 52,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              gap: 12,
              borderBottomWidth: 1,
              borderBottomColor: EDGE,
            }}
          >
            <Pressable onPress={() => endAttempt("")} hitSlop={12} accessibilityRole="button">
              <Text style={{ color: GREEN, fontSize: 15, fontWeight: "800" }}>Cancel</Text>
            </Pressable>
            <Text numberOfLines={1} style={{ flex: 1, color: "#ffffff", fontSize: 15, fontWeight: "800" }}>
              Finish signing in
            </Text>
          </View>
          <WebView
            key={attempt.id}
            source={{ uri: attempt.url }}
            userAgent={USER_AGENT}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            injectedJavaScript={attempt.script}
            onMessage={(event) => onMessage(event.nativeEvent.data)}
            // Signing in ends with a redirect carrying the sign-in code.
            onShouldStartLoadWithRequest={(request) => {
              if (!isSignInRedirect(request.url)) return true;
              handleRedirect(request.url);
              return false;
            }}
            // Backstop for redirects the hook above is not consulted for.
            onLoadStart={(event) => {
              const { url } = event.nativeEvent;
              if (isSignInRedirect(url)) handleRedirect(url);
            }}
            onError={() =>
              endAttempt("Couldn't reach the Premier League. Check your connection and try again.")
            }
            style={{ flex: 1, backgroundColor: "#ffffff" }}
          />
        </View>
      )}
    </View>
  );
}
