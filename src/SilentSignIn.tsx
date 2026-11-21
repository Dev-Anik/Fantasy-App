// Signs in again out of sight with the login saved under Remember me.
//
// FPL ends a session from time to time (its renewal token stops working,
// typically after a day or so). With a remembered login there is no reason to
// show the sign-in page for that: the same official page EmailSignIn uses is
// loaded in a hidden WebView, filled in and submitted, while the team stays on
// screen. If anything needs the user (a wrong password, a verification step,
// no answer), `onFail` hands over to the normal sign-in screen.
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { isSignInRedirect } from "./auth";
import { ATTEMPT_TIMEOUT_MS, USER_AGENT, signInScript } from "./EmailSignIn";

export function SilentSignIn({
  email,
  password,
  begin,
  onRedirect,
  onFail,
}: {
  email: string;
  password: string;
  // Starts a sign-in and returns the official page's address.
  begin: () => string;
  onRedirect: (url: string) => void;
  // `rejected`: the page refused the saved details (a changed password).
  onFail: (rejected: boolean) => void;
}) {
  const [attempt] = useState(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return { id, url: begin(), script: signInScript(id, email, password) };
  });
  const done = useRef(false);
  const finish = (action: () => void) => {
    if (done.current) return;
    done.current = true;
    action();
  };

  useEffect(() => {
    const timer = setTimeout(() => finish(() => onFail(false)), ATTEMPT_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // One attempt per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRedirect = (url: string) => finish(() => onRedirect(url));

  return (
    // Full size but invisible and untouchable, as in EmailSignIn: the page
    // needs a real viewport to draw its form.
    <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0 }}>
      <WebView
        source={{ uri: attempt.url }}
        userAgent={USER_AGENT}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        injectedJavaScript={attempt.script}
        onMessage={(event) => {
          let message: { profplSignIn?: string; type?: string; message?: string } | null = null;
          try {
            message = JSON.parse(event.nativeEvent.data);
          } catch {
            return;
          }
          if (!message || message.profplSignIn !== attempt.id) return;
          if (message.type === "error") finish(() => onFail(!!message.message));
          else if (message.type === "needsUser" || message.type === "pageError") finish(() => onFail(false));
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (!isSignInRedirect(request.url)) return true;
          handleRedirect(request.url);
          return false;
        }}
        onLoadStart={(event) => {
          if (isSignInRedirect(event.nativeEvent.url)) handleRedirect(event.nativeEvent.url);
        }}
        onError={() => finish(() => onFail(false))}
        style={{ flex: 1 }}
      />
    </View>
  );
}
