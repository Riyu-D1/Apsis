"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useMission } from "@/lib/store";
import { fmtInt, mulberry32, seedFromString } from "@/lib/format";
import type { Asteroid, IssPosition } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Orbit model — the asteroid's flyby path is derived from real data    */
/* ------------------------------------------------------------------ */

const EARTH_R = 2.3;

interface OrbitSpec {
  curve: THREE.CatmullRomCurve3;
  pts: THREE.Vector3[]; // sampled points, len = SAMPLES, ordered by travel
  perigee: number; // world units from Earth's centre at closest approach
  perigeeIdx: number;
  period: number; // seconds per loop baseline
  earth: THREE.Vector3;
}

const SAMPLES = 280;

/**
 * Every asteroid gets its own flyby geometry — approach bearing, orbit-plane
 * tilt, eccentricity and direction of travel are all seeded from the object
 * id, while the perigee distance is bound to the real miss distance.
 */
function buildOrbit(asteroid: Asteroid): OrbitSpec {
  const rand = mulberry32(seedFromString(asteroid.id));

  // miss distance -> perigee distance (log scale, always clears the limb)
  const norm = Math.max(
    0,
    Math.min(1, (Math.log10(Math.max(asteroid.missDistanceKm, 3e5)) - 5.4) / 1.6),
  );
  const perigee = EARTH_R + 0.5 + norm * 3.6; // 2.8 .. 6.4
  const a = perigee + 3.0 + rand() * 2.4;
  const b = a * (0.4 + rand() * 0.38);

  // Earth sits at a slightly different vantage per object
  const earth = new THREE.Vector3(
    4.2 + (rand() - 0.5) * 1.8,
    -0.8 + (rand() - 0.5) * 1.2,
    -3.6 + (rand() - 0.5) * 1.2,
  );

  // per-asteroid approach bearing — perigee biased toward the camera so the
  // closest pass is always on the visible side of the disc
  const dir = new THREE.Vector3(
    rand() * 2 - 1,
    (rand() * 2 - 1) * 0.9,
    -(0.3 + rand() * 0.85),
  ).normalize();

  // orbit plane = span(dir, seeded perpendicular)
  const axisB = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).cross(
    dir,
  );
  if (axisB.lengthSq() < 1e-4) axisB.set(1, 0, 0);
  axisB.normalize();

  // ellipse centred so its near vertex sits `perigee` from Earth
  const center = earth.clone().addScaledVector(dir, a - perigee);
  let pts = Array.from({ length: SAMPLES }, (_, i) => {
    const th = (i / SAMPLES) * Math.PI * 2;
    return center
      .clone()
      .addScaledVector(dir, Math.cos(th) * a)
      .addScaledVector(axisB, Math.sin(th) * b);
  });
  if (rand() > 0.5) pts = pts.reverse(); // prograde vs retrograde

  // perigee = sample closest to Earth
  let perigeeIdx = 0;
  let best = Infinity;
  pts.forEach((p, i) => {
    const d = p.distanceTo(earth);
    if (d < best) {
      best = d;
      perigeeIdx = i;
    }
  });
  const curve = new THREE.CatmullRomCurve3(pts, true);

  // velocity -> baseline orbital rate
  const period = 90 - Math.min(asteroid.velocityKmh / 120000, 1) * 55;
  return { curve, pts, perigee, perigeeIdx, period, earth };
}

/* ------------------------------------------------------------------ */
/* Rock — deterministic faceted displacement                            */
/* ------------------------------------------------------------------ */

function useRockGeometry(seedKey: string) {
  return useMemo(() => {
    const seed = seedFromString(seedKey);
    const rand = mulberry32(seed);
    const base = new THREE.IcosahedronGeometry(1.05, 4);
    const pos = base.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const d = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      d.copy(v).normalize();
      const n =
        Math.sin(d.x * 3.1 + seed) *
          Math.sin(d.y * 4.3 + seed * 0.7) *
          Math.sin(d.z * 3.7 + seed * 1.3) +
        0.5 *
          Math.sin(d.x * 7.9 + seed) *
          Math.sin(d.y * 6.1) *
          Math.sin(d.z * 8.3) +
        0.18 * (rand() - 0.5);
      v.copy(d).multiplyScalar(1.05 * (1 + n * 0.24));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    base.computeVertexNormals();
    return base;
  }, [seedKey]);
}

