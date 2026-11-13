// Phonics POND · Pick's two dice in soft 3D (user: "주사위도 너무 실사 같은 느낌보다는 첨부한 느낌처럼 좀 부드러운 느낌으로").
// Same studio as the Timer's clock (three.js, room light, soft shadows): a puffy rounded cube (a superellipsoid — the faces bulge
// gently into round edges), raised button pips, soft clay / candy / holographic looks. Rolls exactly like the old WebGL dice:
// the page passes the face order and timing, so every screen (and tablet) lands on the same faces at the same moment.
import * as THREE from './three-r170.module.min.js';
import { RoomEnvironment } from './RoomEnvironment.js';

export const LOOKS = {   // the user picked `soft` (A); candy (B) and holo (C) were the other proposals
  soft: { n: 3.9, body: '#FFC21A', pips: ['#2F2B38'], rough: 0.5, coat: 0.45, sheen: 0.35, pipRaise: 0.012 },   // the yellow + dark pips, made soft
  candy: { n: 3.6, body: '#F2609F', pips: ['#FFCF2E', '#3DBF6B', '#3B95E8', '#FF8A26', '#9A6CF2', '#22BDB5'], rough: 0.55, coat: 0.3, sheen: 0.4, pipRaise: 0.012 },   // ref 2
  holo: { n: 4.6, body: null, pips: ['#FFF3E2'], glow: 0.5, rough: 0.3, coat: 1, sheen: 0.15, irid: 0.35, pipRaise: -0.008 },   // ref 1
};
const O = 0.5, PIP_R = 0.21, DEG = Math.PI / 180;
const PIPS = {
  1: [[0, 0]], 2: [[O, O], [-O, -O]], 3: [[0, 0], [O, O], [-O, -O]], 4: [[O, O], [-O, -O], [-O, O], [O, -O]],
  5: [[0, 0], [O, O], [-O, -O], [-O, O], [O, -O]], 6: [[O, O], [-O, -O], [-O, O], [O, -O], [-O, 0], [O, 0]],
};
const FACES = { 1: ['z', 1], 6: ['z', -1], 2: ['x', 1], 5: ['x', -1], 3: ['y', 1], 4: ['y', -1] };   // as the old shader: +z = 1, +x = 2, +y = 3

