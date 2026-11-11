/**
 * 3D preview (three.js). Consumes the same CardModel parts as the 2D editor
 * and the export — there is no second geometry pipeline here.
 *
 * Each part is extruded once in flat space (x, y, paper-normal) and placed by
 * a matrix computed from the opening angle (core/pose.ts), so opening and
 * closing the card never rebuilds geometry.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { partPose } from '../core/pose';
import { LIMITS } from '../core/types';
import type { CardModel, Part } from '../core/types';
import { modelOf, useStore } from '../app/store';
import { useZoom } from './viewport';

const PAPER = LIMITS.paperMm;
/** Last play request already animated (module-level so a remount does not replay it). */
let seenNonce = 0;

function noiseTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 232 + Math.random() * 23;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 14, 1 / 14); // one tile of paper grain spans 14 mm
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function partGeometry(part: Part): THREE.ExtrudeGeometry | null {
  const shapes: THREE.Shape[] = [];
  for (const poly of part.region) {
    const shape = new THREE.Shape(poly[0].map(([x, y]) => new THREE.Vector2(x, y)));
    for (const hole of poly.slice(1)) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
    shapes.push(shape);
  }
  if (!shapes.length) return null;
  return new THREE.ExtrudeGeometry(shapes, { depth: PAPER, bevelEnabled: false, curveSegments: 1 });
}

function placePart(mesh: THREE.Mesh, part: Part, openDeg: number, W: number) {
  const p = partPose(part, openDeg);
  const s = Math.sin(p.a);
  const c = Math.cos(p.a);
  // stack layers along the paper normal: backing under, glued pieces on top
  const t0 = part.layer * (PAPER + 0.06);
  mesh.matrix.set(
    1, 0, 0, -W / 2,
    0, s, c, p.py - p.y0 * s + t0 * c,
    0, -c, s, p.pz + p.y0 * c + t0 * s,
    0, 0, 0, 1,
  );
  mesh.matrixWorldNeedsUpdate = true;
}

