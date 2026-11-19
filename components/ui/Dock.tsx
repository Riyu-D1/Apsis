"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  AudioLines,
  Eye,
  EyeOff,
  Orbit,
  ScrollText,
  Sun,
  Telescope,
  Ticket,
  Waypoints,
} from "lucide-react";
import { useMission } from "@/lib/store";
import type { MissionMode } from "@/lib/types";
import BitsDock, { type DockItemData } from "@/components/reactbits/Dock";
import AudioMixer from "./AudioMixer";
import FlightLog from "./FlightLog";

const MODES: { id: MissionMode; label: string; full: string; icon: typeof Orbit }[] = [
  { id: "asteroid", label: "ASTEROID", full: "ASTEROID HITCHHIKER", icon: Orbit },
  { id: "apod", label: "DEEP SPACE", full: "DEEP SPACE DRIFT", icon: Telescope },
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
    logOpen,
    setLogOpen,
    openPass,
    tasks,
    hintSeen,
    dismissHint,
  } = useMission();
  const openTasks = tasks.filter((t) => !t.done).length;

  /* first-run guidance — auto-dismiss after a beat */
  const showHint = launched && !hintSeen;
  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(dismissHint, 9000);
    return () => clearTimeout(t);
  }, [showHint, dismissHint]);

  const items: DockItemData[] = [
    ...MODES.map((m, i) => ({
      icon: <m.icon className={ICON} strokeWidth={1.5} />,
      label: `${m.label} — ${i + 1}`,
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
      icon: <ScrollText className={ICON} strokeWidth={1.5} />,
      label: "FLIGHT LOG",
      onClick: () => setLogOpen(!logOpen),
      active: logOpen,
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
        <FlightLog open={logOpen} />
        {showHint ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-2.5 text-center font-mono text-[8px] tracking-[0.35em] text-amber/80"
          >
            1–3 PROFILES · SPACE IGNITE · H ZEN
          </motion.div>
        ) : (
          <div className="mb-2.5 text-center font-mono text-[8px] tracking-[0.4em] text-faint">
            MISSION PROFILE{" "}
            <span className="text-bone/70">
              {"// "}
              {MODES.find((m) => m.id === mode)?.full}
            </span>
          </div>
        )}
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
