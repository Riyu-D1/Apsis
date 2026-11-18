"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Radio, TriangleAlert } from "lucide-react";
import { useMission } from "@/lib/store";
import { fmtInt } from "@/lib/format";
import ScrambleText from "./ScrambleText";
import ShinyText from "@/components/reactbits/ShinyText";

function UtcClock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(
        `${String(d.getUTCHours()).padStart(2, "0")}:${String(
          d.getUTCMinutes(),
        ).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")} UTC`,
      );
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span suppressHydrationWarning>{now}</span>;
}

function SourceChip({ source }: { source: "live" | "cache" }) {
  const live = source === "live";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-[0.2em] ${
        live
          ? "border-cyan/30 text-cyan"
          : "border-amber/30 text-amber"
      }`}
    >
      <span
        className={`h-1 w-1 rounded-full ${live ? "bg-cyan" : "bg-amber"} animate-blink`}
      />
      {live ? "UPLINK LIVE" : "ARCHIVE CACHE"}
    </span>
  );
}

function AsteroidSelector() {
  const { nasa, asteroidId, setAsteroidId } = useMission();
  const [open, setOpen] = useState(false);
  const current =
    nasa.asteroids.find((a) => a.id === asteroidId) ?? nasa.asteroids[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="glass group flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-[11px] tracking-[0.15em] text-bone transition-colors hover:border-white/20"
      >
        <span className="text-faint">TRACKING</span>
        <ScrambleText text={current?.name ?? "—"} className="text-amber" />
        <ChevronDown
          className={`h-3 w-3 text-dim transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.5}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="glass absolute left-0 top-full z-40 mt-2 max-h-64 w-64 overflow-y-auto rounded-xl p-1.5"
          >
            {nasa.asteroids.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setAsteroidId(a.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-mono text-[11px] transition-colors hover:bg-white/[0.06] ${
                  a.id === asteroidId ? "text-amber" : "text-dim"
                }`}
              >
                <span className="tracking-wider">{a.name}</span>
                <span className="flex items-center gap-1.5 text-[9px] text-faint">
                  {a.hazardous && (
                    <TriangleAlert className="h-3 w-3 text-alert" strokeWidth={1.5} />
                  )}
                  {fmtInt(a.diameterM)}M
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Telemetry() {
  const { mode, asteroid, nasa, apodIndex } = useMission();
  const rows: [string, string, string?][] =
    mode === "asteroid"
      ? [
          ["VELOCITY", `${fmtInt(asteroid.velocityKmh)} KM/H`],
          ["MISS DIST", `${fmtInt(asteroid.missDistanceKm)} KM`],
          ["DIAMETER", `${fmtInt(asteroid.diameterM)} M`],
          ["CLASS", asteroid.hazardous ? "HAZARDOUS" : "SAFE", asteroid.hazardous ? "alert" : "cyan"],
        ]
      : mode === "apod"
        ? [
            ["FRAME", `${String((apodIndex % nasa.apod.length) + 1).padStart(2, "0")} / ${String(nasa.apod.length).padStart(2, "0")}`],
            ["SOURCE", "APOD // GSFC", "cyan"],
            ["SIGNAL", `${fmtInt(2400 + Math.round(Math.abs(Math.sin(apodIndex)) * 600))} MM`],
          ]
        : mode === "cupola"
          ? [
              ["ALTITUDE", "408 KM"],
              ["VELOCITY", "27,600 KM/H"],
              ["FRAMES", `${nasa.epic.length} EPIC`, "cyan"],
            ]
          : [
              ["KP INDEX", nasa.solar.kpIndex.toFixed(1)],
              ["FLARE CLASS", nasa.solar.flareClass, nasa.solar.level === "STORM" ? "alert" : "cyan"],
              ["ACTIVITY", nasa.solar.level, nasa.solar.level === "STORM" ? "alert" : undefined],
            ];

  return (
    <div className="flex flex-col gap-1.5 font-mono text-[11px] leading-relaxed">
      {rows.map(([k, v, tone]) => (
        <div key={k} className="flex items-baseline gap-3">
          <span className="w-24 shrink-0 text-[9px] tracking-[0.25em] text-faint">
            {k}
          </span>
          <ScrambleText
            text={v}
            className={
              tone === "alert"
                ? "text-alert"
                : tone === "cyan"
                  ? "text-cyan"
                  : "text-bone/80"
            }
          />
        </div>
      ))}
    </div>
  );
}

export default function Hud() {
  const { mode, zen, nasa, launched, remainingSec, durationSec, tasks } =
    useMission();
  const src =
    mode === "asteroid"
      ? nasa.sources.neows
      : mode === "apod"
        ? nasa.sources.apod
        : mode === "cupola"
          ? nasa.sources.epic
          : nasa.sources.donki;

  const elapsed = durationSec - remainingSec;
  const done = tasks.filter((t) => t.done).length;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      animate={{ opacity: zen || !launched ? 0 : 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* top-left — wordmark + selector */}
      <div className="pointer-events-auto absolute left-4 top-4 flex flex-col gap-3 sm:left-6 sm:top-6">
        <div>
          <div className="font-mono text-[9px] tracking-[0.4em] text-faint">
            COGNITION LABS
          </div>
          <div className="mt-0.5 font-display text-base font-semibold tracking-[0.22em] text-bone">
            <ShinyText
              text="ORBITAL®"
              speed={5}
              className="font-display font-semibold tracking-[0.22em]"
            />
            <span className="ml-2 font-light text-dim">{"// FOCUS"}</span>
          </div>
        </div>
        {mode === "asteroid" && <AsteroidSelector />}
      </div>

      {/* top-right — clock + uplink */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-2 sm:right-6 sm:top-6">
        <div className="font-mono text-[11px] tracking-[0.2em] text-dim">
          <UtcClock />
        </div>
        <SourceChip source={src} />
        <div className="hidden items-center gap-1.5 font-mono text-[9px] tracking-[0.25em] text-faint sm:flex">
          <Radio className="h-3 w-3" strokeWidth={1.5} />
          H — HIDE HUD
        </div>
      </div>

      {/* bottom-left — telemetry */}
      <div className="absolute bottom-24 left-4 hidden sm:bottom-28 sm:left-6 sm:block">
        <Telemetry />
      </div>

      {/* left edge — vertical station annotation */}
      <div className="absolute left-5 top-1/2 hidden -translate-y-1/2 -rotate-90 whitespace-nowrap font-mono text-[8px] tracking-[0.5em] text-faint lg:block">
        FOCUS STATION — 51.5072°N · 0.1278°W
      </div>
      <div className="absolute right-5 top-1/2 hidden -translate-y-1/2 rotate-90 whitespace-nowrap font-mono text-[8px] tracking-[0.5em] text-faint lg:block">
        ORBITAL CLASS — CIVILIAN GRADE
      </div>

      {/* bottom-right — session meta */}
      <div className="absolute bottom-24 right-4 hidden flex-col items-end gap-1.5 font-mono text-[10px] tracking-[0.2em] text-faint sm:bottom-28 sm:right-6 sm:flex">
        <div>
          T+{String(Math.floor(elapsed / 60)).padStart(2, "0")}:
          {String(elapsed % 60).padStart(2, "0")} ELAPSED
        </div>
        <div>
          WAYPOINTS {done}/{tasks.length}
        </div>
      </div>
    </motion.div>
  );
}

/** Minimal restore hint shown while zen mode is active. */
export function ZenHint() {
  const { zen, launched } = useMission();
  if (!zen || !launched) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pointer-events-none absolute bottom-6 right-6 z-20 font-mono text-[9px] tracking-[0.35em] text-faint"
    >
      H — RESTORE HUD
    </motion.div>
  );
}
