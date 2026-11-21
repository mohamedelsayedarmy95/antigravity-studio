import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { appSpring, SpringPresetName } from "./springPresets";
import { FONT_FAMILIES } from "../typography/fonts";
import { KineticText } from "../typography/KineticText";
import { ChromaticAberrationFilterDef } from "./ChromaticAberration";

// Module-level cached gradient constants (eliminates per-mount Skia ramp generation)
const AURA_CONIC_RAMP =
  "conic-gradient(from 0deg at 50% 50%, #FF6080 0deg, #FFB03A 60deg, #8CE99A 120deg, #22D3EE 180deg, #818CF8 240deg, #C084FC 300deg, #FF6080 360deg)";
const AURA_SPECULAR_RAMP =
  "conic-gradient(from 0deg, #FF6080, #FFB03A, #22D3EE, #C084FC, #FF6080)";

// -------------------------------------------------------------------------
// Primitive 1: SpringPop (App Icon / Badge / Micro-interaction)
// -------------------------------------------------------------------------
export interface SpringPopProps {
  children: React.ReactNode;
  delay?: number;
  preset?: SpringPresetName;
  initialScale?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const SpringPop: React.FC<SpringPopProps> = ({
  children,
  delay = 0,
  preset = "appleBouncy",
  initialScale = 0,
  className = "",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isPending = frame < delay;

  const progress = isPending
    ? 0
    : appSpring({
        frame,
        fps,
        preset,
        delay,
      });

  const isSettled = !isPending && frame > delay + 23 && progress >= 0.995;
  const scale = isPending ? initialScale : isSettled ? 1 : interpolate(progress, [0, 1], [initialScale, 1]);
  const opacity = isPending ? 0 : isSettled ? 1 : interpolate(progress, [0, 0.4, 1], [0, 0.9, 1]);

  return (
    <div
      className={className}
      style={{
        scale,
        opacity,
        transformOrigin: "center center",
        willChange: isSettled || isPending ? "auto" : "transform, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// -------------------------------------------------------------------------
// Primitive 2: CardSlideBlur (Apple Card / Sheet Entrance)
// -------------------------------------------------------------------------
export interface CardSlideBlurProps {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
  maxBlur?: number;
  preset?: SpringPresetName;
  className?: string;
  style?: React.CSSProperties;
}

export const CardSlideBlur: React.FC<CardSlideBlurProps> = ({
  children,
  delay = 0,
  direction = "up",
  distance = 80,
  maxBlur = 0,
  preset = "appleDefault",
  className = "",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = appSpring({
    frame,
    fps,
    preset,
    delay,
  });

  const isSettled = progress >= 0.98;
  const translation = isSettled ? 0 : interpolate(progress, [0, 1], [distance, 0]);
  const opacity = isSettled ? 1 : interpolate(progress, [0, 0.6, 1], [0, 0.85, 1]);
  const blur = maxBlur > 0 && !isSettled ? interpolate(progress, [0, 0.7, 1], [maxBlur, 0.5, 0]) : 0;

  let x = 0;
  let y = 0;
  if (!isSettled) {
    if (direction === "up") y = translation;
    if (direction === "down") y = -translation;
    if (direction === "left") x = translation;
    if (direction === "right") x = -translation;
  }

  return (
    <div
      className={className}
      style={{
        transform: isSettled ? "none" : `translate3d(${x}px, ${y}px, 0)`,
        opacity,
        filter: blur > 0.5 ? `blur(${blur}px)` : "none",
        willChange: isSettled ? "auto" : "transform, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// -------------------------------------------------------------------------
// Primitive 3: KineticHeadline (Apple Keynote Masked Staggered Text)
// -------------------------------------------------------------------------
export interface KineticHeadlineProps {
  text: string;
  delay?: number;
  preset?: SpringPresetName;
  className?: string;
  style?: React.CSSProperties;
}

export const KineticHeadline: React.FC<KineticHeadlineProps> = ({
  text,
  delay = 0,
  preset = "appleHero",
  className = "",
  style = {},
}) => {
  return (
    <KineticText
      split="words"
      preset={preset}
      startDelay={delay}
      staggerFrames={3}
      yOffset={60}
      maxBlur={0}
      masked
      className={className}
      style={style}
    >
      {text}
    </KineticText>
  );
};

// -------------------------------------------------------------------------
// Primitive 4: KineticCharWave (Futuristic Cyber/HUD Character Wave)
// -------------------------------------------------------------------------
export interface KineticCharWaveProps {
  text: string;
  delay?: number;
  preset?: SpringPresetName;
  className?: string;
  style?: React.CSSProperties;
}

export const KineticCharWave: React.FC<KineticCharWaveProps> = ({
  text,
  delay = 0,
  preset = "teslaTelemetry",
  className = "",
  style = {},
}) => {
  return (
    <KineticText
      split="chars"
      preset={preset}
      startDelay={delay}
      staggerFrames={1}
      yOffset={28}
      maxBlur={0}
      masked={false}
      className={className}
      style={{
        fontFamily: FONT_FAMILIES.mono,
        letterSpacing: "0.06em",
        ...style,
      }}
    >
      {text}
    </KineticText>
  );
};

// -------------------------------------------------------------------------
// Primitive 5: PerspectiveTilt (Cinematic 3D Device / Card Pointer Momentum)
// -------------------------------------------------------------------------
export interface PerspectiveTiltProps {
  children: React.ReactNode;
  delay?: number;
  maxRotateX?: number;
  maxRotateY?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const PerspectiveTilt: React.FC<PerspectiveTiltProps> = ({
  children,
  delay = 0,
  maxRotateX = 14,
  maxRotateY = -18,
  className = "",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = appSpring({
    frame,
    fps,
    preset: "appleHero",
    delay,
  });

  // Calculate dynamic rotation with harmonic decay
  const rotateX = interpolate(progress, [0, 0.7, 1], [maxRotateX, -3, 0]);
  const rotateY = interpolate(progress, [0, 0.7, 1], [maxRotateY, 4, 0]);
  const scale = interpolate(progress, [0, 1], [0.92, 1]);

  return (
    <div
      style={{
        perspective: "1200px",
        perspectiveOrigin: "center center",
      }}
    >
      <div
        className={className}
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, 1)`,
          transformStyle: "preserve-3d",
          willChange: "transform",
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
};

// -------------------------------------------------------------------------
// Primitive 6: MaskedPillReveal (Pill to Card Morph via Clip-Path)
// -------------------------------------------------------------------------
export interface MaskedPillRevealProps {
  children: React.ReactNode;
  delay?: number;
  preset?: SpringPresetName;
  className?: string;
  style?: React.CSSProperties;
}

export const MaskedPillReveal: React.FC<MaskedPillRevealProps> = ({
  children,
  delay = 0,
  preset = "appleSnappy",
  className = "",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isPending = frame < delay;

  const progress = appSpring({
    frame,
    fps,
    preset,
    delay,
  });

  const isSettled = progress >= 0.995;

  // Once settled or pending, remove clipPath completely: browser uses zero-cost rounded border clipping
  // Smoothly blend radius down to 28px so transition to rounded-[28px] has zero geometric discontinuity (<0.2px)
  const insetH = isSettled ? 0 : interpolate(progress, [0, 1], [40, 0]);
  const insetV = isSettled ? 0 : interpolate(progress, [0, 1], [45, 0]);
  const radius = isSettled ? 28 : interpolate(progress, [0, 0.75, 1], [999, 32, 28]);
  const opacity = isPending ? 0 : isSettled ? 1 : interpolate(progress, [0, 0.3, 1], [0, 0.9, 1]);

  return (
    <div
      className={`rounded-[28px] overflow-hidden ${className}`}
      style={{
        clipPath:
          isSettled || isPending
            ? "none"
            : `inset(${insetV}% ${insetH}% ${insetV}% ${insetH}% round ${radius}px)`,
        opacity,
        willChange: isSettled ? "auto" : "clip-path, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// -------------------------------------------------------------------------
// Primitive 7: IntelligenceAura (Apple Intelligence Iridescent Glow Pulse)
// -------------------------------------------------------------------------
export interface IntelligenceAuraProps {
  children: React.ReactNode;
  delay?: number;
  borderWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const IntelligenceAura: React.FC<IntelligenceAuraProps> = ({
  children,
  delay = 0,
  borderWidth = 3,
  className = "",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isPending = frame < delay;

  const entrance = appSpring({
    frame,
    fps,
    preset: "appleDefault",
    delay,
  });

  // Continuous subtle angular rotation for iridescent specular glow
  const rotation = isPending ? 0 : ((frame - delay) * 2.5) % 360;
  const pulse = isPending ? 0 : Math.sin((frame - delay) * 0.08) * 0.15 + 0.85;

  return (
    <div
      className={`relative rounded-[32px] overflow-hidden ${className}`}
      style={{
        padding: `${borderWidth}px`,
        opacity: entrance,
        ...style,
      }}
    >
      {/* Dynamic iridescent gradient ring - cached constant ramp + lightweight 2px blur */}
      {!isPending && (
        <>
          <div
            className="absolute top-1/2 left-1/2 w-[160%] h-[160%] pointer-events-none"
            style={{
              transform: `translate3d(-50%, -50%, 0) rotate(${rotation}deg)`,
              backgroundImage: AURA_CONIC_RAMP,
              opacity: entrance * pulse * 0.7,
              filter: "blur(2px)",
              willChange: "transform",
            }}
          />
          {/* Dynamic specular border ring */}
          <div
            className="absolute top-1/2 left-1/2 w-[160%] h-[160%] pointer-events-none"
            style={{
              transform: `translate3d(-50%, -50%, 0) rotate(${rotation}deg)`,
              backgroundImage: AURA_SPECULAR_RAMP,
              opacity: entrance * 0.9,
              willChange: "transform",
            }}
          />
        </>
      )}
      {/* Content wrapper with precise 2px bezel reveal */}
      <div className="relative rounded-[30px] overflow-hidden bg-[#0A0D14] m-[2px]">
        {children}
      </div>
    </div>
  );
};

// -------------------------------------------------------------------------
// Primitive 8: LevitationHarmonic (Harmonic Physics Device Float)
// -------------------------------------------------------------------------
export interface LevitationHarmonicProps {
  children: React.ReactNode;
  amplitudeY?: number;
  periodFrames?: number;
  amplitudeRotate?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const LevitationHarmonic: React.FC<LevitationHarmonicProps> = ({
  children,
  amplitudeY = 12,
  periodFrames = 120, // 2 seconds at 60fps
  amplitudeRotate = 1.8,
  className = "",
  style = {},
}) => {
  const frame = useCurrentFrame();

  const phase = (frame % periodFrames) / periodFrames;
  const translateY = Math.sin(phase * Math.PI * 2) * amplitudeY;
  const rotateZ = Math.cos(phase * Math.PI * 2) * amplitudeRotate;

  return (
    <div
      className={className}
      style={{
        transform: `translate3d(0, ${translateY}px, 0) rotate(${rotateZ}deg)`,
        willChange: "transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// -------------------------------------------------------------------------
// Primitive 9: SpatialFlip3D (Hero 3D Card / Screen Flip)
// -------------------------------------------------------------------------
export interface SpatialFlip3DProps {
  front: React.ReactNode;
  back: React.ReactNode;
  delay?: number;
  preset?: SpringPresetName;
  chromaticAberration?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const SpatialFlip3D: React.FC<SpatialFlip3DProps> = ({
  front,
  back,
  delay = 30,
  preset = "appleSnappy",
  chromaticAberration = true,
  className = "",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = appSpring({
    frame,
    fps,
    preset,
    delay,
  });

  const prevProgress = appSpring({
    frame: frame - 1,
    fps,
    preset,
    delay,
  });

  const velocity = Math.abs(progress - prevProgress) * fps;
  const dx = chromaticAberration
    ? interpolate(velocity, [0, 8], [0, 1.2], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const rotation = interpolate(progress, [0, 1], [0, 180]);
  const zOffset = interpolate(progress, [0, 0.5, 1], [0, -120, 0]);
  const filterId = "flip3d-chromatic";
  const hasFilter = dx > 0.25;

  return (
    <div
      style={{
        perspective: "1400px",
      }}
    >
      {hasFilter && <ChromaticAberrationFilterDef id={filterId} dx={dx} />}
      <div
        className={`relative ${className}`}
        style={{
          transform: `translateZ(${zOffset}px) rotateY(${rotation}deg)`,
          transformStyle: "preserve-3d",
          willChange: "transform, filter",
          filter: hasFilter ? `url(#${filterId})` : "none",
          ...style,
        }}
      >
        {/* Front face */}
        <div
          className="w-full h-full"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          {front}
        </div>
        {/* Back face */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          {back}
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------------------
// Primitive 10: MomentumSwipe (Inertia Screen Carousel Transition)
// -------------------------------------------------------------------------
export interface MomentumSwipeProps {
  items: React.ReactNode[];
  activeItemIndex?: number;
  delay?: number;
  cardWidth?: number;
  gap?: number;
  preset?: SpringPresetName;
  chromaticAberration?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const MomentumSwipe: React.FC<MomentumSwipeProps> = ({
  items,
  activeItemIndex = 0,
  delay = 0,
  cardWidth = 360,
  gap = 32,
  preset = "inertiaDecay",
  chromaticAberration = true,
  className = "",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = appSpring({
    frame,
    fps,
    preset,
    delay,
  });

  const prevProgress = appSpring({
    frame: frame - 1,
    fps,
    preset,
    delay,
  });

  const velocity = Math.abs(progress - prevProgress) * fps;
  const dx = chromaticAberration
    ? interpolate(velocity, [0, 8], [0, 1.0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const totalCardStep = cardWidth + gap;
  const currentOffset = interpolate(
    progress,
    [0, 1],
    [-(activeItemIndex - 1) * totalCardStep, -activeItemIndex * totalCardStep]
  );

  const filterId = "swipe-chromatic";
  const hasFilter = dx > 0.04;

  return (
    <div className={`overflow-hidden ${className}`} style={style}>
      {hasFilter && <ChromaticAberrationFilterDef id={filterId} dx={dx} />}
      <div
        className="flex"
        style={{
          transform: `translate3d(${currentOffset}px, 0, 0)`,
          willChange: "transform, filter",
          gap: `${gap}px`,
          filter: hasFilter ? `url(#${filterId})` : "none",
        }}
      >
        {items.map((item, idx) => {
          const isFocused = idx === activeItemIndex;
          return (
            <div
              key={`swipe-item-${idx}`}
              style={{
                width: `${cardWidth}px`,
                flexShrink: 0,
                opacity: isFocused ? 1 : 0.45,
                scale: isFocused ? 1 : 0.94,
                transition: "none",
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
};
