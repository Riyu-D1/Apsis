"use client";

import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame } from "lucide-react";
import { useMission } from "@/lib/store";
import { fmtInt } from "@/lib/format";
import SpotlightCard from "@/components/reactbits/SpotlightCard";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** Session history popover — flight hours, streak, last 7 days. */
export default function FlightLog({ open }: { open: boolean }) {
  const { sessions, todaySec, weekMin, streak, totalSec } = useMission();
  const todayMin = Math.round(todaySec / 60);
  const max = Math.max(...weekMin, 1);

  // label bars by weekday (weekMin is oldest -> today)
  const todayIdx = new Date().getDay();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute -top-4 left-1/2 w-72 -translate-x-1/2 -translate-y-full"
        >
          <SpotlightCard
            className="w-72"
            spotlightColor="rgba(103, 232, 249, 0.12)"
            theme="dark"
            style={
              {
                padding: "1rem",
                borderRadius: "1rem",
                backdropFilter: "blur(24px) saturate(140%)",
                WebkitBackdropFilter: "blur(24px) saturate(140%)",
                "--spotlight-card-surface": "rgba(12, 12, 16, 0.6)",
              } as CSSProperties
            }
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[9px] tracking-[0.3em] text-faint">
                FLIGHT LOG // HISTORY
              </span>
              <span
                className={`flex items-center gap-1 font-mono text-[9px] tracking-[0.2em] ${
                  streak > 0 ? "text-amber" : "text-faint"
                }`}
              >
                <Flame className="h-3 w-3" strokeWidth={1.5} />
                {streak}D STREAK
              </span>
            </div>

            {/* today */}
            <div className="mb-3 flex items-end justify-between border-b border-white/[0.06] pb-3">
              <div>
                <div className="font-display text-3xl font-light leading-none text-bone">
                  {fmtInt(todayMin)}
                  <span className="ml-1 text-xs text-faint">MIN</span>
                </div>
                <div className="mt-1 font-mono text-[8px] tracking-[0.3em] text-faint">
                  FLIGHT TIME TODAY
                </div>
              </div>
              <div className="text-right font-mono text-[9px] leading-relaxed tracking-[0.15em] text-faint">
                <div>
                  <span className="text-bone/80">{sessions.length}</span> BURNS
                </div>
                <div>
                  <span className="text-bone/80">
                    {(totalSec / 3600).toFixed(1)}
                  </span>{" "}
                  HRS TOTAL
                </div>
              </div>
            </div>

            {/* 7-day bars */}
            <div className="flex h-14 items-end gap-1.5">
              {weekMin.map((m, i) => {
                const dayIdx = (todayIdx - 6 + i + 7) % 7;
                const isToday = i === 6;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-9 w-full items-end">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{
                          height: `${Math.max(m ? (m / max) * 100 : 0, m ? 12 : 4)}%`,
                        }}
                        transition={{ duration: 0.4, delay: i * 0.04 }}
                        className={`w-full rounded-sm ${
                          isToday
                            ? "bg-amber"
                            : m > 0
                              ? "bg-cyan/70"
                              : "bg-white/10"
                        }`}
                      />
                    </div>
                    <span
                      className={`font-mono text-[7px] tracking-widest ${
                        isToday ? "text-amber" : "text-faint"
                      }`}
                    >
                      {DAY_LABELS[dayIdx]}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 border-t border-white/[0.06] pt-2.5 font-mono text-[8px] tracking-[0.25em] text-faint">
              LAST 7 DAYS — LOCAL TIME
            </div>
          </SpotlightCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