function puffy(n, seg, holo) {   // cube grid → sphere → superellipsoid |x|ⁿ+|y|ⁿ+|z|ⁿ = 1, with exact normals
  const e = 2 / n, g = new THREE.BoxGeometry(2, 2, 2, seg, seg, seg), P = g.attributes.position, N = g.attributes.normal, v = new THREE.Vector3();
  const col = holo ? new Float32Array(P.count * 3) : null, c = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).normalize();
    const s = [v.x, v.y, v.z], p = s.map(k => Math.sign(k) * Math.abs(k) ** e), q = s.map(k => Math.sign(k) * Math.abs(k) ** (2 - e)), l = Math.hypot(...q) || 1;
    P.setXYZ(i, p[0], p[1], p[2]); N.setXYZ(i, q[0] / l, q[1] / l, q[2] / l);
    if (col) {   // a pastel rainbow across the die: aqua → lilac → pink → peach
      const t = Math.min(1, Math.max(0, (0.62 * q[0] / l - 0.55 * q[1] / l + 0.28 * q[2] / l + 1) / 2));
      c.setHSL(((188 + 220 * t) % 360) / 360, 1, 0.66); col.set([c.r, c.g, c.b], i * 3);
    }
  }
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function createDice(o) {
  const L = LOOKS[o.look] || LOOKS.soft;
  const cv = document.createElement('canvas'); cv.className = 'b-dicegl';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch (e) { return null; }
  renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.32;
  pm.dispose();
  const camera = new THREE.PerspectiveCamera(30, 360 / 220, 1, 40);
  camera.position.set(0, 4.1, 8.6); camera.lookAt(0, 0.35, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8c8782, 0.62));
  const key = new THREE.DirectionalLight(0xfff4ea, 2.0);
  key.position.set(-4.2, 8.6, 5.2); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 7;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 25 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffffff, 0.9); rim.position.set(5, 3, -4.5); scene.add(rim);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: L.body || '#FFFFFF', vertexColors: !L.body, roughness: L.rough, clearcoat: L.coat, clearcoatRoughness: 0.32,
    sheen: L.sheen, sheenRoughness: 0.55, sheenColor: new THREE.Color('#FFFFFF'), iridescence: L.irid || 0, iridescenceIOR: 1.35,
  });
  const pipMats = L.pips.map(cc => new THREE.MeshPhysicalMaterial({ color: cc, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25,
    emissive: L.glow ? new THREE.Color(cc) : new THREE.Color(0), emissiveIntensity: L.glow || 0 }));
  const bodyGeo = puffy(L.n, 44, !L.body), pipGeo = new THREE.SphereGeometry(1, 32, 16);
  const Z = new THREE.Vector3(0, 0, 1);
  const makeDie = () => {
    const g = new THREE.Group(), body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true; body.receiveShadow = true; g.add(body);
    Object.entries(FACES).forEach(([f, [ax, sg]]) => PIPS[f].forEach(([u, v]) => {
      const w = Math.max(0, 1 - Math.abs(u) ** L.n - Math.abs(v) ** L.n) ** (1 / L.n);
      const p = ax === 'z' ? [u, v, sg * w] : ax === 'x' ? [sg * w, v, u] : [u, sg * w, v];
      const q = p.map(k => Math.sign(k) * Math.abs(k) ** (L.n - 1)), nv = new THREE.Vector3(...q).normalize();
      const m = new THREE.Mesh(pipGeo, pipMats[(+f - 1) % pipMats.length]);
      m.scale.set(PIP_R, PIP_R, 0.045); m.quaternion.setFromUnitVectors(Z, nv);
      m.position.set(...p).addScaledVector(nv, L.pipRaise); m.receiveShadow = true; g.add(m);
    }));
    scene.add(g); return g;
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.2 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1.001; ground.receiveShadow = true; scene.add(ground);
  const bc = document.createElement('canvas'); bc.width = bc.height = 128;
  const bx = bc.getContext('2d'), gr = bx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.5, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  bx.fillStyle = gr; bx.fillRect(0, 0, 128, 128);
  const blobTex = new THREE.CanvasTexture(bc);

  const dice = [0, 1].map(i => {
    const f0 = o.seq[(i * 3) % 6];
    const d = { x: o.x[i], a: [o.up[f0][0], i ? -28 : 24, o.up[f0][1]], from: null, to: null, t0: 0, y: 0, g: makeDie() };
    d.blob = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false }));
    d.blob.rotation.x = -Math.PI / 2; scene.add(d.blob);
    return d;
  });
  let raf = 0;
  function draw() {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    const sc = (cv.getBoundingClientRect().width / w) || 1, dpr = Math.min(2.5, (window.devicePixelRatio || 1) * sc);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { renderer.setSize(W, H, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    dice.forEach(d => {
      d.g.position.set(d.x, d.y, 0); d.g.rotation.set(d.a[0] * DEG, d.a[1] * DEG, d.a[2] * DEG, 'YXZ');   // Ry·Rx·Rz, as before
      const k = 1 / (1 + d.y * 0.55);
      d.blob.position.set(d.x + 0.1, -0.995, 0.08); d.blob.scale.setScalar(0.72 + 0.28 * k); d.blob.material.opacity = 0.62 * k;
    });
    renderer.render(scene, camera);
  }
  function frame() {   // a roll: angles glide to the landing (whole turns on the way), a hop with a small bounce
    raf = 0; const now = Date.now(); let busy = false;
    dice.forEach(d => {
      if (!d.to) return;
      const t = Math.min(1, (now - d.t0) / o.roll); if (t < 0) { busy = true; return; }
      const e = 1 - Math.pow(1 - Math.min(1, t / 0.86), 3);
      d.a = d.from.map((v, i) => v + (d.to[i] - v) * e);
      d.y = t < 0.72 ? 1.45 * Math.sin(Math.PI * t / 0.72) : t < 0.9 ? 0.22 * Math.sin(Math.PI * (t - 0.72) / 0.18) : 0;
      if (t >= 1) { d.a = d.to.map(v => ((v % 360) + 360) % 360); d.to = null; d.y = 0; } else busy = true;
    });
    draw();
    if (busy && document.contains(cv)) raf = requestAnimationFrame(frame);
  }
  function roll(k) {   // roll number k (the clock's 4-s slot): both dice land face-up on the sequence, B a beat later
    dice.forEach((d, i) => {
      const f = o.seq[(k + i * 3) % 6], [ux, uz] = o.up[f], yaw = (i ? -28 : 24) + (((k * 37 + i * 53) % 31) - 15);
      const turn = (v0, v1, min) => { let v = v1; while (v - v0 < min) v += 360; return v; };
      d.from = d.a.slice(); d.to = [turn(d.a[0], ux, 360 + (i ? 180 : 0)), turn(d.a[1], yaw, i ? 90 : 0) - (i ? 360 : 0), turn(d.a[2], uz, i ? 360 : 180)];
      d.t0 = k * 4000 + i * o.lag; d.face = f;
    });
    cv.dataset.faces = dice.map(d => d.face).join(',');
    if (!raf) raf = requestAnimationFrame(frame);
  }
  return { cv, draw, roll, dice };
}
