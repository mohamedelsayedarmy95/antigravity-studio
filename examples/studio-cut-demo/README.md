# Relay cinematic example

Relay is an original synthetic route-planning demo. Its source depicts a local route assignment. At recording frame 42, the route record changes from awaiting assignment to assigned. The brief aligns the result copy, lighting response, and original confirmation sound to that same source frame.

Generate the demo in a local directory outside this repository. The generator uses Python with Pillow, two local Arial font files, and FFmpeg on PATH. It synthesizes the sound bed and cue, draws the screens and mark, and encodes the recording. Set `--font-directory` if the fonts are installed elsewhere. The factory uses the same local Chromium and FFmpeg setup as the [operator playbook](../../docs/FACTORY_OPERATOR_PLAYBOOK.md).

```powershell
$project = 'D:/VeloraFrame/relay'
python examples/studio-cut-demo/prepare.py $project
pnpm factory validate --project $project --out 'D:/VeloraFrame/relay-plan'
pnpm factory render --project $project --ratios 9:16 --profile master --out 'D:/VeloraFrame/relay-master'
```

The brief uses `artDirection: "obsidian"` with expressive Studio Cut v2. Both swept surfaces use the existing 3D stage and a bounded mesh budget. The screen and its annotations retain their shared crop and playback coordinates. The optional style works with all three established aspect layouts. To compare the original expressive staging, render the same range with `--brief "$project/baseline-brief.json"`. Use `--range 193:262` for the representative comparison or `--frames "25,235,326"` for three stills. Keep generated media local.
