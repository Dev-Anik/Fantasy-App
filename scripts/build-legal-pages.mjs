// Builds the web pages the app stores ask for, from the same text the app
// shows: docs/privacy.html (src/privacyText.ts) and docs/terms.html
// (src/termsText.ts).
//
// Run after changing either text or the support email:
//   node scripts/build-legal-pages.mjs
// Then publish the docs folder, e.g. with GitHub Pages (Settings > Pages >
// Deploy from branch > /docs), and put the pages' addresses in src/appInfo.ts.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Node runs the TypeScript files directly (their types are stripped).
const load = (file) => import(pathToFileURL(join(root, "src", file)).href);
const privacy = await load("privacyText.ts");
const terms = await load("termsText.ts");
const appInfo = readFileSync(join(root, "src", "appInfo.ts"), "utf8");
const email = appInfo.match(/SUPPORT_EMAIL = "([^"]*)"/)?.[1] ?? "";

const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function page({ title, updated, intro, sections, contactLabel }) {
  const body = sections
    .map(
      (section) =>
        `    <h2>${escape(section.title)}</h2>\n` +
        section.body.map((paragraph) => `    <p>${escape(paragraph)}</p>`).join("\n"),
    )
    .join("\n");
  const contact = email
    ? `    <h2>Contact</h2>\n    <p>${escape(contactLabel)}: <a href="mailto:${escape(email)}">${escape(email)}</a></p>`
    : `    <h2>Contact</h2>\n    <p>Contact details will be added here.</p>`;
  const heading = `ProFPL ${title.toLowerCase()}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(heading)}</title>
  <style>
    :root { color-scheme: light dark; --ink: #17201c; --soft: #3c4843; --muted: #6b7772; --bg: #ffffff; }
    @media (prefers-color-scheme: dark) { :root { --ink: #f3f4f8; --soft: #c3c8d6; --muted: #7d8398; --bg: #0b1020; } }
    body { margin: 0; background: var(--bg); color: var(--soft); font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    main { max-width: 680px; margin: 0 auto; padding: 40px 16px 64px; }
    h1 { color: var(--ink); font-size: 28px; margin: 0 0 4px; }
    h2 { color: var(--ink); font-size: 18px; margin: 32px 0 8px; }
    .updated { color: var(--muted); margin: 0 0 20px; font-size: 14px; }
    a { color: var(--ink); }
  </style>
</head>
<body>
  <main>
    <h1>${escape(heading)}</h1>
    <p class="updated">Last updated ${escape(updated)}</p>
    <p>${escape(intro)}</p>
${body}
${contact}
  </main>
</body>
</html>
`;
}

mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(
  join(root, "docs", "privacy.html"),
  page({
    title: "Privacy policy",
    updated: privacy.PRIVACY_UPDATED,
    intro: privacy.PRIVACY_INTRO,
    sections: privacy.PRIVACY_SECTIONS,
    contactLabel: "Questions about this policy",
  }),
);
writeFileSync(
  join(root, "docs", "terms.html"),
  page({
    title: "Terms and conditions",
    updated: terms.TERMS_UPDATED,
    intro: terms.TERMS_INTRO,
    sections: terms.TERMS_SECTIONS,
    contactLabel: "Questions about these terms",
  }),
);
console.log(
  "Wrote docs/privacy.html and docs/terms.html" +
    (email ? "" : " (no support email yet: set SUPPORT_EMAIL in src/appInfo.ts)"),
);
