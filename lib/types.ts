export type MissionMode = "asteroid" | "apod" | "cupola" | "solar";

export interface Asteroid {
  id: string;
  name: string;
  diameterM: number;
  velocityKmh: number;
  missDistanceKm: number;
  hazardous: boolean;
}

export interface ApodImage {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl: string;
  credit: string;
}

export interface EpicImage {
  id: string;
  caption: string;
  date: string;
  url: string;
}

export interface SolarActivity {
  level: "CALM" | "MODERATE" | "STORM";
  intensity: number; // 0..1 — drives the shader palette
  kpIndex: number;
  flareClass: string;
  flareCount: number;
  stormCount: number;
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
  epic: EpicImage[];
  solar: SolarActivity;
  sources: {
    neows: FeedSource;
    apod: FeedSource;
    epic: FeedSource;
    donki: FeedSource;
  };
}
