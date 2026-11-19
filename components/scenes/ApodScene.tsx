"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useMission } from "@/lib/store";
import { useReducedMotion } from "@/lib/useReducedMotion";
import ScrambleText from "@/components/ui/ScrambleText";

const ADVANCE_MS = 16_000;

/** Procedural starfield — guarantees a beautiful backdrop even fully offline. */
function StarfieldFallback() {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 70% 30%, rgba(58,48,120,0.55), transparent 60%)," +
            "radial-gradient(ellipse 60% 50% at 25% 70%, rgba(20,60,90,0.5), transparent 65%)," +
            "radial-gradient(ellipse 40% 40% at 55% 50%, rgba(140,60,90,0.18), transparent 60%)," +
            "#050507",
        }}
      />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 12% 24%, #fff 100%, transparent)," +
            "radial-gradient(1px 1px at 34% 68%, #fff 100%, transparent)," +
            "radial-gradient(1.5px 1.5px at 52% 12%, #fff 100%, transparent)," +
            "radial-gradient(1px 1px at 67% 44%, #fff 100%, transparent)," +
            "radial-gradient(1px 1px at 81% 78%, #fff 100%, transparent)," +
            "radial-gradient(1.5px 1.5px at 89% 22%, #fff 100%, transparent)," +
            "radial-gradient(1px 1px at 22% 86%, #fff 100%, transparent)," +
            "radial-gradient(1px 1px at 44% 38%, #fff 100%, transparent)," +
            "radial-gradient(1px 1px at 76% 58%, #fff 100%, transparent)," +
            "radial-gradient(1.5px 1.5px at 8% 62%, #fff 100%, transparent)," +
            "radial-gradient(1px 1px at 95% 48%, #fff 100%, transparent)," +
            "radial-gradient(1px 1px at 58% 92%, #fff 100%, transparent)",
        }}
      />
    </div>
  );
}

