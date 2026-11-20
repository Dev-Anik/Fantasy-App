// Draws the Skippr logo and renders every icon the app needs from it.
//
// The mark: a clean geometric white S with a green dot, in the style of the
// original ProFPL "P". Written as SVGs to assets/brand/, then rendered to the
// PNGs app.json and the app use:
//   assets/images/icon.png                    1024  full icon (navy + mark)
//   assets/images/icon-small.png               168  in-app logo (welcome, sign in)
//   assets/images/android-icon-foreground.png 1024  mark only, in the adaptive safe zone
//   assets/images/android-icon-background.png 1024  navy
//   assets/images/android-icon-monochrome.png 1024  one-colour mark (themed icons)
//   assets/images/splash-icon.png              512  mark only (splash screen)
//   assets/images/notification-icon.png         96  white silhouette (status bar)
//   assets/images/favicon.png                   48  full icon, small
//
// Run after changing the logo:  node scripts/build-logo.js
// Needs Google Chrome; set CHROME to its path if it is not the default.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const brand = path.join(root, "assets", "brand");
const images = path.join(root, "assets", "images");
fs.mkdirSync(brand, { recursive: true });

// ---- The mark, drawn on a 1024 canvas centred on (512, 512) ----
// In the style of the original ProFPL "P": one even, thick white stroke with
// round ends, and a green dot. A geometric S (top bar, a half circle on the
// left, the middle bar, a half circle on the right, the bottom bar), with the
// green dot just past the end of the top bar, like a ball it sets off from.
const S_PATH = "M 590 256 H 470 A 128 128 0 0 0 470 512 H 554 A 128 128 0 0 1 554 768 H 384";
const S_WIDTH = 92;
const DOT = { x: 692, y: 256, r: 52 };

function mark({ color = "#ffffff", dot = "#00d982" } = {}) {
  return `
    <g>
      <path d="${S_PATH}" fill="none" stroke="${color}" stroke-width="${S_WIDTH}" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${DOT.x}" cy="${DOT.y}" r="${DOT.r}" fill="${dot}" />
    </g>`;
}

const defs = `
  <defs>
    <linearGradient id="navy" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a2342" />
      <stop offset="0.55" stop-color="#0d1326" />
      <stop offset="1" stop-color="#070a14" />
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.38" r="0.6">
      <stop offset="0" stop-color="#2a3a6e" stop-opacity="0.3" />
      <stop offset="1" stop-color="#2a3a6e" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" />
      <stop offset="1" stop-color="#d9deea" />
    </linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#3cf2a6" />
      <stop offset="1" stop-color="#00b86a" />
    </linearGradient>
  </defs>`;

// Scale the 1024 mark into a box of `size`, centred.
const placed = (size, inner) =>
  `<g transform="translate(${512 - (512 * size) / 1024} ${512 - (512 * size) / 1024}) scale(${size / 1024})">${inner}</g>`;

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs}${body}</svg>\n`;

const files = {
  // Full icon: navy with a soft halo, the mark large.
  "skippr-icon.svg": svg(
    `<rect width="1024" height="1024" fill="url(#navy)" /><rect width="1024" height="1024" fill="url(#halo)" />${placed(1000, mark())}`,
  ),
  // Adaptive foreground: the mark inside Android's safe zone (the middle 66%).
  "skippr-foreground.svg": svg(placed(760, mark())),
  "skippr-background.svg": svg(`<rect width="1024" height="1024" fill="url(#navy)" /><rect width="1024" height="1024" fill="url(#halo)" />`),
  // One colour: the band cut out of the S so the shape still reads.
  "skippr-monochrome.svg": svg(placed(760, mark({ color: "#ffffff", dot: "#ffffff" }))),
  // Splash: the mark alone on the navy splash background.
  "skippr-mark.svg": svg(placed(900, mark())),
  // Status bar: Android draws only the alpha, in white.
  "skippr-notification.svg": svg(placed(900, mark({ color: "#ffffff", dot: "#ffffff" }))),
};
for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(brand, name), content);

// ---- Render ----
const chrome =
  process.env.CHROME ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find((candidate) => fs.existsSync(candidate));
if (!chrome) throw new Error("Chrome not found: set the CHROME environment variable.");

const jobs = [
  ["skippr-icon.svg", "icon.png", 1024],
  ["skippr-icon.svg", "icon-small.png", 168],
  ["skippr-icon.svg", "favicon.png", 48],
  ["skippr-foreground.svg", "android-icon-foreground.png", 1024],
  ["skippr-background.svg", "android-icon-background.png", 1024],
  ["skippr-monochrome.svg", "android-icon-monochrome.png", 1024],
  ["skippr-mark.svg", "splash-icon.png", 512],
  ["skippr-notification.svg", "notification-icon.png", 96],
];
const only = process.argv[2] === "--preview" ? path.join(os.tmpdir(), "skippr-preview") : null;
if (only) fs.mkdirSync(only, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), "skippr-logo-"));
for (const [svgName, pngName, size] of jobs) {
  const page = path.join(work, "page.html");
  const source = "file:///" + path.join(brand, svgName).replace(/\\/g, "/");
  fs.writeFileSync(
    page,
    `<!doctype html><html><body style="margin:0;background:transparent"><img src="${source}" style="display:block;width:${size}px;height:${size}px"></body></html>`,
  );
  const output = path.join(only ?? images, pngName);
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "--default-background-color=00000000",
      "--force-device-scale-factor=1",
      `--window-size=${size},${size}`,
      `--screenshot=${output}`,
      "file:///" + page.replace(/\\/g, "/"),
    ],
    { stdio: "ignore" },
  );
  console.log(`${svgName} -> ${path.relative(root, output)} (${size}px)`);
}
fs.rmSync(work, { recursive: true, force: true });
