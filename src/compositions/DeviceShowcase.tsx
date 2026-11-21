import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { IphoneMockup } from "../devices/IphoneMockup";
import { SaveFixMockScreen } from "../devices/SaveFixMockScreen";
import { appSpring } from "../motion/springPresets";
import { KineticHeadline } from "../motion/MotionPrimitives";
import { FONT_FAMILIES } from "../typography/fonts";
import { ShieldCheck, Sparkles, Cpu, Layers, CheckCircle2, Camera } from "lucide-react";

/**
 * Dynamic Live Activity pill content for TrueDepth Dynamic Island expansion
 */
const DynamicIslandLiveActivity: React.FC = () => {
  return (
    <div className="flex items-center justify-between w-full h-full px-2.5 text-white">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[10px] font-semibold text-white/95">Auto-Stash</span>
          <span className="text-[8px] text-emerald-300/80 font-mono">Vault Secured</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 h-3">
          {[40, 85, 55, 100, 70, 35].map((h, i) => (
            <div
              key={i}
              className="w-[2px] rounded-full bg-emerald-400"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <span className="text-[11px] font-mono text-emerald-400 font-bold">+$450.00</span>
      </div>
    </div>
  );
};

/**
 * Scene 1: Front Hero Reveal (Frames 0 - 140)
 * Precision entrance using appleHero spring physics
 */
const Scene1FrontHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = appSpring({
    frame,
    fps,
    preset: "appleHero",
    delay: 5,
  });

  const scale = interpolate(progress, [0, 1], [0.84, 1.0]);
  const rotateX = interpolate(progress, [0, 1], [14, 0]);
  const rotateY = interpolate(progress, [0, 1], [-12, 0]);
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  // Micro ambient float
  const floatY = Math.sin(frame * 0.04) * 4;

  return (
    <AbsoluteFill className="flex items-center justify-center">
      {/* Background Lighting Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#131622] via-[#090A0F] to-[#040407]" />

      {/* Subtle Radial Glow behind Phone */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(168,162,154,0.12) 0%, transparent 70%)",
          transform: `translateY(${floatY}px)`,
        }}
      />

      {/* Left Kinetic Headline */}
      <div className="absolute left-28 top-1/2 -translate-y-1/2 max-w-md z-30">
        <div className="flex items-center gap-2 mb-3">
          <div className="px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/10 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#C0BBB3]" />
            <span
              className="text-xs uppercase tracking-[0.2em] text-[#D6D1CA] font-medium"
              style={{ fontFamily: FONT_FAMILIES.mono }}
            >
              A18 Pro Architecture
            </span>
          </div>
        </div>

        <KineticHeadline
          text="PRECISION CRAFTED."
          preset="appleHero"
          delay={12}
          className="text-5xl font-extrabold tracking-tight text-white mb-4 leading-[1.08]"
        />

        <p
          className="text-base text-white/60 leading-relaxed font-normal"
          style={{
            opacity: interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateY(${interpolate(frame, [25, 45], [10, 0], { extrapolateRight: "clamp" })}px)`,
          }}
        >
          Forged in Grade 5 titanium. The strongest, lightest, and most refined iPhone display chassis ever engineered.
        </p>
      </div>

      {/* 3D iPhone in Natural Titanium (Right-of-Center) */}
      <div
        className="relative ml-80 z-20"
        style={{
          opacity,
          transform: `translateY(${floatY}px)`,
        }}
      >
        <IphoneMockup
          width={400}
          color="natural"
          scale={scale}
          rotateX={rotateX}
          rotateY={rotateY}
          screenProps={{
            timeString: "9:41",
            showStatusBar: true,
            showGlassGlare: true,
          }}
        >
          <SaveFixMockScreen mode="splash" transitionProgress={0} />
        </IphoneMockup>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Scene 2: 3/4 Spatial Tilt Reveal (Frames 140 - 280)
 * Dramatic angle showcasing extruded titanium edges, Action Button, and glass glare
 */
const Scene2SpatialTilt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = appSpring({
    frame,
    fps,
    preset: "appleDefault",
    delay: 5,
  });

  // Tilt to 3/4 angle
  const rotateX = interpolate(progress, [0, 1], [0, 18]);
  const rotateY = interpolate(progress, [0, 1], [0, -36]);
  const scale = interpolate(progress, [0, 1], [0.95, 1.05]);
  const translateX = interpolate(progress, [0, 1], [0, -180]);

  return (
    <AbsoluteFill className="flex items-center justify-center">
      {/* Background Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#181B28] via-[#090A0F] to-[#040407]" />

      {/* 3D iPhone tilted to show side band and button details */}
      <div
        className="relative z-20"
        style={{
          transform: `translateX(${translateX}px)`,
        }}
      >
        <IphoneMockup
          width={420}
          color="natural"
          scale={scale}
          rotateX={rotateX}
          rotateY={rotateY}
          screenProps={{
            timeString: "9:41",
            showStatusBar: true,
            showGlassGlare: true,
          }}
        >
          <SaveFixMockScreen mode="splash" transitionProgress={0.15} />
        </IphoneMockup>
      </div>

      {/* Right Descriptive Telemetry Overlay */}
      <div className="absolute right-28 top-1/2 -translate-y-1/2 max-w-md z-30">
        <div className="flex items-center gap-2 mb-3">
          <div className="px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/10 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span
              className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-medium"
              style={{ fontFamily: FONT_FAMILIES.mono }}
            >
              Hardware Specifications
            </span>
          </div>
        </div>

        <KineticHeadline
          text="GRADE 5 TITANIUM."
          preset="appleHero"
          delay={10}
          className="text-5xl font-extrabold tracking-tight text-white mb-4 leading-[1.08]"
        />

        <p
          className="text-base text-white/60 leading-relaxed font-normal mb-6"
          style={{
            opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Aerospace-grade alloy bonded with 100% recycled aluminum substructure. Contoured edges and customizable Action Button.
        </p>

        {/* Feature Badges */}
        <div
          className="space-y-3"
          style={{
            opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {[
            "1.5mm uniform border curvature",
            "Continuous chamfer specular sheen",
            "Multi-function Action Button",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm text-white/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Scene 3: 360° Hardware Turnaround (Frames 280 - 440)
 * Complete spatial turnaround revealing frosted back glass and triple-lens camera
 */
const Scene3HardwareTurnaround: React.FC = () => {
  const frame = useCurrentFrame();

  // Smooth continuous spin: from 0 through 180 (back) to 360 (front)
  const spinY = interpolate(frame, [0, 160], [0, 360], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Dynamic pitch dip to showcase top camera plateau depth
  const pitchX = Math.sin((frame / 160) * Math.PI * 2) * 12;

  return (
    <AbsoluteFill className="flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#151928] via-[#090A0F] to-[#040407]" />

      {/* Floating Phone in 360 Spin (Left side) */}
      <div
        className="relative z-20"
        style={{
          transform: "translateX(-180px)",
        }}
      >
        <IphoneMockup
          width={420}
          color="natural"
          scale={1.04}
          rotateX={pitchX}
          rotateY={spinY}
          screenProps={{
            timeString: "9:41",
            showStatusBar: true,
            showGlassGlare: true,
          }}
        >
          <SaveFixMockScreen mode="splash" transitionProgress={0.3} />
        </IphoneMockup>
      </div>

      {/* Right Descriptive Camera System Telemetry */}
      <div className="absolute right-28 top-1/2 -translate-y-1/2 max-w-md z-30">
        <div className="flex items-center gap-2 mb-3">
          <div className="px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/10 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-amber-300" />
            <span
              className="text-xs uppercase tracking-[0.2em] text-amber-200 font-medium"
              style={{ fontFamily: FONT_FAMILIES.mono }}
            >
              Optics & Sensors
            </span>
          </div>
        </div>

        <KineticHeadline
          text="PRO CAMERA SYSTEM."
          preset="appleHero"
          delay={10}
          className="text-5xl font-extrabold tracking-tight text-white mb-4 leading-[1.08]"
        />

        <p
          className="text-base text-white/60 leading-relaxed font-normal mb-6"
          style={{
            opacity: interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Custom 48MP Fusion camera with next-generation quad-pixel sensor. Sapphire crystal lens covers with multi-layer anti-reflective optical coatings.
        </p>

        {/* Camera Spec List */}
        <div
          className="space-y-3"
          style={{
            opacity: interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {[
            "48MP Main with 2.44μm quad-pixel array",
            "120mm 5x optical telephoto tetraprism",
            "LiDAR Scanner with night depth mapping",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm text-white/80">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Scene 4: Screen Swap to Live App & Dynamic Island (Frames 440 - 600)
 * Front view transition into active SaveFix financial dashboard + Dynamic Island pulse
 */
const Scene4ScreenSwap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const entrance = appSpring({
    frame,
    fps,
    preset: "appleDefault",
    delay: 2,
  });

  // Screen transition: morphs from splash (0) to dashboard (1)
  const screenMorph = appSpring({
    frame,
    fps,
    preset: "appleHero",
    delay: 25,
  });

  // Dynamic Island expands after screen settles
  const islandExpandProgress = appSpring({
    frame,
    fps,
    preset: "appleSnappy",
    delay: 55,
  });
  const isIslandExpanded = islandExpandProgress > 0.5;

  const rotateX = interpolate(entrance, [0, 1], [10, 2]);
  const rotateY = interpolate(entrance, [0, 1], [-15, -4]);
  const scale = interpolate(entrance, [0, 1], [0.96, 1.05]);

  return (
    <AbsoluteFill className="flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-[#0E1524] via-[#090A0F] to-[#040407]" />

      {/* Left Feature Description */}
      <div className="absolute left-28 top-1/2 -translate-y-1/2 max-w-md z-30">
        <div className="flex items-center gap-2 mb-3">
          <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span
              className="text-xs uppercase tracking-[0.2em] text-emerald-300 font-medium"
              style={{ fontFamily: FONT_FAMILIES.mono }}
            >
              Intelligent Financial Engine
            </span>
          </div>
        </div>

        <KineticHeadline
          text="DESIGNED FOR IPHONE."
          preset="appleHero"
          delay={10}
          className="text-5xl font-extrabold tracking-tight text-white mb-4 leading-[1.08]"
        />

        <p
          className="text-base text-white/60 leading-relaxed font-normal mb-6"
          style={{
            opacity: interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          SaveFix harnesses the full neural power of Apple Silicon with instant biometric security and live Dynamic Island alerts.
        </p>

        {/* CTA Banner */}
        <div
          className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between"
          style={{
            opacity: interpolate(frame, [45, 65], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40 font-mono">Available on</p>
            <p className="text-base font-bold text-white">Apple App Store</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs shadow-lg">
            Get Started
          </div>
        </div>
      </div>

      {/* 3D iPhone with Active UI & Dynamic Island */}
      <div className="relative ml-80 z-20">
        <IphoneMockup
          width={420}
          color="natural"
          scale={scale}
          rotateX={rotateX}
          rotateY={rotateY}
          screenProps={{
            timeString: "9:41",
            showStatusBar: true,
            showGlassGlare: true,
            dynamicIslandExpanded: isIslandExpanded,
            dynamicIslandContent: isIslandExpanded ? <DynamicIslandLiveActivity /> : undefined,
          }}
        >
          <SaveFixMockScreen mode="dashboard" transitionProgress={screenMorph} />
        </IphoneMockup>
      </div>
    </AbsoluteFill>
  );
};

/**
 * DeviceShowcase — Master Phase 3 Composition
 * 600 Frames (10 Seconds @ 60 FPS)
 * Sequenced 4-scene showcase with empirical performance discipline
 */
export const DeviceShowcase: React.FC = () => {
  return (
    <AbsoluteFill className="bg-[#050608]">
      {/* Scene 1: Hero Front Reveal (0 - 140 frames / 2.33s) */}
      <Sequence from={0} durationInFrames={140} name="Scene 1: Front Reveal">
        <Scene1FrontHero />
      </Sequence>

      {/* Scene 2: 3/4 Spatial Tilt (140 - 280 frames / 2.33s) */}
      <Sequence from={140} durationInFrames={140} name="Scene 2: Spatial Tilt">
        <Scene2SpatialTilt />
      </Sequence>

      {/* Scene 3: 360° Hardware Turnaround (280 - 440 frames / 2.67s) */}
      <Sequence from={280} durationInFrames={160} name="Scene 3: Hardware Turnaround">
        <Scene3HardwareTurnaround />
      </Sequence>

      {/* Scene 4: Screen Swap & Dynamic Island (440 - 600 frames / 2.67s) */}
      <Sequence from={440} durationInFrames={160} name="Scene 4: Screen Swap">
        <Scene4ScreenSwap />
      </Sequence>
    </AbsoluteFill>
  );
};
