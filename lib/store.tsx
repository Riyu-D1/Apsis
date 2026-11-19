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
  crewAvailable,
  genCallsign,
  genClientId,
  genRoomCode,
  joinRoom,
  type RoomHandle,
} from "./crew";
import {
  FALLBACK_APOD,
  FALLBACK_ASTEROIDS,
  FALLBACK_ISS,
  FALLBACK_SOLAR,
} from "./fallback";
import { fmtClock } from "./format";
import type {
  Asteroid,
  ClockMsg,
  CrewEvent,
  CrewMember,
  CrewStatus,
  MissionMode,
  NasaBundle,
  PingKind,
  SessionLog,
  Task,
  TimerPhase,
} from "./types";

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
  solar: FALLBACK_SOLAR,
  iss: FALLBACK_ISS,
  sources: { neows: "cache", apod: "cache", donki: "cache", iss: "cache" },
};

/* Pomodoro cycle: focus -> short break, every 4th -> long break. */
export const BREAK_SHORT = 5 * 60;
export const BREAK_LONG = 15 * 60;
const SET_SIZE = 4;
const MODE_ORDER: MissionMode[] = ["asteroid", "apod", "solar"];
const APP_TITLE = "ORBITAL // FOCUS";

interface SessionRec {
  durationSec: number;
  endedAt: number;
}

interface PersistTimer {
  endsAt: number;
  running: boolean;
  remaining: number;
  phase: TimerPhase;
  cycle: number;
  durationSec: number;
}

/** Fast-ticking clock state — isolated so the 1Hz tick doesn't re-render scenes. */
interface ClockCtxT {
  remainingSec: number;
  running: boolean;
  phase: TimerPhase;
  cycle: number;
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
  goApod: (i: number) => void;
  reportApodError: (url: string) => void;
  apodAllFaulted: boolean;

  durationSec: number;
  autoBreaks: boolean;
  setAutoBreaks: (b: boolean) => void;
  setPreset: (sec: number) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  endBreak: () => void;

  sessions: SessionLog[];
  todaySec: number;
  weekMin: number[];
  streak: number;
  totalSec: number;

