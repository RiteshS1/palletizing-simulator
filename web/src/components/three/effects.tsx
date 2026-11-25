"use client";

// Particle effects: a soft sprite, floating dust motes for the studio air, and a reusable particle
// "burst" pool (cardboard dust when a carton lands). All use one THREE.Points draw call each.
import { useFrame } from "@react-three/fiber";
import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import * as THREE from "three";

let sprite: THREE.Texture | null = null;
/** A soft round dot, drawn once on a canvas. */
export function dotTexture(): THREE.Texture {
  if (sprite) return sprite;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  sprite = new THREE.CanvasTexture(c);
  return sprite;
}

/** Small seeded generator (LCG): deterministic "randomness" that is pure during render. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Dust drifting slowly through the light: depth and atmosphere for the hero. World units (m). */
export function DustMotes({ count = 260, area = [7, 3.2, 6] as [number, number, number], color = "#b39a6e" }) {
  const points = useRef<THREE.Points>(null);
  const { positions, seeds } = useMemo(() => {
    const rnd = seeded(11);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rnd() - 0.5) * area[0];
      positions[i * 3 + 1] = 0.1 + rnd() * area[1];
      positions[i * 3 + 2] = (rnd() - 0.5) * area[2];
      seeds[i] = rnd() * Math.PI * 2;
    }
    return { positions, seeds };
  }, [count, area]);
  useFrame(({ clock }, dt) => {
    const p = points.current;
    if (!p || prefersReducedMotion()) return;
    const arr = p.geometry.attributes.position.array as Float32Array;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += Math.sin(t * 0.3 + seeds[i]) * dt * 0.03;
      arr[i * 3 + 1] += dt * 0.025;
      arr[i * 3 + 2] += Math.cos(t * 0.25 + seeds[i]) * dt * 0.03;
      if (arr[i * 3 + 1] > area[1] + 0.1) arr[i * 3 + 1] = 0.1;
    }
    p.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} map={dotTexture()} color={color} transparent opacity={0.6} depthWrite={false} sizeAttenuation />
    </points>
  );
}

export interface BurstHandle {
  /** Emit `n` particles from (x, y, z) with random outward velocities (local units per second). */
  emit(x: number, y: number, z: number, opts?: { n?: number; spread?: number; up?: number; ring?: [number, number] }): void;
}

/**
 * A pool of short-lived particles with gravity and fade. Works in the parent's local units,
 * so inside the pallet frame it speaks millimetres (z up).
 */
export function Burst({ handle, max = 400, size = 0.012, color = "#d9c29a", gravity = -900, life = 0.9 }: { handle: Ref<BurstHandle>; max?: number; size?: number; color?: string; gravity?: number; life?: number }) {
  const points = useRef<THREE.Points>(null);
  // Mutable simulation state lives in a ref: it changes every frame and must not trigger renders.
  const sim = useRef<{ pos: Float32Array; vel: Float32Array; age: Float32Array; next: number } | null>(null);
  const getSim = () => (sim.current ??= { pos: new Float32Array(max * 3), vel: new Float32Array(max * 3), age: new Float32Array(max).fill(life), next: 0 });
  const colors = useMemo(() => new Float32Array(max * 3), [max]);
  const base = useMemo(() => new THREE.Color(color), [color]);

  useImperativeHandle(handle, () => ({
    emit(x, y, z, opts = {}) {
      if (prefersReducedMotion()) return;
      const { n = 36, spread = 260, up = 220, ring } = opts;
      const state = getSim();
      for (let k = 0; k < n; k++) {
        const i = state.next;
        state.next = (state.next + 1) % max;
        const a = Math.random() * Math.PI * 2;
        const sx = ring ? (Math.cos(a) * ring[0]) / 2 : 0;
        const sy = ring ? (Math.sin(a) * ring[1]) / 2 : 0;
        state.pos.set([x + sx, y + sy, z + 4], i * 3);
        const s = spread * (0.4 + Math.random() * 0.6);
        state.vel.set([Math.cos(a) * s, Math.sin(a) * s, up * (0.3 + Math.random() * 0.7)], i * 3);
        state.age[i] = 0;
      }
    },
  }));

  useFrame((_, dt) => {
    const p = points.current;
    if (!p) return;
    const state = getSim();
    const pos = p.geometry.attributes.position.array as Float32Array;
    const col = p.geometry.attributes.color.array as Float32Array;
    for (let i = 0; i < max; i++) {
      const alive = state.age[i] < life;
      if (alive) {
        state.age[i] += dt;
        state.vel[i * 3 + 2] += gravity * dt;
        for (let a = 0; a < 3; a++) state.pos[i * 3 + a] += state.vel[i * 3 + a] * dt;
        const v = Math.max(0, 1 - state.age[i] / life); // fade out (vertex colour on a dark-to-base ramp)
        col[i * 3] = base.r * v + (1 - v);
        col[i * 3 + 1] = base.g * v + (1 - v);
        col[i * 3 + 2] = base.b * v + (1 - v);
      }
      pos[i * 3] = alive ? state.pos[i * 3] : 0;
      pos[i * 3 + 1] = alive ? state.pos[i * 3 + 1] : 0;
      pos[i * 3 + 2] = alive ? state.pos[i * 3 + 2] : -1e6; // park dead particles far below
    }
    p.geometry.attributes.position.needsUpdate = true;
    p.geometry.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(max * 3), 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={size} map={dotTexture()} vertexColors transparent opacity={0.9} depthWrite={false} sizeAttenuation />
    </points>
  );
}
