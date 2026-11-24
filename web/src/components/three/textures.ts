// Procedural textures drawn on a <canvas> once and shared: no image files, no model files.
// Each returns a THREE.CanvasTexture in sRGB, so the material colour tints it (kraft shades).
import * as THREE from "three";

let cache: Record<string, THREE.Texture> = {};

function make(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (cache[key]) return cache[key];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache[key] = tex;
  return tex;
}

// Seeded noise so every visit looks identical (and SSR/CSR never disagree).
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Corrugated cardboard: near-white base (tinted by material colour), flute lines, fibres, worn edges. */
export function cardboardTexture() {
  return make("cardboard", 512, 512, (ctx) => {
    const r = rng(7);
    ctx.fillStyle = "#f3f0ea";
    ctx.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 5) {
      ctx.fillStyle = `rgba(120, 90, 50, ${0.035 + r() * 0.03})`;
      ctx.fillRect(x, 0, 2, 512);
    }
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(90, 60, 30, ${r() * 0.08})`;
      ctx.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1);
    }
    const g = ctx.createRadialGradient(256, 256, 160, 256, 256, 380);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(70,45,20,0.16)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  });
}

/** Shipping label: barcode, "this side up" arrows and a part number. */
export function labelTexture() {
  return make("label", 512, 320, (ctx) => {
    const r = rng(42);
    ctx.fillStyle = "#fbfbf8";
    ctx.fillRect(0, 0, 512, 320);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 300);
    let x = 34;
    while (x < 330) {
      const w = 2 + Math.floor(r() * 7);
      ctx.fillStyle = "#141414";
      ctx.fillRect(x, 40, w, 150);
      x += w + 2 + Math.floor(r() * 5);
    }
    ctx.fillStyle = "#141414";
    ctx.font = "600 34px ui-monospace, monospace";
    ctx.fillText("PL-0042-JP", 34, 238);
    ctx.font = "500 24px ui-sans-serif, system-ui";
    ctx.fillText("THIS SIDE UP", 34, 282);
    for (const ax of [380, 440]) {
      ctx.beginPath();
      ctx.moveTo(ax, 60);
      ctx.lineTo(ax + 30, 110);
      ctx.lineTo(ax + 12, 110);
      ctx.lineTo(ax + 12, 180);
      ctx.lineTo(ax - 12, 180);
      ctx.lineTo(ax - 12, 110);
      ctx.lineTo(ax - 30, 110);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#ff5a1f";
    ctx.fillRect(360, 210, 120, 80);
  });
}

/** Pine boards: warm base with grain streaks and a few knots. */
export function woodTexture() {
  return make("wood", 1024, 128, (ctx) => {
    const r = rng(3);
    ctx.fillStyle = "#d4b483";
    ctx.fillRect(0, 0, 1024, 128);
    for (let i = 0; i < 70; i++) {
      const y = r() * 128;
      ctx.strokeStyle = `rgba(120, 80, 40, ${0.08 + r() * 0.14})`;
      ctx.lineWidth = 1 + r() * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 64) ctx.lineTo(x, y + Math.sin(x / 90 + i) * 3);
      ctx.stroke();
    }
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = "rgba(110, 70, 35, 0.35)";
      ctx.beginPath();
      ctx.ellipse(r() * 1024, r() * 128, 10 + r() * 8, 5 + r() * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function resetTextureCache() {
  Object.values(cache).forEach((t) => t.dispose());
  cache = {};
}
