"use client";

// Landing page story sections. Motion budget: things draw or count once as they enter the
// viewport (GSAP ScrollTrigger); photos drift with a gentle parallax. Everything is static
// with prefers-reduced-motion.
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import Image from "next/image";
import { useRef, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "@/components/ui/ArrowRight";
import { DOCS } from "@/lib/docs";
import { usePlans } from "@/lib/usePlans";

gsap.registerPlugin(ScrollTrigger, useGSAP);

function useReveal(scope: React.RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%" } });
      });
      gsap.utils.toArray<SVGPathElement>("[data-draw]").forEach((p) => {
        const len = p.getTotalLength();
        gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut", scrollTrigger: { trigger: p, start: "top 80%" } });
      });
      gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
        const end = Number(el.dataset.count);
        const decimals = Number(el.dataset.decimals ?? 0);
        const suffix = el.dataset.suffix ?? "";
        const obj = { v: 0 };
        gsap.to(obj, {
          v: end,
          duration: 1.8,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
          onUpdate: () => (el.textContent = obj.v.toFixed(decimals) + suffix),
        });
      });
      gsap.utils.toArray<HTMLElement>("[data-bar]").forEach((el) => {
        gsap.from(el, { scaleX: 0, transformOrigin: "left", duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
      });
      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        gsap.fromTo(el, { yPercent: -8 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
      });
    },
    { scope },
  );
}

function SectionTitle({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="max-w-[46rem]" data-reveal>
      <h2 className="font-display text-[clamp(2.1rem,4.6vw,4rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-ink [font-stretch:112%]">{title}</h2>
      <p className="mt-5 text-[clamp(1rem,1.2vw,1.15rem)] leading-relaxed text-ink-2">{lead}</p>
    </div>
  );
}

// ---------------------------------------------------------------- rules
function RuleDiagram({ kind }: { kind: 1 | 2 | 3 }) {
  const stroke = { fill: "none", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 240 150" className="h-auto w-full" aria-hidden>
      <line x1="10" y1="132" x2="230" y2="132" stroke="#141414" strokeWidth="3" />
      {kind === 1 && (
        <>
          <rect x="40" y="92" width="60" height="40" fill="#e2c79c" />
          <rect x="140" y="92" width="60" height="40" fill="#e2c79c" />
          <rect x="60" y="52" width="120" height="40" fill="#c9a678" />
          <path data-draw d="M70 96 L190 96" stroke="#2b59c3" {...stroke} strokeWidth={5} opacity={0.55} />
          <path data-draw d="M120 72 L120 128" stroke="#ff5a1f" {...stroke} strokeDasharray="4 5" />
          <circle cx="120" cy="72" r="5" fill="#ff5a1f" />
        </>
      )}
      {kind === 2 && (
        <>
          <rect x="70" y="92" width="100" height="40" fill="#8f5e30" />
          <rect x="80" y="57" width="80" height="35" fill="#c9a678" />
          <rect x="92" y="27" width="56" height="30" fill="#e6cba2" />
          <path data-draw d="M196 40 L196 120 M188 110 L196 122 L204 110" stroke="#141414" {...stroke} />
        </>
      )}
      {kind === 3 && (
        <>
          <rect x="40" y="82" width="90" height="50" fill="#c9a678" />
          <rect x="60" y="42" width="110" height="40" fill="#e2c79c" />
          <rect x="150" y="92" width="60" height="40" fill="none" stroke="#ff5a1f" strokeDasharray="5 4" strokeWidth="2" />
          <path data-draw d="M180 8 L180 36" stroke="#ff5a1f" {...stroke} strokeWidth={6} />
          <path data-draw d="M168 46 L192 70 M192 46 L168 70" stroke="#ff5a1f" {...stroke} strokeWidth={3} />
        </>
      )}
    </svg>
  );
}

