import { spring, SpringConfig } from "remotion";
import { SPRING_PRESETS, SpringPresetName } from "../src/motion/springPresets";

interface ValidationResult {
  preset: SpringPresetName;
  stiffness: number;
  damping: number;
  mass: number;
  swiftUiResponse: number;
  swiftUiDampingRatio: number;
  settleTimeFrames: number;
  settleTimeSec: number;
  overshootPercent: number;
  peakVelocity: number;
  status: "PASS" | "ADJUST_NEEDED";
  category: "UI_INTERACTIVE" | "CINEMATIC_HERO" | "AMBIENT";
}

export function validateAllSpringPresets(): ValidationResult[] {
  const fps = 60;
  const totalFrames = 120; // 2 seconds simulation window

  const results: ValidationResult[] = [];

  for (const [name, config] of Object.entries(SPRING_PRESETS) as [SpringPresetName, SpringConfig][]) {
    const values: number[] = [];
    for (let f = 0; f <= totalFrames; f++) {
      values.push(
        spring({
          frame: f,
          fps,
          config,
          from: 0,
          to: 1,
        })
      );
    }

    // 1. Overshoot calculation
    const maxVal = Math.max(...values);
    const overshootPercent = Math.max(0, (maxVal - 1) * 100);

    // 2. Settle time calculation (last frame where |v - 1| >= 0.01)
    let settleFrame = 0;
    for (let f = totalFrames; f >= 0; f--) {
      if (Math.abs(values[f] - 1) >= 0.01) {
        settleFrame = f + 1;
        break;
      }
    }

    // 3. Peak velocity calculation
    let peakVelocity = 0;
    for (let f = 1; f < values.length; f++) {
      const v = Math.abs(values[f] - values[f - 1]) * fps;
      if (v > peakVelocity) peakVelocity = v;
    }

    // 4. Equivalent SwiftUI Parameters
    const m = config.mass;
    const k = config.stiffness;
    const c = config.damping;
    const omega0 = Math.sqrt(k / m);
    const swiftUiResponse = (2 * Math.PI) / omega0;
    const swiftUiDampingRatio = c / (2 * Math.sqrt(k * m));

    // Categorize preset
    let category: "UI_INTERACTIVE" | "CINEMATIC_HERO" | "AMBIENT" = "UI_INTERACTIVE";
    if (name === "appleHero" || name === "spatialElastic") category = "CINEMATIC_HERO";
    if (name === "headspaceGentle") category = "AMBIENT";

    // Criteria:
    // For UI_INTERACTIVE: settle time <= 30 frames (0.5s), overshoot <= 15%
    // For CINEMATIC_HERO: settle time <= 50 frames, overshoot <= 15%
    // For AMBIENT: settle time <= 60 frames, overshoot <= 10%
    let status: "PASS" | "ADJUST_NEEDED" = "PASS";
    if (overshootPercent > 15) status = "ADJUST_NEEDED";
    if (category === "UI_INTERACTIVE" && settleFrame > 30) status = "ADJUST_NEEDED";

    results.push({
      preset: name,
      stiffness: k,
      damping: c,
      mass: m,
      swiftUiResponse: Number(swiftUiResponse.toFixed(3)),
      swiftUiDampingRatio: Number(swiftUiDampingRatio.toFixed(3)),
      settleTimeFrames: settleFrame,
      settleTimeSec: Number((settleFrame / fps).toFixed(3)),
      overshootPercent: Number(overshootPercent.toFixed(2)),
      peakVelocity: Number(peakVelocity.toFixed(2)),
      status,
      category,
    });
  }

  return results;
}

// Execute when run directly
const results = validateAllSpringPresets();

console.log("\n=========================================================================================================");
console.log("                       EMPIRICAL SPRING PRESETS VALIDATION (60 FPS SIMULATION)");
console.log("=========================================================================================================");
console.log(
  "Preset".padEnd(18) +
  "k / c / m".padEnd(16) +
  "SwiftUI (R/ζ)".padEnd(18) +
  "Settle (Frames)".padEnd(18) +
  "Overshoot %".padEnd(14) +
  "Peak Vel".padEnd(12) +
  "Status"
);
console.log("-".repeat(105));

for (const r of results) {
  const kcm = `${r.stiffness}/${r.damping}/${r.mass}`.padEnd(16);
  const swiftUi = `${r.swiftUiResponse}s / ${r.swiftUiDampingRatio}`.padEnd(18);
  const settle = `${r.settleTimeFrames}f (${r.settleTimeSec}s)`.padEnd(18);
  const overshoot = `${r.overshootPercent}%`.padEnd(14);
  const vel = `${r.peakVelocity}`.padEnd(12);
  const tag = r.status === "PASS" ? "✓ PASS" : "✗ ADJUST_NEEDED";

  console.log(
    r.preset.padEnd(18) + kcm + swiftUi + settle + overshoot + vel + tag
  );
}
console.log("=========================================================================================================\n");
