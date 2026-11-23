// three.js scene: the floor, lights and camera (the "stage"), plus one PalletView per pallet station.
//
// Frames: the C++ planner uses the PALLET frame (millimetres, z up, origin at the back-left corner
// of the deck). three.js uses metres with y up. Instead of converting every coordinate by hand,
// each pallet gets a `frame` group that IS the pallet frame: scaled mm -> m and rotated -90° about
// x so local z points up the world's y. Children of that group can then use the planner's
// numbers unchanged. That's the point of a scene graph: a transform on a parent applies to all
// of its children.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const MM = 0.001;
const PALLET_HEIGHT = 144; // mm, wooden pallet under the deck
const DROP = 450; // mm a box travels down while the robot lowers it
const COLORS = {
  concrete: 0xcfd3d7,
  joints: 0xbcc1c6,
  wood: 0xbc9f74,
  woodDark: 0x957a55,
  tape: 0xe8b931,
  edge: 0x5e3f22,
  packingTape: 0xd9bd91,
  steel: 0x1f2933,
  signal: 0x2f6fde,
};

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  // HTML labels that follow 3D positions.
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.concrete);
  scene.fog = new THREE.Fog(COLORS.concrete, 10, 30);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48; // never look from under the floor

  scene.add(new THREE.HemisphereLight(0xf5f7fa, 0x80868d, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.position.set(4, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: COLORS.concrete, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const joints = new THREE.GridHelper(80, 20, COLORS.joints, COLORS.joints); // concrete slab joints
  joints.position.y = 0.001;
  scene.add(joints);

  function resize() {
    const w = container.clientWidth;
    const h = Math.max(container.clientHeight, 1);
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // Place the camera so every pallet station is in view, whatever the window shape.
  function frame(views) {
    const box = new THREE.Box3();
    for (const v of views) box.union(v.bounds());
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const dist = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * 1.08;
    center.y *= 0.9; // aim slightly low: the floor tape matters more than the empty sky above
    const dir = new THREE.Vector3(0.8, 0.58, 1).normalize();
    camera.position.copy(center).addScaledVector(dir, dist);
    controls.target.copy(center);
    controls.update();
  }

  function render() {
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }

  return { scene, camera, controls, renderer, frame, render };
}

// A wooden pallet, in pallet-frame millimetres: z from -144 (floor) to 0 (top of the deck).
function buildPallet(L, W) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.95 });
  const woodDark = new THREE.MeshStandardMaterial({ color: COLORS.woodDark, roughness: 0.95 });
  const add = (mat, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x + sx / 2, y + sy / 2, z + sz / 2);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  };
  const boards = 7;
  const bw = 120;
  const gap = (W - boards * bw) / (boards - 1);
  for (let i = 0; i < boards; i++) add(wood, 0, i * (bw + gap), -22, L, bw, 22); // top deck boards
  for (const x of [0, L / 2 - 50, L - 100]) add(woodDark, x, 0, -44, 100, W, 22); // stringer boards
  for (const x of [0, L / 2 - 72, L - 145]) {
    for (const y of [0, W / 2 - 50, W - 100]) add(woodDark, x, y, -122, 145, 100, 78); // blocks
  }
  for (const y of [0, W / 2 - 50, W - 100]) add(wood, 0, y, -144, L, 100, 22); // bottom boards
  return g;
}

