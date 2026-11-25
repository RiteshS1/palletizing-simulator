"use client";

// The landing hero: a full-screen 3D stage that builds the pallet on its own, box by box, then
// pauses on the finished pallet and starts again. Pointer = gently orbit the camera; hover a carton =
// inspect it. The bottom edge dissolves into the page so the stage has no hard seam.
import { useFrame, useThree } from "@react-three/fiber";
import { useFormatter, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Link } from "@/i18n/navigation";
import { usePlayer, type Player } from "@/lib/player";
import { usePlans } from "@/lib/usePlans";
import { ArrowRight } from "@/components/ui/ArrowRight";

const Studio = dynamic(() => import("@/components/three/Studio").then((m) => m.Studio), { ssr: false });
const PlanStation = dynamic(() => import("@/components/three/scenes").then((m) => m.PlanStation), { ssr: false });

// Wide screens: the pallet sits to the right of the headline. Narrow screens: centred, further back
// and lower, so the copy stays readable. The camera rises slowly as the stack grows.
function CameraRig({ player }: { player: Player }) {
  const { camera, pointer, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const base = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const { step, t } = player.read();
    const p = player.total ? (step + t) / player.total : 0;
    const wide = size.width / size.height > 1.15;
    const k = wide ? 1.18 : 1.75;
    base.set((2.7 + pointer.x * 0.45) * k, (1.6 + p * 1.0 - pointer.y * 0.25) * k, (3.1 - pointer.x * 0.2) * k);
    camera.position.lerp(base, Math.min(1, dt * 1.6));
    target.set(wide ? -1.15 : 0, (wide ? 0.42 : 1.3) + p * 0.45, 0);
    camera.lookAt(target);
  });
  return null;
}

export function Hero() {
  const t = useTranslations("home");
  const ts = useTranslations("sim");
  const f = useFormatter();
  const plans = usePlans();
  const plan = plans?.ep ?? null;
  const total = plan?.placements.length ?? 0;
  const { player, snapshot } = usePlayer(total, { autoplay: true, speed: 2.4 });

  // Loop: rest on the finished pallet for a few seconds, then build it again.
  useEffect(() => {
    if (!total || snapshot.step < total || snapshot.playing) return;
    const id = setTimeout(() => {
      player.jumpTo(0);
      player.play();
    }, 4000);
    return () => clearTimeout(id);
  }, [player, snapshot.step, snapshot.playing, total]);

  const fill = useMemo(() => {
    if (!plan) return 0;
    const vol = plan.placements.slice(0, snapshot.step).reduce((a, p) => a + p.sx * p.sy * p.sz, 0);
    return vol / (plan.pallet.length * plan.pallet.width * plan.pallet.maxHeight);
  }, [plan, snapshot.step]);

  return (
    <section className="relative h-dvh min-h-[640px] overflow-hidden" aria-labelledby="hero-title">
      {/* 3D stage */}
      <div className="absolute inset-0">
        {plan && (
          <Studio camera={[2.7, 1.6, 3.1]} controls={false} env="studio" background="#f7f7f5" quality="high">
            <CameraRig player={player} />
            <PlanStation plan={plan} source={player} interactive overlays={{ com: false }} />
          </Studio>
        )}
      </div>
      {/* dissolve: the stage melts into the page instead of ending on a hard edge */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[15%] bg-gradient-to-b from-paper/0 via-paper/60 to-paper" aria-hidden />

      {/* copy */}
      <div className="pointer-events-none relative z-10 mx-auto flex h-full max-w-[1440px] flex-col justify-between px-4 pb-10 pt-24 sm:px-8 sm:pt-28">
        <div className="max-w-[40rem]">
          <p className="mb-5 flex items-center gap-3 text-[13px] font-medium text-ink-2" aria-live="off">
            <span className="inline-block h-[3px] w-8 bg-signal" aria-hidden />
            <span className="tabular-nums">{t("eyebrowStep", { step: snapshot.step, total })}</span>
          </p>
          <h1 id="hero-title" className="font-display text-[clamp(2.9rem,7.2vw,6.6rem)] font-semibold leading-[0.92] tracking-[-0.035em] text-ink [font-stretch:118%]">
            {t("heroTitle")}
          </h1>
          <p className="mt-6 max-w-[34rem] text-[clamp(1rem,1.25vw,1.2rem)] leading-relaxed text-ink-2">{t("heroLead")}</p>
          <div className="pointer-events-auto mt-8 flex flex-wrap gap-3">
            <Link href="/docs" className="group inline-flex items-center gap-2.5 rounded-xs bg-signal px-5 py-3 text-[15px] font-medium text-ink transition-colors hover:bg-[#ff6f3c]">
              {t("ctaStart")}
              <ArrowRight />
            </Link>
            <Link href="/simulator/extreme-points" className="rounded-xs bg-paper/80 px-5 py-3 text-[15px] font-medium text-ink ring-1 ring-ink/20 backdrop-blur transition-colors hover:ring-ink/50">
              {t("ctaSimulator")}
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-[clamp(2.5rem,5vw,4.5rem)] font-semibold leading-none tabular-nums [font-stretch:110%]">
              {f.number(fill, { style: "percent", maximumFractionDigits: 0 })}
            </span>
            <span className="text-sm text-mute">{t("fill")}</span>
          </div>
          <div className="pointer-events-auto flex items-center gap-3 pb-1 text-[13px] text-mute">
            <button
              type="button"
              onClick={() => player.toggle()}
              aria-label={snapshot.playing ? ts("pause") : ts("play")}
              className="grid h-8 w-8 place-items-center rounded-full ring-1 ring-ink/20 transition-colors hover:bg-ink hover:text-paper"
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden>
                <path d={snapshot.playing ? "M5 4h4v12H5zM11 4h4v12h-4z" : "M6 4l10 6-10 6z"} />
              </svg>
            </button>
            <div className="hidden sm:block">
              <p>{t("hoverHint")}</p>
              <div className="mt-2 h-[3px] w-48 bg-ink/10">
                <div className="h-full origin-left bg-signal transition-transform duration-300" style={{ transform: `scaleX(${total ? snapshot.step / total : 0})` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
