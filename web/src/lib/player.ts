// A tiny playback store shared by the 3D scene and the DOM controls.
//
// The 3D scene reads `step` and `t` every frame (no React re-render needed); the DOM subscribes
// through useSyncExternalStore and only re-renders when the step or play state changes, not 60×/s.
import { useEffect, useMemo, useSyncExternalStore } from "react";

export interface PlaybackSource {
  /** Boxes fully placed, and progress (0..1) of the box currently being placed. */
  read(): { step: number; t: number };
}

export interface PlayerSnapshot {
  step: number;
  total: number;
  playing: boolean;
  moving: boolean; // a box is mid-placement
  speed: number;
}

export class Player implements PlaybackSource {
  step = 0;
  t = 0;
  playing = false;
  speed = 2; // boxes per second
  private listeners = new Set<() => void>();
  private snap: PlayerSnapshot;
  private raf = 0;
  private last = 0;

  constructor(public total: number, private reducedMotion = false) {
    this.snap = this.makeSnap();
  }

  read() {
    return { step: this.step, t: this.t };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;

  private makeSnap(): PlayerSnapshot {
    return { step: this.step, total: this.total, playing: this.playing, moving: this.t > 0, speed: this.speed };
  }
  private emit() {
    const s = this.snap;
    if (s.step !== this.step || s.playing !== this.playing || s.moving !== this.t > 0 || s.total !== this.total || s.speed !== this.speed) {
      this.snap = this.makeSnap();
      this.listeners.forEach((l) => l());
    }
  }

  setTotal(total: number) {
    this.total = total;
    this.step = Math.min(this.step, total);
    this.t = 0;
    this.emit();
  }
  setSpeed(speed: number) {
    this.speed = speed;
    this.emit();
  }
  jumpTo(step: number) {
    this.step = Math.max(0, Math.min(this.total, step));
    this.t = 0;
    this.emit();
  }
  play() {
    if (this.step >= this.total) this.jumpTo(0);
    this.playing = true;
    this.emit();
    this.loop();
  }
  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.emit();
  }
  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }
  forward() {
    this.pause();
    this.jumpTo(this.step + 1);
  }
  back() {
    this.pause();
    this.jumpTo(this.t > 0 ? this.step : this.step - 1);
  }

  private loop = () => {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (!this.playing) return;
      if (this.step >= this.total) {
        this.pause();
        return;
      }
      if (this.reducedMotion) {
        this.step++;
      } else {
        this.t += dt * this.speed;
        if (this.t >= 1) {
          this.step++;
          this.t = 0;
        }
      }
      this.emit();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.listeners.clear();
  }
}

export function usePlayer(total: number, opts: { autoplay?: boolean; speed?: number } = {}) {
  const player = useMemo(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const p = new Player(total, reduced);
    if (opts.speed) p.speed = opts.speed;
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    player.setTotal(total);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (opts.autoplay && !reduced) player.play();
    else player.jumpTo(total);
    return () => player.pause();
  }, [player, total, opts.autoplay]);
  useEffect(() => () => player.dispose(), [player]);
  const snapshot = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);
  return { player, snapshot };
}

/** A fixed source, e.g. "show the finished pallet". */
export const staticSource = (step: number, t = 0): PlaybackSource => ({ read: () => ({ step, t }) });
