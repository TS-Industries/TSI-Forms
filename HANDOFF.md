# TSI Checklist App — Handoff for Claude Code

**Repo:** `github.com/TS-Industries/TSI-Forms`
**Live file:** `checklist.html` (on `main` branch, served via GitHub Pages at `ts-industries.github.io/TSI-Forms/checklist.html`)
**Backend:** Supabase (`overhaul_data` table, project `skbdamrynkzxdfjhmawj.supabase.co`)
**File size:** ~6,812 lines, single-file HTML/JS/CSS

## Status

All work order data-bleed bugs are fixed and verified (WO-2026-001 and WO-2026-002 load correctly and independently). Current focus is the **Customer Report PDF Export** — specifically photo quality.

## What was just fixed (uncommitted / not yet deployed)

A prior fix attempt tried to enlarge photo `<img>` elements to their natural resolution (up to 1600px, per `MAX_DIM` in `compressImage()`) right before the `html2canvas` capture. This was flawed: `.rpt-photo-item` (the parent grid box) has `max-width:160px` with no override, so blowing photos up to full size would have overflowed the grid and broken layout across every page had it actually run.

**Replacement approach implemented in `exportReportPDF()` (around line 5154):**
1. Capture the page normally via `html2canvas` at the existing thumbnail sizes — this preserves correct layout/pagination (unchanged from before).
2. After the base PDF pages are built, loop over every `.rpt-photo-item img`, compute its position within the modal (`offsetRel()` helper — walks the `offsetParent` chain rather than `getBoundingClientRect()`, since html2canvas renders as if scrolled to top regardless of actual scroll position).
3. For each photo, crop the *real* full-resolution source image to match the displayed aspect ratio (replicating the `object-fit: cover` behavior), draw it into an offscreen canvas capped at 900px wide, and `pdf.addImage()` it directly onto the correct PDF page at the exact same x/y/width/height as the thumbnail — effectively painting a sharp image on top of the blurry one underneath.
4. Photos that straddle a page break are skipped (rare edge case) and fall back to the base low-res render.

**Also added:** `crossorigin="anonymous"` to all three `<img>` tags that render report photos (load bank run photos, pre-overhaul condition photos, main measurement photo gallery). This is required — without it, `ctx.drawImage()` + `canvas.toDataURL()` on a cross-origin Supabase Storage image throws a `SecurityError` (tainted canvas), and step 3 above would silently fail via the try/catch. Supabase's public storage URLs already send permissive CORS headers, so this should work without any backend changes.

## Known open items

1. **Not yet pushed to GitHub.** The fixed file is sitting locally — needs `git add`, commit, push to `main`.
2. **Caching risk.** A test PDF generated earlier in this debugging session showed *neither* of two independent pending fixes (this photo fix, and a separate "hide instruction text in Overall Summary box" fix — see below) taking effect, even though both were confirmed present in the deployed source at the time. Strong signal that GitHub Pages / browser was serving a stale cached copy — the same issue that originally prompted temporarily renaming the file to `checklist-v2.html` to bust cache. **After pushing this fix, hard-refresh (or test in incognito) before concluding anything is still broken.**
3. **"Hide instruction text" fix** (in the Overall Summary box on the Customer Report — the "All technician notes from every section are automatically pulled in below..." text) — code for this already exists at ~line 5184-5189 (`modal.querySelectorAll('.ai-summary-box > p, .ai-summary-box > small, .ai-summary-box > div:not(.ai-badge)')` filtered on text content). Logic looks correct; wasn't confirmed working in the last test PDF, likely for the same caching reason as #2.
4. **Confirm Export PDF / Print / Close buttons don't appear on the last page of the exported PDF.** Code hides `.report-actions` before capture (line ~5166-5167) — should already work, but hasn't been visually confirmed in a fresh export.

## To verify once deployed

Run **Export PDF** on WO-2026-001 (Whitecap Resources, 40,000 hrs, 9 failed measurements — has photos across Crankshaft, Con Rod Bearings, Cylinder Liner, Cylinder Head, and Oil Pump sections, so it's a good test case for the photo fix specifically). Check:
- Photos are sharp, not blurry/pixelated
- No visible layout distortion in the photo grid
- Overall Summary box doesn't show the instruction text
- No stray buttons on the final PDF page

## File handling notes

- **Do NOT** open and save the live file with Ctrl+S from a browser — this has corrupted it before.
- Deploy via GitHub **Add file → Upload files** (drag-and-drop) or, in Claude Code, a normal `git commit` + `git push` to `main`.
- PDF filename convention: `TSI-{WO#}-Overhaul-Report.pdf`

## Current workspace verification

- `checklist.html` is present in the workspace and contains the photo export fix described in this handoff.
- Git repository is clean and up to date on `main` with no unstaged changes.
- `exportReportPDF()` already hides `.report-actions` before capture and restores it afterward.
- The AI summary hide selector matches the current summary text and should suppress the instruction paragraph during PDF export.
- `crossorigin="anonymous"` is applied to the report photo `<img>` elements used by `buildPhotoGallery()`, `buildPreOverhaulReportSection()`, and the load bank run photo section.

## Recommended next steps

1. Open `checklist.html` in the browser and load WO-2026-001.
2. Open the Customer Report and click **Export PDF**.
3. Verify sharpness of embedded report photos, no hidden instructions visible, and no UI buttons on the saved PDF.
4. If output still looks stale, hard-refresh or use an incognito window to rule out GitHub Pages/browser cache.
