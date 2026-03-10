import type { ProfilerOnRenderCallback } from 'react';

declare global {
  interface Window {
    __TRUCO_PERF__?: {
      reactCommits: Array<{
        actualDuration: number;
        baseDuration: number;
        commitTime: number;
        id: string;
        phase: string;
        startTime: number;
      }>;
    };
  }
}

const MAX_SAMPLES = 120;

export function isProfilerEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_PROFILER === 'true';
}

export const recordReactCommit: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  if (!isProfilerEnabled()) {
    return;
  }

  const store = window.__TRUCO_PERF__ ?? { reactCommits: [] };
  store.reactCommits.push({
    actualDuration: Number(actualDuration.toFixed(3)),
    baseDuration: Number(baseDuration.toFixed(3)),
    commitTime: Number(commitTime.toFixed(3)),
    id,
    phase,
    startTime: Number(startTime.toFixed(3)),
  });

  if (store.reactCommits.length > MAX_SAMPLES) {
    store.reactCommits.shift();
  }

  window.__TRUCO_PERF__ = store;
};
