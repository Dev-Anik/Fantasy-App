// Skippr's privacy policy text. Shown in the app (LegalPage.tsx) and published
// as a web page for the app stores: docs/privacy.html carries the same text
// (node scripts/build-legal-pages.mjs). When this changes, rebuild that page
// and update the date below.

export const PRIVACY_UPDATED = "20 November 2026";

export const PRIVACY_INTRO =
  "Skippr is an independent app for managing your Fantasy Premier League (FPL) team. It is not affiliated with or endorsed by the Premier League. This policy explains what information the app handles and where it goes. In short: Skippr shows no ads, uses no analytics or tracking, and does not sell or share your data. Its only server sends live match alerts, and keeps just what that needs.";

export const PRIVACY_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Signing in",
    body: [
      "You sign in with your Premier League account. If you type your email and password into Skippr, the app passes them to the Premier League's official sign-in page on your behalf, over a secure connection. You can also sign in on that page directly, including with Google, Apple, Facebook or X.",
      "Skippr never sends your password anywhere except the Premier League's sign-in page. If you leave \"Remember me\" on (it is on by default), your email and password are saved on your device only, in its encrypted secure storage (the iOS Keychain or Android Keystore), so the app can sign you in again by itself. Untick \"Remember me\" when signing in and they are not saved, and any saved before are removed. After you sign in, the Premier League gives the app a sign-in token, which is kept in your device's secure storage (the iOS Keychain or Android Keystore) so you stay signed in until you log out.",
      "To save you typing, the app remembers the last email address used to sign in, on your device only.",
    ],
  },
  {
    title: "Your FPL data",
    body: [
      "The app reads your team, transfers, leagues, points and history from FPL, and sends the changes you confirm (lineup, captain, transfers, chips, joining or creating leagues) to FPL. This data goes only between your device and the Premier League's servers.",
      "A copy of your team is kept on your device so the app opens quickly and works offline. It is deleted when you log out.",
    ],
  },
  {
    title: "Notifications",
    body: [
      "Deadline reminders and squad news alerts are created on your device. To check for injury and suspension news, the app occasionally reads public player data from FPL in the background. You can turn each type off in More, or turn notifications off in your phone's settings.",
      "Live match alerts (your players starting, scoring, getting booked, and full-time scores) come from Skippr's server. For them, the app sends the server only your FPL team ID, your phone's push notification token (an anonymous address for notifications, from Expo, Google or Apple) and which live alerts you want. The server reads your team's public picks from FPL with the team ID. It never receives your password, email, name or FPL sign-in. The alerts are delivered through Expo's push service and Google's or Apple's notification services. The server is hosted by Supabase in the European Union.",
    ],
  },
  {
    title: "What Skippr does not do",
    body: [
      "No advertising, analytics, crash reporting or tracking of any kind.",
      "No accounts of our own. The only thing our server keeps is what live match alerts need (above): no password, email or name.",
      "No selling, renting or sharing of your information with anyone.",
    ],
  },
  {
    title: "Third parties",
    body: [
      "Your data is handled by the Premier League when the app talks to FPL, under the Premier League's own privacy policy and terms (premierleague.com). If you sign in with Google, Apple, Facebook or X, that provider's policy also applies. Live match alerts use Supabase (hosting), Expo (push delivery) and Google or Apple (notifications).",
    ],
  },
  {
    title: "Deleting your data",
    body: [
      "Logging out removes your sign-in token, your saved team and scheduled notifications from the device. A login saved with \"Remember me\" stays on the device to fill in the sign-in form, but is no longer used to sign in by itself; to remove it, sign in once with \"Remember me\" unticked, or uninstall the app. Logging out, or turning off every live alert, also removes your phone from the live alerts server, along with your team ID. Uninstalling the app removes everything it stored on the device; the server forgets a phone once the app is gone. Your FPL account itself is managed by the Premier League: to change or delete it, use the Premier League's website.",
    ],
  },
  {
    title: "Children",
    body: [
      "Skippr is not directed at children under 13, and FPL requires players to meet its own minimum age.",
    ],
  },
  {
    title: "Changes",
    body: [
      "If this policy changes, the new version will be shown in the app and on this page, with a new date.",
    ],
  },
];
