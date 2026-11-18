"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useMission } from "@/lib/store";
import { mulberry32, seedFromString } from "@/lib/format";
import type { Asteroid } from "@/lib/types";

/** Deterministic faceted rock, displaced from an icosahedron. */
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
    const geo = base.toNonIndexed();
    geo.computeVertexNormals();
    base.dispose();
    return geo;
  }, [seedKey]);
}

function OrbitRing() {
  const ring = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 2.9, 0, Math.sin(a) * 2.9));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: "#f4f4f6",
      transparent: true,
      opacity: 0.13,
    });
    return new THREE.LineLoop(geo, mat);
  }, []);
  return (
    <group rotation={[Math.PI / 2.7, 0, 0.4]}>
      <primitive object={ring} />
    </group>
  );
}

function Hitchhiker({ asteroid }: { asteroid: Asteroid }) {
  const group = useRef<THREE.Group>(null);
  const geo = useRockGeometry(asteroid.id);
  const speed = 0.045 + Math.min(asteroid.velocityKmh / 90000, 1) * 0.25;
  const wire = asteroid.hazardous ? "#ff5f45" : "#6ea8ff";

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * speed;
    g.rotation.x = Math.sin(state.clock.elapsedTime * 0.12) * 0.08 + 0.16;
    g.position.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.06;
  });

  return (
    <group>
      <group ref={group}>
        <mesh geometry={geo}>
          <meshStandardMaterial
            color="#6e695f"
            flatShading
            roughness={0.95}
            metalness={0.08}
          />
        </mesh>
        <mesh geometry={geo} scale={1.004}>
          <meshBasicMaterial
            wireframe
            transparent
            opacity={asteroid.hazardous ? 0.16 : 0.085}
            color={wire}
          />
        </mesh>
      </group>
      <OrbitRing />
      {/* distant Earth the rock is missing */}
      <mesh position={[7.6, 1.9, -7.5]}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshStandardMaterial
          color="#2b5cff"
          emissive="#1a3cff"
          emissiveIntensity={0.6}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}

function CameraDrift() {
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    s.camera.position.x = Math.sin(t * 0.05) * 0.42;
    s.camera.position.y = 0.5 + Math.sin(t * 0.07) * 0.16;
    s.camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function AsteroidScene() {
  const { asteroid } = useMission();
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.5, 4.5], fov: 40 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className="!absolute inset-0"
    >
      <color attach="background" args={["#050507"]} />
      <fog attach="fog" args={["#050507", 10, 30]} />
      <ambientLight intensity={0.18} />
      <directionalLight position={[4, 3, 2.5]} intensity={1.6} color="#ffe9c8" />
      <pointLight
        position={[-6, -3, -4]}
        intensity={40}
        distance={28}
        color="#4169e1"
      />
      <Stars
        radius={80}
        depth={40}
        count={4500}
        factor={3}
        saturation={0}
        fade
        speed={0.4}
      />
      <Hitchhiker asteroid={asteroid} />
      <CameraDrift />
      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.55}
          luminanceSmoothing={0.25}
          mipmapBlur
        />
        <Noise opacity={0.07} />
        <Vignette offset={0.22} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}
