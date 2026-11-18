"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { missionAudio, type AudioChannel } from "./audio";
import {
  FALLBACK_APOD,
  FALLBACK_ASTEROIDS,
  FALLBACK_EPIC,
  FALLBACK_SOLAR,
} from "./fallback";
import type { Asteroid, MissionMode, NasaBundle, Task } from "./types";

/* ------------------------------------------------------------------ */

const SEED_TASKS: Task[] = [
  { id: "wp-01", label: "Calibrate the day — notifications off, desk clear", done: true },
  { id: "wp-02", label: "Deep work: finish the architecture draft", done: false },
  { id: "wp-03", label: "Log telemetry — sketch tomorrow's flight plan", done: false },
];

const DEFAULT_VOLUMES: Record<AudioChannel, number> = {
  drone: 0.55,
  noise: 0.3,
  static: 0,
};

const INITIAL_NASA: NasaBundle = {
  asteroids: FALLBACK_ASTEROIDS,
  apod: FALLBACK_APOD,
  epic: FALLBACK_EPIC,
  solar: FALLBACK_SOLAR,
  sources: { neows: "cache", apod: "cache", epic: "cache", donki: "cache" },
};

interface SessionRec {
  durationSec: number;
  endedAt: number;
}

interface MissionCtx {
  mode: MissionMode;
  setMode: (m: MissionMode) => void;
  zen: boolean;
  toggleZen: () => void;
  launched: boolean;
  launch: () => void;

  nasa: NasaBundle;
  loading: boolean;
  asteroidId: string;
  setAsteroidId: (id: string) => void;
  asteroid: Asteroid;
  apodIndex: number;
  nextApod: () => void;
  reportApodError: (url: string) => void;
  apodAllFaulted: boolean;

  durationSec: number;
  remainingSec: number;
  running: boolean;
  setPreset: (sec: number) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;

  tasks: Task[];
  addTask: (label: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;

  planOpen: boolean;
  setPlanOpen: (b: boolean) => void;
  mixerOpen: boolean;
  setMixerOpen: (b: boolean) => void;

  volumes: Record<AudioChannel, number>;
  setVolume: (c: AudioChannel, v: number) => void;
  muted: boolean;
  toggleMute: () => void;

  passOpen: boolean;
  openPass: () => void;
  closePass: () => void;
  lastSession: SessionRec | null;
  missionTitle: string;
  setMissionTitle: (s: string) => void;
}

const Ctx = createContext<MissionCtx | null>(null);
export const useMission = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMission outside provider");
  return ctx;
};

const load = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */

