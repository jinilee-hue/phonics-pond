// Phonics POND · the Timer's alarm clock in real 3D (user: "알람시계의 볼륨감도 … 래퍼런스 참고해서 … 모션도 자연스럽게 신나게").
// A chunky toy clock like the 3D-icon references: a thick round body with a raised bezel, the white face sunk inside it, raised
// pills for the hours, the time-left slice, one hand, a little head with eyes on the hub, two bells with knobs, a hammer, two legs.
// Lit like a studio render (soft key light with soft shadows, sky / ground fill, a rim light, room reflections).
// Motion = springs + the timer's own beat: it rocks foot to foot on every second (twice a second in the last ten), hops on each
// 5·4·3·2·1, winds up with a crouch, a hop and a spin, rings with the hammer flying and the whole clock bouncing, dozes when paused.
// The page owns the state; frame(s) is called once per animation frame while the Timer is on screen.
import * as THREE from './three-r170.module.min.js';
import { RoomEnvironment } from './RoomEnvironment.js';

const DEG = Math.PI / 180, TAU = Math.PI * 2;
const FACE_Z = 0.15, FACE_R = 0.775, SLICE_R = 0.6, FLOOR = -1.146, FOOT_X = 0.79;
const READY = { yaw: 26, pitch: -4 };   // the three-quarter view: the lit side shows
const G = 15;                            // gravity for the hops (units / s²)
export const RING_MS = 2800;

const spring = (x, f, z) => ({ x, v: 0, t: x, k: (TAU * f) ** 2, c: 2 * z * TAU * f });
const step = (s, dt) => { s.v += (-s.k * (s.x - s.t) - s.c * s.v) * dt; s.x += s.v * dt; };
const easeOut = u => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);