/* ------------------------------------------------------------------ */
/* Earth — procedural shader planet: continents, ocean glint, ice caps, */
/* night-side city lights, drifting clouds, fresnel atmosphere          */
/* ------------------------------------------------------------------ */

const EARTH_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vLocal;
void main() {
  vLocal = normalize(position);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const NOISE_GLSL = /* glsl */ `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y),
    mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y),
    f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec3(13.7);
    a *= 0.5;
  }
  return v;
}
`;

const EARTH_FRAG = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vLocal;
uniform vec3 uSunDir;
${NOISE_GLSL}
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 p = vLocal;

  // ~35% land with noisy coastlines
  float cont = fbm(p * 3.2 + vec3(7.31));
  float coast = fbm(p * 8.0 + vec3(2.9));
  float land = smoothstep(0.56, 0.60, cont + (coast - 0.5) * 0.16);
  float elev = fbm(p * 9.0 + vec3(5.7));

  // green-dominant land — deserts only in patchy subtropical bands
  float lat = abs(p.y);
  float dryBand =
    smoothstep(0.14, 0.3, lat) *
    (1.0 - smoothstep(0.42, 0.6, lat)) *
    smoothstep(0.45, 0.65, fbm(p * 5.0 + vec3(9.2)));
  vec3 landCol = mix(vec3(0.05, 0.3, 0.07), vec3(0.42, 0.38, 0.16), dryBand);
  landCol = mix(landCol, vec3(0.3, 0.26, 0.2), smoothstep(0.62, 0.85, elev) * 0.6);
  landCol *= 0.8 + 0.4 * elev;

  vec3 ocean = mix(
    vec3(0.01, 0.075, 0.25),
    vec3(0.02, 0.19, 0.42),
    smoothstep(0.5, 0.585, cont)
  );
  vec3 col = mix(ocean, landCol, land);

  float ice = smoothstep(0.72, 0.82, lat + (fbm(p * 6.0) - 0.5) * 0.15);
  col = mix(col, vec3(0.82, 0.88, 0.95), ice);

  float sunAmt = dot(N, uSunDir);
  float day = smoothstep(-0.1, 0.1, sunAmt);
  float direct = max(sunAmt, 0.0);

  vec3 H = normalize(uSunDir + V);
  float spec =
    pow(max(dot(N, H), 0.0), 72.0) * (1.0 - land) * (1.0 - ice) * direct;

  vec3 lit = col * (0.02 + direct * 0.95 + day * 0.03);
  lit += vec3(0.45, 0.6, 0.9) * spec * 0.8;

  float term = exp(-abs(sunAmt) * 9.0);
  lit += vec3(0.85, 0.38, 0.12) * term * 0.05;

  // faint clustered city lights on the night side
  float night = 1.0 - day;
  float pop = smoothstep(0.62, 0.78, fbm(p * 9.0 + vec3(4.2)));
  float dots = smoothstep(0.78, 0.95, vnoise(p * 90.0));
  lit += vec3(1.0, 0.75, 0.42) * night * land * (1.0 - ice) * pop * dots * 0.9;

  // thin blue atmosphere rim, day side only
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.5);
  lit += vec3(0.3, 0.55, 1.0) * fres * day * 0.22;

  gl_FragColor = vec4(lit, 1.0);
}
`;

const CLOUD_FRAG = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vLocal;
uniform vec3 uSunDir;
uniform float uTime;
${NOISE_GLSL}
void main() {
  vec3 N = normalize(vNormal);
  vec3 p = vLocal + vec3(uTime * 0.006, 0.0, uTime * 0.002);
  float c = fbm(p * 3.8 + vec3(11.3));
  c = c * 0.65 + 0.35 * fbm(p * 10.0);
  float alpha = smoothstep(0.56, 0.78, c);
  float sunAmt = dot(N, uSunDir);
  float day = smoothstep(-0.12, 0.2, sunAmt);
  vec3 col = vec3(0.95, 0.97, 1.0) * (0.06 + max(sunAmt, 0.0) * 0.95);
  gl_FragColor = vec4(col, alpha * (0.04 + day * 0.96) * 0.8);
}
`;

