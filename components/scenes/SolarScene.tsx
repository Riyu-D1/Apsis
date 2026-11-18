"use client";

import { useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useMission } from "@/lib/store";

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
  vec2 uv = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.6;
  float t = uTime * 0.12;
  float r = length(uv);

  // domain-warped plasma field
  vec2 warp = vec2(fbm(uv * 1.6 + t), fbm(uv * 1.6 - t * 0.7 + 4.2));
  float f = fbm(uv * 2.2 + warp * 1.5 + vec2(0.0, t * 0.6));

  // breathing orb mask
  float R = 0.52 + 0.06 * sin(uTime * 0.35) + f * 0.12;
  float core = smoothstep(R, R - 0.5, r);
  float halo = smoothstep(R + 0.55, R - 0.1, r) * 0.38;

  // kinetic ripples during storm conditions
  float ripple = sin(r * 26.0 - uTime * (1.4 + uStorm * 3.2)) * 0.5 + 0.5;
  f += ripple * 0.2 * uStorm * smoothstep(R + 0.35, 0.0, r);

  // palettes — calm: indigo/emerald · storm: amber/crimson
  vec3 indigo = vec3(0.10, 0.14, 0.55);
  vec3 emerald = vec3(0.05, 0.72, 0.48);
  vec3 amber = vec3(1.0, 0.55, 0.12);
  vec3 crimson = vec3(0.82, 0.08, 0.16);
  vec3 calm = mix(indigo, emerald, clamp(f * 1.4, 0.0, 1.0));
  vec3 storm = mix(amber, crimson, clamp(f * 1.3, 0.0, 1.0));
  vec3 col = mix(calm, storm, uStorm);

  vec3 outc = col * (core * 1.2 + halo) + col * 0.045;
  outc *= 1.0 - smoothstep(0.7, 1.6, length(uv)) * 0.78;

  gl_FragColor = vec4(outc, 1.0);
}
`;

function Plasma() {
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

export default function SolarScene() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      className="!absolute inset-0"
    >
      <color attach="background" args={["#050507"]} />
      <Plasma />
      <EffectComposer>
        <Bloom
          intensity={0.65}
          luminanceThreshold={0.35}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
        <Noise opacity={0.08} />
        <Vignette offset={0.2} darkness={0.78} />
      </EffectComposer>
    </Canvas>
  );
}
