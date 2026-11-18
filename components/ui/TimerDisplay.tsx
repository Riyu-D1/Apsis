"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useMission } from "@/lib/store";
import { fmtClock } from "@/lib/format";

const PRESETS = [
  { label: "POMODORO", sec: 25 * 60 },
  { label: "DEEP WORK", sec: 50 * 60 },
  { label: "ULTRADIAN", sec: 90 * 60 },
];

export default function TimerDisplay() {
  const {
    durationSec,
    remainingSec,
    running,
    setPreset,
    startTimer,
    pauseTimer,
    resetTimer,
    zen,
    launched,
  } = useMission();
  const [customOpen, setCustomOpen] = useState(false);
  const [customMin, setCustomMin] = useState("45");

  const progress = durationSec ? 1 - remainingSec / durationSec : 0;
  const R = 150;
  const C = 2 * Math.PI * R;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
      <motion.div
        animate={{
          scale: zen ? 0.55 : 1,
          opacity: zen ? 0.55 : 1,
          y: zen ? 60 : 0,
        }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center"
      >
        {/* dial */}
        <div className="relative flex items-center justify-center">
          <svg
            width="340"
            height="340"
            viewBox="0 0 340 340"
            className="animate-spin-slow absolute opacity-40"
          >
            <circle
              cx="170"
              cy="170"
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="1"
              strokeDasharray="2 10"
            />
          </svg>
          <svg width="340" height="340" viewBox="0 0 340 340" className="absolute -rotate-90">
            <circle
              cx="170"
              cy="170"
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1.5"
            />
            <circle
              cx="170"
              cy="170"
              r={R}
              fill="none"
              stroke="#f4f4f6"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-500 ease-linear"
            />
          </svg>
          <div className="flex flex-col items-center">
            <div className="font-mono text-[10px] tracking-[0.5em] text-faint">
              {running ? "IN FLIGHT" : remainingSec === durationSec ? "STANDBY" : "HOLD"}
            </div>
            <div
              className="text-glow mt-2 font-display font-light tracking-tight text-bone"
              style={{
                fontSize: "clamp(4.5rem, 11vw, 7.5rem)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {fmtClock(remainingSec)}
            </div>
            <div className="mt-2 font-mono text-[9px] tracking-[0.4em] text-faint">
              T-MINUS // MISSION CLOCK
            </div>
          </div>
        </div>

        {/* controls */}
        <motion.div
          animate={{ opacity: zen || !launched ? 0 : 1 }}
          transition={{ duration: 0.5 }}
          className={`pointer-events-auto mt-9 flex flex-col items-center gap-4 ${
            zen || !launched ? "invisible" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setPreset(p.sec)}
                className={`glass-soft rounded-full px-4 py-1.5 font-mono text-[10px] tracking-[0.2em] transition-colors ${
                  durationSec === p.sec
                    ? "border-amber/50 text-amber"
                    : "text-dim hover:text-bone"
                }`}
              >
                {p.label} {p.sec / 60}
              </button>
            ))}
            <button
              onClick={() => setCustomOpen((o) => !o)}
              className={`glass-soft rounded-full px-4 py-1.5 font-mono text-[10px] tracking-[0.2em] transition-colors ${
                customOpen ? "border-cyan/50 text-cyan" : "text-dim hover:text-bone"
              }`}
            >
              CUSTOM
            </button>
          </div>

          {customOpen && (
            <form
              className="glass flex items-center gap-2 rounded-full px-4 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                const m = Math.max(1, Math.min(999, parseInt(customMin) || 0));
                setPreset(m * 60);
                setCustomOpen(false);
              }}
            >
              <input
                autoFocus
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value.replace(/\D/g, ""))}
                className="w-14 bg-transparent text-center font-mono text-sm text-bone outline-none"
                style={{ fontVariantNumeric: "tabular-nums" }}
              />
              <span className="font-mono text-[10px] tracking-[0.2em] text-faint">
                MIN
              </span>
              <button
                type="submit"
                className="font-mono text-[10px] tracking-[0.2em] text-amber hover:text-bone"
              >
                SET
              </button>
            </form>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={running ? pauseTimer : startTimer}
              className="glass flex items-center gap-2 rounded-full px-7 py-2.5 font-mono text-[11px] tracking-[0.3em] text-bone transition-colors hover:border-white/25"
            >
              {running ? (
                <>
                  <Pause className="h-3.5 w-3.5" strokeWidth={1.5} /> HOLD
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" strokeWidth={1.5} /> IGNITE
                </>
              )}
            </button>
            <button
              onClick={resetTimer}
              className="glass-soft rounded-full p-2.5 text-dim transition-colors hover:text-bone"
              aria-label="Reset timer"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
