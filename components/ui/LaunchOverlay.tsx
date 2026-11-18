"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Rocket } from "lucide-react";
import { useMission } from "@/lib/store";
import MagnetLines from "@/components/reactbits/MagnetLines";
import StarBorder from "@/components/reactbits/StarBorder";
import ClickSpark from "@/components/reactbits/ClickSpark";
import ScrambleText from "./ScrambleText";

const CHECKS = [
  "UPLINK // NASA OPEN API",
  "TELEMETRY // NEOWS · APOD · EPIC · DONKI",
  "AMBIENT SYNTH // PROCEDURAL BUS",
  "STARFIELD // RENDERER ARMED",
];

export default function LaunchOverlay() {
  const { launched, launch } = useMission();

  return (
    <AnimatePresence>
      {!launched && (
        <motion.div
          className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-void/70 backdrop-blur-2xl"
          exit={{ opacity: 0, filter: "blur(12px)" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* interactive line-field backdrop */}
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <MagnetLines
              spacing={36}
              lineColor="rgba(255,255,255,0.05)"
              accentColor="rgba(245,165,36,0.35)"
              lineWidth={1}
              lineHeight={16}
              baseAngle={-10}
              radius={260}
              fade={0.8}
              className="h-full w-full"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)," +
                "linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "88px 88px",
              maskImage:
                "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="relative flex flex-col items-center px-6 text-center"
          >
            <div className="font-mono text-[10px] tracking-[0.5em] text-faint">
              COGNITION LABS // DEEP WORK TERMINAL
            </div>
            <h1 className="mt-4 font-display text-5xl font-bold tracking-[0.14em] text-bone sm:text-7xl">
              ORBITAL<span className="text-amber">®</span>
            </h1>
            <div className="mt-2 font-mono text-xs tracking-[0.6em] text-dim">
              FOCUS STATION
            </div>

            <div className="mt-10 flex flex-col items-start gap-1.5 font-mono text-[10px] tracking-[0.3em] text-faint">
              {CHECKS.map((c, i) => (
                <motion.div
                  key={c}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.35 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-cyan">▸</span>
                  <ScrambleText text={c} duration={500} />
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 + i * 0.35 }}
                    className="text-amber"
                  >
                    OK
                  </motion.span>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2 }}
              className="mt-12"
            >
              <ClickSpark
                sparkColor="#f5a524"
                sparkCount={12}
                sparkRadius={28}
                sparkSize={9}
                duration={500}
              >
                <StarBorder
                  as="button"
                  onClick={launch}
                  color="#f5a524"
                  trailColor="rgba(255,255,255,0.18)"
                  duration={5}
                  thickness={1}
                  radius={999}
                  stars={2}
                  glow={0.6}
                  theme="dark"
                  className="group font-mono text-[11px] tracking-[0.4em]"
                >
                  <span className="flex items-center gap-3 px-6 py-1.5">
                    <Rocket
                      className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5"
                      strokeWidth={1.5}
                    />
                    LAUNCH MISSION
                  </span>
                </StarBorder>
              </ClickSpark>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.4 }}
              className="mt-6 font-mono text-[8px] tracking-[0.3em] text-faint"
            >
              AUDIO ENGAGES ON LAUNCH · HEADPHONES RECOMMENDED
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
