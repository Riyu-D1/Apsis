"use client";

import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { useMission } from "@/lib/store";
import type { AudioChannel } from "@/lib/audio";
import SpotlightCard from "@/components/reactbits/SpotlightCard";

const CHANNELS: { id: AudioChannel; label: string }[] = [
  { id: "drone", label: "DEEP SPACE DRONE" },
  { id: "noise", label: "WARM BROWN NOISE" },
  { id: "static", label: "CABIN STATIC" },
];

export default function AudioMixer({ open }: { open: boolean }) {
  const { volumes, setVolume, masterVol, setMasterVol, muted, toggleMute } =
    useMission();

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
            spotlightColor="rgba(245, 165, 36, 0.14)"
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
                AMBIENT SYNTH // BUS A
              </span>
              <button
                onClick={toggleMute}
                className="text-dim transition-colors hover:text-bone"
                aria-label="Toggle mute"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Volume2 className="h-4 w-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
            <div className="flex flex-col gap-3.5">
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between font-mono text-[9px] tracking-[0.2em] text-bone/70">
                  BUS LEVEL
                  <span className="text-faint">{Math.round(masterVol * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(masterVol * 100)}
                  onChange={(e) => setMasterVol(Number(e.target.value) / 100)}
                  className="mission-range w-full"
                  style={{ ["--fill" as string]: `${Math.round(masterVol * 100)}%` }}
                  aria-label="Master volume"
                />
              </label>
              {CHANNELS.map((c) => {
                const pct = Math.round(volumes[c.id] * 100);
                return (
                  <label key={c.id} className="block">
                    <span className="mb-1.5 flex items-center justify-between font-mono text-[9px] tracking-[0.2em] text-dim">
                      {c.label}
                      <span className="text-faint">{pct}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pct}
                      onChange={(e) =>
                        setVolume(c.id, Number(e.target.value) / 100)
                      }
                      className="mission-range w-full"
                      style={{ ["--fill" as string]: `${pct}%` }}
                      aria-label={c.label}
                    />
                  </label>
                );
              })}
            </div>
            <div className="mt-3 border-t border-white/[0.06] pt-2.5 font-mono text-[8px] tracking-[0.25em] text-faint">
              PROCEDURAL WEB AUDIO — NO SAMPLES
            </div>
          </SpotlightCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
