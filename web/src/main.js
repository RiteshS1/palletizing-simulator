// Viewer app: loads plans produced by the C++ planner and replays them box by box.
//
// A plan is just an ordered list of placements, so "replaying" means: after `step` boxes, show
// placements[0..step). The box being placed animates for 1/speed seconds (t goes 0 -> 1).

import * as THREE from 'three';
import { createStage, PalletView } from './scene.js';
import { loadEngine } from './wasm.js';

const KRAFT_LIGHT = new THREE.Color('#e2c79f');
const KRAFT_DARK = new THREE.Color('#8c5a2b');
const ORDER_COLORS = ['#4f7cac', '#9c5d8f', '#4e9a7a', '#c46b48', '#6b6fb8', '#8a9a3e', '#3e8fa5', '#b0567a'];
const ALGO_NAMES = { greedy_layer: 'Greedy layer', extreme_points: 'Extreme points' };
const MODES = ['greedy', 'ep', 'compare', 'orders'];

const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (n, digits = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const pct = (x) => `${fmt(x * 100, 1)}%`;
const clock = (s) => {
  const t = Math.round(s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const state = {
  plans: { greedy: null, ep: null, wes: null },
  mode: 'ep',
  step: 0, // boxes fully placed
  t: 0, // progress (0..1) of the box currently being placed; 0 = none in motion
  playing: false,
  speed: 2, // boxes per second
  total: 0,
  views: [],
  sequence: [], // one entry per placement step, for the conveyor strip
  showCom: true,
  engine: null,
};

const stage = createStage($('stage'));

// ---------- colours ----------
function kraftScale(weights) {
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  return {
    min,
    max,
    color: (w) => '#' + KRAFT_LIGHT.clone().lerp(KRAFT_DARK, max > min ? (w - min) / (max - min) : 0.5).getHexString(),
  };
}
const orderColor = (orderId) => ORDER_COLORS[orderId % ORDER_COLORS.length];

// ---------- building the scene for a mode ----------
function buildViews() {
  for (const v of state.views) v.dispose();
  state.views = [];
  const { greedy, ep, wes } = state.plans;

  if (state.mode === 'orders') {
    const n = wes.pallets.length;
    const cols = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(n * 1.6))));
    const rows = Math.ceil(n / cols);
    wes.pallets.forEach((p, i) => {
      const items = p.placements.map((pl) => ({ ...pl, color: orderColor(pl.orderId) }));
      const view = new PalletView({ pallet: wes.pallet, items, label: `Pallet ${p.id + 1}`, sublabel: p.destination, labelAt: 'front' });
      view.meta = p;
      const r = Math.floor(i / cols);
      const c = i % cols;
      view.root.position.set((c - (cols - 1) / 2) * 1.75, 0, (r - (rows - 1) / 2) * 1.7);
      stage.scene.add(view.root);
      state.views.push(view);
    });
    const all = wes.pallets.flatMap((p) => p.placements).sort((a, b) => a.step - b.step);
    state.sequence = all.map((pl) => ({ h: pl.sz, color: orderColor(pl.orderId) }));
    state.unplacedCount = 0;
    state.total = all.length;
  } else {
    const plans = state.mode === 'compare' ? [greedy, ep] : [state.mode === 'greedy' ? greedy : ep];
    const scale = kraftScale(plans.flatMap((p) => p.boxes.map((b) => b.weight)));
    state.kraft = scale;
    plans.forEach((plan, i) => {
      const items = plan.placements.map((pl) => ({ ...pl, color: scale.color(pl.weight) }));
      const label = plans.length > 1 ? ALGO_NAMES[plan.algorithm] : null;
      const view = new PalletView({ pallet: plan.pallet, items, label, sublabel: label ? `${plan.placements.length} of ${plan.boxes.length} boxes` : null });
      view.plan = plan;
      if (plans.length > 1) view.root.position.x = (i - 0.5) * 1.8;
      stage.scene.add(view.root);
      state.views.push(view);
    });
    // The strip follows the plan with the most placements.
    const primary = plans.reduce((a, b) => (b.placements.length > a.placements.length ? b : a));
    state.sequence = primary.placements.map((pl) => ({ h: pl.sz, color: scale.color(pl.weight) }));
    state.unplacedCount = plans.length === 1 ? primary.unplaced.length : 0;
    state.total = Math.max(...plans.map((p) => p.placements.length));
  }

  stage.frame(state.views);
  buildStrip();
  renderFinal();
  renderLegend();
  renderOrdersSkeleton();
  lastPanelKey = '';
}

