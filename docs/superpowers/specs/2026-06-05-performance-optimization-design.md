---
name: performance-optimization
description: Speed up IUSMK.COM — asset cleanup, image compression to WebP, lazy loading fixes, and video streaming optimization
metadata:
  type: project
---

# Performance Optimization — IUSMK.COM

## Goal
Reduce initial page load time by ~85% and image load time by ~90%. Ensure heavy course videos (hours long) stream smoothly without pre-downloading.

## Scope
Project: `C:\Users\andre\Desktop\ClaudeCode\IUSMK.COM\artifacts\barber-artist`

---

## Phase 1 — Asset Cleanup (~30 MB freed)

### Delete unused videos from `public/`
- `public/intro.mp4` (4.7 MB) — old intro, not referenced in any src file
- `public/intro-iusmk.mp4` (9.3 MB) — old intro, not referenced in any src file
- `public/intro-iusmk-new.mp4` (5.4 MB) — old intro, not referenced in any src file

### Delete unused images from `public/`
- `public/hero.jpg` (2.0 MB) — not referenced in src
- `public/hero-iusmk.png` (2.0 MB) — not referenced in src
- `public/images/hero-headline.png` (2.8 MB) — not referenced in src
- `public/images/gallery-placeholder-1.png` (1.6 MB) — not referenced in src
- `public/images/gallery-placeholder-2.png` (1.7 MB) — not referenced in src

### Delete unused audio from `public/`
- `public/sounds/razor.mp3` (582 KB) — only used in `IntroAnimation.tsx` which is dead code (not imported in `App.tsx`)
- `public/sounds/clipper.mp3` (582 KB) — same

---

## Phase 2 — Image Compression to WebP

Write script `scripts/optimize-assets.mjs` using `sharp` (already in node_modules at project root).

### Images to compress and convert
| Input | Output | Est. size |
|---|---|---|
| `public/images/intro-bg.jpg` (5.2 MB) | `public/images/intro-bg.webp` | ~150 KB |
| `public/slide-1.jpg` (631 KB) | `public/slide-1.webp` | ~50 KB |
| `public/slide-2.jpg` (820 KB) | `public/slide-2.webp` | ~60 KB |
| `public/slide-3.jpg` (634 KB) | `public/slide-3.webp` | ~50 KB |
| `public/images/academy-course-1.png` (1.3 MB) | `public/images/academy-course-1.webp` | ~80 KB |
| `public/images/academy-course-2.png` (1.3 MB) | `public/images/academy-course-2.webp` | ~80 KB |
| `public/images/logo-iusmk.png` (273 KB) | `public/images/logo-iusmk.webp` | ~30 KB |
| `public/images/logo-iusmk-2025.png` (273 KB) | `public/images/logo-iusmk-2025.webp` | ~30 KB |
| `public/images/logo-iusmk-white.png` (160 KB) | `public/images/logo-iusmk-white.webp` | ~20 KB |
| `public/images/iusmk-portrait.png` (249 KB) | `public/images/iusmk-portrait.webp` | ~25 KB |
| `public/images/artist.jpg` (76 KB) | `public/images/artist.webp` | ~15 KB |
| `public/images/clipper.png` (72 KB) | `public/images/clipper.webp` | ~10 KB |
| `public/icon-original.jpg` (97 KB) | `public/icon-original.webp` | ~15 KB |
| `public/opengraph.jpg` (97 KB) | keep as jpg (OG images need jpg for social crawlers) |
| `public/opengraph-2025.jpg` (35 KB) | keep as jpg |

Settings: quality 82 for photos, quality 85 for graphics, lossless=false.

After compression, **delete the original `.jpg`/`.png` files** that have WebP replacements (except OG images).

### Update code references
- `src/components/IntroOverlay.tsx`: `BG_SRC` → `intro-bg.webp`
- `src/components/IntroAnimation.tsx`: update (dead code but keep consistent)
- `src/pages/home.tsx`: `HERO_SLIDES` array → `.webp` extensions
- `src/pages/course-detail.tsx`: fallback image reference `academy-course-1.png` → `.webp`

---

## Phase 3 — Code Optimizations

### `index.html` — Preload critical above-fold assets
Add inside `<head>`:
```html
<link rel="preload" as="image" href="/images/intro-bg.webp" type="image/webp">
<link rel="preload" as="image" href="/slide-1.webp" type="image/webp">
```

### `src/pages/home.tsx` — Lazy load non-visible slides
- Slide 0 (first): add `fetchpriority="high"`, keep no `loading` attribute (default eager)
- Slides 1 and 2: add `loading="lazy"`

### `src/pages/course-detail.tsx` line ~214 — Fix MediaLightbox video preload
Change in the `<video>` inside `MediaLightbox`:
```
preload="auto"   →   preload="metadata"
```
`preload="auto"` causes the browser to download the full video the moment the lightbox opens. `preload="metadata"` loads only duration/dimensions; the video streams via HTTP range requests when play is pressed.

---

## Phase 4 — API Server: Video Streaming Headers

File to check: `artifacts/api-server/` — the route that serves course videos (e.g. `/api/student/courses/:courseId/modules/:moduleId/stream`).

Ensure the response includes:
- `Accept-Ranges: bytes` — required for seeking in heavy videos
- `Content-Length` — required for the browser progress bar
- Proper `Content-Type: video/mp4`

If using Express with `res.sendFile()` or a stream, these are set automatically. If proxying from Supabase storage, ensure the proxy passes through the range headers.

---

## Expected Results

| Metric | Before | After |
|---|---|---|
| First intro load (intro-bg) | 5.2 MB | ~150 KB (−97%) |
| Hero slides total | ~2 MB | ~160 KB (−92%) |
| Total public/ folder | ~45 MB | ~6 MB (−87%) |
| Course video lightbox | Downloads full video on open | Streams on play only |
| Student dashboard video | Already `preload="metadata"` ✓ | No change needed |
