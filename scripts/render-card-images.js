// Renders the card and pitch SVGs to PNG files the app loads instead.
// Android draws SVGs slowly (each one is converted to a bitmap on the fly),
// and a pitch shows dozens of them; ready-made PNGs decode fast and cache.
//
// Run after changing any of these SVGs (or after generate-shield-cards.js):
//   node scripts/render-card-images.js
// Needs Google Chrome; set CHROME to its path if it is not the default.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const images = path.join(root, "assets", "images");
const chrome =
  process.env.CHROME ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find((candidate) => fs.existsSync(candidate));
if (!chrome) throw new Error("Chrome not found: set the CHROME environment variable.");

// Cards are drawn up to ~100pt wide. The card art ends at the middle of the
// footer text line, about 1.42 times the width (see cardFooterLayout in
// src/Pitch.tsx); 300px covers 3x screens.
const CARD = [300, 426];
const jobs = [
  ...fs
    .readdirSync(path.join(images, "card-shield"))
    .filter((file) => file.endsWith(".svg"))
    .map((file) => [path.join("card-shield", file), CARD]),
  ["card-shield.svg", CARD],
  ["card-shield-pattern.svg", CARD],
  ["card-shield-fade.svg", CARD],
  ["card-shield-elite-pattern.svg", CARD],
  ["card-shield-elite-frame.svg", CARD],
  ["card-shield-hero-pattern.svg", CARD],
  ["card-shield-hero-frame.svg", CARD],
  // Glows are drawn 1.4 x 1.4 the card, centred behind it.
  ["card-shield-elite-glow.svg", [420, 596]],
  ["card-shield-hero-glow.svg", [420, 596]],
  // Pitch pieces are drawn at the full pitch width (up to ~400pt).
  // The app background, stretched to any screen.
  ["app-background.svg", [500, 1100]],
  ["pitch-grass.svg", [600, 800]],
  ["pitch-top.svg", [1200, 430]],
  ["pitch-centre.svg", [1200, 320]],
  ["pitch-bottom.svg", [1200, 370]],
];

const work = fs.mkdtempSync(path.join(os.tmpdir(), "profpl-render-"));
for (const [svg, [width, height]] of jobs) {
  const source = path.join(images, svg);
  const output = source.replace(/\.svg$/, ".png");
  const page = path.join(work, "page.html");
  fs.writeFileSync(
    page,
    `<!doctype html><html><body style="margin:0;background:transparent">` +
      `<img src="${"file:///" + source.replace(/\\/g, "/")}" style="display:block;width:${width}px;height:${height}px">` +
      `</body></html>`,
  );
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    "--default-background-color=00000000",
    "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    `--screenshot=${output}`,
    "file:///" + page.replace(/\\/g, "/"),
  ], { stdio: "ignore" });
  console.log(`${svg} -> ${path.basename(output)} (${width}x${height})`);
}
fs.rmSync(work, { recursive: true, force: true });
