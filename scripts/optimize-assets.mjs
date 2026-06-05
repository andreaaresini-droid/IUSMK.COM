import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "../artifacts/barber-artist/public");

const IMAGES = [
  // [input, output, options]
  ["images/intro-bg.jpg",            "images/intro-bg.webp",            { quality: 80 }],
  ["slide-1.jpg",                    "slide-1.webp",                    { quality: 82 }],
  ["slide-2.jpg",                    "slide-2.webp",                    { quality: 82 }],
  ["slide-3.jpg",                    "slide-3.webp",                    { quality: 82 }],
  ["images/academy-course-1.png",    "images/academy-course-1.webp",    { quality: 82 }],
  ["images/academy-course-2.png",    "images/academy-course-2.webp",    { quality: 82 }],
  ["images/logo-iusmk.png",          "images/logo-iusmk.webp",          { quality: 85, lossless: false }],
  ["images/logo-iusmk-2025.png",     "images/logo-iusmk-2025.webp",     { quality: 85, lossless: false }],
  ["images/logo-iusmk-white.png",    "images/logo-iusmk-white.webp",    { quality: 85, lossless: false }],
  ["images/iusmk-portrait.png",      "images/iusmk-portrait.webp",      { quality: 82 }],
  ["images/artist.jpg",              "images/artist.webp",              { quality: 82 }],
  ["images/clipper.png",             "images/clipper.webp",             { quality: 82 }],
  ["icon-original.jpg",              "icon-original.webp",              { quality: 82 }],
];

// opengraph.jpg and opengraph-2025.jpg intentionally NOT converted:
// social crawlers (Facebook, Twitter, WhatsApp) don't support WebP for OG images.

let totalSavedKB = 0;

for (const [input, output, opts] of IMAGES) {
  const inputPath  = path.join(PUBLIC, input);
  const outputPath = path.join(PUBLIC, output);

  if (!fs.existsSync(inputPath)) {
    console.warn(`SKIP (not found): ${input}`);
    continue;
  }

  const beforeBytes = fs.statSync(inputPath).size;

  await sharp(inputPath)
    .webp(opts)
    .toFile(outputPath);

  const afterBytes = fs.statSync(outputPath).size;
  const savedKB    = Math.round((beforeBytes - afterBytes) / 1024);
  totalSavedKB += savedKB;

  console.log(`✓ ${input} → ${output}  (${Math.round(beforeBytes/1024)} KB → ${Math.round(afterBytes/1024)} KB, -${savedKB} KB)`);
}

console.log(`\nTotal saved: ~${Math.round(totalSavedKB / 1024)} MB`);
