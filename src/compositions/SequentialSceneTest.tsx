import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { FONT_FAMILIES } from "../typography/fonts";
import {
  KineticHeadline,
  KineticCharWave,
  IntelligenceAura,
  SpatialFlip3D,
  MaskedPillReveal,
  CardSlideBlur,
  SpringPop,
} from "../motion/MotionPrimitives";
import { Sparkles, Layers, ShieldCheck, Smartphone, Zap } from "lucide-react";

export const SequentialSceneTest: React.FC = () => {
  return (
    <AbsoluteFill
      className="bg-[#07080B] text-white flex items-center justify-center p-16 select-none overflow-hidden"
      style={{
        fontFamily: FONT_FAMILIES.sans,
      }}
    >
      {/* Composited background layer (isolated to GPU quad) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 20%, rgba(56, 189, 248, 0.08) 0%, transparent 60%),
            radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.08) 0%, transparent 50%)
          `,
          willChange: "transform",
          transform: "translateZ(0)",
        }}
      />

      {/* =========================================================================
          SCENE 1 (Frames 0-89, 1.5s): KineticHeadline + IntelligenceAura
          ========================================================================= */}
      <Sequence from={0} durationInFrames={90} name="Scene-1-Hook">
        <div className="flex flex-col items-center justify-center gap-8 w-full max-w-4xl z-10">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Scene 01 // Hook & Typography
            </span>
            <h1 className="text-6xl font-extrabold tracking-tight">
              <KineticHeadline text="Designed for Speed" delay={5} />
            </h1>
          </div>

          <IntelligenceAura delay={20} borderWidth={2} className="w-96">
            <div className="p-6 text-center">
              <div className="text-sm font-semibold text-white/90">
                Apple Intelligence Specular Aura
              </div>
              <div className="text-xs text-white/50 mt-1 font-mono">
                GPU-composited matrix rotation
              </div>
            </div>
          </IntelligenceAura>
        </div>
      </Sequence>

      {/* =========================================================================
          SCENE 2 (Frames 90-179, 1.5s): SpatialFlip3D + True Chromatic Aberration
          ========================================================================= */}
      <Sequence from={90} durationInFrames={90} name="Scene-2-Flip">
        <div className="flex flex-col items-center justify-center gap-6 z-10">
          <span className="text-xs font-mono uppercase tracking-widest text-white/40">
            Scene 02 // 3D Spatial Flip + Chromatic Lens Dispersion
          </span>
          <div className="w-[420px] h-[240px]">
            <SpatialFlip3D
              delay={15}
              preset="appleSnappy"
              chromaticAberration
              front={
                <div className="w-full h-full bg-gradient-to-br from-blue-600/30 to-indigo-700/20 border border-blue-400/30 rounded-3xl p-8 flex flex-col justify-between shadow-2xl">
                  <div className="text-xs font-mono text-blue-400 uppercase tracking-wider">
                    FRONT FACE // SAVEFIX
                  </div>
                  <div className="text-3xl font-extrabold">Instant Tracking</div>
                  <div className="text-xs text-white/50 font-mono">
                    Spring: k:360 | c:26 | m:0.9
                  </div>
                </div>
              }
              back={
                <div className="w-full h-full bg-gradient-to-br from-emerald-600/30 to-teal-700/20 border border-emerald-400/30 rounded-3xl p-8 flex flex-col justify-between shadow-2xl">
                  <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
                    BACK FACE // REVEAL
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-300">
                    5.0 ★ Top Rated
                  </div>
                  <div className="text-xs text-white/50 font-mono">
                    Optical RGB Channel Dispersion
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </Sequence>

      {/* =========================================================================
          SCENE 3 (Frames 180-269, 1.5s): MaskedPillReveal + CardSlideBlur
          ========================================================================= */}
      <Sequence from={180} durationInFrames={90} name="Scene-3-PillCard">
        <div className="flex flex-col items-center justify-center gap-8 w-full max-w-xl z-10">
          <span className="text-xs font-mono uppercase tracking-widest text-white/40">
            Scene 03 // Dynamic Morph & Card Blur Decay
          </span>

          <MaskedPillReveal delay={10} preset="appleSnappy" className="w-full">
            <div className="bg-gradient-to-r from-purple-600/40 to-pink-600/40 border border-purple-400/30 p-6 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Layers className="w-6 h-6 text-pink-400" />
                <span className="font-bold text-lg">Dynamic Island Morph</span>
              </div>
              <span className="text-xs font-mono text-white/60">Clip-Path Inset</span>
            </div>
          </MaskedPillReveal>

          <CardSlideBlur delay={25} direction="up" distance={50} maxBlur={0} className="w-full">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Zap className="w-4 h-4" />
                Apple Keynote Card Slide
              </div>
              <div className="text-xs text-white/60 mt-1">
                Gaussian blur smoothly decays to zero on landing.
              </div>
            </div>
          </CardSlideBlur>
        </div>
      </Sequence>

      {/* =========================================================================
          SCENE 4 (Frames 270-359, 1.5s): KineticCharWave + SpringPop Badges
          ========================================================================= */}
      <Sequence from={270} durationInFrames={90} name="Scene-4-CharPop">
        <div className="flex flex-col items-center justify-center gap-8 z-10 text-center">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-white/40 block mb-2">
              Scene 04 // Kinetic Char Wave & Icon Physics
            </span>
            <div className="text-2xl font-mono text-cyan-400 font-bold">
              <KineticCharWave text="ZERO-JANK SEQUENTIAL PIPELINE" delay={8} />
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <SpringPop delay={20} preset="appleBouncy">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Smartphone className="w-8 h-8 text-cyan-400" />
              </div>
            </SpringPop>
            <SpringPop delay={26} preset="appleBouncy">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
            </SpringPop>
            <SpringPop delay={32} preset="appleBouncy">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              </div>
            </SpringPop>
          </div>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
