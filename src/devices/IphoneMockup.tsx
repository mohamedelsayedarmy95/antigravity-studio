import React from "react";
import { interpolate } from "remotion";
import { ScreenCompositor, ScreenCompositorProps } from "./ScreenCompositor";

export type TitaniumColor = "natural" | "black" | "white" | "desert";

export interface IphoneMockupProps {
  children?: React.ReactNode;
  width?: number; // Base width in pixels (default: 420px)
  color?: TitaniumColor;
  rotateX?: number; // 3D Pitch degrees
  rotateY?: number; // 3D Yaw degrees
  rotateZ?: number; // 3D Roll degrees
  translateZ?: number; // Spatial depth offset
  scale?: number;
  screenProps?: Omit<ScreenCompositorProps, "children" | "rotateX" | "rotateY">;
  showShadow?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

interface ColorPalette {
  frameGrad: string;
  frameEdge: string;
  backGlass: string;
  cameraPlateau: string;
  lensRing: string;
  lensBarrel: string;
  accent: string;
  logo: string;
}

const COLOR_PALETTES: Record<TitaniumColor, ColorPalette> = {
  natural: {
    frameGrad:
      "linear-gradient(135deg, #A8A29A 0%, #8C867E 25%, #6A655E 50%, #8E8880 75%, #ABA59D 100%)",
    frameEdge: "#5A554E",
    backGlass: "#8A847C",
    cameraPlateau: "#7C7770",
    lensRing: "#A09A91",
    lensBarrel: "#3D3A36",
    accent: "#E2DCD4",
    logo: "#C0BBB3",
  },
  black: {
    frameGrad:
      "linear-gradient(135deg, #444341 0%, #2D2C2A 25%, #1B1A19 50%, #2E2D2B 75%, #464543 100%)",
    frameEdge: "#151413",
    backGlass: "#252422",
    cameraPlateau: "#1E1D1B",
    lensRing: "#3E3D3B",
    lensBarrel: "#161514",
    accent: "#686764",
    logo: "#555451",
  },
  white: {
    frameGrad:
      "linear-gradient(135deg, #E9EAEC 0%, #D2D3D6 25%, #B8B9BD 50%, #D5D6D9 75%, #EBECee 100%)",
    frameEdge: "#9EA0A4",
    backGlass: "#EDEDF0",
    cameraPlateau: "#E0E1E4",
    lensRing: "#CACBCE",
    lensBarrel: "#6E7074",
    accent: "#FFFFFF",
    logo: "#A8A9AD",
  },
  desert: {
    frameGrad:
      "linear-gradient(135deg, #CBB49E 0%, #B49B85 25%, #8A725D 50%, #B89F89 75%, #CDB6A1 100%)",
    frameEdge: "#6C5846",
    backGlass: "#BCA28B",
    cameraPlateau: "#AD937D",
    lensRing: "#C6AD97",
    lensBarrel: "#4D3D2F",
    accent: "#F0E3D6",
    logo: "#D4C0AD",
  },
};

const STATIC_CHAMFER_SHEEN =
  "radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.25) 0%, transparent 60%)";
const STATIC_GLASS_SHEEN =
  "radial-gradient(ellipse at 50% 40%, rgba(255, 255, 255, 0.18) 0%, transparent 65%)";

/**
 * IphoneMockup — Apple-grade 3D iPhone 15/16 Pro Physical Device Model.
 * Architecture:
 * 1. Continuous Squircle Perimeter Rails: Built via multi-slice depth extrusion,
 *    eliminating sharp box fins and achieving continuous 54px corner curvature.
 * 2. 1.5mm Uniform Bezel & Continuous Chamfer Highlight.
 * 3. Anisotropic Titanium Rail Reflections reacting to dynamic pitch/yaw vectors.
 * 4. Dual-Tier Stepped Sapphire Camera System on molded glass plateau.
 * 5. Integrated TrueDepth Dynamic Island & Deflecting Glass Glare.
 */
export const IphoneMockup: React.FC<IphoneMockupProps> = ({
  children,
  width = 420,
  color = "natural",
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  translateZ = 0,
  scale = 1,
  screenProps = {},
  showShadow = true,
  className = "",
  style = {},
}) => {
  // Real Apple physical proportions: 70.6mm W x 146.6mm H x 8.25mm D (Ratio: 1:2.076)
  const height = Math.round(width * 2.076);
  const chassisDepth = Math.max(14, Math.round(width * 0.052)); // ~22px on 420px
  const halfDepth = chassisDepth / 2;
  const bezel = Math.round(width * 0.024); // 1.5mm equivalent: ~10px
  const outerRadius = Math.round(width * 0.132); // Continuous squircle radius: ~55px
  const screenRadius = outerRadius - bezel; // ~45px

  const palette = COLOR_PALETTES[color];

  // Dynamic light vector based on 3D rotation
  const lightShiftX = interpolate(rotateY, [-45, 45], [-60, 60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lightShiftY = interpolate(rotateX, [-30, 30], [-40, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Dynamic floor shadow deflection
  const shadowOffsetY = interpolate(rotateX, [-30, 30], [-20, 35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shadowOffsetX = interpolate(rotateY, [-45, 45], [45, -45], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shadowScale = interpolate(Math.abs(rotateX) + Math.abs(rotateY), [0, 60], [1, 0.88]);
  const shadowOpacity = interpolate(Math.abs(rotateX) + Math.abs(rotateY), [0, 70], [0.45, 0.22]);

  // Compute face visibility for zero-cost occlusion culling in 3D
  const normalizedY = ((rotateY % 360) + 360) % 360;
  const isFrontVisible = normalizedY <= 90.5 || normalizedY >= 269.5;
  const isBackVisible = normalizedY >= 89.5 && normalizedY <= 270.5;

  // Depth slice count for continuous squircle curvature (2 slices spaced evenly)
  const sliceCount = 2;
  const depthStep = chassisDepth / (sliceCount + 1);

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{
        perspective: "1600px",
        perspectiveOrigin: "50% 50%",
        width: `${width}px`,
        height: `${height}px`,
        ...style,
      }}
    >
      {/* Dynamic Ambient Floor Shadow (GPU-accelerated multi-stop gradient without blur filter) */}
      {showShadow && (
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            width: `${width * 0.9}px`,
            height: `${height * 0.4}px`,
            bottom: `-${height * 0.12}px`,
            left: `${width * 0.05 + shadowOffsetX}px`,
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.4) 30%, rgba(0, 0, 0, 0.15) 55%, transparent 75%)",
            opacity: shadowOpacity,
            transform: `translateY(${shadowOffsetY}px) scale(${shadowScale}) rotateX(60deg)`,
            transformOrigin: "center center",
            willChange: "transform, opacity",
          }}
        />
      )}

      {/* Main 3D Phone Chassis Root (preserve-3d) */}
      <div
        className="relative"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transformStyle: "preserve-3d",
          transform: `scale3d(${scale}, ${scale}, 1) translateZ(${translateZ}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`,
          willChange: "transform",
        }}
      >
        {/* =====================================================================
            1. CONTINUOUS SQUIRCLE DEPTH SLICES (Titanium Perimeter Rails)
            Eliminates sharp box fins; creates perfectly continuous 54px curved edges.
            Solid tone per-slice without Gaussian box-shadows for ultra-fast GPU rasterization.
            ===================================================================== */}
        {Array.from({ length: sliceCount }).map((_, i) => {
          const zPos = -halfDepth + (i + 1) * depthStep;
          return (
            <div
              key={`slice-${i}`}
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: `${outerRadius}px`,
                transform: `translateZ(${zPos}px)`,
                border: `1.5px solid ${palette.frameEdge}`,
                background: palette.frameEdge,
                willChange: "transform",
              }}
            />
          );
        })}

        {/* =====================================================================
            2. HARDWARE BUTTONS & PORTS (Positioned on Perimeter)
            ===================================================================== */}

        {/* 2A. Right Power / Siri Button */}
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            width: "3px",
            height: `${height * 0.11}px`,
            right: "-2.5px",
            top: `${height * 0.26}px`,
            borderRadius: "2px",
            background: palette.frameGrad,
            border: `0.5px solid ${palette.accent}`,
            boxShadow: "1px 0 2px rgba(0,0,0,0.5)",
            transform: "translateZ(0px)",
          }}
        />

        {/* 2B. Left Action Button */}
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            width: "3px",
            height: `${height * 0.045}px`,
            left: "-2.5px",
            top: `${height * 0.20}px`,
            borderRadius: "2px",
            background: palette.frameGrad,
            border: `0.5px solid ${palette.accent}`,
            boxShadow: "-1px 0 2px rgba(0,0,0,0.5)",
            transform: "translateZ(0px)",
          }}
        />

        {/* 2C. Left Volume Up Button */}
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            width: "3px",
            height: `${height * 0.075}px`,
            left: "-2.5px",
            top: `${height * 0.27}px`,
            borderRadius: "2px",
            background: palette.frameGrad,
            border: `0.5px solid ${palette.accent}`,
            boxShadow: "-1px 0 2px rgba(0,0,0,0.5)",
            transform: "translateZ(0px)",
          }}
        />

        {/* 2D. Left Volume Down Button */}
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            width: "3px",
            height: `${height * 0.075}px`,
            left: "-2.5px",
            top: `${height * 0.36}px`,
            borderRadius: "2px",
            background: palette.frameGrad,
            border: `0.5px solid ${palette.accent}`,
            boxShadow: "-1px 0 2px rgba(0,0,0,0.5)",
            transform: "translateZ(0px)",
          }}
        />

        {/* =====================================================================
            3. FRONT FACE: Screen Display + 1.5mm Bezel + Dynamic Chamfer
            Positioned at +halfDepth
            ===================================================================== */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translateZ(${halfDepth}px)`,
            borderRadius: `${outerRadius}px`,
            background: palette.frameGrad,
            padding: `${bezel}px`,
            boxShadow: `
              inset 0 0 0 1px rgba(255, 255, 255, 0.3),
              inset 0 1px 2px 0 rgba(255, 255, 255, 0.45),
              0 4px 16px -2px rgba(0, 0, 0, 0.6)
            `,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            visibility: isFrontVisible ? "visible" : "hidden",
          }}
        >
          {/* Dynamic Anisotropic Chamfer Highlight (Hardware translate3d) */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{
              borderRadius: `${outerRadius}px`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: STATIC_CHAMFER_SHEEN,
                transform: `translate3d(${lightShiftX * 0.4}px, ${lightShiftY * 0.4}px, 0)`,
                willChange: "transform",
              }}
            />
          </div>

          {/* Inner Titanium Bezel Lip */}
          <div
            className="absolute inset-[1px] pointer-events-none"
            style={{
              borderRadius: `${outerRadius - 1}px`,
              border: `1px solid ${palette.frameEdge}`,
              opacity: 0.7,
            }}
          />

          {/* Screen Display Area */}
          <ScreenCompositor
            rotateX={rotateX}
            rotateY={rotateY}
            {...screenProps}
            style={{
              borderRadius: `${screenRadius}px`,
            }}
          >
            {children}
          </ScreenCompositor>
        </div>

        {/* =====================================================================
            4. BACK FACE: Frosted Matte Glass + Mirrored Apple Logo + Triple Camera
            Positioned at -halfDepth rotated 180deg
            ===================================================================== */}
        <div
          className="absolute inset-0 flex flex-col justify-between p-8"
          style={{
            transform: `translateZ(${-halfDepth}px) rotateY(180deg)`,
            borderRadius: `${outerRadius}px`,
            background: `radial-gradient(circle at 50% 30%, ${palette.backGlass} 0%, ${palette.cameraPlateau} 100%)`,
            boxShadow: `
              inset 0 0 0 1px rgba(255, 255, 255, 0.18),
              0 4px 16px -2px rgba(0, 0, 0, 0.6)
            `,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            visibility: isBackVisible ? "visible" : "hidden",
          }}
        >
          {/* Dynamic Light Sheen on Back Frosted Glass (Hardware translate3d) */}
          <div
            className="absolute inset-0 pointer-events-none rounded-[inherit] overflow-hidden"
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: STATIC_GLASS_SHEEN,
                transform: `translate3d(${-lightShiftX * 0.5}px, ${-lightShiftY * 0.5}px, 0)`,
                willChange: "transform",
              }}
            />
          </div>

          {/* 4A. Raised Triple-Camera System Island (Top Left of Back) */}
          <div
            className="absolute top-5 left-5 rounded-[44px] p-3 shadow-2xl flex flex-col justify-between"
            style={{
              width: `${width * 0.45}px`,
              height: `${width * 0.45}px`,
              background: `linear-gradient(135deg, ${palette.cameraPlateau} 0%, rgba(18,18,18,0.92) 100%)`,
              border: `1.5px solid rgba(255, 255, 255, 0.22)`,
              boxShadow: `
                0 6px 20px -3px rgba(0, 0, 0, 0.65),
                inset 0 1px 2px rgba(255, 255, 255, 0.3)
              `,
              transform: "translateZ(8px)",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Top row: Lens 1 (Main 48MP) + True Tone Flash */}
            <div className="flex items-center justify-between">
              {/* Lens 1 (48MP Main Quad-Pixel) */}
              <div
                className="rounded-full flex items-center justify-center relative"
                style={{
                  width: `${width * 0.17}px`,
                  height: `${width * 0.17}px`,
                  background: palette.frameGrad,
                  border: `2.5px solid ${palette.lensRing}`,
                  transform: "translateZ(4px)",
                }}
              >
                {/* Stepped Inner Barrel */}
                <div
                  className="w-4/5 h-4/5 rounded-full flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: palette.lensBarrel,
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <div className="w-3/5 h-3/5 rounded-full bg-[#08101E] border border-blue-400/30 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#172554] opacity-90 shadow-inner" />
                  </div>
                  {/* Sapphire Anti-Reflective Optical Coating Sheen */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-400/25 to-transparent pointer-events-none" />
                </div>
              </div>

              {/* True Tone Dual Flash Module */}
              <div
                className="w-8 h-8 rounded-full bg-[#FDF6E2] border border-white/50 flex items-center justify-center mr-1.5"
                style={{
                  transform: "translateZ(2px)",
                }}
              >
                <div className="w-4 h-4 rounded-full bg-[#F59E0B]/50 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FEF3C7]" />
                </div>
              </div>
            </div>

            {/* Bottom row: Lens 2 (Ultra-Wide) + Lens 3 (5x Telephoto) + LiDAR */}
            <div className="flex items-center justify-between">
              {/* Lens 2 (Ultra-Wide) */}
              <div
                className="rounded-full flex items-center justify-center relative"
                style={{
                  width: `${width * 0.17}px`,
                  height: `${width * 0.17}px`,
                  background: palette.frameGrad,
                  border: `2.5px solid ${palette.lensRing}`,
                  transform: "translateZ(4px)",
                }}
              >
                <div
                  className="w-4/5 h-4/5 rounded-full flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: palette.lensBarrel,
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <div className="w-3/5 h-3/5 rounded-full bg-[#08101E] border border-blue-400/30 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#172554] opacity-90" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-purple-400/25 to-transparent pointer-events-none" />
                </div>
              </div>

              {/* Lens 3 (120mm 5x Optical Telephoto) */}
              <div
                className="rounded-full flex items-center justify-center relative"
                style={{
                  width: `${width * 0.17}px`,
                  height: `${width * 0.17}px`,
                  background: palette.frameGrad,
                  border: `2.5px solid ${palette.lensRing}`,
                  transform: "translateZ(4px)",
                }}
              >
                <div
                  className="w-4/5 h-4/5 rounded-full flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: palette.lensBarrel,
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <div className="w-3/5 h-3/5 rounded-full bg-[#08101E] border border-blue-400/30 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#172554] opacity-90" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-400/25 to-transparent pointer-events-none" />
                </div>
              </div>
            </div>

            {/* LiDAR Scanner Dot (Near Telephoto) */}
            <div
              className="absolute right-4 bottom-5 w-4 h-4 rounded-full bg-[#0B0C0E] border border-white/20 shadow-inner flex items-center justify-center"
              style={{ transform: "translateZ(2px)" }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#1F2937]" />
            </div>

            {/* Rear Acoustic Microphone Hole */}
            <div
              className="absolute right-10 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-black/90 border border-white/10"
              style={{ transform: "translateZ(2px)" }}
            />
          </div>

          {/* 4B. Polished Mirrored Apple Logo (Center) */}
          <div className="my-auto mx-auto flex items-center justify-center">
            <svg
              className="w-16 h-16 opacity-90"
              viewBox="0 0 170 170"
              fill={palette.logo}
            >
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.71-11.64-14.01-6.1-9.48-10.89-20.12-14.37-31.92-3.48-11.8-5.22-22.95-5.22-33.45 0-14.13 3.63-25.99 10.89-35.58 7.26-9.59 16.51-14.49 27.75-14.7 4.58 0 9.8 1.18 15.66 3.53 5.86 2.36 9.49 3.57 10.89 3.57 1.18 0 5.04-1.29 11.59-3.86 6.55-2.58 12.18-3.73 16.89-3.46 12.56.63 22.75 5.22 30.56 13.78-10.99 6.64-16.37 15.66-16.14 27.05.23 8.84 3.63 16.27 10.2 22.3 6.57 6.03 14.36 9.48 23.36 10.36-2.07 6.1-4.73 12.35-7.98 18.75zm-33.27-104.91c0-6.1 2.22-12.01 6.66-17.74 4.44-5.73 10.14-9.53 17.1-11.4 0 .97.05 1.83.15 2.58.11.75.16 1.4.16 1.95 0 6.1-2.3 11.97-6.91 17.61-4.6 5.64-10.33 9.4-17.19 11.27-.11-.97-.22-1.97-.33-3-.12-1.02-.18-1.9-.18-2.65z" />
            </svg>
          </div>

          {/* 4C. Subtle Regulatory Markings */}
          <div className="mx-auto text-[9px] font-mono text-white/25 tracking-widest uppercase">
            Designed by Apple in California
          </div>
        </div>
      </div>
    </div>
  );
};
