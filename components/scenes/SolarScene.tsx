"use client";

import { useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useMission } from "@/lib/store";
import { fmtInt } from "@/lib/format";
import ScrambleText from "@/components/ui/ScrambleText";

/* ------------------------------------------------------------------ */
/* The Sun — photosphere + chromosphere + corona + flares + solar wind  */
/* ------------------------------------------------------------------ */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uStorm;
uniform vec2 uRes;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, -1.3);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec2 uv = p - vec2(-0.28, 0.02); // sun sits left-of-center
  float r = length(uv);
  float ang = atan(uv.y, uv.x);
  float t = uTime;
  float R = 0.40;

  /* --- deep space background: faint stars + warm dust --- */
  vec3 col = vec3(0.010, 0.009, 0.014);
  float st = hash(floor(p * 380.0));
  col += vec3(0.85) * step(0.998, st) * (0.2 + 0.3 * hash(floor(p * 380.0) + 3.0));
  col += vec3(0.06, 0.035, 0.018) * fbm(p * 2.6 + 7.0) * 0.35;

  /* --- photosphere: limb-darkened disc, high-contrast granulation --- */
  float mu = clamp(1.0 - (r / R) * (r / R), 0.0, 1.0);
  float limb = pow(sqrt(mu), 0.8);
  float g1 = fbm(uv * 15.0 + vec2(t * 0.035, -t * 0.02));
  float g2 = fbm(uv * 34.0 - vec2(t * 0.028, t * 0.015));
  float gran = g1 * 0.65 + g2 * 0.35;
  // dark inter-granular lanes -> reads as plasma cells, not blur
  float cells = smoothstep(0.30, 0.75, gran);
  float surface = limb * (0.30 + 0.95 * cells) + limb * 0.25;

  vec3 cLimb = vec3(0.72, 0.16, 0.02);
  vec3 cMid = vec3(1.00, 0.47, 0.06);
  vec3 cCore = vec3(1.00, 0.84, 0.50);
  vec3 sun = mix(cLimb, cMid, smoothstep(0.15, 0.62, surface));
  sun = mix(sun, cCore, smoothstep(0.60, 1.15, surface));
  sun = mix(sun, vec3(1.0, 0.96, 0.88), uStorm * 0.3 * smoothstep(0.3, 1.0, surface));
  float disc = smoothstep(R, R - 0.008, r);
  col += sun * disc * 1.6;

  /* --- chromosphere: thin spiculed rim --- */
  float rim = smoothstep(R - 0.012, R + 0.002, r) * smoothstep(R + 0.03, R, r);
  rim *= 0.6 + 0.6 * fbm(vec2(ang * 14.0, t * 0.4));
  col += vec3(1.0, 0.38, 0.08) * rim * 1.2;

  /* --- prominences: thin arcs lifting off the limb --- */
  float prom = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float a0 = hash(vec2(fi, 5.1)) * 6.2831 + t * (0.03 + 0.015 * fi);
    float lobe = pow(0.5 + 0.5 * cos(ang - a0), 7.0);
    float h = 0.05 + 0.10 * uStorm + 0.025 * sin(t * (0.5 + fi * 0.2) + fi * 2.2);
    float arc = exp(-pow((r - R - h) * 52.0, 2.0));
    float pulse = 0.5 + 0.5 * sin(t * (0.7 + fi * 0.27) + fi * 4.0);
    prom += lobe * arc * (0.35 + 0.65 * pulse);
  }
  prom *= 0.4 + uStorm * 1.2;
  col += prom * mix(vec3(1.0, 0.62, 0.24), vec3(1.0, 0.24, 0.14), uStorm) * 1.5;

  /* --- corona: sparse long streamers flowing outward --- */
  float laneA = ang * 6.0;
  float str = fbm(vec2(laneA, log(max(r, 0.001)) * 6.0 - t * (0.18 + uStorm * 0.45)));
  float cor = pow(str, 3.2) * smoothstep(0.45, 0.85, str) * 2.0;
  cor *= smoothstep(R - 0.04, R + 0.30, r);
  cor *= exp(-(r - R) * (2.4 - 1.3 * uStorm));
  col += cor * mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.32, 0.12), uStorm) * 1.6;
  // inner corona glow
  col += vec3(1.0, 0.52, 0.13) * exp(-(r - R) * 5.5) * smoothstep(R - 0.005, R + 0.02, r) * 0.4;

  /* --- solar wind: particle streaks racing outward --- */
  float lane = floor((ang + 3.14159) / 6.2832 * 110.0);
  float laneHash = hash(vec2(lane, 11.0));
  float w = (r - t * (0.09 + laneHash * 0.11 + uStorm * 0.22)) * 46.0;
  vec2 cell = vec2(fract((ang + 3.14159) / 6.2832 * 110.0), fract(w));
  float seed = hash(vec2(lane, floor(w)));
  float dot2 = smoothstep(0.3, 0.0, length(cell - vec2(0.5))) * step(0.68, seed);
  float windMask = smoothstep(R + 0.05, R + 0.5, r) * exp(-(r - R) * 1.1);
  col += vec3(1.0, 0.70, 0.35) * dot2 * windMask * (0.3 + uStorm * 0.8);

  col *= 1.12;
  gl_FragColor = vec4(col, 1.0);
}
`;

function Sun() {
  const { nasa } = useMission();
  const mat = useRef<THREE.ShaderMaterial>(null);

  useFrame((s, dt) => {
    const m = mat.current;
    if (!m) return;
    m.uniforms.uTime.value = s.clock.elapsedTime;
    const u = m.uniforms.uStorm;
    u.value += (nasa.solar.intensity - u.value) * Math.min(dt * 0.6, 1);
    m.uniforms.uRes.value.set(s.size.width, s.size.height);
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={mat}
        args={[
          {
            uniforms: {
              uTime: { value: 0 },
              uStorm: { value: 0.4 },
              uRes: { value: new THREE.Vector2(1, 1) },
            },
            vertexShader: VERT,
            fragmentShader: FRAG,
            depthWrite: false,
          },
        ]}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Instrument rack — makes the mode self-explanatory                    */
/* ------------------------------------------------------------------ */

const CLASSES = ["B", "C", "M", "X"];

function KpGauge({ kp }: { kp: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] tracking-[0.25em] text-faint">KP INDEX</span>
        <span className="font-mono text-sm text-bone">{kp.toFixed(1)}</span>
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {Array.from({ length: 9 }, (_, i) => {
          const lit = i < Math.round(kp);
          const hot = i >= 5;
          return (
            <div
              key={i}
              className={`h-3.5 flex-1 rounded-[2px] border ${
                lit
                  ? hot
                    ? "border-alert/60 bg-alert/70"
                    : "border-amber/50 bg-amber/60"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function FlareLadder({ cls }: { cls: string }) {
  const active = cls.trim().charAt(0).toUpperCase();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] tracking-[0.25em] text-faint">
          FLARE CLASS
        </span>
        <span className="font-mono text-sm text-bone">{cls}</span>
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {CLASSES.map((c) => (
          <div
            key={c}
            className={`flex-1 rounded-[3px] border py-1 text-center font-mono text-[10px] ${
              c === active
                ? c === "X"
                  ? "border-alert/70 bg-alert/20 text-alert"
                  : "border-amber/60 bg-amber/15 text-amber"
                : "border-white/10 text-faint"
            }`}
          >
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}

function InstrumentRack() {
  const { nasa } = useMission();
  const s = nasa.solar;
  const tone =
    s.level === "STORM" ? "text-alert border-alert/40" : "text-cyan border-cyan/30";

  return (
    <div className="pointer-events-auto absolute right-6 top-1/2 hidden w-56 -translate-y-1/2 flex-col gap-4 lg:flex">
      <div className="glass-soft rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[9px] tracking-[0.3em] text-faint">
            SOLAR OBS
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-[0.2em] ${tone}`}
          >
            {s.level}
          </span>
        </div>
        <div className="flex flex-col gap-4">
          <KpGauge kp={s.kpIndex} />
          <FlareLadder cls={s.flareClass} />
          <div className="flex items-baseline justify-between border-t border-white/[0.06] pt-3 font-mono">
            <span className="text-[9px] tracking-[0.25em] text-faint">
              SOLAR WIND
            </span>
            <span className="text-sm text-bone">
              {s.windSpeedKms > 0 ? (
                <ScrambleText text={`${fmtInt(s.windSpeedKms)} KM/S`} />
              ) : (
                "QUIET"
              )}
            </span>
          </div>
          <div className="flex justify-between font-mono text-[9px] tracking-[0.2em] text-faint">
            <span>
              FLR <span className="text-dim">{s.flareCount}</span>
            </span>
            <span>
              CME <span className="text-dim">{s.cmeCount}</span>
            </span>
            <span>
              GST <span className="text-dim">{s.stormCount}</span>
            </span>
          </div>
        </div>
      </div>
      <div className="px-1 font-mono text-[8px] leading-relaxed tracking-[0.25em] text-faint">
        DONKI / GSFC — 7 DAY WINDOW
        <br />
        DRIVES CORONA + WIND
      </div>
    </div>
  );
}

/** Caption under the sun disc — anchors what you're looking at. */
function SunCaption() {
  return (
    <div className="pointer-events-none absolute bottom-[16%] left-[29%] hidden -translate-x-1/2 whitespace-nowrap font-mono text-[9px] tracking-[0.3em] text-faint sm:block">
      SOL // PHOTOSPHERE ~5,772 K
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function SolarScene() {
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        className="!absolute inset-0"
      >
        <color attach="background" args={["#050507"]} />
        <Sun />
        <EffectComposer>
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.42}
            luminanceSmoothing={0.25}
            mipmapBlur
          />
          <Noise opacity={0.06} />
          <Vignette offset={0.2} darkness={0.78} />
        </EffectComposer>
      </Canvas>
      <InstrumentRack />
      <SunCaption />
    </div>
  );
}