// ---------- the conveyor strip ----------
function buildStrip() {
  const strip = $('strip');
  strip.replaceChildren();
  state.sequence.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'carton';
    b.style.setProperty('--c', s.color);
    b.style.height = `${10 + ((s.h - 150) / 250) * 32}px`;
    b.title = `Box ${i + 1}: ${s.h} mm tall`;
    b.setAttribute('aria-label', `Jump to box ${i + 1}`);
    b.addEventListener('click', () => jumpTo(i + 1));
    strip.appendChild(b);
  });
  for (let i = 0; i < state.unplacedCount; i++) {
    const u = document.createElement('span');
    u.className = 'carton unplaced';
    u.style.height = '18px';
    u.title = 'Did not fit on the pallet';
    strip.appendChild(u);
  }
}

// ---------- side panel ----------
function boxDetails(item, view) {
  const dl = document.createElement('dl');
  dl.className = 'now-box';
  const title = document.createElement('dt');
  title.className = 'title';
  const sw = document.createElement('span');
  sw.className = 'swatch';
  sw.style.setProperty('--c', item.color);
  title.append(sw, `Box ${item.id}`);
  if (view.plan && state.mode === 'compare') title.append(` (${ALGO_NAMES[view.plan.algorithm]})`);
  dl.appendChild(title);
  const rows = [
    ['Size', `${item.sx} × ${item.sy} × ${item.sz} mm`],
    ['Weight', `${fmt(item.weight, 1)} kg`],
    ['Goes to', `x ${item.x}, y ${item.y}, z ${item.z} mm`],
    ['Turned', item.rotated ? 'Yes, 90° about the vertical axis' : 'No'],
  ];
  if (state.mode === 'orders') {
    const order = state.plans.wes.orders.find((o) => o.id === item.orderId);
    rows.unshift(['Order', `#${item.orderId} for ${order.destination}`], ['Pallet', `${view.meta.id + 1}`]);
  }
  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  return dl;
}

function table(el, header, rows, better) {
  el.replaceChildren();
  if (header) {
    const thead = el.createTHead().insertRow();
    for (const h of header) {
      const th = document.createElement('th');
      th.textContent = h;
      thead.appendChild(th);
    }
  }
  const body = el.createTBody();
  rows.forEach((row, r) => {
    const tr = body.insertRow();
    row.forEach((cell, c) => {
      const td = tr.insertCell();
      td.textContent = cell;
      if (better && better[r] === c) td.classList.add('better');
    });
  });
}

let lastPanelKey = '';
function updatePanel(live) {
  const key = `${state.mode}:${state.step}:${state.t > 0}:${state.showCom}`;
  if (key === lastPanelKey) return;
  lastPanelKey = key;

  $('step-now').textContent = state.step;
  $('step-total').textContent = state.total;
  const cartons = $('strip').children;
  const current = state.t > 0 ? state.step : state.step - 1;
  for (let i = 0; i < state.sequence.length; i++) {
    cartons[i].classList.toggle('placed', i < state.step);
    cartons[i].classList.toggle('current', i === current);
  }

  // Placing now: the box in motion, or else the last one placed.
  const now = $('now');
  now.replaceChildren();
  state.views.forEach((v, i) => {
    const it = live[i].active || live[i].last;
    if (it && (state.mode !== 'orders' || it === live[i].active || it.step === current)) now.appendChild(boxDetails(it, v));
  });
  if (!now.children.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'The pallet is empty. Press play or the right arrow key to place the first box.';
    now.appendChild(p);
  }

  if (state.mode === 'orders') {
    updateOrders(live);
  } else {
    const cols = state.views.map((v) => ALGO_NAMES[v.plan.algorithm]);
    const rows = [
      ['Boxes', ...live.map((l) => fmt(l.placed))],
      ['Stack height', ...live.map((l) => `${fmt(l.height)} mm`)],
      ['Weight', ...live.map((l) => `${fmt(l.weight, 1)} kg`)],
      ['Center of mass off-center', ...live.map((l) => `${fmt(l.comOffset)} mm`)],
    ];
    table($('live'), state.views.length > 1 ? ['', ...cols] : null, rows);
  }
}

