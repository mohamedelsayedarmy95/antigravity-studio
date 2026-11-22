import { createHash } from "node:crypto";
import { link, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { defaultAssetDirectory, isPortablePath, parseBrief, starterBrief } from "../src/engine/client/brief";
import { planProject } from "../src/engine/client/plan";
import type { AspectId } from "../src/stage3d/schema";
import { isWithin, scanProject } from "./lib/client-media";

const root = path.resolve(import.meta.dirname, "..");
const usage = [
  "pnpm factory init --name <new-project> --template mobile-app [--parent <folder>]",
  "pnpm factory scan --project <folder> [--assets-dir <relative-folder> | --brief <file>] [--out <folder>]",
  "pnpm factory validate --project <folder> [--brief <file>] [--out <folder>]",
  "pnpm factory render --project <folder> [--brief <file>] [--ratios 16:9,9:16,1:1] [--profile preview] [--frame <number>] [--out <folder>]",
].join("\n");
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";

async function createProject(name: string, parent?: string) {
  const brief = starterBrief(name);
  const conventional = (await readdir(root)).filter((entry) => entry.toLowerCase() === "projects");
  if (!parent && conventional.length > 1) throw new Error("Multiple project roots match projects. Pass --parent explicitly.");
  const base = parent ? path.resolve(parent) : path.join(root, conventional[0] ?? "projects");
  await mkdir(base, { recursive: true });
  const destination = path.join(await realpath(base), name);
  if ((await readdir(base)).some((existing) => existing.toLowerCase() === name)) {
    throw new Error("Project already exists: " + destination + ". Choose a new --name.");
  }
  await mkdir(destination);
  const createdFiles: string[] = [];
  const createdDirs: string[] = [destination];
  try {
    for (const directory of ["assets", defaultAssetDirectory, "assets/logo", "assets/audio"]) {
      const fullPath = path.join(destination, directory);
      await mkdir(fullPath);
      createdDirs.push(fullPath);
    }
    for (const [file, content] of [
      ["brief.json", json(brief)],
      ["README.md", "# Client project\n\nPlace your screenshots and recordings in assets/screenshots. Update the relative hero and feature asset filenames in brief.json, then run factory scan and validate from the studio-engine checkout. The starter names are placeholders.\n"],
    ]) {
      const fullPath = path.join(destination, file);
      await writeFile(fullPath, content, { flag: "wx" });
      createdFiles.push(fullPath);
    }
  } catch (error) {
    for (const file of createdFiles) await unlink(file);
    for (const directory of createdDirs.reverse()) await rmdir(directory);
    throw error;
  }
  console.log("Project created at " + destination);
  console.log("Edit " + path.join(destination, "brief.json") + " after adding screens to " + path.join(destination, defaultAssetDirectory));
}

async function loadBrief(file: string, optional: boolean) {
  let content: string;
  try {
    content = await readFile(file, "utf8");
  } catch (error) {
    if (isMissing(error) && optional) return null;
    if (isMissing(error)) throw new Error("Brief missing at " + file + ". Use factory init for a new project or pass --brief.");
    throw error;
  }
  try {
    return parseBrief(JSON.parse(content.replace(/^\uFEFF/, "")));
  } catch (error) {
    throw new Error(file + "\n" + (error as Error).message);
  }
}

async function resolveEvidenceDirectory(project: string, output: string): Promise<string> {
  const absolute = path.resolve(output);
  if (isWithin(project, absolute)) throw new Error("Reports must be written outside the input project. Choose a different --out folder.");
  // Resolve the nearest existing ancestor before making directories. This catches links to inputs.
  let ancestor = absolute;
  for (;;) {
    try {
      await lstat(ancestor);
      break;
    } catch (error) {
      if (!isMissing(error)) throw error;
      ancestor = path.dirname(ancestor);
    }
  }
  const destination = path.join(await realpath(ancestor), path.relative(ancestor, absolute));
  if (isWithin(project, destination)) throw new Error("Report destination resolves inside the input project.");
  await mkdir(destination, { recursive: true });
  return destination;
}

async function publish(directory: string, name: string, value: unknown) {
  const text = json(value);
  const filename = path.join(directory, name + "-" + sha256(text) + ".json");
  const scratch = await mkdtemp(path.join(directory, ".report-"));
  const file = path.join(scratch, "report.json");
  try {
    await writeFile(file, text, { flag: "wx" });
    try {
      // Link only complete data, with no replacement of an existing report.
      await link(file, filename);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" ||
          !(await lstat(filename)).isFile() || await readFile(filename, "utf8") !== text) throw error;
    }
  } finally {
    try { await unlink(file); } catch (error) { if (!isMissing(error)) throw error; }
    await rmdir(scratch);
  }
  console.log((name === "manifest" ? "Manifest" : "Plan") + ": " + filename);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === undefined || command === "--help" || (args.length === 1 && args[0] === "--help")) {
    console.log(usage);
    return;
  }
  if (command === "init") {
    const { values } = parseArgs({ args, options: { name: { type: "string" }, template: { type: "string" }, parent: { type: "string" } } });
    if (!values.name || (values.template ?? "mobile-app") !== "mobile-app") throw new Error(usage);
    await createProject(values.name, values.parent);
    return;
  }
  if (command !== "scan" && command !== "validate" && command !== "render") throw new Error(usage);

  const { values } = parseArgs({
    args, options: {
      project: { type: "string" }, brief: { type: "string" }, "assets-dir": { type: "string" }, out: { type: "string" },
      ratios: { type: "string" }, profile: { type: "string" }, frame: { type: "string" },
    },
  });
  if (!values.project || (values["assets-dir"] !== undefined && (command !== "scan" || values.brief !== undefined)) ||
      (command !== "render" && (values.ratios !== undefined || values.profile !== undefined || values.frame !== undefined))) throw new Error(usage);
  const project = await realpath(values.project);
  if (!(await lstat(project)).isDirectory()) throw new Error("--project must be a directory");
  const brief = values["assets-dir"] === undefined
    ? await loadBrief(path.resolve(values.brief ?? path.join(project, "brief.json")), command === "scan" && values.brief === undefined)
    : null;
  if (command === "render") {
    if (!brief?.brief.renderRights) throw new Error("Render requires a renderRights declaration in the brief covering licensing and privacy");
    if (values.profile !== undefined && values.profile !== "preview") throw new Error("Package 3 supports --profile preview");
    if (values.frame !== undefined && !/^(?:0|[1-9]\d*)$/.test(values.frame)) throw new Error("--frame must be a nonnegative frame index");
  }
  const assetDirectory = (values["assets-dir"] ?? brief?.brief.assets.directory ?? defaultAssetDirectory).replaceAll("\\", "/");
  if (!isPortablePath(assetDirectory)) throw new Error("Asset directory must be a portable project-relative path.");
  const output = await resolveEvidenceDirectory(project, values.out ?? path.join(root, "out", "factory", sha256(project).slice(0, 16)));
  const manifest = await scanProject(project, assetDirectory, output);
  await publish(output, "manifest", manifest);
  const errors = manifest.diagnostics.filter((item) => item.severity === "error");
  console.log("Scanned " + manifest.assets.length + " readable assets, " + errors.length + " errors and " +
    (manifest.diagnostics.length - errors.length) + " warnings. Licensing and privacy are unverified.");
  for (const issue of errors) console.error(issue.code + " " + issue.path + ": " + issue.message);
  if (command === "scan") {
    if (errors.length) process.exitCode = 1;
    return;
  }
  if (!brief) throw new Error("A brief is required for validation");
  if (errors.some((issue) => issue.code === "case-collision" || issue.code === "no-assets")) {
    throw new Error("Validation requires a usable and unambiguous media catalog.");
  }
  const plan = planProject(brief.brief, manifest.assets);
  await publish(output, "plan", {
    ...plan, sourceBriefVersion: brief.sourceVersion, manifestSha256: sha256(json(manifest)),
    clearance: { licensing: manifest.analysis.licensing, privacy: manifest.analysis.privacy },
  });
  console.log("Validated " + plan.shots.length + " shots and " + plan.totalFrames + " frames.");
  if (command !== "render") return;

  const aspects = values.ratios === undefined ? plan.filmSpec.output.aspects :
    values.ratios.split(",").map((ratio) => {
      if (!brief.brief.aspectRatios.some((allowed) => allowed === ratio)) throw new Error("Ratio is outside the brief: " + ratio);
      return ratio.replace(":", "x") as AspectId;
    });
  if (new Set(aspects).size !== aspects.length) throw new Error("List each render ratio once");
  const frame = values.frame === undefined ? undefined : Number(values.frame);
  if (frame !== undefined && frame >= plan.totalFrames) throw new Error("--frame is outside the validated timeline");
  const { renderClient } = await import("./lib/client-render");
  await renderClient({ project, output, brief: brief.brief, plan, manifest, aspects, frame });
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
