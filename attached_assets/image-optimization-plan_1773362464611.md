# Image Optimization Plan — Google PageSpeed 100

## Goal

Optimize all images to score 100 on Google PageSpeed Insights by fixing layout shift (CLS), image sizing, format modernization, and LCP preloading. Source of truth is `images-registry.json`, images are stored in Google Cloud Storage.

---

## Concepts

### `width` and `height` attributes
These do not control the rendered size — CSS does that. They tell the browser the **aspect ratio** before the image loads, so it can reserve the right amount of space and avoid layout shift. Always set them to the **intrinsic dimensions of the original source file**, regardless of how the image is displayed on screen.

### `srcset` and `sizes`
- `srcset` lists all available image variants and their pixel widths
- `sizes` tells the browser how large the image will appear at each CSS breakpoint
- Together they let the browser pick the most appropriate variant for the user's screen — no oversized images downloaded on mobile

### LCP (Largest Contentful Paint)
The largest visible image on initial page load. Google heavily weights how fast it appears. The LCP image must be flagged so the browser fetches it early with high priority via a `<link rel="preload">` tag.

---

## Presets

Already defined in `images-registry.json`. Each preset specifies widths, quality, and aspect ratio. No changes needed.

| Preset | Widths | Quality | Use case |
|---|---|---|---|
| `hero-wide` | 640, 960, 1280, 1920 | 85 | Full-width hero images |
| `hero-tall` | 360, 480, 640 | 85 | Vertical/mobile hero images |
| `card` | 320, 480, 640 | 80 | Standard card thumbnails |
| `card-wide` | 320, 480, 640 | 80 | Wide card thumbnails |
| `avatar` | 64, 128, 256 | 85 | Profile pictures |
| `logo` | 120, 240 | 90 | Company logos |
| `icon` | 32, 64, 128 | 90 | Icons and badges |
| `full` | 640, 960, 1280, 1920 | 85 | Full-size, preserves ratio |

---

## Preset Assignment — Auto from Tags

The script infers which preset(s) to use from each image's `tags` array. Tag priority mapping:

| Tag | Preset |
|---|---|
| `logo` | `logo` |
| `avatar` | `avatar` |
| `icon` | `icon` |
| `badge` | `icon` |
| `hero` | `hero-wide` |
| `certification` | `icon` |
| `award` | `icon` |
| anything else | `full` |

### When multiple tags match different presets
The widths from all matching presets are **merged, deduplicated, and sorted**. Quality uses the **highest value** among the matching presets.

**Example** — image tagged `hero` + `logo`:
- `hero-wide` widths: 640, 960, 1280, 1920 at quality 85
- `logo` widths: 120, 240 at quality 90
- Result: widths `[120, 240, 640, 960, 1280, 1920]` at quality `90`

---

## Output Format

- If the original file is **AVIF** → generate AVIF variants
- All other formats (PNG, JPG, WebP, etc.) → generate **WebP** variants
- Originals in GCS are never modified — variants are saved as separate files

---

## Core Processing Logic

Both tracks share the same underlying logic. Given an image entry it will:

1. Infer preset(s) from tags and compute the merged width list
2. Download the original from Google Cloud Storage
3. Read intrinsic dimensions (`width` and `height`) from the original file
4. Generate resized variants for each computed width
5. Convert to WebP or AVIF depending on original format
6. Upload variants back to GCS alongside the originals
7. Update the image entry in `images-registry.json` with new fields

### New fields added to each image entry

- `preset` — list of matched presets (e.g. `["logo"]` or `["hero-wide", "logo"]`)
- `width` — intrinsic width of the original file in pixels
- `height` — intrinsic height of the original file in pixels
- `widths_generated` — final merged list of widths actually generated
- `srcset` — array of objects with `w` (width) and `url` (GCS path)
- `format` — output format used (`webp` or `avif`)

### Example — before and after

**Before:**
```json
"clark_university": {
  "src": "https://storage.googleapis.com/.../clark-university.png",
  "alt": "Clark University Logo",
  "tags": ["logo", "university", "partner"],
  ...
}
```

**After:**
```json
"clark_university": {
  "src": "https://storage.googleapis.com/.../clark-university.png",
  "alt": "Clark University Logo",
  "tags": ["logo", "university", "partner"],
  "preset": ["logo"],
  "width": 800,
  "height": 400,
  "widths_generated": [120, 240],
  "format": "webp",
  "srcset": [
    { "w": 120, "url": "https://storage.googleapis.com/.../clark-university-120w.webp" },
    { "w": 240, "url": "https://storage.googleapis.com/.../clark-university-240w.webp" }
  ]
}
```

---

## Track 1 — Backfill (legacy images)

All existing images in GCS have never been processed. This is the most urgent task since there could be hundreds of unoptimized images already in production.

### How it works
A one-time script that iterates over every entry in `images-registry.json`, runs the core processing logic on each one, and saves the updated registry when done. Skips any image that already has `srcset` populated to avoid reprocessing.

### Running locally
The script runs on localhost against the real GCS bucket. No server or extra infrastructure needed.

### Tools needed
- **Sharp** (Node.js) — resizing, format conversion, dimension reading
- **Google Cloud Storage Node.js client** — download originals, upload variants
- **Google Cloud credentials** — authenticate with `gcloud auth application-default login`
- Requires **Storage Object Admin** permissions on the GCS bucket

---

## Track 2 — Upload integration (new images)

Built alongside the backfill so that every new image uploaded going forward is processed automatically — no manual steps needed.

### How it works
The production server's upload endpoint calls the core processing logic immediately after saving the original to GCS. For large images this should run as a background job so it doesn't block the upload response. The registry is updated in place once processing completes.

No additional infrastructure needed — runs on the existing production server.

---

## Editorial Work (manual, after backfill runs)

### Tag the LCP image per page
- Identify the largest visible image on initial load for each page
- Set `lcp: true` and `preload: true` on that entry in `images-registry.json`
- This varies per page and cannot be automated — requires human review

---

## PageSpeed Checklist

| Issue | Fix | How |
|---|---|---|
| Layout shift (CLS) | `width`/`height` on every `<img>` | Read from original by script |
| Oversized images | `srcset` + `sizes` | Generated by script |
| Old format | Serve WebP or AVIF | Converted by script |
| Slow LCP | Preload hero image | Manual editorial tagging |