// Yellow floor tape around the station, like a marked robot cell (world metres, on the floor).
function floorTape(L, W) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: COLORS.tape });
  const margin = 0.18;
  const w = L * MM + 2 * margin;
  const d = W * MM + 2 * margin;
  const t = 0.05;
  for (const [sx, sz, x, z] of [
    [w, t, 0, -d / 2],
    [w, t, 0, d / 2],
    [t, d, -w / 2, 0],
    [t, d, w / 2, 0],
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.002, z);
    g.add(m);
  }
  return g;
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class PalletView {
  // items: [{ step, x, y, z, sx, sy, sz, weight, color, ... }] in pallet-frame mm.
  // `step` is the global placement index: the box is on the pallet once the player passes it.
  constructor({ pallet, items, label, sublabel, labelAt = 'top' }) {
    this.pallet = pallet;
    this.items = items;

    this.root = new THREE.Group(); // the station, positioned in the world
    this.frame = new THREE.Group(); // the pallet frame (see top of file)
    this.frame.scale.setScalar(MM);
    this.frame.rotation.x = -Math.PI / 2;
    this.frame.position.set((-pallet.length / 2) * MM, PALLET_HEIGHT * MM, (pallet.width / 2) * MM);
    this.root.add(this.frame);
    this.frame.add(buildPallet(pallet.length, pallet.width));
    this.root.add(floorTape(pallet.length, pallet.width));

    // Allowed volume (max height) as a faint wire box.
    const env = new THREE.BoxGeometry(pallet.length, pallet.width, pallet.maxHeight);
    this.envelope = new THREE.LineSegments(
      new THREE.EdgesGeometry(env),
      new THREE.LineBasicMaterial({ color: COLORS.steel, transparent: true, opacity: 0.16 }),
    );
    this.envelope.position.set(pallet.length / 2, pallet.width / 2, pallet.maxHeight / 2);
    this.frame.add(this.envelope);

    this.edgeMat = new THREE.LineBasicMaterial({ color: COLORS.edge, transparent: true, opacity: 0.55 });
    this.activeEdgeMat = new THREE.LineBasicMaterial({ color: COLORS.tape });
    const tapeMat = new THREE.MeshStandardMaterial({ color: COLORS.packingTape, roughness: 0.4 });

    for (const it of items) {
      const geo = new THREE.BoxGeometry(it.sx, it.sy, it.sz);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.88 }));
      mesh.castShadow = mesh.receiveShadow = true;
      it.restZ = it.z + it.sz / 2;
      mesh.position.set(it.x + it.sx / 2, it.y + it.sy / 2, it.restZ);
      // packing tape along the long side of the lid
      const along = it.sx >= it.sy;
      const tape = new THREE.Mesh(new THREE.BoxGeometry(along ? it.sx + 2 : 50, along ? 50 : it.sy + 2, 2), tapeMat);
      tape.position.z = it.sz / 2 + 1;
      mesh.add(tape);
      it.edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), this.edgeMat);
      mesh.add(it.edges);
      mesh.visible = false;
      it.mesh = mesh;
      this.frame.add(mesh);
    }

    // Vacuum gripper: a yellow suction plate on a dark mast.
    this.gripper = new THREE.Group();
    this.plate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 40), new THREE.MeshStandardMaterial({ color: COLORS.tape, roughness: 0.5 }));
    this.plate.position.z = 20;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, 1400, 20), new THREE.MeshStandardMaterial({ color: COLORS.steel, roughness: 0.6 }));
    mast.rotation.x = Math.PI / 2; // cylinders are built along y; turn it to the frame's z
    mast.position.z = 40 + 700;
    this.gripper.add(this.plate, mast);
    this.gripper.visible = false;
    this.frame.add(this.gripper);

    // Center of mass: a blue ball, a plumb line down to the deck, and a ring marking the pallet center.
    const comMat = new THREE.MeshBasicMaterial({ color: COLORS.signal });
    this.com = new THREE.Mesh(new THREE.SphereGeometry(32, 20, 14), comMat);
    this.plumb = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: COLORS.signal }),
    );
    this.centerRing = new THREE.Mesh(new THREE.RingGeometry(38, 50, 32), comMat);
    this.centerRing.position.set(pallet.length / 2, pallet.width / 2, 1);
    this.frame.add(this.com, this.plumb, this.centerRing);

    if (label) {
      const el = document.createElement('div');
      el.className = 'pallet-label';
      el.textContent = label;
      if (sublabel) {
        const s = document.createElement('small');
        s.textContent = sublabel;
        el.appendChild(s);
      }
      this.labelEl = el;
      this.label = new CSS2DObject(el);
      if (labelAt === 'front') {
        // on the floor in front of the station: many stations' labels then never overlap
        this.label.position.set(0, 0, (pallet.width / 2) * MM + 0.32);
      } else {
        this.label.position.set(0, (PALLET_HEIGHT + pallet.maxHeight + 140) * MM, 0);
      }
      this.root.add(this.label);
    }

    // Stretch wrap: shown once the pallet has been shipped.
    this.wrap = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xeef3f7, transparent: true, opacity: 0.45, roughness: 0.2, depthWrite: false }),
    );
    this.wrap.visible = false;
    this.frame.add(this.wrap);
  }

  // Show or hide the stretch-wrap film around the current stack.
  setWrapped(on, height) {
    this.wrap.visible = on && height > 0;
    if (!this.wrap.visible) return;
    const L = this.pallet.length;
    const W = this.pallet.width;
    this.wrap.scale.set(L + 16, W + 16, height + 30);
    this.wrap.position.set(L / 2, W / 2, (height + 30) / 2 - 20);
  }

  setSublabel(text) {
    const s = this.labelEl && this.labelEl.querySelector('small');
    if (s) s.textContent = text;
  }

  // Show the pallet after `step` placements, with the next box `t` (0..1) of the way through
  // being placed. Returns live figures for the side panel.
  setStep(step, t, showCom) {
    const L = this.pallet.length;
    const W = this.pallet.width;
    let weight = 0, wx = 0, wy = 0, wz = 0, placed = 0, height = 0;
    let active = null, last = null;

    for (const it of this.items) {
      const m = it.mesh;
      it.edges.material = this.edgeMat;
      if (it.step < step) {
        m.visible = true;
        m.position.z = it.restZ;
        placed++;
        weight += it.weight;
        wx += it.weight * (it.x + it.sx / 2);
        wy += it.weight * (it.y + it.sy / 2);
        wz += it.weight * (it.z + it.sz / 2);
        height = Math.max(height, it.z + it.sz);
        if (it.step === step - 1) last = it;
      } else if (it.step === step && t > 0) {
        // 0..0.7: lowered by the gripper; 0.7..1: released, gripper lifts away
        m.visible = true;
        m.position.z = it.restZ + (t < 0.7 ? 1 - easeOut(t / 0.7) : 0) * DROP;
        active = it;
      } else {
        m.visible = false;
      }
    }

    const highlight = active || last;
    if (highlight) highlight.edges.material = this.activeEdgeMat;

    if (active) {
      const lift = t < 0.7 ? 0 : ((t - 0.7) / 0.3) * 350;
      this.plate.scale.set(active.sx * 0.7, active.sy * 0.7, 1);
      this.gripper.position.set(active.x + active.sx / 2, active.y + active.sy / 2, active.mesh.position.z + active.sz / 2 + lift);
      this.gripper.visible = true;
    } else {
      this.gripper.visible = false;
    }

    const com = weight > 0 ? { x: wx / weight, y: wy / weight, z: wz / weight } : null;
    const showMarker = showCom && !!com;
    this.com.visible = this.plumb.visible = this.centerRing.visible = showMarker;
    if (showMarker) {
      this.com.position.set(com.x, com.y, com.z);
      this.plumb.geometry.setFromPoints([new THREE.Vector3(com.x, com.y, 2), new THREE.Vector3(com.x, com.y, com.z)]);
    }

    return {
      placed,
      weight,
      height,
      com,
      comOffset: com ? Math.hypot(com.x - L / 2, com.y - W / 2) : 0,
      active,
      last,
    };
  }

  bounds() {
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.envelope);
    return box.expandByScalar(0.15);
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.root.removeFromParent();
    // CSS2D labels are real DOM elements; removing the parent group doesn't remove them.
    if (this.labelEl) this.labelEl.remove();
  }
}
