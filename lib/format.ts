export const fmtInt = (n: number) =>
  new Intl.NumberFormat("en-US").format(Math.round(n));

export const fmtClock = (totalSec: number) => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const missionCode = (d = new Date()) =>
  `ORB-${d.getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`;

/** Deterministic PRNG for procedural geometry / barcodes. */
export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const seedFromString = (s: string) =>
  [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
