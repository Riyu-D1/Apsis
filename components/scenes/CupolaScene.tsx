"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMission } from "@/lib/store";
import { fmtInt } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Procedural fallbacks                                                 */
/* ------------------------------------------------------------------ */

/** Stylised planet that always renders under the EPIC feed. */
function ProceduralEarth() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(circle at 38% 32%, rgba(120,180,255,0.5), transparent 45%)," +
          "radial-gradient(circle at 62% 58%, rgba(30,90,160,0.85), transparent 70%)," +
          "radial-gradient(circle at 45% 70%, rgba(60,140,110,0.35), transparent 40%)," +
          "radial-gradient(circle at 70% 30%, rgba(90,150,200,0.4), transparent 45%)," +
          "radial-gradient(circle at 50% 50%, #0a1e3f 30%, #050d1f 75%)",
      }}
    />
  );
}

/** Starfield + nebula seen through the cupola's six side panes. */
function SideSpace() {
  return (
    <div className="absolute inset-0 bg-[#020204]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 45% 35% at 30% 20%, rgba(40,50,110,0.35), transparent 65%)," +
            "radial-gradient(ellipse 40% 30% at 75% 80%, rgba(20,60,80,0.3), transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 8% 14%, #dfe6ff 100%, transparent)," +
            "radial-gradient(1px 1px at 18% 62%, #fff 100%, transparent)," +
            "radial-gradient(1.4px 1.4px at 27% 38%, #fff 100%, transparent)," +
            "radial-gradient(1px 1px at 36% 82%, #cfd8ff 100%, transparent)," +
            "radial-gradient(1px 1px at 45% 8%, #fff 100%, transparent)," +
            "radial-gradient(1.3px 1.3px at 55% 55%, #fff 100%, transparent)," +
            "radial-gradient(1px 1px at 63% 28%, #dfe6ff 100%, transparent)," +
            "radial-gradient(1px 1px at 72% 71%, #fff 100%, transparent)," +
            "radial-gradient(1.4px 1.4px at 82% 44%, #fff 100%, transparent)," +
            "radial-gradient(1px 1px at 91% 12%, #cfd8ff 100%, transparent)," +
            "radial-gradient(1px 1px at 95% 66%, #fff 100%, transparent)," +
            "radial-gradient(1px 1px at 12% 88%, #fff 100%, transparent)," +
            "radial-gradient(1.2px 1.2px at 50% 92%, #dfe6ff 100%, transparent)," +
            "radial-gradient(1px 1px at 68% 90%, #fff 100%, transparent)",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cupola frame — SVG hull with center window + 6 trapezoid panes       */
/* ------------------------------------------------------------------ */

const C = 50; // viewBox 0 0 100 100, centered
const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (r: number, deg: number) => [
  C + r * Math.cos(rad(deg)),
  C + r * Math.sin(rad(deg)),
];

function useCupolaGeometry() {
  return useMemo(() => {
    const holes: string[] = [];
    // central circular window — polygonal hole approximated by 48-gon
    const circ = Array.from({ length: 48 }, (_, i) => pt(30.5, (i / 48) * 360));
    holes.push(
      `M ${circ.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L ")} Z`,
    );
    // 6 trapezoid panes between ribs at 0,60,...300
    const trapezoids: string[] = [];
    for (let k = 0; k < 6; k++) {
      const th = k * 60 + 30;
      const [a1, a2] = [10.5, 15.5];
      const p1 = pt(33.5, th - a1);
      const p2 = pt(33.5, th + a1);
      const p3 = pt(48.5, th + a2);
      const p4 = pt(48.5, th - a2);
      trapezoids.push(
        `M ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} L ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} L ${p3[0].toFixed(2)} ${p3[1].toFixed(2)} L ${p4[0].toFixed(2)} ${p4[1].toFixed(2)} Z`,
      );
    }
    // ribs along 0,60,...300 + rivet ring
    const ribs = Array.from({ length: 6 }, (_, k) => ({
      a: k * 60,
      in: pt(31.5, k * 60),
      out: pt(49, k * 60),
    }));
    const rivets: number[][] = [];
    for (let d = 0; d < 360; d += 15) {
      const nearPane = [30, 90, 150, 210, 270, 330].some(
        (th) => Math.min(Math.abs(d - th), 360 - Math.abs(d - th)) < 17,
      );
      if (!nearPane) rivets.push(pt(32.4, d));
    }
    return { holes, trapezoids, ribs, rivets };
  }, []);
}

function CupolaFrame() {
  const g = useCupolaGeometry();
  const hull = `M 0 0 L 100 0 L 100 100 L 0 100 Z ${g.holes.join(" ")} ${g.trapezoids.join(" ")}`;
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* hull plate with window apertures cut out */}
      <path d={hull} fill="#0b0b0f" fillRule="evenodd" />
      {/* gasket rings around the main window */}
      <circle cx={C} cy={C} r={30.5} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={0.35} />
      <circle cx={C} cy={C} r={32.4} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
      <circle cx={C} cy={C} r={33.5} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={0.2} />
      {/* pane outlines */}
      {g.trapezoids.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={0.28} />
      ))}
      {/* structural ribs */}
      {g.ribs.map((r, i) => (
        <line
          key={i}
          x1={r.in[0]}
          y1={r.in[1]}
          x2={r.out[0]}
          y2={r.out[1]}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={1.1}
        />
      ))}
      {/* rivets */}
      {g.rivets.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={0.32} fill="rgba(255,255,255,0.16)" />
      ))}
      {/* hinge markers on each rib */}
      {g.ribs.map((r, i) => {
        const mid = pt(40.5, r.a);
        return (
          <rect
            key={`h${i}`}
            x={mid[0] - 1.1}
            y={mid[1] - 0.5}
            width={2.2}
            height={1}
            rx={0.2}
            fill="rgba(255,255,255,0.10)"
            transform={`rotate(${r.a} ${mid[0]} ${mid[1]})`}
          />
        );
      })}
    </svg>
  );
}

