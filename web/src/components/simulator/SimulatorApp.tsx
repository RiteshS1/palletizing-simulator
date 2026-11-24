"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Studio } from "@/components/three/Studio";
import { CompareStations, OrderStations, PlanStation } from "@/components/three/scenes";
import type { Overlays } from "@/components/three/PalletStation";
import { Link } from "@/i18n/navigation";
import { getEngine } from "@/lib/engine";
import { formatClock, kraft, liveStats, orderColor, type Plan, type Placement, type WesPlan } from "@/lib/plan";
import { usePlayer, type Player, type PlayerSnapshot } from "@/lib/player";
import { SIM_MODES, type SimMode } from "@/lib/simModes";
import { fetchPlans, type Plans } from "@/lib/usePlans";


export function SimulatorApp({ mode }: { mode: SimMode }) {
  const [plans, setPlans] = useState<Plans | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchPlans().then(setPlans, (e: Error) => setError(e.message));
  }, []);
  if (error) return <p className="p-8 text-mute">{error}</p>;
  if (!plans) return <div className="h-[calc(100dvh-4rem)] animate-pulse bg-paper-2" />;
  return <Simulator mode={mode} initial={plans} />;
}

function Simulator({ mode, initial }: { mode: SimMode; initial: Plans }) {
  const t = useTranslations("sim");
  const [plans, setPlans] = useState<Plans>(initial);
  const [overlays, setOverlays] = useState<Overlays>({ com: true, candidates: mode === "extreme-points", support: false });

  const primary: Plan = mode === "greedy" ? plans.greedy : plans.ep;
  const total =
    mode === "orders"
      ? plans.wes.metrics.boxes
      : mode === "compare"
        ? Math.max(plans.greedy.placements.length, plans.ep.placements.length)
        : primary.placements.length;
  const { player, snapshot } = usePlayer(total, { autoplay: true, speed: mode === "orders" ? 6 : 2 });

  useKeyboard(player);
  useTestHook(snapshot, mode, plans);

  const camera: [number, number, number] = mode === "orders" ? [6.4, 5.4, 7.6] : mode === "compare" ? [3.4, 2.7, 4.6] : [2.7, 2.2, 3.3];

  return (
    <div className="grid min-h-[calc(100dvh-4rem)] grid-cols-[minmax(0,1fr)] lg:h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="relative flex min-h-[70vh] min-w-0 flex-col lg:min-h-0" aria-label={t("title")}>
        <ModeTabs mode={mode} />
        <div className="relative min-h-0 flex-1">
          <Studio camera={camera} target={[0, mode === "orders" ? 0.5 : 0.85, 0]} env={mode === "orders" ? "warehouse" : "studio"} quality="high" background="#ecebe6">
            {mode === "greedy" && <PlanStation plan={plans.greedy} source={player} overlays={overlays} interactive />}
            {mode === "extreme-points" && <PlanStation plan={plans.ep} source={player} overlays={overlays} interactive />}
            {mode === "compare" && <CompareStations greedy={plans.greedy} ep={plans.ep} source={player} overlays={{ com: overlays.com }} />}
            {mode === "orders" && <OrderStations wes={plans.wes} source={player} />}
          </Studio>
        </div>
        <Dock player={player} snapshot={snapshot} mode={mode} plans={plans} />
      </section>

      <aside className="space-y-0 overflow-y-auto border-l border-line bg-paper px-5 pb-28 text-[14px] lg:h-full">
        {mode === "orders" ? (
          <>
            <OrdersLive wes={plans.wes} step={snapshot.step} moving={snapshot.moving} />
            <OrdersFinished wes={plans.wes} />
            <OrderQueue wes={plans.wes} step={snapshot.step} moving={snapshot.moving} />
          </>
        ) : (
          <>
            <PlacingNow plans={mode === "compare" ? [plans.greedy, plans.ep] : [primary]} snapshot={snapshot} />
            <LiveStats plans={mode === "compare" ? [plans.greedy, plans.ep] : [primary]} step={snapshot.step} />
            {mode !== "compare" && <OverlayToggles overlays={overlays} setOverlays={setOverlays} ep={mode === "extreme-points"} />}
            <Finished plans={mode === "compare" ? [plans.greedy, plans.ep] : [primary]} />
          </>
        )}
        <TryOther mode={mode} onPlans={(p) => setPlans((old) => ({ ...old, ...p }))} />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- top tabs
function ModeTabs({ mode }: { mode: SimMode }) {
  const t = useTranslations("sim");
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-line bg-paper px-4 py-2 sm:px-6" role="tablist">
      {SIM_MODES.map((m) => (
        <Link
          key={m}
          href={`/simulator/${m}`}
          role="tab"
          aria-selected={m === mode}
          className={`rounded-xs px-3 py-1.5 text-sm font-medium transition-colors ${m === mode ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2 hover:text-ink"}`}
        >
          {t(`modes.${m}`)}
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- bottom dock
function Dock({ player, snapshot, mode, plans }: { player: Player; snapshot: PlayerSnapshot; mode: SimMode; plans: Plans }) {
  const t = useTranslations("sim");
  const sequence = useMemo(() => {
    if (mode === "orders") {
      return plans.wes.pallets
        .flatMap((p) => p.placements)
        .sort((a, b) => a.step - b.step)
        .map((p) => ({ h: p.sz, color: orderColor(p.orderId ?? 0) }));
    }
    const plan = mode === "greedy" ? plans.greedy : mode === "compare" ? (plans.ep.placements.length >= plans.greedy.placements.length ? plans.ep : plans.greedy) : plans.ep;
    const w = plan.boxes.map((b) => b.weight);
    const min = Math.min(...w), max = Math.max(...w);
    return plan.placements.map((p) => ({ h: p.sz, color: kraft(p.weight, min, max) }));
  }, [mode, plans]);
  const current = snapshot.moving ? snapshot.step : snapshot.step - 1;

  return (
    <div className="grid gap-3 border-t border-line bg-paper px-4 pb-4 pt-3 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="flex items-baseline gap-2" aria-live="polite">
          <span className="font-display text-4xl font-semibold leading-none tabular-nums [font-stretch:105%]" data-testid="step-now">
            {String(snapshot.step).padStart(2, "0")}
          </span>
          <span className="text-mute">
            {t("of", { total: snapshot.total })} {t("boxesPlaced")}
          </span>
        </p>
        <div className="flex items-center gap-1.5">
          <IconButton label={t("restart")} onClick={() => (player.pause(), player.jumpTo(0))} path="M5 4v12M16 4 8 10l8 6z" />
          <IconButton label={t("back")} onClick={() => player.back()} path="M14 4 6 10l8 6z" />
          <button
            type="button"
            onClick={() => player.toggle()}
            aria-label={snapshot.playing ? t("pause") : t("play")}
            data-testid="play"
            className="grid h-10 w-14 place-items-center rounded-xs bg-signal text-ink transition-colors hover:bg-[#ff6f3c]"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden>
              <path d={snapshot.playing ? "M5 4h4v12H5zM11 4h4v12h-4z" : "M6 4l10 6-10 6z"} />
            </svg>
          </button>
          <IconButton label={t("forward")} onClick={() => player.forward()} path="M6 4l8 6-8 6z" testid="forward" />
          <IconButton label={t("end")} onClick={() => (player.pause(), player.jumpTo(player.total))} path="M15 4v12M4 4l8 6-8 6z" testid="end" />
          <label className="ml-2 flex items-center gap-1.5 text-mute">
            <span className="hidden sm:inline">{t("speed")}</span>
            <select
              value={snapshot.speed}
              onChange={(e) => player.setSpeed(Number(e.target.value))}
              aria-label={t("speed")}
              className="rounded-xs border border-line bg-paper px-1.5 py-1.5 text-ink"
            >
              {[1, 2, 4, 8, 16].map((n) => (
                <option key={n} value={n}>
                  {t("perSecond", { n })}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {/* the conveyor: one carton per placement, height = box height, colour = weight (or order) */}
      {/* scrolls sideways on its own when a long shift doesn't fit (never widens the page) */}
      <div className="relative flex h-12 min-w-0 items-end gap-[2px] overflow-x-auto pb-2 [scrollbar-width:thin]" role="group" aria-label={t("conveyor")}>
        <div className="pointer-events-none absolute bottom-0 left-0 h-1.5 w-full min-w-full rounded-full bg-ink [background-image:radial-gradient(circle_at_4px_3px,#8a8f96_1.5px,transparent_2px)] [background-size:12px_6px]" />
        {sequence.map((s, i) => (
          <button
            key={i}
            type="button"
            title={`#${i + 1}`}
            aria-label={`${i + 1}`}
            onClick={() => (player.pause(), player.jumpTo(i + 1))}
            className={`min-w-[2px] max-w-[26px] flex-1 shrink-0 rounded-[1px] transition-opacity ${i < snapshot.step ? "opacity-100" : "opacity-30 hover:opacity-70"} ${i === current ? "outline outline-2 outline-offset-1 outline-signal" : ""}`}
            style={{ background: s.color, height: `${8 + ((s.h - 150) / 250) * 28}px` }}
          />
        ))}
      </div>
    </div>
  );
}

function IconButton({ label, onClick, path, testid }: { label: string; onClick: () => void; path: string; testid?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testid}
      className="grid h-10 w-10 place-items-center rounded-xs border border-line bg-paper text-ink transition-colors hover:border-ink/40"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current stroke-current [stroke-width:1.6] [stroke-linejoin:round]" aria-hidden>
        <path d={path} />
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------- side panel blocks
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line py-4 last:border-b-0">
      <h2 className="mb-2.5 font-display text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ head, rows, better }: { head?: string[]; rows: (string | number)[][]; better?: number[] }) {
  return (
    <table className="w-full text-[13.5px] tabular-nums">
      {head && (
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} className={`pb-1 text-[12px] font-semibold text-ink ${i ? "text-right" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-line/60 first:border-t-0">
            {r.map((c, j) => (
              <td key={j} className={`py-1.5 ${j ? "text-right text-ink" : "text-mute"} ${better?.[i] === j ? "font-semibold" : ""}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const ALGO = (p: Plan) => (p.algorithm === "greedy_layer" ? "greedy" : "extreme-points");

function PlacingNow({ plans, snapshot }: { plans: Plan[]; snapshot: PlayerSnapshot }) {
  const t = useTranslations("sim");
  const f = useFormatter();
  const idx = snapshot.moving ? snapshot.step : snapshot.step - 1;
  const items = plans.map((p) => p.placements[idx]).filter(Boolean) as Placement[];
  return (
    <Block title={t("placingNow")}>
      {items.length === 0 && <p className="text-mute">{t("emptyPallet")}</p>}
      {items.map((it, i) => (
        <dl key={i} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-dashed border-line pt-2 first-of-type:border-0 first-of-type:pt-0 [&+dl]:mt-3">
          <dt className="col-span-2 font-semibold text-ink">
            {t("box", { id: it.id })}
            {plans.length > 1 && <span className="font-normal text-mute"> · {t(`modes.${ALGO(plans[i])}`)}</span>}
          </dt>
          <dt className="text-mute">{t("size")}</dt>
          <dd>
            {it.sx} × {it.sy} × {it.sz} mm
          </dd>
          <dt className="text-mute">{t("weight")}</dt>
          <dd>{f.number(it.weight, { maximumFractionDigits: 1 })} kg</dd>
          <dt className="text-mute">{t("goesTo")}</dt>
          <dd>
            x {it.x}, y {it.y}, z {it.z} mm
          </dd>
          <dt className="text-mute">{t("turned")}</dt>
          <dd>{it.rotated ? t("yes") : t("no")}</dd>
          {it.placePose && (
            <>
              <dt className="text-mute">{t("toolPose")}</dt>
              <dd className="font-mono text-[12px]">
                [{it.placePose.position.map((v) => v.toFixed(3)).join(", ")}] m
              </dd>
            </>
          )}
        </dl>
      ))}
    </Block>
  );
}

function LiveStats({ plans, step }: { plans: Plan[]; step: number }) {
  const t = useTranslations("sim");
  const f = useFormatter();
  const stats = plans.map((p) => liveStats(p.placements, step, p.pallet));
  return (
    <Block title={t("onPallet")}>
      <Rows
        head={plans.length > 1 ? ["", ...plans.map((p) => t(`modes.${ALGO(p)}`))] : undefined}
        rows={[
          [t("boxesPlacedRow"), ...stats.map((s) => s.placed)],
          [t("stackHeight"), ...stats.map((s) => `${f.number(s.height)} mm`)],
          [t("totalWeight"), ...stats.map((s) => `${f.number(s.weight, { maximumFractionDigits: 1 })} kg`)],
          [t("comOffset"), ...stats.map((s) => `${f.number(Math.round(s.comOffset))} mm`)],
        ]}
      />
    </Block>
  );
}

function OverlayToggles({ overlays, setOverlays, ep }: { overlays: Overlays; setOverlays: (o: Overlays) => void; ep: boolean }) {
  const t = useTranslations("sim");
  const items: [keyof Overlays, string][] = [
    ["com", t("showCom")],
    ["support", t("showSupport")],
    ...(ep ? ([["candidates", t("showCandidates")]] as [keyof Overlays, string][]) : []),
  ];
  return (
    <Block title={t("layers")}>
      <div className="flex flex-wrap gap-2">
        {items.map(([k, label]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xs border border-line px-2.5 py-1.5 has-[:checked]:border-probe has-[:checked]:bg-probe/5">
            <input type="checkbox" className="accent-[#2b59c3]" checked={!!overlays[k]} onChange={(e) => setOverlays({ ...overlays, [k]: e.target.checked })} />
            {label}
          </label>
        ))}
      </div>
    </Block>
  );
}

function Finished({ plans }: { plans: Plan[] }) {
  const t = useTranslations("sim");
  const f = useFormatter();
  const m = plans.map((p) => p.metrics);
  const pct = (x: number) => f.number(x, { style: "percent", maximumFractionDigits: 1 });
  let better: number[] | undefined;
  if (m.length === 2) {
    const pick = (a: number, b: number, higher: boolean) => (a === b ? -1 : a > b === higher ? 1 : 2);
    better = [pick(m[0].placed, m[1].placed, true), pick(m[0].fillOfMax, m[1].fillOfMax, true), pick(m[0].density, m[1].density, true), -1, pick(m[0].comOffset, m[1].comOffset, false), pick(m[0].runtimeMs, m[1].runtimeMs, false)];
  }
  return (
    <Block title={plans.length > 1 ? t("finishedPlans") : t("finished")}>
      <Rows
        head={plans.length > 1 ? ["", ...plans.map((p) => t(`modes.${ALGO(p)}`))] : undefined}
        better={better}
        rows={[
          [t("boxesPlacedRow"), ...m.map((x) => `${x.placed}/${x.offered}`)],
          [t("palletFilled"), ...m.map((x) => pct(x.fillOfMax))],
          [t("density"), ...m.map((x) => pct(x.density))],
          [t("stackHeight"), ...m.map((x) => `${f.number(x.height)} mm`)],
          [t("comOffset"), ...m.map((x) => `${f.number(Math.round(x.comOffset))} mm`)],
          [t("planningTime"), ...m.map((x) => `${f.number(x.runtimeMs, { maximumFractionDigits: 2 })} ms`)],
        ]}
      />
    </Block>
  );
}

function OrdersLive({ wes, step, moving }: { wes: WesPlan; step: number; moving: boolean }) {
  const t = useTranslations("sim");
  const all = useMemo(() => wes.pallets.flatMap((p) => p.placements), [wes]);
  const clock = all.reduce((c, p) => (p.step < step ? Math.max(c, p.time ?? 0) : c), 0);
  const finished = wes.orders.filter((o) => o.status === "done" && o.lastStep < step).length;
  const started = wes.pallets.filter((p) => p.placements.some((pl) => pl.step < step || (moving && pl.step === step))).length;
  const shipped = wes.pallets.filter((p) => p.closedAfterStep >= 0 && step >= p.closedAfterStep).length;
  return (
    <Block title={t("onPallet")}>
      <Rows
        rows={[
          [t("boxesPlacedRow"), step],
          [t("ordersFinished"), `${finished}/${wes.orders.length}`],
          [t("palletsStarted"), `${started} (${shipped} ${t("shipped")})`],
          [t("shiftClock"), formatClock(clock)],
        ]}
      />
    </Block>
  );
}

function OrdersFinished({ wes }: { wes: WesPlan }) {
  const t = useTranslations("sim");
  const f = useFormatter();
  const m = wes.metrics;
  return (
    <Block title={t("shift")}>
      <Rows
        rows={[
          [t("ordersPacked"), `${m.orders - m.rejected}/${m.orders}`],
          [t("palletsUsed"), m.pallets],
          [t("averageFill"), f.number(m.avgFill, { style: "percent", maximumFractionDigits: 1 })],
          [t("lateOrders"), m.lateOrders],
          [t("shiftLength"), formatClock(m.makespanS)],
          [t("throughput"), t("perHour", { n: f.number(Math.round(m.boxesPerHour)) })],
        ]}
      />
    </Block>
  );
}

function OrderQueue({ wes, step, moving }: { wes: WesPlan; step: number; moving: boolean }) {
  const t = useTranslations("sim");
  const current = moving ? step : step - 1;
  const orders = useMemo(() => [...wes.orders].sort((a, b) => a.processed - b.processed), [wes]);
  return (
    <Block title={t("orderQueue")}>
      <p className="mb-3 text-[12.5px] text-mute">{t("orderQueueHint")}</p>
      <ol className="space-y-1" data-testid="order-queue">
        {orders.map((o) => {
          const done = o.status === "done" && o.lastStep < step;
          const placing = o.firstStep <= current && current <= o.lastStep;
          const status = o.status === "rejected" ? t("late") : done ? (o.late ? t("late") : t("done")) : placing ? t("placing") : t("waiting");
          return (
            <li key={o.id} className={`grid grid-cols-[10px_1fr_auto] items-center gap-2.5 rounded-xs px-1.5 py-1 ${placing ? "bg-peach-soft ring-1 ring-signal/40" : ""}`}>
              <span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: orderColor(o.id) }} />
              <span className="leading-tight">
                {t("order", { id: o.id })} <span className="text-mute">{t("for", { destination: o.destination })}</span>
                <br />
                <span className="text-[12px] text-mute">
                  {t("priority", { p: o.priority })} · {o.boxes} · {t("due", { time: formatClock(o.deadline) })}
                </span>
              </span>
              <span
                data-status={done ? "done" : placing ? "placing" : "waiting"}
                className={`whitespace-nowrap rounded-xs border px-1.5 py-0.5 text-[11.5px] ${done ? "border-ink text-ink" : placing ? "border-signal bg-signal text-ink" : "border-line text-mute"}`}
              >
                {status}
              </span>
            </li>
          );
        })}
      </ol>
    </Block>
  );
}

// ---------------------------------------------------------------- live planning (WASM in a worker)
function TryOther({ mode, onPlans }: { mode: SimMode; onPlans: (p: Partial<Plans>) => void }) {
  const t = useTranslations("sim");
  const f = useFormatter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    getEngine().ready.then(setReady);
  }, []);

  const submit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      const seed = Math.max(1, Number(data.get("seed")) || 1);
      setBusy(true);
      const t0 = performance.now();
      try {
        const engine = getEngine();
        if (mode === "orders") {
          const wes = await engine.wes(Math.min(60, Math.max(3, Number(data.get("orders")) || 24)), seed);
          onPlans({ wes });
        } else {
          const n = Math.min(120, Math.max(5, Number(data.get("n")) || 40));
          const support = Math.min(100, Math.max(30, Number(data.get("support")) || 75)) / 100;
          const [greedy, ep] = await Promise.all([engine.pack("greedy", n, seed, support), engine.pack("ep", n, seed, support)]);
          onPlans({ greedy, ep });
        }
        setStatus(t("packedIn", { ms: f.number(performance.now() - t0, { maximumFractionDigits: 0 }) }));
      } catch (err) {
        setStatus(t("failed", { message: (err as Error).message }));
      } finally {
        setBusy(false);
      }
    },
    [mode, onPlans, t, f],
  );

  return (
    <Block title={t("tryOther")}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-x-3 gap-y-2.5" data-testid="try-other">
        {mode === "orders" ? (
          <Field label={t("orders")} name="orders" defaultValue={24} min={3} max={60} />
        ) : (
          <Field label={t("boxes")} name="n" defaultValue={40} min={5} max={120} />
        )}
        <Field label={t("seed")} name="seed" defaultValue={42} min={1} max={999999} />
        {mode !== "orders" && <Field label={t("minSupport")} name="support" defaultValue={75} min={30} max={100} step={5} />}
        <button
          type="submit"
          disabled={!ready || busy}
          className="col-span-2 rounded-xs bg-ink px-3 py-2 font-medium text-paper transition-colors hover:bg-ink-2 disabled:bg-paper-3 disabled:text-mute"
        >
          {mode === "orders" ? t("runOrders") : t("pack")}
        </button>
      </form>
      <p className="mt-2.5 text-[12.5px] text-mute" data-testid="engine-status">
        {status || (ready === null ? t("engineLoading") : ready ? t("engineReady") : t("engineMissing"))}
      </p>
    </Block>
  );
}

function Field({ label, name, defaultValue, min, max, step = 1 }: { label: string; name: string; defaultValue: number; min: number; max: number; step?: number }) {
  return (
    <label className="grid gap-1 text-[12.5px] text-mute">
      {label}
      <input type="number" name={name} defaultValue={defaultValue} min={min} max={max} step={step} className="w-full rounded-xs border border-line bg-white px-2 py-1.5 text-[14px] text-ink" />
    </label>
  );
}

// ---------------------------------------------------------------- keyboard + test hook
function useKeyboard(player: Player) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, select, textarea, button, a")) return;
      if (e.key === " ") {
        e.preventDefault();
        player.toggle();
      } else if (e.key === "ArrowRight") player.forward();
      else if (e.key === "ArrowLeft") player.back();
      else if (e.key === "Home") {
        player.pause();
        player.jumpTo(0);
      } else if (e.key === "End") {
        player.pause();
        player.jumpTo(player.total);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player]);
}

declare global {
  interface Window {
    __palletlab?: { snapshot: () => PlayerSnapshot & { mode: SimMode }; plans: () => Plans; engine: typeof getEngine };
  }
}

// A small window into the app for end-to-end tests.
function useTestHook(snapshot: PlayerSnapshot, mode: SimMode, plans: Plans) {
  useEffect(() => {
    window.__palletlab = { snapshot: () => ({ ...snapshot, mode }), plans: () => plans, engine: getEngine };
  }, [snapshot, mode, plans]);
}
