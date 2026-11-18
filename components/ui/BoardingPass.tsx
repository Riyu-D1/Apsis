"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toPng } from "html-to-image";
import { Check, Download, X } from "lucide-react";
import { useMission } from "@/lib/store";
import { fmtInt, missionCode, mulberry32, seedFromString } from "@/lib/format";
import CountUp from "@/components/reactbits/CountUp";

const MODE_NAMES = {
  asteroid: "ASTEROID HITCHHIKER",
  apod: "DEEP SPACE DRIFT",
  cupola: "ORBITAL CUPOLA",
  solar: "SOLAR TELEMETRY",
} as const;

function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    const rand = mulberry32(seedFromString(seed));
    const arr: number[] = [];
    let x = 0;
    while (x < 240) {
      const w = 1 + Math.floor(rand() * 4);
      const gap = 1 + Math.floor(rand() * 3);
      arr.push(x, w);
      x += w + gap;
    }
    const out: { x: number; w: number }[] = [];
    for (let i = 0; i < arr.length; i += 2) out.push({ x: arr[i], w: arr[i + 1] });
    return out;
  }, [seed]);
  return (
    <svg viewBox="0 0 240 34" className="h-8 w-full" preserveAspectRatio="none">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={34} fill="#f4f4f6" />
      ))}
    </svg>
  );
}

function Trajectory() {
  return (
    <svg viewBox="0 0 300 60" className="h-12 w-full" fill="none">
      <path
        d="M8 52 C 90 8, 210 8, 292 40"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1"
        strokeDasharray="4 5"
      />
      <circle cx="8" cy="52" r="3" fill="#f5a524" />
      <circle cx="292" cy="40" r="4.5" stroke="#67e8f9" strokeWidth="1" />
      <circle cx="292" cy="40" r="1.6" fill="#67e8f9" />
      <text x="16" y="58" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace" letterSpacing="2">
        DEPARTURE
      </text>
      <text x="252" y="58" fill="rgba(103,232,249,0.6)" fontSize="7" fontFamily="monospace" letterSpacing="2">
        PRESENT
      </text>
    </svg>
  );
}

