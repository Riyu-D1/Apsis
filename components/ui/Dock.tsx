"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";
import {
  AudioLines,
  Earth,
  Eye,
  EyeOff,
  Orbit,
  Sun,
  Telescope,
  Ticket,
  Waypoints,
} from "lucide-react";
import { useMission } from "@/lib/store";
import type { MissionMode } from "@/lib/types";
import AudioMixer from "./AudioMixer";

const MODES: { id: MissionMode; label: string; icon: typeof Orbit }[] = [
  { id: "asteroid", label: "ASTEROID", icon: Orbit },
  { id: "apod", label: "DEEP SPACE", icon: Telescope },
  { id: "cupola", label: "CUPOLA", icon: Earth },
  { id: "solar", label: "SOLAR", icon: Sun },
];

function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 320, damping: 20 });
  const sy = useSpring(y, { stiffness: 320, damping: 20 });

  return (
    <motion.div
      ref={ref}
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - r.left - r.width / 2) * 0.28);
        y.set((e.clientY - r.top - r.height / 2) * 0.28);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

function DockButton({
  label,
  active,
  onClick,
  badge,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <Magnetic>
      <button
        onClick={onClick}
        className={`group relative flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-200 sm:h-12 sm:w-12 ${
          active
            ? "border-white/25 bg-white/10 text-bone"
            : "border-transparent text-dim hover:bg-white/[0.06] hover:text-bone"
        }`}
      >
        {children}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-1 font-mono text-[8px] font-bold text-void">
            {badge}
          </span>
        )}
        <span className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-md border border-white/10 bg-panel px-2 py-1 font-mono text-[8px] tracking-[0.25em] text-dim opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {label}
        </span>
        {active && (
          <motion.span
            layoutId="dock-dot"
            className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-amber"
          />
        )}
      </button>
    </Magnetic>
  );
}

export default function Dock() {
  const {
    mode,
    setMode,
    zen,
    toggleZen,
    launched,
    planOpen,
    setPlanOpen,
    mixerOpen,
    setMixerOpen,
    openPass,
    tasks,
  } = useMission();
  const openTasks = tasks.filter((t) => !t.done).length;

  return (
    <motion.div
      className="absolute inset-x-0 bottom-5 z-30 flex justify-center"
      animate={{
        opacity: zen || !launched ? 0 : 1,
        y: zen || !launched ? 24 : 0,
      }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ pointerEvents: zen || !launched ? "none" : "auto" }}
    >
      <div className="relative">
        <AudioMixer open={mixerOpen} />
        <div className="glass flex items-center gap-1 rounded-2xl px-2.5 py-2">
          {MODES.map((m) => (
            <DockButton
              key={m.id}
              label={m.label}
              active={mode === m.id}
              onClick={() => setMode(m.id)}
            >
              <m.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </DockButton>
          ))}
          <div className="mx-1.5 h-7 w-px bg-white/10" />
          <DockButton
            label="FLIGHT PLAN"
            active={planOpen}
            badge={openTasks}
            onClick={() => setPlanOpen(!planOpen)}
          >
            <Waypoints className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </DockButton>
          <DockButton
            label="AMBIENT MIX"
            active={mixerOpen}
            onClick={() => setMixerOpen(!mixerOpen)}
          >
            <AudioLines className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </DockButton>
          <DockButton label="ZEN — H" onClick={toggleZen}>
            {zen ? (
              <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.5} />
            ) : (
              <Eye className="h-[18px] w-[18px]" strokeWidth={1.5} />
            )}
          </DockButton>
          <DockButton label="BOARDING PASS" onClick={openPass}>
            <Ticket className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </DockButton>
        </div>
      </div>
    </motion.div>
  );
}
