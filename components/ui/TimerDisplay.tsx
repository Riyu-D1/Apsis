"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Coffee, Pause, Play, RotateCcw } from "lucide-react";
import { useClock, useMission, BREAK_SHORT, BREAK_LONG } from "@/lib/store";
import { fmtClock } from "@/lib/format";
import ClickSpark from "@/components/reactbits/ClickSpark";

const PRESETS = [
  { label: "POMODORO", sec: 25 * 60 },
  { label: "DEEP WORK", sec: 50 * 60 },
  { label: "ULTRADIAN", sec: 90 * 60 },
];

export default function TimerDisplay() {
  const {
    durationSec,
    autoBreaks,
    setAutoBreaks,
    setPreset,
    startTimer,
    pauseTimer,
    resetTimer,
    endBreak,
    zen,
    launched,
  } = useMission();
  const { remainingSec, running, phase, cycle } = useClock();
  const [customOpen, setCustomOpen] = useState(false);
  const [customMin, setCustomMin] = useState("45");

  const isBreak = phase !== "focus";
  const phaseLen = isBreak
    ? phase === "long"
      ? BREAK_LONG
      : BREAK_SHORT
    : durationSec;
  const progress = phaseLen ? 1 - remainingSec / phaseLen : 0;
  const R = 150;
  const C = 2 * Math.PI * R;

  const status = isBreak
    ? running
      ? phase === "long"
        ? "LONG REST"
        : "REST ORBIT"
      : "REST PAUSED"
    : running
      ? "IN FLIGHT"
      : remainingSec === durationSec
        ? "STANDBY"
        : "HOLD";

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
            className="animate-spin-slow absolute opacity-60"
          >
            {Array.from({ length: 60 }, (_, i) => {
              const a = (i / 60) * Math.PI * 2;
              const major = i % 15 === 0;
              const r1 = major ? R - 10 : R - 5;
              return (
                <line
                  key={i}
                  x1={170 + Math.cos(a) * r1}
                  y1={170 + Math.sin(a) * r1}
                  x2={170 + Math.cos(a) * R}
                  y2={170 + Math.sin(a) * R}
                  stroke={
                    major
                      ? isBreak
                        ? "rgba(103,232,249,0.5)"
                        : "rgba(245,165,36,0.5)"
                      : "rgba(255,255,255,0.14)"
                  }
                  strokeWidth={major ? 1.4 : 1}
                />
              );
            })}
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
              stroke={isBreak ? "#67e8f9" : "#f4f4f6"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              className="transition-[stroke-dashoffset,stroke] duration-500 ease-linear"
            />
          </svg>
          <div className="flex flex-col items-center">
            <div
              className={`font-mono text-[10px] tracking-[0.5em] ${
                isBreak ? "text-cyan" : "text-faint"
              }`}
            >
              {status}
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
              {isBreak ? "RECHARGE // MISSION CLOCK" : "T-MINUS // MISSION CLOCK"}
            </div>
            {/* pomodoro cycle pips */}
            {autoBreaks && !isBreak && (
              <div className="mt-3 flex items-center gap-1.5">
                {Array.from({ length: 4 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-3 rounded-full ${
                      i < cycle % 4 || (cycle > 0 && cycle % 4 === 0)
                        ? "bg-amber"
                        : "bg-white/15"
                    }`}
                  />
                ))}
              </div>
            )}
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
          {!isBreak && (
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
              <button
                onClick={() => setAutoBreaks(!autoBreaks)}
                title={`Auto breaks — 5 min rest after each session, 15 min every 4th`}
                className={`glass-soft rounded-full px-4 py-1.5 font-mono text-[10px] tracking-[0.2em] transition-colors ${
                  autoBreaks ? "border-cyan/50 text-cyan" : "text-dim hover:text-bone"
                }`}
              >
                BREAKS {autoBreaks ? "ON" : "OFF"}
              </button>
            </div>
          )}

          {customOpen && !isBreak && (
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
                aria-label="Custom minutes"
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
            <ClickSpark
              sparkColor={isBreak ? "#67e8f9" : "#f5a524"}
              sparkCount={8}
              sparkRadius={20}
              sparkSize={7}
              duration={400}
            >
              <button
                onClick={running ? pauseTimer : startTimer}
                className={`glass flex items-center gap-2 rounded-full px-7 py-2.5 font-mono text-[11px] tracking-[0.3em] transition-colors hover:border-white/25 ${
                  isBreak ? "text-cyan" : "text-bone"
                }`}
              >
                {running ? (
                  <>
                    <Pause className="h-3.5 w-3.5" strokeWidth={1.5} /> HOLD
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {isBreak ? "RESUME REST" : "IGNITE"}
                  </>
                )}
              </button>
            </ClickSpark>
            <button
              onClick={resetTimer}
              className="glass-soft rounded-full p-2.5 text-dim transition-colors hover:text-bone"
              aria-label="Reset timer"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            {isBreak && (
              <button
                onClick={endBreak}
                className="glass-soft flex items-center gap-2 rounded-full px-4 py-2.5 font-mono text-[10px] tracking-[0.2em] text-dim transition-colors hover:text-bone"
              >
                <Coffee className="h-3.5 w-3.5" strokeWidth={1.5} />
                END REST
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
