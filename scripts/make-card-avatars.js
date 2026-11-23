// Makes the card-sized avatars from the full-size art, every one in the
// same frame:
//
//   assets/images/final-avatar/Ars.png  (976x1088)  ->  assets/images/avatar-sm/Ars.png
//   assets/images/gk-avatar/Ars-gk.png  (976x1088)  ->  assets/images/avatar-sm/Ars-gk.png
//   assets/images/final-avatar/no-club.png          ->  assets/images/avatar-sm/no-club.png
//
// Each output is WIDTH x HEIGHT, with the head scaled to HEAD pixels wide,
// its top at HEAD_TOP and centred across. The art differs from club to club
// (some players are drawn larger), so this is what lets src/Pitch.tsx draw
// every avatar at one size with no per-club adjustments.
//
// HEIGHT is enough for the largest card on a 3x screen (see
// CARD_AVATAR_SCALE in src/Pitch.tsx). Shrunk by area averaging with
// premultiplied alpha, so edges stay clean.
//
// Run after adding or changing avatar art:
//   node scripts/make-card-avatars.js
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const images = path.join(__dirname, "..", "assets", "images");
const target = path.join(images, "avatar-sm");
const sources = [
  ...fs
    .readdirSync(path.join(images, "final-avatar"))
    .filter((f) => f.endsWith(".png"))
    .map((f) => path.join(images, "final-avatar", f)),
  ...fs
    .readdirSync(path.join(images, "gk-avatar"))
    .filter((f) => f.endsWith(".png"))
    .map((f) => path.join(images, "gk-avatar", f)),
];

// The frame: the old standard avatars (287x320, head 78 wide with its top
// at 18) scaled up 1.25 times. (A card on a 3x screen draws the avatar up
// to ~365px tall; larger files only add to the app's size.)
const HEIGHT = 400;
const WIDTH = 360;
const HEAD = 97.5;
const HEAD_TOP = 23;

// Head: the widest solid run near the top of the figure, before the row
// width jumps at the shoulders. Returns its top row, width and centre.
function measureHead(png) {
  const solid = (x, y) => png.data[(y * png.width + x) * 4 + 3] > 128;
  let top = 0;
  outer: for (; top < png.height; top++) for (let x = 0; x < png.width; x++) if (solid(x, top)) break outer;
  const end = Math.min(png.height, top + Math.round(png.height * 0.22));
  let widest = 0;
  let centre = png.width / 2;
  for (let y = top, i = 0; y < end; y++, i++) {
    let left = -1, right = -1;
    for (let x = 0; x < png.width; x++) if (solid(x, y)) { if (left < 0) left = x; right = x; }
    const width = left < 0 ? 0 : right - left + 1;
    if (i > 4 && width > widest * 1.25) break;
    if (width > widest) {
      widest = width;
      centre = (left + right + 1) / 2;
    }
  }
  return { top, head: widest, centre };
}

// Draws `png` into a new WIDTH x HEIGHT image, scaled by `scale` and moved
// so source point (sx0, sy0) lands at the output's (0, 0). Each output pixel
// averages the source area under it (premultiplied alpha).
function frame(png, scale, sx0, sy0) {
  const out = new PNG({ width: WIDTH, height: HEIGHT });
  const step = 1 / scale;
  for (let y = 0; y < HEIGHT; y++) {
    const y0 = sy0 + y * step;
    const y1 = y0 + step;
    for (let x = 0; x < WIDTH; x++) {
      const x0 = sx0 + x * step;
      const x1 = x0 + step;
      let r = 0, g = 0, b = 0, a = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        if (yy < 0 || yy >= png.height) continue;
        const wy = Math.min(y1, yy + 1) - Math.max(y0, yy);
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          if (xx < 0 || xx >= png.width) continue;
          const w = wy * (Math.min(x1, xx + 1) - Math.max(x0, xx));
          const i = (yy * png.width + xx) * 4;
          const alpha = png.data[i + 3] / 255;
          r += png.data[i] * alpha * w;
          g += png.data[i + 1] * alpha * w;
          b += png.data[i + 2] * alpha * w;
          a += alpha * w;
        }
      }
      const o = (y * WIDTH + x) * 4;
      out.data[o] = a ? Math.round(r / a) : 0;
      out.data[o + 1] = a ? Math.round(g / a) : 0;
      out.data[o + 2] = a ? Math.round(b / a) : 0;
      out.data[o + 3] = Math.round((a / (step * step)) * 255);
    }
  }
  return out;
}

const measureOnly = process.argv.includes("--measure");
for (const file of sources) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { top, head, centre } = measureHead(png);
  const scale = HEAD / head;
  const sx0 = centre - WIDTH / 2 / scale;
  const sy0 = top - HEAD_TOP / scale;
  // Where the source's bottom edge lands: below HEIGHT, or the figure stops
  // short of the frame's foot.
  const bottom = Math.round((png.height - sy0) * scale);
  const name = path.basename(file);
  let note = `${name.padEnd(14)} source ${png.width}x${png.height}  head ${head} at ${top}  scale ${scale.toFixed(3)}  bottom ${bottom}`;
  if (bottom < HEIGHT) note += "  (short)";
  console.log(note);
  if (measureOnly) continue;
  const out = frame(png, scale, sx0, sy0);
  // The result's own head, measured again to confirm.
  const check = measureHead(out);
  fs.writeFileSync(path.join(target, name), PNG.sync.write(out, { colorType: 6 }));
  console.log(`${"".padEnd(14)} -> ${WIDTH}x${HEIGHT}  head ${check.head} at ${check.top}`);
}
