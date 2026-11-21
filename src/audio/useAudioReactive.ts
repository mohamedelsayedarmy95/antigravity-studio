import { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio, AudioData } from "@remotion/media-utils";

export interface AudioReactiveState {
  /**
   * Normalized beat impulse [0 -> 1]
   * Spikes to 1 on beat drops / transients, decays exponentially.
   */
  beat: number;

  /**
   * Sub-bass and bass energy [0 -> 1] (20Hz - 250Hz)
   */
  bass: number;

  /**
   * Vocal and instrument presence [0 -> 1] (250Hz - 4000Hz)
   */
  mid: number;

  /**
   * High-frequency brilliance [0 -> 1] (4000Hz - 16000Hz)
   */
  treble: number;

  /**
   * Raw frequency bin values normalized [0 -> 1]
   */
  rawFrequencies: number[];

  /**
   * Whether audio data was successfully loaded from source
   */
  isAudioLoaded: boolean;
}

export interface ParametricAudioOptions {
  bpm?: number;
  numberOfSamples?: number;
}

/**
 * useAudioReactive — Apple & Tesla grade audio synchronization hook.
 * Computes deterministic real-time rhythmic BPM beat pulses and frequency envelopes.
 * Allows video choreography and spring synchronization before final voiceover/music injection.
 */
export const useAudioReactive = ({
  bpm = 120,
  numberOfSamples = 16,
}: ParametricAudioOptions = {}): AudioReactiveState => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return useMemo<AudioReactiveState>(() => {
    const framesPerBeat = (60 / bpm) * fps;
    const beatPhase = (frame % framesPerBeat) / framesPerBeat;
    // Exponential decay curve: sharp spike at 0, rapid decay
    const parametricBeat = Math.max(0, Math.exp(-beatPhase * 6));

    // Secondary harmonic oscillations
    const parametricBass =
      Math.sin(frame * 0.1) * 0.2 + 0.3 + parametricBeat * 0.5;
    const parametricMid = Math.cos(frame * 0.15) * 0.2 + 0.3;
    const parametricTreble = Math.sin(frame * 0.25) * 0.15 + 0.25;

    return {
      beat: Math.min(1, Math.max(0, parametricBeat)),
      bass: Math.min(1, Math.max(0, parametricBass)),
      mid: Math.min(1, Math.max(0, parametricMid)),
      treble: Math.min(1, Math.max(0, parametricTreble)),
      rawFrequencies: new Array(numberOfSamples).fill(0).map((_, i) =>
        Math.max(
          0,
          Math.sin(frame * 0.05 + i * 0.4) * 0.5 + 0.5 * parametricBeat
        )
      ),
      isAudioLoaded: false,
    };
  }, [bpm, fps, frame, numberOfSamples]);
};

export interface ExternalAudioReactiveOptions {
  numberOfSamples?: number;
}

/**
 * useRealAudioReactive — Analyzes actual audio tracks using Remotion's FFT engine.
 * Computes sub-bass, mid, and treble energies from live audio waveforms.
 */
export const useRealAudioReactive = (
  audioSrc: string,
  { numberOfSamples = 16 }: ExternalAudioReactiveOptions = {}
): AudioReactiveState => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData: AudioData | null = useAudioData(audioSrc);

  return useMemo<AudioReactiveState>(() => {
    if (!audioData) {
      return {
        beat: 0,
        bass: 0,
        mid: 0,
        treble: 0,
        rawFrequencies: new Array(numberOfSamples).fill(0),
        isAudioLoaded: false,
      };
    }

    const frequencies = visualizeAudio({
      fps,
      frame,
      audioData,
      numberOfSamples,
    });

    const bassSlice = frequencies.slice(0, 3);
    const midSlice = frequencies.slice(3, 10);
    const trebleSlice = frequencies.slice(10);

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const bass = Math.min(1, avg(bassSlice) * 1.5);
    const mid = Math.min(1, avg(midSlice) * 1.2);
    const treble = Math.min(1, avg(trebleSlice) * 1.0);
    const beat = Math.pow(bass, 1.8);

    return {
      beat,
      bass,
      mid,
      treble,
      rawFrequencies: frequencies,
      isAudioLoaded: true,
    };
  }, [audioData, fps, frame, numberOfSamples]);
};
