# Performance Optimization — IUSMK.COM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce IUSMK.COM first load by ~85% by deleting unused assets, compressing images to WebP, fixing lazy loading, and ensuring course videos stream correctly.

**Architecture:** Four sequential phases — asset deletion, image compression script, frontend code fixes, video streaming verification. No new dependencies needed; `sharp` is already installed at the monorepo root.

**Tech Stack:** React + Vite + TypeScript, sharp (image conversion), Express.js (API server), Vercel (deployment), pnpm workspaces

**Working directories:**
- Frontend: `C:\Users\andre\Desktop\ClaudeCode\IUSMK.COM\artifacts\barber-artist`
- API server: `C:\Users\andre\Desktop\ClaudeCode\IUSMK.COM\artifacts\api-server`
- Monorepo root (sharp is here): `C:\Users\andre\Desktop\ClaudeCode\IUSMK.COM`

---

## Task 1: Delete unused videos (~19 MB freed)

**Files:**
- Delete: `artifacts/barber-artist/public/intro.mp4`
- Delete: `artifacts/barber-artist/public/intro-iusmk.mp4`
- Delete: `artifacts/barber-artist/public/intro-iusmk-new.mp4`

These are old intro video versions. The current intro uses a 3D logo animation with audio (`audio/intro-sound.mp3`), not video. Confirmed: no `src="...mp4"` in any component.

- [ ] **Step 1: Verify no code references these files**

Run from `artifacts/barber-artist/src`:
```powershell
Select-String -Path ".\src\*" -Pattern "intro\.mp4|intro-iusmk|intro-iusmk-new" -Recurse
```
Expected: 0 matches.

- [ ] **Step 2: Delete the 3 video files**

```powershell
Remove-Item "artifacts\barber-artist\public\intro.mp4"
Remove-Item "artifacts\barber-artist\public\intro-iusmk.mp4"
Remove-Item "artifacts\barber-artist\public\intro-iusmk-new.mp4"
```

- [ ] **Step 3: Verify deletion**

```powershell
Get-ChildItem "artifacts\barber-artist\public" -Filter "*.mp4"
```
Expected: empty output.

- [ ] **Step 4: Commit**

```powershell
cd "C:\Users\andre\Desktop\ClaudeCode\IUSMK.COM"
git add -A
git commit -m "perf: delete 3 unused intro videos (-19 MB)"
```

---

## Task 2: Delete unused images and audio (~13 MB freed)

**Files to delete:**
- `artifacts/barber-artist/public/hero.jpg` (2.0 MB)
- `artifacts/barber-artist/public/hero-iusmk.png` (2.0 MB)
- `artifacts/barber-artist/public/images/hero-headline.png` (2.8 MB)
- `artifacts/barber-artist/public/images/gallery-placeholder-1.png` (1.6 MB)
- `artifacts/barber-artist/public/images/gallery-placeholder-2.png` (1.7 MB)
- `artifacts/barber-artist/public/sounds/razor.mp3` (582 KB)
- `artifacts/barber-artist/public/sounds/clipper.mp3` (582 KB)

These images are not referenced in any `.tsx`/`.ts` file. The sounds are only used in `IntroAnimation.tsx` which is dead code (not imported in `App.tsx`).

- [ ] **Step 1: Verify no code references these image files**

```powershell
Select-String -Path "artifacts\barber-artist\src" -Pattern "hero\.jpg|hero-iusmk|hero-headline|gallery-placeholder" -Recurse
```
Expected: 0 matches.

- [ ] **Step 2: Verify sounds are only in IntroAnimation (dead code)**

```powershell
Select-String -Path "artifacts\barber-artist\src" -Pattern "razor\.mp3|clipper\.mp3|sounds/" -Recurse
```
Expected: only matches in `src/components/IntroAnimation.tsx` and `src/i18n/translations.ts` (translations have no asset paths).

- [ ] **Step 3: Verify IntroAnimation is not imported in App.tsx**

```powershell
Select-String -Path "artifacts\barber-artist\src\App.tsx" -Pattern "IntroAnimation"
```
Expected: 0 matches.

- [ ] **Step 4: Delete unused images**

