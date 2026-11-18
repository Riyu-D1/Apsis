"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMission } from "@/lib/store";
import AsteroidScene from "./AsteroidScene";
import ApodScene from "./ApodScene";
import CupolaScene from "./CupolaScene";
import SolarScene from "./SolarScene";

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
  return (
    <div className="absolute inset-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.04, filter: "brightness(0.4)" }}
          animate={{ opacity: 1, scale: 1, filter: "brightness(1)" }}
          exit={{ opacity: 0, scale: 0.99, filter: "brightness(0.5)" }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          {mode === "asteroid" && <AsteroidScene />}
          {mode === "apod" && <ApodScene />}
          {mode === "cupola" && <CupolaScene />}
          {mode === "solar" && <SolarScene />}
        </motion.div>
      </AnimatePresence>
      <ViewportFrame />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-void/90 to-transparent" />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.05]" />
    </div>
  );
}
