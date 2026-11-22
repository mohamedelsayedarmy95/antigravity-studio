import { z } from "zod";
import { LookIdSchema } from "../../looks";
import { presentationSchema } from "./screen";

export const defaultAssetDirectory = "assets/screenshots";
const windowsDevice = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)(?:\.|$)/i;

export function isPortablePath(path: string): boolean {
  return path.split("/").every((segment) =>
    segment.length > 0 && !/[<>:"|?*\\]/.test(segment) &&
    !Array.from(segment).some((char) => char.charCodeAt(0) < 32) &&
    !/[. ]$/.test(segment) && !windowsDevice.test(segment));
}

const assetPath = z.string().transform((value) => value.replaceAll("\\", "/"))
  .refine(isPortablePath, "Use a project-relative path without traversal, drive names or Windows device names");
const copy = z.string().trim().min(1).max(240);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64)
  .refine((name) => !windowsDevice.test(name), "Use a portable project name");
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const ratios = z.array(z.enum(["16:9", "9:16", "1:1"])).min(1).max(3)
  .refine((values) => new Set(values).size === values.length, "List each ratio once");
const trim = z.strictObject({ startSeconds: z.number().nonnegative(), endSeconds: z.number().positive() })
  .refine((range) => range.endSeconds > range.startSeconds, "End must be after start");

const v2 = z.strictObject({
  schemaVersion: z.literal("2"),
  id,
  brand: z.strictObject({ name: copy, color }),
  hook: copy,
  hero: assetPath,
  heroPresentation: presentationSchema.optional(),
  features: z.array(z.strictObject({
    title: copy, body: copy, asset: assetPath, trim: trim.optional(), presentation: presentationSchema.optional(),
  })).min(1).max(6),
  cta: copy,
  assets: z.strictObject({ directory: assetPath.default(defaultAssetDirectory) }).default({ directory: defaultAssetDirectory }),
  locale: z.string().refine((value) => {
    try { return Intl.getCanonicalLocales(value).length === 1; } catch { return false; }
  }, "Use a BCP 47 locale such as en or ar-EG").default("en"),
  look: LookIdSchema.default("keynote"),
  durationSeconds: z.number().int().min(6).max(90).default(15),
  fps: z.union([z.literal(30), z.literal(60)]).default(60),
  aspectRatios: ratios.default(["9:16", "16:9", "1:1"]),
  renderRights: z.strictObject({ origin: z.enum(["synthetic", "client"]), approved: z.literal(true), license: copy, privacy: copy }).optional(),
});

// The flat v1 interchange format names its ordered catalog "screenshots".
const v1 = z.strictObject({
  schemaVersion: z.literal("1"), id, appName: copy, appColor: color,
  hook: copy, cta: copy, screenshots: z.array(assetPath).min(1),
  features: z.array(z.strictObject({ title: copy, subtitle: copy, screenshot: assetPath })).min(1).max(6),
  assetDirectory: assetPath.optional(), aspectRatios: ratios.optional(),
}).superRefine((value, ctx) => {
  const catalog = new Set(value.screenshots);
  value.features.forEach((feature, index) => {
    if (!catalog.has(feature.screenshot)) {
      ctx.addIssue({ code: "custom", path: ["features", index, "screenshot"], message: "List this path in screenshots" });
    }
  });
});

export type ClientBrief = z.output<typeof v2>;

export function parseBrief(input: unknown): { brief: ClientBrief; sourceVersion: "1" | "2" } {
  const version = z.object({ schemaVersion: z.enum(["1", "2"]) }).safeParse(input);
  if (!version.success) throw new Error('schemaVersion: expected "1" or "2" in brief.json');
  try {
    if (version.data.schemaVersion === "2") return { brief: v2.parse(input), sourceVersion: "2" };
    const old = v1.parse(input);
    return {
      sourceVersion: "1",
      brief: v2.parse({
        schemaVersion: "2", id: old.id, brand: { name: old.appName, color: old.appColor },
        hook: old.hook, hero: old.screenshots[0], cta: old.cta,
        features: old.features.map(({ title, subtitle, screenshot }) => ({ title, body: subtitle, asset: screenshot })),
        assets: old.assetDirectory ? { directory: old.assetDirectory } : undefined,
        aspectRatios: old.aspectRatios,
      }),
    };
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    throw new Error(error.issues.map((issue) => [issue.path.join(".") || "(root)", issue.message].join(": ")).join("\n"));
  }
}

export function starterBrief(name: string): ClientBrief {
  return v2.parse({
    schemaVersion: "2", id: name, brand: { name, color: "#2997ff" },
    hook: "Introduce your app",
    hero: "home.jpg",
    features: [{ title: "Show one feature", body: "Explain what a person can do in this screen.", asset: "feature.mp4" }],
    cta: "Try the app",
  });
}
