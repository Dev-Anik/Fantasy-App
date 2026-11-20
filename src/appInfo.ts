// Contact and policy details shown in the app. Fill these in before
// publishing; rows that need them stay hidden while they are empty.
import Constants from "expo-constants";

// Where "Send feedback" writes to. A dedicated support address is best.
export const SUPPORT_EMAIL = "";

// The published privacy policy (docs/privacy.html, e.g. on GitHub Pages).
// The same text is always readable inside the app.
export const PRIVACY_URL = "";

// The published terms and conditions (docs/terms.html). Also readable in the app.
export const TERMS_URL = "";

export const APP_VERSION = Constants.expoConfig?.version ?? "";
