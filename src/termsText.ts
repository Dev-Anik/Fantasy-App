// Skippr's terms and conditions. Shown in the app (LegalPage.tsx) and published
// as a web page for the app stores: docs/terms.html carries the same text
// (node scripts/build-legal-pages.mjs). When this changes, rebuild that page
// and update the date below.

export const TERMS_UPDATED = "19 November 2026";

export const TERMS_INTRO =
  "These terms apply when you use Skippr, an independent app for managing your Fantasy Premier League (FPL) team. By using the app you agree to them. If you don't agree, please don't use the app.";

export const TERMS_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "An independent app",
    body: [
      "Skippr is not made, endorsed or supported by the Premier League or Fantasy Premier League. Premier League, Fantasy Premier League, FPL and club names belong to their owners and are used only to describe what the app works with.",
      "The game itself, your FPL account and its rules are run by the Premier League. Their own terms apply to your account and to everything you do in the game, including through Skippr.",
    ],
  },
  {
    title: "Your FPL account",
    body: [
      "You sign in with your own Premier League account, and you must only sign in with an account that is yours.",
      "When you confirm a change in Skippr (your lineup, captain, transfers, chips, or joining or creating a league), the app sends it to FPL on your behalf, just as if you had made it on the FPL website. Please check changes before you confirm them: once FPL accepts a change, Skippr can't undo it, and transfer costs (\"hits\") and chips follow FPL's rules.",
      "You are responsible for keeping your phone and your sign-in details secure. If you use \"Remember me\", anyone who can unlock your phone can open the app signed in.",
    ],
  },
  {
    title: "Information, estimates and insights",
    body: [
      "Scores, prices, fixtures, injury news and other figures come from FPL and can be delayed, incomplete or changed by FPL after they are shown.",
      "Some features show Skippr's own calculations, such as estimated points, captain options and chip readings. These are simple rules of thumb based on FPL data. They are not predictions you can rely on and not advice: every decision about your team is yours.",
    ],
  },
  {
    title: "Using the app fairly",
    body: [
      "Please don't use Skippr to break FPL's rules, to access accounts that aren't yours, to overload or interfere with FPL's services or ours, or to copy and resell the app or its content.",
    ],
  },
  {
    title: "Availability and changes",
    body: [
      "Skippr depends on FPL's services. If FPL is unavailable or changes how it works, parts of the app may stop working, temporarily or for good, and some actions may fail before a deadline. Please leave yourself time to make important changes, and use the FPL website or official app if Skippr can't complete one.",
      "We may update, change or stop offering the app or any feature at any time.",
    ],
  },
  {
    title: "No guarantees",
    body: [
      "Skippr is provided \"as is\", free of charge, without any promise that it will always be available, accurate or free of errors.",
      "As far as the law allows, we are not responsible for any loss arising from your use of the app, including lost points, ranks, prizes, leagues or missed deadlines. Nothing in these terms limits rights you have under the law that can't be limited.",
    ],
  },
  {
    title: "Ending your use",
    body: [
      "You can stop using Skippr at any time: log out, and uninstall the app to remove everything it stored on your device. Your FPL account is not affected.",
    ],
  },
  {
    title: "Changes to these terms",
    body: [
      "If these terms change, the new version will be shown in the app and on this page with a new date. Using the app after a change means you accept the new terms.",
    ],
  },
];
