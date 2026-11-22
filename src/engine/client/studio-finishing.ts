import type { ColorRef, PostOverride } from "../../stage3d/schema";

/**
 * A restrained finishing treatment for opt-in Expressive Studio Cut scenes.
 * All controls use existing post passes; no new shader, schema or dependency.
 * Matching tone mapping and grain across beats prevents a visible grade jump at CTA.
 */
export function studioExpressivePost(beatId: string): PostOverride {
  return {
    toneMapping: "agx",
    exposure: beatId === "cta" ? 1.12 : 1.16,
    bloom: false,
    dof: false,
    chromaticAberration: false,
    vignette: false,
    grain: 0.012,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * A quiet, deterministic brand-color wash in display RGB. It is applied only to
 * light gallery backdrops, never to copy/UI or the dark CTA. If a ColorRef is a
 * palette role, leave it intact for the renderer's normal palette resolution.
 */
export function studioBrandWash(base: ColorRef, brand: string | undefined, strength: number): ColorRef {
  if (!HEX.test(base) || !brand || !HEX.test(brand)) return base;
  if (!Number.isFinite(strength) || strength < 0 || strength > 0.12) {
    throw new RangeError("Studio brand wash must be a finite fraction in [0, 0.12]");
  }
  const blend = [1, 3, 5].map((offset) => {
    const a = Number.parseInt(base.slice(offset, offset + 2), 16);
    const b = Number.parseInt(brand.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * strength).toString(16).padStart(2, "0");
  }).join("");
  return `#${blend}`;
}
