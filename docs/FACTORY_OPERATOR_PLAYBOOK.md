# Factory project setup and validation

The factory supports local setup, media inventory, FilmSpec validation, and screen-only preview rendering. Package 3 verifies the pipeline with labeled synthetic material. Client rendering requires licensing and privacy clearance, and production delivery still has separate gates.

## Requirements

- Install the repository's pinned pnpm dependencies and use a supported Node version. The commands were tested in PowerShell 5.1 and 7 with Node 24 and pnpm 12.
- Put FFprobe on PATH for scans. FFmpeg is also used by the synthetic integration suite. Check with `ffprobe -version` and `ffmpeg -version`.
- On Windows the scanner uses Windows PowerShell 5.1 and a local filesystem supporting access-time suppression and hard links. Keep the report destination outside the input project. Allow scratch disk space for the input catalog during probing.
- Rendering uses FFmpeg, FFprobe and the local Chromium executable pinned by the Remotion setup. Set the process-level UVF_CHROMIUM_EXECUTABLE to an installed executable if the standard local location differs. The render path uses no browser downloads or external assets. Keep preview and scratch space on D: on the reference host.

## Start a project

Run from the studio-engine checkout in PowerShell 5.1 or 7.

```powershell
Set-Location 'D:\AntiGravity\Studio\studio-engine'
pnpm factory init --name first-app --template mobile-app
# Add your stills and recordings to projects/first-app/assets/screenshots.
# Edit projects/first-app/brief.json to select the actual filenames.
pnpm factory scan --project 'projects/first-app'
pnpm factory validate --project 'projects/first-app'
```

The setup command reuses an existing case variant of the projects folder. It requires a new project name and creates a brief, a project README, and the screenshots, logo, and audio subfolders. The scaffold references two placeholder filenames. Add media and edit the brief before validating. To create a project outside the checkout, add `--parent 'D:\My Client Projects'` to init.

## Use an existing project

Scan a catalog without first creating a brief. With a custom media folder, pass its project-relative path through `--assets-dir`. Validate using the brief already in the project or use `--brief` for an external brief.

```powershell
pnpm factory scan --project 'D:\My Client Projects\existing-app' --out 'D:\Factory Reports\existing-app'
pnpm factory validate --project 'D:\My Client Projects\existing-app' --brief 'D:\My Drafts\existing.brief.json' --out 'D:\Factory Reports\existing-app'
```

The default destination is the ignored out/factory directory under the studio-engine checkout, with a folder keyed by project location. The CLI prints absolute paths to content-addressed manifest and plan files. Identical reports reuse the same filename. The manifest includes an inventory of all readable candidates, and the plan binds just the hero and feature selections.

## Brief v2

The brief is UTF-8 JSON. Unknown keys and unsupported schema versions fail validation with field paths. Asset references match the catalog's exact filename, including casing, and are relative to assets.directory. Windows-style separators in input paths are normalized to slashes. Assets may be organized in subfolders. Absolute paths, parent traversal, Windows reserved names, symlinks, and junctions are rejected or skipped with a diagnostic.

```json
{
  "schemaVersion": "2",
  "id": "first-app",
  "brand": { "name": "Example App", "color": "#2997ff" },
  "hook": "See the workflow",
  "hero": "home.jpg",
  "features": [
    {
      "title": "Explore the controls",
      "body": "See how the example workflow starts.",
      "asset": "recordings/feature.mp4",
      "trim": { "startSeconds": 1, "endSeconds": 4 }
    }
  ],
  "cta": "Explore the app",
  "assets": { "directory": "assets/screenshots" },
  "locale": "en",
  "look": "keynote",
  "durationSeconds": 15,
  "fps": 60,
  "aspectRatios": ["9:16", "16:9", "1:1"]
}
```

- Use a lowercase kebab-case id of up to 64 characters, one to six features, and nonempty copy of up to 240 characters per text field. Supported looks are keynote and cyber.
- Default locale is en, default look is keynote, and default duration is 15 seconds. Duration is 6–90 whole seconds, at 30 or 60 fps. The default output selects all three core ratios. Locale is currently planning metadata.
- Trim is optional on features and applies only to video. Times are in source seconds. End must be after start and within the probed duration. Untrimmed videos pass their full source window to the plan. Shot duration and source window remain separate for the render adapter.
- V1 compatibility accepts an explicitly versioned flat brief with id, appName, appColor, hook, cta, screenshots, and features with title, subtitle, and screenshot. Optional assetDirectory and aspectRatios carry forward. The first screenshots entry becomes the hero, and feature paths must appear in that catalog. Migration occurs in memory. The plan records the original brief version. The client brief and engine FilmSpec use separate schema versions.

