"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useMission } from "@/lib/store";
import { fmtInt, mulberry32, seedFromString } from "@/lib/format";
import type { Asteroid } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Rock — deterministic faceted displacement                            */
/* ------------------------------------------------------------------ */

function useRockGeometry(seedKey: string) {
  return useMemo(() => {
    const seed = seedFromString(seedKey);
    const rand = mulberry32(seed);
    const base = new THREE.IcosahedronGeometry(1.4, 4);
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
      v.copy(d).multiplyScalar(1.4 * (1 + n * 0.22));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    base.computeVertexNormals();
    return base;
  }, [seedKey]);
}

/* ------------------------------------------------------------------ */
/* Earth — fresnel atmosphere, the body being missed                    */
/* ------------------------------------------------------------------ */

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
  float f = pow(0.68 - dot(vNormal, vView), 3.2);
  gl_FragColor = vec4(vec3(0.32, 0.55, 1.0) * f, f);
}
`;

function Earth() {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.02;
  });
  return (
    <group position={[5.9, -2.1, -8.5]}>
      <group ref={g}>
        <mesh>
          <sphereGeometry args={[2.1, 48, 48]} />
          <meshStandardMaterial
            color="#16307a"
            emissive="#0b1f5e"
            emissiveIntensity={0.9}
            roughness={0.55}
          />
        </mesh>
        {/* cloud sheen */}
        <mesh scale={1.015}>
          <sphereGeometry args={[2.1, 48, 48]} />
          <meshStandardMaterial
            color="#9fc4ff"
            transparent
            opacity={0.18}
            roughness={1}
          />
        </mesh>
        {/* atmosphere */}
        <mesh scale={1.18}>
          <sphereGeometry args={[2.1, 48, 48]} />
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
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Trajectory arc — dashed path + traveling contact marker              */
/* ------------------------------------------------------------------ */

const PATH_POINTS = [
  new THREE.Vector3(-9.5, 2.8, -4),
  new THREE.Vector3(-4.5, 1.1, -1.6),
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(4.5, -1.4, 0.8),
  new THREE.Vector3(9.5, -3.1, 1.4),
];

function Trajectory() {
  const marker = useRef<THREE.Group>(null);
  const { curve, line, ticks } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(PATH_POINTS);
    const pts = curve.getPoints(220);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(
      geo,
      new THREE.LineDashedMaterial({
        color: "#f4f4f6",
        transparent: true,
        opacity: 0.38,
        dashSize: 0.28,
        gapSize: 0.18,
      }),
    );
    line.computeLineDistances();
    const tickPts = pts.filter((_, i) => i % 22 === 0);
    const ticks = new THREE.BufferGeometry().setFromPoints(tickPts);
    return { curve, line, ticks };
  }, []);

  useFrame((s) => {
    if (!marker.current) return;
    const t = (s.clock.elapsedTime * 0.018) % 1;
    curve.getPointAt(t, marker.current.position);
    const pulse = 1 + Math.sin(s.clock.elapsedTime * 4) * 0.25;
    marker.current.scale.setScalar(pulse);
  });

  return (
    <group>
      <primitive object={line} />
      <points geometry={ticks}>
        <pointsMaterial
          size={0.09}
          color="#f4f4f6"
          transparent
          opacity={0.5}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
      <group ref={marker}>
        <mesh>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#f5a524" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshBasicMaterial color="#f5a524" transparent opacity={0.18} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Tracking reticle — rotating AF-lock brackets                         */
/* ------------------------------------------------------------------ */

function Reticle() {
  const spin = useRef<THREE.Group>(null);
  const parts = useMemo(() => {
    const group = new THREE.Group();

    // dashed tracking circle
    const circPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      circPts.push(new THREE.Vector3(Math.cos(a) * 2.05, Math.sin(a) * 2.05, 0));
    }
    const circ = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(circPts),
      new THREE.LineDashedMaterial({
        color: "#67e8f9",
        transparent: true,
        opacity: 0.3,
        dashSize: 0.16,
        gapSize: 0.12,
      }),
    );
    circ.computeLineDistances();
    group.add(circ);

    // four corner brackets
    const seg: THREE.Vector3[] = [];
    const R = 2.42;
    const L = 0.3;
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        const cx = sx * R;
        const cy = sy * R;
        seg.push(new THREE.Vector3(cx - sx * L, cy, 0), new THREE.Vector3(cx, cy, 0));
        seg.push(new THREE.Vector3(cx, cy - sy * L, 0), new THREE.Vector3(cx, cy, 0));
      }
    }
    // cardinal ticks
    for (const a of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      seg.push(
        new THREE.Vector3(c * 2.18, s * 2.18, 0),
        new THREE.Vector3(c * 2.34, s * 2.34, 0),
      );
    }
    const brackets = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(seg),
      new THREE.LineBasicMaterial({
        color: "#f4f4f6",
        transparent: true,
        opacity: 0.55,
      }),
    );
    group.add(brackets);
    return group;
  }, []);

  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.z -= dt * 0.045;
  });

  return (
    <group ref={spin} rotation={[0.12, -0.18, 0]}>
      <primitive object={parts} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Velocity vector — dashed cyan arrow along path tangent               */
/* ------------------------------------------------------------------ */

function VelocityVector({ color }: { color: string }) {
  const arrow = useMemo(() => {
    const group = new THREE.Group();
    const tangent = PATH_POINTS[3].clone().sub(PATH_POINTS[1]).normalize();
    const len = 3.4;
    const geo = new THREE.BufferGeometry().setFromPoints([
      tangent.clone().multiplyScalar(1.9),
      tangent.clone().multiplyScalar(len),
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineDashedMaterial({
        color,
        transparent: true,
        opacity: 0.4,
        dashSize: 0.14,
        gapSize: 0.1,
      }),
    );
    line.computeLineDistances();
    group.add(line);

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.22, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }),
    );
    cone.position.copy(tangent.clone().multiplyScalar(len + 0.12));
    cone.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      tangent.clone().normalize(),
    );
    group.add(cone);
    return group;
  }, [color]);
  return <primitive object={arrow} />;
}

/* ------------------------------------------------------------------ */
/* Radar polar grid below the scene                                     */
/* ------------------------------------------------------------------ */

function PolarDeck() {
  const ref = useRef<THREE.Object3D>(null);
  const grid = useMemo(() => {
    const g = new THREE.PolarGridHelper(
      14,
      16,
      8,
      72,
      new THREE.Color("#6b6b78"),
      new THREE.Color("#2c2c36"),
    );
    const mat = g.material as THREE.LineBasicMaterial;
    mat.transparent = true;
    mat.opacity = 0.16;
    return g;
  }, []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.02;
  });
  return (
    <group position={[0, -2.6, -2.2]} rotation={[0.85, 0, 0]}>
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
      p[i * 3] = (rand() - 0.5) * 18;
      p[i * 3 + 1] = (rand() - 0.5) * 10;
      p[i * 3 + 2] = -7 + rand() * 10;
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
/* Tracked body — rock + reticle + vector + callout bob together        */
/* ------------------------------------------------------------------ */

function TrackedBody({ asteroid }: { asteroid: Asteroid }) {
  const rig = useRef<THREE.Group>(null);
  const rock = useRef<THREE.Group>(null);
  const geo = useRockGeometry(asteroid.id);
  const speed = 0.05 + Math.min(asteroid.velocityKmh / 90000, 1) * 0.26;
  const wire = asteroid.hazardous ? "#ff5f45" : "#6ea8ff";

  useFrame((s, dt) => {
    if (rig.current)
      rig.current.position.y = Math.sin(s.clock.elapsedTime * 0.35) * 0.07;
    if (rock.current) {
      rock.current.rotation.y += dt * speed;
      rock.current.rotation.x =
        Math.sin(s.clock.elapsedTime * 0.12) * 0.08 + 0.16;
    }
  });

  return (
    <group ref={rig}>
      <group ref={rock}>
        <mesh geometry={geo}>
          <meshStandardMaterial
            color="#6b6459"
            flatShading
            roughness={0.92}
            metalness={0.12}
          />
        </mesh>
        <mesh geometry={geo} scale={1.004}>
          <meshBasicMaterial
            wireframe
            transparent
            opacity={asteroid.hazardous ? 0.15 : 0.07}
            color={wire}
          />
        </mesh>
      </group>
      <Reticle />
      <VelocityVector color={wire} />
      {/* telemetry callout */}
      <Html
        position={[2.62, 1.9, 0]}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="w-max font-mono text-[9px] leading-relaxed tracking-[0.18em] text-white/80">
          <div className="border-l border-white/40 pl-2">
            <div className="text-amber">{asteroid.name}</div>
            <div className="text-white/50">
              {fmtInt(asteroid.velocityKmh)} KM/H
            </div>
          </div>
        </div>
      </Html>
      {/* callout leader line */}
      <CalloutLeader />
    </group>
  );
}

function CalloutLeader() {
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(1.15, 1.05, 0),
      new THREE.Vector3(2.4, 1.85, 0),
    ]);
    return new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: "#f4f4f6",
        transparent: true,
        opacity: 0.3,
      }),
    );
  }, []);
  return <primitive object={line} />;
}

/* ------------------------------------------------------------------ */
/* Camera — drift + pointer parallax                                    */
/* ------------------------------------------------------------------ */

function CameraRig() {
  const { camera, pointer } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    target.set(
      Math.sin(t * 0.06) * 0.3 + pointer.x * 0.5,
      0.5 + Math.sin(t * 0.08) * 0.12 + pointer.y * 0.32,
      4.7,
    );
    camera.position.lerp(target, 0.045);
    camera.lookAt(0, 0.05, 0);
  });
  return null;
}

/* ------------------------------------------------------------------ */

export default function AsteroidScene() {
  const { asteroid } = useMission();
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.5, 4.7], fov: 40 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className="!absolute inset-0"
    >
      <color attach="background" args={["#050507"]} />
      <fog attach="fog" args={["#050507", 11, 34]} />
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
      <Trajectory />
      <Earth />
      <TrackedBody asteroid={asteroid} />
      <CameraRig />
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
  );
}
