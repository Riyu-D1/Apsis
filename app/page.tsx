"use client";

import dynamic from "next/dynamic";
import { MissionProvider } from "@/lib/store";
import Hud, { ZenHint } from "@/components/ui/Hud";
import TimerDisplay from "@/components/ui/TimerDisplay";
import Dock from "@/components/ui/Dock";
import FlightPlan from "@/components/ui/FlightPlan";
import BoardingPass from "@/components/ui/BoardingPass";
import LaunchOverlay from "@/components/ui/LaunchOverlay";

const SceneStage = dynamic(() => import("@/components/scenes/SceneStage"), {
  ssr: false,
});

export default function Page() {
  return (
    <MissionProvider>
      <main className="fixed inset-0 overflow-hidden bg-void text-bone">
        <SceneStage />
        <Hud />
        <TimerDisplay />
        <Dock />
        <FlightPlan />
        <BoardingPass />
        <LaunchOverlay />
        <ZenHint />
      </main>
    </MissionProvider>
  );
}