/** Fine reticle over the main window. */
function Reticle() {
  const ticks = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const inner = i % 6 === 0 ? 26.6 : 28.4;
        return {
          x1: 50 + Math.cos(a) * inner,
          y1: 50 + Math.sin(a) * inner,
          x2: 50 + Math.cos(a) * 29.6,
          y2: 50 + Math.sin(a) * 29.6,
          major: i % 6 === 0,
        };
      }),
    [],
  );
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.major ? "rgba(245,165,36,0.55)" : "rgba(255,255,255,0.18)"}
          strokeWidth={t.major ? 0.35 : 0.18}
        />
      ))}
      <line x1={50} y1={47} x2={50} y2={53} stroke="rgba(255,255,255,0.3)" strokeWidth={0.22} />
      <line x1={47} y1={50} x2={53} y2={50} stroke="rgba(255,255,255,0.3)" strokeWidth={0.22} />
      <circle cx={50} cy={50} r={0.8} fill="rgba(245,165,36,0.7)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Ground track — equirectangular orbit trace + live ISS marker         */
/* ------------------------------------------------------------------ */

const INCLINATION = 51.64;

function GroundTrack() {
  const { nasa } = useMission();
  const { lat, lon } = nasa.iss;
  const W = 200;
  const H = 56;
  const toX = (lambda: number) => ((lambda + 180) / 360) * W;
  const toY = (phi: number) => (1 - (phi + 90) / 180) * H;

  const paths = useMemo(() => {
    const base = Math.asin(Math.max(-1, Math.min(1, lat / INCLINATION)));
    return [-22.5, 0, 22.5].map((shift, o) => {
      const pts: string[] = [];
      for (let lam = -180; lam <= 180; lam += 4) {
        const phi =
          INCLINATION * Math.sin(base + ((lam - lon + shift) * Math.PI) / 180);
        pts.push(
          `${lam === -180 ? "M" : "L"} ${toX(lam).toFixed(1)} ${toY(phi).toFixed(1)}`,
        );
      }
      return { d: pts.join(" "), opacity: o === 1 ? 0.55 : 0.18 };
    });
  }, [lat, lon]);

  const mx = toX(lon);
  const my = toY(lat);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      {/* graticule */}
      {[-120, -60, 0, 60, 120].map((l) => (
        <line key={l} x1={toX(l)} y1={0} x2={toX(l)} y2={H} stroke="rgba(255,255,255,0.06)" strokeWidth={0.3} />
      ))}
      {[-45, 0, 45].map((p) => (
        <line
          key={p}
          x1={0}
          y1={toY(p)}
          x2={W}
          y2={toY(p)}
          stroke={p === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)"}
          strokeWidth={0.3}
          strokeDasharray={p === 0 ? "none" : "2 2"}
        />
      ))}
      {/* inclination limit */}
      {[-INCLINATION, INCLINATION].map((p) => (
        <line key={p} x1={0} y1={toY(p)} x2={W} y2={toY(p)} stroke="rgba(103,232,249,0.12)" strokeWidth={0.3} strokeDasharray="3 3" />
      ))}
      {/* orbit traces */}
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill="none" stroke="#67e8f9" strokeOpacity={p.opacity} strokeWidth={0.6} />
      ))}
      {/* ISS marker */}
      <circle cx={mx} cy={my} r={3.4} fill="none" stroke="rgba(245,165,36,0.35)" strokeWidth={0.5}>
        <animate attributeName="r" values="2.4;4.2;2.4" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={mx} cy={my} r={1.4} fill="#f5a524" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Telemetry strip — live ISS numbers + frame timestamp                 */