export default function ApodScene() {
  const { nasa, apodIndex, nextApod, goApod, reportApodError, apodAllFaulted } =
    useMission();
  const [abstractOpen, setAbstractOpen] = useState(false);
  const [uiHover, setUiHover] = useState(false);
  const reducedMotion = useReducedMotion();
  const list = nasa.apod;
  const idx = list.length ? apodIndex % list.length : 0;
  const img = list[idx];

  /* auto-advance — pauses while the reader has the abstract open or is
     hovering the editorial UI; resets whenever the index moves */
  const paused = abstractOpen || uiHover;
  useEffect(() => {
    if (!list.length || paused) return;
    const iv = setInterval(() => goApod((idx + 1) % list.length), ADVANCE_MS);
    return () => clearInterval(iv);
  }, [idx, list.length, goApod, paused]);

  /* close the abstract when the frame changes */
  const prevUrl = useRef(img?.url);
  useEffect(() => {
    if (img?.url !== prevUrl.current) {
      prevUrl.current = img?.url;
      setAbstractOpen(false);
    }
  }, [img?.url]);

  /* pointer parallax */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 40, damping: 18 });
  const sy = useSpring(my, { stiffness: 40, damping: 18 });
  const px = useTransform(sx, (v) => v * -16);
  const py = useTransform(sy, (v) => v * -10);

  const lede = img?.explanation
    ? `${img.explanation.split(". ")[0].replace(/\s+/g, " ").trim()}.`
    : "";

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-void"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
        my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
      }}
    >
      {/* image with parallax wrapper + ken burns inside */}
      <motion.div
        className="absolute inset-0"
        style={reducedMotion ? undefined : { x: px, y: py }}
      >
        {img && !apodAllFaulted ? (
          <AnimatePresence mode="sync">
            <motion.img
              key={img.hdurl}
              src={img.hdurl}
              alt={img.title}
              onError={() => reportApodError(img.url)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.7, ease: "easeInOut" }}
              className={`absolute inset-0 h-full w-full object-cover ${
                reducedMotion ? "" : "animate-kenburns scale-[1.06]"
              }`}
            />
          </AnimatePresence>
        ) : (
          <StarfieldFallback />
        )}
      </motion.div>

      <div className="vignette pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-void/95 via-void/50 to-transparent" />
      {/* letterbox hint */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-void/70 to-transparent" />

      {img && (
        <>
          {/* editorial block — bottom left */}
          <div
            className="absolute bottom-28 left-5 max-w-xl sm:left-8"
            onMouseEnter={() => setUiHover(true)}
            onMouseLeave={() => setUiHover(false)}
          >
            <div className="mb-2 flex items-center gap-3 font-mono text-[10px] tracking-[0.3em] text-faint">
              <span className="text-amber">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="h-px w-8 bg-white/20" />
              <span>{img.date}</span>
              <span className="hidden sm:inline">APOD // GSFC</span>
            </div>
            <h2 className="font-display text-2xl font-semibold leading-[1.05] tracking-tight text-bone text-glow sm:text-4xl">
              <ScrambleText text={img.title} duration={40} />
            </h2>
            <div className="mt-2 font-mono text-[10px] tracking-[0.18em] text-dim">
              {img.credit}
            </div>
            {lede && (
              <p className="mt-3 hidden max-w-md text-[13px] leading-relaxed text-dim sm:block">
                {lede}
              </p>
            )}
            {img.explanation && (
              <>
                <button
                  onClick={() => setAbstractOpen((o) => !o)}
                  className="mt-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-bone/70 transition-colors hover:text-amber"
                >
                  {abstractOpen ? (
                    <Minus className="h-3 w-3" strokeWidth={1.5} />
                  ) : (
                    <Plus className="h-3 w-3" strokeWidth={1.5} />
                  )}
                  ABSTRACT
                </button>
                <AnimatePresence>
                  {abstractOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="glass-soft mt-2 max-h-[26vh] max-w-md overflow-y-auto rounded-lg p-3 text-[12px] leading-relaxed text-dim">
                        {img.explanation}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
            {/* progress bar for auto-advance — freezes while paused */}
            <div className="mt-4 h-px w-40 bg-white/10">
              <div
                key={`${img.hdurl}-${paused}`}
                className={`h-px origin-left ${paused ? "bg-white/30" : "bg-amber"}`}
                style={
                  paused
                    ? { transform: "scaleX(0.35)" }
                    : {
                        animation: `apod-progress ${ADVANCE_MS}ms linear forwards`,
                      }
                }
              />
            </div>
          </div>

          {/* filmstrip rail — bottom center */}
          <div
            className="absolute bottom-24 left-1/2 hidden -translate-x-1/2 items-center gap-1.5 md:flex"
            onMouseEnter={() => setUiHover(true)}
            onMouseLeave={() => setUiHover(false)}
          >
            <button
              onClick={() => goApod((idx - 1 + list.length) % list.length)}
              className="glass flex h-9 w-9 items-center justify-center rounded-full text-dim transition-colors hover:border-white/25 hover:text-bone"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <div className="glass-soft flex items-center gap-1.5 rounded-full px-2 py-1.5">
              {list.map((a, i) => (
                <button
                  key={a.url}
                  onClick={() => goApod(i)}
                  className={`group relative h-11 w-16 overflow-hidden rounded-md border transition-all ${
                    i === idx
                      ? "border-amber/70 opacity-100"
                      : "border-white/10 opacity-45 hover:opacity-90"
                  }`}
                  aria-label={a.title}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span
                    className={`absolute bottom-0.5 left-1 font-mono text-[8px] tracking-wider ${
                      i === idx ? "text-amber" : "text-white/70"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={nextApod}
              className="glass flex h-9 w-9 items-center justify-center rounded-full text-dim transition-colors hover:border-white/25 hover:text-bone"
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* mobile next button */}
          <button
            onClick={nextApod}
            className="glass absolute bottom-24 right-5 flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[10px] tracking-[0.2em] text-bone md:hidden"
          >
            NEXT
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </>
      )}
    </div>
  );
}
