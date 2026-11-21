# Factory project setup and validation

Package 2 supports local project setup, media inventory, and a timing plan from the FilmSpec compiler. The workflow ends at a validated plan. The render adapter, media normalization, finishing, and delivery QA are later packages.

## Requirements

- Install the repository's pinned pnpm dependencies and use a supported Node version. The commands were tested in PowerShell 5.1 and 7 with Node 24 and pnpm 12.
- Put FFprobe on PATH for scans. FFmpeg is also used by the synthetic integration suite. Check with `ffprobe -version` and `ffmpeg -version`.
- On Windows the scanner uses Windows PowerShell 5.1 and a local filesystem supporting access-time suppression and hard links. Keep the report destination outside the input project. Allow scratch disk space for the input catalog during probing.

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
```

Metadata fields and access-time behavior follow the installed toolchain. [FFprobe documentation](https://ffmpeg.org/ffprobe.html) · [Windows access-time suppression](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfiletime)