/* ------------------------------------------------------------------ */

const fmtDeg = (v: number, pos: string, neg: string) =>
  `${v >= 0 ? pos : neg}${Math.abs(v).toFixed(2).padStart(5, "0")}°`;

function TelemetryStrip({ frameUtc }: { frameUtc: string }) {
  const { nasa } = useMission();
  const { iss } = nasa;
  const live = nasa.sources.iss === "live";
  const cells: [string, string][] = [
    ["LAT", fmtDeg(iss.lat, "+", "-")],
    ["LON", fmtDeg(iss.lon, "+", "-")],
    ["ALT", `${fmtInt(iss.altKm)} KM`],
    ["VEL", `${fmtInt(iss.velKmh)} KM/H`],
    ["EPIC", frameUtc],
  ];
  return (
    <div className="glass-soft mt-4 flex w-full items-stretch gap-0 overflow-hidden rounded-xl">
      <div className="flex items-center gap-1.5 border-r border-white/[0.07] px-3 py-2.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${live ? "bg-cyan" : "bg-amber"} animate-blink`}
        />
        <span className="font-mono text-[9px] tracking-[0.25em] text-faint">
          ISS
        </span>
      </div>
      {cells.map(([k, v]) => (
        <div
          key={k}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 border-r border-white/[0.05] px-2 py-2 last:border-r-0"
        >
          <span className="font-mono text-[8px] tracking-[0.3em] text-faint">
            {k}
          </span>
          <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-bone/90">
            {v}
          </span>
        </div>
      ))}
      <div className="hidden w-40 shrink-0 border-l border-white/[0.07] md:block">
        <GroundTrack />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                                */
/* ------------------------------------------------------------------ */

export default function CupolaScene() {
  const { nasa } = useMission();
  const frames = nasa.epic;
  const [idx, setIdx] = useState(0);
  const [faults, setFaults] = useState<Set<string>>(new Set());

  const ok = frames.filter((f) => !faults.has(f.url));
  const current = ok.length ? ok[idx % ok.length] : null;

  /* EPIC frames are ~1–2h apart — playing them back IS Earth rotating */
  useEffect(() => {
    const iv = setInterval(() => setIdx((i) => i + 1), 4200);
    return () => clearInterval(iv);
  }, []);

  const frameUtc = current?.date?.split(" ")[1]
    ? `${current.date.split(" ")[1]} UTC`
    : "—";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-void">
      <div className="relative w-[min(78vh,92vw)] max-w-[760px]">
        {/* cupola assembly */}
        <div className="relative aspect-square w-full">
          {/* space visible through the 6 side panes */}
          <div className="absolute inset-0 overflow-hidden rounded-[6%]">
            <SideSpace />
          </div>

          {/* main window — circular Earth view */}
          <div className="absolute left-1/2 top-1/2 aspect-square w-[61%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full shadow-[0_0_120px_rgba(60,110,255,0.10)_inset]">
            <ProceduralEarth />
            <AnimatePresence mode="sync">
              {current && (
                <motion.img
                  key={current.url}
                  src={current.url}
                  alt={current.caption}
                  onError={() =>
                    setFaults((f) => new Set(f).add(current.url))
                  }
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.8, ease: "easeInOut" }}
                  className="animate-drift absolute inset-0 h-full w-full object-cover"
                />
              )}
            </AnimatePresence>
            {/* glass inner shadow */}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_70px_rgba(0,0,0,0.7)]" />
            {/* faint diagonal glass reflection */}
            <div
              className="absolute inset-0 rounded-full opacity-[0.07]"
              style={{
                background:
                  "linear-gradient(135deg, transparent 42%, rgba(255,255,255,0.9) 50%, transparent 58%)",
              }}
            />
          </div>

          <CupolaFrame />
          <Reticle />

          {/* frame labels */}
          <div className="pointer-events-none absolute left-1/2 top-[1.5%] -translate-x-1/2 font-mono text-[8px] tracking-[0.45em] text-faint">
            CUPOLA // ISS NADIR
          </div>
          <div className="pointer-events-none absolute bottom-[1.5%] left-1/2 -translate-x-1/2 font-mono text-[8px] tracking-[0.45em] text-faint">
            W7 — 80CM PRIMARY
          </div>
        </div>

        {/* telemetry strip under the window */}
        <TelemetryStrip frameUtc={frameUtc} />
      </div>
      <div className="vignette pointer-events-none absolute inset-0" />
    </div>
  );
}