function renderFinal() {
  if (state.mode === 'orders') {
    const m = state.plans.wes.metrics;
    $('final-title').textContent = 'Finished shift';
    table($('final'), null, [
      ['Orders packed', `${fmt(m.orders - m.rejected)} of ${fmt(m.orders)}`],
      ['Pallets used', fmt(m.pallets)],
      ['Average pallet fill', pct(m.avgFill)],
      ['Orders finished late', fmt(m.lateOrders)],
      ['Shift length', clock(m.makespanS)],
      ['Throughput', `${fmt(m.boxesPerHour)} boxes/h`],
    ]);
    return;
  }
  $('final-title').textContent = state.views.length > 1 ? 'Finished plans' : 'Finished plan';
  const ms = state.views.map((v) => v.plan.metrics);
  const rows = [
    ['Boxes placed', ...ms.map((m) => `${m.placed} of ${m.offered}`)],
    ['Pallet filled', ...ms.map((m) => pct(m.fillOfMax))],
    ['Density', ...ms.map((m) => pct(m.density))],
    ['Stack height', ...ms.map((m) => `${fmt(m.height)} mm`)],
    ['Center of mass off-center', ...ms.map((m) => `${fmt(m.comOffset)} mm`)],
    ['Planning time', ...ms.map((m) => `${fmt(m.runtimeMs, 2)} ms`)],
  ];
  let better = null;
  if (ms.length === 2) {
    // column index (1 or 2) of the better value per row; -1 for a tie
    const pick = (a, b, higher) => (a === b ? -1 : (a > b) === higher ? 1 : 2);
    better = [
      pick(ms[0].placed, ms[1].placed, true),
      pick(ms[0].fillOfMax, ms[1].fillOfMax, true),
      pick(ms[0].density, ms[1].density, true),
      -1,
      pick(ms[0].comOffset, ms[1].comOffset, false),
      pick(ms[0].runtimeMs, ms[1].runtimeMs, false),
    ];
  }
  table($('final'), ms.length > 1 ? ['', ...state.views.map((v) => ALGO_NAMES[v.plan.algorithm])] : null, rows, better);
}

function renderLegend() {
  const legend = $('legend');
  if (state.mode === 'orders') {
    legend.classList.add('orders-key');
    $('legend-min').textContent = 'Each colour is one customer order';
    $('legend-max').textContent = '';
  } else {
    legend.classList.remove('orders-key');
    $('legend-min').textContent = `${fmt(state.kraft.min, 1)} kg, light`;
    $('legend-max').textContent = `heavy, ${fmt(state.kraft.max, 1)} kg`;
  }
}

// ---------- WES: order queue ----------
function renderOrdersSkeleton() {
  const section = $('orders-section');
  section.hidden = state.mode !== 'orders';
  if (section.hidden) return;
  const list = $('orders');
  list.replaceChildren();
  const orders = [...state.plans.wes.orders].sort((a, b) => a.processed - b.processed);
  for (const o of orders) {
    const li = document.createElement('li');
    li.dataset.id = o.id;
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.setProperty('--c', orderColor(o.id));
    const text = document.createElement('span');
    text.innerHTML = `#${o.id} ${o.destination}<br><span class="meta"></span>`;
    text.querySelector('.meta').textContent = `Priority ${o.priority}, ${o.boxes} boxes, due ${clock(o.deadline)}`;
    const status = document.createElement('span');
    status.className = 'status';
    li.append(sw, text, status);
    list.appendChild(li);
  }
}