export default function BoardingPass() {
  const {
    passOpen,
    closePass,
    mode,
    asteroid,
    durationSec,
    lastSession,
    tasks,
    missionTitle,
    setMissionTitle,
    nasa,
  } = useMission();
  const [story, setStory] = useState(false);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const sessionSec = lastSession?.durationSec ?? durationSec;
  const sessionMin = Math.round(sessionSec / 60);
  const travelled = Math.round(asteroid.velocityKmh * (sessionSec / 3600));
  const code = useMemo(() => missionCode(), []);
  const doneTasks = tasks.filter((t) => t.done).slice(0, 4);
  const today = new Date()
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();

  const download = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const url = await toPng(cardRef.current, {
        pixelRatio: 3,
        backgroundColor: "#050507",
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${code}-boarding-pass.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {passOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-void/80 p-4 backdrop-blur-md"
          onClick={closePass}
        >
          <motion.div
            initial={{ scale: 0.92, y: 30, rotateX: 8 }}
            animate={{ scale: 1, y: 0, rotateX: 0 }}
            exit={{ scale: 0.94, y: 20, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col items-center gap-5"
          >
            {/* ------- the artifact ------- */}
            <div
              ref={cardRef}
              className={`relative overflow-hidden rounded-lg border border-white/12 bg-[#0a0a0d] font-mono text-bone ${
                story ? "w-[360px]" : "w-[min(92vw,520px)]"
              }`}
            >
              <div className="h-1 w-full bg-gradient-to-r from-amber via-bone to-cyan" />
              <div className={`flex flex-col ${story ? "p-6" : "p-7"}`}>
                {/* header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[8px] tracking-[0.45em] text-faint">
                      COGNITION LABS
                    </div>
                    <div className="mt-1 font-display text-lg font-bold tracking-[0.18em]">
                      ORBITAL<span className="text-amber">®</span> FOCUS
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] tracking-[0.35em] text-faint">
                      BOARDING PASS
                    </div>
                    <div className="mt-1 text-[11px] tracking-[0.2em] text-cyan">
                      {code}
                    </div>
                  </div>
                </div>

                {/* callsign */}
                <div className="mt-5">
                  <div className="text-[8px] tracking-[0.35em] text-faint">
                    MISSION CALLSIGN
                  </div>
                  <input
                    value={missionTitle}
                    onChange={(e) => setMissionTitle(e.target.value.toUpperCase())}
                    maxLength={26}
                    className="mt-1 w-full bg-transparent font-display text-xl font-medium uppercase tracking-[0.14em] text-bone outline-none placeholder:text-faint"
                    placeholder="DEEP WORK RUN"
                  />
                </div>

                {/* meta grid */}
                <div className="mt-4 grid grid-cols-3 gap-3 border-y border-dashed border-white/15 py-4">
                  <div>
                    <div className="text-[7px] tracking-[0.3em] text-faint">DATE</div>
                    <div className="mt-1 text-[11px] tracking-wider">{today}</div>
                  </div>
                  <div>
                    <div className="text-[7px] tracking-[0.3em] text-faint">PROFILE</div>
                    <div className="mt-1 text-[11px] tracking-wider">
                      {MODE_NAMES[mode].split(" ")[0]}
                    </div>
                  </div>
                  <div>
                    <div className="text-[7px] tracking-[0.3em] text-faint">DURATION</div>
                    <div className="mt-1 font-display text-base font-semibold tracking-wider text-amber">
                      {sessionMin} MIN
                    </div>
                  </div>
                </div>

                {/* telemetry */}
                <div className="mt-4 space-y-1.5 text-[10px] leading-relaxed tracking-wider">
                  <div className="text-dim">
                    YOU TRAVELLED{" "}
                    <CountUp
                      to={travelled}
                      separator=","
                      duration={1.6}
                      trigger="load"
                      suffix=" KM"
                      className="text-bone"
                    />{" "}
                    ALONGSIDE{" "}
                    <span className="text-amber">{asteroid.name}</span>
                  </div>
                  <div className="flex justify-between text-faint">
                    <span>REL VELOCITY</span>
                    <span>{fmtInt(asteroid.velocityKmh)} KM/H</span>
                  </div>
                  <div className="flex justify-between text-faint">
                    <span>MISS DISTANCE</span>
                    <span>{fmtInt(asteroid.missDistanceKm)} KM</span>
                  </div>
                  <div className="flex justify-between text-faint">
                    <span>THREAT CLASS</span>
                    <span className={asteroid.hazardous ? "text-alert" : "text-cyan"}>
                      {asteroid.hazardous ? "HAZARDOUS" : "NOMINAL"}
                    </span>
                  </div>
                </div>

                {/* waypoints */}
                {doneTasks.length > 0 && (
                  <div className="mt-4 border-t border-dashed border-white/15 pt-3">
                    <div className="mb-1.5 text-[7px] tracking-[0.3em] text-faint">
                      WAYPOINTS CLEARED
                    </div>
                    {doneTasks.map((t, i) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 text-[10px] tracking-wider text-dim"
                      >
                        <Check className="h-2.5 w-2.5 text-amber" strokeWidth={2.5} />
                        <span className="text-faint">
                          WP-{String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate">{t.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4">
                  <Trajectory />
                </div>

                {/* barcode + footer */}
                <div className="mt-3">
                  <Barcode seed={code} />
                  <div className="mt-1.5 flex items-center justify-between text-[7px] tracking-[0.3em] text-faint">
                    <span>{code}</span>
                    <span>SEAT // 1A</span>
                  </div>
                </div>

                <div className="mt-4 border-t border-white/10 pt-3 text-center text-[7px] leading-relaxed tracking-[0.25em] text-faint">
                  TELEMETRY // NASA OPEN API — NEOWS · APOD · EPIC · DONKI
                  <br />
                  UPLINK {nasa.sources.neows === "live" ? "LIVE" : "CACHED"} — NOT
                  AFFILIATED WITH NASA
                </div>
              </div>
            </div>

            {/* ------- controls ------- */}
            <div className="glass flex items-center gap-2 rounded-full px-3 py-2">
              <div className="flex rounded-full border border-white/10 p-0.5">
                {[
                  { label: "1:1", on: !story },
                  { label: "9:16", on: story },
                ].map((f) => (
                  <button
                    key={f.label}
                    onClick={() => setStory(f.label === "9:16")}
                    className={`rounded-full px-3.5 py-1 font-mono text-[10px] tracking-[0.2em] transition-colors ${
                      f.on ? "bg-bone text-void" : "text-dim hover:text-bone"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={download}
                disabled={busy}
                className="flex items-center gap-2 rounded-full bg-bone px-5 py-2 font-mono text-[10px] font-semibold tracking-[0.25em] text-void transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                {busy ? "PRINTING…" : "PNG"}
              </button>
              <button
                onClick={closePass}
                className="rounded-full p-2 text-dim transition-colors hover:text-bone"
                aria-label="Close boarding pass"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
