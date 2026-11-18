"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMission } from "@/lib/store";

/** Stylised planet that always renders under the EPIC feed. */
function ProceduralEarth() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(circle at 38% 32%, rgba(120,180,255,0.5), transparent 45%)," +
          "radial-gradient(circle at 62% 58%, rgba(30,90,160,0.85), transparent 70%)," +
          "radial-gradient(circle at 45% 70%, rgba(60,140,110,0.35), transparent 40%)," +
          "radial-gradient(circle at 70% 30%, rgba(90,150,200,0.4), transparent 45%)," +
          "radial-gradient(circle at 50% 50%, #0a1e3f 30%, #050d1f 75%)",
      }}
    />
  );
}

function Reticle() {
  const ticks = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const inner = i % 6 === 0 ? 0.92 : 0.955;
        return {
          x1: 50 + Math.cos(a) * inner * 50,
          y1: 50 + Math.sin(a) * inner * 50,
          x2: 50 + Math.cos(a) * 49,
          y2: 50 + Math.sin(a) * 49,
          major: i % 6 === 0,
        };
      }),
    [],
  );
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.25" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.2" strokeDasharray="1 2" />
      <line x1="50" y1="6" x2="50" y2="14" stroke="rgba(255,255,255,0.25)" strokeWidth="0.25" />
      <line x1="50" y1="86" x2="50" y2="94" stroke="rgba(255,255,255,0.25)" strokeWidth="0.25" />
      <line x1="6" y1="50" x2="14" y2="50" stroke="rgba(255,255,255,0.25)" strokeWidth="0.25" />
      <line x1="86" y1="50" x2="94" y2="50" stroke="rgba(255,255,255,0.25)" strokeWidth="0.25" />
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.major ? "rgba(245,165,36,0.5)" : "rgba(255,255,255,0.16)"}
          strokeWidth={t.major ? 0.35 : 0.2}
        />
      ))}
      <circle cx="50" cy="50" r="1" fill="rgba(245,165,36,0.7)" />
    </svg>
  );
}

/** Structural struts around the window ring — ISS Cupola ribs. */
function Struts() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 h-[58%] w-[3px] origin-center rounded-full bg-gradient-to-b from-white/[0.07] via-white/[0.02] to-white/[0.07]"
          style={{ transform: `translate(-50%,-50%) rotate(${(i * 180) / 7}deg)` }}
        />
      ))}
    </div>
  );
}

export default function CupolaScene() {
  const { nasa } = useMission();
  const frames = nasa.epic;
  const [idx, setIdx] = useState(0);
  const [faults, setFaults] = useState<Set<string>>(new Set());

  const ok = frames.filter((f) => !faults.has(f.url));
  const current = ok.length ? ok[idx % ok.length] : null;

  useEffect(() => {
    const iv = setInterval(() => setIdx((i) => i + 1), 9000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-void">
      {/* window */}
      <div className="relative h-[min(74vh,74vw)] w-[min(74vh,74vw)]">
        <div className="absolute -inset-10 rounded-full border border-white/[0.05]" />
        <Struts />
        <div className="absolute inset-0 overflow-hidden rounded-full border border-white/15 shadow-[0_0_120px_rgba(60,110,255,0.12)_inset,0_0_80px_rgba(0,0,0,0.9)]">
          <ProceduralEarth />
          <AnimatePresence mode="sync">
            {current && (
              <motion.img
                key={current.url}
                src={current.url}
                alt={current.caption}
                onError={() =>
                  setFaults((f) => new Set(f).add(current.url))
                }
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.4, ease: "easeInOut" }}
                className="animate-drift absolute inset-0 h-full w-full object-cover"
              />
            )}
          </AnimatePresence>
          {/* inner shadow of the window */}
          <div className="absolute inset-0 rounded-full shadow-[inset_0_0_60px_rgba(0,0,0,0.75)]" />
        </div>
        <Reticle />
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tracking-[0.3em] text-faint">
          CUPOLA // OBS DECK — ALT 408 KM
        </div>
      </div>
      <div className="vignette pointer-events-none absolute inset-0" />
    </div>
  );
}
