import {
  FALLBACK_APOD,
  FALLBACK_ASTEROIDS,
  FALLBACK_ISS,
  FALLBACK_SOLAR,
} from "./fallback";
import type {
  ApodImage,
  Asteroid,
  FeedSource,
  IssPosition,
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

async function fetchJson(
  url: string,
  revalidate: number = REVALIDATE,
): Promise<unknown> {
  const res = await fetch(url, { next: { revalidate } });
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
    close_approach_date_full?: string;
  }[];
}

/** "2026-Feb-20 19:42" -> "19:42 UTC" */
function parseApproach(full?: string): string {
  const time = full?.split(" ").pop();
  return time ? `${time} UTC` : "— UTC";
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
        approachUtc: parseApproach(
          n.close_approach_data[0].close_approach_date_full,
        ),
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
  thumbnail_url?: string;
  copyright?: string;
}

/** NASA serves placeholder/logo URLs for degraded entries — reject them. */
const isRealImage = (url?: string) =>
  !!url &&
  /\.(jpe?g|png|gif|webp|tif?f)$/i.test(url.split("?")[0]) &&
  !/nasa-logo|placeholder|nasa\.png/i.test(url);

export async function getApod(): Promise<Result<ApodImage[]>> {
  try {
    const end = new Date();
    const start = new Date(Date.now() - 6 * DAY_MS);
    const json = await fetchJson(
      `${API}/planetary/apod?api_key=${KEY}&start_date=${isoDay(start)}&end_date=${isoDay(end)}&thumbs=true`,
    );
    const arr = Array.isArray(json) ? (json as ApodEntry[]) : [json as ApodEntry];

    const data: ApodImage[] = [];
    const seen = new Set<string>();
    for (const a of arr) {
      const isVideo = a.media_type === "video";
      const img = isVideo ? a.thumbnail_url : (a.hdurl ?? a.url);
      const thumb = isVideo ? a.thumbnail_url : a.url;
      if (!img || !isRealImage(img) || !a.title) continue;
      if (seen.has(img)) continue;
      seen.add(img);
      data.push({
        date: a.date,
        title: a.title === "NASA Science" ? `APOD ${a.date}` : a.title,
        explanation: a.explanation ?? "",
        url: isRealImage(thumb) ? thumb! : img!,
        hdurl: img!,
        credit: a.copyright
          ? a.copyright.replace(/\n/g, " ").trim()
          : isVideo
            ? "NASA / APOD (video still)"
            : "NASA / APOD",
      });
    }
    data.reverse();

    // all-placeholder feeds (CMS outages) fall back to the curated archive
    if (data.length < 3) throw new Error("no real images in range");
    return { data, source: "live" };
  } catch {
    return { data: FALLBACK_APOD, source: "cache" };
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

interface CmeEntry {
  cmeAnalyses?: { speed?: number | string }[];
}

const flareWeight = (cls?: string) =>
  cls?.startsWith("X") ? 1 : cls?.startsWith("M") ? 0.6 : cls?.startsWith("C") ? 0.25 : 0.08;

export async function getSolar(): Promise<Result<SolarActivity>> {
  try {
    const start = isoDay(new Date(Date.now() - 7 * DAY_MS));
    const [flrRaw, gstRaw, cmeRaw] = await Promise.all([
      fetchJson(`${API}/DONKI/FLR?startDate=${start}&api_key=${KEY}`).catch(() => []),
      fetchJson(`${API}/DONKI/GST?startDate=${start}&api_key=${KEY}`).catch(() => []),
      fetchJson(`${API}/DONKI/CME?startDate=${start}&api_key=${KEY}`).catch(() => []),
    ]);

    const flares = Array.isArray(flrRaw) ? (flrRaw as FlrEntry[]) : [];
    const storms = Array.isArray(gstRaw) ? (gstRaw as GstEntry[]) : [];
    const cmes = Array.isArray(cmeRaw) ? (cmeRaw as CmeEntry[]) : [];

    const wind = Math.max(
      0,
      ...cmes.flatMap((c) =>
        (c.cmeAnalyses ?? []).map((a) => Number(a.speed) || 0),
      ),
    );

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
      windSpeedKms: Math.round(wind),
      cmeCount: cmes.length,
    };

    return { data, source: "live" };
  } catch {
    return { data: FALLBACK_SOLAR, source: "cache" };
  }
}

/* ------------------------------------------------------------------ */
/* ISS — live position (wheretheiss.at, free + no key)                  */
/* ------------------------------------------------------------------ */

interface IssEntry {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  timestamp: number;
}

export async function getIss(): Promise<Result<IssPosition>> {
  try {
    const j = (await fetchJson(
      "https://api.wheretheiss.at/v1/satellites/25544",
      20,
    )) as IssEntry;
    return {
      data: {
        lat: +j.latitude.toFixed(3),
        lon: +j.longitude.toFixed(3),
        altKm: Math.round(j.altitude),
        velKmh: Math.round(j.velocity),
        ts: j.timestamp,
      },
      source: "live",
    };
  } catch {
    return { data: FALLBACK_ISS, source: "cache" };
  }
}
