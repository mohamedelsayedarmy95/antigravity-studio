import { staticFile } from "remotion";

// Match the Latin subset and weights used by the original fixtures.
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

const FACES = [
  { family: "Inter", file: "inter-latin.woff2", weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: "JetBrains Mono", file: "jetbrainsmono-latin.woff2", weights: [400, 500, 700, 800] },
  { family: "Archivo", file: "archivo-latin.woff2", weights: [700, 800, 900] },
];

export const FONT_FAMILIES = {
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif',
  mono: 'JetBrains Mono, "SF Mono", Menlo, Consolas, "Courier New", monospace',
  display: "Archivo, Inter, -apple-system, sans-serif",
} as const;

const documentLoads = new WeakMap<Document, Promise<void>>();

export function loadLocalFonts(doc: Document): Promise<void> {
  const pending = documentLoads.get(doc);
  if (pending) return pending;

  const load = Promise.all(
    FACES.map(async ({ family, file, weights }) => {
      const source = `url("${staticFile(`fonts/${file}`)}") format("woff2")`;
      try {
        // Preserve legacy weight matching for intermediate requests (e.g. HUD weight 600).
        return await Promise.all(weights.map((weight) =>
          new FontFace(family, source, { style: "normal", weight: String(weight), unicodeRange: LATIN }).load(),
        ));
      } catch (error) {
        throw new Error(`Could not load bundled font "${family}" from public/fonts/${file}`, { cause: error });
      }
    }),
  ).then(
    (faces) => {
      for (const face of faces.flat()) doc.fonts.add(face);
    },
    (error: unknown) => {
      documentLoads.delete(doc);
      throw error;
    },
  );
  documentLoads.set(doc, load);
  return load;
}
