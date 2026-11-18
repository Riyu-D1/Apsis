import {
  FALLBACK_APOD,
  FALLBACK_ASTEROIDS,
  FALLBACK_EPIC,
  FALLBACK_SOLAR,
} from "./fallback";
import type {
  ApodImage,
  Asteroid,
  EpicImage,
  FeedSource,
  SolarActivity,
} from "./types";

const KEY = process.env.NASA_API_KEY || "DEMO_KEY";
const API = "https://api.nasa.gov";
const DAY_MS = 86_400_000;
const REVALIDATE = 3600;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

interface Result<T> {
  data: T;
  source: FeedSource;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`NASA responded ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/* NeoWs — today's near-earth objects                                   */
/* ------------------------------------------------------------------ */

interface NeoEntry {
  id: string;
  name: string;
  is_potentially_hazardous_asteroid: boolean;
  estimated_diameter: {
    meters: { estimated_diameter_min: number; estimated_diameter_max: number };
  };
  close_approach_data: {
    relative_velocity: { kilometers_per_hour: string };
    miss_distance: { kilometers: string };
  }[];
}

export async function getAsteroids(): Promise<Result<Asteroid[]>> {
  try {
    const today = isoDay(new Date());
    const json = (await fetchJson(
      `${API}/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${KEY}`,
    )) as { near_earth_objects?: Record<string, NeoEntry[]> };

    const list = Object.values(json.near_earth_objects ?? {}).flat();
    if (!list.length) throw new Error("empty feed");

    const data: Asteroid[] = list
      .filter((n) => n.close_approach_data?.length)
      .map((n) => ({
        id: n.id,
        name: n.name.replace(/[()]/g, "").trim(),
        diameterM: Math.round(
          (n.estimated_diameter.meters.estimated_diameter_min +
            n.estimated_diameter.meters.estimated_diameter_max) / 2,
        ),
        velocityKmh: Math.round(
          parseFloat(n.close_approach_data[0].relative_velocity.kilometers_per_hour),
        ),
        missDistanceKm: Math.round(
          parseFloat(n.close_approach_data[0].miss_distance.kilometers),
        ),
        hazardous: !!n.is_potentially_hazardous_asteroid,
      }))
      .sort((a, b) => a.missDistanceKm - b.missDistanceKm)
      .slice(0, 14);

    return { data, source: "live" };
  } catch {
    return { data: FALLBACK_ASTEROIDS, source: "cache" };
  }
}

/* ------------------------------------------------------------------ */
/* APOD — last 7 days of imagery                                        */
/* ------------------------------------------------------------------ */

interface ApodEntry {
  date: string;
  title: string;
  explanation?: string;
  media_type: string;
  url?: string;
  hdurl?: string;
  copyright?: string;
}

export async function getApod(): Promise<Result<ApodImage[]>> {
  try {
    const end = new Date();
    const start = new Date(Date.now() - 6 * DAY_MS);
    const json = await fetchJson(
      `${API}/planetary/apod?api_key=${KEY}&start_date=${isoDay(start)}&end_date=${isoDay(end)}`,
    );
    const arr = Array.isArray(json) ? (json as ApodEntry[]) : [json as ApodEntry];

    const data: ApodImage[] = arr
      .filter((a) => a?.media_type === "image" && a.url)
      .map((a) => ({
        date: a.date,
        title: a.title,
        explanation: a.explanation ?? "",
        url: a.hdurl ?? a.url!,
        hdurl: a.hdurl ?? a.url!,
        credit: a.copyright ? a.copyright.replace(/\n/g, " ").trim() : "NASA / APOD",
      }))
      .reverse();

    if (!data.length) throw new Error("no images in range");
    return { data, source: "live" };
  } catch {
    return { data: FALLBACK_APOD, source: "cache" };
  }
}

/* ------------------------------------------------------------------ */
/* EPIC — full-disc Earth imagery                                       */
/* ------------------------------------------------------------------ */

const EPIC_API = "https://epic.gsfc.nasa.gov";

interface EpicEntry {
  identifier: string;
  caption: string;
  image: string;
  date: string;
}

export async function getEpic(): Promise<Result<EpicImage[]>> {
  try {
    const json = await fetchJson(`${EPIC_API}/api/natural`);
    if (!Array.isArray(json) || !json.length) throw new Error("empty feed");

    const data: EpicImage[] = (json as EpicEntry[]).slice(0, 14).map((e) => {
      const [day] = e.date.split(" ");
      const [y, m, d] = day.split("-");
      return {
        id: e.identifier,
        caption: e.caption ?? "Full sunlit disc — DSCOVR EPIC",
        date: e.date,
        url: `${EPIC_API}/archive/natural/${y}/${m}/${d}/png/${e.image}.png`,
      };
    });

    return { data, source: "live" };
  } catch {
    return { data: FALLBACK_EPIC, source: "cache" };
  }
}

/* ------------------------------------------------------------------ */
/* DONKI — solar flares + geomagnetic storms                            */
/* ------------------------------------------------------------------ */

interface FlrEntry {
  flrID: string;
  classType?: string;
}

interface GstEntry {
  gstID: string;
  allKpIndex?: { kpIndex: number }[];
}

const flareWeight = (cls?: string) =>
  cls?.startsWith("X") ? 1 : cls?.startsWith("M") ? 0.6 : cls?.startsWith("C") ? 0.25 : 0.08;

export async function getSolar(): Promise<Result<SolarActivity>> {
  try {
    const start = isoDay(new Date(Date.now() - 7 * DAY_MS));
    const [flrRaw, gstRaw] = await Promise.all([
      fetchJson(`${API}/DONKI/FLR?startDate=${start}&api_key=${KEY}`).catch(() => []),
      fetchJson(`${API}/DONKI/GST?startDate=${start}&api_key=${KEY}`).catch(() => []),
    ]);

    const flares = Array.isArray(flrRaw) ? (flrRaw as FlrEntry[]) : [];
    const storms = Array.isArray(gstRaw) ? (gstRaw as GstEntry[]) : [];

    const kp = Math.max(
      0,
      ...storms.flatMap((s) => (s.allKpIndex ?? []).map((k) => Number(k.kpIndex) || 0)),
    );

    const topFlare = flares.reduce<FlrEntry | null>(
      (best, f) => (flareWeight(f.classType) > flareWeight(best?.classType) ? f : best),
      null,
    );

    const intensity = Math.min(
      1,
      0.15 + (kp / 9) * 0.5 + flareWeight(topFlare?.classType) * 0.45,
    );

    const data: SolarActivity = {
      level: intensity < 0.4 ? "CALM" : intensity < 0.7 ? "MODERATE" : "STORM",
      intensity: +intensity.toFixed(2),
      kpIndex: +kp.toFixed(1),
      flareClass: topFlare?.classType ?? "—",
      flareCount: flares.length,
      stormCount: storms.length,
    };

    return { data, source: "live" };
  } catch {
    return { data: FALLBACK_SOLAR, source: "cache" };
  }
}
