"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useMission } from "@/lib/store";
import ScrambleText from "@/components/ui/ScrambleText";

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
  const { nasa, apodIndex, nextApod, reportApodError, apodAllFaulted } =
    useMission();
  const list = nasa.apod;
  const img = list[apodIndex % list.length];

  return (
    <div className="absolute inset-0 overflow-hidden bg-void">
      {img && !apodAllFaulted ? (
        <AnimatePresence mode="popLayout">
          <motion.img
            key={img.url}
            src={img.url}
            alt={img.title}
            onError={() => reportApodError(img.url)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
            className="animate-kenburns absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>
      ) : (
        <StarfieldFallback />
      )}

      <div className="vignette absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-void/95 via-void/40 to-transparent" />

      {img && (
        <div className="absolute bottom-24 right-4 flex max-w-xs flex-col items-end gap-2 text-right sm:bottom-28 sm:right-8">
          <div className="glass-soft relative rounded-lg px-4 py-3">
            <div className="absolute left-0 top-0 h-2 w-2 border-l border-t border-white/25" />
            <div className="absolute bottom-0 right-0 h-2 w-2 border-b border-r border-white/25" />
            <div className="font-mono text-[10px] tracking-[0.25em] text-cyan">
              APOD ARCHIVE
            </div>
            <div className="mt-1 font-display text-sm font-medium text-bone">
              <ScrambleText text={img.title} />
            </div>
            <div className="mt-1 font-mono text-[10px] tracking-wider text-dim">
              {img.date} — {img.credit}
            </div>
          </div>
          <button
            onClick={nextApod}
            className="glass group flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[10px] tracking-[0.2em] text-bone transition-colors hover:border-amber/50 hover:text-amber"
          >
            NEXT NEBULA
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