export function RulesSection() {
  const t = useTranslations("home");
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  return (
    <section ref={ref} className="mx-auto max-w-[1440px] px-4 py-28 sm:px-8 sm:py-36">
      <SectionTitle title={t("problemTitle")} lead={t("problemLead")} />
      <div className="mt-16 grid gap-px bg-line ring-1 ring-line md:grid-cols-3">
        {([1, 2, 3] as const).map((k) => (
          <article key={k} className="bg-paper p-7 sm:p-8" data-reveal>
            <RuleDiagram kind={k} />
            <h3 className="mt-6 font-display text-xl font-semibold text-ink">{t(`rule${k}Title`)}</h3>
            <p className="mt-2 leading-relaxed text-ink-2">{t(`rule${k}Body`)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- greedy vs extreme points
export function CompareSection() {
  const t = useTranslations("home");
  const plans = usePlans();
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  const rows = plans
    ? [
        { label: t("greedy"), m: plans.greedy.metrics, tone: "bg-peach" },
        { label: t("ep"), m: plans.ep.metrics, tone: "bg-signal" },
      ]
    : [];
  return (
    <section ref={ref} className="relative bg-ink text-paper">
      {/* soft dissolve from the light page into the dark band and back out again */}
      <div className="pointer-events-none absolute inset-x-0 -top-24 h-24 bg-gradient-to-b from-paper/0 to-ink" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 -bottom-24 h-24 bg-gradient-to-b from-ink to-paper/0" aria-hidden />
      <div className="mx-auto max-w-[1440px] px-4 py-28 sm:px-8 sm:py-36">
        <div className="max-w-[46rem]" data-reveal>
          <h2 className="font-display text-[clamp(2.1rem,4.6vw,4rem)] font-semibold leading-[0.98] tracking-[-0.03em] [font-stretch:112%]">{t("compareTitle")}</h2>
          <p className="mt-5 text-[clamp(1rem,1.2vw,1.15rem)] leading-relaxed text-paper/75">{t("compareLead")}</p>
        </div>
        <div className="mt-16 space-y-12">
          {rows.map(({ label, m, tone }) => (
            <div key={label} data-reveal>
              <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
                <h3 className="font-display text-2xl font-semibold">{label}</h3>
                <dl className="flex flex-wrap gap-x-10 gap-y-2 text-paper/70">
                  <div>
                    <dt className="text-[13px]">{t("placed")}</dt>
                    <dd className="font-display text-3xl font-semibold text-paper tabular-nums">
                      <span data-count={m.placed}>{m.placed}</span>/{m.offered}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[13px]">{t("comOffset")}</dt>
                    <dd className="font-display text-3xl font-semibold text-paper tabular-nums">
                      <span data-count={Math.round(m.comOffset)}>{Math.round(m.comOffset)}</span> mm
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[13px]">{t("planTime")}</dt>
                    <dd className="font-display text-3xl font-semibold text-paper tabular-nums">
                      <span data-count={m.runtimeMs} data-decimals="1">
                        {m.runtimeMs.toFixed(1)}
                      </span>{" "}
                      ms
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <div className="h-3 flex-1 bg-paper/10">
                  <div data-bar className={`h-full ${tone}`} style={{ width: `${(m.fillOfMax * 100).toFixed(1)}%` }} />
                </div>
                <span className="w-28 text-right font-display text-2xl font-semibold tabular-nums">
                  <span data-count={(m.fillOfMax * 100).toFixed(1)} data-decimals="1" data-suffix="%">
                    {(m.fillOfMax * 100).toFixed(1)}%
                  </span>
                </span>
              </div>
              <p className="mt-1.5 text-right text-[13px] text-paper/55">{t("palletFilled")}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- orders and waves
export function OrdersSection() {
  const t = useTranslations("home");
  const f = useFormatter();
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  // Measured with `wes_sim --orders 24 --seed 7` for both policies.
  const policies = [
    { label: t("ordersByOrder"), pallets: 15, fill: 0.194, shift: "0:17:17", tone: "#c9a678" },
    { label: t("ordersWaves"), pallets: 7, fill: 0.415, shift: "0:25:11", tone: "#ff5a1f" },
  ];
  return (
    <section ref={ref} className="mx-auto max-w-[1440px] px-4 py-28 sm:px-8 sm:py-36">
      <SectionTitle title={t("ordersTitle")} lead={t("ordersLead")} />
      <div className="mt-16 grid gap-10 md:grid-cols-2">
        {policies.map((p) => (
          <div key={p.label} data-reveal className="ring-1 ring-line">
            <div className="flex items-end gap-1.5 border-b border-line bg-paper-2 px-6 pb-0 pt-8" aria-hidden>
              {Array.from({ length: p.pallets }).map((_, i) => (
                <div key={i} className="flex w-full max-w-10 flex-col justify-end" style={{ height: 120 }}>
                  <div data-bar className="w-full" style={{ height: `${Math.min(100, p.fill * 100 * (0.75 + ((i * 37) % 50) / 100))}%`, background: p.tone }} />
                  <div className="mt-px h-1.5 w-full bg-ink/70" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 p-6">
              <h3 className="col-span-3 mb-3 font-display text-xl font-semibold">{p.label}</h3>
              <Stat value={p.pallets} label={t("pallets")} />
              <Stat value={f.number(p.fill, { style: "percent", maximumFractionDigits: 0 })} label={t("avgFill")} />
              <Stat value={p.shift} label={t("shift")} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <p className="font-display text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-[13px] text-mute">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------- the real world (photography)
export function RealWorldSection() {
  const t = useTranslations("home");
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  const photos = [
    { src: "/images/robots-orange-factory.jpg", label: t("real1"), alt: "Orange industrial robot arms on a production line" },
    { src: "/images/carton-stack.jpg", label: t("real2"), alt: "A tall stack of cartons in a warehouse" },
    { src: "/images/robot-hand.jpg", label: t("real3"), alt: "An orange robotic hand reaching forward" },
  ];
  return (
    <section ref={ref} className="mx-auto max-w-[1440px] px-4 pb-28 sm:px-8 sm:pb-36">
      <SectionTitle title={t("realTitle")} lead={t("realLead")} />
      <div className="mt-16 grid gap-4 md:grid-cols-[1.4fr_1fr] md:grid-rows-2">
        {photos.map((p, i) => (
          <figure key={p.src} data-reveal className={`relative overflow-hidden bg-paper-3 ${i === 0 ? "aspect-[4/3] md:row-span-2 md:aspect-auto" : "aspect-[16/10]"}`}>
            <div data-parallax className="absolute -inset-y-[10%] inset-x-0">
              <Image src={p.src} alt={p.alt} fill sizes={i === 0 ? "(min-width: 768px) 58vw, 100vw" : "(min-width: 768px) 42vw, 100vw"} className="object-cover" />
            </div>
            <figcaption className="absolute bottom-0 left-0 bg-paper px-4 py-2.5 font-display text-[15px] font-semibold text-ink">
              <span className="mr-2 text-signal">{String(i + 1).padStart(2, "0")}</span>
              {p.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- industry stack
const STACK = [
  ["cplusplus", "C++20"],
  ["cmake", "CMake"],
  ["ros", "ROS 2"],
  ["webassembly", "WebAssembly"],
  ["docker", "Docker"],
  ["githubactions", "GitHub Actions"],
  ["threedotjs", "three.js"],
  ["typescript", "TypeScript"],
  ["nextdotjs", "Next.js"],
  ["vercel", "Vercel"],
  ["linux", "Linux"],
] as const;
const TEXT_ONLY = ["vcpkg", "GoogleTest", "Eigen", "fmt", "nlohmann/json", "Playwright", "MoveIt"];

export function StackSection() {
  const t = useTranslations("home");
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  const reduce = useReducedMotion();
  const items = [...STACK.map(([icon, name]) => ({ icon, name })), ...TEXT_ONLY.map((name) => ({ icon: null as string | null, name }))];
  return (
    <section ref={ref} className="border-y border-line bg-paper-2 py-24 sm:py-28">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <SectionTitle title={t("stackTitle")} lead={t("stackLead")} />
      </div>
      <div className="mt-14 overflow-hidden" aria-label="Technologies">
        <div className={`flex w-max gap-3 ${reduce ? "flex-wrap px-4" : "animate-marquee"}`}>
          {[...items, ...(reduce ? [] : items)].map((it, i) => (
            <span key={i} className="flex items-center gap-2.5 whitespace-nowrap rounded-xs bg-paper px-5 py-3.5 font-display text-lg font-semibold text-ink ring-1 ring-line" aria-hidden={i >= items.length}>
              {it.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/icons/${it.icon}.svg`} alt="" width={22} height={22} className="opacity-85" />
              )}
              {it.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- learn: topic cards with pointer tilt
function TiltCard({ children, href }: { children: ReactNode; href: string }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 250, damping: 20 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 250, damping: 20 });
  return (
    <motion.div
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 800 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width - 0.5);
        y.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => (x.set(0), y.set(0))}
    >
      <Link href={href} className="group block h-full bg-paper p-6 ring-1 ring-line transition-shadow hover:shadow-[0_18px_40px_-18px_rgba(20,20,20,0.35)] hover:ring-ink/25">
        {children}
      </Link>
    </motion.div>
  );
}

export function LearnSection() {
  const t = useTranslations("home");
  const td = useTranslations("docs");
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  // In reading order, so the chapter numbers form a real sequence.
  const featured = ["understanding-robotics", "ros2-and-moveit", "why-cpp", "stacking-rules", "extreme-points", "orders"];
  return (
    <section ref={ref} className="mx-auto max-w-[1440px] px-4 py-28 sm:px-8 sm:py-36">
      <SectionTitle title={t("learnTitle")} lead={t("learnLead")} />
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-reveal>
        {featured.map((slug) => {
          const n = DOCS.findIndex((d) => d.slug === slug) + 1;
          const doc = DOCS[n - 1];
          return (
            <TiltCard key={slug} href={`/docs/${slug}`}>
              <p className="flex items-center justify-between text-[13px] text-mute">
                <span>{td(`groups.${doc.group}`)}</span>
                <span className="font-display font-semibold text-signal">{String(n).padStart(2, "0")}</span>
              </p>
              <h3 className="mt-10 font-display text-2xl font-semibold leading-tight text-ink">{td(`pages.${slug}`)}</h3>
              <span className="mt-6 block h-[3px] w-10 bg-ink transition-all duration-500 group-hover:w-20 group-hover:bg-signal" />
            </TiltCard>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- inspired by Japanese robotics
export function InspiredSection() {
  const t = useTranslations("home");
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  return (
    <section ref={ref} className="relative overflow-hidden bg-signal text-ink">
      <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-4 py-24 sm:px-8 md:grid-cols-[auto_1fr] md:py-32">
        <p lang="ja" className="font-display text-[clamp(2.5rem,5.5vw,5.25rem)] font-bold leading-[1.05] [writing-mode:vertical-rl] max-md:[writing-mode:horizontal-tb]" aria-hidden data-reveal>
          日本の
          <br />
          ロボティクス
        </p>
        <div className="max-w-[40rem]" data-reveal>
          <h2 className="font-display text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.02em] [font-stretch:110%]">{t("inspiredTitle")}</h2>
          <p className="mt-6 text-lg leading-relaxed text-ink">{t("inspiredBody")}</p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- final call to action
export function FinalSection() {
  const t = useTranslations("home");
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  return (
    <section ref={ref} className="relative overflow-hidden">
      <Image src="/images/warehouse-pallets.jpg" alt="" fill sizes="100vw" className="object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/90 to-paper/30" aria-hidden />
      <div className="relative mx-auto max-w-[1440px] px-4 py-32 sm:px-8 sm:py-44">
        <div className="max-w-[44rem]" data-reveal>
          <h2 className="font-display text-[clamp(2.6rem,6vw,5.4rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-ink [font-stretch:115%]">{t("finalTitle")}</h2>
          <p className="mt-6 text-lg leading-relaxed text-ink-2">{t("finalLead")}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/docs" className="group inline-flex items-center gap-2.5 rounded-xs bg-signal px-6 py-3.5 text-[15px] font-medium text-ink transition-colors hover:bg-[#ff6f3c]">
              {t("ctaStart")}
              <ArrowRight />
            </Link>
            <Link href="/simulator/compare" className="rounded-xs bg-paper px-6 py-3.5 text-[15px] font-medium text-ink ring-1 ring-ink/20 hover:ring-ink/50">
              {t("ctaSimulator")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
