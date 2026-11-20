// Makes the card-sized goalkeeper avatars from the full-size art.
//
//   assets/images/gk-avatar/Ars-gk.png (976x1088)  ->  assets/images/avatar-sm/Ars-gk.png (287x320)
//
// Same size as the outfield avatars in avatar-sm (all 320px tall), shrunk by
// area averaging with premultiplied alpha so edges stay clean. Also prints
// each image's head width (see AVATAR_ART in src/Pitch.tsx), measured the
// same way for the outfield avatars to compare.
//
// Run after adding or changing goalkeeper art:
//   node scripts/make-gk-avatars.js
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const images = path.join(__dirname, "..", "assets", "images");
const source = path.join(images, "gk-avatar");
const target = path.join(images, "avatar-sm");
const HEIGHT = 320;

function resize(png, width, height) {
  const out = new PNG({ width, height });
  const sx = png.width / width;
  const sy = png.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = y * sy;
    const y1 = y0 + sy;
    for (let x = 0; x < width; x++) {
      const x0 = x * sx;
      const x1 = x0 + sx;
      let r = 0, g = 0, b = 0, a = 0, area = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(y1, yy + 1) - Math.max(y0, yy);
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const w = wy * (Math.min(x1, xx + 1) - Math.max(x0, xx));
          const i = (yy * png.width + xx) * 4;
          const alpha = png.data[i + 3] / 255;
          r += png.data[i] * alpha * w;
          g += png.data[i + 1] * alpha * w;
          b += png.data[i + 2] * alpha * w;
          a += alpha * w;
          area += w;
        }
      }
      const o = (y * width + x) * 4;
      out.data[o] = a ? Math.round(r / a) : 0;
      out.data[o + 1] = a ? Math.round(g / a) : 0;
      out.data[o + 2] = a ? Math.round(b / a) : 0;
      out.data[o + 3] = Math.round((a / area) * 255);
    }
  }
  return out;
}

// Head width: the widest solid run in the top part of the figure, above the
// shoulders (rows from the top of the head down to ~22% of the figure).
function headWidth(png) {
  const solid = (x, y) => png.data[(y * png.width + x) * 4 + 3] > 128;
  let top = 0;
  outer: for (; top < png.height; top++) for (let x = 0; x < png.width; x++) if (solid(x, top)) break outer;
  let widest = 0;
  const end = Math.min(png.height, top + Math.round(png.height * 0.22));
  const widths = [];
  for (let y = top; y < end; y++) {
    let left = -1, right = -1;
    for (let x = 0; x < png.width; x++) if (solid(x, y)) { if (left < 0) left = x; right = x; }
    widths.push(left < 0 ? 0 : right - left + 1);
  }
  // The head is the widest point before the row width jumps at the shoulders.
  for (let i = 0; i < widths.length; i++) {
    if (i > 4 && widths[i] > widest * 1.25) break;
    widest = Math.max(widest, widths[i]);
  }
  return { top, head: widest };
}

const read = (file) => PNG.sync.read(fs.readFileSync(file));

console.log("outfield (for comparison):");
for (const file of fs.readdirSync(target).filter((f) => /^[A-Z][a-z]+\.png$/.test(f))) {
  const png = read(path.join(target, file));
  const { top, head } = headWidth(png);
  console.log(`  ${file.padEnd(12)} ${png.width}x${png.height}  top ${top}  head ${head}`);
}
console.log("goalkeepers:");
for (const file of fs.readdirSync(source).filter((f) => f.endsWith(".png"))) {
  const png = read(path.join(source, file));
  const width = Math.round((png.width * HEIGHT) / png.height);
  const small = resize(png, width, HEIGHT);
  fs.writeFileSync(path.join(target, file), PNG.sync.write(small, { colorType: 6 }));
  const { top, head } = headWidth(small);
  console.log(`  ${file.padEnd(12)} ${width}x${HEIGHT}  top ${top}  head ${head}`);
}
