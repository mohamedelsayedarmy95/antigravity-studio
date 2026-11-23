# Creative Acceptance Gates

Use the [production constitution](PRODUCTION_CONSTITUTION.md) and [cinematic review standard](CINEMATIC_QUALITY_STANDARD.md) alongside these CLI gates.

| Lifecycle profile | Factory integration | Required result |
| --- | --- | --- |
| Draft / Preview (`preview`) | Default render or `--production preview`. Supports full output, stills, and ranges at the brief's supported rate. | Compiled timeline, referenced media inside local boundaries, and an affirmative render-rights declaration. Encoded previews receive stream and timing checks. Narration and destination-specific loudness targets are optional. |
| Silent Picture Lock (`silent-picture`) | `--production silent-picture`. Existing `--profile master` selects it for non-editorial briefs. | Full 30 fps H.264 High SDR MP4 at native aspect dimensions, exact duration, no audio stream, two matching decoded PNG frame samples and one encoded-picture contact sheet per aspect. Technical acceptance requires a visual-review record. Creative approval remains pending. |
| Final Audio Master (`final-audio`) | `--production final-audio`. Existing `--profile master` selects it for editorial briefs. Final handoff uses `factory deliver --release --evidence`. | The picture contract plus 48 kHz stereo AAC, sample-zero start, sample-exact duration, measured loudness and true peak against requested limits, audio source hashes and rights references, visual and sync reviews, and the director's separate approval record. |

Both masters use the existing Factory Master encoder. The brief sets the duration and aspects. Choose final loudness and peak limits for the intended destination within the current audio guard of −60 to −10 LUFS and at most −1 dBTP. This contract covers the existing MP4/H.264/AAC outputs. Other codecs and HDR require their own profile and validation.

## Commands

```powershell
pnpm validate:production --film 'D:\Specs\film.json'
pnpm validate:production --project 'D:\Projects\film' --production silent-picture --out 'D:\Reports'
pnpm factory render --project 'D:\Projects\film' --production silent-picture --out 'D:\Reports'
pnpm factory render --project 'D:\Projects\film' --production final-audio --out 'D:\Reports'
pnpm validate:production --master 'D:\Reports\master-batch\film-1x1.mp4' --evidence 'D:\Private\review.json'
pnpm factory deliver --master 'D:\Reports\master-batch\film-1x1.mp4' --out 'D:\Local Handoff' --release --evidence 'D:\Private\review.json'
```

FilmSpec preflight uses the existing compiler. It resolves logo SVGs under the checkout's `public` directory by default. Use `--public-dir` for a different local asset root. Project validation uses the ordinary Factory scan and plan path. Legacy `factory validate` remains available for ingestion, including v1 brief migration. Older masters remain eligible for the original `factory deliver` local-review derivative. A governed handoff requires a fresh master with production evidence. Remotion and the diagnostic scripts remain available for development captures.

## Evidence record

Keep the JSON private and copy the exact aspect's MP4 SHA-256 from the render report. The following example describes a final-audio job. For silent picture lock, use `schemaVersion`, `masterSha256`, and `visualReview`.

```json
{
  "schemaVersion": "1",
  "masterSha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "visualReview": { "reviewer": "Reviewer name", "notes": "Reviewed this aspect at delivery and mobile size" },
  "creativeApproval": { "director": "Owner or director name", "decision": "approved" },
  "audioRightsReference": "Private provenance record for the bed and every cue",
  "synchronizationReview": "Compared cue timing against playback of this exact master",
  "audioLimits": { "minLufs": -20, "maxLufs": -16, "maxTruePeakDbtp": -1.5 }
}
```

Master renders compare decoded PNG pixels before publishing the batch. Acceptance rechecks the master bytes, frame and stream conformance, and nearby evidence files. One sampled frame per aspect checks repeatability at that frame under the current render configuration. Use adjacent frames and broader motion tests when diagnosing flicker.

Operator declarations and review records attest to decisions by the named people. The CLI checks the record and its association with the media hash. Authentication of reviewers, independent legal clearance, and the creative decision remain human responsibilities. Final handoff copies the verified master locally. Publication requires a separate clearance decision.

## Human authorization and audio rights

Technical validation checks the evidence structure and its link to the master hash. A JSON `"approved"` decision records a creative approval declaration. An authenticated authorization comes from a human-controlled channel or account outside the agent-controlled workspace. Agents must never create or infer a Director decision, certify their own work on the Director's behalf, or impersonate the Director.

For an external handoff that requires Director authorization, the Director reviews the exact master and confirms its SHA-256 and the release decision through that independent channel. Confirm the decision and the release operator's authority outside the workspace. A changed master hash invalidates earlier approval. A missing or unverifiable approval means **NO-GO** for that handoff. Channel selection is **PENDING** until the Director designates it.

Audio hashes identify the bytes used. License declarations and source metadata record claimed provenance. Before external release, the responsible human checks the rights for the bed and every cue against the intended use. Missing rights evidence remains **PENDING** and blocks any release that requires clearance.

`factory deliver --release` creates a local handoff with a technical receipt. Public publication requires separate authorization. On the Windows reference workstation, use the [verified D: scratch procedure](FACTORY_OPERATOR_PLAYBOOK.md#verify-a-master-on-the-windows-reference-workstation) before running standalone master validation.
