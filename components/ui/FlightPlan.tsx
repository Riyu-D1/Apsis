"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useMission } from "@/lib/store";

export default function FlightPlan() {
  const { planOpen, setPlanOpen, tasks, addTask, toggleTask, removeTask } =
    useMission();
  const [draft, setDraft] = useState("");
  const done = tasks.filter((t) => t.done).length;

  return (
    <AnimatePresence>
      {planOpen && (
        <motion.aside
          initial={{ x: "110%" }}
          animate={{ x: 0 }}
          exit={{ x: "110%" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="glass absolute bottom-0 right-0 top-0 z-40 flex w-full max-w-[360px] flex-col border-l border-white/10"
        >
          <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
            <div>
              <div className="font-mono text-[9px] tracking-[0.4em] text-faint">
                MISSION
              </div>
              <div className="mt-0.5 font-display text-sm font-semibold tracking-[0.2em] text-bone">
                FLIGHT PLAN
              </div>
            </div>
            <button
              onClick={() => setPlanOpen(false)}
              className="rounded-full p-1.5 text-dim transition-colors hover:bg-white/[0.06] hover:text-bone"
              aria-label="Close flight plan"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="border-b border-white/[0.07] px-6 py-4">
            <div className="mb-2 flex items-center justify-between font-mono text-[9px] tracking-[0.25em] text-faint">
              <span>WAYPOINTS CLEARED</span>
              <span className="text-cyan">
                {done}/{tasks.length}
              </span>
            </div>
            <div className="h-px w-full bg-white/10">
              <motion.div
                className="h-px bg-amber"
                animate={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <AnimatePresence initial={false}>
              {tasks.map((t, i) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                  className="group mb-1.5 flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.04]"
                >
                  <button
                    onClick={() => toggleTask(t.id)}
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                      t.done
                        ? "border-amber bg-amber text-void"
                        : "border-white/25 text-transparent hover:border-amber/60"
                    }`}
                    aria-label="Toggle waypoint"
                  >
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                  <span className="w-10 shrink-0 font-mono text-[9px] tracking-[0.2em] text-faint">
                    WP-{String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`flex-1 text-[13px] leading-snug transition-colors ${
                      t.done ? "text-faint line-through" : "text-bone/90"
                    }`}
                  >
                    {t.label}
                  </span>
                  <button
                    onClick={() => removeTask(t.id)}
                    className="shrink-0 text-faint opacity-0 transition-opacity hover:text-alert group-hover:opacity-100"
                    aria-label="Delete waypoint"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <form
            className="border-t border-white/[0.07] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              addTask(draft);
              setDraft("");
            }}
          >
            <div className="glass-soft flex items-center gap-2 rounded-full px-4 py-2.5">
              <Plus className="h-3.5 w-3.5 text-faint" strokeWidth={1.5} />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="ADD WAYPOINT…"
                className="flex-1 bg-transparent font-mono text-[11px] tracking-wider text-bone outline-none placeholder:text-faint"
              />
              <button
                type="submit"
                className="font-mono text-[9px] tracking-[0.25em] text-amber transition-colors hover:text-bone"
              >
                LOG
              </button>
            </div>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
