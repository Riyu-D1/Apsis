"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useMission } from "@/lib/store";
import type { MissionMode } from "@/lib/types";

/* each scene ships in its own chunk — only the active profile's code loads */
const AsteroidScene = dynamic(() => import("./AsteroidScene"));
const ApodScene = dynamic(() => import("./ApodScene"));
const SolarScene = dynamic(() => import("./SolarScene"));

const SCENE_META: Record<MissionMode, { label: string; desc: string }> = {
  asteroid: {
    label: "Asteroid Hitchhiker",
    desc: "3D flyby tracking of today's near-Earth asteroids",
  },
  apod: {
    label: "Deep Space Drift",
    desc: "NASA astronomy picture archive gallery",
  },
  solar: {
    label: "Solar Telemetry",
    desc: "Generative sun driven by live space-weather data",
  },
};

/** If a WebGL scene dies, the station stays alive — degrade to a panel. */
class SceneBoundary extends Component<
  { children: ReactNode; name: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="glass rounded-xl px-6 py-4 text-center font-mono text-[10px] tracking-[0.3em] text-faint">
            {this.props.name} — RENDER OFFLINE
            <div className="mt-1.5 text-[8px] text-faint/70">
              SWITCH PROFILE OR RELOAD
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Cinematic viewfinder — corner brackets + edge ticks + faint grid. */
function ViewportFrame() {
  const c = "absolute h-5 w-5 border-white/[0.14]";
  return (
    <div className="pointer-events-none absolute inset-3 z-10 hidden sm:block">
      {/* faint blueprint grid */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
        }}
      />
      <div className={`${c} left-0 top-0 border-l border-t`} />
      <div className={`${c} right-0 top-0 border-r border-t`} />
      <div className={`${c} bottom-0 left-0 border-b border-l`} />
      <div className={`${c} bottom-0 right-0 border-b border-r`} />
      {/* edge ticks */}
      <div className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-white/[0.14]" />
      <div className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-white/[0.14]" />
      <div className="absolute left-0 top-1/2 h-px w-2 -translate-y-1/2 bg-white/[0.14]" />
      <div className="absolute right-0 top-1/2 h-px w-2 -translate-y-1/2 bg-white/[0.14]" />
    </div>
  );
}

export default function SceneStage() {
  const { mode } = useMission();
  const meta = SCENE_META[mode];
  return (
    <div
      className="absolute inset-0"
      role="img"
      aria-label={`${meta.label} — ${meta.desc}`}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.04, filter: "brightness(0.4)" }}
          animate={{ opacity: 1, scale: 1, filter: "brightness(1)" }}
          exit={{ opacity: 0, scale: 0.99, filter: "brightness(0.5)" }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          <SceneBoundary name={meta.label.toUpperCase()}>
            {mode === "asteroid" && <AsteroidScene />}
            {mode === "apod" && <ApodScene />}
            {mode === "solar" && <SolarScene />}
          </SceneBoundary>
        </motion.div>
      </AnimatePresence>
      <ViewportFrame />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-void/90 to-transparent" />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.05]" />
    </div>
  );
}
