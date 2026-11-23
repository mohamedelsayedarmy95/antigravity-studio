import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { runFactory } from "./factory";
import { readJson, validateFilm } from "./lib/production";

const usage = [
  "pnpm validate:production --film <FilmSpec.json> [--public-dir <folder>]",
  "pnpm validate:production --project <folder> [--brief <file>] [--production preview|silent-picture|final-audio] [--out <folder>]",
  "pnpm validate:production --master <factory master MP4> --evidence <file>",
].join("\n");

async function main() {
  const { values } = parseArgs({ options: {
    film: { type: "string" }, project: { type: "string" }, master: { type: "string" },
    brief: { type: "string" }, out: { type: "string" }, production: { type: "string" },
    evidence: { type: "string" }, help: { type: "boolean" },
    "public-dir": { type: "string" },
  } });
  if (values.help) {
    console.log(usage);
    return;
  }
  const { film, project, master, brief, out, production, evidence } = values;
  if ([film, project, master].filter(Boolean).length !== 1 ||
      (!project && [brief, out, production].some((value) => value !== undefined)) || (!master && evidence !== undefined) ||
      (!film && values["public-dir"] !== undefined)) {
    throw new Error(usage);
  }
  if (film) {
    const result = await validateFilm(await readJson(film, "FilmSpec JSON"),
      values["public-dir"] ?? fileURLToPath(new URL("../public/", import.meta.url)));
    console.log(`FilmSpec preflight PASS. ${result.durationInFrames} frames at ${result.fps} fps for ${result.spec.output.aspects.join(", ")}.`);
  } else if (project) {
    const args = ["validate", "--project=" + project, "--production=" + (production ?? "preview")];
    if (brief !== undefined) args.push("--brief=" + brief);
    if (out !== undefined) args.push("--out=" + out);
    await runFactory(args);
  } else if (master && evidence) {
    const { resolveDeliveryMaster, validateFactoryMaster } = await import("./lib/delivery");
    const profile = await validateFactoryMaster(await resolveDeliveryMaster(master), evidence);
    console.log(profile === "silent-picture" ? "silent-picture technical PASS. Visual review recorded. Creative approval pending." :
      "final-audio technical PASS. Director-declared creative approval recorded. Publication clearance requires a separate decision.");
  } else {
    throw new Error("Master acceptance requires --evidence <file>\n" + usage);
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
