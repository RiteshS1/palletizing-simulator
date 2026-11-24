"use client";

// The landing hero: a sticky 3D stage whose plan step is driven by scroll position.
// Scroll = build the pallet; pointer = gently orbit the camera; hover a carton = inspect it.
import { useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useFormatter, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Link } from "@/i18n/navigation";
import type { PlaybackSource } from "@/lib/player";
import type { Plan } from "@/lib/plan";
import { usePlans } from "@/lib/usePlans";

gsap.registerPlugin(ScrollTrigger);

const Studio = dynamic(() => import("@/components/three/Studio").then((m) => m.Studio), { ssr: false });
const PlanStation = dynamic(() => import("@/components/three/scenes").then((m) => m.PlanStation), { ssr: false });

// Camera that drifts towards the pointer and slowly rises as the stack grows.
// Wide screens: the pallet sits to the right of the headline. Narrow screens: centred, further
// back and lower, so the copy above it stays readable.
function CameraRig({ progress }: { progress: React.RefObject<number> }) {
  const { camera, pointer, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const base = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const p = progress.current ?? 0;
    const wide = size.width / size.height > 1.15;
    const k = wide ? 1.18 : 1.75; // distance multiplier
    base.set((2.7 + pointer.x * 0.45) * k, (1.6 + p * 1.0 - pointer.y * 0.25) * k, (3.1 - pointer.x * 0.2) * k);
    camera.position.lerp(base, Math.min(1, dt * 2.5));
    target.set(wide ? -1.15 : 0, (wide ? 0.6 : 1.45) + p * 0.45, 0);
    camera.lookAt(target);
  });
  return null;
}

export function Hero() {
  const t = useTranslations("home");
  const f = useFormatter();
  const plans = usePlans();
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const counter = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() ?? false;
  const scrollValue = useRef(0); // plan position in boxes, e.g. 12.4 = box 13 is 40% lowered

  const plan: Plan | null = plans?.ep ?? null;
  const total = plan?.placements.length ?? 0;
  const source = useMemo<PlaybackSource>(
    () => ({
      read() {
        const v = scrollValue.current;
        const step = Math.floor(v);
        return { step, t: v - step };
      },
    }),
    [],
  );

  useEffect(() => {
    if (!plan || !section.current) return;
    const palletVolume = plan.pallet.length * plan.pallet.width * plan.pallet.maxHeight;
    const volumes = plan.placements.map((p) => p.sx * p.sy * p.sz);
    const update = (p: number) => {
      progress.current = p;
      scrollValue.current = p * total;
      const step = Math.min(total, Math.floor(scrollValue.current));
      const vol = volumes.slice(0, step).reduce((a, b) => a + b, 0);
      if (counter.current) counter.current.textContent = t("eyebrowStep", { step, total });
      if (fill.current) fill.current.textContent = f.number(vol / palletVolume, { style: "percent", maximumFractionDigits: 0 });
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    if (reduced) {
      update(1);
      return;
    }
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6,
      onUpdate: (self) => update(self.progress),
    });
    update(0);
    return () => st.kill();
  }, [plan, total, reduced, t, f]);

  return (
    <section ref={section} className={reduced ? "relative" : "relative h-[340vh]"} aria-labelledby="hero-title">
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* 3D stage */}
        <div className="absolute inset-0">
          {plan && (
            <Studio camera={[2.7, 1.6, 3.1]} controls={false} env="studio" background="#f7f7f5" quality="high">
              <CameraRig progress={progress} />
              <PlanStation plan={plan} source={source} interactive overlays={{ com: false }} />
            </Studio>
          )}
        </div>

        {/* copy */}
        <div className="pointer-events-none relative z-10 mx-auto flex h-full max-w-[1440px] flex-col justify-between px-4 pb-8 pt-24 sm:px-8 sm:pt-28">
          <div className="max-w-[40rem]">
            <p className="mb-5 flex items-center gap-3 text-[13px] font-medium text-ink-2">
              <span className="inline-block h-[3px] w-8 bg-signal" aria-hidden />
              <span ref={counter} className="tabular-nums" />
            </p>
            <h1
              id="hero-title"
              className="font-display text-[clamp(2.9rem,7.2vw,6.6rem)] font-semibold leading-[0.92] tracking-[-0.035em] text-ink [font-stretch:118%]"
            >
              {t("heroTitle")}
            </h1>
            <p className="mt-6 max-w-[34rem] text-[clamp(1rem,1.25vw,1.2rem)] leading-relaxed text-ink-2">{t("heroLead")}</p>
            <div className="pointer-events-auto mt-8 flex flex-wrap gap-3">
              <Link href="/docs" className="rounded-xs bg-signal px-5 py-3 text-[15px] font-medium text-ink transition-colors hover:bg-[#ff6f3c]">
                {t("ctaStart")}
              </Link>
              <Link href="/simulator/extreme-points" className="rounded-xs bg-paper/80 px-5 py-3 text-[15px] font-medium text-ink ring-1 ring-ink/20 backdrop-blur transition-colors hover:ring-ink/50">
                {t("ctaSimulator")}
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
            <div className="flex items-baseline gap-3">
              <span ref={fill} className="font-display text-[clamp(2.5rem,5vw,4.5rem)] font-semibold leading-none tabular-nums [font-stretch:110%]">
                0%
              </span>
              <span className="text-sm text-mute">{t("fill")}</span>
            </div>
            <div className="hidden pb-1 text-[13px] text-mute sm:block">
              <p>{reduced ? t("hoverHint") : t("scrollHint")}</p>
              <div className="mt-2 h-[3px] w-48 bg-ink/10">
                <div ref={bar} className="h-full origin-left bg-signal" style={{ transform: "scaleX(0)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
