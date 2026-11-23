import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { appSpring, getPresetDurationInFrames, SpringPresetName } from "../motion/springPresets";
import { FONT_FAMILIES } from "./fonts";

export type TextSplitMode = "words" | "chars" | "lines";

export interface HighlightRule {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export interface KineticTextProps {
  children: string;
  split?: TextSplitMode;
  preset?: SpringPresetName;
  staggerFrames?: number;
  startDelay?: number;
  yOffset?: number;
  maxBlur?: number;
  masked?: boolean;
  className?: string;
  style?: React.CSSProperties;
  wordClassName?: string;
  charClassName?: string;
  highlights?: HighlightRule[];
}

interface TextToken {
  content: string;
  index: number;
  isSpace: boolean;
  isHighlighted: boolean;
  highlightStyle?: React.CSSProperties;
  highlightClass?: string;
}

/**
 * KineticText — World-class kinetic typography component.
 * Implements Apple-grade masked reveals, character/word staggering,
 * gaussian blur decay, and physics-driven spring kinematics.
 */
export const KineticText: React.FC<KineticTextProps> = ({
  children,
  split = "words",
  preset = "appleDefault",
  staggerFrames = 2,
  startDelay = 0,
  yOffset = 48,
  maxBlur = 10,
  masked = true,
  className = "",
  style = {},
  wordClassName = "",
  charClassName = "",
  highlights = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const settleFrames = useMemo(() => getPresetDurationInFrames(preset, fps), [preset, fps]);

  // Tokenize text based on split mode
  const tokens = useMemo<TextToken[]>(() => {
    if (!children) return [];

    let rawTokens: string[] = [];

    if (split === "lines") {
      rawTokens = children.split("\n");
    } else if (split === "words") {
      // Split preserving whitespace
      rawTokens = children.split(/(\s+)/);
    } else {
      // Split by characters
      rawTokens = Array.from(children);
    }

    // Character ranges covered by each highlight phrase. A token is highlighted only when its
    // own range overlaps one of these, so "AI" in "AI Life" no longer lights up every "a".
    const highlightRanges: Array<{ start: number; end: number; rule: HighlightRule }> = [];
    for (const rule of highlights) {
      if (!rule.text) continue;
      let from = children.indexOf(rule.text);
      while (from !== -1) {
        highlightRanges.push({ start: from, end: from + rule.text.length, rule });
        from = children.indexOf(rule.text, from + rule.text.length);
      }
    }

    let tokenIndex = 0;
    let charOffset = 0;
    return rawTokens.map((raw) => {
      const isSpace = /^\s+$/.test(raw);
      const currentIndex = isSpace ? -1 : tokenIndex++;
      const tokenStart = charOffset;
      const tokenEnd = charOffset + raw.length;
      // "lines" mode drops the "\n" separators when splitting; account for them.
      charOffset = tokenEnd + (split === "lines" ? 1 : 0);

      let isHighlighted = false;
      let highlightStyle: React.CSSProperties | undefined;
      let highlightClass: string | undefined;

      if (!isSpace) {
        const hit = highlightRanges.find((r) => r.start < tokenEnd && r.end > tokenStart);
        if (hit) {
          isHighlighted = true;
          highlightStyle = hit.rule.style;
          highlightClass = hit.rule.className;
        }
      }

      return {
        content: raw,
        index: currentIndex,
        isSpace,
        isHighlighted,
        highlightStyle,
        highlightClass,
      };
    });
  }, [children, split, highlights]);

  return (
    <span
      className={`inline-block ${className}`}
      style={{
        fontFamily: FONT_FAMILIES.sans,
        whiteSpace: "pre-wrap",
        ...style,
      }}
    >
      {tokens.map((token, i) => {
        if (token.isSpace) {
          return (
            <span key={`space-${i}`} className="inline whitespace-pre">
              {token.content}
            </span>
          );
        }

        const delay = startDelay + token.index * staggerFrames;
        const isPending = frame < delay;

        const progress = isPending
          ? 0
          : appSpring({
              frame,
              fps,
              preset,
              delay,
            });

        // Settle time comes from the preset's measured spring, not a fixed 22 frames,
        // so slow presets (e.g. headspaceGentle) no longer snap before they finish.
        const isSettled = !isPending && frame > delay + settleFrames && progress >= 0.995;

        const translateY = isSettled
          ? 0
          : isPending
          ? yOffset
          : interpolate(progress, [0, 1], [yOffset, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

        const opacity = isSettled
          ? 1
          : isPending
          ? 0
          : interpolate(progress, [0, 0.7, 1], [0, 0.95, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

        const blur =
          maxBlur > 0 && !isSettled && !isPending
            ? interpolate(progress, [0, 1], [maxBlur, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            : 0;

        const tokenStyle: React.CSSProperties = {
          display: "inline-block",
          transform: isSettled ? "none" : `translate3d(0, ${translateY}px, 0)`,
          opacity,
          filter: blur > 0.5 ? `blur(${blur}px)` : "none",
          willChange: isSettled || isPending || split === "chars" ? "auto" : "transform, opacity",
          ...(token.isHighlighted ? token.highlightStyle : {}),
        };

        const tokenClasses = [
          split === "words" ? wordClassName : charClassName,
          token.isHighlighted ? token.highlightClass : "",
        ]
          .filter(Boolean)
          .join(" ");

        if (masked) {
          return (
            <span
              key={`token-${i}`}
              className="inline-block overflow-hidden align-top"
              style={{ paddingBottom: "0.15em" }}
            >
              <span className={tokenClasses} style={tokenStyle}>
                {token.content}
              </span>
            </span>
          );
        }

        return (
          <span key={`token-${i}`} className={tokenClasses} style={tokenStyle}>
            {token.content}
          </span>
        );
      })}
    </span>
  );
};