export function MissionProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<MissionMode>("asteroid");
  const [zen, setZen] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [nasa, setNasa] = useState<NasaBundle>(INITIAL_NASA);
  const [loading, setLoading] = useState(true);

  const [asteroidId, setAsteroidId] = useState(FALLBACK_ASTEROIDS[0].id);
  const [apodIndex, setApodIndex] = useState(0);
  const [apodFaults, setApodFaults] = useState<Set<string>>(new Set());

  const [durationSec, setDurationSec] = useState(25 * 60);
  const [remainingSec, setRemainingSec] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [lastSession, setLastSession] = useState<SessionRec | null>(null);

  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS);
  const [planOpen, setPlanOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);

  const [volumes, setVolumes] = useState(DEFAULT_VOLUMES);
  const [muted, setMuted] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [missionTitle, setMissionTitle] = useState("DEEP WORK RUN");

  const hydrated = useRef(false);
  const endsAt = useRef(0);
  const remainingRef = useRef(remainingSec);

  useEffect(() => {
    remainingRef.current = remainingSec;
  }, [remainingSec]);

  /* ------- hydrate persisted state (post-mount by design) ------- */
  useEffect(() => {
    const t = load<Task[]>("apsis.tasks");
    const v = load<Record<AudioChannel, number>>("apsis.volumes");
    const title = load<string>("apsis.title");
    queueMicrotask(() => {
      if (Array.isArray(t) && t.length) setTasks(t);
      if (v) setVolumes({ ...DEFAULT_VOLUMES, ...v });
      if (title) setMissionTitle(title);
      hydrated.current = true;
    });
  }, []);

  useEffect(() => {
    if (hydrated.current) localStorage.setItem("apsis.tasks", JSON.stringify(tasks));
  }, [tasks]);
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem("apsis.volumes", JSON.stringify(volumes));
  }, [volumes]);
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem("apsis.title", JSON.stringify(missionTitle));
  }, [missionTitle]);

  /* ------- NASA uplink ------- */
  useEffect(() => {
    let alive = true;
    Promise.all(
      ["neows", "apod", "epic", "donki"].map((ep) =>
        fetch(`/api/nasa/${ep}`)
          .then((r) => r.json())
          .catch(() => null),
      ),
    ).then(([neo, apod, epic, donki]) => {
      if (!alive) return;
      setNasa((prev) => ({
        asteroids: neo?.data?.length ? neo.data : prev.asteroids,
        apod: apod?.data?.length ? apod.data : prev.apod,
        epic: epic?.data?.length ? epic.data : prev.epic,
        solar: donki?.data ?? prev.solar,
        sources: {
          neows: neo?.source ?? prev.sources.neows,
          apod: apod?.source ?? prev.sources.apod,
          epic: epic?.source ?? prev.sources.epic,
          donki: donki?.source ?? prev.sources.donki,
        },
      }));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* ------- countdown engine (timestamp-accurate) ------- */
  const completeSession = useCallback(() => {
    setLastSession({ durationSec, endedAt: Date.now() });
    missionAudio.chime();
    setPassOpen(true);
  }, [durationSec]);

  useEffect(() => {
    if (!running) return;
    endsAt.current = Date.now() + remainingRef.current * 1000;
    const iv = setInterval(() => {
      const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        clearInterval(iv);
        setRunning(false);
        completeSession();
      }
    }, 250);
    return () => clearInterval(iv);
  }, [running, completeSession]);

  /* ------- keyboard ------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (e.key === "Escape") {
        setPassOpen(false);
        setMixerOpen(false);
        setPlanOpen(false);
        return;
      }
      if (typing) return;
      if (e.key === "h" || e.key === "H") {
        missionAudio.click();
        setZen((z) => !z);
        setPlanOpen(false);
      }
      if (e.key === " ") {
        e.preventDefault();
        if (!launched) return;
        missionAudio.click();
        if (remainingRef.current <= 0) setRemainingSec(durationSec);
        setRunning((r) => !r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [durationSec, launched]);

  /* ------- actions ------- */
  const click = useCallback(() => missionAudio.click(), []);

  const setMode = useCallback(
    (m: MissionMode) => {
      click();
      setModeState(m);
    },
    [click],
  );

  const toggleZen = useCallback(() => {
    click();
    setZen((z) => !z);
    setPlanOpen(false);
  }, [click]);

  const launch = useCallback(() => {
    missionAudio.init();
    missionAudio.resume();
    for (const c of Object.keys(volumes) as AudioChannel[])
      missionAudio.setVolume(c, volumes[c]);
    click();
    setLaunched(true);
    setRunning(true);
  }, [click, volumes]);

  const setPreset = useCallback((sec: number) => {
    missionAudio.click();
    setDurationSec(sec);
    setRemainingSec(sec);
    setRunning(false);
  }, []);

  const startTimer = useCallback(() => {
    click();
    if (remainingRef.current <= 0) setRemainingSec(durationSec);
    setRunning(true);
  }, [click, durationSec]);

  const pauseTimer = useCallback(() => {
    click();
    setRunning(false);
  }, [click]);

  const resetTimer = useCallback(() => {
    click();
    setRunning(false);
    setRemainingSec(durationSec);
  }, [click, durationSec]);

  const addTask = useCallback((label: string) => {
    const l = label.trim();
    if (!l) return;
    missionAudio.click();
    setTasks((t) => [
      ...t,
      { id: `wp-${Date.now().toString(36)}`, label: l, done: false },
    ]);
  }, []);

  const toggleTask = useCallback((id: string) => {
    missionAudio.click();
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  }, []);

  const removeTask = useCallback((id: string) => {
    missionAudio.click();
    setTasks((t) => t.filter((x) => x.id !== id));
  }, []);

  const setVolume = useCallback((c: AudioChannel, v: number) => {
    missionAudio.setVolume(c, v);
    setVolumes((prev) => ({ ...prev, [c]: v }));
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      missionAudio.setMuted(!m);
      return !m;
    });
    click();
  }, [click]);

  const nextApod = useCallback(() => {
    click();
    setApodIndex((i) => i + 1);
  }, [click]);

  const reportApodError = useCallback(
    (url: string) => {
      setApodFaults((f) => {
        if (f.has(url)) return f;
        const next = new Set(f);
        next.add(url);
        return next;
      });
      setApodIndex((i) => i + 1);
    },
    [],
  );

  const asteroid = useMemo(
    () =>
      nasa.asteroids.find((a) => a.id === asteroidId) ?? nasa.asteroids[0] ?? FALLBACK_ASTEROIDS[0],
    [nasa.asteroids, asteroidId],
  );

  const apodAllFaulted = nasa.apod.every((i) => apodFaults.has(i.url));

  const value: MissionCtx = {
    mode,
    setMode,
    zen,
    toggleZen,
    launched,
    launch,
    nasa,
    loading,
    asteroidId,
    setAsteroidId,
    asteroid,
    apodIndex,
    nextApod,
    reportApodError,
    apodAllFaulted,
    durationSec,
    remainingSec,
    running,
    setPreset,
    startTimer,
    pauseTimer,
    resetTimer,
    tasks,
    addTask,
    toggleTask,
    removeTask,
    planOpen,
    setPlanOpen,
    mixerOpen,
    setMixerOpen,
    volumes,
    setVolume,
    muted,
    toggleMute,
    passOpen,
    openPass: () => {
      click();
      setPassOpen(true);
    },
    closePass: () => setPassOpen(false),
    lastSession,
    missionTitle,
    setMissionTitle,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
