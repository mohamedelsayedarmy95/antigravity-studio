import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { measureText } from "@remotion/layout-utils";
import { appSpring } from "../../motion/springPresets";
import { KineticText } from "../../typography/KineticText";
import { hashString } from "../../engine/time/rng";
import type { Look } from "../../looks";
import type { Palette } from "../../stage3d/schema";
import { cssColor, typeStyle } from "../layout";
import type { Reveal, TextElement } from "../schema";

/**
 * Kinetic typography. Reveals are a registry keyed by name; all are pure functions of the local
 * frame (the element's Sequence starts at its `at` time). Built on the existing KineticText for
 * masked/word/glyph spring reveals, plus scramble-decode and typewriter.
 */

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+=<>/\\|";

/** Which characters fall inside an emphasis phrase. */
function emphasisMask(text: string, emphasis: string[]): boolean[] {
  const mask = Array<boolean>(text.length).fill(false);
  for (const phrase of emphasis) {
    let i = text.indexOf(phrase);
    while (phrase && i !== -1) {
      for (let k = i; k < i + phrase.length; k++) mask[k] = true;
      i = text.indexOf(phrase, i + phrase.length);
    }
  }
  return mask;
}

/** Scramble → decode: glyphs cycle (seeded per char and frame pair), then lock in left to right. */
const Scramble: React.FC<{ text: string; mask: boolean[]; ink: string; accent: string; seed: number }> = ({ text, mask, ink, accent, seed }) => {
  const frame = useCurrentFrame();
  const chars = Array.from(text);
  return (
    <>
      {chars.map((ch, i) => {
        const appear = i * 0.8;
        const lock = 10 + i * 1.4;
        if (ch === " " || ch === "\n") return <span key={i}>{ch}</span>;
        const visible = frame >= appear;
        const locked = frame >= lock;
        const shown = locked ? ch : GLYPHS[hashString(`${seed}/${i}/${Math.floor(frame / 2)}`) % GLYPHS.length];
        return (
          <span key={i} style={{ position: "relative", display: "inline-block" }}>
            <span style={{ visibility: "hidden" }}>{ch}</span>
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                textAlign: "center",
                opacity: visible ? (locked ? 1 : 0.7) : 0,
                color: locked ? (mask[i] ? accent : ink) : accent,
              }}
            >
              {shown}
            </span>
          </span>
        );
      })}
    </>
  );
};

/** Typewriter with a blinking block caret that disappears shortly after the last character. */
const Typewriter: React.FC<{ text: string; mask: boolean[]; ink: string; accent: string }> = ({ text, mask, ink, accent }) => {
  const frame = useCurrentFrame();
  const framesPerChar = 2;
  const count = Math.min(text.length, Math.floor(frame / framesPerChar));
  const done = count >= text.length;
  // Solid while typing; blinks for a moment after the last character, then disappears.
  const caretOn = !done || (frame < text.length * framesPerChar + 36 && Math.floor(frame / 16) % 2 === 0);
  // Untyped characters keep their space (layout never shifts); the zero-width caret sits right
  // after the last typed character.
  const caret = (
    <span key="caret" style={{ display: "inline-block", width: 0, overflow: "visible", opacity: caretOn ? 1 : 0, color: accent }}>
      ▌
    </span>
  );
  return (
    <>
      {count === 0 ? caret : null}
      {Array.from(text).map((ch, i) => (
        <React.Fragment key={i}>
          <span style={{ opacity: i < count ? 1 : 0, color: mask[i] ? accent : ink }}>{ch}</span>
          {i === count - 1 ? caret : null}
        </React.Fragment>
      ))}
    </>
  );
};

/** Largest scale ≤ 1 at which the longest word fits the box (fonts must be loaded first). */
function fitScale(text: string, style: ReturnType<typeof typeStyle>, boxWidth: number): number {
  const words = text.split(/\s+/).filter(Boolean);
  const transformed = style.textTransform === "uppercase" ? words.map((w) => w.toUpperCase()) : words;
  let longest = 0;
  for (const word of transformed) {
    const { width } = measureText({
      text: word,
      fontFamily: String(style.fontFamily),
      fontSize: style.fontSize,
      fontWeight: String(style.fontWeight),
      letterSpacing: String(style.letterSpacing),
      // OverlayLayer loads and checks every face before rendering; layout-utils' own
      // fallback-width heuristic false-positives on Inter here, so it is not used.
      validateFontIsLoaded: false,
    });
    longest = Math.max(longest, width);
  }
  return longest > boxWidth ? (boxWidth / longest) * 0.97 : 1;
}

export const TextView: React.FC<{
  el: TextElement;
  look: Look;
  palette: Palette;
  boxWidth: number;
  align: "start" | "center" | "end";
  seed: number;
}> = ({ el, look, palette, boxWidth, align, seed }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const baseStyle = typeStyle(el.role, look, { width, height });
  const needsShaping = /\p{Script=Arabic}/u.test(el.content);
  const base = needsShaping ? { ...baseStyle, letterSpacing: 0 } : baseStyle;
  const style = { ...base, fontSize: base.fontSize * fitScale(el.content, base, boxWidth) };
  const ink = el.color ? cssColor(el.color, palette) : palette.ink;
  const accent = palette.accent;
  const reveal: Reveal = el.reveal ?? look.reveal;
  const fontSize = style.fontSize;
  const highlights = el.emphasis.map((text) => ({ text, style: { color: accent } }));
  const container: React.CSSProperties = { ...style, color: ink, textAlign: align === "start" ? "left" : align === "end" ? "right" : "center", textWrap: "balance" };

  if (needsShaping) {
    // Keep joining scripts in a single browser-shaped run throughout the reveal.
    const progress = reveal === "hold" ? 1 : Math.min(1, Math.max(0, appSpring({ frame, fps, preset: look.spring })));
    return <div dir="auto" style={{ ...container, opacity: progress,
      transform: `translateY(${(1 - progress) * fontSize * 0.26}px)` }}>{el.content}</div>;
  }
  if (reveal === "hold") return <div style={container}>{el.content}</div>;
  if (reveal === "scramble") {
    return <div style={container}><Scramble text={el.content} mask={emphasisMask(el.content, el.emphasis)} ink={ink} accent={accent} seed={hashString(`${seed}/${el.content}`)} /></div>;
  }
  if (reveal === "typewriter") {
    return <div style={container}><Typewriter text={el.content} mask={emphasisMask(el.content, el.emphasis)} ink={ink} accent={accent} /></div>;
  }
  if (reveal === "fade") {
    const p = appSpring({ frame, fps, preset: look.spring });
    return <div style={{ ...container, opacity: Math.min(1, p), transform: `translateY(${(1 - Math.min(1, p)) * fontSize * 0.25}px)` }}>{el.content}</div>;
  }
  const kinetic = {
    maskedRise: { split: "words" as const, masked: true, yOffset: fontSize * 1.05, staggerFrames: 3, maxBlur: 0 },
    perGlyph: { split: "chars" as const, masked: true, yOffset: fontSize * 0.8, staggerFrames: 1, maxBlur: 0 },
    blurIn: { split: "words" as const, masked: false, yOffset: fontSize * 0.18, staggerFrames: 3, maxBlur: 14 },
  }[reveal];
  return (
    <div style={container}>
      <KineticText {...kinetic} preset={look.spring} highlights={highlights} style={{ ...style, color: ink }}>
        {el.content}
      </KineticText>
    </div>
  );
};
