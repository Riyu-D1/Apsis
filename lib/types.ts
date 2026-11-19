export type MissionMode = "asteroid" | "apod" | "solar";

/** Timer engine phases — focus work vs. the two break kinds. */
export type TimerPhase = "focus" | "short" | "long";

/** One completed focus session, logged for history + streaks. */
export interface SessionLog {
  t: number; // epoch ms when the session ended
  dur: number; // seconds focused
  mode: MissionMode;
  label?: string;
}

export interface Asteroid {
  id: string;
  name: string;
  diameterM: number;
  velocityKmh: number;
  missDistanceKm: number;
  hazardous: boolean;
  approachUtc: string;
}

export interface ApodImage {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl: string;
  credit: string;
}

export interface SolarActivity {
  level: "CALM" | "MODERATE" | "STORM";
  intensity: number; // 0..1 — drives the shader palette
  kpIndex: number;
  flareClass: string;
  flareCount: number;
  stormCount: number;
  windSpeedKms: number; // fastest CME analysis speed, 0 = quiet flow
  cmeCount: number;
}

export interface IssPosition {
  lat: number;
  lon: number;
  altKm: number;
  velKmh: number;
  ts: number;
}

export interface Task {
  id: string;
  label: string;
  done: boolean;
}

export type FeedSource = "live" | "cache";

export interface NasaBundle {
  asteroids: Asteroid[];
  apod: ApodImage[];
  solar: SolarActivity;
  iss: IssPosition;
  sources: {
    neows: FeedSource;
    apod: FeedSource;
    donki: FeedSource;
    iss: FeedSource;
  };
}
