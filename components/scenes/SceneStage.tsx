"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMission } from "@/lib/store";
import AsteroidScene from "./AsteroidScene";
import ApodScene from "./ApodScene";
import CupolaScene from "./CupolaScene";
import SolarScene from "./SolarScene";

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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-void/90 to-transparent" />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.05]" />
    </div>
  );
}