## Render a preview

Add a renderRights object to the v2 brief after confirming the rights and privacy status. Set origin to synthetic for generated test media or client for cleared client media, set approved to true, and record meaningful license and privacy notes. This is an operator declaration. A clean media scan alone supplies no clearance.

```json
{
  "renderRights": {
    "origin": "synthetic",
    "approved": true,
    "license": "Original generated interface and animation for the acceptance test",
    "privacy": "Generated labels and numbers without client or personal data"
  },
  "heroPresentation": { "fit": "contain" }
}
```

Merge the fields above into the existing brief. A feature can carry its own presentation. The fit accepts contain for the entire cropped source with padding, and cover for filling the screen slot with additional edge cropping. Crop is optional and takes x, y, width and height as fractions of the original source, with origin at its top left. Focal is optional and takes x and y within the selected crop. Both axes are in the range 0–1, with 0.5 at center. The renderer clamps the focal offset at the crop edges. Use contain when every UI label needs to remain visible.

```powershell
pnpm factory scan --project 'projects/first-app'
pnpm factory validate --project 'projects/first-app'
pnpm factory render --project 'projects/first-app' --ratios '16:9,9:16,1:1' --profile preview
pnpm factory render --project 'projects/first-app' --ratios '1:1' --profile preview --frame 30
```

The CLI uses the same brief and validation on each invocation, checks the selected hashes and fully decodes the chosen sources before rendering. It accepts the same --brief and --out options as validate. Omit ratios to render every ratio in the brief. With --frame, the zero-based index writes a lossless diagnostic PNG. Without it, the preview writes native-resolution silent H.264 MP4s with limited-range BT.709 and verifies stream properties, constant packet spacing and full decode. The CLI publishes the batch and its render report together, in a new output directory.

Recordings use a composition-rate frame grid and trim start inclusive, end exclusive. A shot longer than the trimmed source holds its last available frame. The screen layer draws numbered local images and waits for decoding through Remotion. Recording audio is omitted. The screen slot and overlay layout have separate safe areas. If a brief's copy overflows on a target ratio, shorten it and retry. A tightly configured crop can still cut text already present inside the source image.

The preview supports square-pixel recordings with SDR BT.709 or sRGB-compatible tags. Untagged videos use FFmpeg's SDR decode defaults. Screenshots retain the original browser-decoded image and its embedded profile. General ICC/EXIF conformance, HDR or wide-gamut recordings, mix/master audio, device treatments and production master profiles are separate work.

## Studio Cut editorial template

Select the opt-in Studio Cut profile in a v2 client brief. It uses the same `factory validate` and `factory render` commands. Set `fps` to 30, choose 12–16 seconds, and specify two to four feature beats. Each feature can have a short `label` for the on-screen category. The template selects the `studio` look, plans a hook, a proposition, two or more product beats, and a sustained end card. Preview a short headline with supporting copy in all delivery ratios. The renderer stops if copy cannot fit its assigned region.

```json
{
  "editorial": {
    "template": "studio-cut-v1",
    "productLabel": "Field planning",
    "proposition": { "title": "Give every visit a plan.", "body": "Routes, observations, and handoffs in one workspace." },
    "closingLine": "Field planning for teams on the move.",
    "logo": "mark.png",
    "audio": { "file": "score.wav", "gainDb": 0, "license": "Original score, cleared for this delivery" },
    "motion": "measured",
    "heroFraming": { "9:16": { "fit": "contain", "crop": { "x": 0.42, "y": 0.12, "width": 0.55, "height": 0.70 } } },
    "safeAreas": { "9:16": { "top": 0.10, "right": 0.095, "bottom": 0.18, "left": 0.075 } }
  }
}
```