const ATMO_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const ATMO_FRAG = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float f = pow(max(0.0, 0.78 - dot(vNormal, vView)), 6.0);
  gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * f * 0.6, f * 0.7);
}
`;

const SUN_DIR = new THREE.Vector3(5, 4, 3).normalize();

/**
 * The ISS on its real 51.6°-inclination orbit. The marker's position is
 * derived from the live sub-satellite lat/lon: solve the argument of
 * latitude u from sin(lat) = sin(i)·sin(u), recover the longitude of the
 * ascending node, then rotate the whole orbit about Y so the marker sits
 * exactly on the ring at the published longitude.
 */
function IssTrack({ iss }: { iss: IssPosition }) {
  const marker = useRef<THREE.Group>(null);
  const { pts, markerPos } = useMemo(() => {
    const incl = (51.6 * Math.PI) / 180;
    const r = EARTH_R * (1 + iss.altKm / 6371);
    const la = (iss.lat * Math.PI) / 180;
    const lo = (iss.lon * Math.PI) / 180;

    const sinU = THREE.MathUtils.clamp(Math.sin(la) / Math.sin(incl), -1, 1);
    const orbLon = (uu: number) =>
      Math.atan2(Math.sin(uu) * Math.cos(incl), Math.cos(uu));
    const cands = [Math.asin(sinU), Math.PI - Math.asin(sinU)];
    let u = cands[0];
    let bd = Infinity;
    for (const c of cands) {
      const dl = Math.abs(
        Math.atan2(Math.sin(orbLon(c) - lo), Math.cos(orbLon(c) - lo)),
      );
      if (dl < bd) {
        bd = dl;
        u = c;
      }
    }
    // yaw the orbit plane so the marker's longitude matches the feed
    const theta = orbLon(u) - lo;
    const P = (uu: number) => {
      const x = r * Math.cos(uu);
      const y = r * Math.sin(uu) * Math.sin(incl);
      const z = r * Math.sin(uu) * Math.cos(incl);
      return new THREE.Vector3(
        x * Math.cos(theta) + z * Math.sin(theta),
        y,
        -x * Math.sin(theta) + z * Math.cos(theta),
      );
    };

    const pts = Array.from({ length: 140 }, (_, k) =>
      P((k / 140) * Math.PI * 2),
    );
    return { pts, markerPos: P(u), u };
  }, [iss]);

  const ring = useMemo(() => {
    const l = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({
        color: "#67e8f9",
        transparent: true,
        opacity: 0.22,
      }),
    );
    return l;
  }, [pts]);

  // glide toward the next published position instead of teleporting
  const target = useMemo(() => markerPos.clone(), [markerPos]);
  useFrame((_, dt) => {
    if (!marker.current) return;
    marker.current.position.lerp(target, Math.min(1, dt * 1.6));
  });

  return (
    <group>
      <primitive object={ring} />
      <group ref={marker} position={markerPos}>
        <mesh>
          <octahedronGeometry args={[0.075]} />
          <meshBasicMaterial color="#67e8f9" />
        </mesh>
        <Html position={[0, 0.28, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="w-max -translate-x-1/2 whitespace-nowrap font-mono text-[8px] tracking-[0.25em] text-cyan/80">
            ISS
          </div>
        </Html>
      </group>
    </group>
  );
}

function Earth({ position, iss }: { position: THREE.Vector3; iss: IssPosition }) {
  const g = useRef<THREE.Group>(null);
  const surfMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uSunDir: { value: SUN_DIR } },
        vertexShader: EARTH_VERT,
        fragmentShader: EARTH_FRAG,
      }),
    [],
  );
  const cloudMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uSunDir: { value: SUN_DIR }, uTime: { value: 0 } },
        vertexShader: EARTH_VERT,
        fragmentShader: CLOUD_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.028;
    cloudMat.uniforms.uTime.value += dt;
  });
  return (
    <group position={position}>
      <IssTrack iss={iss} />
      <group ref={g}>
        <mesh material={surfMat}>
          <sphereGeometry args={[EARTH_R, 64, 64]} />
        </mesh>
        <mesh scale={1.018} material={cloudMat}>
          <sphereGeometry args={[EARTH_R, 48, 48]} />
        </mesh>
        <mesh scale={1.14}>
          <sphereGeometry args={[EARTH_R, 48, 48]} />
          <shaderMaterial
            vertexShader={ATMO_VERT}
            fragmentShader={ATMO_FRAG}
            transparent
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
      <Html
        position={[0, -EARTH_R - 0.55, 0]}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="w-max -translate-x-1/2 font-mono text-[8px] tracking-[0.3em] text-cyan/70">
          EARTH
        </div>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Orbit path — dashed ellipse + perigee tick                           */
/* ------------------------------------------------------------------ */

function OrbitPath({ spec, color }: { spec: OrbitSpec; color: string }) {
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(spec.pts);
    const l = new THREE.LineLoop(
      geo,
      new THREE.LineDashedMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        dashSize: 0.26,
        gapSize: 0.17,
      }),
    );
    l.computeLineDistances();
    return l;
  }, [spec, color]);

  const miss = spec.pts[spec.perigeeIdx];
  const leader = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([spec.earth, miss]);
    const l = new THREE.Line(
      g,
      new THREE.LineDashedMaterial({
        color: "#f5a524",
        transparent: true,
        opacity: 0.45,
        dashSize: 0.14,
        gapSize: 0.12,
      }),
    );
    l.computeLineDistances();
    return l;
  }, [miss, spec.earth]);

  return (
    <group>
      <primitive object={line} />
      {/* closest-approach marker */}
      <group position={miss}>
        <mesh>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshBasicMaterial color="#f5a524" />
        </mesh>
        <Html
          position={[0, 0.35, 0]}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="w-max -translate-x-1/2 whitespace-nowrap font-mono text-[8px] tracking-[0.25em] text-amber/90">
            CA
          </div>
        </Html>
      </group>
      {/* miss-distance leader from Earth centre to the CA point */}
      <primitive object={leader} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Tracking reticle — brackets that stay locked on the moving rock      */
/* ------------------------------------------------------------------ */

function Reticle({ color }: { color: string }) {
  const spin = useRef<THREE.Group>(null);
  const parts = useMemo(() => {
    const group = new THREE.Group();
    const circPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      circPts.push(new THREE.Vector3(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0));
    }
    const circ = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(circPts),
      new THREE.LineDashedMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        dashSize: 0.14,
        gapSize: 0.11,
      }),
    );
    circ.computeLineDistances();
    group.add(circ);

    const seg: THREE.Vector3[] = [];
    const R = 1.85;
    const L = 0.24;
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        const cx = sx * R;
        const cy = sy * R;
        seg.push(new THREE.Vector3(cx - sx * L, cy, 0), new THREE.Vector3(cx, cy, 0));
        seg.push(new THREE.Vector3(cx, cy - sy * L, 0), new THREE.Vector3(cx, cy, 0));
      }
    }
    for (const a of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      seg.push(
        new THREE.Vector3(c * 1.64, s * 1.64, 0),
        new THREE.Vector3(c * 1.8, s * 1.8, 0),
      );
    }
    group.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(seg),
        new THREE.LineBasicMaterial({
          color: "#f4f4f6",
          transparent: true,
          opacity: 0.6,
        }),
      ),
    );
    return group;
  }, [color]);

  useFrame((s, dt) => {
    if (!spin.current) return;
    spin.current.rotation.z -= dt * 0.06;
    spin.current.lookAt(s.camera.position);
  });
  return (
    <group ref={spin}>
      <primitive object={parts} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* The traveler — rock + trail + reticle + callout riding the orbit     */
/* ------------------------------------------------------------------ */

const TRAIL_N = 46;

interface TrackSync {
  pos: THREE.Vector3;
  distKm: number;
  t: number;
}

function Traveler({
  asteroid,
  spec,
  sync,
}: {
  asteroid: Asteroid;
  spec: OrbitSpec;
  sync: React.MutableRefObject<TrackSync>;
}) {
  const body = useRef<THREE.Group>(null);
  const rock = useRef<THREE.Group>(null);
  const geo = useRockGeometry(asteroid.id);
  const wire = asteroid.hazardous ? "#ff5f45" : "#6ea8ff";
  const scale = 0.75 + Math.min(asteroid.diameterM / 700, 1) * 0.5;

  // fading trail behind the rock — preallocated buffer, additive gradient
  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3),
    );
    const colors = new Float32Array(TRAIL_N * 3);
    const c = new THREE.Color(asteroid.hazardous ? "#ff5f45" : "#f5a524");
    for (let i = 0; i < TRAIL_N; i++) {
      const f = Math.pow(i / (TRAIL_N - 1), 1.6); // tail dark -> head bright
      colors[i * 3] = c.r * f;
      colors[i * 3 + 1] = c.g * f;
      colors[i * 3 + 2] = c.b * f;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const l = new THREE.Line(
      g,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    l.frustumCulled = false;
    return l;
  }, [asteroid.hazardous]);

  const tRef = useRef(
    Math.abs(seedFromString(asteroid.id) % 100) / 400, // deterministic phase
  );

  useFrame((s, dt) => {
    const g = body.current;
    if (!g) return;
    const pos = g.position;
    const dist = Math.max(pos.distanceTo(spec.earth), 0.001);
    // Kepler-ish: whip past at perigee, crawl at apoapsis
    const boost = THREE.MathUtils.clamp(
      Math.pow(spec.perigee / dist, 1.5),
      0.4,
      4.2,
    );
    tRef.current =
      (((tRef.current + dt * boost * (1 / spec.period)) % 1) + 1) % 1;
    spec.curve.getPointAt(tRef.current, pos);

    // publish to the 2-D trajectory plot + live range
    sync.current.pos.copy(pos);
    sync.current.t = tRef.current;
    sync.current.distKm =
      (dist / spec.perigee) * asteroid.missDistanceKm;

    if (rock.current) {
      rock.current.rotation.y += dt * (0.12 + asteroid.velocityKmh / 400000);
      rock.current.rotation.x =
        Math.sin(s.clock.elapsedTime * 0.12) * 0.1 + 0.18;
    }

    // write trail — last TRAIL_N samples behind the head
    const idx = Math.floor(tRef.current * SAMPLES);
    const attr = trail.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < TRAIL_N; i++) {
      const j = (((idx - TRAIL_N + i) % SAMPLES) + SAMPLES) % SAMPLES;
      const p = spec.pts[j];
      attr.setXYZ(i, p.x, p.y, p.z);
    }
    attr.needsUpdate = true;
  });

  return (
    <group>
      <group ref={body} scale={scale}>
        <group ref={rock}>
          <mesh geometry={geo}>
            <meshStandardMaterial
              color="#6b6459"
              flatShading
              roughness={0.92}
              metalness={0.12}
            />
          </mesh>
          <mesh geometry={geo} scale={1.006}>
            <meshBasicMaterial
              wireframe
              transparent
              opacity={asteroid.hazardous ? 0.2 : 0.09}
              color={wire}
            />
          </mesh>
        </group>
        <Reticle color={wire} />
        {/* telemetry callout anchored to the rock */}
        <Html
          position={[2.2, 1.6, 0]}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="w-max font-mono text-[9px] leading-relaxed tracking-[0.18em] text-white/80">
            <div className="border-l border-white/40 pl-2">
              <div className={asteroid.hazardous ? "text-alert" : "text-amber"}>
                {asteroid.name}
              </div>
              <div className="text-white/50">
                {fmtInt(asteroid.velocityKmh)} KM/H
              </div>
            </div>
          </div>
        </Html>
      </group>
      <primitive object={trail} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Radar polar grid below the scene                                     */
/* ------------------------------------------------------------------ */

function PolarDeck() {
  const ref = useRef<THREE.Object3D>(null);
  const grid = useMemo(() => {
    const g = new THREE.PolarGridHelper(
      16,
      16,
      8,
      72,
      new THREE.Color("#6b6b78"),
      new THREE.Color("#2c2c36"),
    );
    const mat = g.material as THREE.LineBasicMaterial;
    mat.transparent = true;
    mat.opacity = 0.14;
    return g;
  }, []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.02;
  });
  return (
    <group position={[-1, -3.4, -2]} rotation={[0.95, 0, 0]}>
      <primitive ref={ref} object={grid} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Near-field dust for camera parallax depth                            */
/* ------------------------------------------------------------------ */

function Dust() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const rand = mulberry32(2026);
    const n = 300;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (rand() - 0.5) * 20;
      p[i * 3 + 1] = (rand() - 0.5) * 11;
      p[i * 3 + 2] = -8 + rand() * 12;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.006;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        size={0.018}
        color="#8fa8cc"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/* Camera — wide tracking shot with pointer parallax                    */
/* ------------------------------------------------------------------ */

function CameraRig({ spec }: { spec: OrbitSpec }) {
  const { camera, pointer } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  // frame Earth + the closest-approach point — re-aims per asteroid
  const aim = useMemo(
    () =>
      spec.earth
        .clone()
        .lerp(spec.pts[spec.perigeeIdx], 0.4)
        .add(new THREE.Vector3(-1.2, 0.3, 0)),
    [spec],
  );
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    target.set(
      Math.sin(t * 0.05) * 0.25 + pointer.x * 0.45,
      1.5 + Math.sin(t * 0.07) * 0.1 + pointer.y * 0.28,
      10.6,
    );
    camera.position.lerp(target, 0.05);
    camera.lookAt(aim);
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Trajectory plot — top-down 2-D map synced to the 3-D body            */
/* ------------------------------------------------------------------ */

function TrajectoryPlot({
  spec,
  asteroid,
  sync,
}: {
  spec: OrbitSpec;
  asteroid: Asteroid;
  sync: React.MutableRefObject<TrackSync>;
}) {
  const dot = useRef<SVGCircleElement>(null);
  const rangeEl = useRef<HTMLSpanElement>(null);
  const { crew, selfId } = useMission();
  const blips = useRef(new Map<string, SVGGElement>());

  /* crewmates on the scope — each gets a seeded orbit ring around Earth;
     status colors: cyan focus, amber rest, dim hold, white zen */
  const others = useMemo(
    () => Object.entries(crew).filter(([id]) => id !== selfId),
    [crew, selfId],
  );
  const blipParams = useMemo(() => {
    const m = new Map<
      string,
      { r: number; a0: number; dir: number; speed: number }
    >();
    others.forEach(([id], i) => {
      const rand = mulberry32(seedFromString(id));
      m.set(id, {
        r: 16 + ((i + Math.floor(rand() * 3)) % 3) * 8,
        a0: rand() * Math.PI * 2,
        dir: rand() < 0.5 ? 1 : -1,
        speed: 0.15 + rand() * 0.2,
      });
    });
    return m;
  }, [others]);

  // project the orbit onto the XZ plane (top-down), fit to panel
  const W = 208;
  const H = 128;
  const proj = useMemo(() => {
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    const all = [...spec.pts, spec.earth];
    all.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    });
    const pad = 12;
    const sx = (W - pad * 2) / Math.max(maxX - minX, 0.001);
    const sz = (H - pad * 2) / Math.max(maxZ - minZ, 0.001);
    const s = Math.min(sx, sz);
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const map = (p: THREE.Vector3) => [
      W / 2 + (p.x - cx) * s,
      H / 2 + (p.z - cz) * s,
    ];
    const d = spec.pts
      .map((p, i) => {
        const [x, y] = map(p);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
    return { d, earth: map(spec.earth), ca: map(spec.pts[spec.perigeeIdx]), map };
  }, [spec]);

  /* sync the 2-D marker + crew blips to the 3-D body (plain RAF —
     outside the Canvas, so zero React re-renders per frame) */
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const [x, y] = proj.map(sync.current.pos);
      dot.current?.setAttribute("cx", x.toFixed(1));
      dot.current?.setAttribute("cy", y.toFixed(1));
      if (rangeEl.current)
        rangeEl.current.textContent = `RNG ${fmtInt(sync.current.distKm)} KM`;
      const now = performance.now() / 1000;
      for (const [id, g] of blips.current) {
        const p = blipParams.get(id);
        if (!p) continue;
        const a = p.a0 + now * p.speed * p.dir;
        const bx = Math.min(W - 30, Math.max(30, proj.earth[0] + p.r * Math.cos(a)));
        const by = Math.min(H - 14, Math.max(14, proj.earth[1] + p.r * Math.sin(a)));
        g.setAttribute("transform", `translate(${bx.toFixed(1)} ${by.toFixed(1)})`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [proj, sync, blipParams]);

  return (
    <div className="pointer-events-none absolute bottom-36 right-6 hidden w-56 lg:block">
      <div className="glass-soft rounded-xl p-3">
        <div className="mb-2 flex items-center justify-between font-mono text-[8px] tracking-[0.3em] text-faint">
          <span>TRAJECTORY — TOP DOWN</span>
          <span className={asteroid.hazardous ? "text-alert" : "text-cyan"}>
            {asteroid.name}
          </span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <rect x={0} y={0} width={W} height={H} fill="rgba(255,255,255,0.015)" rx={6} />
          {/* orbit */}
          <path
            d={`${proj.d} Z`}
            fill="none"
            stroke={asteroid.hazardous ? "#ff5f45" : "#67e8f9"}
            strokeOpacity={0.5}
            strokeWidth={0.8}
            strokeDasharray="3 3"
          />
          {/* miss-distance chord */}
          <line
            x1={proj.earth[0]}
            y1={proj.earth[1]}
            x2={proj.ca[0]}
            y2={proj.ca[1]}
            stroke="#f5a524"
            strokeOpacity={0.55}
            strokeWidth={0.7}
            strokeDasharray="2 3"
          />
          {/* Earth */}
          <circle cx={proj.earth[0]} cy={proj.earth[1]} r={7} fill="rgba(103,168,255,0.25)" />
          <circle cx={proj.earth[0]} cy={proj.earth[1]} r={3.2} fill="#6ea8ff" />
          <text x={proj.earth[0] + 10} y={proj.earth[1] + 2.5} fill="rgba(244,244,246,0.55)" fontSize={7} fontFamily="monospace" letterSpacing={1.5}>
            EARTH
          </text>
          {/* CA tick */}
          <circle cx={proj.ca[0]} cy={proj.ca[1]} r={2} fill="#f5a524" />
          {/* crew tracks */}
          {others.map(([id, m]) => {
            const st = m.zen
              ? "#f4f4f6"
              : !m.running
                ? "#8a8a93"
                : m.phase !== "focus"
                  ? "#f5a524"
                  : "#67e8f9";
            return (
              <g
                key={id}
                ref={(el) => {
                  if (el) blips.current.set(id, el);
                  else blips.current.delete(id);
                }}
              >
                <circle r={2.2} fill={st} />
                <text
                  x={5}
                  y={2}
                  fill={st}
                  fillOpacity={0.85}
                  fontSize={5.5}
                  fontFamily="monospace"
                  letterSpacing={0.8}
                >
                  {m.callsign.split("-")[0]}
                </text>
              </g>
            );
          })}
          {/* traveler */}
          <circle ref={dot} cx={proj.ca[0]} cy={proj.ca[1]} r={3} fill="none" stroke="#f5a524" strokeWidth={0.8} strokeOpacity={0.5} />
        </svg>
        <div className="mt-1.5 flex justify-between font-mono text-[8px] tracking-[0.2em] text-faint">
          <span ref={rangeEl}>RNG — KM</span>
          <span>CA {asteroid.approachUtc}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Pause the render loop while the tab is hidden — saves GPU + battery. */
function FramePause() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    const apply = () => setFrameloop(document.hidden ? "never" : "always");
    apply();
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, [setFrameloop]);
  return null;
}

export default function AsteroidScene() {
  const { asteroid, nasa } = useMission();
  const spec = useMemo(() => buildOrbit(asteroid), [asteroid]);
  const sync = useRef<TrackSync>({ pos: new THREE.Vector3(), distKm: 0, t: 0 });
  const pathColor = asteroid.hazardous ? "#ff5f45" : "#f4f4f6";

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1.5, 10.6], fov: 42 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        className="!absolute inset-0"
      >
        <color attach="background" args={["#050507"]} />
        <fog attach="fog" args={["#050507", 13, 40]} />
        <ambientLight intensity={0.14} />
        <directionalLight position={[5, 4, 3]} intensity={2.3} color="#ffe9c8" />
        <pointLight
          position={[-7, -2, -5]}
          intensity={55}
          distance={32}
          color="#4169e1"
        />
        <pointLight position={[6, -4.5, 3]} intensity={14} distance={18} color="#f5a524" />
        <Stars
          radius={85}
          depth={45}
          count={5200}
          factor={3}
          saturation={0}
          fade
          speed={0.35}
        />
        <Dust />
        <PolarDeck />
        <FramePause />
        <OrbitPath spec={spec} color={pathColor} />
        <Earth position={spec.earth} iss={nasa.iss} />
        <Traveler asteroid={asteroid} spec={spec} sync={sync} />
        <CameraRig spec={spec} />
        <EffectComposer>
          <Bloom
            intensity={0.55}
            luminanceThreshold={0.5}
            luminanceSmoothing={0.3}
            mipmapBlur
          />
          <Noise opacity={0.07} />
          <Vignette offset={0.2} darkness={0.74} />
        </EffectComposer>
      </Canvas>
      <TrajectoryPlot spec={spec} asteroid={asteroid} sync={sync} />
    </div>
  );
}
