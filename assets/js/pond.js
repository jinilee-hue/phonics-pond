/* Phonics POND · Classroom (concept B, classroom-screen version: the teacher's screen is the classroom screen) — presenter shell for the classroom e-board.
   The student screen is a fixed 16:10 frame: content is made at 1280 × 800 (the academy's activity/tablet size) and the
   dashboard letterboxes it. Teacher view: controls bottom / left / right, notes as a pop-up or a side panel, floating
   board tools, class tools on the student screen (timer, pick a student, eyes on me), the user's phonics games for the
   lesson, share with students. Student view (?view=student): the frame only, mirrored live over BroadcastChannel. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const ic = (n, c) => FP.icon(n, c), esc = FP.esc;
  const root = document.documentElement;
  const qs = new URLSearchParams(location.search);
  const STUDENT = root.dataset.view === 'student';
  const SELF_SRC = document.currentScript ? document.currentScript.src : '';   // where this file lives (the 3D clock module sits next door)
  const CH = 'BroadcastChannel' in window ? new BroadcastChannel('phonics-pond-class') : null;
  const DESIGN = [1280, 800];
  const put = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) { /* private mode */ } };
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };

  /* ---------- colour themes: [id, label, frame, board, action] ---------- */
  const THEMES = [['dark', 'Dark', '#0E1013', '#F6F3EC', '#FFC83D'], ['mint', 'Mint', '#62D4B4', '#FFFFFF', '#D33275'], ['yellow', 'Yellow', '#FFE15A', '#FFFFFF', '#1D1A0F'],
    ['white', 'White', '#FFFFFF', '#FFFFFF', '#0066FF'], ['blue', 'Blue', '#4D8DFF', '#FFFFFF', '#FFD43B'], ['pink', 'Pink', '#FF8DBB', '#FFFFFF', '#3B0F26']];
  function applyTheme(t) { if (!THEMES.some(x => x[0] === t)) t = 'dark'; root.dataset.theme = t; root.dataset.tone = t === 'dark' ? 'dark' : 'bright'; }

  /* ---------- the user's phonics games, matched to the lesson ---------- */
  const GAME_BASE = 'https://jinilee-hue.github.io/';
  // Phonics Match: one board per FPR K unit, six levels each; level k of a unit leads with slot k (slots 4 and 5 share level 4)
  const MATCH = { animals: [[1, 'm a s t p'], [2, 'i c f d'], [3, 'h o r b l'], [4, 'e g x'], [6, 'z']], objects: [[1, 'm a s t p'], [2, 'n i c f d'], [3, 'h r b l'], [4, 'k e g w x'], [5, 'v u j qu y'], [6, 'z']] };
  function matchLevel(L) {
    for (const th of ['animals', 'objects']) {
      const us = MATCH[th];
      for (let i = 0; i < us.length; i++) {
        const sl = us[i][1].split(' '), s = sl.indexOf(L.ltr);
        if (s >= 0) return { theme: th, unit: us[i][0], level: i * 6 + (sl.length === 1 ? 1 : [1, 2, 3, 4, 4][s]) };
      }
    }
    return { theme: 'animals', unit: 6, level: 25 };   // review lessons 27–30 → the Unit 6 board
  }
  const GAMES = [
    { id: 'g-croco', name: 'Croco Phonics', poster: 'croco', path: 'Croco-Phonics/', blurb: 'Crocodile dentist · say the word', has: L => L.n <= 10, q: L => `?level=${L.n}`, sub: L => `Level ${L.n} · ${L.snd}` },
    { id: 'g-magic', name: 'Magic Block', poster: 'magic', path: 'Magic-Block/', blurb: 'Pull a block · read it aloud', has: L => L.n === 1, q: () => '', sub: () => 'm-word tower' },
    { id: 'g-match', name: 'Phonics Match', poster: 'match', path: 'Phonics-Match/', blurb: 'Match three · say the word', has: () => true, q: L => { const m = matchLevel(L); return `?theme=${m.theme}&level=${m.level}`; }, sub: L => { const m = matchLevel(L); return `Unit ${m.unit} · ${m.theme === 'animals' ? 'Animals' : 'Things'} · Level ${m.level}`; } },
    { id: 'g-island', name: 'Phonics Island', poster: 'island', path: 'phonics-island/', blurb: '3D island · lesson stations', has: L => L.n <= 10, q: L => `?start=lesson${L.n}`, sub: L => `Lesson ${L.n} stations` },
  ];
  // class activities that open a game in some lessons (user: Magic Sand is Lesson 1's Handwriting Words, not a game)
  const EXTRA_GAMES = {
    'x-mfh': { name: 'Magic Sand', poster: 'sand', url: 'https://file.koreapolyschool.com/Contents/LCMSContents/temp/glearning/antony/04/', tag: 'Handwriting', icon: 'pen', blurb: 'Trace the letter in magic sand', has: L => L.n === 1, q: () => '', sub: () => 'Magic Sand · trace M and m' },   // POLY G-Learning (Lesson 1 · ④)
  };
  // the lesson's phonics games are Meaning First class activities (user), listed after its own items
  const mfGroup = FP.extras().find(g => g.group === 'Meaning First') || FP.extras()[0];
  const mfBase = mfGroup.items.slice();
  function refreshGames() {
    const L = FP.lesson(); if (!L) return;
    mfGroup.items = [...mfBase, ...GAMES.filter(g => g.has(L) && g.id !== 'g-island').map(g => ({ id: g.id, label: g.name, sub: g.sub(L), group: mfGroup.group, icon: 'gamepad', game: g }))];   // Phonics Island is not a Meaning First activity (user)
    for (const g of FP.extras()) for (const it of g.items) {
      const eg = EXTRA_GAMES[it.id]; if (!eg) continue;
      if (!it.base) it.base = { sub: it.sub, soon: it.soon };
      if (eg.has(L)) Object.assign(it, { game: eg, sub: eg.sub(L), soon: false });
      else { delete it.game; Object.assign(it, it.base); }
    }
  }
  // the same content on the lesson path (user: "activity에 있는거 그 앞에 section에 연결", "handwriting과 meaning first 연결")
  const FLOW_GAMES = [
    { has: (L, sec) => L.n === 1 && sec.name === 'Handwriting', game: () => EXTRA_GAMES['x-mfh'] },   // Lesson 1 › Handwriting › Trace and Write = Magic Sand
  ];
  const MF_GAMES = 3;   // Introduction › Meaning First: step 4 "Games" = the lesson's games (Croco Phonics · Magic Block · Phonics Match)
  const lessonGames = () => { const L = FP.lesson(); return L ? GAMES.filter(g => g.has(L) && g.id !== 'g-island').map(g => ({ id: g.id, label: g.name, sub: g.sub(L), game: g })) : []; };
  function addGamesStep() {   // core builds Meaning First with 3 steps; the games step is added here (also in the classroom-screen window)
    let added = false;
    for (const a of FP.flow()) if (a.id === 'si1' && a.steps.length === MF_GAMES && lessonGames().length) { a.steps = [...a.steps, 'Games']; added = true; }
    return added;
  }
  const flowGame = a => { const L = FP.lesson(), f = L && FLOW_GAMES.find(x => x.has(L, FP.section(), a)); return f ? f.game() : null; };
  const curGame = () => {
    const it = FP.extraInfo(); if (it && it.game) return it;
    if (FP.mode() === 'extra') return null;
    const a = FP.cur(), L = FP.lesson(); if (!a || !L) return null;
    const g = flowGame(a); if (g) return { id: 'f-' + a.id, label: g.name, sub: g.sub(L), game: g };
    if (a.id === 'si1' && FP.state().step === MF_GAMES) { const gs = lessonGames(); return gs.length === 1 ? gs[0] : gs.length ? { id: 'f-si1', label: 'Games', picker: gs } : null; }
    return null;
  };
  const gameUrl = it => (it.game.url || GAME_BASE + it.game.path) + it.game.q(FP.lesson());

  /* ---------- class tools shown on the student screen ---------- */
  let scene = 'lesson', resumeTo = 'lesson';                 // lesson | timer | pick | pause
  const TM = { dur: 60000, left: 60000, endAt: 0, run: false, done: false, windAt: 0 };
  const tLeft = () => (TM.run ? Math.max(0, TM.endAt - Date.now()) : TM.left);
  const tActive = () => TM.run || TM.done || TM.left < TM.dur;
  const PK = { name: '', seq: null, t0: 0 };
  // the class list (sample names; a real list stays in this browser) — declared up here so the classroom screen can use it too
  const DEF_ROSTER = ['Amy', 'Ben', 'Chloe', 'Daniel', 'Ella', 'Finn', 'Grace', 'Henry', 'Ivy', 'Jake', 'Kate', 'Leo'];
  let roster = get('pond-roster', null); if (!Array.isArray(roster) || !roster.length) roster = DEF_ROSTER.slice();
  let picked = new Set((get('pondc-picked', []) || []).filter(n => roster.includes(n)));
  const SPIN = 2600;
  let game = null;                                           // { id, where: 'here' | 'screen' }
  let live = false;
  // where the student screen goes: the classroom screen (a second window), student tablets (needs the class server — preview) or both
  let shareTo = 'none';
  const hasScreen = () => shareTo === 'mirror', hasTablets = () => shareTo !== 'none';   // share = the students' tablets: 'mirror' (same screen as this one) or 'solo' (on their own)
  const TCODE = String(1000 + Math.floor(Math.random() * 9000));   // class code placeholder until the class server exists
  const AV = ['#B85B1A', '#1F7AB6', '#1E8449', '#8E4BD6', '#CF3B3B', '#906C00', '#0D8098', '#C4387F', '#2D8355', '#C94C28'];   // white initials stay ≥ 4.5:1
  const avColor = n => { let h = 7; for (const ch of String(n)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };
  const initial = n => esc((String(n).trim().charAt(0) || '?').toUpperCase());
  const clock = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const lowMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;   // (RM lives in the teacher part; the student window shares this code)
  const sfxOn = () => !STUDENT && get('pondc-sfx', true) !== false;   // Display › Sound effects (user: "17번"); the tablets stay quiet
  function sfx(kind) {   // short classroom signals from this screen only
    if (!sfxOn()) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime + 0.02;
      const tone = (f, d, len, vol = 0.15, type = 'sine') => { const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(vol, t0 + d + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + len); o.connect(g).connect(actx.destination); o.start(t0 + d); o.stop(t0 + d + len + 0.05); };
      if (kind === 'tick') tone(1250, 0, 0.08, 0.13, 'triangle');   // 5·4·3·2·1
      else if (kind === 'drum') {   // one tap of the drum roll (the names slow down, so do the taps)
        const b = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.07), actx.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain(); src.buffer = b; f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.8; g.gain.value = 0.32;
        src.connect(f).connect(g).connect(actx.destination); src.start(t0);
      }
      else if (kind === 'fanfare') [[523, 0, 0.18], [659, 0.12, 0.18], [784, 0.24, 0.2], [1047, 0.38, 0.75]].forEach(([f, d, l]) => { tone(f, d, l, 0.12, 'triangle'); tone(f * 2, d, l * 0.6, 0.03); });
      else if (kind === 'dingdong') { tone(784, 0, 1.0, 0.17); tone(659, 0.42, 1.3, 0.17); }
    } catch (e) { /* no audio */ }
  }
  // the lesson's title page (user: "lesson1에 대한 대문 이미지 … 수업시작을 누르면 시작", "배경이미지는 별도로 줄테니까 … 최대한 비슷하게"):
  // over the board while the lesson waits at its very first step. The picture is only the background; the words and the buttons are
  // real ones, placed on the picture's own grid (1024 units wide, 2752 × 1536 picture) so they keep their spot on it at any screen shape
  const COVERS = { 1: { bg: 'assets/covers/lesson-1-bg.webp?v=2', kicker: 'From Phonics to Reading · K', title: 'Unit 1 · Lesson 1', letter: 'Mm', startSec: 'Alphabet', music: 'assets/covers/main-bgm.mp3' } };   // 수업 시작 → Alphabet's first class (user)   // the speaker key = the music on / off
  let coverOn = false, coverOutT = 0;
  const atLessonStart = () => {   // where opening a lesson lands: Introduction · its first activity · step 1
    const st = FP.state(), fl = FP.flow(), intro = Math.max(0, FP.sections().findIndex(x => x.name === 'Introduction'));
    return !st.extra && st.sec === intro && st.step === 0 && !!fl.length && st.act === (fl.find(x => x.id === 'ls1') ? 'ls1' : fl[0].id);
  };
  const CV_SPK = '<svg viewBox="0 0 42 31" aria-hidden="true"><defs><linearGradient id="cvSpk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#72B8F7"/><stop offset=".55" stop-color="#3F8DEB"/><stop offset="1" stop-color="#2A72DA"/></linearGradient></defs><path d="M4.2 10.2h5.6l8.3-6.7c1.6-1.3 3.9-.2 3.9 1.9v20.2c0 2.1-2.3 3.2-3.9 1.9l-8.3-6.7H4.2A3.2 3.2 0 0 1 1 17.6v-4.2a3.2 3.2 0 0 1 3.2-3.2z" fill="url(#cvSpk)"/><path d="M27.6 10.6a7.2 7.2 0 0 1 0 9.8M33.4 5.8a13.6 13.6 0 0 1 0 19.4" fill="none" stroke="url(#cvSpk)" stroke-width="4" stroke-linecap="round"/></svg>';
  const CV_SPK_OFF = '<svg viewBox="0 0 42 31" aria-hidden="true"><defs><linearGradient id="cvSpk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#72B8F7"/><stop offset=".55" stop-color="#3F8DEB"/><stop offset="1" stop-color="#2A72DA"/></linearGradient></defs><path d="M4.2 10.2h5.6l8.3-6.7c1.6-1.3 3.9-.2 3.9 1.9v20.2c0 2.1-2.3 3.2-3.9 1.9l-8.3-6.7H4.2A3.2 3.2 0 0 1 1 17.6v-4.2a3.2 3.2 0 0 1 3.2-3.2z" fill="url(#cvSpk)"/><path d="M27.4 10.4l9.6 10.2M37 10.4l-9.6 10.2" fill="none" stroke="url(#cvSpk)" stroke-width="4" stroke-linecap="round"/></svg>';
  // clay lettering: the blurred glyph is a bump map lit from the top left — a low specular light shines on the upper edges only, a diffuse
  // light shades the lower ones; the faces keep their colour (bl = bump blur, sc = bump height, sp = shine; all in picture px)
  const CV_CLAY = (id, bl, sc, sp) => `<filter id="${id}" x="-3%" y="-12%" width="106%" height="130%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" data-b0="${bl}" stdDeviation="${bl}" result="b"/>`
    + `<feSpecularLighting in="b" data-s0="${sc}" surfaceScale="${sc}" specularConstant=".95" specularExponent="22" lighting-color="#FFFFFF" result="sp"><feDistantLight azimuth="245" elevation="33"/></feSpecularLighting>`
    + `<feComposite in="sp" in2="SourceAlpha" operator="in" result="spi"/><feComposite in="SourceGraphic" in2="spi" operator="arithmetic" k2="1" k3="${sp}" result="lit"/>`
    + `<feDiffuseLighting in="b" data-s0="${sc}" surfaceScale="${sc}" diffuseConstant="1.14" lighting-color="#FFFFFF" result="df"><feDistantLight azimuth="245" elevation="58"/></feDiffuseLighting>`
    + `<feComposite in="lit" in2="df" operator="arithmetic" k1="1" result="sh"/><feComposite in="sh" in2="SourceAlpha" operator="in"/></filter>`;
  function fitCover() {   // the clay bump grows with the picture (one picture px = u CSS px)
    const el = $('#cover'); if (!el || el.hidden || !el.clientWidth) return;
    const u = Math.max(el.clientWidth / 1024, el.clientHeight / 572);
    el.querySelectorAll('[data-b0]').forEach(f => f.setAttribute('stdDeviation', (+f.dataset.b0 * u).toFixed(2)));
    el.querySelectorAll('[data-s0]').forEach(f => f.setAttribute('surfaceScale', (+f.dataset.s0 * u).toFixed(2)));
  }
  // the title page's music (user: "수업시작전에 lesson1 표지 열어뒀을때 … main-bgm.mp3 음악 나오게"): it loops while the cover is up on the
  // classroom screen — not on the tablets, not under Timer / Pick / Eyes on me — ducks under the spoken title and fades out on 수업 시작;
  // Display › Sound effects Off = quiet. A browser holds sound until the first tap or key: it starts then (unless that was 수업 시작)
  let bgm = null, bgmT = 0, bgmArmed = false, bgmMuted = !sfxOn();   // the speaker key mutes it; Display › Sound effects sets it too
  const bgmWant = () => { const cv = !STUDENT && coverOn && FP.lesson() && COVERS[FP.lesson().n]; return !!(cv && cv.music && scene === 'lesson' && !bgmMuted); };
  function bgmSync() {
    if (STUDENT) return;
    if (bgmWant()) {
      if (!bgm) { bgm = new Audio(COVERS[FP.lesson().n].music); bgm.loop = true; bgm.preload = 'auto'; bgm.volume = 0; ['play', 'pause'].forEach(t => bgm.addEventListener(t, bgmFace)); }
      if (bgm.paused) bgm.play().then(bgmRun).catch(bgmArm); else bgmRun();
    } else if (bgm && !bgm.paused) bgmRun();
  }
  function bgmRun() {   // one gentle loop: fade in (~1 s), duck while the title is spoken, fade out (~0.5 s) and stop
    if (bgmT) return;
    bgmT = setInterval(() => {
      const goal = bgmWant() ? (window.speechSynthesis && speechSynthesis.speaking ? 0.12 : 0.55) : 0, v = bgm.volume, step = goal > v ? 0.05 : 0.08;
      bgm.volume = Math.abs(goal - v) <= step ? goal : v + Math.sign(goal - v) * step;
      if (goal === 0 && bgm.volume === 0) { clearInterval(bgmT); bgmT = 0; bgm.pause(); if (!coverOn) bgm.currentTime = 0; }   // the next cover starts the song again
    }, 80);
  }
  function bgmFace() {   // the speaker shows what the room hears: waves while the music plays, a cross while it's off (or still held by the browser)
    const b = $('#cover [data-b=covermusic]'); if (!b) return;
    const on = !!(bgm && !bgm.paused && !bgmMuted);
    if (b.dataset.on === String(on)) return;
    b.dataset.on = on; b.innerHTML = on ? CV_SPK : CV_SPK_OFF; b.setAttribute('aria-pressed', on);
    b.title = b.ariaLabel = on ? 'Music off' : 'Music on';
  }
  function bgmToggle() {   // playing → quiet; quiet (or held) → play
    bgmMuted = !!(bgm && !bgm.paused && !bgmMuted);
    bgmSync(); bgmFace();
  }
  function bgmArm() {
    if (bgmArmed) return; bgmArmed = true;
    const go = () => { removeEventListener('click', go, true); removeEventListener('keydown', go, true); bgmArmed = false; setTimeout(bgmSync, 0); };   // after that gesture's own action
    addEventListener('click', go, true); addEventListener('keydown', go, true);
  }
  function renderCover() {
    const el = $('#cover'); if (!el) return;
    bgmSync();
    if (!el._ro) { el._ro = new ResizeObserver(fitCover); el._ro.observe(el); }
    const n = FP.lesson() && FP.lesson().n, cv = coverOn && COVERS[n];
    if (!cv) {   // the lesson started: the page lifts away
      if (el.hidden || el.classList.contains('is-out')) return;
      if (lowMotion()) { el.hidden = true; el.innerHTML = ''; return; }
      el.classList.add('is-out'); clearTimeout(coverOutT);
      coverOutT = setTimeout(() => { el.hidden = true; el.innerHTML = ''; el.classList.remove('is-out'); }, 420);
      return;
    }
    clearTimeout(coverOutT); el.classList.remove('is-out');
    if (!el.hidden && el.dataset.n === String(n)) return;
    el.dataset.n = n;
    el.innerHTML = `<svg class="b-cvdefs" width="0" height="0" aria-hidden="true">${CV_CLAY('cvClay', 2.2, 2.6, 0.5)}${CV_CLAY('cvClayS', 1.3, 0.9, 0.18)}</svg><img class="b-cvbg" src="${cv.bg}" alt="" draggable="false"><div class="b-cvui" lang="en"><p class="b-cvkick">${esc(cv.kicker)}</p><h2 class="b-cvtitle">${cv.title.split(' · ').map((t, i) => i ? `<span class="b-cvhl">${esc(t)}</span>` : esc(t)).join(' · ')}</h2><span class="b-cvletter"><b>${esc(cv.letter)}</b></span>${STUDENT ? '' : `<button type="button" class="b-cvstart" data-b="coverstart" lang="ko" title="Start the lesson (→)">수업 시작</button><button type="button" class="b-cvsay" data-b="covermusic" title="Music on" aria-label="Music on" aria-pressed="false" data-on="false">${CV_SPK_OFF}</button>`}</div>`;   // the tablets: no buttons
    el.hidden = false; fitCover(); bgmFace();
  }
  // 8 · two real dice (user: "실제 3d 주사위", then "노란색바탕에 검은색 점 … 두개 정도가 작게 … 모서리들이 끊어지지 않고 부드럽게 이어진
  // 형태의 3d"): a rounded-box mesh drawn with WebGL — smooth rims, lit, soft floor shadows. Every 4 s both hop, tumble and land
  // face-up; faces and timing come from the clock, so the tablets roll alike. One canvas, moved into each new card.
  const DICE_SEQ = [3, 6, 2, 5, 1, 4], DICE_UP = { 1: [-90, 0], 6: [90, 0], 2: [0, 90], 5: [0, -90], 3: [0, 0], 4: [180, 0] };   // [rx, rz] that turn face f up
  const DICE_X = [-1.62, 1.62], DICE_ROLL = 1150, DICE_LAG = 150;
  let DG = null;
  const dice3d = () => `<span class="b-dice" aria-hidden="true"></span>`;
  function diceGL() {
    if (DG !== null) return DG;
    const cv = document.createElement('canvas'); cv.className = 'b-dicegl';
    const gl = cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl) return (DG = false);
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null; };
    const pd = prog(`attribute vec3 aP; attribute vec3 aN; uniform mat4 uM; uniform mat4 uVP; varying vec3 vO; varying vec3 vN; varying vec3 vW;
      void main() { vO = aP; vN = mat3(uM) * aN; vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; gl_Position = uVP * w; }`,
      `precision mediump float; varying vec3 vO; varying vec3 vN; varying vec3 vW; uniform vec3 uCam;
      float pip(vec2 uv, vec2 c) { return 1.0 - smoothstep(0.148, 0.178, length(uv - c)); }
      float rim(vec2 uv, vec2 c) { float d = length(uv - c); return smoothstep(0.15, 0.19, d) * (1.0 - smoothstep(0.19, 0.26, d)); }
      void main() {
        vec3 a = abs(vO); vec2 uv; float f;
        if (a.z >= a.x && a.z >= a.y) { uv = vO.xy; f = vO.z > 0.0 ? 1.0 : 6.0; }
        else if (a.x >= a.y) { uv = vO.zy; f = vO.x > 0.0 ? 2.0 : 5.0; }
        else { uv = vO.xz; f = vO.y > 0.0 ? 3.0 : 4.0; }
        float o = 0.47, d = 0.0, r = 0.0;
        if (f == 1.0 || f == 3.0 || f == 5.0) { d = max(d, pip(uv, vec2(0.0))); r = max(r, rim(uv, vec2(0.0))); }
        if (f >= 2.0) { d = max(d, max(pip(uv, vec2(o, o)), pip(uv, vec2(-o, -o)))); r = max(r, max(rim(uv, vec2(o, o)), rim(uv, vec2(-o, -o)))); }
        if (f >= 4.0) { d = max(d, max(pip(uv, vec2(-o, o)), pip(uv, vec2(o, -o)))); r = max(r, max(rim(uv, vec2(-o, o)), rim(uv, vec2(o, -o)))); }
        if (f == 6.0) { d = max(d, max(pip(uv, vec2(-o, 0.0)), pip(uv, vec2(o, 0.0)))); r = max(r, max(rim(uv, vec2(-o, 0.0)), rim(uv, vec2(o, 0.0)))); }
        vec3 n = normalize(vN), L = normalize(vec3(-0.42, 0.86, 0.52)), V = normalize(uCam - vW), H = normalize(L + V);
        float df = max(dot(n, L), 0.0), sp = pow(max(dot(n, H), 0.0), 46.0), fr = pow(1.0 - max(dot(n, V), 0.0), 2.2);
        vec3 body = vec3(1.0, 0.80, 0.17) * (1.0 - 0.10 * r);
        vec3 base = mix(body, vec3(0.10, 0.09, 0.07), d);
        vec3 col = base * (0.52 + 0.60 * df) + vec3(1.0, 0.98, 0.9) * sp * (0.42 - 0.3 * d) + vec3(1.0, 0.86, 0.4) * fr * 0.16;
        gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
      }`);
    const ps = prog(`attribute vec3 aP; uniform mat4 uM; uniform mat4 uVP; varying vec2 vU; void main() { vU = aP.xz; gl_Position = uVP * uM * vec4(aP, 1.0); }`,
      `precision mediump float; varying vec2 vU; uniform float uA; void main() { float k = 1.0 - smoothstep(0.15, 1.0, length(vU)); gl_FragColor = vec4(0.0, 0.0, 0.0, k * k * uA); }`);
    if (!pd || !ps) return (DG = false);
    // the rounded box: each face a grid, denser on the rims (equal angles), pushed out onto the rim radius
    const R = 0.34, M = 7, ax = [], P = [], N = [], I = [];
    for (let k = 0; k <= M; k++) ax.push(-1 + R * (1 - Math.cos(Math.PI / 2 * k / M)));
    for (let k = 1; k < 4; k++) ax.push(-1 + R + (2 - 2 * R) * k / 4);
    for (let k = M; k >= 0; k--) ax.push(1 - R * (1 - Math.cos(Math.PI / 2 * k / M)));
    const G = ax.length, cl = v => Math.max(-(1 - R), Math.min(1 - R, v));
    [[2, 0, 1], [0, 1, 2], [1, 2, 0]].forEach(([na, ua, va]) => [1, -1].forEach(sg => {
      const base = P.length / 3;
      for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
        const q = [0, 0, 0]; q[na] = sg; q[ua] = ax[i]; q[va] = ax[j];
        const c = q.map(cl), dv = [q[0] - c[0], q[1] - c[1], q[2] - c[2]], l = Math.hypot(...dv);
        const n = l > 1e-6 ? dv.map(x => x / l) : [0, 0, 0].map((_, k) => (k === na ? sg : 0));
        P.push(c[0] + n[0] * R, c[1] + n[1] * R, c[2] + n[2] * R); N.push(...n);
      }
      for (let i = 0; i < G - 1; i++) for (let j = 0; j < G - 1; j++) { const v = base + i * G + j; I.push(v, v + G, v + 1, v + 1, v + G, v + G + 1); }
    }));
    const buf = (data, kind = gl.ARRAY_BUFFER) => { const b = gl.createBuffer(); gl.bindBuffer(kind, b); gl.bufferData(kind, data, gl.STATIC_DRAW); return b; };
    const bP = buf(new Float32Array(P)), bN = buf(new Float32Array(N)), bI = buf(new Uint16Array(I), gl.ELEMENT_ARRAY_BUFFER), bQ = buf(new Float32Array([-1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0, 1]));
    // matrices (column-major)
    const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let t = 0; for (let k = 0; k < 4; k++) t += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = t; } return o; };
    const persp = (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); };
    const look = (e, c) => {
      const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]], zl = Math.hypot(...z); z.forEach((v, i) => (z[i] = v / zl));
      const x = [z[2], 0, -z[0]], xl = Math.hypot(...x); x.forEach((v, i) => (x[i] = v / xl));
      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]);
    };
    const rot = (rx, ry, rz) => {   // Ry · Rx · Rz (degrees): the up face from rx / rz, the turn on the floor from ry
      const [a, b, c] = [rx, ry, rz].map(v => v * Math.PI / 180), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
      const X = new Float32Array([1, 0, 0, 0, 0, ca, sa, 0, 0, -sa, ca, 0, 0, 0, 0, 1]), Y = new Float32Array([cb, 0, -sb, 0, 0, 1, 0, 0, sb, 0, cb, 0, 0, 0, 0, 1]), Z = new Float32Array([cc, sc, 0, 0, -sc, cc, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      return mul(Y, mul(X, Z));
    };
    const at = (x, y, z, sx = 1, sz = sx) => new Float32Array([sx, 0, 0, 0, 0, 1, 0, 0, 0, 0, sz, 0, x, y, z, 1]);
    const CAM = [0, 4.1, 8.6], VIEW = look(CAM, [0, 0.35, 0]);
    const dice = [0, 1].map(i => ({ x: DICE_X[i], a: [DICE_UP[DICE_SEQ[(i * 3) % 6]][0], i ? -28 : 24, DICE_UP[DICE_SEQ[(i * 3) % 6]][1]], from: null, to: null, t0: 0, y: 0 }));
    let raf = 0;
    function draw() {
      const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
      const sc = (cv.getBoundingClientRect().width / w) || 1, dpr = Math.min(2.5, (window.devicePixelRatio || 1) * sc);
      const W = Math.round(w * dpr), H = Math.round(h * dpr); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const VP = mul(persp(30 * Math.PI / 180, w / h, 1, 40), VIEW);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);
      gl.useProgram(ps); gl.bindBuffer(gl.ARRAY_BUFFER, bQ); const qp = gl.getAttribLocation(ps, 'aP'); gl.enableVertexAttribArray(qp); gl.vertexAttribPointer(qp, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(gl.getUniformLocation(ps, 'uVP'), false, VP);
      dice.forEach(d => { const k = 1 / (1 + d.y * 0.55); gl.uniformMatrix4fv(gl.getUniformLocation(ps, 'uM'), false, at(d.x + 0.12, -0.995, 0.1, 1.55 * (0.7 + 0.3 * k))); gl.uniform1f(gl.getUniformLocation(ps, 'uA'), 0.42 * k); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); });
      gl.disableVertexAttribArray(qp);
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.useProgram(pd);
      const ap = gl.getAttribLocation(pd, 'aP'), an = gl.getAttribLocation(pd, 'aN');
      gl.bindBuffer(gl.ARRAY_BUFFER, bP); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bN); gl.enableVertexAttribArray(an); gl.vertexAttribPointer(an, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bI);
      gl.uniformMatrix4fv(gl.getUniformLocation(pd, 'uVP'), false, VP); gl.uniform3fv(gl.getUniformLocation(pd, 'uCam'), CAM);
      dice.forEach(d => { gl.uniformMatrix4fv(gl.getUniformLocation(pd, 'uM'), false, mul(at(d.x, d.y, 0), rot(...d.a))); gl.drawElements(gl.TRIANGLES, I.length, gl.UNSIGNED_SHORT, 0); });
      gl.disableVertexAttribArray(ap); gl.disableVertexAttribArray(an);
    }
    function frame() {   // a roll: angles glide to the landing (whole turns on the way), a hop with a small bounce
      raf = 0; const now = Date.now(); let busy = false;
      dice.forEach(d => {
        if (!d.to) return;
        const t = Math.min(1, (now - d.t0) / DICE_ROLL); if (t < 0) { busy = true; return; }
        const e = 1 - Math.pow(1 - Math.min(1, t / 0.86), 3);
        d.a = d.from.map((v, i) => v + (d.to[i] - v) * e);
        d.y = t < 0.72 ? 1.45 * Math.sin(Math.PI * t / 0.72) : t < 0.9 ? 0.22 * Math.sin(Math.PI * (t - 0.72) / 0.18) : 0;
        if (t >= 1) { d.a = d.to.map(v => ((v % 360) + 360) % 360); d.to = null; d.y = 0; } else busy = true;
      });
      draw();
      if (busy && document.contains(cv)) raf = requestAnimationFrame(frame);
    }
    function roll(k) {   // roll number k (the clock's 4-s slot): both dice land face-up on DICE_SEQ, B a beat later
      dice.forEach((d, i) => {
        const f = DICE_SEQ[(k + i * 3) % 6], [ux, uz] = DICE_UP[f], yaw = (i ? -28 : 24) + (((k * 37 + i * 53) % 31) - 15);
        const turn = (v0, v1, min) => { let v = v1; while (v - v0 < min) v += 360; return v; };   // land on the face after whole turns
        d.from = d.a.slice(); d.to = [turn(d.a[0], ux, 360 + (i ? 180 : 0)), turn(d.a[1], yaw, i ? 90 : 0) - (i ? 360 : 0), turn(d.a[2], uz, i ? 360 : 180)];
        d.t0 = k * 4000 + i * DICE_LAG; d.face = f;
      });
      cv.dataset.faces = dice.map(d => d.face).join(',');
      if (!raf) raf = requestAnimationFrame(frame);
    }
    DG = { cv, draw, roll, dice };
    return DG;
  }
  function diceLoop(slot) {
    if (!slot) return;
    const g = diceGL();
    if (!g) { slot.innerHTML = ic('dices'); slot.classList.add('is-icon'); return; }   // no WebGL: the dice icon as before
    slot.appendChild(g.cv); requestAnimationFrame(() => g.draw());
    if (lowMotion()) return;
    clearTimeout(g.timer);
    const next = () => {
      if (!document.contains(g.cv)) return;
      g.roll(Math.floor(Date.now() / 4000));
      g.timer = setTimeout(next, 4000 - (Date.now() % 4000) + 5);
    };
    g.timer = setTimeout(next, Math.max(450, 4000 - (Date.now() % 4000) + 5));
  }
  const PSLABS = Array.from({ length: 12 }, (_, i) => `<i class="b-pslab" style="transform:translateZ(${-2.5 * (i + 1)}px);--m:${84 - i * 2.4}%"></i>`).join('');   // the Eyes-on-me block's thickness
  function timeUpStars(f) {   // 5 · stars burst from the clock when time is up
    const s = f.querySelector('.b-tstars'); if (!s || lowMotion()) return;
    const C = ['#FFC53D', '#FF7A59', '#4CC38A', '#5AA9FF', '#C084FC', '#FF6FA8'];
    s.innerHTML = Array.from({ length: 18 }, (_, i) => `<i style="--a:${i * 20 + (i % 2 ? 8 : -6)}deg;--d:${250 + (i % 3) * 55}px;--c:${C[i % C.length]};--dl:${(i % 4) * 0.04}s"><svg viewBox="0 0 24 24"><path d="M12 2.6l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z"/></svg></i>`).join('');
  }
  let rainT = 0;   // the reveal that already had its fanfare

  function addLayers() {
    $('#stage').insertAdjacentHTML('beforeend', `<div class="b-media" id="media" hidden></div><div class="b-game" id="game" hidden></div><div class="b-cover" id="cover" hidden></div><div class="b-scene" id="scene" hidden></div><div class="b-over"><button type="button" class="b-ctimer" id="ctimer" data-b="scene" data-v="timer" title="Timer"${STUDENT ? ' tabindex="-1"' : ''} hidden></button></div>`);
  }

  // the Timer's alarm clock in real 3D (user: "알람시계의 볼륨감도 … 래퍼런스 참고해서 … 모션도 자연스럽게 신나게"): three.js in assets/clock3d,
  // loaded the first time the Timer opens; one canvas, moved into each new clock; no WebGL → the layered SVG clock stays
  const RING_MS = 2800;
  let CK = null, ckWait = null;
  function clock3d(box) {
    if (!box) return;
    if (!ckWait && location.protocol === 'file:') ckWait = Promise.resolve(CK = false);   // modules don't load from file:// — the SVG clock
    if (!ckWait) {
      const u = new URL('../clock3d/clock3d.js', SELF_SRC || location.href);
      if (SELF_SRC) u.search = new URL(SELF_SRC).search;   // the published build's ?v= keeps the module fresh too
      ckWait = import(u.href).then(m => (CK = m.create() || false)).catch(() => (CK = false));
    }
    ckWait.then(() => { if (!CK || !box.isConnected) return; box.prepend(CK.canvas); box.classList.add('is-gl'); CK.reset(); });
  }
  function dialP(left) {   // the slice's share of the face: time left; a fresh start winds up from nothing
    let p = TM.dur ? Math.max(0, Math.min(1, left / TM.dur)) : 0;
    const w = TM.windAt && TM.run && !lowMotion() ? (Date.now() - TM.windAt) / 700 : 1;
    return w >= 0 && w < 1 ? p * (1 - Math.pow(1 - w, 3)) : p;
  }
  function ckFrame(f) {
    if (!CK || !CK.canvas.isConnected) return;
    const k = root.dataset.theme + '|' + f.dataset.zone + '|' + f.className;
    if (f._ckKey !== k) { const cs = getComputedStyle(f); f._ckKey = k; f._ckCol = [cs.getPropertyValue('--tm').trim(), cs.getPropertyValue('--tpie').trim() || cs.getPropertyValue('--tm-pie').trim()]; }
    const left = tLeft();
    CK.frame({ st: f.dataset.st, left, p: dialP(left), cd: +(f.dataset.cd || 0), windAt: TM.run ? TM.windAt : 0, ring: f.classList.contains('is-ring'), reduced: lowMotion(), body: f._ckCol[0], pie: f._ckCol[1] });
  }
  function ringNow(f) { f.classList.add('is-ring'); clearTimeout(f._ringT); f._ringT = setTimeout(() => f.classList.remove('is-ring'), RING_MS); }   // 5 · it rings: arcs + bolts, the 3D clock bounces
  const BOLT = 'M6-38L-16 6H0L-8 38L18-8H2L10-38Z';
  const RRING = `<span class="b-tring" aria-hidden="true"><svg viewBox="0 0 600 600"><g class="arcs"><path d="M112 170q-34-52 4-108"/><path d="M70 194q-54-80 6-166"/><path d="M488 170q34-52-4-108"/><path d="M530 194q54-80-6-166"/></g><g class="bolts">${[[34, 318, -24], [566, 318, 24], [178, 6, -38], [422, 6, 38]].map(([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="${BOLT}"/></g>`).join('')}</g></svg></span>`;   // sound arcs + lightning (the references)
  const RR = 300, RC = 2 * Math.PI * RR;
  let pickIdx = -2;
  function renderScene() {
    const el = $('#scene'); if (!el) return;
    if (el.dataset.scene === 'pause' && scene !== 'pause' && !el.hidden && el.firstElementChild && !lowMotion()) {   // 16 · leaving "Eyes on me": a wink, then the block spins away
      const out = document.createElement('div'); out.className = 'b-scene b-sceneout'; out.appendChild(el.firstElementChild); el.after(out); setTimeout(() => out.remove(), 560);
    }
    const show = scene === 'timer' || scene === 'pick' || scene === 'pause';   // every class tool stays inside the 16:10 frame
    el.hidden = !show; el.dataset.scene = show ? scene : '';
    if (!show) { el.innerHTML = ''; tick(); return; }
    if (scene === 'timer') {
      // a 3D alarm clock (user: "시계도 3d로"): the clock's outline is stacked in thin slices behind the dial, so it shows a real thickness
      // when it turns; the hand and the little face float just above the dial
      const dot = i => { const a = i * Math.PI / 6, big = i % 3 === 0; return `<circle cx="${(300 + 166 * Math.sin(a)).toFixed(1)}" cy="${(330 - 166 * Math.cos(a)).toFixed(1)}" r="${big ? 8 : 5.5}"/>`; };
      const SIL = '<circle cx="300" cy="330" r="226"/><path transform="translate(157 125) rotate(-35)" d="M-62 18A62 62 0 0 1 62 18Z"/><path transform="translate(443 125) rotate(35)" d="M-62 18A62 62 0 0 1 62 18Z"/><circle cx="300" cy="70" r="16"/><path class="ln" d="M300 106V82M200 503 137 539M400 503 463 539"/>';
      const slabs = Array.from({ length: 16 }, (_, i) => `<svg class="b-tslab" viewBox="0 0 600 600" style="transform:translateZ(${-2.5 * (i + 1)}px);--m:${84 - i * 2}%">${SIL}</svg>`).join('');
      el.innerHTML = `<div class="b-fit"><div class="b-tm" id="tFull"${STUDENT ? '' : ' data-b="tgo" title="Tap to start or pause"'}>
        <div class="b-tclock" aria-hidden="true"><span class="b-tshadow"></span><div class="b-t3d"><div class="b-tbody">${slabs}
          <svg class="b-tfront" viewBox="0 0 600 600">
            <defs><radialGradient id="tBodyG" cx="36%" cy="28%" r="80%"><stop offset="0" class="g0"/><stop offset=".55" class="g1"/><stop offset="1" class="g2"/></radialGradient><radialGradient id="tFaceG" cx="42%" cy="36%" r="68%"><stop offset=".72" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E4E0D9"/></radialGradient></defs>
            <g class="rings"><path d="M92 156q-24-44 8-86"/><path d="M60 170q-34-62 10-118"/><path d="M508 156q24-44-8-86"/><path d="M540 170q34-62-10-118"/></g>
            <g class="legs"><path d="M200 503 137 539"/><path d="M400 503 463 539"/></g>
            <g class="bells"><path transform="translate(157 125) rotate(-35)" d="M-62 18A62 62 0 0 1 62 18Z"/><path transform="translate(443 125) rotate(35)" d="M-62 18A62 62 0 0 1 62 18Z"/></g>
            <path class="stem" d="M300 106V82"/><circle class="cap" cx="300" cy="70" r="16"/>
            <circle class="body" cx="300" cy="330" r="226"/><path class="gloss" d="M104.5 258.9A208 208 0 0 1 228.9 134.5"/><circle class="face" cx="300" cy="330" r="190"/>
            <g class="dots">${Array.from({ length: 12 }, (_, i) => dot(i)).join('')}</g>
            <path class="pie" id="tPie"/>
          </svg>
          <svg class="b-thand" viewBox="0 0 600 600"><line class="hand-halo" id="tHalo" x1="300" y1="330" x2="300" y2="170"/><line class="hand" id="tHand" x1="300" y1="330" x2="300" y2="170"/></svg>
          <svg class="b-tfacep" viewBox="0 0 600 600"><g class="b-tface" id="tFace"><circle class="hd" cx="300" cy="330" r="60"/><g class="ey"><ellipse class="sc" cx="277" cy="326" rx="18" ry="24"/><circle class="pu" cx="277" cy="326" r="10"/><circle class="hl" cx="281" cy="321" r="3.4"/></g><g class="ey"><ellipse class="sc" cx="323" cy="326" rx="18" ry="24"/><circle class="pu" cx="323" cy="326" r="10"/><circle class="hl" cx="327" cy="321" r="3.4"/></g><path class="shut" d="M263 330q14 12 28 0M309 330q14 12 28 0"/></g></svg>
        </div></div><span class="b-tzzz"><b>z</b><b>z</b><b>Z</b></span><span class="b-tstars"></span>${RRING}</div>
        <b class="b-tnum" id="tBig"></b>
      </div></div>`;
      dialLoop(); clock3d(el.querySelector('.b-tclock'));
    }
    else if (scene === 'pick') { el.innerHTML = '<div class="b-fit"><div class="b-pick" id="pickView"></div></div>'; pickIdx = -2; drawPick(); }
    else { el.innerHTML = `<div class="b-fit"><div class="b-spause"${STUDENT ? '' : ' data-b="scene" data-v="pause" title="Back to the lesson (B)"'}>${!STUDENT && live ? '<span class="b-spchip"><i class="b-live" aria-hidden="true"></i>Tablets · paused</span>' : ''}<span class="b-pausel b-attn b-p3d" aria-hidden="true"><span class="b-pspin"><span class="b-pbody">${PSLABS}<span class="b-pface"><svg viewBox="0 0 200 140" aria-hidden="true"><g class="eye"><ellipse class="sc" cx="60" cy="70" rx="44" ry="56"/><circle class="pu" cx="64" cy="80" r="23"/><circle class="hl" cx="73" cy="69" r="7.5"/></g><g class="eye"><ellipse class="sc" cx="140" cy="70" rx="44" ry="56"/><circle class="pu" cx="144" cy="80" r="23"/><circle class="hl" cx="153" cy="69" r="7.5"/></g></svg></span></span></span></span><p lang="en">Eyes on me!</p><p class="b-spreply" lang="en">Eyes on you!</p></div></div>`; }
    tick();
  }
  // Pick a student: one card in the middle — "Who's next?", the names roll in the same spot, then the reveal
  function fitName(b, min) { if (!b) return; b.style.fontSize = ''; let fs = parseFloat(getComputedStyle(b).fontSize); while (b.scrollWidth > b.clientWidth + 1 && fs > min) { fs -= 2; b.style.fontSize = fs + 'px'; } }
  function drawPick() {
    const v = $('#pickView'); if (!v) return;
    const t = PK.name ? (Date.now() - PK.t0) / SPIN : 0, spinning = !!(PK.name && PK.seq) && t < 1;
    const k = !PK.name ? -1 : spinning ? Math.min(PK.seq.length - 1, Math.floor((1 - Math.pow(1 - Math.max(0, t), 2.6)) * PK.seq.length)) : 1e6;
    if (k !== pickIdx) {
      pickIdx = k;
      if (k === -1) {   // 8 · waiting: classmates float around like pond bubbles (12 at most — those still to go first), the dice rolls
        const kids = [...roster.filter(n => !picked.has(n)), ...roster.filter(n => picked.has(n))].slice(0, 12), N = kids.length;
        const bub = kids.map((n, i) => { const a = (120 + (i + 0.5) * 300 / N) * Math.PI / 180; return `<span class="b-pkbub" style="left:${(50 + 39 * Math.cos(a)).toFixed(1)}%;top:${(47 + 37 * Math.sin(a)).toFixed(1)}%;--c:${avColor(n)};--t:${(3 + (i % 4) * 0.45).toFixed(2)}s;--d:${(-i * 0.37).toFixed(2)}s;--sx:${i % 2 ? 6 : -6}px">${initial(n)}</span>`; }).join('');   // the bottom 60° stays clear (the name, the button)
        v.innerHTML = `<div class="b-pkbubs" aria-hidden="true">${bub}</div><div class="b-pkcard is-wait"${STUDENT ? '' : ' data-b="pickrand" title="Tap to pick a student"'}><span class="b-pkav">${dice3d()}</span><b lang="en">Who’s next?</b><span class="b-pkcap is-quiet" aria-hidden="true"></span></div>`;
        diceLoop(v.querySelector('.b-dice'));
      }
      else {
        const n = spinning ? PK.seq[k] : PK.name;
        const burst = spinning ? '' : `<span class="b-pkburst" aria-hidden="true">${Array.from({ length: 13 }, (_, i) => `<i style="--a:${-120 + i * 20}deg;--d:${i % 2 ? 184 : 222}px;--c:${AV[(i * 3) % AV.length]}"></i>`).join('')}</span>`;   // an arc over the head, clear of the name
        const fresh = !spinning && PK.t0 !== rainT && Date.now() - PK.t0 < SPIN + 1200, c = avColor(n);   // 10 · the reveal right after the roll (a re-render stays calm)
        if (fresh) rainT = PK.t0;
        if (spinning) sfx('drum'); else if (fresh) sfx('fanfare');   // 9 · a drum tap per name; the fanfare on the reveal
        const rain = fresh && !lowMotion() ? `<span class="b-pkrain" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="left:${(i * 37) % 100}%;--c:${i % 3 === 0 ? c : i % 3 === 1 ? `color-mix(in srgb, ${c} 50%, #fff)` : 'var(--acc)'};--r:${(i * 47) % 360}deg;--dl:${((i * 13) % 10) * 0.06}s;--du:${(1.6 + (i % 5) * 0.18).toFixed(2)}s"></i>`).join('')}</span>` : '';   // confetti in the child's colour
        v.innerHTML = `${rain}<div class="b-pkcard ${spinning ? 'is-spin' : 'is-pick'}${fresh ? ' is-fresh' : ''}"${STUDENT || spinning ? '' : ' data-b="pickrand" title="Tap to pick again"'}><span class="b-pkhalo">${burst}<span class="b-pkav" style="--c:${avColor(n)}">${initial(n)}</span></span><b lang="en">${esc(n)}</b>${spinning ? '<span class="b-pkcap is-quiet">Picking…</span>' : `<span class="b-pkcap">${ic('sparkles')}It’s your turn!</span>`}</div>`;
        fitName(v.querySelector('.b-pkcard b'), 64);
      }
    }
    if (spinning) requestAnimationFrame(drawPick);
  }
  function tick() {
    const left = tLeft();
    if (TM.run && left <= 0) { TM.run = false; TM.left = 0; TM.done = true; if (!STUDENT) { chime(); renderDock(); broadcast(); if (dialOpen && scene === 'timer') renderLayer(); } }
    const f = $('#tFull');
    if (f) {
      const st = TM.done ? 'done' : TM.run ? 'run' : left < TM.dur ? 'paused' : 'ready';
      const cd = TM.run && left > 0 && left <= 5000 ? Math.ceil(left / 1000) : 0, big = $('#tBig');   // 4 · 5·4·3·2·1
      big.textContent = st === 'done' ? 'Time’s up!' : cd ? String(cd) : clock(left);
      if (TM.done && !f.classList.contains('is-done') && f._ran) { timeUpStars(f); ringNow(f); }   // 5 · the moment time is up (not when the scene reopens later)
      if (TM.run) f._ran = true;
      f.dataset.st = st;
      f.dataset.zone = TM.done ? '' : left <= 10000 ? 'red' : TM.dur && left / TM.dur <= 0.5 ? 'amber' : 'green';   // 3 · traffic lights
      f.classList.toggle('is-low', TM.run && left <= 10000); f.classList.toggle('is-done', TM.done); f.classList.toggle('is-cd', !!cd);
      if (cd && f.dataset.cd !== String(cd)) { f.dataset.cd = cd; if (!lowMotion()) big.animate([{ transform: 'perspective(500px) rotateX(-80deg) scale(1.7)', opacity: 0 }, { transform: 'perspective(500px) rotateX(0deg) scale(1)', opacity: 1, offset: 0.6 }, { transform: 'perspective(500px) rotateX(0deg) scale(1)', opacity: 1 }], { duration: 620, easing: 'cubic-bezier(.2,1.3,.4,1)' }); sfx('tick'); }
      else if (!cd) delete f.dataset.cd;
      drawDial(left);
    }
    const ct = $('#ctimer');
    if (ct) {
      const on = scene !== 'timer' && scene !== 'pause' && tActive();
      ct.hidden = !on;
      if (on) {
        const r = 17, c = 2 * Math.PI * r, p = TM.dur ? left / TM.dur : 0;
        ct.classList.toggle('is-low', TM.run && left <= 10000); ct.classList.toggle('is-done', TM.done);
        ct.innerHTML = `<svg viewBox="0 0 44 44" aria-hidden="true"><circle class="bg" cx="22" cy="22" r="${r}"/><circle class="fg" cx="22" cy="22" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - p)).toFixed(1)}"/></svg><b>${TM.done ? 'Time’s up!' : clock(left)}</b>`;
      }
    }
    const dt = $('#dockTimer'); if (dt) dt.textContent = TM.done ? 'Time’s up!' : clock(left);
    const lt = $('#lyTimer'); if (lt) lt.textContent = TM.done ? 'Time’s up!' : clock(left);
  }
  function drawDial(left) {   // the slice shrinks back to 12 o'clock and the hand rides its edge
    const pie = $('#tPie'), hand = $('#tHand'); if (!pie) return;
    let p = TM.dur ? Math.max(0, Math.min(1, left / TM.dur)) : 0;
    const w = TM.windAt && TM.run && !lowMotion() ? (Date.now() - TM.windAt) / 700 : 1;
    if (w >= 0 && w < 1) p *= 1 - Math.pow(1 - w, 3);   // 1 · a fresh start winds up from nothing
    const f = $('#tFull'); if (f) f.classList.toggle('is-wind', w >= 0 && w < 1);
    const a = p * 2 * Math.PI, R = 152, cx = 300, cy = 330;
    const x = (cx - R * Math.sin(a)).toFixed(2), y = (cy - R * Math.cos(a)).toFixed(2);
    pie.setAttribute('d', p >= 0.9995 ? `M${cx} ${cy - R}a${R} ${R} 0 1 0 0.01 0Z` : p <= 0 ? '' : `M${cx} ${cy}L${x} ${y}A${R} ${R} 0 ${p > 0.5 ? 1 : 0} 1 ${cx} ${cy - R}Z`);
    const hx = (cx - 160 * Math.sin(a)).toFixed(2), hy = (cy - 160 * Math.cos(a)).toFixed(2), halo = $('#tHalo');
    hand.setAttribute('x2', hx); hand.setAttribute('y2', hy); if (halo) { halo.setAttribute('x2', hx); halo.setAttribute('y2', hy); }
    const face = $('#tFace');   // 7 · the eyes follow the hand; time's up: they look up at the bells
    if (face) {
      const ang = Math.atan2(+hy - cy, +hx - cx), dx = TM.done ? 0 : 6 * Math.cos(ang), dy = TM.done ? -9 : 8 * Math.sin(ang);
      face.querySelectorAll('.ey').forEach((g, i) => { const ex = i ? 323 : 277, pu = g.querySelector('.pu'), hl = g.querySelector('.hl'); pu.setAttribute('cx', (ex + dx).toFixed(1)); pu.setAttribute('cy', (326 + dy).toFixed(1)); hl.setAttribute('cx', (ex + dx + 4).toFixed(1)); hl.setAttribute('cy', (321 + dy).toFixed(1)); });
    }
  }
  let dialRaf = 0;
  function dialLoop() {   // the slice and the hand move smoothly while the timer runs on screen; the 3D clock draws every frame (one loop only)
    cancelAnimationFrame(dialRaf);
    const f = $('#tFull'); if (!f) return;
    if (TM.run) drawDial(tLeft());
    ckFrame(f);
    dialRaf = requestAnimationFrame(dialLoop);
  }
  let actx = null;
  function chime() {   // three soft rising tones when the timer ends (teacher window only: it always has a user gesture)
    if (!sfxOn()) return;   // Display › Sound effects: Off
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime + 0.03;
      [[784, 0], [988, 0.2], [1319, 0.4]].forEach(([f, d]) => {
        const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(0.2, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.9);
        o.connect(g).connect(actx.destination); o.start(t0 + d); o.stop(t0 + d + 1);
      });
    } catch (e) { /* no audio */ }
  }

  /* ---------- produced class media (videos) in the student-screen frame ---------- */
  // Files live in assets/media/ (published with the shared preview — the user OK'd it). `all` = every lesson, numbers = one lesson.
  const ABC = { title: 'ABC Song', files: ['abc-song.mp4'] };   // the A–Z song, also on the Alphabet section (user picked: L1 Uppercase Letters · Letter Sequence, L2 Lowercase Letters)
  const MEDIA = {
    all: {
      'x-abc': { title: 'ABC Song', files: ['abc-song.mp4'] },                                   // Class activities › Songs › Alphabet Song (A–Z, same song in every lesson)
    },
    1: {
      's0-0': ABC, 's0-1': ABC,                                                                 // Alphabet › Uppercase Letters, Letter Sequence
      'x-chant': { title: 'Sound & Rhythm Chant', files: ['l1-chant-1.mp4', 'l1-chant-2.mp4', 'l1-chant-3.mp4', 'l1-chant-4.mp4'] },   // Class activities › Chant (stage 1–4 in a row)
      ls1: { title: 'Sound Chant', steps: [['l1-chant-1.mp4'], ['l1-chant-2.mp4'], ['l1-chant-3.mp4'], ['l1-chant-4.mp4'],
        ['l1-chant-1.mp4', 'l1-chant-2.mp4', 'l1-chant-3.mp4', 'l1-chant-4.mp4']] },          // step 5 "All together" plays 1–4 in a row
    },
    2: { 's0-0': ABC },                                                                         // Alphabet › Lowercase Letters
  };
  const hasVideo = id => { const L = FP.lesson(); return !!(L && ((MEDIA[L.n] || {})[id] || MEDIA.all[id])); };   // the menus mark activities with a video
  const MD = { key: '', idx: 0, playing: false, pos: 0, at: 0 };   // the teacher's window owns this; the classroom screen follows it
  const DUR = {};
  let mEl = null, mIdleT = 0, mPolicyMute = false;
  const mPos = () => (MD.playing ? MD.pos + (Date.now() - MD.at) / 1000 : MD.pos);
  const mSrc = f => 'assets/media/' + f;
  const mClock = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function curMedia() {
    const L = FP.lesson(); if (!L) return null;
    const set = { ...MEDIA.all, ...(MEDIA[L.n] || {}) };
    const s = FP.state();
    if (FP.mode() === 'extra') { const m = set[s.extra]; return m && m.files ? { key: `${L.n}|${s.extra}`, group: `${L.n}|${s.extra}`, title: m.title, files: m.files } : null; }
    const m = set[s.act]; if (!m) return null;
    const files = m.steps ? m.steps[s.step] : m.files; if (!files || !files.length) return null;
    return { key: `${L.n}|${s.act}|${s.step}`, group: `${L.n}|${s.act}`, title: m.steps ? `${m.title} · ${files.length > 1 ? 'All together' : 'Step ' + (s.step + 1)}` : m.title, files };
  }
  function renderMedia() {
    const el = $('#media'); if (!el) return;
    const m = curMedia();
    root.classList.toggle('has-media', !!m);
    if (!m) {
      if (el.dataset.key) { dropVideo(); el.hidden = true; el.innerHTML = ''; el.dataset.key = ''; }
      if (!STUDENT && MD.key) Object.assign(MD, { key: '', idx: 0, playing: false, pos: 0, at: Date.now() });
      return;
    }
    if (el.dataset.key !== m.key) {
      if (!STUDENT) {   // moving on inside the same activity keeps playing (Sound Chant step 1 → 2 → …)
        const keep = MD.playing && MD.key && MD.key.split('|').slice(0, 2).join('|') === m.group;
        Object.assign(MD, { key: m.key, idx: 0, playing: !!keep && scene === 'lesson', pos: 0, at: Date.now() });
      }
      dropVideo();
      el.dataset.key = m.key; el.hidden = false;
      el.innerHTML = `<div class="b-fit"><video playsinline preload="auto"></video>
        <div class="b-mui">
          <span class="b-mtag">${ic('music')}<span lang="en">${esc(m.title)}</span></span>
          <button type="button" class="b-mbig" data-b="mtoggle" aria-label="Play">${ic('play')}</button>
          <div class="b-mbar">
            <button type="button" class="b-mpp" data-b="mtoggle" aria-label="Play or pause" title="Play / pause (K)">${ic('play')}</button>
            <span class="b-mtime">0:00 / 0:00</span>
            <div class="b-mtrack" data-b="mseek" title="Jump to">${m.files.map(() => '<span class="b-mseg"><i></i></span>').join('')}</div>
            <button type="button" class="b-mre" data-b="mrestart" aria-label="Play from the start" title="From the start">${ic('rotate-ccw')}</button>
            ${STUDENT ? '' : `<span class="b-mnote" hidden>${ic('volume-2')}Sound on the classroom screen</span>`}
          </div>
          <button type="button" class="b-mtap" hidden>${ic('volume-2')}Tap for sound</button>
        </div>
        <div class="b-mmiss" hidden></div></div>`;
      const v = mEl = el.querySelector('video'); v.dataset.src = ''; mPolicyMute = false;   // listeners below ignore a video that has been replaced
      v.addEventListener('loadedmetadata', () => { DUR[v.dataset.src] = v.duration; if (v === mEl) syncMedia(true); });
      v.addEventListener('timeupdate', () => {
        if (v !== mEl) return;
        paintMedia();
        if (!STUDENT && MD.playing && !mEl.paused && Math.abs(mEl.currentTime - mPos()) > 0.6) { MD.pos = mEl.currentTime; MD.at = Date.now(); broadcast(); }   // re-anchor after buffering
      });
      v.addEventListener('ended', () => {
        if (STUDENT || v !== mEl) return;   // the teacher's window drives the playlist
        const mm = curMedia(); if (!mm) return;
        if (MD.idx < mm.files.length - 1) Object.assign(MD, { idx: MD.idx + 1, pos: 0, at: Date.now(), playing: true });
        else Object.assign(MD, { playing: false, pos: mEl.duration || MD.pos, at: Date.now() });
        syncMedia(true); broadcast();
      });
      v.addEventListener('error', () => {
        if (v !== mEl) return;
        const box = el.querySelector('.b-mmiss'); if (!box) return;
        const web = /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname);
        box.innerHTML = `<span class="b-mmicon">${ic('monitor-pause')}</span><b>${web ? 'This video couldn’t be loaded' : 'Video file not found'}</b><p>${web ? 'Check the internet connection and try again.' : 'assets/media/' + esc(m.files[MD.idx] || '')}</p>`;
        box.hidden = false; el.classList.add('is-missing');
      });
    }
    syncMedia(true);
  }
  // put the local <video> where MD says; `seek` forces the position (commands, new files), otherwise only big drifts are fixed
  function dropVideo() {   // stop the old video before its layer is replaced (no stray loading or events)
    if (!mEl) return;
    const v = mEl; mEl = null;
    try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* already gone */ }
  }
  function syncMedia(seek) {
    const el = $('#media'), m = curMedia(); if (!el || !mEl || !m || MD.key !== m.key) return;
    const src = mSrc(m.files[Math.min(MD.idx, m.files.length - 1)]);
    if (mEl.dataset.src !== src) { mEl.dataset.src = src; mEl.src = src; seek = true; }
    const want = mPos(), dur = mEl.duration || DUR[src] || 0;
    if (mEl.readyState >= 1 && (seek || STUDENT) && Math.abs(mEl.currentTime - want) > (seek ? 0.05 : 0.45)) { try { mEl.currentTime = dur ? Math.min(want, dur - 0.05) : want; } catch (e) { /* not seekable yet */ } }
    mEl.muted = STUDENT ? true : false;   // this screen is the classroom screen: the class hears it here; mirrored tablets stay quiet
    const on = MD.playing && scene === 'lesson';
    if (on && mEl.paused) {
      const p = mEl.play();
      if (p && p.catch) p.catch(err => {   // a new window can't start sound before someone touches it
        if (err && err.name === 'NotAllowedError' && !mEl.muted) { mPolicyMute = true; mEl.muted = true; mEl.play().catch(() => {}); const tap = el.querySelector('.b-mtap'); if (tap) tap.hidden = false; }
      });
    } else if (!on && !mEl.paused) mEl.pause();
    el.classList.toggle('is-playing', on);
    const note = el.querySelector('.b-mnote'); if (note) note.hidden = true;
    paintMedia(); mediaIdle();
  }
  function paintMedia() {
    const el = $('#media'); if (!el || !mEl) return;
    const cur = mEl.currentTime || 0, dur = mEl.duration || DUR[mEl.dataset.src] || 0;
    el.querySelectorAll('.b-mseg i').forEach((s, i) => { s.style.width = (i < MD.idx ? 100 : i > MD.idx ? 0 : dur ? Math.min(100, (cur / dur) * 100) : 0).toFixed(2) + '%'; });
    const t = el.querySelector('.b-mtime'); if (t) t.textContent = `${mClock(cur)} / ${mClock(dur)}`;
    const on = MD.playing && scene === 'lesson', st = on ? 'pause' : 'play';
    const pp = el.querySelector('.b-mpp'); if (pp && pp.dataset.st !== st) { pp.dataset.st = st; pp.innerHTML = ic(st); }
  }
  function mediaIdle() {   // the control bar fades while a video plays and nobody touches the board
    const el = $('#media'); if (!el) return;
    el.classList.remove('is-idle'); clearTimeout(mIdleT);
    if (MD.playing) mIdleT = setTimeout(() => el.classList.add('is-idle'), 2600);
  }
  function seekAt(e, track) {
    const seg = e.target.closest('.b-mseg'); if (!seg) return null;
    const r = seg.getBoundingClientRect();
    return { i: [...track.children].indexOf(seg), f: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) };
  }
  function mediaCmd(a, v) {
    const m = curMedia(); if (!m) return;
    const here = () => (mEl && mEl.readyState >= 1 ? mEl.currentTime : mPos());   // the teacher's own video is the clock
    let seek = false;
    if (a === 'mtoggle') {
      if (MD.playing) Object.assign(MD, { pos: here(), playing: false, at: Date.now() });
      else {
        const dur = DUR[mSrc(m.files[MD.idx])] || 0;
        if (MD.idx >= m.files.length - 1 && dur && here() >= dur - 0.3) { Object.assign(MD, { idx: 0, pos: 0 }); seek = true; }   // finished: start over
        else MD.pos = here();
        Object.assign(MD, { playing: true, at: Date.now() });
        if (scene !== 'lesson') setScene('lesson');
      }
    }
    if (a === 'mrestart') { Object.assign(MD, { idx: 0, pos: 0, at: Date.now(), playing: true }); seek = true; }
    if (a === 'mseek' && v) { const i = Math.max(0, Math.min(m.files.length - 1, v.i | 0)); Object.assign(MD, { idx: i, pos: (DUR[mSrc(m.files[i])] || 0) * v.f, at: Date.now() }); seek = true; }
    syncMedia(seek); broadcast();
  }
  function pauseMedia() { if (MD.playing) { Object.assign(MD, { pos: mEl && mEl.readyState >= 1 ? mEl.currentTime : mPos(), playing: false, at: Date.now() }); syncMedia(); } }
  // commands from the classroom screen (touch boards): its buttons ask the teacher's window, which stays in charge
  function runCmd(a, v) {
    if (a === 'gplay') { const it = curGame(); if (it) { game = { id: it.id, where: v === 'here' ? 'here' : 'screen' }; renderGame(); renderDock(); broadcast(); } }
    if (a === 'mtoggle' || a === 'mrestart' || a === 'mseek') mediaCmd(a, v);
    if (a === 'extra' && /^g-/.test(v || '')) { FP.openExtra(v); if (scene !== 'lesson') setScene('lesson'); }   // a game card tapped on the classroom screen
  }

  /* ---------- games in the student-screen frame ---------- */
  let guarded = false;
  function guardHistory() {   // a game's own Exit may call history.back(); keep the dashboard from leaving
    if (guarded) return; guarded = true; try { history.pushState({ pond: 'game' }, ''); } catch (e) { /* file:// quirks */ }
  }
  addEventListener('popstate', () => { if ($('#game iframe')) { try { history.pushState({ pond: 'game' }, ''); } catch (e) { /* ignore */ } } else guarded = false; });
  function renderGame() {
    const el = $('#game'); if (!el) return;
    const it = curGame();
    if (!it) { game = game && STUDENT ? game : null; el.hidden = true; el.innerHTML = ''; el.dataset.key = ''; return; }
    if (it.picker) {
      game = STUDENT ? game : null;
      const key = ['picker', FP.lesson().n, it.picker.map(x => x.id).join(',')].join('|');
      el.hidden = false; if (el.dataset.key === key) return; el.dataset.key = key;
      el.innerHTML = `<div class="b-fit"><div class="b-gpick"><h3 lang="en">Let’s play!</h3><div class="b-gpcards">${it.picker.map(x => `<button type="button" class="b-gpcard" data-b="extra" data-v="${x.id}" title="Open ${esc(x.label)}"><span class="b-gpimg"><img src="assets/games/${x.game.poster}.webp" alt="" onerror="this.remove()"></span><b lang="en">${esc(x.label)}</b><small lang="en">${esc(x.sub)}</small></button>`).join('')}</div></div></div>`;
      return;
    }
    if (game && game.id !== it.id) game = null;
    const runHere = STUDENT ? !!(game && game.where === 'screen') : !!(game && game.where === 'here');
    const key = [it.id, FP.lesson().n, runHere, game ? game.where : '', live].join('|');
    el.hidden = false; if (el.dataset.key === key) return; el.dataset.key = key;
    if (runHere) {
      el.innerHTML = `<div class="b-fit"><iframe src="${esc(gameUrl(it))}" title="${esc(it.label)}" allow="autoplay; microphone; fullscreen; screen-wake-lock; gamepad"></iframe></div>`;
      if (!STUDENT) guardHistory(); return;
    }
    const g = it.game;
    let acts;
    if (STUDENT) acts = game && game.where === 'here' ? `<p class="b-gstat">Playing on the teacher’s screen</p><div class="b-gacts"><button type="button" class="b-gbtn" data-b="gplay" data-v="screen">${ic('play')}Play on this screen</button></div>` : `<div class="b-gacts"><button type="button" class="b-gbtn b-gbtn--go b-gbtn--lg" data-b="gplay" data-v="screen">${ic('play')}Play</button></div>`;
    else if (game && game.where === 'screen') acts = `<p class="b-gstat"><i class="b-live" aria-hidden="true"></i>Playing on the classroom screen</p><div class="b-gacts"><button type="button" class="b-gbtn" data-b="gplay" data-v="here">${ic('monitor')}Play here instead</button><button type="button" class="b-gbtn" data-b="gstop">${ic('x')}Stop</button></div>`;
    else acts = `<div class="b-gacts"><button type="button" class="b-gbtn b-gbtn--go b-gbtn--lg" data-b="gplay" data-v="here">${ic('play')}Play</button></div>`;
    el.innerHTML = `<div class="b-fit"><div class="b-gcover"><img src="assets/games/${g.poster}.webp" alt="" onerror="this.remove()"><div class="b-gshade"></div><div class="b-ginfo"><span class="b-gtag">${ic(g.icon || 'gamepad')}${esc(g.tag || 'Phonics game')} · Lesson ${FP.lesson().n}</span><h3 lang="en">${esc(it.label)}</h3><p lang="en">${esc(it.sub)} · ${esc(g.blurb)}</p>${acts}</div></div></div>`;
  }

  /* ================= student view ================= */
  function studentMain() {
    document.title = 'Phonics POND — Student screen';
    FP.on(e => { if (e.type === 'lesson') refreshGames(); if (e.type === 'lesson' || e.type === 'nav') addGamesStep(); if (e.type === 'nav') renderGame(); });
    FP.mount($('#stage'), { storageKey: 'pondc-student', fresh: true, keys: false, keepAwake: true, design: DESIGN, viewTransitions: false });
    addLayers(); refreshGames(); addGamesStep();
    const wait = $('#wait');
    const card = (title, sub) => { wait.innerHTML = `<div class="b-waitin"><span class="b-logo b-logo--lg"><svg viewBox="0 0 64 64" aria-hidden="true"><use href="#pond-mark"/></svg></span><b>${title}</b><p>${sub}</p></div>`; wait.hidden = false; };
    if (!CH) { card('This browser can’t show the student screen', 'Open it in Chrome, Edge or Safari.'); return; }
    card('Waiting for your teacher…', 'On the teacher’s dashboard: Share → Classroom screen.');
    const apply = m => {
      applyTheme(m.theme);
      if (FP.lesson().n !== m.lesson) FP.setLesson(m.lesson);
      if (FP.state().sec !== m.sec) FP.setSection(m.sec);
      const s = FP.state();
      if (m.extra) { if (s.extra !== m.extra) FP.openExtra(m.extra); }
      else if (s.extra || s.act !== m.act || s.step !== m.step) FP.go(m.act, m.step);
      FP.ink.import(m.ink);
      const { roster: rs, picked: pd, ...pk } = m.pick;
      const redraw = scene !== m.scene || PK.t0 !== pk.t0 || PK.name !== pk.name || JSON.stringify([rs, pd]) !== JSON.stringify([roster, [...picked]]);
      if (Array.isArray(rs)) roster = rs; if (Array.isArray(pd)) picked = new Set(pd);
      scene = m.scene; Object.assign(TM, m.timer); Object.assign(PK, pk); game = m.game;
      coverOn = !!m.cover; renderCover();
      if (m.media) Object.assign(MD, m.media);
      if (redraw) renderScene();
      renderGame(); renderMedia(); tick();
    };
    CH.onmessage = ({ data: m }) => {
      if (!m) return;
      if (m.type === 'state') { wait.hidden = true; apply(m); }
      if (m.type === 'stop') { card('Sharing has ended', 'You can close this window.'); setTimeout(() => window.close(), 1500); }
    };
    document.addEventListener('click', e => {   // touch boards: the activity's own buttons work here too
      const t = e.target.closest('[data-b]'); if (!t) return;
      const a = t.dataset.b;
      if (a === 'gplay' || a === 'mtoggle' || a === 'mrestart' || (a === 'extra' && /^g-/.test(t.dataset.v || ''))) CH.postMessage({ type: 'cmd', a, v: t.dataset.v });
      if (a === 'mseek') { const v = seekAt(e, t); if (v) CH.postMessage({ type: 'cmd', a, v }); }
    });
    addEventListener('pointerdown', () => {   // the first touch on this window allows sound
      if (mPolicyMute && mEl) { mPolicyMute = false; mEl.muted = false; const tap = $('#media .b-mtap'); if (tap) tap.hidden = true; }
    }, true);
    addEventListener('pointermove', mediaIdle);
    CH.postMessage({ type: 'hello' });
    setInterval(() => CH.postMessage({ type: 'ping' }), 2000);
    setInterval(tick, 250);
    setInterval(() => { if (MD.playing) syncMedia(); }, 1000);   // keep the classroom screen in step with the teacher
    addEventListener('pagehide', () => CH.postMessage({ type: 'bye' }));
    const fsb = document.createElement('button'); fsb.type = 'button'; fsb.className = 'b-stufs';
    fsb.innerHTML = `${ic('maximize')}<span>Full screen</span>`; fsb.addEventListener('click', () => FP.fullscreen()); document.body.appendChild(fsb);
    let hideT = 0; const showFs = () => { fsb.classList.add('is-show'); clearTimeout(hideT); hideT = setTimeout(() => fsb.classList.remove('is-show'), 2500); };
    addEventListener('pointermove', showFs); showFs();
    document.addEventListener('fullscreenchange', () => { fsb.hidden = !!document.fullscreenElement; });
    addEventListener('keydown', e => { if (e.key === 'f' || e.key === 'F') FP.fullscreen(); });
  }
  if (STUDENT) { studentMain(); return; }

  /* ================= teacher view ================= */
  let notesOpen = false, flowOpen = false, notesTab = 'plan', mapPick = null, palOpen = false;
  let menuOpen = false, guideOpen = false, dialOpen = false, quickOpen = false;   // classroom screen: the teacher guide and the one button's Settings · Quick · Guide (+ Quick's ring) stay hidden until asked for
  let layerOutT = 0, itemsOutT = 0, qoutT = 0, fabHtml = '', fabFace = '';   // motion: folding away, Quick folding, the one button's face
  const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SEL_ON = '.b-card.is-on, .b-xi.is-on, .b-rchip.is-on, .b-opt[aria-pressed="true"]', selKey = e => [e.dataset.b, e.dataset.k, e.dataset.v].join(':');
  const selKeys = box => new Set([...box.querySelectorAll(SEL_ON)].map(selKey));
  const markNew = (box, prev) => { if (!RM()) box.querySelectorAll(SEL_ON).forEach(e => { if (!prev.has(selKey(e))) e.classList.add('is-new'); }); };   // a new selection's ring grows in (user: "9번")
  let fanGeo = null;   // classroom screen: where the one button's arc opens
  let pos = get('pondc-pos', {});   // where the teacher dragged the one button (classroom screen): centre as a fraction of the board
  pos = pos && typeof pos === 'object' && Array.isArray(pos.fab) ? { fab: pos.fab } : {};

  function themeFade(v) {   // the colours cross-fade on a theme change (user: "12번")
    if (!document.startViewTransition || RM() || FP.opts.viewTransitions === false || root.dataset.theme === v) { setTheme(v); return; }
    root.classList.add('is-themefade');
    const t = document.startViewTransition(() => setTheme(v)); t.finished.catch(() => {}).finally(() => root.classList.remove('is-themefade'));
  }
  function setTheme(t) { applyTheme(t); put('fprk-bc-theme', root.dataset.theme); broadcast(); refreshDisplay(); }
  function cycleTheme() { const i = THEMES.findIndex(x => x[0] === root.dataset.theme); setTheme(THEMES[(i + 1) % THEMES.length][0]); }

  /* ---------- layout: panel arrangement chosen by the teacher ---------- */
  const LAYOUT = { screen: [['full', 'Full screen'], ['desk', 'With controls']], controls: [['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']], notes: [['sheet', 'Pop-up'], ['panel', 'Side panel']] };
  function setLayout(k, v) {
    if (!LAYOUT[k] || !LAYOUT[k].some(x => x[0] === v)) return;
    root.dataset[k] = v; put('pondc-' + k, v);
    if (k === 'notes') { notesOpen = false; root.dataset.npanel = 'shown'; put('pondc-npanel', 'shown'); }
    if (k === 'controls') root.dataset.menuside = v === 'left' ? 'right' : 'left';   // the menu takes the other side from a side guide
    if (k === 'screen') { if (v !== 'full') { setMenu(false); setGuide(false); } fitTop(true); }
    renderDock(); renderFlow(); renderNotes(); renderFab(); refreshDisplay(); requestAnimationFrame(placeFab);
    if (k === 'controls' || k === 'screen') requestAnimationFrame(() => { const p = $('#displayPop'); if (p.matches(':popover-open')) { placePop(p, $('#displayBtn')); clampPop(p); } });
  }

  /* ---------- what students see (top bar) ---------- */
  // what students see: the lesson, a class activity or game, or a class tool
  const SCENES = [['lesson', 'presentation', 'Lesson', 'Show the lesson'], ['timer', 'timer', 'Timer', 'Timer (T)'], ['pick', 'dices', 'Pick', 'Pick a student (P)'], ['pause', 'monitor-pause', 'Pause', 'Eyes on me (B)']];
  function renderScenes() {
    const el = $('#scenes'); if (!el || !FP.lesson()) return;
    el.innerHTML = `<span class="b-scnl" title="${live ? 'Sharing to student tablets' : 'What students see'}">${live ? '<i class="b-live" aria-hidden="true"></i>' : ''}<span>Students see</span></span>${SCENES.map(([v, i, l, t]) => `<button type="button" data-b="scene" data-v="${v}" aria-pressed="${scene === v}" title="${t}">${ic(i)}<span>${l}</span></button>`).join('')}`;
    fitTop();
  }
  // the Class activities select shows what is picked, like the other selects (no extra path in the top bar)
  const ACTS_DEF = () => `${ic('grid')}<span class="b-actl">Class activities</span>${ic('chevron-down', 'b-dd')}`;
  const actsVal = it => {
    const g = FP.extras().find(x => x.items.some(y => y.id === it.id));
    return `${ic(it.icon || (g && g.icon) || 'grid')}<b class="b-actv" lang="en">${esc(it.label)}</b>${ic('chevron-down', 'b-dd')}`;   // the group icon + the name, 2 lines max
  };
  function renderActs() {
    const b = $('#extrasBtn'); if (!b || !FP.lesson()) return;
    const it = FP.mode() === 'extra' ? FP.extraInfo() : null;
    b.classList.toggle('has-val', !!it); b.setAttribute('aria-pressed', !!it);
    b.innerHTML = it ? actsVal(it) : ACTS_DEF();
  }
  function setScene(v) {
    if (v === 'pause' && scene === 'pause') v = resumeTo;
    else if (v === scene) return;
    if (v === 'pause') resumeTo = scene;
    if (v !== 'lesson') pauseMedia();
    if (v === 'pick' && scene !== 'pick' && Date.now() - PK.t0 > 1500) { PK.name = ''; PK.seq = null; }   // a fresh "Who's next?" board
    scene = v; bgmSync();   // (the title page's music rests under a class tool)
    if (v === 'pause') sfx('dingdong');   // 13 · the attention signal
    renderScenes(); renderScene(); renderDock(); broadcast(); if (dialOpen) { renderLayer(); placeFab(); renderFab(); }   // the layer follows the board (keys, the tablet preview)
  }
  const coreGuide = FP.guide;   // Meaning First › Games: what to say and do
  FP.guide = (...args) => {
    const g = coreGuide(...args), a = args[0] ? FP.flow().find(x => x.id === args[0]) : FP.cur();
    if (g && g.steps && a && a.id === 'si1' && a.steps.length > MF_GAMES && g.steps.length === MF_GAMES) {
      const names = lessonGames().map(x => x.label).join(' · ');
      g.steps = [...g.steps, { title: 'Games', do: `Tap a game on the board, then Play (${names}). Come back to the lesson when the round is over.`, say: 'Let’s play a game with our words!', kids: 'Play and say the words.' }];
      if (!args[0]) g.cur = g.steps[Math.min(FP.state().step, g.steps.length - 1)];
    }
    return g;
  };
  const coreNext = FP.next, corePrev = FP.prev;   // a clicker press on a class tool brings the lesson back first
  FP.next = () => (scene !== 'lesson' ? setScene(scene === 'pause' ? 'pause' : 'lesson') : coreNext());
  FP.prev = () => (scene !== 'lesson' ? setScene(scene === 'pause' ? 'pause' : 'lesson') : corePrev());

  /* ---------- top ---------- */
  function renderTop() {
    const L = FP.lesson();
    $('#lessonBtn').innerHTML = `<span class="b-lt${L.key.length > 3 ? ' is-long' : ''}" lang="en">${esc(L.key)}</span><span class="b-ltx"><b>Lesson ${L.n} <i lang="en"${L.snd.length > 9 ? ' class="is-long"' : ''}>${esc(L.snd)}</i></b><small>Unit ${L.unit} · ${esc(L.day)}</small></span>${ic('chevron-down')}`;
    $('#lessonBtn').title = `Lesson map (M) — Lesson ${L.n} ${L.snd} · Unit ${L.unit} · ${FP.unitTheme(L.unit)}`;
    fitTop();
  }
  // The activity title must never be cut. When the bar runs short (long lesson names, narrow windows) secondary
  // labels go first: "Students see" → the "Class activities" text → the lesson's sound line (still on the tile and
  // in the tooltip) → the Share text → the screen-button texts (icons + tooltips stay). Decided once per lesson +
  // window width from every section/title pair, so nothing jumps on Next.
  const FIT = ['is-tight', 'is-tighter', 'is-tightest', 'is-tight4', 'is-tight5', 'is-tight6', 'is-tight7'];
  let fitKey = '', fitLevel = 0, fitT = 0;
  const actBtn = (title, tip) => `<button type="button" class="b-crumbact" data-b="actmenu" title="${tip}" aria-haspopup="true"><b lang="en">${esc(title)}</b>${ic('chevron-down')}</button>`;
  const crumbHTML = (sec, title) => `<button type="button" data-b="sections" title="Sections">${esc(sec)}${ic('chevron-down')}</button>${actBtn(title, 'Activities in this section')}`;
  function fitTop(force) {
    const top = $('.b-top'), crumb = $('#crumb'), L = FP.lesson(); if (!top || !crumb || !L) return;
    if (CLASSROOM()) { FIT.forEach(c => top.classList.remove(c)); fitKey = ''; return; }   // the menu drawer has room for every label
    const key = `${L.n}|${innerWidth}|${live ? 1 : 0}|${shareTo}|${FP.mode()}`;
    if (key !== fitKey || force) {
      fitKey = key; fitLevel = 0;
      const keep = crumb.innerHTML, cut = () => { const b = crumb.querySelector('b'), last = crumb.lastElementChild;   // title cut, or the activity select pushed out of the path
        return b.scrollHeight > b.clientHeight + 4 || (last && last.getBoundingClientRect().right > crumb.getBoundingClientRect().right + 1); };
      const btn = $('#extrasBtn'), keepBtn = btn.innerHTML, keepVal = btn.classList.contains('has-val');
      btn.classList.toggle('has-val', FP.mode() === 'extra');   // measure the box as it will look (renderActs may not have run yet)
      if (FP.mode() === 'extra') { let w = 0, best = ''; for (const g of FP.extras()) for (const it of g.items) { btn.innerHTML = actsVal(it); if (btn.offsetWidth > w) { w = btn.offsetWidth; best = btn.innerHTML; } } btn.innerHTML = best; }
      else btn.innerHTML = ACTS_DEF();
      const intro = ['Lesson Words', 'Sound Chant', L.a1, 'Meaning First', 'Sound Awareness', 'Sound–Letter Match', 'Sound Review', 'Sound Blending', L.a2, 'G-Learning'];
      for (const s of FP.sections()) for (const t of (s.built ? intro : s.subs.length ? s.subs : [s.name])) {
        crumb.innerHTML = crumbHTML(s.name, t || '');
        while (fitLevel < FIT.length) { FIT.forEach((c, i) => top.classList.toggle(c, i < fitLevel)); if (!cut()) break; fitLevel++; }
      }
      crumb.innerHTML = keep; btn.innerHTML = keepBtn; btn.classList.toggle('has-val', keepVal);
    }
    FIT.forEach((c, i) => top.classList.toggle(c, i < fitLevel));
  }
  function renderCrumb() {
    const sec = FP.section();
    $('#crumb').innerHTML = crumbHTML(sec.name, FP.cur().title);
    const am = $('#actMenu'); if (am && am.matches(':popover-open')) am.hidePopover();   // picked: the menu closes
    fitTop();
  }

  /* ---------- floating board tools ---------- */
  function syncGdim() { const g = $('#gdim'); if (g) g.hidden = !(guideOpen && CLASSROOM() && !FP.ink.state().on); }   // the guide open: a tap on the board closes it (user: "guide도 화면 누르면 닫히게"); with the pen on, a tap draws
  function renderFab() {
    syncGdim();
    const k = FP.ink.state(), cur = k.on ? k.tool : 'select';
    const tIcon = { pen: 'pen', hl: 'highlighter', er: 'eraser' }[cur] || 'pen';
    const b = $('#fabBtn'), dial = CLASSROOM(), shut = palOpen || (dial && (dialOpen || menuOpen));   // classroom: the one button closes what is open
    b.classList.toggle('is-ink', k.on && !shut); b.classList.toggle('is-open', shut);
    b.setAttribute('aria-expanded', dial ? dialOpen || palOpen || menuOpen : palOpen); b.setAttribute('aria-label', dial ? 'Guide, quick tools and display' : 'Board tools');
    b.title = dial ? (palOpen ? 'Hide board tools' : menuOpen ? 'Close the menu (Esc)' : dialOpen ? 'Close' : k.on ? 'Phonics POND — Guide · Quick · Display · drawing is on (D) · drag to move' : 'Phonics POND — Guide · Quick · Display · drag to move')
      : palOpen ? 'Hide board tools' : k.on ? 'Board tools — drawing is on (D)' : 'Board tools (D = pen)';
    const face = dial ? '<svg class="b-fabmark" viewBox="0 0 64 64" aria-hidden="true"><use href="#pond-mark"/></svg>' : ic(k.on ? tIcon : 'pen');   // classroom: our symbol on the one button (user: "메뉴 표시 대신에 우리 심볼아이콘")
    const fh = shut ? ic('x') : `${face}${k.on && cur !== 'er' ? `<i class="b-fabdot" style="--c:${k.color}"></i>` : ''}${k.count && !k.on && !dial ? `<i class="b-fabn">${k.count}</i>` : ''}`;
    if (fh !== fabHtml) {   // only on a change — a re-render would replay the turn
      const kind = shut ? 'x' : 'face', turn = fabHtml && kind !== fabFace && !RM();
      b.innerHTML = fh; fabHtml = fh; fabFace = kind;
      if (turn && b.firstElementChild) b.firstElementChild.classList.add(shut ? 'b-fabin-x' : 'b-fabin');   // × turns in, our symbol turns back (user: "3번")
    }
    const items = $('#dialItems');   // Settings · Quick · Guide on the half disc; Quick's ring of round buttons just outside it
    if (items) {
      if (!(dial && dialOpen)) {   // closing: the ring and the disc fold into the button first (user: "2번"), then go
        if (!items.classList.contains('is-out')) {
          if (!items.hidden && items.children.length && !RM()) {
            items.classList.add('is-out'); root.classList.add('is-dialout'); clearTimeout(itemsOutT);
            itemsOutT = setTimeout(() => { items.hidden = true; items.innerHTML = ''; items.classList.remove('is-quick', 'is-qout', 'is-out'); if (!$('#layer').classList.contains('is-out')) root.classList.remove('is-dialout'); }, 180);
          } else { items.hidden = true; items.innerHTML = ''; items.classList.remove('is-quick', 'is-qout'); }
        }
      } else {
        if (items.classList.contains('is-out')) { clearTimeout(itemsOutT); items.classList.remove('is-out'); }   // reopened while folding: the fan replays
        items.hidden = false;
        const shareIc = shareTo !== 'none' ? (hasScreen() ? 'monitor' : 'tablet') : 'cast';
        const want = [   // [class, action, value, icon, label, on, tip, live dot, count]
          ['b-dialitem', 'dguide', '', 'notebook-pen', 'Guide', guideOpen, 'Teacher guide — what to say and do (G)'],   // Guide · Quick · Settings (user: "셋팅과 가이드 메뉴 순서 바꿔줘")
          ['b-dialitem', 'dquick', '', 'zap', 'Quick', quickOpen, 'Quick — what students see, share, pen'],   // user: "pen버튼 자리에는 퀵 버튼으로"
          ['b-dialitem', 'dset', '', 'palette', 'Display', false, 'Display — screen, guide position, notes, colour'],   // the template (user: "settings보다는 display가 나은거 같아 아이콘도 기존에 팔레트 형태가")
          ...SCENES.map(([v, i, l, t]) => ['b-qitem', 'scene', v, i, l, scene === v, t]),   // what students see
          ['b-qitem', 'qshare', '', shareIc, shareTo !== 'none' ? 'Sharing' : 'Share', shareTo !== 'none', shareTo !== 'none' ? 'Sharing — the share settings (S)' : 'Share with students (S)', live],
          ['b-qitem', 'dpen', '', 'pen', 'Pen', k.on, 'Pen — draw on the board, tools at hand (D)', false, k.count && !k.on ? k.count : 0]];
        const inner = w => `${ic(w[3])}<span>${w[4]}</span>${w[7] ? '<i class="b-live" aria-hidden="true"></i>' : ''}${w[8] ? `<i class="b-fabn">${w[8]}</i>` : ''}`;
        if (items.children.length !== want.length) items.innerHTML = want.map(w => `<button type="button" class="${w[0]}${w[5] ? ' is-on' : ''}" data-b="${w[1]}"${w[2] ? ` data-v="${w[2]}"` : ''} aria-pressed="${!!w[5]}" title="${w[6]}">${inner(w)}</button>`).join('');
        else want.forEach(w => {   // in place: a re-render would replay the fan-out
          const b = items.querySelector(`[data-b="${w[1]}"]${w[2] ? `[data-v="${w[2]}"]` : ''}`); if (!b) return;
          b.classList.toggle('is-on', !!w[5]); b.setAttribute('aria-pressed', !!w[5]); b.title = w[6]; const h = inner(w); if (b.dataset.h !== h) { b.innerHTML = h; b.dataset.h = h; }
        });
        if (!quickOpen && items.classList.contains('is-quick') && !items.classList.contains('is-qout') && !RM()) {   // Quick folds its ring back into the disc (user: "6번")
          items.classList.add('is-qout'); clearTimeout(qoutT);
          qoutT = setTimeout(() => { items.classList.remove('is-qout'); if (!quickOpen) items.classList.remove('is-quick'); }, 160);
        } else if (quickOpen) { clearTimeout(qoutT); items.classList.remove('is-qout'); items.classList.add('is-quick'); }
        else if (!items.classList.contains('is-qout')) items.classList.remove('is-quick');
        layoutFan();
      }
    }
    const pal = $('#fabPal'); pal.hidden = !palOpen; if (!palOpen) return;
    const t = (id, n, l) => `<button type="button" class="b-tool${cur === id ? ' is-on' : ''}" data-b="tool" data-v="${id}" title="${l}" aria-label="${l}" aria-pressed="${cur === id}">${ic(n)}</button>`;
    pal.innerHTML = `<div class="b-palgrp">${t('select', 'pointer', 'Select — use the content')}${t('pen', 'pen', 'Pen (D)')}${t('hl', 'highlighter', 'Highlighter')}${t('er', 'eraser', 'Eraser')}</div><i class="b-palsep"></i>
      <div class="b-palgrp b-palgrp--sw">${FP.inkColors.map(([c, n]) => `<button type="button" class="b-sw${k.color === c ? ' is-on' : ''}" data-b="color" data-v="${c}" style="--c:${c}" title="${n}" aria-label="${n}" aria-pressed="${k.color === c}"></button>`).join('')}</div><i class="b-palsep"></i>
      <div class="b-palgrp b-palgrp--wd">${[[3, 'Thin'], [6, 'Medium'], [12, 'Thick']].map(([w, n]) => `<button type="button" class="b-wd${k.width === w ? ' is-on' : ''}" data-b="width" data-v="${w}" title="${n} line" aria-label="${n} line"><i style="--w:${w}px"></i></button>`).join('')}</div><i class="b-palsep"></i>
      <div class="b-palgrp"><button type="button" class="b-tool" data-b="undo" title="Undo" aria-label="Undo" ${k.count ? '' : 'disabled'}>${ic('undo')}</button><button type="button" class="b-tool" data-b="clear" title="Clear drawing" aria-label="Clear drawing" ${k.count ? '' : 'disabled'}>${ic('trash')}</button></div>`;
  }
  function setPal(open) { palOpen = open; renderFab(); if (open) requestAnimationFrame(placeFab); }   // (the strip is placed once it has its size)

  /* ---------- classroom screen: the teacher's screen IS the classroom screen (user: "강사용 대시보드가 곧 수업시 교실안에 스크린과 동일하게")
     The board fills the screen; one button (our symbol, bottom centre) fans out Settings · Quick · Guide over a layer of today's flow: Settings = the template, Quick = what students see · Share · Pen, the teacher guide (dock, notes) slides in on demand —
     no menus along the top ("위에 메뉴들이 있으면 불편"). Display › Screen › With controls keeps the desk layout. ---------- */
  const CLASSROOM = () => root.dataset.screen === 'full' && !STUDENT;
  const MENU_POPS = ['extrasPop', 'sharePop', 'displayPop', 'helpPop', 'secMenu', 'actMenu'];
  function setMenu(on) {
    menuOpen = !!on && CLASSROOM(); root.dataset.menu = menuOpen ? 'open' : 'closed';
    if (!menuOpen) MENU_POPS.forEach(id => { const p = document.getElementById(id); if (p && p.matches(':popover-open')) p.hidePopover(); });
    else { if (dialOpen) setDial(false); if (palOpen) setPal(false); }   // one thing open at a time
    renderFab(); requestAnimationFrame(placeFab);   // the button steps above the menu bar
  }
  function setGuide(on) { guideOpen = !!on && CLASSROOM(); root.dataset.guide = guideOpen ? 'open' : 'closed'; renderFab(); requestAnimationFrame(placeFab); }
  function setDial(on) {   // the one button's menu: dim + the layer (today's flow, Meaning First) + Settings · Quick · Guide on a half disc
    const was = dialOpen; dialOpen = !!on && CLASSROOM(); root.dataset.dial = dialOpen ? 'open' : 'closed';
    if (!dialOpen) quickOpen = false; else if (!was) quickOpen = true;   // opens with Quick on, its ring at once (user: "가운데 눌렀을때 퀵 버튼이 활성화되서 퀵 세부메뉴까지 뿌려진 상태"); Quick folds it
    renderLayer(); placeFab(); renderFab();
  }
  function renderLayer() {   // user: "버튼 밑에는 오늘 학습 플로우와 meaning first 활동들이 밑에서 레이어 팝업형태로 올라오게"
    const el = $('#layer'), dim = $('#dim'); if (!el || !dim) return;
    if (!dialOpen) {   // closing: the layer slides down and the dim fades (user: "2번"), then they go
      if (el.classList.contains('is-out')) return;
      const done = () => { el.hidden = dim.hidden = true; el.innerHTML = ''; el.classList.remove('is-out', 'is-morph'); dim.classList.remove('is-out'); root.dataset.dialtool = 'none'; if (!$('#dialItems').classList.contains('is-out')) root.classList.remove('is-dialout'); };
      if (el.hidden || RM()) { clearTimeout(layerOutT); done(); return; }
      el.getAnimations().forEach(a => a.cancel()); el.classList.add('is-out'); dim.classList.add('is-out'); root.classList.add('is-dialout');
      clearTimeout(layerOutT); layerOutT = setTimeout(done, 180); return;
    }
    clearTimeout(layerOutT); el.classList.remove('is-out'); dim.classList.remove('is-out'); root.classList.remove('is-dialout');   // (reopened while folding: it rises again)
    const was = !el.hidden, h0 = was ? el.getBoundingClientRect().height : 0, k0 = root.dataset.dialtool;   // a change while open morphs (user: "7번")
    const pOn = was ? el.querySelector('.b-lysec.is-on') : null, pR = pOn ? pOn.getBoundingClientRect() : null, pV = pOn ? pOn.dataset.v : null;   // the section line slides from here (user: "4번")
    const selPrev = was ? selKeys(el) : new Set();   // opening: every selection is new
    el.hidden = dim.hidden = false;
    const tool = scene === 'timer' || scene === 'pick' ? scene : 'none'; root.dataset.dialtool = tool;   // a class tool on the board: its settings under the × (user); Pause has none (user: "아래 패널 열리는거만 빼줘") — the usual layer, Lesson on the Quick ring
    if (tool !== 'none') { el.innerHTML = tool === 'timer' ? layerTimer() : layerPick(); markNew(el, selPrev); morphLayer(el, was, h0, k0); return; }
    const flow = FP.flow(), cur = FP.cur(), extra = FP.mode() === 'extra', L = FP.lesson(), xi = FP.extraInfo();
    const card = a => { const on = !extra && a.id === cur.id, done = !extra && a.index < cur.index;
      return `<button type="button" class="b-card${on ? ' is-on' : ''}${done ? ' is-done' : ''}" data-b="go" data-v="${a.id}"><small>${done ? ic('check') : ''}<span>${esc(a.kicker)}</span><span class="b-lymin">${planMin(a)} min</span></small><b lang="en">${esc(a.title)}</b></button>`; };   // kicker · minutes, then the title (the Prep/SB/Home tag said what the kicker says)
    const MF_ICON = { 'x-lmf': 'book-open', 'x-mfd': 'volume-2', 'x-mfh': 'pencil', 'x-mfi': 'file-text' };   // Meaning First: an icon each, no description (user); games = the gamepad
    const thumb = it => it.game && it.game.poster ? `<span class="b-xthumb"><img src="assets/games/${it.game.poster}-thumb.webp" alt="" loading="lazy" onerror="this.remove()"></span>` : `<span class="b-xthumb">${ic(MF_ICON[it.id] || 'layers')}</span>`;   // Meaning First = pictures: the game's thumbnail, else the item's icon (user picked thumbnails)
    const tile = it => `<button type="button" class="b-xi${it.soon ? ' is-soon' : ''}${xi && xi.id === it.id ? ' is-on' : ''}" data-b="extra" data-v="${it.id}">${thumb(it)}<b lang="en">${esc(it.label)}</b>${it.soon ? '<em>Soon</em>' : it.game ? '<span class="b-xgame">Game</span>' : hasVideo(it.id) ? `<span class="b-xvid">${ic('play')}Video</span>` : ''}</button>`;
    el.innerHTML = `<div class="b-lyrow"><div class="b-lyhead b-lyhead--lesson"><h3 lang="en">Lesson ${L.n} ${esc(L.snd || '')}</h3><button type="button" class="b-lymap" data-b="lessonmap" aria-label="Choose a unit and lesson" title="Choose a unit and lesson (M)">${ic('chevron-right')}</button></div><div class="b-lysecs" role="group" aria-label="Sections">${FP.sections().map(x => `<button type="button" class="b-lysec${x.on ? ' is-on' : ''}" data-b="sec" data-v="${x.i}" data-t="${esc(x.name)}" aria-pressed="${x.on}" lang="en">${esc(x.name)}</button>`).join('')}</div>
        <div class="b-lycards">${flow.map(card).join('')}</div></div>
      <div class="b-lyrow b-lyrow--mf"><div class="b-lyhead"><h3>${ic('layers')}Meaning First</h3></div><div class="b-lycards">${mfGroup.items.map(tile).join('')}</div></div>`;
    const on = el.querySelector('.b-card.is-on'); if (on) { const box = on.parentElement; box.scrollLeft = on.offsetLeft - box.offsetLeft - (box.clientWidth - on.offsetWidth) / 2; }
    rowsEdges(); requestAnimationFrame(rowsEdges);   // soft edges where a row has more
    const sec = el.querySelector('.b-lysec.is-on'); if (sec) sec.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (pR && pR.width && sec && sec.dataset.v !== pV && !RM()) {   // the line slides over from the old tab (user: "4번"); it runs 12 px in from each side
      const nR = sec.getBoundingClientRect();
      sec.style.setProperty('--ux', (pR.left - nR.left).toFixed(1) + 'px'); sec.style.setProperty('--us', ((pR.width - 24) / Math.max(1, nR.width - 24)).toFixed(3)); sec.classList.add('is-slide');
    }
    markNew(el, selPrev);
    morphLayer(el, was, h0, k0);
  }
  function morphLayer(el, was, h0, k0) {   // changed while open: another kind of content rises in, the height glides (user: "7번"); placeFab rides on the final height
    el.getAnimations().forEach(x => { if (x.id === 'morph') x.cancel(); });   // a render during a morph (scene + Quick both render): measure the real height
    const h1 = el.getBoundingClientRect().height; el.dataset.h = Math.round(h1);
    if (!was || RM()) { el.classList.remove('is-morph'); return; }
    const now = performance.now(); if (k0 !== root.dataset.dialtool) el._fadeEnd = now + 240;
    if (el._fadeEnd > now) [...el.children].forEach(c => { const x = c.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }); x.currentTime = 240 - (el._fadeEnd - now); });   // (a re-render keeps the rise going)
    if (Math.abs(h1 - h0) > 2) {
      el.classList.add('is-morph');
      el.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)', id: 'morph' }).onfinish = () => el.classList.remove('is-morph');
    } else el.classList.remove('is-morph');
  }
  function placePop(pop) {   // classroom: menus rise from the bottom edge, centred (Settings / Quick open them; no menu bar) — desk layout: under the button
    if (!CLASSROOM()) return false;
    pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.bottom = '12px'; pop.style.left = '12px';
    return true;
  }
  function clampPop(pop) {   // classroom: centred, on screen (it scrolls inside when taller than the screen)
    if (!CLASSROOM()) return;
    pop.style.top = 'auto'; pop.style.bottom = '12px';
    pop.style.left = Math.max(12, Math.round((innerWidth - pop.offsetWidth) / 2)) + 'px';
  }
  function placeFab() {   // the pen lives inside the 16:10 frame (user: "판서 버튼은 가운데 화면에 포함"): bottom-right, on the frame's own 24 px margin; the video bar stops short of it
    const wrap = $('#stagewrap'), st = $('#stage'), fab = $('#fab'); if (!wrap || !st || !fab) return;
    const sw = st.offsetWidth, sh = st.offsetHeight, gx = (wrap.clientWidth - sw) / 2, gy = (wrap.clientHeight - sh) / 2, k = Math.min(sw / 1280, sh / 800);
    const m = Math.max(12, Math.round(24 * k));
    fab.dataset.mode = 'inside';
    const lift = Math.max(0, Math.ceil(90 * k + 8 - (m + 76)));   // on big frames the open palette clears the video bar's top (bar: 22 + 68 px, scaled)
    fab.style.setProperty('--pal-lift', lift + 'px');
    fab.style.setProperty('--pal-max', Math.max(160, Math.floor(sh - m - 76 - lift - 98 * k)) + 'px');   // and stays under the corner timer's row
    const app = $('#app');   // side panels (notes, side controls) line up with the frame's top and bottom
    app.style.setProperty('--frame-top', Math.max(0, gy) + 'px'); app.style.setProperty('--frame-h', sh + 'px');
    if (!CLASSROOM()) {   // desk: the pen in the frame's bottom-right corner (the classroom screen places it below without a reset in between: a reset would be measured and animated)
      fab.style.left = 'auto'; fab.style.top = 'auto'; fab.style.right = gx + m + 'px'; fab.style.bottom = gy + m + 'px'; fab.style.transform = ''; fab.classList.remove('is-moved', 'is-down', 'is-start', 'is-mid', 'is-side');
      ['--sheet-l', '--sheet-r', '--sheet-b'].forEach(p => wrap.style.removeProperty(p)); return;
    }
    const W = wrap.offsetLeft, Wr = W + wrap.offsetWidth, Wb = wrap.offsetTop + wrap.offsetHeight;
    const fx = Math.round(W + gx), fy = Math.round(wrap.offsetTop + gy), fr = Math.round(innerWidth - fx - sw), fb = Math.round(innerHeight - fy - sh);
    [['--fx', fx], ['--fy', fy], ['--fw', sw], ['--fh', sh], ['--fr', fr], ['--fb', fb]].forEach(([p, v]) => root.style.setProperty(p, v + 'px'));   // the floating buttons and drawers follow the frame
    // the one button: where the teacher dragged it, else the middle of the board's bottom edge (Naver's green dot). It never hides:
    // above an open bottom guide, beside a side guide or the notes panel.
    const S = Math.round(Math.min(96, Math.max(72, 68 * k))), SD = Math.round(S * .78);   // the one button grows with the screen (user: "화면 비율에 비해 조금 작은거 같아. 조금 키워줘"); ‹ › a size smaller
    root.style.setProperty('--fab-s', S + 'px'); root.style.setProperty('--fab-sd', SD + 'px');
    const H = S / 2, M = 8, RW = H + 12 + SD, side = root.dataset.controls, P = pos.fab, cw = wrap.clientWidth, ch = wrap.clientHeight;   // RW: half the row ‹ ● › (12 px gaps)
    const box = el => el && el.offsetWidth && getComputedStyle(el).display !== 'none' ? { l: el.offsetLeft - W, t: el.offsetTop - wrap.offsetTop, r: el.offsetLeft - W + el.offsetWidth, b: el.offsetTop - wrap.offsetTop + el.offsetHeight } : null;   // resting place, wrap coordinates
    let cx = P ? gx + P[0] * sw : gx + sw / 2, cy = P ? gy + P[1] * sh : gy + sh - m - H;
    cx = Math.min(Math.max(cx, gx + M + RW), gx + sw - M - RW); cy = Math.min(Math.max(cy, gy + M + H), gy + sh - M - H);
    let sl = 16, sr = 16, sb = gy + 16;
    if (guideOpen) {
      const d = box($('#dock')), q = box($('#npanel'));
      if (d && side === 'bottom') { cy = Math.min(cy, d.t - 12 - H); sb = ch - d.t + 12; }   // above the guide
      else if (d) {
        if (side === 'right') sr = cw - d.l + 12; else sl = d.r + 12;
        if (cx + RW > d.l - 12 && cx - RW < d.r + 12) cx = side === 'right' ? d.l - 12 - RW : d.r + 12 + RW;   // beside a side guide
      }
      if (q) { sl = Math.max(sl, q.r + 12); if (cx + RW > q.l - 12 && cx - RW < q.r + 12 && cy + H > q.t && cy - H < q.b) cx = q.r + 12 + RW; }   // beside the notes panel
    }
    if (menuOpen && !dialOpen) { const tb = $('.b-top'), top = tb ? tb.offsetTop - wrap.offsetTop : ch; if (cy + H > top - 12) cy = top - 12 - H; }   // above the menu bar
    if (dialOpen) { const ly = $('#layer'); cx = gx + sw / 2; cy = Math.max(gy + 190, ly && !ly.hidden ? ch - (ly.classList.contains('is-morph') ? +ly.dataset.h || ly.offsetHeight : ly.offsetHeight) : gy + sh - m - H); }   // open: the button rides on the layer's top edge, the menu above it
    const up = cy > gy + sh / 2, onRight = cx > gx + sw / 2, mid = dialOpen || (Math.abs(cx - (gx + sw / 2)) < sw / 6 && cw - sr - sl >= 560);   // in the middle (and room for the tools strip)
    const beside = mid && guideOpen && side === 'bottom', pal = $('#fabPal');   // a guide along the bottom leaves no room above the button: the strip goes beside it
    fab.classList.toggle('is-side', beside);
    if (mid && !beside && pal && !pal.hidden) { const pw = pal.offsetWidth, l0 = cx - pw / 2, l = Math.max(sl, Math.min(l0, cw - sr - pw)); fab.style.setProperty('--pal-dx', Math.round(l - l0) + 'px'); }   // clear of side panels
    else fab.style.setProperty('--pal-dx', '0px');
    const hangR = !onRight || cx - RW - sl < 120;   // the board tools open toward the middle — or away from a panel the button sits against
    let palX = null;   // a column of tools hanging from a button near the middle would sit on the middle of the board (the video's play button): beside it instead
    if (!mid && up && pal && !pal.hidden) {
      const pw = pal.offsetWidth, zone = 68 * k + 14, bc = gx + sw / 2, left0 = hangR ? cx - RW : cx + RW - pw;
      if (left0 < bc + zone && left0 + pw > bc - zone) { if (cw - sr - (bc + zone) >= pw) palX = bc + zone; else if (bc - zone - sl >= pw) palX = bc - zone - pw; }
    }
    fab.classList.toggle('is-aside', palX != null); fab.style.setProperty('--pal-x', palX != null ? Math.round(palX - (cx - RW)) + 'px' : '0px');
    fab.classList.toggle('is-moved', !!P); fab.classList.toggle('is-down', !up); fab.classList.toggle('is-start', hangR); fab.classList.toggle('is-mid', mid);   // in the middle, centred over the button
    if (mid) { fab.style.left = cx + 'px'; fab.style.right = 'auto'; fab.style.transform = 'translateX(-50%)'; }
    else { fab.style.transform = ''; fab.style.left = hangR ? (cx - RW) + 'px' : 'auto'; fab.style.right = hangR ? 'auto' : (cw - cx - RW) + 'px'; }
    fab.style.top = up ? 'auto' : (cy - H) + 'px'; fab.style.bottom = up ? (ch - cy - H) + 'px' : 'auto';
    fab.style.setProperty('--pal-lift', '0px');   // no video bar on the classroom screen
    fab.style.setProperty('--pal-max', Math.max(160, Math.floor(up ? cy - H - 12 - gy - M : gy + sh - M - cy - H - 12)) + 'px');
    if (up) { if (mid) sb = Math.max(sb, ch - (cy - H) + 12); else if (onRight) sr = Math.max(sr, cw - (cx - RW) + 12); else sl = Math.max(sl, cx + RW + 12); }   // pop-up sheets end before the buttons
    wrap.style.setProperty('--sheet-l', sl + 'px'); wrap.style.setProperty('--sheet-r', sr + 'px'); wrap.style.setProperty('--sheet-b', sb + 'px');
    fanGeo = { cx, cy, th: -Math.PI / 2, x0: gx + M + 40, x1: gx + sw - M - 40, y0: gy + M + 34, y1: gy + sh - M - 34 }; layoutFan();
  }

  /* ---------- the one button moves (user: "한개 버튼만 이동도 가능하게") ----------
     Press and move more than 6 px (10 px by finger) = drag; a press that stays put is still a click. The centre is saved as a
     fraction of the board (pondc-pos), so it holds on any window size; Display › Button › Reset position puts it back. */
  function layoutFan() {   // Settings · Quick · Guide on the half disc above the button (Naver's green dot); Quick's round buttons on a ring just outside it
    const items = $('#dialItems'); if (!items || items.hidden || !fanGeo) return;
    const { cx, cy, th, x0, x1, y0, y1 } = fanGeo, R = 112, STEP = 60 * Math.PI / 180, D = Math.PI / 180;
    const put = (b, x, y, i) => { x = Math.min(Math.max(x, x0), x1); y = Math.min(Math.max(y, y0), y1); b.style.setProperty('--dx', (x - cx).toFixed(1) + 'px'); b.style.setProperty('--dy', (y - cy).toFixed(1) + 'px'); b.style.setProperty('--i', i); };
    [...items.querySelectorAll('.b-dialitem')].forEach((b, i) => { const a = th + (i - 1) * STEP; put(b, cx + R * Math.cos(a), cy + R * Math.sin(a), i); });
    const q = [...items.querySelectorAll('.b-qitem')], n = q.length; if (!n) return;
    const QR = 224, room = cy - y0;   // the ring follows the half disc (176) + 14 + half a button (34) — user: "반원 위에 shape을 따라"
    let ang;
    if (room >= QR) {   // the whole ring: -165° … -15°, evenly spaced (user: "pause과 share 버튼 사이만 간격이 넓은데 버튼 사이 간격 동일하게")
      ang = q.map((_, i) => (-165 + 150 * (n > 1 ? i / (n - 1) : 0.5)) * D);
    } else {   // a short screen has no room above the disc: the ring splits, half on each side of it, under the top of the screen
      const lo = 10 * D, hi = Math.max(lo, Math.asin(Math.min(1, Math.max(0, room) / QR))), h = Math.ceil(n / 2), st = h > 1 ? (hi - lo) / (h - 1) : 0;
      ang = q.map((_, i) => (i < h ? -Math.PI + lo + i * st : -(hi - (i - h) * st)));
    }
    q.forEach((b, i) => put(b, cx + QR * Math.cos(ang[i]), cy + QR * Math.sin(ang[i]), i));
  }

  /* ---------- ‹ › beside the one button: back / next at any time, finished or not (user: "가운데 버튼 옆으로 좌우 이동할수
     있는 버튼 추가해줘. 학습을 다 안하고 다음학습이나 이전학습으로 넘어갈수도 있어서") — the guide's Back / Next (→ ←): step by
     step, on into the next activity at the end of one; a whole activity at once = the flow cards under the button. ---------- */
  function renderSides() {
    if (STUDENT) return;
    const pv = $('#fabPrev'), nx = $('#fabNext'); if (!pv || !nx) return;
    if (!pv.firstChild) { pv.innerHTML = ic('chevron-left'); nx.innerHTML = ic('chevron-left'); }
    const x = FP.mode() === 'extra', p = FP.peek(-1), n = FP.peek(1);
    pv.disabled = coverOn || (!x && !p); nx.disabled = !coverOn && !x && !n;   // the cover is the first page: › starts the lesson
    pv.title = x ? 'Back to the lesson' : p ? `Back — ${p.label} (←)` : 'Back';
    nx.title = coverOn ? 'Start the lesson (→)' : x ? 'Back to the lesson' : n ? `Next — ${n.label} (→)` : 'Next';
  }
  let drag = null, eatClickUntil = 0;
  function initMove() {
    const start = (e, el, key) => {
      if (!CLASSROOM() || e.button > 0 || !e.target.closest('button')) return;
      const r = el.getBoundingClientRect();
      drag = { key, el, id: e.pointerId, x0: e.clientX, y0: e.clientY, cx: r.left + r.width / 2, cy: r.top + r.height / 2, th: e.pointerType === 'touch' ? 10 : 6, moved: false };
    };
    $('#fabBtn').addEventListener('pointerdown', e => start(e, $('#fabBtn'), 'fab'));
    addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved) { if (Math.hypot(dx, dy) < drag.th) return; drag.moved = true; root.classList.add('is-moving'); if (palOpen) setPal(false); if (dialOpen) setDial(false); }
      const b = $('#stage').getBoundingClientRect();
      pos[drag.key] = [(drag.cx + dx - b.left) / b.width, (drag.cy + dy - b.top) / b.height];
      placeFab();
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) {   // keep what was saved on the board (the lift above an open guide is not saved)
        const b = $('#stage').getBoundingClientRect(), P = pos[drag.key], hw = (drag.el.offsetWidth / 2 + 8) / b.width, hh = (drag.el.offsetHeight / 2 + 8) / b.height;
        pos[drag.key] = [Math.min(Math.max(P[0], hw), 1 - hw), Math.min(Math.max(P[1], hh), 1 - hh)];
        put('pondc-pos', pos); eatClickUntil = performance.now() + 400; root.classList.remove('is-moving'); placeFab(); refreshDisplay();
      }
      drag = null;
    };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    addEventListener('click', e => { if (performance.now() < eatClickUntil) { eatClickUntil = 0; e.stopPropagation(); e.preventDefault(); } }, true);   // the drop is not a click
  }

  /* ---------- dock ---------- */
  const R = 25, C = 2 * Math.PI * R;
  /* planned minutes per activity (Lesson 1 TG: phonemic awareness 5, sound-spelling 10 = Learn and Say 5 + Say It 5, sound sort 5);
     the progress bar under the frame is sized by them and fills with the time spent (user: "진행시간을 미리 넣고 진행율") */
  const PLAN_MIN = { lmf: 3, ls1: 5, lssb: 5, si1: 5, si2: 5, si3: 3, bl1: 3, bl3: 5, sisb: 5, sigl: 2 };
  const planMin = a => PLAN_MIN[a.id] || (a.type === 'home' ? 2 : 5);
  const mmss = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function lessonPct() {   // planned minutes done (finished activities + time in the current one, up to its plan) / planned minutes in this section
    const flow = FP.flow(), cur = FP.cur(), extra = FP.mode() === 'extra';
    const total = flow.reduce((t, a) => t + planMin(a), 0) || 1;
    const done = flow.reduce((t, a) => t + (a.index < cur.index ? planMin(a) : 0), 0) + (extra ? 0 : Math.min(1, FP.timer.actElapsed() / (planMin(cur) * 60000)) * planMin(cur));
    return Math.min(100, Math.round(done / total * 100));
  }
  const back = l => `<button type="button" class="b-prev b-back" data-b="scene" data-v="lesson" title="Back to the lesson" aria-label="Back to the lesson">${ic('presentation')}<span>${l || 'Lesson'}</span></button>`;
  function renderDock() {
    const d = $('#dock'); if (!d) return;
    d.dataset.mode = scene;
    if (scene === 'timer') d.innerHTML = dockTimer();
    else if (scene === 'pick') d.innerHTML = dockPick();
    else if (scene === 'pause') d.innerHTML = dockPause();
    else d.innerHTML = dockLesson();
    tickRing(); tick();
  }
  function dockLesson() {
    const extra = FP.mode() === 'extra', flow = FP.flow(), cur = FP.cur(), st = FP.state();
    const segs = flow.map(a => { const on = !extra && a.index === cur.index, m = planMin(a), ms = on ? FP.timer.actElapsed() : 0, fill = a.index < cur.index ? 1 : on ? Math.min(1, ms / (m * 60000)) : 0;
      return `<button type="button" class="b-segm${on ? ' is-on' : ''}${on && ms > m * 60000 ? ' is-over' : ''}" style="flex:${m}" data-b="go" data-v="${a.id}" title="${esc(a.title)} · ${m} min" aria-label="${esc(a.title)}, ${m} minutes"><span class="b-segl"><b lang="en">${esc(a.title)}</b><em>${on ? `<span class="b-segt">${mmss(ms)}</span><span class="b-segp"> / ${m} min</span>` : `${m} min`}</em></span><i style="width:${(fill * 100).toFixed(1)}%"></i></button>`; }).join('')
      + `<span class="b-segsum" title="Planned time for this section · progress"><small>${flow.reduce((t, a) => t + planMin(a), 0)} min</small><b id="segPct">${lessonPct()}%</b></span>`;
    let left, mid, right;
    if (extra) {
      const it = FP.extraInfo(), gm = it.game ? it : null;
      left = `<div class="b-now"><div class="b-ring b-ring--icon">${ic(it.icon)}</div><div class="b-nowtx"><small>${esc(it.group)}${gm ? ` · Lesson ${FP.lesson().n}` : ''}</small><b>${esc(it.label)}</b><span lang="en">${esc(it.sub)}</span></div></div>`;
      const gmsg = !gm ? '' : game && game.where === 'here' ? `${esc(it.label)} is running on the board. Go back to the lesson when the round is over.` : game && game.where === 'screen' ? `${esc(it.label)} is running on the classroom screen.` : `Tap Play on the board to start ${esc(it.label)}.`;
      mid = `<div class="b-say b-say--quiet"><p>${curMedia() ? `Tap ▶ on the board or press K to play.` : gm ? gmsg : it.soon ? 'This activity is in production — the content area is ready for it.' : 'Run the activity, then go back to where you left the lesson.'}</p></div>`;
      right = `<div class="b-pn"><button type="button" class="b-next" data-b="close"><span><b>Back to lesson</b><small lang="en">${esc(cur.title)}</small></span>${ic('arrow-left')}</button></div>`;
    } else {
      const g = FP.guide(), c = g.cur || {}, nx = FP.peek(1), pv = FP.peek(-1), grp = FP.groups().find(x => x.id === cur.group) || {};
      left = `<div class="b-now"><div class="b-ring" id="ring" title="Time in this activity"><svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="${R}" class="b-ring-bg"/><circle cx="30" cy="30" r="${R}" class="b-ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><span id="ringTx">0:00</span></div>
        <div class="b-nowtx"><small lang="en">${esc(grp.label || '')}${grp.label ? ' · ' : ''}${esc(cur.kicker)}</small><b lang="en">${esc(cur.title)}</b><span lang="en">${cur.steps.length > 1 ? `Step ${st.step + 1} of ${cur.steps.length} · ${esc(cur.steps[st.step])}` : (cur.type === 'sb' ? 'SB ' + esc(cur.page || '') : cur.type === 'home' ? 'Home practice preview' : 'POLY prep · before the SB')}</span></div></div>`;
      mid = c.say ? `<div class="b-say"><span class="b-lab">Say</span><p lang="en">“${FP.hlSay(c.say)}”</p><span class="b-do"><b>Do</b> ${esc(c.do)}</span></div>` : `<div class="b-say"><span class="b-lab">Do</span><p class="b-p-do">${esc(c.do || '')}</p></div>`;
      const nl = nx ? ({ step: 'Next', activity: 'Next activity', section: 'Next section' }[nx.kind]) : 'Finished';
      right = `<div class="b-pn"><button type="button" class="b-prev" data-b="prev" ${pv ? '' : 'disabled'} aria-label="Back" title="Back (←)">${ic('chevron-left')}</button><button type="button" class="b-next" data-b="next" ${nx ? '' : 'disabled'} title="Next (→ / Space)"><span><b>${nl}</b><small lang="en">${nx ? esc(nx.label) : 'End of lesson'}</small></span>${ic('arrow-right')}</button></div>`;
    }
    const notesOn = root.dataset.notes === 'panel' ? root.dataset.npanel !== 'hidden' : notesOpen;
    return `<div class="b-segs" role="group" aria-label="Lesson progress">${segs}</div>
      <div class="b-dockrow">${left}${mid}<div class="b-dright"><div class="b-toggles"><button type="button" class="b-tg${notesOn ? ' is-on' : ''}" data-b="notes" aria-pressed="${notesOn}" title="Teacher notes (N)">${ic('notebook-pen')}<span>Notes</span></button><button type="button" class="b-tg${flowOpen ? ' is-on' : ''}" data-b="flow" aria-pressed="${flowOpen}" title="Run of show (L)">${ic('flow')}<span>Flow</span></button></div>${right}</div></div>`;
  }
  const PRESETS = [[30000, '30 s'], [60000, '1 min'], [120000, '2 min'], [180000, '3 min'], [300000, '5 min']];
  function dockTimer() {
    const left = tLeft(), state = TM.done ? 'Time’s up' : TM.run ? 'Running' : left < TM.dur ? 'Paused' : 'Ready';
    const go = TM.run ? ['Pause', 'The time stops', 'pause'] : TM.done ? ['Start again', clock(TM.dur), 'play'] : left < TM.dur ? ['Resume', clock(left) + ' left', 'play'] : ['Start', clock(TM.dur), 'play'];
    return `<div class="b-dockrow b-dockrow--tool"><div class="b-now"><div class="b-ring b-ring--icon">${ic('timer')}</div><div class="b-nowtx"><small>On the student screen</small><b>Timer</b><span><b class="b-tnum" id="dockTimer">${TM.done ? 'Time’s up!' : clock(left)}</b> · ${state}</span></div></div>
      <div class="b-tooltray"><div class="b-chips" role="group" aria-label="Timer length">${PRESETS.map(([ms, l]) => `<button type="button" class="b-chip${TM.dur === ms ? ' is-on' : ''}" data-b="tset" data-v="${ms}" title="Start ${l}">${l}</button>`).join('')}</div>
        <div class="b-chips"><button type="button" class="b-chip b-chip--icon" data-b="tadd" data-v="-30000" title="30 seconds less" aria-label="30 seconds less">${ic('minus')}</button><span class="b-chipl">30 s</span><button type="button" class="b-chip b-chip--icon" data-b="tadd" data-v="30000" title="30 seconds more" aria-label="30 seconds more">${ic('plus')}</button><button type="button" class="b-chip b-chip--quiet" data-b="treset">${ic('rotate-ccw')}Reset</button></div></div>
      <div class="b-dright"><div class="b-pn">${back()}<button type="button" class="b-next" data-b="tgo"><span><b>${go[0]}</b><small>${go[1]}</small></span>${ic(go[2])}</button></div></div></div>`;
  }
  function dockPick() {
    const notYet = roster.filter(n => !picked.has(n)).length;
    return `<div class="b-dockrow b-dockrow--tool"><div class="b-now"><div class="b-ring b-ring--icon">${ic('dices')}</div><div class="b-nowtx"><small>On the student screen</small><b>Pick a student</b><span>${notYet} of ${roster.length} still to go</span></div></div>
      <div class="b-tooltray b-tooltray--roster"><div class="b-roster" role="group" aria-label="Class list">${roster.map(n => `<button type="button" class="b-rchip${picked.has(n) ? ' is-done' : ''}${PK.name === n ? ' is-on' : ''}" data-b="pickone" data-v="${esc(n)}" title="Show ${esc(n)}"><i style="--c:${avColor(n)}">${initial(n)}</i><span lang="en">${esc(n)}</span></button>`).join('')}<button type="button" class="b-rchip b-rchip--edit" data-b="rosteredit">${ic('pencil')}<span>Edit list</span></button></div></div>
      <div class="b-dright"><div class="b-pn">${back()}<button type="button" class="b-next" data-b="pickrand"><span><b>Pick at random</b><small>Everyone gets a turn</small></span>${ic('shuffle')}</button></div></div></div>`;
  }
  function layerTimer() {   // the menu layer while the timer is on the board
    const left = tLeft(), state = TM.done ? 'Time’s up' : TM.run ? 'Running' : left < TM.dur ? 'Paused' : 'Ready';
    const go = TM.run ? ['Pause', 'The time stops', 'pause'] : TM.done ? ['Start again', clock(TM.dur), 'play'] : left < TM.dur ? ['Resume', clock(left) + ' left', 'play'] : ['Start', clock(TM.dur), 'play'];
    return `<div class="b-lyrow"><div class="b-lyhead b-lyhead--lesson b-lyhead--tool"><h3>${ic('timer')}Timer</h3><span class="b-lystate"><b id="lyTimer">${TM.done ? 'Time’s up!' : clock(left)}</b> · ${state}</span></div>
      <div class="b-lytray"><div class="b-chips" role="group" aria-label="Timer length">${PRESETS.map(([ms, l]) => `<button type="button" class="b-chip${TM.dur === ms ? ' is-on' : ''}" data-b="tset" data-v="${ms}" title="Start ${l}">${l}</button>`).join('')}</div>
        <div class="b-chips"><button type="button" class="b-chip b-chip--icon" data-b="tadd" data-v="-30000" title="30 seconds less" aria-label="30 seconds less">${ic('minus')}</button><span class="b-chipl">30 s</span><button type="button" class="b-chip b-chip--icon" data-b="tadd" data-v="30000" title="30 seconds more" aria-label="30 seconds more">${ic('plus')}</button><button type="button" class="b-chip b-chip--quiet" data-b="treset">${ic('rotate-ccw')}Reset</button></div>
        <div class="b-pn">${back()}<button type="button" class="b-next" data-b="tgo"><span><b>${go[0]}</b><small>${go[1]}</small></span>${ic(go[2])}</button></div></div></div>`;
  }
  function layerPick() {   // the menu layer while the student pick is on the board
    const notYet = roster.filter(n => !picked.has(n)).length;
    return `<div class="b-lyrow"><div class="b-lyhead b-lyhead--lesson b-lyhead--tool"><h3>${ic('dices')}Pick a student</h3><span class="b-lystate">${notYet} of ${roster.length} still to go</span></div>
      <div class="b-lytray b-lytray--pick"><div class="b-roster" role="group" aria-label="Class list">${roster.map(n => `<button type="button" class="b-rchip${picked.has(n) ? ' is-done' : ''}${PK.name === n ? ' is-on' : ''}" data-b="pickone" data-v="${esc(n)}" title="Show ${esc(n)}"><i style="--c:${avColor(n)}">${initial(n)}</i><span lang="en">${esc(n)}</span></button>`).join('')}</div>
        <div class="b-pn"><button type="button" class="b-prev b-redit" data-b="rosteredit" title="Edit the class list" aria-label="Edit the class list">${ic('pencil')}<span>Edit list</span></button>${back()}<button type="button" class="b-next" data-b="pickrand"><span><b>Pick at random</b><small>Everyone gets a turn</small></span>${ic('shuffle')}</button></div></div></div>`;
  }
  function dockPause() {
    const to = { lesson: 'the lesson', timer: 'the timer', pick: 'the student pick' }[resumeTo] || 'the lesson';
    return `<div class="b-dockrow b-dockrow--tool"><div class="b-now"><div class="b-ring b-ring--icon">${ic('monitor-pause')}</div><div class="b-nowtx"><small>On the student screen</small><b>Eyes on me</b><span>${live ? 'The tablets are paused' : 'The student screen is paused'}</span></div></div>
      <div class="b-say b-say--quiet"><p>${live ? 'Only the classroom screen is paused — your dashboard keeps working.' : 'Students see “Eyes on me!” in the frame — your notes and controls keep working.'}</p></div>
      <div class="b-dright"><div class="b-pn"><button type="button" class="b-next" data-b="scene" data-v="pause"><span><b>Resume</b><small>Back to ${to}</small></span>${ic('play')}</button></div></div></div>`;
  }
  function tickRing() {
    const seg = document.querySelector('.b-segs .b-segm.is-on');
    if (seg) {   // the current activity fills with the time spent, against its planned minutes
      const pl = planMin(FP.cur()) * 60000, t = FP.timer.actElapsed();
      seg.querySelector('i').style.width = (Math.min(1, t / pl) * 100).toFixed(1) + '%';
      seg.classList.toggle('is-over', t > pl);
      const tx = seg.querySelector('.b-segt'); if (tx) tx.textContent = mmss(t);
    }
    const pct = $('#segPct'); if (pct) pct.textContent = lessonPct() + '%';
    const ring = $('#ring'); if (!ring) return;
    const a = FP.cur(), ms = FP.timer.actElapsed(), plan = planMin(a) * 60000;   // same plan as the progress bar
    const fg = ring.querySelector('.b-ring-fg');
    const p = plan ? Math.min(1, ms / plan) : (ms % 60000) / 60000;
    fg.setAttribute('stroke-dashoffset', (C * (1 - p)).toFixed(1));
    ring.classList.toggle('is-over', plan && ms > plan);
    ring.classList.toggle('is-free', !plan);
    const s = Math.floor(ms / 1000); $('#ringTx').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /* ---------- timer actions ---------- */
  function timerChanged() { renderDock(); tick(); broadcast(); if (dialOpen && scene === 'timer') renderLayer(); }
  function timerAct(a, v) {
    if (a === 'tset') { TM.dur = TM.left = v; TM.done = false; TM.run = true; TM.endAt = Date.now() + v; TM.windAt = Date.now(); }   // 1 · a fresh start winds up
    if (a === 'tgo') {
      if (TM.run) { TM.left = tLeft(); TM.run = false; }
      else { const full = TM.done || TM.left <= 0 || TM.left >= TM.dur; if (TM.done || TM.left <= 0) TM.left = TM.dur; TM.done = false; TM.run = true; TM.endAt = Date.now() + TM.left; if (full) TM.windAt = Date.now(); }   // (a resume does not wind up)
    }
    if (a === 'tadd') { const l = Math.max(0, tLeft() + v); TM.left = l; TM.dur = Math.max(TM.dur, l); TM.done = false; if (TM.run) TM.endAt = Date.now() + l; }
    if (a === 'treset') { TM.left = TM.dur; TM.run = false; TM.done = false; }
    timerChanged();
  }

  /* ---------- pick a student ---------- */
  function showStudent(n, spin) {
    if (!n) return;
    PK.name = n; PK.t0 = Date.now(); PK.seq = null;
    if (spin && roster.length > 1) {
      const rest = roster.filter(x => x !== n && !picked.has(x)), pool = rest.length >= 2 ? rest : roster.filter(x => x !== n), seq = [];
      for (let i = 0; i < 16; i++) { let x; do x = pool[Math.floor(Math.random() * pool.length)]; while (pool.length > 1 && x === seq[seq.length - 1]); seq.push(x); }
      seq.push(n); PK.seq = seq;
    }
    picked.add(n); put('pondc-picked', [...picked]);
    if (scene !== 'pick') setScene('pick'); else { renderScene(); renderDock(); broadcast(); }
  }
  function pickRandom() { let pool = roster.filter(n => !picked.has(n)); if (!pool.length) { picked.clear(); pool = roster.slice(); } showStudent(pool[Math.floor(Math.random() * pool.length)], true); }
  function renderRoster() {
    $('#rosterPop').innerHTML = `<div class="b-pophead"><h3>Class list</h3><p>One name per line. The list stays on this device.</p></div><textarea id="rosterTx" rows="12" spellcheck="false" aria-label="Student names">${esc(roster.join('\n'))}</textarea>
      <div class="b-ractions"><button type="button" class="b-sbtn" data-b="rosterclear" title="Everyone can be picked again">${ic('rotate-ccw')}Clear picks</button><span></span><button type="button" class="b-sbtn" data-b="rosterclose">Cancel</button><button type="button" class="b-sbtn b-sbtn--go" data-b="rostersave">${ic('check')}Save</button></div>`;
  }
  function saveRoster() {
    const names = [...new Set($('#rosterTx').value.split('\n').map(s => s.trim()).filter(Boolean))].slice(0, 60);
    roster = names.length ? names : DEF_ROSTER.slice(); put('pond-roster', roster);
    picked = new Set([...picked].filter(n => roster.includes(n))); put('pondc-picked', [...picked]);
    if (PK.name && !roster.includes(PK.name)) { PK.name = ''; PK.seq = null; }
    if (scene === 'pick') renderScene();
    $('#rosterPop').hidePopover(); renderDock(); broadcast(); if (dialOpen && scene === 'pick') renderLayer();
  }

  /* ---------- run of show ---------- */
  function renderFlow() {
    const el = $('#flowStrip'); el.hidden = !flowOpen; if (!flowOpen) return;
    const flow = FP.flow(), cur = FP.cur(), st = FP.state(), extra = FP.mode() === 'extra';
    el.innerHTML = `<div class="b-sheethead"><h3>Run of show <span lang="en">${esc(FP.section().name)}</span></h3><button type="button" class="b-x" data-b="flow" aria-label="Close run of show">${ic('x')}</button></div>
      <div class="b-cards">${FP.groups().map(g => { const items = flow.filter(a => a.group === g.id); return items.length ? `<div class="b-cgroup"><p lang="en">${esc(g.label)}</p><div>${items.map(a => { const on = !extra && a.id === cur.id, done = !extra && a.index < cur.index;
        return `<button type="button" class="b-card${on ? ' is-on' : ''}${done ? ' is-done' : ''}" data-b="go" data-v="${a.id}"><small>${esc(a.kicker)}</small><b lang="en">${esc(a.title)}</b><span class="b-cmeta"><em class="b-type b-type--${a.type}">${a.type === 'sb' ? 'SB' : a.type === 'home' ? 'Home' : 'Prep'}</em>${a.steps.length > 1 ? `<span class="b-dots">${a.steps.map((_, i) => `<i class="${on && i === st.step ? 'is-on' : (done || (on && i < st.step)) ? 'is-done' : ''}"></i>`).join('')}</span>` : ''}</span></button>`; }).join('')}</div></div>` : ''; }).join('')}</div>`;
    const on = el.querySelector('.b-card.is-on'), box = el.querySelector('.b-cards');
    if (on && box) box.scrollLeft = on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2;
  }

  /* ---------- teacher notes: pop-up sheet or docked side panel ---------- */
  function notesParts() {
    const g = FP.guide(), st = FP.state();
    let main = '';
    if (g.mode === 'extra') main = `<p class="b-goal">${esc(g.goal)}</p>`;
    else {
      main = `<p class="b-goal"><b>Goal</b> ${esc(g.goal)}</p><ol class="b-steps">${g.steps.map((s, i) => { const on = i === st.step;
        return `<li class="${on ? 'is-on' : ''}${i < st.step ? ' is-done' : ''}"><button type="button" data-b="step" data-v="${i}"><span>${i < st.step ? ic('check') : i + 1}</span><b lang="en">${esc(s.title)}</b></button>${on ? `<div class="b-stepbody">${s.say ? `<p class="b-sayl" lang="en">“${FP.hlSay(s.say)}”</p>` : ''}<p><b>Do</b> ${esc(s.do)}</p>${s.kids ? `<p><b>Kids</b> ${esc(s.kids)}</p>` : ''}${s.tg ? `<p class="b-tgq"><b>TG</b> <span lang="en">${esc(s.tg)}</span></p>` : ''}</div>` : ''}</li>`; }).join('')}</ol>`;
      if (g.words && g.words.length) main += `<div class="b-words"><b>Words</b>${g.words.map(w => `<button type="button" data-b="say" data-v="${esc(w)}" lang="en">${esc(w)}</button>`).join('')}</div>`;
      if (g.answer) main += `<p class="b-answer"><b>Answer key</b> Yes: ${g.answer.yes.map(esc).join(' · ')} &nbsp;·&nbsp; No: ${g.answer.no.map(esc).join(' · ')}</p>`;
      if (g.pending) main += `<p class="b-muted">${ic('sparkle')} The step-by-step script arrives with this section’s content.</p>`;
    }
    const p = FP.plan(), t = g.tip;
    const body = notesTab === 'plan'
      ? `<p class="b-lab2">Today · ${esc(p.day)}</p><ol class="b-day">${p.flow.map(f => `<li${/Sound-Spelling/.test(f) ? ' class="is-on"' : ''}>${esc(f)}</li>`).join('')}</ol>
         <p class="b-lab2">Materials</p><p>${esc(p.materials)}</p>
         ${[p.a1, p.a2].map((x, i) => `<div class="b-pcard"><b lang="en">${i + 1} · ${esc(x.title)}</b><p>${esc(x.goal)}</p>${x.tg ? `<small>TG objective · <span lang="en">${esc(x.tg)}</span></small>` : ''}</div>`).join('')}`
      : `<p class="b-tip">${esc(t.text)}</p>${t.pairs.length ? `<div class="b-pairs">${t.pairs.map(q => `<span><button type="button" data-b="say" data-v="${esc(q[0])}" lang="en">${esc(q[0])}</button><i>vs</i><button type="button" data-b="say" data-v="${esc(q[1])}" lang="en">${esc(q[1])}</button></span>`).join('')}</div>` : ''}
         ${t.tg ? `<p class="b-tgq"><b>TG · English Learners</b> <span lang="en">${esc(t.tg)}</span></p>` : ''}
         <p class="b-lab2">Corrective feedback</p><p><b lang="en">My turn.</b> → <b lang="en">What’s the sound?</b> → <b lang="en">Let’s start over.</b></p>`;
    const side = `<div class="b-tabs" role="tablist"><button type="button" role="tab" aria-selected="${notesTab === 'plan'}" data-b="ntab" data-v="plan">Plan</button><button type="button" role="tab" aria-selected="${notesTab === 'support'}" data-b="ntab" data-v="support">Korean learners</button></div>${body}`;
    return { g, main, side };
  }
  function renderNotes() {
    const sheet = $('#notes'), np = $('#npanel');
    if (root.dataset.notes === 'panel') {
      sheet.hidden = true;
      const { g, main, side } = notesParts();
      np.innerHTML = `<div class="b-nphead"><h3>Teacher notes</h3><span lang="en">${esc(g.title)}</span><button type="button" class="b-x" data-b="notes" aria-label="Hide notes" title="Hide notes (N)">${ic('x')}</button></div><div class="b-npbody">${main}<div class="b-npside">${side}</div></div>`;
      const on = np.querySelector('.b-steps li.is-on'), body = np.querySelector('.b-npbody');
      if (on && body) body.scrollTop = Math.max(0, on.offsetTop - 70);
      return;
    }
    np.innerHTML = '';
    sheet.hidden = !notesOpen; if (!notesOpen) return;
    const { g, main, side } = notesParts();
    sheet.innerHTML = `<div class="b-sheethead"><h3>Teacher notes <span lang="en">${esc(g.title)}</span></h3><button type="button" class="b-x" data-b="notes" aria-label="Close notes">${ic('x')}</button></div>
      <div class="b-notesgrid"><div class="b-ncol">${main}</div><div class="b-ncol b-ncol--side">${side}</div></div>`;
  }
  function toggleSheet(which) {
    if (which === 'notes' && root.dataset.notes === 'panel') {
      root.dataset.npanel = root.dataset.npanel === 'hidden' ? 'shown' : 'hidden'; put('pondc-npanel', root.dataset.npanel);
      renderNotes(); renderDock(); requestAnimationFrame(placeFab); return;
    }
    if (which === 'notes') { notesOpen = !notesOpen; if (notesOpen) flowOpen = false; }
    else { flowOpen = !flowOpen; if (flowOpen) notesOpen = false; }
    renderFlow(); renderNotes(); renderDock();
  }

  /* ---------- lesson map ---------- */
  function renderMap() {
    const D = FP.data, L = FP.lesson(), pick = mapPick || L.n, P = D.lessons[pick], lab = (P.lab || '').split(' · ');
    const secs = P.secs || [], curSec = FP.state().sec;
    $('#map').innerHTML = `<div class="b-mapsheet"><div class="b-maphead"><div><h2>Lesson map</h2><p>From Phonics to Reading · Level K</p></div><button type="button" class="b-x b-x--lg" data-b="mapclose" aria-label="Close lesson map">${ic('x')}</button></div>
      <div class="b-mapbody"><div class="b-units">${D.units.map(u => `<section class="b-ucol"><h3><b>Unit ${u.n}</b><span>${esc(u.theme)}</span></h3>${u.lessons.map(n => { const d = D.lessons[n], lb = (d.lab || '').split(' · ');
        return `<button type="button" class="b-ltile${n === pick ? ' is-pick' : ''}${n === L.n ? ' is-cur' : ''}" data-b="mappick" data-v="${n}"><span class="b-ltl${(lb[0] || d.ltr).length > 3 ? ' is-long' : ''}" lang="en">${esc(lb[0] || d.ltr)}</span><span class="b-ltinfo"><b>Lesson ${n}</b><small lang="en">${esc(d.snd)}${lb[1] ? ' · ' + esc(lb[1]) : ''}</small></span>${n === L.n ? '<em>Now</em>' : ''}</button>`; }).join('')}</section>`).join('')}</div>
      <aside class="b-preview"><span class="b-pvl" lang="en">${esc(P.key)}</span><h3>Lesson ${pick} <span lang="en">${esc(P.snd)}</span></h3><p>Unit ${P.unit || 1} · ${esc(FP.unitTheme(P.unit || 1))} · ${esc(P.day)} · SB p${P.sb}${lab[1] ? ` · <span lang="en">${esc(lab[1])}</span>` : ''}</p>
        <ol class="b-secs">${secs.map((s, i) => `<li><button type="button" data-b="mapsec" data-v="${i}" class="${pick === L.n && i === curSec ? 'is-cur' : ''}"><span>${i + 1}</span><b lang="en">${esc(s[0])}</b><small>SB ${esc(s[1])}</small>${s[0] === 'Introduction' ? '<em class="is-ready">Ready</em>' : '<em>Soon</em>'}</button></li>`).join('')}</ol>
        <button type="button" class="b-open" data-b="mapopen">${pick === L.n ? 'Back to the lesson' : `Open Lesson ${pick}`}${ic('arrow-right')}</button></aside></div></div>`;
  }
  function openMap(on) { const m = $('#map'); if (on) { mapPick = FP.lesson().n; renderMap(); m.hidden = false; m.querySelector('.b-x').focus(); } else m.hidden = true; }

  /* ---------- class activities + games ---------- */
  function renderExtras() {
    const cur = FP.extraInfo();
    $('#extrasPop').innerHTML = `<div class="b-pophead"><h3>Class activities</h3><p>Outside the lesson flow — the lesson waits where you left it.</p></div><div class="b-xgrid">${FP.extras().map(g => `<section><h4>${ic(g.icon)}${esc(g.group)}</h4>${g.items.map(it => `<button type="button" class="b-xi${it.soon ? ' is-soon' : ''}${cur && cur.id === it.id ? ' is-on' : ''}" data-b="extra" data-v="${it.id}"><b>${esc(it.label)}</b><small>${esc(it.sub)}</small>${it.soon ? '<em>Soon</em>' : it.game ? `<span class="b-xgame">${ic('gamepad')}Game</span>` : hasVideo(it.id) ? `<span class="b-xvid">${ic('play')}Video</span>` : ''}</button>`).join('')}</section>`).join('')}</div>`;
  }

  /* ---------- sections menu (breadcrumb) ---------- */
  function sectionsMenu(btn) {
    let m = $('#secMenu'); if (!m) { m = document.createElement('div'); m.id = 'secMenu'; m.className = 'b-pop b-pop--secs'; m.popover = 'auto'; document.body.appendChild(m); }
    m.innerHTML = `<p class="b-lab2">Lesson ${FP.lesson().n} sections</p>${FP.sections().map(s => `<button type="button" class="b-secitem${s.on ? ' is-on' : ''}" data-b="sec" data-v="${s.i}"><span>${s.i + 1}</span><b lang="en">${esc(s.name)}</b><small>SB ${esc(s.pages)}</small>${s.built ? '<em class="is-ready">Ready</em>' : '<em>Soon</em>'}</button>`).join('')}`;
    const r = btn.getBoundingClientRect(); if (!placePop(m, btn)) { m.style.left = r.left + 'px'; m.style.top = (r.bottom + 8) + 'px'; }
    m.showPopover(); clampPop(m);
  }

  /* ---------- activity menu (breadcrumb): the section's activities, or the class activities of the open group ---------- */
  function actMenu(btn) {
    let m = $('#actMenu'); if (!m) { m = document.createElement('div'); m.id = 'actMenu'; m.className = 'b-pop b-pop--secs b-pop--acts'; m.popover = 'auto'; document.body.appendChild(m); }
    {
      const flow = FP.flow(), cur = FP.cur(), groups = FP.groups().map(g => [g, flow.filter(a => a.group === g.id)]).filter(([, a]) => a.length);
      const row = a => { const on = a.id === cur.id, done = a.index < cur.index;
        return `<button type="button" class="b-secitem${on ? ' is-on' : ''}${done ? ' is-done' : ''}" data-b="${on && FP.mode() === 'extra' ? 'close' : 'go'}" data-v="${a.id}"><span>${done ? ic('check') : a.index + 1}</span><b lang="en">${esc(a.title)}</b><small>${hasVideo(a.id) ? ic('play') + 'Video · ' : ''}${flowGame(a) || (a.id === 'si1' && a.steps.length > MF_GAMES) ? ic('gamepad') + 'Game · ' : ''}${a.pending ? 'SB ' + esc(a.page) : a.steps.length + (a.steps.length > 1 ? ' steps' : ' step')}</small><em>${a.type === 'sb' ? 'SB' : a.type === 'home' ? 'Home' : 'Prep'}</em></button>`; };
      m.innerHTML = `<p class="b-lab2" lang="en">${esc(FP.section().name)} · ${flow.length} ${flow.length === 1 ? 'activity' : 'activities'}</p>${groups.map(([g, items]) => `${groups.length > 1 ? `<p class="b-lab3" lang="en">${esc(g.label)}</p>` : ''}${items.map(row).join('')}`).join('')}`;
    }
    const r = btn.getBoundingClientRect(); if (!placePop(m, btn)) { m.style.left = Math.max(8, Math.min(r.left, innerWidth - 428)) + 'px'; m.style.top = (r.bottom + 8) + 'px'; }
    m.showPopover(); clampPop(m);
  }

  /* ---------- display: layout + colour ---------- */
  function renderDisplay() { const pop = $('#displayPop'), prev = pop ? selKeys(pop) : new Set(); renderDisplay0(); if (pop) markNew(pop, prev); }   // 9: the new choice's ring grows in
  function renderDisplay0() {
    const opt = (k, v, label) => `<button type="button" class="b-opt" data-b="layout" data-k="${k}" data-v="${v}" aria-pressed="${root.dataset[k] === v}"><span class="b-thumb b-thumb--${k}-${v}" aria-hidden="true"><i class="t"></i><i class="s"></i><i class="d"></i><i class="n"></i></span><b>${label}</b></button>`;
    const col = ([v, label, frame, board, act]) => `<button type="button" class="b-opt" data-b="theme" data-v="${v}" aria-pressed="${root.dataset.theme === v}"><span class="b-thumb b-thumb--color" style="--f:${frame};--st:${board};--a:${act}" aria-hidden="true"><i class="s"></i><i class="a"></i></span><b>${label}</b></button>`;
    $('#displayPop').innerHTML = `<div class="b-pophead"><h3>Display</h3><p>Arrange the dashboard your way — saved on this device.${CLASSROOM() ? '' : ' The student screen stays 16:10 (1280 × 800).'}</p></div>
      <section class="b-dsec"><h4>Screen</h4><div class="b-opts">${LAYOUT.screen.map(([v, l]) => opt('screen', v, l)).join('')}</div></section>
      <section class="b-dsec"><h4>${CLASSROOM() ? 'Teacher guide' : 'Controls'}</h4><div class="b-opts">${LAYOUT.controls.map(([v, l]) => opt('controls', v, l)).join('')}</div></section>
      <section class="b-dsec"><h4>Teacher notes</h4><div class="b-opts">${LAYOUT.notes.map(([v, l]) => opt('notes', v, l)).join('')}</div></section>
      <section class="b-dsec"><h4>Color</h4><div class="b-opts b-opts--color">${THEMES.map(col).join('')}</div></section>
      ${CLASSROOM() ? `<section class="b-dsec"><h4>Sound effects</h4><div class="b-opts b-opts--sfx">${[[true, 'On', 'volume-2'], [false, 'Off', 'volume-x']].map(([v, l, i]) => `<button type="button" class="b-opt b-opt--sfx" data-b="sfx" data-v="${v ? 'on' : 'off'}" aria-pressed="${(get('pondc-sfx', true) !== false) === v}">${ic(i)}<b>${l}</b></button>`).join('')}</div></section>` : ''}
      ${CLASSROOM() ? `<section class="b-dsec"><h4>Button</h4><button type="button" class="b-sbtn b-dreset" data-b="posreset" title="The one button back to the middle of the bottom edge" ${pos.fab ? '' : 'disabled'}>${ic('rotate-ccw')}Reset position</button></section>` : ''}`;
  }
  function refreshDisplay() { if ($('#displayPop').matches(':popover-open')) renderDisplay(); }

  /* ---------- share with students ---------- */
  let lastPing = 0, inkRaf = 0, stopAt = 0;
  function broadcast() {
    if (!CH || !FP.lesson()) return;
    const s = FP.state();
    CH.postMessage({ type: 'state', lesson: FP.lesson().n, sec: s.sec, act: s.act, step: s.step, extra: s.extra, theme: root.dataset.theme, scene, cover: coverOn, timer: { dur: TM.dur, left: tLeft(), endAt: TM.endAt, run: TM.run, done: TM.done, windAt: TM.windAt }, pick: { name: PK.name, seq: PK.seq, t0: PK.t0, roster, picked: [...picked] }, game, media: { key: MD.key, idx: MD.idx, playing: MD.playing, pos: mPos(), at: Date.now() }, ink: FP.ink.export() });
  }
  function broadcastInk() { if (inkRaf) return; inkRaf = requestAnimationFrame(() => { inkRaf = 0; broadcast(); }); }
  function setLive(on) {
    if (live === on) return; live = on;
    if (!on && game && game.where === 'screen') game = null;
    renderShareBtn(); renderScenes(); renderGame(); renderScene(); renderDock(); syncMedia();
    fitTop(true);   // measure again now that the live dot sits in the top bar too
    if ($('#sharePop').matches(':popover-open')) renderShare();
  }
  if (CH) CH.onmessage = ({ data: m }) => {
    if (!m) return;
    if (m.type === 'hello' || m.type === 'ping') {
      if (Date.now() - stopAt < 3000) return;   // a preview told to stop may still ping while it closes
      if (m.type === 'hello' && shareTo === 'none') shareTo = 'mirror';   // a tablet preview said hello: it shows this screen
      const was = live; lastPing = Date.now(); setLive(true); if (m.type === 'hello' || !was) broadcast();
    }
    if (m.type === 'bye') { lastPing = 0; setLive(false); }
    if (m.type === 'cmd') runCmd(m.a, m.v);
  };
  setInterval(() => { if (live && Date.now() - lastPing > 5000) setLive(false); }, 1000);
  function renderShareBtn() {
    const b = $('#shareBtn'), on = shareTo !== 'none';
    b.classList.toggle('is-live', live); b.classList.toggle('is-on', on);
    b.innerHTML = `${live ? '<i class="b-live" aria-hidden="true"></i>' : ''}${on ? (hasScreen() ? ic('monitor') : '') + ic('tablet') : ic('cast')}<span>${on ? 'Sharing' : 'Share'}</span>`;
    const to = hasScreen() ? 'student tablets — same screen' : 'student tablets — on their own';
    b.title = on ? `Sharing to ${to} (S)` : 'Share with students (S)'; b.setAttribute('aria-label', on ? `Sharing to ${to}` : 'Share with students');
    fitTop(); if (dialOpen) renderFab();
  }
  function openStudent() { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('view', 'student'); window.open(u.href, 'pondc-student', 'popup,width=1280,height=800'); }
  function stopScreen() { if (CH) CH.postMessage({ type: 'stop' }); lastPing = 0; stopAt = Date.now(); setLive(false); }
  function setShareTo(v) {
    shareTo = v;
    if (!hasScreen() && live) stopScreen();   // the tablet preview only shows the same screen
    renderShareBtn(); if ($('#sharePop').matches(':popover-open')) renderShare();
  }
  function renderShare() {   // 8: the white block slides over to the new choice (user: "8번")
    const pop = $('#sharePop'), was = pop.querySelector('.b-sto button[aria-pressed="true"]'), from = was ? [was.dataset.v, was.offsetLeft, was.offsetWidth] : null;
    renderShare0();
    const on = pop.querySelector('.b-sto button[aria-pressed="true"]');
    if (!on || !from || from[0] === on.dataset.v || !pop.matches(':popover-open') || RM()) return;
    const hl = document.createElement('i'); hl.className = 'b-stohl'; on.parentElement.prepend(hl);
    Object.assign(hl.style, { left: on.offsetLeft + 'px', top: on.offsetTop + 'px', width: on.offsetWidth + 'px', height: on.offsetHeight + 'px' });
    on.classList.add('is-hlmove');
    hl.animate([{ transform: `translateX(${from[1] - on.offsetLeft}px)`, width: from[2] + 'px' }, { transform: 'none', width: on.offsetWidth + 'px' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => { hl.remove(); on.classList.remove('is-hlmove'); };
  }
  function renderShare0() {   // two choices for the students' tablets (user: "두개 버튼만 있으면돼")
    const opt = (v, icons, label, sub, tip) => `<button type="button" data-b="shareto" data-v="${v}" aria-pressed="${shareTo === v}" title="${tip}"><span class="b-stic">${icons}</span><b>${label}</b><small>${sub}</small></button>`;
    const join = `<div class="b-scode"><span class="b-sqr">${ic('qr-code')}</span><div><small>Class code</small><b class="num">${TCODE}</b><span>0 joined · preview — tablets can join once the class server is ready</span></div></div>`;
    $('#sharePop').innerHTML = `<div class="b-pophead"><h3>Share with students</h3><p>On the students’ tablets — never your notes or controls.</p></div>
      <div class="b-sto b-sto--2" role="group" aria-label="Share to the tablets">${opt('mirror', ic('monitor') + ic('tablet'), 'Same screen', 'Tablets show this screen', 'The tablets follow this screen: every step, your drawing, the timer, the pick and the pause')}${opt('solo', ic('tablet'), 'On their own', 'Students work on their tablets', 'Each student works on their own tablet, apart from the classroom screen')}</div>
      ${shareTo === 'none' ? '' : `<div class="b-sjoin">${join}</div>
      <div class="b-sfoot">${hasScreen() ? `<button type="button" class="b-sbtn" data-b="shareopen" title="${live ? 'The tablet preview is connected — bring it to the front' : 'Open a window that shows what the tablets see'}">${live ? '<i class="b-live" aria-hidden="true"></i>Show the preview' : ic('external-link') + 'Open a tablet preview'}</button>` : ''}<button type="button" class="b-sbtn b-sbtn--stop" data-b="sharestop">${ic('x')}Stop sharing</button></div>`}`;   // the preview beside Stop sharing, one row (user: "Open a tablet preview 버튼 따로 넣지말고 밑에 stop sharing과 나란히")
  }


  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-b]'); if (!t || t.disabled) return;
    const a = t.dataset.b, v = t.dataset.v, inLayer = !!t.closest('#layer');   // (read before the layer re-renders under the click)
    switch (a) {
      case 'go': FP.go(v, 0); break;
      case 'step': FP.setStep(+v); break;
      case 'next': if (coverOn) startLesson(); else FP.next(); break;   // on the cover: › starts the lesson at its first step
      case 'prev': FP.prev(); break;
      case 'coverstart': startLesson(); break;   // the picture's 수업 시작
      case 'covermusic': bgmToggle(); break;   // the cover's speaker = the music on / off (user)
      case 'sfx': put('pondc-sfx', v === 'on'); bgmMuted = v !== 'on'; renderDisplay(); bgmSync(); bgmFace(); if (v === 'on') sfx('tick'); break;
      case 'close': FP.closeExtra(); break;
      case 'tool': FP.ink.set({ tool: v }); break;
      case 'color': FP.ink.set({ color: v }); break;
      case 'width': FP.ink.set({ width: +v }); break;
      case 'undo': FP.ink.undo(); break;
      case 'clear': FP.ink.clear(); break;
      case 'notes': toggleSheet('notes'); break;
      case 'flow': toggleSheet('flow'); break;
      case 'ntab': notesTab = v; renderNotes(); break;
      case 'say': FP.speak(v); break;
      case 'extra': FP.openExtra(v); if ($('#extrasPop').matches(':popover-open')) $('#extrasPop').hidePopover(); if (scene !== 'lesson') setScene('lesson'); break;
      case 'sections': sectionsMenu(t); break;
      case 'actmenu': actMenu(t); break;
      case 'sec': { FP.setSection(+v); const sm = $('#secMenu'); if (sm && sm.matches(':popover-open')) sm.hidePopover(); break; }
      case 'mappick': mapPick = +v; renderMap(); break;
      case 'mapsec': if (mapPick !== FP.lesson().n) FP.setLesson(mapPick); FP.setSection(+v); openMap(false); break;
      case 'mapopen': if (mapPick !== FP.lesson().n) FP.setLesson(mapPick); openMap(false); break;
      case 'mapclose': openMap(false); break;
      case 'lessonmap': openMap(true); break;   // the menu layer's › : unit / lesson picker over the layer
      case 'theme': themeFade(v); break;
      case 'layout': setLayout(t.dataset.k, v); break;
      case 'scene': setScene(v); break;
      case 'tset': case 'tgo': case 'tadd': case 'treset': timerAct(a, +v || 0); break;
      case 'pickone': showStudent(v, false); break;
      case 'pickrand': pickRandom(); break;
      case 'rosteredit': $('#rosterPop').showPopover(); break;
      case 'rostersave': saveRoster(); break;
      case 'rosterclose': $('#rosterPop').hidePopover(); break;
      case 'rosterclear': picked.clear(); put('pondc-picked', []); PK.name = ''; PK.seq = null; $('#rosterPop').hidePopover(); if (scene === 'pick') renderScene(); renderDock(); broadcast(); if (dialOpen && scene === 'pick') renderLayer(); break;
      case 'gplay': { const it = curGame(); if (it) { game = { id: it.id, where: v === 'screen' ? 'screen' : 'here' }; renderGame(); renderDock(); broadcast(); } break; }
      case 'gstop': game = null; renderGame(); renderDock(); broadcast(); break;
      case 'mtoggle': case 'mrestart': mediaCmd(a); break;
      case 'mseek': mediaCmd(a, seekAt(e, t)); break;
      case 'shareopen': openStudent(); break;
      case 'shareto': if (v === shareTo && hasScreen()) openStudent(); else setShareTo(v); break;
      case 'sharestop': setShareTo('none'); break;
      case 'dset': setDial(false); $('#displayPop').showPopover(); break;   // Settings = the template (the Display popover), from the bottom
      case 'dquick': quickOpen = !quickOpen; renderFab(); break;   // Quick: the ring of round buttons around the half disc
      case 'qshare': setDial(false); $('#sharePop').showPopover(); break;
      case 'dguide': setDial(false); setGuide(!guideOpen); break;
      case 'dpen': setDial(false); if (menuOpen) setMenu(false); if (!FP.ink.state().on) FP.ink.toggle(); setPal(true); break;   // Pen = drawing on now, the tools at hand
      case 'posreset': pos = {}; put('pondc-pos', pos); placeFab(); renderDisplay(); break;
    }
    if (menuOpen && ['go', 'extra', 'close', 'mapsec', 'mapopen', 'scene'].includes(a) && !t.closest('.b-dock, .b-sheet, .b-npanel')) setMenu(false);   // picked: the class sees it
    const toolSet = a === 'scene' && (v === 'timer' || v === 'pick') && scene === v;   // Timer / Pick: their settings under the × at once; Pause closes the menu so the class sees "Eyes on me!" whole
    if (dialOpen && toolSet) { quickOpen = false; renderLayer(); placeFab(); renderFab(); }   // Timer / Pick: their settings in the layer under the × (user)
    else if (dialOpen && (a === 'go' || a === 'extra' || a === 'scene')) setDial(false);   // picked in the layer or the Quick ring: the class sees it
    if (dialOpen && inLayer && (a === 'tset' || (a === 'tgo' && TM.run) || a === 'pickrand' || a === 'pickone')) setDial(false);   // started / picked: the class sees it
    else if (dialOpen && inLayer && root.dataset.dialtool !== 'none') placeFab();   // the tool layer may have changed height
  });
  document.addEventListener('pointerdown', e => {   // ‹ › at an end: a tap shakes the arrow — that's the end (user: "11번")
    const a = e.target.closest && e.target.closest('.b-fabside'); if (!a || !a.disabled || RM()) return;
    a.classList.remove('is-nope'); void a.offsetWidth; a.classList.add('is-nope');
  }, true);
  function startLesson() {   // the cover is Lesson 1's title page (user: "그냥 저건 lesson1에 표지 같은거야"): 수업 시작 (and › / Space / PageDown
    // on it) opens the lesson's first class — Alphabet, its first activity (user: "수업버튼 누르면 이제 lesseon1에 Alphabet 첫 수업에 들어가야해")
    if (!coverOn) return;
    const cv = COVERS[FP.lesson().n] || {}, secs = FP.sections(), i = Math.max(0, secs.findIndex(x => x.name === cv.startSec));
    coverOn = false; renderCover();
    if (FP.mode() === 'extra') FP.closeExtra();
    if (FP.state().sec !== i) FP.setSection(i);   // (a nav: the board, the tablets and ‹ › follow)
    const fl = FP.flow(), st = FP.state();
    if (fl.length && (st.act !== fl[0].id || st.step !== 0)) FP.go(fl[0].id, 0);
    else { renderSides(); broadcast(); }
  }
  addEventListener('keydown', e => {   // the cover: → / Space / PageDown (clickers) start the lesson at its first step — no step skipped; ← / PageUp wait (Enter / Space on a focused button press it)
    if (!coverOn || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && tag !== 'button' && tag !== 'a')) { e.preventDefault(); e.stopPropagation(); startLesson(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); e.stopPropagation(); }
  }, true);
  // the layer's rows (Activity, Meaning First) slide — no scrollbar (user: "activity와 그 밑에 mening first 리스트 갯수 많으면 스크롤 보이지
  // 않고 슬라이드로 뒤에껏도 확인할수 있게"): a finger swipes them natively, a mouse / pen drags (a flick glides on), a wheel turns sideways;
  // a soft edge shows there is more that way. A drag is never a tap on a card
  function rowEdges(box) { const m = box.scrollWidth - box.clientWidth; box.classList.toggle('is-more-l', m > 1 && box.scrollLeft > 2); box.classList.toggle('is-more-r', m > 1 && box.scrollLeft < m - 2); }
  function rowsEdges() { document.querySelectorAll('.b-lycards').forEach(rowEdges); }
  document.addEventListener('scroll', e => { if (e.target.classList && e.target.classList.contains('b-lycards')) rowEdges(e.target); }, true);
  addEventListener('resize', rowsEdges);
  let rowDrag = null;
  document.addEventListener('pointerdown', e => {
    const box = e.target.closest && e.target.closest('.b-lycards');
    if (!box || e.pointerType === 'touch' || e.button !== 0 || box.scrollWidth <= box.clientWidth + 1) return;
    rowDrag = { box, id: e.pointerId, x: e.clientX, left: box.scrollLeft, moved: false, lx: e.clientX, t: performance.now(), v: 0 };
  });
  document.addEventListener('pointermove', e => {
    const d = rowDrag; if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!d.moved) { if (Math.abs(dx) < 6) return; d.moved = true; d.box.classList.add('is-drag'); try { d.box.setPointerCapture(e.pointerId); } catch (err) { /* gone */ } }
    const now = performance.now(); d.v = (e.clientX - d.lx) / Math.max(1, now - d.t); d.lx = e.clientX; d.t = now;
    d.box.scrollLeft = d.left - dx;
  });
  const rowDrop = e => {
    const d = rowDrag; if (!d || e.pointerId !== d.id) return; rowDrag = null;
    if (!d.moved) return;
    d.box.classList.remove('is-drag');
    if (Math.abs(d.v) > 0.35 && !RM()) d.box.scrollBy({ left: -d.v * 240, behavior: 'smooth' });   // a flick glides on
    const eat = ev => { ev.stopPropagation(); ev.preventDefault(); };
    addEventListener('click', eat, true); setTimeout(() => removeEventListener('click', eat, true), 80);   // the drag's own click
  };
  document.addEventListener('pointerup', rowDrop); document.addEventListener('pointercancel', rowDrop);
  document.addEventListener('wheel', e => {   // a mouse wheel over a row slides it sideways
    const box = e.target.closest && e.target.closest('.b-lycards');
    if (!box || box.scrollWidth <= box.clientWidth + 1 || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    e.preventDefault(); box.scrollLeft += e.deltaY;
  }, { passive: false });
  $('#gdim').addEventListener('click', () => { if (notesOpen || flowOpen) { notesOpen = flowOpen = false; renderFlow(); renderNotes(); renderDock(); } setGuide(false); });   // the guide's sheets go with it
  $('#fabBtn').addEventListener('click', () => {   // classroom: the one button opens Menu · Guide · Pen, or closes what is open
    if (!CLASSROOM()) { setPal(!palOpen); return; }
    if (palOpen) setPal(false); else if (menuOpen) setMenu(false); else setDial(!dialOpen);
  });
  $('#lessonBtn').addEventListener('click', () => openMap(true));
  $('#map').addEventListener('click', e => { if (e.target === e.currentTarget && CLASSROOM()) openMap(false); });   // classroom: a tap on the dimmed board above the sheet closes it
  $('#fsBtn').addEventListener('click', () => { if (root.dataset.screen === 'desk') setLayout('screen', 'full'); else FP.fullscreen(); });   // With controls: Full screen = the full-screen version straight away (user: "with controls 모드에서 전체보기 누르면 full screen 버전으로 바로 전환")
  document.addEventListener('fullscreenchange', () => { $('#fsBtn').innerHTML = ic(document.fullscreenElement ? 'minimize' : 'maximize'); });
  const POPS = { extrasPop: ['extrasBtn', renderExtras], helpPop: ['helpBtn', null], sharePop: ['shareBtn', renderShare], displayPop: ['displayBtn', renderDisplay] };
  Object.entries(POPS).forEach(([p, [b, fill]]) => {
    $('#' + p).addEventListener('beforetoggle', e => {
      if (e.newState !== 'open') return; if (fill) fill();
      const r = $('#' + b).getBoundingClientRect(), pop = $('#' + p);
      if (placePop(pop, $('#' + b))) return;
      pop.style.top = (r.bottom + 10) + 'px';
      if (p === 'extrasPop') { pop.style.left = r.left + 'px'; pop.style.right = 'auto'; }
      else { pop.style.right = Math.max(10, innerWidth - r.right) + 'px'; pop.style.left = 'auto'; }
    });
  });
  Object.keys(POPS).forEach(p => $('#' + p).addEventListener('toggle', e => { if (e.newState === 'open') clampPop($('#' + p)); }));
  MENU_POPS.forEach(id => { const p = document.getElementById(id); if (p) p.addEventListener('toggle', e => { if (e.newState === 'closed') requestAnimationFrame(() => { if (CLASSROOM() && !document.querySelector(MENU_POPS.map(x => '#' + x + ':popover-open').join(','))) placeFab(); }); }); });   // a menu slid aside for a popover comes back
  $('#extrasPop').addEventListener('toggle', e => {
    if (e.newState !== 'open' || CLASSROOM()) return; const pop = $('#extrasPop');
    pop.style.left = Math.max(10, Math.min(parseFloat(pop.style.left) || 10, innerWidth - pop.offsetWidth - 10)) + 'px';
  });
  $('#rosterPop').addEventListener('beforetoggle', e => { if (e.newState === 'open') renderRoster(); });
  $('#rosterPop').addEventListener('toggle', e => { if (e.newState === 'open') { const tx = $('#rosterTx'); if (tx) tx.focus(); } });

  FP.on(e => {
    if (e.type === 'lesson') { coverOn = !!COVERS[FP.lesson().n] && atLessonStart(); renderCover(); renderSides(); }   // opening a lesson = its title picture
    if (e.type === 'nav' && coverOn && !atLessonStart()) { coverOn = false; renderCover(); }   // moved on (lesson map, a step chip …) = started (renderSides follows below)
    if ((e.type === 'lesson' || e.type === 'nav') && addGamesStep()) { FP.render(); renderDock(); }
    if (e.type === 'lesson') { refreshGames(); renderTop(); }
    if (e.type === 'nav') { renderCrumb(); renderActs(); renderMedia(); renderDock(); renderFlow(); renderNotes(); renderGame(); broadcast(); renderSides(); if (dialOpen) { renderLayer(); requestAnimationFrame(placeFab); } }
    if (e.type === 'ink') { renderFab(); broadcast(); }
    if (e.type === 'inkmove') broadcastInk();
    if (e.type === 'key') {
      const k = e.key.toLowerCase();
      if (!$('#map').hidden) { if (k === 'escape' || k === 'm') openMap(false); return; }
      if (k === 'escape') {
        if (palOpen) setPal(false);
        else if (dialOpen) setDial(false);
        else if (notesOpen || flowOpen) { notesOpen = flowOpen = false; renderFlow(); renderNotes(); renderDock(); }
        else if (menuOpen) { if (!document.querySelector(MENU_POPS.map(id => '#' + id + ':popover-open').join(','))) setMenu(false); }
        else if (guideOpen) setGuide(false);
        else if (scene !== 'lesson') setScene(scene === 'pause' ? 'pause' : 'lesson');
        return;
      }
      if (k === 'n') toggleSheet('notes');
      if (k === 'l') toggleSheet('flow');
      if (k === 'm') openMap(true);
      if (k === 'b' || k === '.') setScene('pause');
      if (k === 't') setScene(scene === 'timer' ? 'lesson' : 'timer');
      if (k === 'p') setScene(scene === 'pick' ? 'lesson' : 'pick');
      if (k === 'a') $('#extrasPop').togglePopover();   // classroom: straight from the bottom (no menu bar)
      if (k === 's') $('#sharePop').togglePopover();
      if (k === 'g' && CLASSROOM()) setGuide(!guideOpen);
      if (k === 'c') cycleTheme();
      if (k === 'k' && curMedia()) mediaCmd('mtoggle');
    }
  });
  setInterval(tickRing, 1000);
  setInterval(tick, 250);

  FP.mount($('#stage'), { storageKey: 'fprk-bc', keepAwake: true, fresh: qs.has('fresh'), lesson: +qs.get('lesson') || 1, act: qs.get('act') || 'ls1', design: DESIGN });
  addLayers(); coverOn = !!COVERS[FP.lesson().n]; renderCover(); refreshGames(); if (addGamesStep()) FP.render();   // opening the page = the title picture first, wherever the board was left (user: "첫화면 안바뀌었어?")
  renderScenes(); renderActs(); renderFab(); renderShareBtn(); renderMedia(); renderDock(); renderGame(); renderSides();
  new ResizeObserver(() => { root.style.setProperty('--guide-h', ($('#dock').offsetHeight || 0) + 'px'); placeFab(); }).observe($('#dock'));
  $('#stagewrap').addEventListener('click', e => { if ((menuOpen || dialOpen) && !e.target.closest('.b-fab, .b-layer')) { setMenu(false); setDial(false); e.stopPropagation(); e.preventDefault(); } }, true);   // a tap on the board closes the menu / Menu · Guide · Pen first
  $('#stagewrap').addEventListener('click', e => {   // classroom: tap the video = play / pause (no player bar)
    if (!CLASSROOM() || FP.ink.state().on || scene !== 'lesson' || !curMedia()) return;
    const path = e.composedPath().filter(n => n.nodeType === 1);   // the path at the tap: a button may have re-rendered (detached) its insides by now
    if (path.some(n => n.matches('button, a, input, select, textarea, label, iframe, [data-b], .b-fab, .b-sheet, .b-pop'))) return;
    if (path.some(n => n.id === 'media')) mediaCmd('mtoggle');
  });
  $('#stage').addEventListener('pointermove', mediaIdle);
  new ResizeObserver(() => placeFab()).observe($('#stagewrap'));
  initMove();
  new ResizeObserver(() => { clearTimeout(fitT); fitT = setTimeout(fitTop, 60); }).observe($('.b-top'));
  if (document.fonts) document.fonts.ready.then(() => fitTop(true));
  placeFab();
  if (qs.get('scene')) setScene(qs.get('scene'));   // QA / deep link: ?scene=timer|pick|pause
})();
