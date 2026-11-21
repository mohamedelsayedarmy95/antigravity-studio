import * as fs from "fs";
import * as path from "path";

interface FrameLog {
  frame: number;
  timeMs: number;
}

function parseVerboseLog(logPath: string): FrameLog[] {
  const buf = fs.readFileSync(logPath);
  let content = "";
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    content = buf.toString("utf16le");
  } else {
    content = buf.toString("utf8");
  }

  const regex = /Setting the current frame to (\d+)" handle was cleared after (\d+)ms/g;
  const frames: FrameLog[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    frames.push({
      frame: parseInt(match[1], 10),
      timeMs: parseInt(match[2], 10),
    });
  }

  return frames;
}

function analyzeScene(name: string, frames: FrameLog[]) {
  if (frames.length === 0) {
    console.log(`${name}: No frames captured`);
    return { passRate: 0, avg: 0, peak: 0, count: 0 };
  }

  const times = frames.map((f) => f.timeMs);
  const under16 = times.filter((t) => t <= 16.67).length;
  const passRate = (under16 / times.length) * 100;
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const peak = Math.max(...times);

  // 95th percentile
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || peak;

  console.log(
    `| **${name}** | ${times.length} | ${avg.toFixed(2)}ms | ${p95.toFixed(2)}ms | ${peak}ms | **${passRate.toFixed(2)}%** | ${passRate >= 90 ? "PASSED" : "FAILED"} |`
  );

  return { passRate, avg, peak, count: times.length };
}

function main() {
  const targetFile = process.argv[2] || "out/device-render.log";
  const logPath = path.isAbsolute(targetFile)
    ? targetFile
    : path.resolve(process.cwd(), targetFile);
  if (!fs.existsSync(logPath)) {
    console.error(`Log not found at: ${logPath}`);
    process.exit(1);
  }

  const frames = parseVerboseLog(logPath);
  console.log(`\n### DeviceShowcase Frame Performance Analysis (${frames.length} samples recorded)\n`);
  console.log(`| Scene Name | Samples | Avg Render Time | 95th Percentile | Peak Frame | Pass Rate (<=16.67ms) | Status |`);
  console.log(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);

  // Breakdown by scene
  const scene1 = frames.filter((f) => f.frame < 140);
  const scene2 = frames.filter((f) => f.frame >= 140 && f.frame < 280);
  const scene3 = frames.filter((f) => f.frame >= 280 && f.frame < 440);
  const scene4 = frames.filter((f) => f.frame >= 440);

  analyzeScene("Scene 1: Front Hero Reveal (0-140)", scene1);
  analyzeScene("Scene 2: 3/4 Spatial Tilt (140-280)", scene2);
  analyzeScene("Scene 3: Hardware Turnaround (280-440)", scene3);
  analyzeScene("Scene 4: Screen Swap + Dynamic Island (440-600)", scene4);
  analyzeScene("Aggregate Composition (All 600 Frames)", frames);
}

main();
