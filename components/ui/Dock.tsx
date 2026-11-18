"use client";

import { motion } from "framer-motion";
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
import BitsDock, { type DockItemData } from "@/components/reactbits/Dock";
import AudioMixer from "./AudioMixer";

const MODES: { id: MissionMode; label: string; full: string; icon: typeof Orbit }[] = [
  { id: "asteroid", label: "ASTEROID", full: "ASTEROID HITCHHIKER", icon: Orbit },
  { id: "apod", label: "DEEP SPACE", full: "DEEP SPACE DRIFT", icon: Telescope },
  { id: "cupola", label: "CUPOLA", full: "ORBITAL CUPOLA", icon: Earth },
  { id: "solar", label: "SOLAR", full: "SOLAR TELEMETRY", icon: Sun },
];

const ICON = "h-5 w-5";

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

  const items: DockItemData[] = [
    ...MODES.map((m) => ({
      icon: <m.icon className={ICON} strokeWidth={1.5} />,
      label: m.label,
      onClick: () => setMode(m.id),
      active: mode === m.id,
    })),
    { separator: true },
    {
      icon: <Waypoints className={ICON} strokeWidth={1.5} />,
      label: "FLIGHT PLAN",
      onClick: () => setPlanOpen(!planOpen),
      active: planOpen,
      badge: openTasks > 0 ? openTasks : undefined,
    },
    {
      icon: <AudioLines className={ICON} strokeWidth={1.5} />,
      label: "AMBIENT MIX",
      onClick: () => setMixerOpen(!mixerOpen),
      active: mixerOpen,
    },
    {
      icon: zen ? (
        <EyeOff className={ICON} strokeWidth={1.5} />
      ) : (
        <Eye className={ICON} strokeWidth={1.5} />
      ),
      label: "ZEN — H",
      onClick: toggleZen,
    },
    {
      icon: <Ticket className={ICON} strokeWidth={1.5} />,
      label: "BOARDING PASS",
      onClick: openPass,
    },
  ];

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
        <div className="mb-2.5 text-center font-mono text-[8px] tracking-[0.4em] text-faint">
          MISSION PROFILE{" "}
          <span className="text-bone/70">
            {"// "}
            {MODES.find((m) => m.id === mode)?.full}
          </span>
        </div>
        <BitsDock
          items={items}
          position="bottom"
          theme="dark"
          baseItemSize={46}
          magnification={64}
          distance={150}
          panelHeight={60}
          gap={8}
          roundness={18}
          accentColor="#f5a524"
          bounce
          showLabels
          showIndicators
          spring={{ mass: 0.12, stiffness: 170, damping: 13 }}
        />
      </div>
    </motion.div>
  );
}