Merge the object into a valid brief with affirmative `renderRights`. Put the transparent PNG in `assets/logo` and the audio bed in `assets/audio`. Paths in the brief are relative to those directories. The score license belongs in `editorial.audio.license`. Keep a separate record of author, source, supported uses, and hash with the project. Validate checks that both assets are present within their designated directories. The renderer snapshots and verifies the logo before capture. Full MP4 jobs also decode and check the audio.

Studio Cut swaps headline and screen placement as the sequence advances. Per-ratio `features[].framing` and `editorial.heroFraming` override the base media presentation. The proposition can declare `asset`, `presentation`, and `framing`, and defaults to the hero. Insets are fractions of the output frame and default to platform-aware values. Use `expressive` for a larger camera movement and stronger still-media entrance. Brand color tints the ceramic stage and media edge. The client mark lands on a light plaque independent of the chosen brand color.

```powershell
pnpm factory validate --project 'D:\My Client Projects\fieldnote' --out 'D:\Factory Reports\fieldnote'
pnpm factory render --project 'D:\My Client Projects\fieldnote' --ratios '16:9,9:16,1:1' --frames '0,26,85,160,252,360,419' --out 'D:\Factory Reports\fieldnote'
pnpm factory render --project 'D:\My Client Projects\fieldnote' --ratios '16:9,9:16,1:1' --profile preview --out 'D:\Factory Reports\fieldnote'
```

Use `--frames` for up to 24 distinct zero-based indices. It produces PNGs without preparing audio. The regular full render uses one cleared music bed. Build or select it against `editorial.cues` in the validated plan. For a 14-second, two-feature brief those cues are frames 0, 60, 135, 225 and 330. Other durations and feature counts produce their own cut list. Allow enough music for the entire film. The factory applies a short head and tail fade, accepts an attenuation from 0 to −24 dB, and enforces −1 dBTP headroom and a broad −60 to −10 LUFS guard. It muxes frame-aligned 48 kHz stereo AAC without re-encoding picture. It does not analyze musical downbeats or mix recording audio, speech or effects. Read the output receipt for the measured loudness, selected logo and audio hashes and published file hashes.

### Agent-neutral operation

Any caller can write the same versioned JSON to a local project and run `factory scan`, `validate` and `render`. Retain creative treatment and approval records separately. The brief holds approved choices, the compiled plan describes frame timing, and objective QA comes from the render receipt and local tests. Callers should handle process exit codes and collect the emitted paths. Existing v1 migration and v2 briefs without `editorial` keep their established workflow and silent preview output. This profile has been exercised through the local CLI. Cross-agent clean-checkout tests, a machine-readable CLI result protocol, and portable support-matrix evidence remain future work.

## Review results and failures

- Accepted media extensions are JPG, JPEG, PNG, WebP, MP4, and MOV. Scan records codec, profile, container, dimensions, available rotation and color tags, video duration and average fps, audio stream count, byte count and SHA-256. Byte-identical duplicates point to the earliest path in the sorted catalog. The scan assesses metadata and can detect probe failures. It does not certify full decoding, ICC/EXIF color interpretation, or visual suitability.
- Warnings flag duplicate bytes, a short edge below 720 pixels, extreme aspect ratios, unsupported extensions, and missing color tags. Review warnings before choosing assets. The scan returns nonzero for broken supported inputs and writes a diagnostic manifest where possible. Validate requires a usable, unambiguous catalog and every selected asset to be readable. An unreadable candidate outside the selected subset remains visible in the scan diagnostics.
- Licensing and privacy are unverified. Keep client media, briefs, and reports local and out of commits. The SaveFix trial used an external technical brief and kept all originals in place. No clearance was granted by the metadata scan.
- If an input is still copying, finish the copy and rerun. For a missing asset, update the exact name or add the file to the configured directory. An existing project name requires a different scaffold name. If Windows cannot obtain an access-preserving handle, close tools holding the file or correct local access and retry. Use an NTFS report folder outside the project if hard-link publication fails.

## Verification commands

```powershell
pnpm typecheck
pnpm run build
pnpm lint
pnpm test
pnpm test:factory
pnpm test:factory-render
```

Metadata fields, access-time behavior and image readiness follow the installed toolchain. [FFprobe documentation](https://ffmpeg.org/ffprobe.html) · [Windows access-time suppression](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfiletime) · [Remotion Img](https://www.remotion.dev/docs/img)
