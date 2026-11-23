import React, { createContext, useContext } from "react";
import type { BeatGrid } from "./beatGrid";

export interface FilmTime {
  /** Absolute film time in seconds. Fractional values are allowed (motion-blur sub-samples). */
  t: number;
  frame: number;
  fps: number;
  grid: BeatGrid;
  seed: number;
}

const FilmTimeContext = createContext<FilmTime | null>(null);

export const FilmTimeProvider: React.FC<{ value: FilmTime; children: React.ReactNode }> = ({ value, children }) => (
  <FilmTimeContext.Provider value={value}>{children}</FilmTimeContext.Provider>
);

/** The one clock every engine component reads. Never use R3F's clock or useFrame for animation. */
export function useFilmTime(): FilmTime {
  const ctx = useContext(FilmTimeContext);
  if (!ctx) throw new Error("useFilmTime() must be used inside <FilmTimeProvider> (the Stage provides it).");
  return ctx;
}