```powershell
Remove-Item "artifacts\barber-artist\public\hero.jpg"
Remove-Item "artifacts\barber-artist\public\hero-iusmk.png"
Remove-Item "artifacts\barber-artist\public\images\hero-headline.png"
Remove-Item "artifacts\barber-artist\public\images\gallery-placeholder-1.png"
Remove-Item "artifacts\barber-artist\public\images\gallery-placeholder-2.png"
```

- [ ] **Step 5: Delete unused audio**

```powershell
Remove-Item "artifacts\barber-artist\public\sounds\razor.mp3"
Remove-Item "artifacts\barber-artist\public\sounds\clipper.mp3"
```

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "perf: delete unused hero images, gallery placeholders, and dead audio files (-13 MB)"
```

---

## Task 3: Write and run image compression script

**Files:**
- Create: `scripts/optimize-assets.mjs` (at monorepo root `C:\Users\andre\Desktop\ClaudeCode\IUSMK.COM`)

`sharp` is installed at the monorepo root. The script converts all remaining key images to WebP at quality 82.

- [ ] **Step 1: Create the script**

Create `C:\Users\andre\Desktop\ClaudeCode\IUSMK.COM\scripts\optimize-assets.mjs`:

```js
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
```

- [ ] **Step 2: Run the script**

```powershell
cd "C:\Users\andre\Desktop\ClaudeCode\IUSMK.COM"
node scripts/optimize-assets.mjs
```

Expected output (approximate):
```
✓ images/intro-bg.jpg → images/intro-bg.webp  (5291 KB → ~150 KB, -5141 KB)
✓ slide-1.jpg → slide-1.webp  (631 KB → ~50 KB, -581 KB)
✓ slide-2.jpg → slide-2.webp  (820 KB → ~60 KB, -760 KB)
✓ slide-3.jpg → slide-3.webp  (634 KB → ~50 KB, -584 KB)
...
Total saved: ~8 MB
```

If any image shows 0 KB saved or is larger than original, inspect that specific file.

- [ ] **Step 3: Verify WebP files exist and are smaller**

```powershell
Get-ChildItem "artifacts\barber-artist\public\images" -Filter "*.webp" | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}}
Get-ChildItem "artifacts\barber-artist\public" -Filter "slide-*.webp" | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}}
```

All WebP files must be smaller than their originals. `intro-bg.webp` should be under 300 KB.

- [ ] **Step 4: Delete original files that now have WebP replacements**

```powershell
Remove-Item "artifacts\barber-artist\public\images\intro-bg.jpg"
Remove-Item "artifacts\barber-artist\public\slide-1.jpg"
Remove-Item "artifacts\barber-artist\public\slide-2.jpg"
Remove-Item "artifacts\barber-artist\public\slide-3.jpg"
Remove-Item "artifacts\barber-artist\public\images\academy-course-1.png"
Remove-Item "artifacts\barber-artist\public\images\academy-course-2.png"
Remove-Item "artifacts\barber-artist\public\images\logo-iusmk.png"
Remove-Item "artifacts\barber-artist\public\images\logo-iusmk-2025.png"
Remove-Item "artifacts\barber-artist\public\images\logo-iusmk-white.png"
Remove-Item "artifacts\barber-artist\public\images\iusmk-portrait.png"
Remove-Item "artifacts\barber-artist\public\images\artist.jpg"
Remove-Item "artifacts\barber-artist\public\images\clipper.png"
Remove-Item "artifacts\barber-artist\public\icon-original.jpg"
```

- [ ] **Step 5: Commit script and generated files**

```powershell
git add -A
git commit -m "perf: compress images to WebP (-8 MB), add optimize-assets script"
```

---

## Task 4: Update code to reference WebP files

**Files:**
- Modify: `artifacts/barber-artist/src/components/IntroOverlay.tsx` (line 18)
- Modify: `artifacts/barber-artist/src/pages/home.tsx` (lines 15-17)
- Modify: `artifacts/barber-artist/src/pages/course-detail.tsx` (line ~457)

- [ ] **Step 1: Update IntroOverlay.tsx background image**

In `artifacts/barber-artist/src/components/IntroOverlay.tsx`, change line 18:

```ts
// Before:
const BG_SRC = `${import.meta.env.BASE_URL}images/intro-bg.jpg`;

