// "Remember me": the FPL email and password, kept only on this device in its
// encrypted storage (iOS Keychain / Android Keystore), so the app can sign
// back in by itself when the session runs out or the app is reopened.
//
// `auto` is switched off when the user logs out (so the app doesn't sign them
// straight back in) or when an automatic sign-in fails (so a changed password
// can't cause a loop). Signing in with Remember me on switches it back on.
import * as SecureStore from "expo-secure-store";

const KEY = "profpl_remembered_login";
const OPTIONS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export type RememberedLogin = { email: string; password: string; auto: boolean };

export async function loadRememberedLogin(): Promise<RememberedLogin | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.email !== "string" || typeof parsed?.password !== "string") return null;
    return { email: parsed.email, password: parsed.password, auto: parsed.auto !== false };
  } catch {
    return null;
  }
}

export async function saveRememberedLogin(email: string, password: string) {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify({ email, password, auto: true }), OPTIONS);
  } catch {}
}

// Keep the saved login for filling in the form, but don't sign in by itself.
export async function pauseAutoSignIn() {
  const saved = await loadRememberedLogin();
  if (!saved || !saved.auto) return;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify({ ...saved, auto: false }), OPTIONS);
  } catch {}
}

export async function forgetRememberedLogin() {
  try {
    await SecureStore.deleteItemAsync(KEY, OPTIONS);
  } catch {}
}
