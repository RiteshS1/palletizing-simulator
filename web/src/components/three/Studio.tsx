"use client";

// The stage every 3D view shares: renderer settings, HDR environment lighting, a key light with
// soft shadows, a floor that fades into the background, orbit controls and optional ambient occlusion.
import { Environment, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { EffectComposer, N8AO, SMAA } from "@react-three/postprocessing";
import { Suspense, useEffect, type ReactNode } from "react";
import * as THREE from "three";

export interface StudioProps {
  children: ReactNode;
  camera?: [number, number, number];
  target?: [number, number, number];
  fov?: number;
  env?: "studio" | "warehouse";
  background?: string;
  controls?: boolean;
  autoRotate?: boolean;
  quality?: "high" | "low";
  className?: string;
  onCreated?: (state: { gl: THREE.WebGLRenderer }) => void;
}

const HDRI = { studio: "/hdri/studio_small_09.hdr", warehouse: "/hdri/empty_warehouse_01.hdr" };

// Portrait or narrow canvases see less horizontally (the field of view is vertical), so pull the camera
// back along its view direction until the scene fits again. Runs only when the canvas is resized.
// Depends on the numbers, not the array objects: callers often pass inline arrays, and re-running on
// every render would reset the camera (and undo the user's orbiting) each time the plan advances.
function ResponsiveCamera({ base, target }: { base: [number, number, number]; target: [number, number, number] }) {
  const { camera, size } = useThree();
  const [bx, by, bz] = base;
  const [tx, ty, tz] = target;
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const k = aspect < 1.25 ? Math.pow(1.25 / aspect, 0.75) : 1;
    camera.position.set(tx + (bx - tx) * k, ty + (by - ty) * k, tz + (bz - tz) * k);
    camera.lookAt(tx, ty, tz);
  }, [camera, size.width, size.height, bx, by, bz, tx, ty, tz]);
  return null;
}

export function Studio({
  children,
  camera = [3.2, 2.4, 3.6],
  target = [0, 0.8, 0],
  fov = 32,
  env = "studio",
  background = "#efefeb",
  controls = true,
  autoRotate = false,
  quality = "high",
  className,
  onCreated,
}: StudioProps) {
  return (
    <Canvas
      className={className}
      shadows
      dpr={[1, quality === "high" ? 2 : 1.5]}
      camera={{ position: camera, fov, near: 0.05, far: 60 }}
      gl={{ antialias: quality !== "high", preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onCreated={(state) => {
        state.gl.shadowMap.type = THREE.PCFSoftShadowMap;
        onCreated?.(state);
      }}
    >
      <ResponsiveCamera base={camera} target={target} />
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, 9, 22]} />
      <Suspense fallback={null}>
        <Environment files={HDRI[env]} environmentIntensity={env === "studio" ? 0.75 : 0.6} />
      </Suspense>
      <hemisphereLight args={["#ffffff", "#c9c4ba", 0.35]} />
      <directionalLight
        position={[4, 7, 3.5]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={background} roughness={0.95} />
      </mesh>
      {children}
      {controls && (
        <OrbitControls
          makeDefault
          target={target}
          enableDamping
          dampingFactor={0.08}
          minDistance={1.2}
          maxDistance={14}
          maxPolarAngle={Math.PI * 0.47}
          autoRotate={autoRotate}
          autoRotateSpeed={0.6}
        />
      )}
      {quality === "high" && (
        <EffectComposer multisampling={0}>
          <N8AO aoRadius={0.35} intensity={1.6} distanceFalloff={0.6} quality="medium" halfRes />
          <SMAA />
        </EffectComposer>
      )}
    </Canvas>
  );
}