// After:
const BG_SRC = `${import.meta.env.BASE_URL}images/intro-bg.webp`;
```

- [ ] **Step 2: Update home.tsx slide URLs**

In `artifacts/barber-artist/src/pages/home.tsx`, change lines 14-18:

```ts
// Before:
const HERO_SLIDES = [
  `${import.meta.env.BASE_URL}slide-2.jpg`,
  `${import.meta.env.BASE_URL}slide-1.jpg`,
  `${import.meta.env.BASE_URL}slide-3.jpg`,
];

// After:
const HERO_SLIDES = [
  `${import.meta.env.BASE_URL}slide-2.webp`,
  `${import.meta.env.BASE_URL}slide-1.webp`,
  `${import.meta.env.BASE_URL}slide-3.webp`,
];
```

- [ ] **Step 3: Update course-detail.tsx fallback image**

In `artifacts/barber-artist/src/pages/course-detail.tsx`, find the line with `academy-course-1.png` (around line 457):

```tsx
// Before:
src={normalizeMediaUrl(course.thumbnailUrl) || `${import.meta.env.BASE_URL}images/academy-course-1.png`}

// After:
src={normalizeMediaUrl(course.thumbnailUrl) || `${import.meta.env.BASE_URL}images/academy-course-1.webp`}
```

- [ ] **Step 4: Verify build succeeds with no missing asset errors**

```powershell
cd "artifacts\barber-artist"
npx vite build 2>&1 | Select-String -Pattern "error|Error|missing|404" -CaseSensitive:$false
```

Expected: no errors about missing assets.

- [ ] **Step 5: Commit**

```powershell
cd "C:\Users\andre\Desktop\ClaudeCode\IUSMK.COM"
git add artifacts/barber-artist/src/components/IntroOverlay.tsx
git add artifacts/barber-artist/src/pages/home.tsx
git add artifacts/barber-artist/src/pages/course-detail.tsx
git commit -m "perf: update asset references to .webp"
```

---

## Task 5: Add preload hints and lazy loading

**Files:**
- Modify: `artifacts/barber-artist/index.html`
- Modify: `artifacts/barber-artist/src/pages/home.tsx`

- [ ] **Step 1: Add preload hints in index.html**

In `artifacts/barber-artist/index.html`, inside `<head>` before the closing `</head>` tag, add:

```html
<!-- Preload above-fold images so browser fetches them before JS executes -->
<link rel="preload" as="image" href="/images/intro-bg.webp" type="image/webp">
<link rel="preload" as="image" href="/slide-2.webp" type="image/webp">
```

Note: `slide-2` is first in HERO_SLIDES (index 0), so it's the one visible on load.

- [ ] **Step 2: Add fetchpriority and lazy loading to hero slides in home.tsx**

In `artifacts/barber-artist/src/pages/home.tsx`, the slides are rendered with a `.map()`. The current `<img>` element (around line 71-82) needs `fetchpriority` on slide 0 and `loading="lazy"` on slides 1 and 2.

Replace the `<img>` element inside the map:

```tsx
<img
  key={src}
  src={src}
  alt={`IUSMK slide ${i + 1}`}
  className={`absolute inset-0 w-full h-full object-cover${i === 2 ? " hero-slide-third" : ""}`}
  style={{
    opacity: i === activeIndex ? 1 : 0,
    transition: `opacity ${FADE_DURATION}ms ease-in-out`,
    zIndex: i === activeIndex ? 1 : 0,
  }}
  loading={i === 0 ? "eager" : "lazy"}
  fetchPriority={i === 0 ? "high" : "low"}
