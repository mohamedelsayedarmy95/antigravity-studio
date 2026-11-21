import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILIES } from "../typography/fonts";
import {
  SpringPop,
  CardSlideBlur,
  KineticHeadline,
  KineticCharWave,
  PerspectiveTilt,
  MaskedPillReveal,
  IntelligenceAura,
  LevitationHarmonic,
  SpatialFlip3D,
  MomentumSwipe,
} from "../motion/MotionPrimitives";
import { useAudioReactive } from "../audio/useAudioReactive";
import {
  Sparkles,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  Cpu,
  Layers,
  Activity,
  Zap,
} from "lucide-react";

export const Phase2MotionShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { beat, bass } = useAudioReactive({ bpm: 128 });

  return (
    <AbsoluteFill
      className="bg-[#07080B] text-white overflow-hidden flex flex-col justify-between p-16 select-none"
      style={{
        fontFamily: FONT_FAMILIES.sans,
        backgroundImage: `
          radial-gradient(circle at 50% 15%, rgba(56, 189, 248, 0.08) 0%, transparent 60%),
          radial-gradient(circle at 85% 80%, rgba(168, 85, 247, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 15% 85%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)
        `,
      }}
    >
      {/* Subtle background tech grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* TOP HEADER: Keynote Kinetic Typography + Tesla Live Telemetry */}
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Phase 2 Foundation
            </span>
            <span className="text-xs text-white/40 font-mono tracking-widest uppercase">
              Apple &bull; Nvidia &bull; Tesla Physics
            </span>
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight">
            <KineticHeadline
              text="Kinetic Typography & Spring Physics"
              delay={5}
            />
          </h1>
          <p className="mt-2 text-lg text-white/60 font-light">
            <KineticCharWave
              text="10 Physical Motion Primitives // 60 FPS Deterministic Pipeline"
              delay={25}
            />
          </p>
        </div>

        {/* Live HUD telemetry readout (optimized: high-contrast glass without expensive backdrop-filter) */}
        <div className="bg-[#0B0D14]/90 border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col items-end gap-1 font-mono text-xs">
          <div className="flex items-center gap-2 text-emerald-400">
            <Activity
              className="w-4 h-4"
              style={{
                scale: 1 + beat * 0.35,
                color: beat > 0.6 ? "#38bdf8" : "#34d399",
                transition: "none",
              }}
            />
            <span className="font-bold">SYSTEM ACTIVE</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              BEAT {(beat * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-white/70">
            FRAME: <span className="text-white font-bold">{frame}</span> / 360
          </div>
          <div className="text-white/70">
            FPS: <span className="text-white font-bold">{fps}</span> (60.00)
          </div>
          <div className="text-white/50 text-[10px]">
            BASS ENERGY: {(bass * 100).toFixed(1)}% &bull; {(frame * (1000 / fps)).toFixed(1)}ms
          </div>
        </div>
      </div>

      {/* CENTER STAGE: Grid demonstrating 8 Visual Motion Primitives */}
      <div className="relative z-10 grid grid-cols-4 gap-6 my-auto">
        {/* Box 1: SpringPop Badges */}
        <div className="bg-white/[0.025] border border-white/10 rounded-2xl p-5 flex flex-col justify-between h-[230px]">
          <div className="text-xs font-mono text-white/40 tracking-wider">
            01 &bull; SPRING POP
          </div>
          <div className="flex items-center justify-center gap-3">
            <SpringPop delay={20} preset="appleBouncy">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Smartphone className="w-7 h-7 text-white" />
              </div>
            </SpringPop>
            <SpringPop delay={26} preset="appleBouncy">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
            </SpringPop>
            <SpringPop delay={32} preset="appleBouncy">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
            </SpringPop>
          </div>
          <div className="text-[11px] font-mono text-white/50">
            k:380 | d:18 | m:0.8
          </div>
        </div>

        {/* Box 2: Card Slide with Blur Decay */}
        <div className="bg-white/[0.025] border border-white/10 rounded-2xl p-5 flex flex-col justify-between h-[230px]">
          <div className="text-xs font-mono text-white/40 tracking-wider">
            02 &bull; SLIDE + BLUR DECAY
          </div>
          <CardSlideBlur delay={35} maxBlur={16} distance={60}>
            <div className="bg-white/10 border border-white/15 rounded-xl p-4">
              <div className="text-sm font-semibold text-white">Apple Card</div>
              <div className="text-xs text-white/60 mt-1">
                Gaussian blur smoothly decays from 16px to 0px.
              </div>
            </div>
          </CardSlideBlur>
          <div className="text-[11px] font-mono text-white/50">
            Apple Default Spring
          </div>
        </div>

        {/* Box 3: Perspective 3D Tilt */}
        <div className="bg-white/[0.025] border border-white/10 rounded-2xl p-5 flex flex-col justify-between h-[230px]">
          <div className="text-xs font-mono text-white/40 tracking-wider">
            03 &bull; 3D PERSPECTIVE TILT
          </div>
          <PerspectiveTilt delay={45} maxRotateX={16} maxRotateY={-22}>
            <div className="bg-gradient-to-br from-white/15 to-white/5 border border-white/20 rounded-xl p-4 shadow-2xl">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-cyan-400" />
                <span className="text-xs font-bold font-mono">NEURAL ENGINE</span>
              </div>
              <div className="text-[11px] text-white/60 mt-1">
                Preserve-3D spatial tilt
              </div>
            </div>
          </PerspectiveTilt>
          <div className="text-[11px] font-mono text-white/50">
            k:170 | d:22 | m:1.2
          </div>
        </div>

        {/* Box 4: Masked Pill Morph */}
        <div className="bg-white/[0.025] border border-white/10 rounded-2xl p-5 flex flex-col justify-between h-[230px]">
          <div className="text-xs font-mono text-white/40 tracking-wider">
            04 &bull; MASKED PILL MORPH
          </div>
          <MaskedPillReveal delay={55}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-xl flex items-center justify-center text-center">
              <div>
                <Layers className="w-6 h-6 mx-auto mb-1 text-white" />
                <div className="text-xs font-bold">Dynamic Island</div>
              </div>
            </div>
          </MaskedPillReveal>
          <div className="text-[11px] font-mono text-white/50">
            Clip-path Expansion
          </div>
        </div>

        {/* Box 5: Apple Intelligence Aura */}
        <div className="bg-white/[0.025] border border-white/10 rounded-2xl p-5 flex flex-col justify-between h-[230px]">
          <div className="text-xs font-mono text-white/40 tracking-wider">
            05 &bull; INTELLIGENCE AURA
          </div>
          <IntelligenceAura delay={65} borderWidth={2}>
            <div className="p-3 text-center">
              <Sparkles className="w-6 h-6 mx-auto mb-1 text-pink-400" />
              <div className="text-xs font-semibold">Iridescent Specular</div>
            </div>
          </IntelligenceAura>
          <div className="text-[11px] font-mono text-white/50">
            Conic Mask Glow
          </div>
        </div>

        {/* Box 6: Levitation Harmonic */}
        <div className="bg-white/[0.025] border border-white/10 rounded-2xl p-5 flex flex-col justify-between h-[230px]">
          <div className="text-xs font-mono text-white/40 tracking-wider">
            06 &bull; HARMONIC FLOAT
          </div>
          <LevitationHarmonic amplitudeY={10} periodFrames={120}>
            <div className="bg-gradient-to-tr from-amber-500/20 to-orange-500/30 border border-amber-500/30 rounded-xl p-3 text-center">
              <Zap className="w-6 h-6 mx-auto mb-1 text-amber-400" />
              <div className="text-xs font-semibold text-amber-300">
                Zero-Jank Idle
              </div>
            </div>
          </LevitationHarmonic>
          <div className="text-[11px] font-mono text-white/50">
            Sine Phase Oscillation
          </div>
        </div>

        {/* Box 7: Spatial 3D Flip */}
        <div className="bg-white/[0.025] border border-white/10 rounded-2xl p-5 flex flex-col justify-between h-[230px]">
          <div className="text-xs font-mono text-white/40 tracking-wider">
            07 &bull; SPATIAL 3D FLIP
          </div>
          <SpatialFlip3D
            delay={80}
            front={
              <div className="h-20 bg-blue-600/30 border border-blue-400/40 rounded-xl flex items-center justify-center text-xs font-bold text-blue-200">
                FRONT: SaveFix
              </div>
            }
            back={
              <div className="h-20 bg-emerald-600/30 border border-emerald-400/40 rounded-xl flex items-center justify-center text-xs font-bold text-emerald-200">
                BACK: 5★ Rated
              </div>
            }
          />
          <div className="text-[11px] font-mono text-white/50">
            Backface-Hidden Flip
          </div>
        </div>

        {/* Box 8: Tesla Telemetry Gauge Readout */}
        <div className="bg-white/[0.025] border border-white/10 rounded-2xl p-5 flex flex-col justify-between h-[230px]">
          <div className="text-xs font-mono text-white/40 tracking-wider">
            08 &bull; TESLA TELEMETRY
          </div>
          <div className="font-mono">
            <div className="text-[11px] text-white/50">VELOCITY SENSOR</div>
            <div className="text-3xl font-extrabold text-cyan-400 mt-1">
              {Math.min(100, Math.floor(frame * 1.8))}%
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full"
                style={{
                  width: `${Math.min(100, (frame / 180) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="text-[11px] font-mono text-white/50">
            k:450 | d:32 | m:0.7
          </div>
        </div>
      </div>

      {/* BOTTOM FOOTER: Primitive 10 Momentum Swipe Showcase */}
      <div className="relative z-10 bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex items-center justify-between">
        <div className="text-xs font-mono text-white/50 tracking-wider">
          09 &bull; MOMENTUM SWIPE CAROUSEL (SaveFix, StockMind, Iron Link, ShapeShred):
        </div>
        <div className="w-[850px]">
          <MomentumSwipe
            delay={100}
            cardWidth={190}
            gap={16}
            activeItemIndex={frame > 220 ? 3 : frame > 160 ? 2 : frame > 110 ? 1 : 0}
            items={[
              <div
                key="app-1"
                className="bg-white/10 border border-white/15 rounded-xl p-2.5 text-xs text-center font-semibold"
              >
                📱 SaveFix
              </div>,
              <div
                key="app-2"
                className="bg-white/10 border border-white/15 rounded-xl p-2.5 text-xs text-center font-semibold"
              >
                📈 StockMind
              </div>,
              <div
                key="app-3"
                className="bg-white/10 border border-white/15 rounded-xl p-2.5 text-xs text-center font-semibold"
              >
                🔐 Iron Link
              </div>,
              <div
                key="app-4"
                className="bg-white/10 border border-white/15 rounded-xl p-2.5 text-xs text-center font-semibold"
              >
                🏋️ ShapeShred
              </div>,
            ]}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
