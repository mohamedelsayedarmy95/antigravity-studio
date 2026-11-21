import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadArchivo } from "@remotion/google-fonts/Archivo";

// Complete font weight coverage matching all typographic weights used in code (300 through 900)
// Restricted to latin subset to maintain ultra-fast headless render times without network bloat
const interFont = loadInter("normal", {
  weights: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

const jetbrainsFont = loadJetBrainsMono("normal", {
  weights: ["400", "500", "700", "800"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

const archivoFont = loadArchivo("normal", {
  weights: ["700", "800", "900"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

/**
 * Typography font stacks with verified system fallbacks.
 */
export const FONT_FAMILIES = {
  /**
   * Primary UI font: Apple Human Interface style
   * Balanced, ultra-clean geometry, perfect legibility at all scales.
   */
  sans: `${interFont.fontFamily}, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif`,

  /**
   * Technical / Telemetry font: Tesla & Nvidia HUD style
   * Monospaced, zero-width variation for numbers and real-time readouts.
   */
  mono: `${jetbrainsFont.fontFamily}, "SF Mono", Menlo, Consolas, "Courier New", monospace`,

  /**
   * Bold Hero Headlines: High-impact display font
   */
  display: `${archivoFont.fontFamily}, ${interFont.fontFamily}, -apple-system, sans-serif`,
} as const;

/**
 * Apple HIG typographic hierarchy scaled for 1080p and 4K production videos.
 */
export const TYPOGRAPHY_STYLES = {
  heroHeadline: {
    fontFamily: FONT_FAMILIES.display,
    fontSize: "96px",
    fontWeight: 800,
    lineHeight: 1.05,
    letterSpacing: "-0.035em",
  },
  sectionTitle: {
    fontFamily: FONT_FAMILIES.sans,
    fontSize: "64px",
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: "-0.025em",
  },
  featureTitle: {
    fontFamily: FONT_FAMILIES.sans,
    fontSize: "44px",
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: "-0.015em",
  },
  bodyLarge: {
    fontFamily: FONT_FAMILIES.sans,
    fontSize: "28px",
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: "-0.01em",
  },
  telemetryLabel: {
    fontFamily: FONT_FAMILIES.mono,
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
  hudValue: {
    fontFamily: FONT_FAMILIES.mono,
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: "0.02em",
  },
} as const;