function updateOrders(live) {
  const wes = state.plans.wes;
  const current = state.t > 0 ? state.step : state.step - 1;
  let finished = 0;
  let clockNow = 0;
  for (const li of $('orders').children) {
    const o = wes.orders.find((x) => x.id === Number(li.dataset.id));
    const status = li.querySelector('.status');
    let label = 'Waiting';
    let cls = '';
    if (o.status === 'rejected') {
      label = 'Too big for a pallet';
      cls = 'late';
    } else if (o.lastStep < state.step) {
      finished++;
      label = o.late ? 'Done, late' : 'Done';
      cls = o.late ? 'done late' : 'done';
    } else if (o.firstStep <= current && current <= o.lastStep) {
      label = 'Placing';
      cls = 'placing';
    }
    status.textContent = label;
    status.className = `status ${cls}`;
    li.classList.toggle('active', cls === 'placing');
  }
  // Simulated clock: when the most recent box was placed.
  for (const v of state.views) {
    for (const it of v.items) if (it.step < state.step) clockNow = Math.max(clockNow, it.time);
  }
  const palletsInUse = live.filter((l) => l.placed > 0).length;
  let shipped = 0;
  table($('live'), null, [
    ['Boxes placed', fmt(state.step)],
    ['Orders finished', fmt(finished)],
    ['Pallets started', ''],
    ['Shift clock', clock(clockNow)],
  ]);
  state.views.forEach((v, i) => {
    const p = v.meta;
    const closed = p.closedAfterStep >= 0 && state.step >= p.closedAfterStep;
    shipped += closed;
    v.setSublabel(closed ? `${p.destination}, shipped` : p.destination);
    v.setWrapped(closed, live[i].height);
  });
  $('live').tBodies[0].rows[2].cells[1].textContent = `${fmt(palletsInUse)} (${fmt(shipped)} shipped)`;
}

// ---------- playback ----------
function setPlaying(on) {
  state.playing = on;
  document.body.classList.toggle('playing', on);
  $('btn-play').setAttribute('aria-label', on ? 'Pause (Space)' : 'Play (Space)');
  $('btn-play').title = on ? 'Pause (Space)' : 'Play (Space)';
}
function togglePlay() {
  if (!state.playing && state.step >= state.total) jumpTo(0);
  setPlaying(!state.playing);
}
function jumpTo(step) {
  state.step = Math.max(0, Math.min(state.total, step));
  state.t = 0;
}
function stepForward() {
  setPlaying(false);
  jumpTo(state.step + 1);
}
function stepBack() {
  setPlaying(false);
  jumpTo(state.t > 0 ? state.step : state.step - 1);
}

let lastTime = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  if (state.playing) {
    if (state.step >= state.total) {
      setPlaying(false);
    } else if (reducedMotion) {
      state.step++; // no in-between motion: boxes simply appear
    } else {
      state.t += dt * state.speed;
      if (state.t >= 1) {
        state.step++;
        state.t = 0;
      }
    }
  }
  const live = state.views.map((v) => v.setStep(state.step, state.t, state.showCom));
  updatePanel(live);
  stage.render();
  requestAnimationFrame(tick);
}

// ---------- modes ----------
function setMode(mode, { autoplay = false } = {}) {
  if (!MODES.includes(mode) || (mode === 'orders' && !state.plans.wes)) mode = 'ep';
  state.mode = mode;
  for (const b of document.querySelectorAll('.modes button')) {
    b.setAttribute('aria-selected', String(b.dataset.mode === mode));
  }
  if (location.hash !== `#${mode}`) history.replaceState(null, '', `#${mode}`);
  for (const el of document.querySelectorAll('[data-for]')) el.hidden = (el.dataset.for === 'orders') !== (mode === 'orders');
  $('btn-generate').textContent = mode === 'orders' ? 'Run these orders' : 'Pack these boxes';
  buildViews();
  if (autoplay && !reducedMotion) {
    jumpTo(0);
    setPlaying(true);
  } else {
    jumpTo(state.total);
    setPlaying(false);
  }
}

