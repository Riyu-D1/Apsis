import type {
  ApodImage,
  Asteroid,
  EpicImage,
  IssPosition,
  SolarActivity,
} from "./types";

/**
 * Realistic offline / rate-limit-proof data. The app renders instantly and
 * swaps to live data when the NASA uplink answers.
 */

export const FALLBACK_ASTEROIDS: Asteroid[] = [
  { id: "neo-2026xr4", name: "2026 XR4", diameterM: 140, velocityKmh: 48210, missDistanceKm: 1420900, hazardous: false, approachUtc: "13:42 UTC" },
  { id: "neo-2026kd", name: "2026 KD", diameterM: 212, velocityKmh: 52330, missDistanceKm: 1947300, hazardous: false, approachUtc: "18:07 UTC" },
  { id: "neo-2025qt9", name: "2025 QT9", diameterM: 78, velocityKmh: 39450, missDistanceKm: 742300, hazardous: false, approachUtc: "09:15 UTC" },
  { id: "neo-2023dw", name: "2023 DW", diameterM: 49, velocityKmh: 88470, missDistanceKm: 2074300, hazardous: false, approachUtc: "21:33 UTC" },
  { id: "neo-2026vh2", name: "2026 VH2", diameterM: 310, velocityKmh: 61780, missDistanceKm: 3860400, hazardous: false, approachUtc: "16:48 UTC" },
  { id: "neo-2024bx11", name: "2024 BX11", diameterM: 540, velocityKmh: 71260, missDistanceKm: 6115800, hazardous: true, approachUtc: "05:21 UTC" },
  { id: "neo-2025jv1", name: "2025 JV1", diameterM: 36, velocityKmh: 28940, missDistanceKm: 415800, hazardous: false, approachUtc: "11:58 UTC" },
  { id: "neo-2026aa3", name: "2026 AA3", diameterM: 890, velocityKmh: 44120, missDistanceKm: 7289600, hazardous: true, approachUtc: "23:04 UTC" },
];

const NASA_IMG = (id: string) =>
  `https://images-assets.nasa.gov/image/${id}/${id}~orig.jpg`;

export const FALLBACK_APOD: ApodImage[] = [
  {
    date: "2026-11-16",
    title: "The Blue Marble — Western Hemisphere",
    explanation:
      "Composite view of Earth assembled from Suomi NPP VIIRS passes — the most requested planetary portrait in the archive.",
    url: NASA_IMG("GSFC_20171208_Archive_e000211"),
    hdurl: NASA_IMG("GSFC_20171208_Archive_e000211"),
    credit: "NASA / NOAA / GSFC / Suomi NPP / VIIRS",
  },
  {
    date: "2026-11-15",
    title: "Saturn in Natural Color",
    explanation:
      "Cassini mosaic of the ringed giant — sunlight scattered through the rings backlights the night side.",
    url: NASA_IMG("PIA04921"),
    hdurl: NASA_IMG("PIA04921"),
    credit: "NASA / JPL-Caltech / Space Science Institute",
  },
  {
    date: "2026-11-14",
    title: "Moon Crossing the Face of Earth",
    explanation:
      "DSCOVR's EPIC camera catches the far side of the Moon drifting across a fully sunlit Pacific disc.",
    url: NASA_IMG("GSFC_20171208_Archive_e002131"),
    hdurl: NASA_IMG("GSFC_20171208_Archive_e002131"),
    credit: "NASA / NOAA / DSCOVR EPIC",
  },
  {
    date: "2026-11-13",
    title: "Jupiter's Southern Circulation",
    explanation:
      "Juno close pass over the gas giant's south polar cyclones — fluid dynamics on a planetary scale.",
    url: NASA_IMG("PIA22946"),
    hdurl: NASA_IMG("PIA22946"),
    credit: "NASA / JPL-Caltech / SwRI / MSSS",
  },
  {
    date: "2026-11-12",
    title: "The Blue Marble — Eastern Hemisphere",
    explanation:
      "Companion composite to the western view — Africa, the Indian Ocean, and the Arabian peninsula at local noon.",
    url: NASA_IMG("GSFC_20171208_Archive_e000212"),
    hdurl: NASA_IMG("GSFC_20171208_Archive_e000212"),
    credit: "NASA / NOAA / GSFC / Suomi NPP / VIIRS",
  },
  {
    date: "2026-11-11",
    title: "Pluto's Heart at First Light",
    explanation:
      "New Horizons farewell portrait — Sputnik Planitia's nitrogen glaciers filling the left ventricle of Tombaugh Regio.",
    url: NASA_IMG("PIA19852"),
    hdurl: NASA_IMG("PIA19852"),
    credit: "NASA / Johns Hopkins APL / SwRI",
  },
  {
    date: "2026-11-10",
    title: "Orion Nebula Mosaic",
    explanation:
      "Hubble's sharpest view of the nearest massive stellar nursery — over three thousand stars in a single frame.",
    url: NASA_IMG("PIA01322"),
    hdurl: NASA_IMG("PIA01322"),
    credit: "NASA / ESA / STScI",
  },
];

export const FALLBACK_EPIC: EpicImage[] = [
  {
    id: "epic-1",
    caption: "Full sunlit disc — DSCOVR EPIC, L1 halo orbit",
    date: "2015-10-31 07:48:44",
    url: "https://epic.gsfc.nasa.gov/archive/natural/2015/10/31/png/epic_1b_20151031074844.png",
  },
  {
    id: "epic-2",
    caption: "Full sunlit disc — DSCOVR EPIC, L1 halo orbit",
    date: "2015-12-25 17:05:59",
    url: "https://epic.gsfc.nasa.gov/archive/natural/2015/12/25/png/epic_1b_20151225170559.png",
  },
  {
    id: "epic-3",
    caption: "Full sunlit disc — DSCOVR EPIC, L1 halo orbit",
    date: "2016-07-05 23:07:30",
    url: "https://epic.gsfc.nasa.gov/archive/natural/2016/07/05/png/epic_1b_20160705230730.png",
  },
  {
    id: "epic-4",
    caption: "Full sunlit disc — DSCOVR EPIC, L1 halo orbit",
    date: "2024-04-08 18:33:41",
    url: "https://epic.gsfc.nasa.gov/archive/natural/2024/04/08/png/epic_1b_20240408183341.png",
  },
  {
    id: "epic-5",
    caption: "Full sunlit disc — DSCOVR EPIC, L1 halo orbit",
    date: "2024-09-22 12:11:12",
    url: "https://epic.gsfc.nasa.gov/archive/natural/2024/09/22/png/epic_1b_20240922121112.png",
  },
  {
    id: "epic-6",
    caption: "Full sunlit disc — DSCOVR EPIC, L1 halo orbit",
    date: "2025-03-14 09:42:55",
    url: "https://epic.gsfc.nasa.gov/archive/natural/2025/03/14/png/epic_1b_20250314094255.png",
  },
];

export const FALLBACK_SOLAR: SolarActivity = {
  level: "MODERATE",
  intensity: 0.45,
  kpIndex: 3.7,
  flareClass: "M1.2",
  flareCount: 3,
  stormCount: 1,
  windSpeedKms: 486,
  cmeCount: 2,
};

export const FALLBACK_ISS: IssPosition = {
  lat: 12.4,
  lon: -38.6,
  altKm: 421,
  velKmh: 27580,
  ts: 0,
};
