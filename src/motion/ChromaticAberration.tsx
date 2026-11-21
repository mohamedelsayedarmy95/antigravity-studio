import React, { useId } from "react";
import { interpolate } from "remotion";

export interface ChromaticAberrationFilterProps {
  id: string;
  dx: number;
  dy?: number;
}

/**
 * Optical Chromatic Aberration SVG Filter
 * Implements physical Red/Cyan anamorphic channel dispersion.
 * Unlike drop-shadow halos, this separates the actual RGB color channels of the graphic:
 * - Red Channel is shifted by +dx
 * - Cyan Channel (Green + Blue) is shifted by -dx
 * - In overlapping areas, screen blending perfectly reconstructs the native RGB color.
 */
export const ChromaticAberrationFilterDef: React.FC<ChromaticAberrationFilterProps> = ({
  id,
  dx,
  dy = 0,
}) => {
  return (
    <svg
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <defs>
        <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
          {/* 1. Shift Red Channel by +dx */}
          <feOffset in="SourceGraphic" dx={dx} dy={dy} result="red-shifted" />
          <feColorMatrix
            in="red-shifted"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="red-only"
          />

          {/* 2. Shift Cyan Channel (Green + Blue) by -dx */}
          <feOffset in="SourceGraphic" dx={-dx} dy={-dy} result="cyan-shifted" />
          <feColorMatrix
            in="cyan-shifted"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="cyan-only"
          />

          {/* 3. Screen Blend to fuse overlapping channels back to original color */}
          <feBlend in="red-only" in2="cyan-only" mode="screen" />
        </filter>
      </defs>
    </svg>
  );
};

export interface ChromaticAberrationProps {
  children: React.ReactNode;
  velocity?: number; // Instantaneous velocity from spring derivative
  intensity?: number; // Scaling factor (default: 1.0)
  maxOffset?: number; // Max pixel shift at peak velocity (default: 1.5px)
  className?: string;
  style?: React.CSSProperties;
  filterIdPrefix?: string;
}

/**
 * ChromaticAberration wrapper component
 * Dynamically binds velocity to the SVG RGB channel split filter.
 */
export const ChromaticAberration: React.FC<ChromaticAberrationProps> = ({
  children,
  velocity = 0,
  intensity = 1.0,
  maxOffset = 1.5,
  className = "",
  style = {},
  filterIdPrefix = "chromatic",
}) => {
  const reactId = useId().replace(/:/g, "_");
  const filterId = `${filterIdPrefix}-${reactId}`;

  // Map velocity [0 -> 10] to pixel offset dx [0 -> maxOffset]
  const dx = interpolate(velocity * intensity, [0, 8], [0, maxOffset], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Zero-cost bypass when stationary
  const isActive = dx > 0.04;

  return (
    <>
      {isActive && <ChromaticAberrationFilterDef id={filterId} dx={dx} />}
      <div
        className={className}
        style={{
          filter: isActive ? `url(#${filterId})` : "none",
          willChange: "transform, filter",
          ...style,
        }}
      >
        {children}
      </div>
    </>
  );
};
