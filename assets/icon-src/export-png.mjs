// Renders the combined icon SVGs to opaque 1024×1024 PNGs (alternate app
// icons must be full-bleed, no alpha). Run from the repo root:
//   node assets/icon-src/export-png.mjs
import sharp from "sharp";

const DIR = "assets/icon-src";
const ICONS = [
  { svg: "modrift-icon.svg", png: "modrift-icon-1024.png", bg: "#181512" },
  { svg: "modrift-icon-light.svg", png: "modrift-icon-light-1024.png", bg: "#FFFFFF" },
  { svg: "modrift-icon-navy.svg", png: "modrift-icon-navy-1024.png", bg: "#1B3A6B" },
];

for (const { svg, png, bg } of ICONS) {
  await sharp(`${DIR}/${svg}`, { density: 512 })
    .resize(1024, 1024)
    .flatten({ background: bg })
    .removeAlpha()
    .png()
    .toFile(`${DIR}/${png}`);
  console.log(`wrote ${DIR}/${png}`);
}