/>
```

Note: `fetchPriority` is the React prop name (camelCase); it renders as `fetchpriority` in HTML.

- [ ] **Step 3: Commit**

```powershell
cd "C:\Users\andre\Desktop\ClaudeCode\IUSMK.COM"
git add artifacts/barber-artist/index.html
git add artifacts/barber-artist/src/pages/home.tsx
git commit -m "perf: add preload hints for above-fold images, lazy load slides 2 and 3"
```

---

## Task 6: Fix video preload in MediaLightbox

**Files:**
- Modify: `artifacts/barber-artist/src/pages/course-detail.tsx` (around line 214)

`preload="auto"` on the lightbox video causes the browser to begin downloading the full video the moment the lightbox opens (before the user presses play). Changing to `preload="metadata"` makes the browser load only a few KB of metadata (duration, resolution), then stream via HTTP range requests when play is pressed. This is critical for videos that are gigabytes in size.

- [ ] **Step 1: Fix preload in MediaLightbox**

In `artifacts/barber-artist/src/pages/course-detail.tsx`, inside the `MediaLightbox` component, find the `<video>` element with `preload="auto"` (around line 207-219):

```tsx
// Before:
<video
  ref={videoRef}
  key={url}
  src={url}
  controls
  autoPlay
  playsInline
  preload="auto"
  className="w-full max-h-[78vh] rounded-lg shadow-2xl bg-black outline-none"
  style={{ maxWidth: "100%" }}
  onClick={e => e.stopPropagation()}
  onError={() => { console.warn("[MediaLightbox] errore caricamento video:", url); setVideoError(true); }}
/>

// After:
<video
  ref={videoRef}
  key={url}
  src={url}
  controls
  autoPlay
  playsInline
  preload="metadata"
  className="w-full max-h-[78vh] rounded-lg shadow-2xl bg-black outline-none"
  style={{ maxWidth: "100%" }}
  onClick={e => e.stopPropagation()}
  onError={() => { console.warn("[MediaLightbox] errore caricamento video:", url); setVideoError(true); }}
/>
```

- [ ] **Step 2: Commit**

```powershell
cd "C:\Users\andre\Desktop\ClaudeCode\IUSMK.COM"
git add artifacts/barber-artist/src/pages/course-detail.tsx
git commit -m "perf: fix MediaLightbox video preload auto→metadata to prevent full video download on open"
```

---

## Task 7: Verify video streaming headers (API server)

**Files:**
- Read: `artifacts/api-server/src/routes/video.ts` (already reviewed — no changes needed)

The video streaming route at `artifacts/api-server/src/routes/video.ts` already:
- Redirects remote Supabase URLs via 302 → browser talks directly to Supabase CDN
- Supabase Storage CDN supports `Accept-Ranges: bytes` natively
- For legacy local files: implements proper `Content-Range`, `Accept-Ranges: bytes`, `Content-Length` headers

No code changes needed. This task is a verification checklist only.

- [ ] **Step 1: Confirm video.ts redirect path**

Read `artifacts/api-server/src/routes/video.ts` lines 33-38. The 302 redirect to Supabase is the production path. Supabase handles range requests automatically — heavy videos will stream correctly.

- [ ] **Step 2: Build the project and push to deploy**

```powershell
cd "C:\Users\andre\Desktop\ClaudeCode\IUSMK.COM"
git push origin main
```

Vercel will auto-deploy. Wait ~2-3 minutes for deployment to complete.

- [ ] **Step 3: Smoke-test on live site**

1. Open the site. The intro should appear almost immediately (intro-bg.webp at ~150 KB vs 5.2 MB before).
2. Navigate to home — hero slides should load in under 1 second on a normal connection.
3. Open a course with gallery videos — open the lightbox on a video. Network tab should show the video loads only a small initial request (metadata), not the full file.
4. Open the student dashboard and play a course video. It should start playing within 1-2 seconds regardless of file size.

---

## Summary of Expected Savings

| Phase | Before | After | Saving |
|---|---|---|---|
| Unused videos | 19.4 MB | 0 | −19.4 MB |
| Unused images | ~10 MB | 0 | −10 MB |
| Unused audio | 1.2 MB | 0 | −1.2 MB |
| intro-bg | 5.2 MB | ~150 KB | −97% |
| Hero slides (3) | ~2 MB | ~160 KB | −92% |
| Other images | ~3 MB | ~250 KB | −92% |
| **Total public/** | **~45 MB** | **~6 MB** | **−87%** |
