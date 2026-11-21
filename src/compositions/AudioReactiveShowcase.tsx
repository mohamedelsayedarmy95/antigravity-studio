import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useRealAudioReactive } from "../audio/useAudioReactive";
import { FONT_FAMILIES } from "../typography/fonts";
import { Activity, Radio, Volume2, Waves } from "lucide-react";

export const AudioReactiveShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Load the real 10-second audio track generated with sub-bass kicks & melodic arpeggios
  const audioSrc = staticFile("test-beat.mp3");
  const { beat, bass, mid, treble, rawFrequencies, isAudioLoaded } =
    useRealAudioReactive(audioSrc, { numberOfSamples: 32 });

  const currentTimeSec = (frame / fps).toFixed(2);

  return (
    <AbsoluteFill
      className="bg-[#060709] text-white flex flex-col justify-between p-16 select-none overflow-hidden"
      style={{
        fontFamily: FONT_FAMILIES.sans,
        backgroundImage: `
          radial-gradient(circle at 50% 50%, rgba(56, 189, 248, ${0.05 + bass * 0.15}) 0%, transparent 65%),
          radial-gradient(circle at 20% 80%, rgba(168, 85, 247, ${0.04 + beat * 0.12}) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(34, 197, 94, ${0.03 + treble * 0.1}) 0%, transparent 50%)
        `,
      }}
    >
      {/* Actual embedded audio track for the final rendered video */}
      <Audio src={audioSrc} />

      {/* Subtle background tech grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* HEADER: Audio Pipeline Telemetry */}
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Real Audio FFT Engine
            </span>
            <span className="text-xs text-white/40 font-mono tracking-widest uppercase">
              Phase 2.6 Verification
            </span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            Live Audio-Reactive Waveform Analysis
          </h1>
          <p className="mt-1 text-sm text-white/50 font-light">
            Real-time multi-band FFT decomposition driving visual springs & geometry
          </p>
        </div>

        {/* Telemetry Box */}
        <div className="bg-[#0B0D14]/90 border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col items-end gap-1 font-mono text-xs">
          <div className="flex items-center gap-2 text-cyan-400">
            <Activity className="w-4 h-4" />
            <span className="font-bold">FFT ENGINE {isAudioLoaded ? "ACTIVE" : "READY"}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
              {currentTimeSec}s / 10.00s
            </span>
          </div>
          <div className="text-white/70">
            FRAME: <span className="text-white font-bold">{frame}</span> / 600
          </div>
          <div className="text-white/70">
            SAMPLING: <span className="text-emerald-400 font-bold">32 FFT BINS @ 60 FPS</span>
          </div>
          <div className="text-white/50 text-[10px] mt-1">
            BASS: {(bass * 100).toFixed(0)}% &bull; MID: {(mid * 100).toFixed(0)}% &bull; TREBLE: {(treble * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* CENTER VISUAL: Pulsing Core + Kinetic Orbit */}
      <div className="relative z-10 flex items-center justify-center my-auto">
        <div className="relative flex items-center justify-center w-[360px] h-[360px]">
          {/* Outer Bass Halo Ring */}
          <div
            className="absolute rounded-full border border-cyan-500/30"
            style={{
              width: `${240 + bass * 120}px`,
              height: `${240 + bass * 120}px`,
              opacity: 0.3 + bass * 0.7,
              boxShadow: `0 0 ${40 * bass}px rgba(56, 189, 248, ${0.4 * bass})`,
              transition: "none",
            }}
          />

          {/* Mid-frequency Beat Pulse Ring */}
          <div
            className="absolute rounded-full border-2 border-purple-500/40"
            style={{
              width: `${170 + beat * 90}px`,
              height: `${170 + beat * 90}px`,
              opacity: 0.4 + beat * 0.6,
              transform: `scale(${1 + beat * 0.2})`,
              boxShadow: `0 0 ${30 * beat}px rgba(168, 85, 247, ${0.5 * beat})`,
              transition: "none",
            }}
          />

          {/* Center glowing core */}
          <div
            className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex flex-col items-center justify-center shadow-2xl"
            style={{
              transform: `scale(${1 + beat * 0.28}) rotate(${frame * 0.5}deg)`,
              boxShadow: `0 0 ${50 * (beat + bass)}px rgba(99, 102, 241, 0.6)`,
              transition: "none",
            }}
          >
            <Volume2 className="w-10 h-10 text-white" />
          </div>
        </div>
      </div>

      {/* BOTTOM: 24-Band Multi-Frequency Visualizer Bars */}
      <div className="relative z-10 bg-[#0B0D14]/80 border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-white/60">
            <Waves className="w-4 h-4 text-cyan-400" />
            <span>32-BAND REAL FFT SPECTRUM ANALYZER</span>
          </div>
          <div className="flex gap-4 font-mono text-xs">
            <span className="text-cyan-400">● LOW (20-250Hz)</span>
            <span className="text-purple-400">● MID (250-4kHz)</span>
            <span className="text-emerald-400">● HIGH (4k-16kHz)</span>
          </div>
        </div>

        {/* Dynamic Equalizer Bars */}
        <div className="h-32 flex items-end gap-2.5 px-2">
          {rawFrequencies.map((freq, idx) => {
            const heightPercent = Math.max(6, Math.min(100, freq * 100));
            let color = "from-cyan-500 to-blue-600";
            if (idx >= 6 && idx < 16) color = "from-purple-500 to-pink-600";
            if (idx >= 16) color = "from-emerald-500 to-teal-600";

            return (
              <div
                key={`freq-bar-${idx}`}
                className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
              >
                <div
                  className={`w-full rounded-t-lg bg-gradient-to-t ${color} transition-none shadow-sm`}
                  style={{
                    height: `${heightPercent}%`,
                    opacity: 0.4 + (heightPercent / 100) * 0.6,
                    boxShadow:
                      heightPercent > 50
                        ? `0 0 12px rgba(56, 189, 248, 0.4)`
                        : "none",
                  }}
                />
                <span className="font-mono text-[9px] text-white/40">
                  {idx + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
