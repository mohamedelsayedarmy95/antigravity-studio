import React from "react";
import { interpolate } from "remotion";
import { Wifi, Signal } from "lucide-react";

export interface ScreenCompositorProps {
  children?: React.ReactNode;
  rotateX?: number;
  rotateY?: number;
  timeString?: string;
  showStatusBar?: boolean;
  showHomeIndicator?: boolean;
  showGlassGlare?: boolean;
  dynamicIslandExpanded?: boolean;
  dynamicIslandContent?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const STATIC_GLARE_GRADIENT =
  "linear-gradient(120deg, transparent 25%, rgba(255, 255, 255, 0.45) 47%, rgba(255, 255, 255, 0.85) 50%, rgba(255, 255, 255, 0.2) 53%, transparent 75%)";

/**
 * ScreenCompositor — Maps application UI/video onto Apple Super Retina XDR display.
 * Features:
 * 1. Pixel-perfect 19.5:9 display area with continuous curvature squircle corners.
 * 2. TrueDepth Dynamic Island pill with camera optics and expansion support.
 * 3. iOS System Status Bar (cellular, WiFi, battery indicator, 9:41 time).
 * 4. Dynamic Physical Glass Glare with hardware GPU translation (no blend-mode readback).
 * 5. iOS Home Indicator bar at baseline.
 */
export const ScreenCompositor: React.FC<ScreenCompositorProps> = ({
  children,
  rotateX = 0,
  rotateY = 0,
  timeString = "9:41",
  showStatusBar = true,
  showHomeIndicator = true,
  showGlassGlare = true,
  dynamicIslandExpanded = false,
  dynamicIslandContent,
  className = "",
  style = {},
}) => {
  // Compute optical glass glare deflection based on device orientation
  // When device tilts, light reflection sweeps in opposite vector
  const glareShiftX = interpolate(rotateY, [-45, 45], [-80, 80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glareShiftY = interpolate(rotateX, [-30, 30], [-60, 60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glareOpacity = interpolate(Math.abs(rotateX) + Math.abs(rotateY), [0, 40], [0.10, 0.28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className={`relative w-full h-full rounded-[44px] overflow-hidden bg-black select-none ${className}`}
      style={{
        transform: "translateZ(0)",
        ...style,
      }}
    >
      {/* 1. Underlying Application Screen Content */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        {children}
      </div>

      {/* 2. iOS Status Bar Overlay */}
      {showStatusBar && (
        <div className="absolute top-0 left-0 right-0 h-11 px-7 flex items-center justify-between text-white text-[13px] font-semibold tracking-tight z-30 pointer-events-none">
          {/* Time (left side) */}
          <span className="font-mono tracking-tight font-medium ml-1">
            {timeString}
          </span>

          {/* Right Status Icons: Cellular, WiFi, Battery */}
          <div className="flex items-center gap-1.5 mr-1 text-white/90">
            <Signal className="w-3.5 h-3.5 fill-current" />
            <Wifi className="w-3.5 h-3.5" />
            <div className="flex items-center gap-0.5">
              <div className="w-5 h-2.5 rounded-[4px] border border-white/80 p-[1px] flex items-center">
                <div className="h-full w-full bg-white rounded-[2px]" />
              </div>
              <div className="w-[1.5px] h-1 bg-white/60 rounded-r-[1px]" />
            </div>
          </div>
        </div>
      )}

      {/* 3. Apple TrueDepth Dynamic Island */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all duration-300">
        <div
          className={`bg-black rounded-full flex items-center justify-between px-3 shadow-md border border-white/[0.08] ${
            dynamicIslandExpanded
              ? "w-[240px] h-[48px]"
              : "w-[110px] h-[30px]"
          }`}
          style={{
            willChange: "width, height",
          }}
        >
          {dynamicIslandExpanded && dynamicIslandContent ? (
            dynamicIslandContent
          ) : (
            <>
              {/* Left Sensor Void / FaceID Illuminator */}
              <div className="flex items-center gap-1.5 pl-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#050608] border border-white/[0.06] flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-[#111625]" />
                </div>
              </div>

              {/* Right: Front-Facing TrueDepth Camera Lens with sapphire sheen */}
              <div className="w-3 h-3 rounded-full bg-[#080B12] border border-white/[0.12] flex items-center justify-center relative overflow-hidden">
                {/* Lens anti-reflective coating specular reflection */}
                <div className="w-1.5 h-1.5 rounded-full bg-[#1A263E] flex items-center justify-center">
                  <div className="w-0.5 h-0.5 rounded-full bg-[#4070B0]/60" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Physical Specular Glass Glare Overlay (Hardware GPU Translation) */}
      {showGlassGlare && (
        <div
          className="absolute -inset-16 pointer-events-none z-50 overflow-hidden"
          style={{
            backgroundImage: STATIC_GLARE_GRADIENT,
            opacity: glareOpacity,
            transform: `translate3d(${glareShiftX}px, ${glareShiftY}px, 0)`,
            willChange: "transform, opacity",
          }}
        />
      )}

      {/* 5. iOS Home Indicator Bar */}
      {showHomeIndicator && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="w-32 h-1 rounded-full bg-white/70 shadow-sm" />
        </div>
      )}
    </div>
  );
};