  tasks: Task[];
  addTask: (label: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;

  planOpen: boolean;
  setPlanOpen: (b: boolean) => void;
  mixerOpen: boolean;
  setMixerOpen: (b: boolean) => void;
  logOpen: boolean;
  setLogOpen: (b: boolean) => void;

  volumes: Record<AudioChannel, number>;
  setVolume: (c: AudioChannel, v: number) => void;
  masterVol: number;
  setMasterVol: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;

  passOpen: boolean;
  openPass: () => void;
  closePass: () => void;
  lastSession: SessionRec | null;
  missionTitle: string;
  setMissionTitle: (s: string) => void;

  hintSeen: boolean;
  dismissHint: () => void;

  /* ------- crew link ------- */
  crewAvailable: boolean;
  crewStatus: CrewStatus;
  crewCode: string | null;
  callsign: string;
  setCallsign: (s: string) => void;
  crew: Record<string, CrewMember>;
  selfId: string;
  crewCount: number;
  isCapcom: boolean;
  followClock: boolean;
  setFollowClock: (b: boolean) => void;
  crewOpen: boolean;
  setCrewOpen: (b: boolean) => void;
  crewFeed: CrewEvent[];
  joinCrew: (code?: string) => void;
  leaveCrew: () => void;
  sendPing: (kind: PingKind) => void;
}

const Ctx = createContext<MissionCtx | null>(null);
const ClockCtx = createContext<ClockCtxT | null>(null);

export const useMission = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMission outside provider");
  return ctx;
};
export const useClock = () => {
  const ctx = useContext(ClockCtx);
  if (!ctx) throw new Error("useClock outside provider");
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

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const notify = (title: string, body: string) => {
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      document.hidden
    ) {
      new Notification(title, { body });
    }
  } catch {
    /* notifications unavailable */
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
  const [phase, setPhase] = useState<TimerPhase>("focus");
  const [cycle, setCycle] = useState(0);
  const [autoBreaks, setAutoBreaksState] = useState(true);
  const [lastSession, setLastSession] = useState<SessionRec | null>(null);
  const [sessions, setSessions] = useState<SessionLog[]>([]);

  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS);
  const [planOpen, setPlanOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const [volumes, setVolumes] = useState(DEFAULT_VOLUMES);
  const [masterVol, setMasterVolState] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [missionTitle, setMissionTitle] = useState("DEEP WORK RUN");
  const [hintSeen, setHintSeen] = useState(true);

  /* ------- crew link ------- */
  const [callsign, setCallsignState] = useState("CREW-00");
  const [crewCode, setCrewCode] = useState<string | null>(null);
  const [crewStatus, setCrewStatus] = useState<CrewStatus>("offline");
  const [crew, setCrew] = useState<Record<string, CrewMember>>({});
  const [crewFeed, setCrewFeed] = useState<CrewEvent[]>([]);
  const [crewOpen, setCrewOpen] = useState(false);
  const [followClock, setFollowClockState] = useState(false);
  const [selfId, setSelfId] = useState("");

  const roomRef = useRef<RoomHandle | null>(null);
  const clientId = useRef("");
  const joinedAtRef = useRef(0);
  const followRef = useRef(false);
  const crewRef = useRef<Record<string, CrewMember>>({});
  const evtSeq = useRef(0);
  const joinCrewRef = useRef<((code?: string) => void) | null>(null);

  const hydrated = useRef(false);
  const endsAt = useRef(0);

  /* latest-values ref — lets stable callbacks read fresh state */
  const latest = useRef({
    remainingSec,
    running,
    phase,
    durationSec,
    cycle,
    autoBreaks,
    mode,
    missionTitle,
    zen,
    callsign,
    tasks,
  });
  useEffect(() => {
    latest.current = {
      remainingSec,
      running,
      phase,
      durationSec,
      cycle,
      autoBreaks,
      mode,
      missionTitle,
      zen,
      callsign,
      tasks,
    };
  });

  /* ------- hydrate persisted state (post-mount by design) ------- */
  useEffect(() => {
    const t = load<Task[]>("apsis.tasks");
    const v = load<Record<AudioChannel, number>>("apsis.volumes");
    const title = load<string>("apsis.title");
    const m = load<MissionMode>("apsis.mode");
    const aid = load<string>("apsis.asteroidId");
    const ai = load<number>("apsis.apodIndex");
    const mute = load<boolean>("apsis.muted");
    const ab = load<boolean>("apsis.autoBreaks");
    const mv = load<number>("apsis.masterVol");
    const s = load<SessionLog[]>("apsis.sessions");
    const pt = load<PersistTimer>("apsis.timer");
    const hint = load<boolean>("apsis.hintSeen");
    const cid = load<string>("apsis.clientId");
    const cs = load<string>("apsis.callsign");
    const cc = load<string>("apsis.crewCode");

    queueMicrotask(() => {
      if (Array.isArray(t) && t.length) setTasks(t);
      if (v) setVolumes({ ...DEFAULT_VOLUMES, ...v });
      if (title) setMissionTitle(title);
      if (m && MODE_ORDER.includes(m)) setModeState(m);
      if (aid) setAsteroidId(aid);
      if (typeof ai === "number") setApodIndex(ai);
      if (mute) {
        setMuted(true);
        missionAudio.setMuted(true);
      }
      if (typeof ab === "boolean") setAutoBreaksState(ab);
      if (typeof mv === "number") {
        setMasterVolState(mv);
        missionAudio.setMasterVolume(mv);
      }
      if (Array.isArray(s)) setSessions(s);
      if (hint) setHintSeen(true);
      /* stable identity — generated once, persisted forever */
      clientId.current = cid ?? genClientId();
      setSelfId(clientId.current);
      localStorage.setItem("apsis.clientId", JSON.stringify(clientId.current));
      setCallsignState(cs ?? genCallsign());
      /* re-establish the link if we were aboard when the tab closed */
      if (cc) joinCrewRef.current?.(cc);

      /* restore an in-flight session — the countdown survives refresh */
      if (pt) {
        setDurationSec(pt.durationSec);
        setCycle(pt.cycle);
        const left = Math.round((pt.endsAt - Date.now()) / 1000);
        if (pt.running && left > 0) {
          setPhase(pt.phase);
          setRemainingSec(left);
          setRunning(true);
        } else if (pt.running && pt.endsAt > 0) {
          // it expired while the tab was closed — log + advance the cycle
          if (pt.phase === "focus") {
            setSessions((cur) => [
              ...cur,
              { t: pt.endsAt, dur: pt.durationSec, mode: m ?? "asteroid", label: title ?? undefined },
            ]);
            setLastSession({ durationSec: pt.durationSec, endedAt: pt.endsAt });
            const nc = pt.cycle + 1;
            const long = nc % SET_SIZE === 0;
            setCycle(nc);
            setPhase(ab === false ? "focus" : long ? "long" : "short");
            setRemainingSec(
              ab === false ? pt.durationSec : long ? BREAK_LONG : BREAK_SHORT,
            );
          } else {
            setPhase("focus");
            setRemainingSec(pt.durationSec);
          }
        } else {
          setPhase(pt.phase);
          setRemainingSec(pt.remaining);
        }
      }
      hydrated.current = true;
    });
  }, []);

  /* ------- persistence ------- */
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem("apsis.tasks", JSON.stringify(tasks));
  }, [tasks]);
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem("apsis.volumes", JSON.stringify(volumes));
  }, [volumes]);
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem("apsis.title", JSON.stringify(missionTitle));
  }, [missionTitle]);
  useEffect(() => {
    if (hydrated.current) localStorage.setItem("apsis.mode", JSON.stringify(mode));
  }, [mode]);
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem("apsis.asteroidId", JSON.stringify(asteroidId));
  }, [asteroidId]);
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem("apsis.apodIndex", JSON.stringify(apodIndex));
  }, [apodIndex]);
  useEffect(() => {
    if (hydrated.current) localStorage.setItem("apsis.muted", JSON.stringify(muted));
  }, [muted]);
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem("apsis.autoBreaks", JSON.stringify(autoBreaks));
  }, [autoBreaks]);
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem("apsis.masterVol", JSON.stringify(masterVol));
  }, [masterVol]);
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem("apsis.sessions", JSON.stringify(sessions.slice(-500)));
  }, [sessions]);
  useEffect(() => {
    if (hydrated.current && callsign !== "CREW-00")
      localStorage.setItem("apsis.callsign", JSON.stringify(callsign));
  }, [callsign]);
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem(
        "apsis.timer",
        JSON.stringify({
          endsAt: running ? endsAt.current : 0,
          running,
          remaining: latest.current.remainingSec,
          phase,
          cycle,
          durationSec,
        } satisfies PersistTimer),
      );
  }, [running, phase, cycle, durationSec]);

  /* ------- NASA uplink ------- */
  useEffect(() => {
    let alive = true;
    Promise.all(
      ["neows", "apod", "donki"].map((ep) =>
        fetch(`/api/nasa/${ep}`)
          .then((r) => r.json())
          .catch(() => null),
      ),
    ).then(([neo, apod, donki]) => {
      if (!alive) return;
      setNasa((prev) => ({
        ...prev,
        asteroids: neo?.data?.length ? neo.data : prev.asteroids,
        apod: apod?.data?.length ? apod.data : prev.apod,
        solar: donki?.data ?? prev.solar,
        sources: {
          ...prev.sources,
          neows: neo?.source ?? prev.sources.neows,
          apod: apod?.source ?? prev.sources.apod,
          donki: donki?.source ?? prev.sources.donki,
        },
      }));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* ------- ISS live position (polls every 20s) ------- */
  useEffect(() => {
    let alive = true;
    const poll = () =>
      fetch("/api/iss")
        .then((r) => r.json())
        .then((res) => {
          if (!alive || !res?.data) return;
          setNasa((prev) => ({
            ...prev,
            iss: res.data,
            sources: { ...prev.sources, iss: res.source ?? prev.sources.iss },
          }));
        })
        .catch(() => null);
    poll();
    const iv = setInterval(poll, 20_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  /* ------- phase completion — the pomodoro engine ------- */
  const completePhase = useCallback(() => {
    missionAudio.chime();
    const l = latest.current;
    if (l.phase === "focus") {
      const rec: SessionLog = {
        t: Date.now(),
        dur: l.durationSec,
        mode: l.mode,
        label: l.missionTitle,
      };
      setSessions((s) => [...s, rec]);
      setLastSession({ durationSec: l.durationSec, endedAt: Date.now() });
      setPassOpen(true);
      notify("MISSION COMPLETE", `${l.missionTitle} — ${Math.round(l.durationSec / 60)} min logged.`);
      const nc = l.cycle + 1;
      setCycle(nc);
      if (l.autoBreaks) {
        const long = nc % SET_SIZE === 0;
        setPhase(long ? "long" : "short");
        setRemainingSec(long ? BREAK_LONG : BREAK_SHORT);
        setRunning(true);
        return;
      }
      setPhase("focus");
      setRemainingSec(l.durationSec);
      setRunning(false);
    } else {
      notify("REST COMPLETE", "Break over — ready for the next burn.");
      setPhase("focus");
      setRemainingSec(l.durationSec);
      setRunning(false);
    }
  }, []);

  /* ------- countdown engine (timestamp-accurate) ------- */
  useEffect(() => {
    if (!running) return;
    endsAt.current = Date.now() + latest.current.remainingSec * 1000;
    const iv = setInterval(() => {
      const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        clearInterval(iv);
        setRunning(false);
        completePhase();
      }
    }, 250);
    return () => clearInterval(iv);
  }, [running, phase, completePhase]);

  /* ------- countdown in the tab title ------- */
  useEffect(() => {
    if (running) {
      document.title = `${fmtClock(remainingSec)} ${
        phase === "focus" ? "FOCUS" : "REST"
      } — ORBITAL`;
    } else {
      document.title = APP_TITLE;
    }
    return () => {
      document.title = APP_TITLE;
    };
  }, [running, remainingSec, phase]);

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
        setLogOpen(false);
        setCrewOpen(false);
        return;
      }
      if (typing) return;
      if (e.key === "h" || e.key === "H") {
        missionAudio.click();
        setZen((z) => !z);
        setPlanOpen(false);
      }
      const digit = Number(e.key);
      if (digit >= 1 && digit <= MODE_ORDER.length && launched) {
        missionAudio.click();
        setModeState(MODE_ORDER[digit - 1]);
      }
      if (e.key === " ") {
        e.preventDefault();
        if (!launched) return;
        missionAudio.click();
        if (latest.current.remainingSec <= 0)
          setRemainingSec(latest.current.durationSec);
        setRunning((r) => !r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [launched]);

  /* ------- actions ------- */
  const click = useCallback(() => missionAudio.click(), []);

  /** crew event feed — declared early so task actions can push to it */
  const pushEvent = useCallback(
    (kind: CrewEvent["kind"], text: string, from?: string) => {
      setCrewFeed((f) => [
        ...f.slice(-39),
        { id: ++evtSeq.current, t: Date.now(), kind, from, text },
      ]);
    },
    [],
  );

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
    missionAudio.setMasterVolume(masterVol);
    click();
    setLaunched(true);
    setRunning(true);
    setPhase("focus");
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission();
      }
    } catch {
      /* notifications unavailable */
    }
  }, [click, volumes, masterVol]);

  const setPreset = useCallback((sec: number) => {
    missionAudio.click();
    setDurationSec(sec);
    setPhase("focus");
    setRemainingSec(sec);
    setRunning(false);
  }, []);

  const startTimer = useCallback(() => {
    click();
    if (latest.current.remainingSec <= 0)
      setRemainingSec(latest.current.durationSec);
    setRunning(true);
  }, [click]);

  const pauseTimer = useCallback(() => {
    click();
    setRunning(false);
  }, [click]);

  const resetTimer = useCallback(() => {
    click();
    setRunning(false);
    const l = latest.current;
    setRemainingSec(
      l.phase === "focus"
        ? l.durationSec
        : l.phase === "long"
          ? BREAK_LONG
          : BREAK_SHORT,
    );
  }, [click]);

  /** Skip the current break and return to focus standby. */
  const endBreak = useCallback(() => {
    click();
    setPhase("focus");
    setRemainingSec(latest.current.durationSec);
    setRunning(false);
  }, [click]);

  const setAutoBreaks = useCallback((b: boolean) => {
    missionAudio.click();
    setAutoBreaksState(b);
  }, []);

  const addTask = useCallback((label: string) => {
    const l = label.trim();
    if (!l) return;
    missionAudio.click();
    setTasks((t) => [
      ...t,
      { id: `wp-${Date.now().toString(36)}`, label: l, done: false },
    ]);
  }, []);

  const toggleTask = useCallback(
    (id: string) => {
      missionAudio.click();
      /* clearing a waypoint pings the crew channel */
      const task = tasks.find((x) => x.id === id);
      if (task && !task.done) {
        roomRef.current?.waypoint(task.label, latest.current.callsign);
        pushEvent("wp", `WP CLEARED — ${task.label}`, latest.current.callsign);
      }
      setTasks((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
    },
    [tasks, pushEvent],
  );

  const removeTask = useCallback((id: string) => {
    missionAudio.click();
    setTasks((t) => t.filter((x) => x.id !== id));
  }, []);

  const setVolume = useCallback((c: AudioChannel, v: number) => {
    missionAudio.setVolume(c, v);
    setVolumes((prev) => ({ ...prev, [c]: v }));
  }, []);

  const setMasterVol = useCallback((v: number) => {
    missionAudio.setMasterVolume(v);
    setMasterVolState(v);
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

  const goApod = useCallback((i: number) => {
    setApodIndex(i);
  }, []);

  const reportApodError = useCallback((url: string) => {
    setApodFaults((f) => {
      if (f.has(url)) return f;
      const next = new Set(f);
      next.add(url);
      return next;
    });
    setApodIndex((i) => i + 1);
  }, []);

  const dismissHint = useCallback(() => {
    setHintSeen(true);
    localStorage.setItem("apsis.hintSeen", "true");
  }, []);

  const openPass = useCallback(() => {
    click();
    setPassOpen(true);
  }, [click]);
  const closePass = useCallback(() => setPassOpen(false), []);

  /* =================== CREW LINK =================== */

  /** keep a render-free mirror of the roster for presence diffs */
  useEffect(() => {
    crewRef.current = crew;
  }, [crew]);

  /** what we broadcast about ourselves on every state change */
  const selfPresence = useCallback(() => {
    const l = latest.current;
    const phaseDur =
      l.phase === "focus"
        ? l.durationSec
        : l.phase === "long"
          ? BREAK_LONG
          : BREAK_SHORT;
    return {
      callsign: l.callsign,
      phase: l.phase,
      running: l.running,
      zen: l.zen,
      elapsedSec: Math.max(0, phaseDur - l.remainingSec),
      durationSec: l.durationSec,
      wp: l.tasks.filter((t) => t.done).length,
      joinedAt: joinedAtRef.current,
    };
  }, []);

  const joinCrew = useCallback(
    (code?: string) => {
      setCrewOpen(true);
      if (!crewAvailable) {
        pushEvent("info", "LINK OFFLINE — SUPABASE NOT CONFIGURED");
        return;
      }
      if (roomRef.current) return;
      const c = (code ?? genRoomCode()).toUpperCase().trim();
      setCrewStatus("connecting");
      setCrewCode(c);
      joinedAtRef.current = Date.now();
      missionAudio.click();
      void joinRoom(c, {
        clientId: clientId.current,
        onStatus: (s) => {
          setCrewStatus(s);
          if (s === "offline")
            pushEvent("info", "LINK FAILED — CHECK SUPABASE CONFIG");
        },
        onPresence: (members) => {
          const prev = crewRef.current;
          for (const k of Object.keys(members))
            if (!(k in prev) && k !== clientId.current)
              pushEvent("join", "ABOARD", members[k].callsign);
          for (const k of Object.keys(prev))
            if (!(k in members) && k !== clientId.current)
              pushEvent("leave", "DEPARTED", prev[k].callsign);
          setCrew(members);
        },
        onRadio: (from, kind) => {
          missionAudio.ping();
          pushEvent("ping", kind, from);
        },
        onWaypoint: (from, label) => {
          missionAudio.ping();
          pushEvent("wp", `WP CLEARED — ${label}`, from);
        },
        onClock: (m: ClockMsg) => {
          if (!followRef.current) return;
          /* apply the CAPCOM clock verbatim */
          setDurationSec(m.durationSec);
          setPhase(m.phase);
          setCycle(m.cycle);
          if (m.running) {
            setRemainingSec(
              Math.max(0, Math.round((m.endsAt - Date.now()) / 1000)),
            );
            setRunning(true);
          } else {
            setRemainingSec(m.remainingSec);
            setRunning(false);
          }
          pushEvent(
            "clock",
            `CLOCK SYNC — ${m.phase === "focus" ? "FOCUS" : "REST"} ${m.running ? "RUNNING" : "HELD"}`,
          );
        },
      }).then((room) => {
        if (!room) {
          setCrewCode(null);
          roomRef.current = null;
          return;
        }
        roomRef.current = room;
        localStorage.setItem("apsis.crewCode", JSON.stringify(c));
        pushEvent("info", `LINK ESTABLISHED — ORB ${c}`);
        room.track(selfPresence());
      });
    },
    [pushEvent, selfPresence],
  );
  useEffect(() => {
    joinCrewRef.current = joinCrew;
  }, [joinCrew]);

  const leaveCrew = useCallback(() => {
    missionAudio.click();
    const room = roomRef.current;
    roomRef.current = null;
    void room?.leave();
    setCrew({});
    setCrewCode(null);
    setCrewStatus("offline");
    setFollowClockState(false);
    followRef.current = false;
    localStorage.removeItem("apsis.crewCode");
    pushEvent("info", "LINK CLOSED");
  }, [pushEvent]);

  const setCallsign = useCallback(
    (s: string) => {
      const v = s.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
      setCallsignState(v);
      latest.current.callsign = v;
      if (hydrated.current)
        localStorage.setItem("apsis.callsign", JSON.stringify(v));
    },
    [],
  );

  const setFollowClock = useCallback((b: boolean) => {
    missionAudio.click();
    setFollowClockState(b);
    followRef.current = b;
  }, []);

  const sendPing = useCallback(
    (kind: PingKind) => {
      missionAudio.ping();
      roomRef.current?.ping(kind, latest.current.callsign);
      pushEvent("ping", kind, latest.current.callsign);
    },
    [pushEvent],
  );

  /** broadcast our presence whenever mission state changes */
  const wpDone = tasks.filter((t) => t.done).length;
  useEffect(() => {
    roomRef.current?.track(selfPresence());
  }, [selfPresence, phase, running, zen, durationSec, wpDone, callsign]);

  /** CAPCOM = earliest boarder — they broadcast clock state on changes */
  const isCapcom = useMemo(() => {
    const me = crew[selfId];
    if (!me || crewStatus !== "online") return false;
    return Object.values(crew).every((m) => me.joinedAt <= m.joinedAt);
  }, [crew, selfId, crewStatus]);

  useEffect(() => {
    if (!isCapcom) return;
    roomRef.current?.clock({
      cmd: "state",
      phase,
      running,
      durationSec,
      remainingSec: latest.current.remainingSec,
      endsAt: endsAt.current,
      cycle,
    });
  }, [isCapcom, phase, running, durationSec, cycle]);

  /* note: a CAPCOM never receives its own broadcasts (self:false), so a
     stale followClock preference while capcom is harmless — the toggle is
     hidden and the preference resumes if capcom status is later lost */
  const crewCount = Object.keys(crew).length;

  const asteroid = useMemo(
    () =>
      nasa.asteroids.find((a) => a.id === asteroidId) ??
      nasa.asteroids[0] ??
      FALLBACK_ASTEROIDS[0],
    [nasa.asteroids, asteroidId],
  );

  const apodAllFaulted = nasa.apod.every((i) => apodFaults.has(i.url));

  /* ------- session stats (log -> streaks + flight hours) ------- */
  const { todaySec, weekMin, streak, totalSec } = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const s of sessions)
      byDay.set(dayKey(s.t), (byDay.get(dayKey(s.t)) ?? 0) + s.dur);

    const dayOf = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return dayKey(d.getTime());
    };

    const todaySec = byDay.get(dayOf(0)) ?? 0;
    const weekMin = Array.from(
      { length: 7 },
      (_, i) => Math.round((byDay.get(dayOf(6 - i)) ?? 0) / 60),
    );

    // streak: consecutive logged days; an empty today doesn't break it
    let streak = 0;
    const d = byDay.has(dayOf(0)) ? 0 : 1;
    while (byDay.has(dayOf(d + streak))) streak++;

    const totalSec = sessions.reduce((a, s) => a + s.dur, 0);
    return { todaySec, weekMin, streak, totalSec };
  }, [sessions]);

  const clockValue: ClockCtxT = useMemo(
    () => ({ remainingSec, running, phase, cycle }),
    [remainingSec, running, phase, cycle],
  );

  const value: MissionCtx = useMemo(
    () => ({
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
      goApod,
      reportApodError,
      apodAllFaulted,
      durationSec,
      autoBreaks,
      setAutoBreaks,
      setPreset,
      startTimer,
      pauseTimer,
      resetTimer,
      endBreak,
      sessions,
      todaySec,
      weekMin,
      streak,
      totalSec,
      tasks,
      addTask,
      toggleTask,
      removeTask,
      planOpen,
      setPlanOpen,
      mixerOpen,
      setMixerOpen,
      logOpen,
      setLogOpen,
      volumes,
      setVolume,
      masterVol,
      setMasterVol,
      muted,
      toggleMute,
      passOpen,
      openPass,
      closePass,
      lastSession,
      missionTitle,
      setMissionTitle,
      hintSeen,
      dismissHint,
      crewAvailable,
      crewStatus,
      crewCode,
      callsign,
      setCallsign,
      crew,
      selfId,
      crewCount,
      isCapcom,
      followClock,
      setFollowClock,
      crewOpen,
      setCrewOpen,
      crewFeed,
      joinCrew,
      leaveCrew,
      sendPing,
    }),
    [
      mode, setMode, zen, toggleZen, launched, launch, nasa, loading,
      asteroidId, asteroid, apodIndex, nextApod, goApod, reportApodError,
      apodAllFaulted, durationSec, autoBreaks, setAutoBreaks, setPreset,
      startTimer, pauseTimer, resetTimer, endBreak, sessions, todaySec,
      weekMin, streak, totalSec, tasks, addTask, toggleTask, removeTask,
      planOpen, mixerOpen, logOpen, volumes, setVolume, masterVol,
      setMasterVol, muted, toggleMute, passOpen, openPass, closePass,
      lastSession, missionTitle, hintSeen, dismissHint,
      crewStatus, crewCode, callsign, setCallsign, crew, selfId, crewCount,
      isCapcom, followClock, setFollowClock, crewOpen, crewFeed,
      joinCrew, leaveCrew, sendPing,
    ],
  );

  return (
    <ClockCtx.Provider value={clockValue}>
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
    </ClockCtx.Provider>
  );
}