// ---------- live planning in the browser (WebAssembly) ----------
async function onGenerate(e) {
  e.preventDefault();
  const status = $('generate-status');
  if (!state.engine) return;
  const f = new FormData(e.target);
  const seed = Math.max(1, Number(f.get('seed')) || 1);
  try {
    if (state.mode === 'orders') {
      const orders = Math.min(60, Math.max(3, Number(f.get('orders')) || 24));
      state.plans.wes = JSON.parse(state.engine.wes(orders, seed));
      status.textContent = `Planned ${orders} orders in ${fmt(state.plans.wes.metrics.runtimeMs, 1)} ms, in your browser.`;
    } else {
      const n = Math.min(120, Math.max(5, Number(f.get('n')) || 40));
      const support = Math.min(100, Math.max(30, Number(f.get('support')) || 75)) / 100;
      state.plans.greedy = JSON.parse(state.engine.pack('greedy', n, seed, support));
      state.plans.ep = JSON.parse(state.engine.pack('ep', n, seed, support));
      status.textContent = `Packed ${n} boxes both ways in ${fmt(state.plans.greedy.metrics.runtimeMs + state.plans.ep.metrics.runtimeMs, 1)} ms, in your browser.`;
    }
    setMode(state.mode, { autoplay: true });
  } catch (err) {
    status.textContent = `Planning failed: ${err.message}`;
  }
}

// ---------- start-up ----------
async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function wireControls() {
  for (const b of document.querySelectorAll('.modes button')) {
    b.addEventListener('click', () => setMode(b.dataset.mode, { autoplay: true }));
  }
  $('btn-play').addEventListener('click', togglePlay);
  $('btn-forward').addEventListener('click', stepForward);
  $('btn-back').addEventListener('click', stepBack);
  $('btn-restart').addEventListener('click', () => { setPlaying(false); jumpTo(0); });
  $('btn-end').addEventListener('click', () => { setPlaying(false); jumpTo(state.total); });
  $('speed').addEventListener('change', (e) => { state.speed = Number(e.target.value); });
  $('show-com').addEventListener('change', (e) => { state.showCom = e.target.checked; });
  $('generate').addEventListener('submit', onGenerate);
  // Back/forward buttons and edited URLs (#greedy, #ep, #compare, #orders) switch the view too.
  window.addEventListener('hashchange', () => {
    const mode = location.hash.slice(1);
    if (mode !== state.mode && state.plans.ep) setMode(mode, { autoplay: true });
  });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea, button')) return; // let form controls keep their keys
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowRight') stepForward();
    else if (e.key === 'ArrowLeft') stepBack();
    else if (e.key === 'Home') { setPlaying(false); jumpTo(0); }
    else if (e.key === 'End') { setPlaying(false); jumpTo(state.total); }
  });
}

async function main() {
  wireControls();
  const [greedy, ep, wes] = await Promise.allSettled([
    loadJson('data/plan_greedy.json'),
    loadJson('data/plan_ep.json'),
    loadJson('data/wes.json'),
  ]);
  if (greedy.status !== 'fulfilled' || ep.status !== 'fulfilled') {
    const empty = $('empty');
    empty.hidden = false;
    empty.textContent = 'No plans to show yet. Run "make -C core plans" (npm run dev does it for you), then reload this page.';
    return;
  }
  state.plans.greedy = greedy.value;
  state.plans.ep = ep.value;
  if (wes.status === 'fulfilled') {
    state.plans.wes = wes.value;
    document.querySelector('[data-mode="orders"]').hidden = false;
  }

  setMode(location.hash.slice(1) || 'ep', { autoplay: true });
  requestAnimationFrame(tick);

  const status = $('generate-status');
  status.textContent = 'Loading the planner…';
  state.engine = await loadEngine();
  $('btn-generate').disabled = !state.engine;
  status.textContent = state.engine
    ? 'The C++ planner runs right here in your browser, compiled to WebAssembly.'
    : 'Live planning needs the WebAssembly build of the planner (make -C core wasm). The plans above were made ahead of time.';
}

// A small window into the app for end-to-end tests.
window.__viewer = {
  snapshot: () => ({
    mode: state.mode,
    step: state.step,
    total: state.total,
    playing: state.playing,
    pallets: state.views.length,
    visibleBoxes: state.views.reduce((n, v) => n + v.items.filter((it) => it.mesh.visible).length, 0),
    engine: !!state.engine,
  }),
  plans: () => state.plans,
  engine: () => state.engine,
};

main();