export function View3D() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    el.append(renderer.domElement);

    const scene = new THREE.Scene();
    const bg = getComputedStyle(el).getPropertyValue('--color-bg-editor').trim() || '#e7e8ea';
    scene.background = new THREE.Color(bg);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.38;

    const sun = new THREE.DirectionalLight(0xffffff, 2.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.25;
    sun.shadow.radius = 4;
    scene.add(sun, sun.target);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.2 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // rig: ambient motion lives here and survives every rebuild
    const rig = new THREE.Group();
    const content = new THREE.Group();
    rig.add(content);
    scene.add(rig);

    const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.95;

    const grain = noiseTexture();
    let R = 150;
    let framed = false;
    let fitDistance = 480;

    const frame = (model: CardModel) => {
      const W = model.card.widthMm;
      const P = model.card.panelMm;
      R = Math.hypot(W, 2 * P) / 2;
      controls.minDistance = 1.2 * R;
      controls.maxDistance = 8 * R;
      fitDistance = 3.2 * R;
      const target = new THREE.Vector3(0, P * 0.3, P * 0.2);
      controls.target.copy(target);
      camera.position.copy(target).add(new THREE.Vector3(0.42, 0.5, 1).normalize().multiplyScalar(fitDistance));
      camera.near = R / 50;
      camera.far = R * 40;
      camera.updateProjectionMatrix();
      controls.update();
    };

    const lightFor = (model: CardModel) => {
      const P = model.card.panelMm;
      const r = Math.hypot(model.card.widthMm, 2 * P) / 2;
      // raking light from the upper left: every standing shape throws a readable shadow on the wall
      sun.position.set(-r * 1.5, r * 1.8, r * 1.15);
      sun.target.position.set(0, 0, 0);
      const cam = sun.shadow.camera;
      cam.left = cam.bottom = -r * 1.6;
      cam.right = cam.top = r * 1.6;
      cam.near = 1;
      cam.far = r * 6;
      cam.updateProjectionMatrix();
      ground.scale.set(r * 12, r * 12, 1);
      ground.position.y = -(PAPER * 2 + 0.3);
    };

    let anim: { t: number; from: number; to: number } | null = null;
    let meshes: { mesh: THREE.Mesh; part: Part }[] = [];
    let cardW = 150;
    let openDeg = useStore.getState().openDeg;

    const rebuild = (model: CardModel) => {
      // dispose what the previous build created (never the shared grain or env map)
      for (const { mesh } of meshes) {
        mesh.geometry.dispose();
        for (const m of mesh.material as THREE.Material[]) m.dispose();
      }
      content.clear();
      meshes = [];
      cardW = model.card.widthMm;
      for (const part of model.parts) {
        const geo = partGeometry(part);
        if (!geo) continue;
        const color = new THREE.Color(part.color);
        const face = new THREE.MeshStandardMaterial({ color, roughness: 0.93, metalness: 0, map: grain, bumpMap: grain, bumpScale: 0.35 });
        const side = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.82), roughness: 0.95 });
        const mesh = new THREE.Mesh(geo, [face, side]);
        mesh.matrixAutoUpdate = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        placePart(mesh, part, openDeg, cardW);
        content.add(mesh);
        meshes.push({ mesh, part });
      }
      lightFor(model);
      if (!framed) {
        frame(model);
        framed = true;
      } else {
        const r = Math.hypot(model.card.widthMm, 2 * model.card.panelMm) / 2;
        controls.minDistance = 1.2 * r;
        controls.maxDistance = 8 * r;
        fitDistance = 3.2 * r;
      }
    };

    const applyAngle = (deg: number) => {
      openDeg = deg;
      for (const { mesh, part } of meshes) placePart(mesh, part, deg, cardW);
    };

    // debounced rebuild on design change; the angle is applied directly
    let timer = 0;
    let lastDesign = useStore.getState().design;
    rebuild(modelOf(lastDesign));
    const unsub = useStore.subscribe((s) => {
      if (s.design !== lastDesign) {
        lastDesign = s.design;
        clearTimeout(timer);
        timer = window.setTimeout(() => rebuild(modelOf(useStore.getState().design)), 120);
      }
      if (s.openDeg !== openDeg && !anim) applyAngle(s.openDeg);
      if (s.playNonce !== seenNonce) {
        seenNonce = s.playNonce;
        anim = { t: 0, from: 0, to: 90 };
      }
    });
    if (useStore.getState().playNonce !== seenNonce) {
      seenNonce = useStore.getState().playNonce;
      anim = { t: 0, from: 0, to: 90 };
    }

    // zoom cluster ↔ camera distance
    const reportZoom = () => {
      const d = camera.position.distanceTo(controls.target);
      const pct = Math.round((fitDistance / d) * 100);
      if (pct !== useZoom.getState().pct) useZoom.setState({ pct });
    };
    const dolly = (toDistance: number) => {
      const dir = camera.position.clone().sub(controls.target).normalize();
      const d = Math.max(controls.minDistance, Math.min(controls.maxDistance, toDistance));
      camera.position.copy(controls.target).add(dir.multiplyScalar(d));
    };
    useZoom.setState({
      api: {
        zoomBy: (f) => dolly(camera.position.distanceTo(controls.target) / f),
        zoomTo: (pct) => dolly(fitDistance / (pct / 100)),
        fit: () => frame(modelOf(useStore.getState().design)),
      },
    });
    controls.addEventListener('end', reportZoom);

    // drag adds a little momentum to the rig; an under-damped spring settles it
    const spring = { x: 0, y: 0, vx: 0, vy: 0 };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const moveP = (e: PointerEvent) => {
      if (!dragging || reduced) return;
      spring.vy += (e.clientX - lastX) * 0.004;
      spring.vx += (e.clientY - lastY) * 0.004;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const upP = () => (dragging = false);
    renderer.domElement.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', moveP);
    window.addEventListener('pointerup', upP);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 2 || h < 2) return; // mounted hidden: keep state, wait for a real size
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    let prev = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (anim) {
        anim.t = Math.min(1, anim.t + dt / 1.6);
        const k = anim.t < 0.5 ? 2 * anim.t * anim.t : 1 - (-2 * anim.t + 2) ** 2 / 2;
        applyAngle(anim.from + (anim.to - anim.from) * k);
        if (anim.t >= 1) {
          const end = anim.to;
          anim = null;
          useStore.getState().setOpenDeg(end);
        }
      }
      if (!reduced) {
        spring.vx += (-70 * spring.x - 5.5 * spring.vx) * dt;
        spring.vy += (-70 * spring.y - 5.5 * spring.vy) * dt;
        spring.x += spring.vx * dt;
        spring.y += spring.vy * dt;
        const t = now / 1000;
        rig.rotation.x = spring.x * 0.25 + Math.sin(t * 0.53) * 0.006;
        rig.rotation.y = spring.y * 0.25 + Math.sin(t * 0.37) * 0.012;
      }
      controls.update();
      reportZoom();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      unsub();
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', moveP);
      window.removeEventListener('pointerup', upP);
      useZoom.setState({ api: null });
      for (const { mesh } of meshes) {
        mesh.geometry.dispose();
        for (const m of mesh.material as THREE.Material[]) m.dispose();
      }
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      grain.dispose();
      envRT.dispose();
      pmrem.dispose();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="view3d" role="img" aria-label="3D preview of the folded card" />;
}