export function create() {
  const canvas = document.createElement('canvas');
  canvas.className = 'b-tgl';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'default' }); }
  catch (e) { return null; }
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  pm.dispose();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  camera.position.set(0, 1.75, 8.0);
  camera.lookAt(0, 0.22, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7a746e, 0.7));
  const key = new THREE.DirectionalLight(0xfff3e6, 2.7);
  key.position.set(-2.6, 4.4, 4.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 1, far: 14 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffffff, 1.1);
  rim.position.set(3.4, 2.4, -3.2);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(3, -0.6, 4);
  scene.add(fill);

  // materials (colours come from the page: the theme's --tm and the slice's traffic-light colour)
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: '#FFC83D', roughness: 0.5, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.32 });
  const darkMat = new THREE.MeshPhysicalMaterial({ color: '#B08A2A', roughness: 0.45, clearcoat: 0.3 });   // ticks + the hammer's rod: the body, a shade darker
  const faceMat = new THREE.MeshStandardMaterial({ color: '#FFFDF8', roughness: 0.6 });
  const sliceMat = new THREE.MeshStandardMaterial({ color: '#22A55B', roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const handMat = new THREE.MeshPhysicalMaterial({ color: '#2B2A33', roughness: 0.35, clearcoat: 0.5 });
  const scleraMat = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: 0.25, clearcoat: 0.6 });
  const pupilMat = new THREE.MeshPhysicalMaterial({ color: '#17161C', roughness: 0.2, clearcoat: 0.8 });
  const hlMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false });
  const shutMat = new THREE.MeshPhysicalMaterial({ color: '#17161C', roughness: 0.3, clearcoat: 0.5 });   // closed eyes: dark on a bright head, white on a dark one
  const all = [];
  const mesh = (geo, mat, parent, cast = true, recv = false) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); all.push(m); return m; };

  // rig: roll pivots on the foot it tips over, yaw / pitch / squash pivot at the feet line, the model sits above the floor
  const mover = new THREE.Group(), base = new THREE.Group(), tilt = new THREE.Group(), clock = new THREE.Group();
  tilt.rotation.order = 'YXZ';
  scene.add(mover); mover.add(base); base.add(tilt); tilt.add(clock);
  clock.position.y = -FLOOR;

  // body: a lathe — a round back, a soft side, a fat bezel lip, a short wall down into the face
  const P = [];
  const arc = (cx, cy, r, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * DEG; P.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a))); } };
  P.push(new THREE.Vector2(0.0001, -0.3), new THREE.Vector2(0.5, -0.3));
  arc(0.7, -0.04, 0.26, -90, -2, 16);
  P.push(new THREE.Vector2(0.985, 0.06));
  arc(0.885, 0.17, 0.105, -8, 180, 26);
  arc(0.765, 0.17, 0.015, 180, 270, 4);
  P.push(new THREE.Vector2(FACE_R - 0.004, FACE_Z));
  const bodyGeo = new THREE.LatheGeometry(P, 128).rotateX(Math.PI / 2);
  mesh(bodyGeo, bodyMat, clock, true, true);
  mesh(new THREE.CircleGeometry(FACE_R + 0.002, 128), faceMat, clock, false, true).position.z = FACE_Z;

  // the time-left slice: a fan from 12 o'clock counter-clockwise to the hand (its edge is real geometry, so it stays smooth)
  const SN = 160, sPos = new Float32Array((SN + 2) * 3), sNrm = new Float32Array((SN + 2) * 3), sIdx = [];
  for (let i = 0; i < SN + 2; i++) sNrm[i * 3 + 2] = 1;
  for (let i = 0; i < SN; i++) sIdx.push(0, i + 1, i + 2);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('normal', new THREE.BufferAttribute(sNrm, 3));
  sGeo.setIndex(sIdx);
  const slice = mesh(sGeo, sliceMat, clock, false, true);
  slice.position.z = FACE_Z + 0.002;
  slice.frustumCulled = false;
  let sliceA = -1;
  const setSlice = a => {
    if (Math.abs(a - sliceA) < 1e-4) return;
    sliceA = a; slice.visible = a > 0.002;
    for (let i = 0; i <= SN; i++) { const ph = a * i / SN; sPos[(i + 1) * 3] = -Math.sin(ph) * SLICE_R; sPos[(i + 1) * 3 + 1] = Math.cos(ph) * SLICE_R; }
    sGeo.attributes.position.needsUpdate = true;
  };

  // hour pills, raised off the face
  const tickBig = new THREE.CapsuleGeometry(0.03, 0.07, 6, 12), tickSmall = new THREE.CapsuleGeometry(0.026, 0.012, 6, 12);
  for (let i = 0; i < 12; i++) {
    const a = i * 30 * DEG, m = mesh(i % 3 ? tickSmall : tickBig, darkMat, clock, true, false);
    m.position.set(-Math.sin(a) * 0.69, Math.cos(a) * 0.69, FACE_Z + 0.004); m.rotation.z = a; m.scale.z = 0.6;
  }
  // the hand: a rounded bar riding the slice's edge
  const hand = new THREE.Group(); hand.position.z = FACE_Z + 0.055; clock.add(hand);
  const handBar = mesh(new THREE.CapsuleGeometry(0.045, 0.5, 8, 16), handMat, hand, true, false);
  handBar.position.y = 0.3; handBar.scale.z = 0.7;

  // the little head on the hub: eyes that follow the hand, blink, sleep, look up at the bells when it rings
  const headG = new THREE.Group(); headG.position.z = FACE_Z + 0.03; clock.add(headG);
  mesh(new THREE.SphereGeometry(0.235, 48, 32), bodyMat, headG, true, true).scale.set(1, 1, 0.5);
  const unit = new THREE.SphereGeometry(1, 32, 20), eyes = [], shut = [];
  [-1, 1].forEach(sx => {
    const eye = new THREE.Group(); eye.position.set(sx * 0.088, 0.012, 0.105); headG.add(eye);
    mesh(unit, scleraMat, eye, false, false).scale.set(0.068, 0.09, 0.03);
    const pu = mesh(unit, pupilMat, eye, false, false); pu.scale.set(0.038, 0.042, 0.016);
    const hl = mesh(unit, hlMat, eye, false, false); hl.scale.setScalar(0.012);
    eyes.push({ eye, pu, hl });
    const s = mesh(new THREE.TorusGeometry(0.052, 0.014, 8, 24, Math.PI), shutMat, headG, false, false);
    s.rotation.z = Math.PI; s.position.set(sx * 0.088, 0.03, 0.118); s.scale.z = 0.6; s.visible = false;
    shut.push(s);
  });

  // bells (dome + lip + knob) leaning out from the shoulders, each on its own wiggle pivot
  const bellGeo = new THREE.SphereGeometry(0.36, 48, 24, 0, TAU, 0, Math.PI / 2), lipGeo = new THREE.TorusGeometry(0.35, 0.042, 12, 64), knobGeo = new THREE.SphereGeometry(0.07, 24, 16);
  const bells = [-1, 1].map(sx => {
    const g = new THREE.Group(), a = 38 * DEG; g.position.set(sx * Math.sin(a) * 1.0, Math.cos(a) * 1.0, -0.1); g.rotation.z = -sx * a; clock.add(g);
    const w = new THREE.Group(); g.add(w);
    mesh(bellGeo, bodyMat, w).scale.y = 0.95;
    const lip = mesh(lipGeo, bodyMat, w); lip.rotation.x = Math.PI / 2; lip.position.y = 0.014;
    mesh(knobGeo, bodyMat, w).position.y = 0.36 * 0.95 + 0.045;
    return w;
  });
  // the hammer between the bells (the old stem + cap)
  const ham = new THREE.Group(); ham.position.set(0, 0.95, -0.1); clock.add(ham);
  mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.17, 20), darkMat, ham).position.y = 0.085;
  mesh(new THREE.SphereGeometry(0.1, 32, 16), bodyMat, ham).position.y = 0.2;
  // legs
  const legGeo = new THREE.CapsuleGeometry(0.095, 0.32, 8, 16);
  [-1, 1].forEach(sx => {
    const a = 40 * DEG, m = mesh(legGeo, bodyMat, clock, true, false);
    m.position.set(sx * 0.5 + sx * Math.sin(a) * 0.265, -0.72 - Math.cos(a) * 0.265, -0.06); m.rotation.z = -sx * 140 * DEG;
  });

  // floor: the key light's soft shadow + a contact blob under the feet (shrinks when it hops)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.ShadowMaterial({ opacity: 0.1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = FLOOR; ground.receiveShadow = true; scene.add(ground);
  const bc = document.createElement('canvas'); bc.width = bc.height = 128;
  const bx = bc.getContext('2d'), gr = bx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(0.45, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  bx.fillStyle = gr; bx.fillRect(0, 0, 128, 128);
  const blobMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.5 });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), blobMat);
  blob.rotation.x = -Math.PI / 2; blob.position.y = FLOOR + 0.002; scene.add(blob);

  // motion
  const M = {
    roll: spring(0, 1.25, 0.36), yaw: spring(READY.yaw, 0.85, 0.5), pitch: spring(READY.pitch, 0.9, 0.55),
    sq: spring(0, 3.1, 0.3), bell: spring(0, 5.5, 0.16), ham: spring(0, 6.5, 0.18), wide: spring(1, 3.2, 0.35),
  };
  let hopY = 0, hopV = 0, last = 0, snap = true, prevSt = null, prevBeat = null, prevCd = 0, prevWind = 0, prevRing = false;
  let windT0 = -1, windJump = false, spinT0 = -1, ringT0 = -1;
  let colKey = '';
  const pose = {};
  const hop = (v, force) => { if (force ? hopV < v : hopY <= 0.0001 && hopV <= 0) { hopV = v; M.sq.v -= v * 1.4; } };   // take-off stretches (force: even mid-air)

  function setColors(body, pie) {
    const k = body + '|' + pie; if (k === colKey) return; colKey = k;
    if (body) {
      bodyMat.color.set(body); darkMat.color.set(body).lerp(new THREE.Color('#3A3631'), 0.3);
      const c = bodyMat.color; shutMat.color.set(0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.06 ? '#FFFFFF' : '#17161C');
    }
    if (pie) sliceMat.color.set(pie);
  }

  function frame(s) {
    const now = performance.now(), dt = last ? Math.min(1 / 30, Math.max(0, (now - last) / 1000)) : 1 / 60; last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const zoom = (canvas.getBoundingClientRect().width / w) || 1, dpr = Math.min(2, (window.devicePixelRatio || 1) * zoom);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { renderer.setSize(W, H, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    setColors(s.body, s.pie);
    const st = s.st, red = st === 'run' && s.left <= 10000, calm = !!s.reduced;

    // events from the page's state
    if (!calm) {
      if (s.windAt && s.windAt !== prevWind && Date.now() - s.windAt < 500) { windT0 = now; windJump = false; M.sq.t = 0.15; M.wide.t = 0.55; }
      if (prevSt === 'paused' && st === 'run' && windT0 < 0) { hop(1.9); M.wide.v += 6; }   // waking up
      if (st === 'run' && windT0 < 0) {   // the beat: once a second, twice in the last ten
        const b = Math.floor(s.left / (red ? 500 : 1000));
        if (prevBeat !== null && b !== prevBeat) {
          const side = b % 2 ? 1 : -1;
          M.roll.t = side * (red ? 6 : 4.5); M.yaw.t = side * (red ? 12 : 9);
          if (!s.cd) hop(red ? 1.2 : 0.85);   // (5·4·3·2·1 has its own big hops)
          M.bell.v += side * (red ? 190 : 120); M.ham.v -= side * 140;
        }
        prevBeat = b;
      } else prevBeat = null;
      if (s.cd && s.cd !== prevCd) { hop(2.5, true); M.bell.v += 240; M.wide.v += 5; }   // 5·4·3·2·1: a big hop each
      if (s.ring && !prevRing) ringT0 = now;
    }
    if (prevRing && !s.ring) M.wide.t = 1;
    prevWind = s.windAt || 0; prevCd = s.cd || 0; prevRing = !!s.ring;
    if (!s.ring) ringT0 = -1;

    // targets per state
    if (st !== prevSt || snap) {
      if (st === 'ready') { M.roll.t = 0; M.yaw.t = READY.yaw; M.pitch.t = READY.pitch; }
      if (st === 'run') { M.pitch.t = -2; if (prevSt !== 'run') { M.roll.t = 0; M.yaw.t = 0; } }
      if (st === 'paused') { M.roll.t = -7; M.yaw.t = -14; M.pitch.t = -15; }
      if (st === 'done') { M.roll.t = 0; M.yaw.t = 0; M.pitch.t = -3; }
    }
    const tt = now / 1000;
    if (calm) M.sq.t = 0;
    else if (st === 'ready') { M.yaw.t = READY.yaw + 4 * Math.sin(TAU * tt / 5.2); M.sq.t = 0.012 * Math.sin(TAU * tt / 2.6); }
    else if (st === 'paused') M.sq.t = 0.03 * Math.sin(TAU * tt / 3.4);   // sleepy breathing
    else if (st === 'done' && ringT0 < 0) M.yaw.t = 6 * Math.sin(TAU * tt / 4.2);
    else if (windT0 < 0) M.sq.t = 0;

    // wind-up: crouch → hop + spin → land
    let spin = 0;
    if (windT0 >= 0) {
      const u = now - windT0;
      if (u >= 110 && !windJump) { windJump = true; M.sq.t = 0; hopV = 0; hopY = 0; hop(3.1); spinT0 = now; M.wide.t = 1.12; M.bell.v += 200; }
      if (u > 1000) { windT0 = -1; M.wide.t = 1; }
    }
    if (spinT0 >= 0) { const u = (now - spinT0) / 560; spin = -360 * (1 - easeOut(u)); if (u >= 1) spinT0 = -1; }

    // ringing: the hammer flies, the bells buzz, the clock jitters and bounces
    let rr = 0, ry = 0, rh = 0, rb = 0;
    if (ringT0 >= 0 && !calm) {
      const u = (now - ringT0) / 1000, env = Math.min(1, u / 0.12) * Math.min(1, Math.max(0, (RING_MS / 1000 - u) / 0.5));
      rr = 8.5 * Math.sin(TAU * 8.5 * u) * env; ry = 13 * Math.sin(TAU * 1.25 * u) * env;
      rh = 38 * Math.sin(TAU * 13 * u) * env; rb = 9 * Math.sin(TAU * 17 * u) * env;
      if (env > 0.3) hop(1.65 * env);
      M.wide.t = env > 0.05 ? 1.14 : 1;
    }

    if (calm || snap) { Object.values(M).forEach(m => { m.x = m.t; m.v = 0; }); hopY = 0; hopV = 0; }
    else {
      Object.values(M).forEach(m => step(m, dt));
      if (hopY > 0 || hopV > 0) {
        hopV -= G * dt; hopY += hopV * dt;
        if (hopY <= 0) { const imp = -hopV; hopY = 0; hopV = imp > 1.5 ? imp * 0.18 : 0; if (imp > 0.4) M.sq.v += imp * 1.5; }   // landing: squash (and a little bounce)
      }
    }
    snap = false; prevSt = st;

    // pose
    const roll = (M.roll.x + rr) * DEG, yaw = (M.yaw.x + ry + spin) * DEG, pitch = M.pitch.x * DEG, sq = Math.max(-0.25, Math.min(0.3, M.sq.x));
    const fx = FOOT_X * Math.cos(yaw) * (roll > 0 ? -1 : 1);
    mover.position.set(fx, FLOOR + hopY, 0); mover.rotation.z = roll;
    base.position.set(-fx, 0, 0);
    tilt.rotation.set(pitch, yaw, 0); tilt.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    const k = 1 / (1 + hopY * 2.2);
    blob.position.x = -Math.sin(roll) * 0.5; blob.scale.set(0.95 * k, 0.95 * k, 1); blobMat.opacity = 0.5 * k;
    bells[0].rotation.z = (M.bell.x + rb) * DEG; bells[1].rotation.z = -(M.bell.x + rb) * DEG;
    ham.rotation.z = (M.ham.x + rh) * DEG;

    // the face: slice, hand, eyes
    const a = Math.max(0, Math.min(1, s.p || 0)) * TAU;
    setSlice(a); hand.rotation.z = st === 'done' ? 0 : a;
    const asleep = st === 'paused';
    let px = -Math.sin(a) * 0.024, py = Math.cos(a) * 0.03;
    if (st === 'done') { px = 0; py = 0.034; }
    const bt = (now % 3600) / 3600, blink = calm || asleep ? 1 : bt > 0.92 && bt < 0.98 ? Math.abs(bt - 0.95) / 0.03 * 0.9 + 0.1 : 1;
    const wide = calm ? 1 : Math.max(0.4, M.wide.x);
    eyes.forEach(({ eye, pu, hl }, i) => {
      eye.visible = !asleep; shut[i].visible = asleep;
      eye.scale.set(wide, wide * blink, 1);
      pu.position.set(px, py, 0.024); hl.position.set(px + 0.013, py + 0.017, 0.037);
    });

    renderer.render(scene, camera);
    Object.assign(pose, { roll: roll / DEG, yaw: yaw / DEG, pitch: M.pitch.x, hop: hopY, sq, ham: ham.rotation.z / DEG, bell: bells[0].rotation.z / DEG, asleep, ring: ringT0 >= 0, slice: a / TAU, body: '#' + bodyMat.color.getHexString(THREE.SRGBColorSpace), pie: '#' + sliceMat.color.getHexString(THREE.SRGBColorSpace) });
  }

  canvas._pose = pose;   // for the page's QA scripts
  return {
    canvas, frame, pose,
    reset() { snap = true; prevBeat = null; prevCd = 0; ringT0 = -1; windT0 = -1; spinT0 = -1; last = 0; },
  };
}
