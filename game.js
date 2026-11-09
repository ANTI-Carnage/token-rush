/* Token Rush - an original browser game. All art drawn in code, all sound made with WebAudio. */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const cvs = $('game');
const ctx = cvs.getContext('2d');
const TAU = Math.PI * 2;
const FONT = '"Arial Black","Segoe UI",system-ui,-apple-system,Roboto,sans-serif';
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function pickW(items) {
  let s = 0; for (const it of items) s += it.w;
  let r = Math.random() * s;
  for (const it of items) { r -= it.w; if (r <= 0) return it; }
  return items[items.length - 1];
}

let W = 0, H = 0, DPR = 1, zoom = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  zoom = clamp(Math.min(W, H) / 610, 0.62, 1.25);
}

/* ---------------- sound ---------------- */
let ac = null, master = null, muted = false, noiseBuf = null;
try { muted = localStorage.getItem('tokenRush.muted') === '1'; } catch (e) {}
function initAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination); }
    catch (e) { ac = null; return; }
  }
  if (ac.state === 'suspended') ac.resume();
}
function tone(f, dur, type, vol, f2, delay) {
  if (!ac || muted) return;
  const t = ac.currentTime + (delay || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, freq, delay) {
  if (!ac || muted) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + (delay || 0);
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = freq || 1000;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.05);
}
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
const sfx = {
  click() { tone(660, 0.06, 'square', 0.06); },
  open() { noise(0.18, 0.18, 900); tone(180, 0.18, 'triangle', 0.12, 420); },
  good(ri) { for (let i = 0; i < 2 + ri; i++) tone(NOTES[Math.min(7, i + ri)], 0.16, 'triangle', 0.12, null, i * 0.07); },
  bad() { tone(320, 0.35, 'sawtooth', 0.1, 90); tone(250, 0.35, 'square', 0.05, 70, 0.05); },
  fuse() { tone(900, 0.04, 'square', 0.04); },
  boom() { noise(0.7, 0.55, 500); tone(120, 0.5, 'sine', 0.25, 35); },
  hit() { tone(200, 0.25, 'square', 0.14, 60); noise(0.15, 0.15, 2000); },
  shield() { tone(1200, 0.2, 'sine', 0.12, 400); },
  storm() { tone(110, 1.0, 'sawtooth', 0.07, 70); noise(0.9, 0.12, 300); },
  token() {
    [0, 2, 4, 5, 7].forEach((n, i) => tone(NOTES[n], 0.22, 'square', 0.09, null, i * 0.1));
    tone(NOTES[7], 0.7, 'triangle', 0.14, null, 0.5); tone(NOTES[4], 0.7, 'triangle', 0.1, null, 0.5);
  },
  over() { [4, 3, 1, 0].forEach((n, i) => tone(NOTES[n] / 2, 0.3, 'triangle', 0.12, null, i * 0.18)); },
  freeze() { for (let i = 0; i < 5; i++) tone(1500 + i * 200, 0.12, 'sine', 0.06, null, i * 0.04); },
  life() { [0, 4, 7].forEach((n, i) => tone(NOTES[n], 0.18, 'square', 0.08, null, i * 0.08)); },
};

/* ---------------- data ---------------- */
const RARITY = [
  { name: 'Common', col: '#c4cbd3', glow: '205,210,220' },
  { name: 'Uncommon', col: '#4ee04a', glow: '80,230,90' },
  { name: 'Rare', col: '#3fa9ff', glow: '60,160,255' },
  { name: 'Epic', col: '#c35cff', glow: '190,90,255' },
  { name: 'Legendary', col: '#ffb52e', glow: '255,190,60' },
];
const RARITY_W = [34, 28, 20, 12, 6];
const FINAL_LEVEL = 10;
const BEST_KEY = 'tokenRush.best';
let best = 0;
try { best = +localStorage.getItem(BEST_KEY) || 0; } catch (e) {}

/* ---------------- world ---------------- */
const CX = 1000, CY = 1000;
const islandR = new Float32Array(360);
let islandPaths = null;
function genIsland() {
  const a = rand(0, TAU), b = rand(0, TAU), c = rand(0, TAU);
  for (let i = 0; i < 360; i++) {
    const t = i / 360 * TAU;
    islandR[i] = 850 + 50 * Math.sin(3 * t + a) + 32 * Math.sin(5 * t + b) + 16 * Math.sin(9 * t + c);
  }
  const mk = (off) => {
    const p = new Path2D();
    for (let i = 0; i < 360; i += 2) {
      const t = i / 360 * TAU, r = islandR[i] - off;
      const x = CX + Math.cos(t) * r, y = CY + Math.sin(t) * r;
      if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
    }
    p.closePath(); return p;
  };
  islandPaths = { shallow: mk(-55), sand: mk(0), grass: mk(48) };
}
function radAt(th) {
  let f = (th / TAU) * 360; f = ((f % 360) + 360) % 360;
  const i = Math.floor(f) % 360, j = (i + 1) % 360, k = f - Math.floor(f);
  return islandR[i] * (1 - k) + islandR[j] * k;
}
function landLimit(x, y, m) { return radAt(Math.atan2(y - CY, x - CX)) - m; }
function onLand(x, y, m) { return Math.hypot(x - CX, y - CY) < landLimit(x, y, m); }
function keepOnLand(e, m) {
  const dx = e.x - CX, dy = e.y - CY, d = Math.hypot(dx, dy), L = landLimit(e.x, e.y, m);
  if (d > L && d > 0) { e.x = CX + dx / d * L; e.y = CY + dy / d * L; return true; }
  return false;
}
function randLand(m) {
  for (let k = 0; k < 300; k++) {
    const t = rand(0, TAU), r = Math.sqrt(Math.random()) * 920;
    const x = CX + Math.cos(t) * r, y = CY + Math.sin(t) * r;
    if (onLand(x, y, m)) return { x, y };
  }
  return { x: CX, y: CY };
}

/* ---------------- state ---------------- */
let state = 'title';
let level = 1, score = 0, lives = 3, shield = 0, wonShown = false;
const P = { x: CX, y: CY, r: 15, face: 0, inv: 0, speedT: 0, slowT: 0, radarT: 0, walk: 0, moving: false };
let chests = [], enemies = [], bombs = [], parts = [], texts = [], obst = [], decor = [], flowers = [];
let storm = null, freezeT = 0, shake = 0, levelTime = 0, tokenAnim = null, banner = null, tokenChest = null;
let camX = CX, camY = CY, openProg = 0, openTarget = null, nearChest = null, openBtnHeld = false, clock = 0;
let touchMode = false;

function buildLevel(n) {
  level = n;
  genIsland();
  obst = []; decor = []; flowers = []; chests = []; enemies = []; bombs = []; parts = []; texts = [];
  for (let i = 0; i < 170; i++) {
    const p = randLand(60);
    decor.push({ x: p.x, y: p.y, rx: rand(24, 75), ry: rand(14, 40), rot: rand(0, TAU), c: Math.random() < 0.5 ? '#5aa83e' : '#76c24f' });
  }
  for (let i = 0; i < 130; i++) {
    const p = randLand(60);
    flowers.push({ x: p.x, y: p.y, c: ['#ffe14d', '#ff7ab8', '#ffffff', '#9fd8ff'][randi(0, 3)] });
  }
  const want = 40 + randi(0, 8);
  for (let k = 0; k < 2000 && obst.length < want; k++) {
    const p = randLand(80);
    if (dist(p.x, p.y, CX, CY) < 170) continue;
    const tree = obst.length < want - 14;
    const r = tree ? rand(18, 26) : rand(15, 25);
    if (obst.some((o) => dist(o.x, o.y, p.x, p.y) < o.r + r + 46)) continue;
    obst.push({ x: p.x, y: p.y, r, tree, s: rand(0, TAU), shade: rand(0, 1) });
  }
  const nC = Math.min(6 + 2 * n, 22);
  for (let k = 0; k < 4000 && chests.length < nC; k++) {
    const p = randLand(75);
    if (dist(p.x, p.y, CX, CY) < 190) continue;
    if (obst.some((o) => dist(o.x, o.y, p.x, p.y) < o.r + 40)) continue;
    if (chests.some((c) => dist(c.x, c.y, p.x, p.y) < 150)) continue;
    chests.push({ x: p.x, y: p.y, ri: pickW(RARITY_W.map((w, i) => ({ w, i }))).i, state: 'closed', open: 0, token: false, ph: rand(0, TAU), label: '' });
  }
  tokenChest = chests[randi(0, chests.length - 1)];
  tokenChest.token = true;
  const nE = Math.min(2 + n, 16);
  const nD = n >= 2 ? Math.min(Math.floor(n / 2) + (n >= 5 ? 1 : 0), Math.floor(nE / 2)) : 0;
  for (let i = 0; i < nE; i++) spawnEnemy(i < nD ? 'dasher' : 'blob');
  // storm closes toward the token (final circle is a hint)
  let fx = tokenChest.x, fy = tokenChest.y;
  for (let k = 0; k < 50; k++) {
    const a = rand(0, TAU), r = rand(0, 85);
    const x = tokenChest.x + Math.cos(a) * r, y = tokenChest.y + Math.sin(a) * r;
    if (onLand(x, y, 40)) { fx = x; fy = y; break; }
  }
  const f = Math.max(0.55, 1 - 0.05 * (n - 1));
  storm = {
    x: fx, y: fy, r: 2000, from: 2000, phase: 0, t: 0, shrinking: false, fast: false, outT: 0,
    phases: [
      { wait: 24 * f, shrink: 26 * f, to: 680 },
      { wait: 14 * f, shrink: 18 * f, to: 400 },
      { wait: 10 * f, shrink: 14 * f, to: 220 },
      { wait: 8 * f, shrink: 12 * f, to: 115 },
    ],
  };
  P.x = CX; P.y = CY; P.inv = 1.5; P.speedT = P.slowT = P.radarT = 0; P.face = -Math.PI / 2;
  freezeT = 0; tokenAnim = null; openProg = 0; openTarget = null; levelTime = 0;
  camX = P.x; camY = P.y;
}

function spawnEnemy(type, x, y, opts) {
  let p;
  if (x === undefined) {
    p = randLand(60);
    for (let k = 0; k < 60 && dist(p.x, p.y, P.x, P.y) < 460; k++) p = randLand(60);
  } else p = { x, y };
  const e = {
    type, x: p.x, y: p.y, r: type === 'dasher' ? 15 : 17, dir: rand(0, TAU), wt: 0, st: 'roam', t: 0,
    cd: rand(0.5, 2), anim: rand(0, TAU), spawnT: 0, mimic: false,
    sp: type === 'dasher' ? Math.min(150, 80 + 5 * level) : Math.min(150, 64 + 7 * level),
    dashSp: Math.min(540, 380 + 14 * level),
  };
  if (opts) Object.assign(e, opts);
  keepOnLand(e, 20);
  enemies.push(e);
  return e;
}

/* ---------------- flow ---------------- */
function showOverlay(id) {
  for (const o of document.querySelectorAll('.overlay')) o.classList.toggle('show', o.id === id);
  document.body.classList.toggle('playing', state === 'play');
  updateOpenBtn();
}
function startGame() {
  score = 0; lives = 3; shield = 0; wonShown = false;
  startLevel(1);
}
function startLevel(n) {
  buildLevel(n);
  state = 'play';
  const sub = n === 1
    ? (touchMode ? 'Drag to move, hold OPEN at a chest' : 'Walk to a chest, hold SPACE to open')
    : n === 2 ? 'Watch out: dashers charge at you!'
    : `${chests.length} chests, ${enemies.length} enemies`;
  banner = { txt: 'LEVEL ' + n, sub, t: 0 };
  showOverlay(null);
}
function setPaused(p) {
  if (p && state === 'play') { state = 'paused'; showOverlay('pause'); }
  else if (!p && state === 'paused') { state = 'play'; showOverlay(null); }
}
function levelClear() {
  state = 'clear';
  saveBest();
  if (level >= FINAL_LEVEL && !wonShown) {
    wonShown = true;
    $('winStats').innerHTML = `You found all ${FINAL_LEVEL} golden tokens!<br>Score: ${score.toLocaleString()} &middot; Best: ${best.toLocaleString()}<br>Keep going for endless levels.`;
    state = 'win'; showOverlay('win');
    return;
  }
  $('clearTitle').textContent = `LEVEL ${level} CLEARED`;
  $('clearStats').innerHTML = `Token found in ${Math.round(levelTime)}s<br>Score: ${score.toLocaleString()}<br>Next: more chests, more enemies, faster storm.`;
  showOverlay('clear');
}
function gameOver() {
  state = 'over';
  sfx.over();
  const nb = saveBest();
  $('overStats').innerHTML = `Reached level ${level}<br>Score: ${score.toLocaleString()}<br>Best: ${best.toLocaleString()}`;
  $('newBest').classList.toggle('hidden', !nb);
  showOverlay('over');
}
function saveBest() {
  if (score > best) {
    best = score;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    $('bestTitle').textContent = best.toLocaleString();
    return true;
  }
  return false;
}
function toTitle() {
  state = 'title';
  buildLevel(1);
  $('bestTitle').textContent = best.toLocaleString();
  showOverlay('title');
}

/* ---------------- gameplay ---------------- */
function addText(x, y, txt, col, big) { texts.push({ x, y, txt, col, big: !!big, t: 0, life: big ? 2.2 : 1.6 }); }
function burst(x, y, col, n, spd, size) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(0.3, 1) * (spd || 220);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.4, 0.9), col, size: rand(2, size || 5) });
  }
}
function hurt(src, bypass, why) {
  if (P.inv > 0 || state !== 'play' || tokenAnim) return;
  if (!bypass && shield > 0) {
    shield--; addText(P.x, P.y - 30, 'SHIELD BROKE', '#7fd4ff'); sfx.shield(); burst(P.x, P.y, '#7fd4ff', 16);
  } else {
    lives--; addText(P.x, P.y - 30, why === 'storm' ? 'STORM -1 LIFE' : '-1 LIFE', '#ff5a5a', true); sfx.hit(); burst(P.x, P.y, '#ff5a5a', 20);
  }
  P.inv = 1.6; shake = 10;
  try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) {}
  if (src) {
    const a = Math.atan2(P.y - src.y, P.x - src.x);
    P.x += Math.cos(a) * 46; P.y += Math.sin(a) * 46; keepOnLand(P, 12);
  }
  if (lives <= 0) gameOver();
}
function openChest(c) {
  c.state = 'opening'; c.open = 0;
  sfx.open(); score += 10;
  burst(c.x, c.y - 10, RARITY[c.ri].col, 22, 240);
  if (c.token) {
    const bonus = 500 + 150 * level + Math.max(0, 180 - Math.floor(levelTime)) * 3;
    score += bonus;
    tokenAnim = { x: c.x, y: c.y, t: 0 };
    sfx.token();
    addText(c.x, c.y - 70, 'GOLDEN TOKEN! +' + bonus, '#ffd34d', true);
    burst(c.x, c.y, '#ffd34d', 60, 340, 6);
    c.label = 'TOKEN';
    return;
  }
  const badBase = Math.min(0.55, 0.2 + 0.035 * level);
  const badP = clamp(badBase + [0.12, 0.06, 0, -0.08, -0.15][c.ri], 0.05, 0.7);
  if (Math.random() < badP) badLoot(c); else goodLoot(c);
}
function goodLoot(c) {
  const ri = c.ri;
  const k = pickW([
    { k: 'gold', w: 30 }, { k: 'shield', w: 18 + ri * 3 }, { k: 'speed', w: 16 },
    { k: 'radar', w: 7 + ri * 4 }, { k: 'freeze', w: 8 + ri * 2 }, { k: 'life', w: lives < 5 ? 3 + ri * 3 : 0 },
  ]).k;
  const y = c.y - 46;
  if (k === 'gold') { const pts = [25, 50, 100, 175, 300][ri]; score += pts; addText(c.x, y, `+${pts} GOLD`, '#ffd34d'); }
  else if (k === 'shield') {
    if (shield < 2) { shield++; addText(c.x, y, 'SHIELD +1', '#7fd4ff'); } else { score += 100; addText(c.x, y, 'MAX SHIELD +100', '#7fd4ff'); }
  }
  else if (k === 'speed') { P.speedT = 7; P.slowT = 0; addText(c.x, y, 'SPEED BOOST', '#5cff8a'); }
  else if (k === 'radar') { P.radarT = 9; addText(c.x, y, 'TOKEN RADAR', '#ffd34d'); }
  else if (k === 'freeze') { freezeT = 4.5; addText(c.x, y, 'FREEZE BLAST', '#bff1ff'); burst(c.x, c.y, '#bff1ff', 40, 400); sfx.freeze(); }
  else if (k === 'life') { lives++; addText(c.x, y, 'EXTRA LIFE', '#ff7ab8'); sfx.life(); }
  c.label = k;
  sfx.good(ri);
}
function badLoot(c) {
  const k = pickW([
    { k: 'trap', w: 30 }, { k: 'slime', w: 22 }, { k: 'surge', w: storm.phase < storm.phases.length ? 14 : 0 },
    { k: 'mimic', w: 16 }, { k: 'ambush', w: level >= 2 ? 16 : 6 },
  ]).k;
  const y = c.y - 46;
  sfx.bad();
  if (k === 'trap') { bombs.push({ x: c.x, y: c.y, t: 1.4, max: 1.4, tick: 0 }); addText(c.x, y, 'TRAP! RUN!', '#ff5a5a', true); }
  else if (k === 'slime') { P.slowT = 5; P.speedT = 0; addText(c.x, y, 'SLIMED! SLOWED', '#b6ff3b'); burst(P.x, P.y, '#9be22c', 24); }
  else if (k === 'surge') { stormSurge(); addText(c.x, y, 'STORM SURGE!', '#d48bff', true); }
  else if (k === 'mimic') {
    addText(c.x, y, 'FAKE TOKEN! MIMIC!', '#ff5a5a', true);
    const a = Math.atan2(c.y - P.y, c.x - P.x);
    spawnEnemy('blob', c.x + Math.cos(a) * 40, c.y + Math.sin(a) * 40, { mimic: true, spawnT: 0.8, sp: Math.min(170, 95 + 7 * level) });
  }
  else if (k === 'ambush') {
    addText(c.x, y, 'AMBUSH!', '#ff5a5a', true);
    for (let i = 0; i < 2; i++) {
      const a = rand(0, TAU);
      spawnEnemy(i === 0 || level < 3 ? 'blob' : 'dasher', c.x + Math.cos(a) * 170, c.y + Math.sin(a) * 170, { spawnT: 0.9 });
    }
  }
  c.label = k;
}
function stormSurge() {
  const s = storm;
  if (s.phase >= s.phases.length) return;
  s.fast = true; s.shrinking = true; s.t = 0; s.from = s.r; shake = 6; sfx.storm();
}
function explode(b) {
  sfx.boom(); shake = 14;
  burst(b.x, b.y, '#ffb347', 50, 380, 7); burst(b.x, b.y, '#ff5a2a', 30, 260, 6); burst(b.x, b.y, '#555', 20, 160, 8);
  if (dist(P.x, P.y, b.x, b.y) < 100) hurt(b, false);
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (dist(e.x, e.y, b.x, b.y) < 110) { enemies.splice(i, 1); score += 100; addText(e.x, e.y - 20, '+100', '#ffd34d'); burst(e.x, e.y, '#a050ff', 20); }
  }
}
function pushOut(e) {
  for (const o of obst) {
    const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), m = o.r + e.r;
    if (d < m && d > 0.001) { e.x = o.x + dx / d * m; e.y = o.y + dy / d * m; }
  }
}
function wander(e, dt, f) {
  e.wt -= dt;
  if (e.wt <= 0) { e.wt = rand(1, 3); e.dir = rand(0, TAU); }
  e.x += Math.cos(e.dir) * e.sp * f * dt; e.y += Math.sin(e.dir) * e.sp * f * dt;
}

const keys = { up: 0, down: 0, left: 0, right: 0, open: 0 };
const joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0, kx: 0, ky: 0 };

function update(dt) {
  levelTime += dt;
  if (banner) { banner.t += dt; if (banner.t > 2.6) banner = null; }
  // movement
  let ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (joy.active) { ix += joy.dx; iy += joy.dy; }
  let m = Math.hypot(ix, iy);
  if (m > 1) { ix /= m; iy /= m; m = 1; }
  if (m < 0.12 || tokenAnim) { ix = iy = 0; m = 0; }
  const sp = 215 * (P.speedT > 0 ? 1.55 : 1) * (P.slowT > 0 ? 0.5 : 1);
  P.x += ix * sp * dt; P.y += iy * sp * dt;
  P.moving = m > 0;
  if (P.moving) { P.face = Math.atan2(iy, ix); P.walk += dt * sp * 0.06; }
  pushOut(P); keepOnLand(P, 14);
  P.inv = Math.max(0, P.inv - dt);
  P.speedT = Math.max(0, P.speedT - dt); P.slowT = Math.max(0, P.slowT - dt); P.radarT = Math.max(0, P.radarT - dt);
  freezeT = Math.max(0, freezeT - dt);
  if (P.speedT > 0 && P.moving && Math.random() < 0.6) parts.push({ x: P.x - ix * 14, y: P.y - iy * 14, vx: 0, vy: 0, t: 0, life: 0.35, col: '#5cff8a', size: 4 });
  if (P.slowT > 0 && Math.random() < 0.3) parts.push({ x: P.x + rand(-10, 10), y: P.y + 10, vx: 0, vy: 20, t: 0, life: 0.5, col: '#9be22c', size: 3 });

  // chests
  nearChest = null; let nd = 54;
  for (const c of chests) {
    if (c.state === 'opening') { c.open += dt; if (c.open > 0.6) c.state = 'open'; continue; }
    if (c.state !== 'closed') continue;
    const d = dist(P.x, P.y, c.x, c.y);
    if (d < nd) { nd = d; nearChest = c; }
  }
  const holding = keys.open || openBtnHeld;
  if (nearChest !== openTarget) { openTarget = nearChest; openProg = 0; }
  if (nearChest && holding && !tokenAnim) {
    openProg += dt / (0.42 + nearChest.ri * 0.07);
    if (openProg >= 1) { openChest(nearChest); openProg = 0; openTarget = null; nearChest = null; }
  } else openProg = Math.max(0, openProg - dt * 3);
  updateOpenBtn();

  // bombs
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i]; b.t -= dt; b.tick -= dt;
    if (b.tick <= 0) { sfx.fuse(); b.tick = Math.max(0.08, b.t / 5); }
    if (b.t <= 0) { bombs.splice(i, 1); explode(b); }
  }

  // enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.anim += dt;
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }
    if (freezeT > 0) continue;
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy);
    const canChase = !tokenAnim;
    let wandering = false;
    if (e.type === 'dasher') {
      e.cd -= dt;
      if (e.st === 'roam') {
        wander(e, dt, 0.8); wandering = true;
        if (d < 340 && e.cd <= 0 && canChase) { e.st = 'wind'; e.t = 0.6; e.dir = Math.atan2(dy, dx); }
      } else if (e.st === 'wind') {
        e.t -= dt; if (e.t <= 0) { e.st = 'dash'; e.t = 0.5; }
      } else if (e.st === 'dash') {
        e.x += Math.cos(e.dir) * e.dashSp * dt; e.y += Math.sin(e.dir) * e.dashSp * dt;
        e.t -= dt; if (Math.random() < 0.7) parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.3, col: '#ff6a4a', size: 5 });
        if (e.t <= 0) { e.st = 'rest'; e.t = 0.8; }
      } else { e.t -= dt; if (e.t <= 0) { e.st = 'roam'; e.cd = rand(1, 2.2); } }
    } else {
      const range = e.mimic ? 650 : 260 + level * 10;
      if (d < range && canChase) {
        e.dir = Math.atan2(dy, dx);
        e.x += Math.cos(e.dir) * e.sp * dt; e.y += Math.sin(e.dir) * e.sp * dt;
      } else { wander(e, dt, 0.55); wandering = true; }
    }
    pushOut(e);
    if (keepOnLand(e, 18) && wandering) e.dir += Math.PI * 0.8;
    if (canChase && d < e.r + P.r - 3) hurt(e, false);
  }
  // keep enemies apart
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), mm = a.r + b.r;
    if (d < mm && d > 0.01) { const p = (mm - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
  }

  // storm
  const s = storm;
  if (s.phase < s.phases.length) {
    const ph = s.phases[s.phase];
    s.t += dt;
    if (!s.shrinking) {
      if (s.t >= ph.wait) { s.shrinking = true; s.t = 0; s.from = s.r; sfx.storm(); addText(P.x, P.y - 60, 'THE STORM IS CLOSING', '#d48bff', true); }
    } else {
      const dur = s.fast ? Math.min(3.5, ph.shrink) : ph.shrink;
      const k = Math.min(1, s.t / dur);
      s.r = s.from + (ph.to - s.from) * k;
      if (k >= 1) { s.phase++; s.t = 0; s.shrinking = false; s.fast = false; }
    }
  }
  const outside = dist(P.x, P.y, s.x, s.y) > s.r;
  if (outside && !tokenAnim) {
    s.outT += dt;
    if (Math.random() < 0.4) parts.push({ x: P.x + rand(-14, 14), y: P.y + rand(-14, 14), vx: 0, vy: -30, t: 0, life: 0.5, col: '#c070ff', size: 3 });
    if (s.outT >= 2.2) { s.outT = 0; hurt(null, true, 'storm'); }
  } else s.outT = Math.max(0, s.outT - dt * 2);

  // particles and floating text
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
    if (p.t > p.life) parts.splice(i, 1);
  }
  for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.t += dt; t.y -= 26 * dt; if (t.t > t.life) texts.splice(i, 1); }

  if (tokenAnim) { tokenAnim.t += dt; if (tokenAnim.t > 2.3 && state === 'play') levelClear(); }
  camX += (P.x - camX) * Math.min(1, dt * 7); camY += (P.y - camY) * Math.min(1, dt * 7);
}

/* ---------------- drawing ---------------- */
function heart(x, y, s, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.65, x, y + s * 0.85, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.85, x + s * 0.5, y + s * 0.65, x + s * 0.5, y + s * 0.35);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35);
  ctx.fillStyle = fill; ctx.fill();
}
function drawToken(x, y, r, sx) {
  ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.08, Math.abs(sx)), 1);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#fff7c2'); g.addColorStop(0.45, '#ffcc33'); g.addColorStop(1, '#c07800');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = r * 0.14; ctx.strokeStyle = '#8a5200'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.lineWidth = r * 0.06; ctx.strokeStyle = 'rgba(138,82,0,.6)'; ctx.stroke();
  ctx.lineCap = 'round'; ctx.lineWidth = r * 0.2; ctx.strokeStyle = '#8a5200';
  ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.35); ctx.lineTo(r * 0.35, r * 0.35); ctx.moveTo(r * 0.35, -r * 0.35); ctx.lineTo(-r * 0.35, r * 0.35); ctx.stroke();
  ctx.restore();
}
function drawChest(c, now) {
  const R = RARITY[c.ri], x = c.x, y = c.y;
  if (c.state === 'closed') {
    const pulse = 0.6 + 0.3 * Math.sin(now * 3 + c.ph);
    const g = ctx.createRadialGradient(x, y, 4, x, y, 64);
    g.addColorStop(0, `rgba(${R.glow},${0.6 * pulse})`); g.addColorStop(1, `rgba(${R.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 64, 0, TAU); ctx.fill();
    if (c.ri >= 3) {
      const bg = ctx.createLinearGradient(x, y - 160, x, y);
      bg.addColorStop(0, `rgba(${R.glow},0)`); bg.addColorStop(1, `rgba(${R.glow},${0.35 * pulse})`);
      ctx.fillStyle = bg; ctx.fillRect(x - 14, y - 160, 28, 160);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y + 15, 25, 7, 0, 0, TAU); ctx.fill();
  const open = c.state !== 'closed';
  // body
  ctx.fillStyle = open ? '#6e4520' : '#8a5a2b'; ctx.fillRect(x - 20, y - 8, 40, 22);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - 20, y + 3); ctx.lineTo(x + 20, y + 3); ctx.stroke();
  ctx.strokeStyle = R.col; ctx.lineWidth = 3; ctx.strokeRect(x - 20, y - 8, 40, 22);
  if (!open) {
    ctx.fillStyle = '#a06a34'; ctx.fillRect(x - 21, y - 20, 42, 13);
    ctx.strokeStyle = R.col; ctx.lineWidth = 3; ctx.strokeRect(x - 21, y - 20, 42, 13);
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(x - 4, y - 11, 8, 9);
    ctx.fillStyle = '#7a4a10'; ctx.fillRect(x - 1.2, y - 8, 2.4, 4);
  } else {
    ctx.fillStyle = '#2e1c0b'; ctx.fillRect(x - 17, y - 8, 34, 6);
    ctx.fillStyle = '#7d5026'; ctx.fillRect(x - 21, y - 26, 42, 10);
    ctx.strokeStyle = R.col; ctx.lineWidth = 3; ctx.strokeRect(x - 21, y - 26, 42, 10);
    if (c.state === 'opening') {
      const k = c.open / 0.6;
      ctx.fillStyle = `rgba(${R.glow},${0.7 * (1 - k)})`;
      ctx.beginPath(); ctx.moveTo(x - 17, y - 8); ctx.lineTo(x - 40, y - 80 * (0.5 + k)); ctx.lineTo(x + 40, y - 80 * (0.5 + k)); ctx.lineTo(x + 17, y - 8); ctx.fill();
    }
  }
}
function drawPlayer(now) {
  const flick = P.inv > 0 && !tokenAnim && Math.floor(now * 12) % 2 === 0;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(P.x, P.y + 14, 17, 6, 0, 0, TAU); ctx.fill();
  if (flick) return;
  const r = P.r;
  ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.face);
  const step = P.moving ? Math.sin(P.walk) * 5 : 0;
  ctx.fillStyle = '#1d2b53';
  ctx.beginPath(); ctx.arc(step, -9, 5, 0, TAU); ctx.arc(-step, 9, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8833a'; ctx.strokeStyle = '#7a3d10'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-r - 6, -9, 10, 18, 3) : ctx.rect(-r - 6, -9, 10, 18); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = '#2ec4b6'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#0b4f4a'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(6, 0, 6, 10, 0, 0, TAU); ctx.fillStyle = '#1d2b53'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(7.5, -3.5, 2, 3.5, 0, 0, TAU); ctx.fillStyle = 'rgba(160,230,255,.85)'; ctx.fill();
  ctx.restore();
  if (shield > 0) {
    ctx.beginPath(); ctx.arc(P.x, P.y, r + 8 + Math.sin(now * 5), 0, TAU);
    ctx.fillStyle = 'rgba(90,190,255,.14)'; ctx.fill();
    ctx.lineWidth = shield > 1 ? 4 : 2.5; ctx.strokeStyle = 'rgba(120,210,255,.85)'; ctx.stroke();
  }
}
function drawEnemy(e, now) {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 14, e.r, 5, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.spawnT > 0) { const k = 1 - e.spawnT / 0.9; ctx.scale(Math.max(0.1, k), Math.max(0.1, k)); ctx.globalAlpha = 0.5 + 0.5 * k; }
  const frozen = freezeT > 0;
  if (e.type === 'dasher') {
    let wob = e.st === 'wind' ? rand(-2, 2) : 0;
    ctx.translate(wob, 0); ctx.rotate(e.anim * (e.st === 'dash' ? 14 : 2));
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, rr = i % 2 ? e.r * 0.65 : e.r * 1.15; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    ctx.fillStyle = frozen ? '#a8e6ff' : (e.st === 'wind' && Math.floor(now * 16) % 2 ? '#fff' : '#e8382f'); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#6b0f0a'; ctx.stroke();
    ctx.rotate(-e.anim * (e.st === 'dash' ? 14 : 2));
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fillStyle = '#ffe14d'; ctx.fill();
    ctx.beginPath(); ctx.arc(Math.cos(e.dir) * 2, Math.sin(e.dir) * 2, 2.2, 0, TAU); ctx.fillStyle = '#000'; ctx.fill();
  } else {
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) { const a = i / 14 * TAU, rr = e.r * (1 + 0.1 * Math.sin(e.anim * 5 + i * 1.7)); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    ctx.fillStyle = frozen ? '#a8e6ff' : e.mimic ? '#d9a21c' : '#7b2fbe'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = e.mimic ? '#6b4500' : '#3b1060'; ctx.stroke();
    const ex = Math.cos(e.dir) * 5, ey = Math.sin(e.dir) * 5, px = -Math.sin(e.dir) * 5, py = Math.cos(e.dir) * 5;
    ctx.fillStyle = e.mimic ? '#ff3b3b' : '#9dff57';
    ctx.beginPath(); ctx.arc(ex + px, ey + py, 3.4, 0, TAU); ctx.arc(ex - px, ey - py, 3.4, 0, TAU); ctx.fill();
    if (e.mimic) { ctx.fillStyle = '#fff'; ctx.fillRect(ex * 1.8 - 5, ey * 1.8 - 1, 10, 2); }
  }
  ctx.restore();
}
function drawObstacle(o, canopy) {
  if (!o.tree) {
    if (canopy) return;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(o.x, o.y + o.r * 0.6, o.r * 1.1, o.r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 7; i++) { const a = o.s + i / 7 * TAU, rr = o.r * (0.85 + 0.2 * Math.sin(i * 2.3 + o.s)); i ? ctx.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr) : ctx.moveTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = '#8d96a3'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#5b6370'; ctx.stroke();
    ctx.beginPath(); ctx.arc(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill();
    return;
  }
  if (!canopy) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(o.x + 8, o.y + 10, o.r * 1.5, o.r * 0.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6b4520'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 0.45, 0, TAU); ctx.fill();
    return;
  }
  const under = dist(P.x, P.y, o.x, o.y) < o.r * 1.7;
  ctx.globalAlpha = under ? 0.55 : 1;
  const R = o.r * 1.6;
  ctx.fillStyle = o.shade > 0.5 ? '#2f7d32' : '#3a8f2d';
  ctx.beginPath(); ctx.arc(o.x, o.y - 6, R, 0, TAU); ctx.fill();
  ctx.fillStyle = o.shade > 0.5 ? '#3f9a3e' : '#4caa38';
  ctx.beginPath(); ctx.arc(o.x - R * 0.25, o.y - 6 - R * 0.25, R * 0.6, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.beginPath(); ctx.arc(o.x - R * 0.35, o.y - 6 - R * 0.4, R * 0.25, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}

function draw() {
  const now = clock;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#1769b0'; ctx.fillRect(0, 0, W, H);
  const sx = shake ? rand(-shake, shake) : 0, sy = shake ? rand(-shake, shake) : 0;
  const s = zoom * DPR;
  ctx.setTransform(s, 0, 0, s, (W / 2 + sx - camX * zoom) * DPR, (H / 2 + sy - camY * zoom) * DPR);
  const vw = W / zoom / 2 + 90, vh = H / zoom / 2 + 90;
  const inView = (x, y) => Math.abs(x - camX) < vw && Math.abs(y - camY) < vh;

  // water sparkle
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const gx0 = Math.floor((camX - vw) / 130) * 130, gy0 = Math.floor((camY - vh) / 100) * 100;
  ctx.beginPath();
  for (let gx = gx0; gx < camX + vw; gx += 130) for (let gy = gy0; gy < camY + vh; gy += 100) {
    const ox = ((gy / 100) % 2) * 65 + Math.sin(now * 0.8 + gx * 0.01 + gy) * 10;
    ctx.moveTo(gx + ox - 12, gy); ctx.quadraticCurveTo(gx + ox, gy - 6, gx + ox + 12, gy);
  }
  ctx.stroke();
  // island
  ctx.fillStyle = 'rgba(120,225,255,.35)'; ctx.fill(islandPaths.shallow);
  ctx.fillStyle = '#f0d78c'; ctx.fill(islandPaths.sand);
  ctx.fillStyle = '#67b546'; ctx.fill(islandPaths.grass);
  for (const d of decor) if (inView(d.x, d.y)) { ctx.fillStyle = d.c; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.rx, d.ry, d.rot, 0, TAU); ctx.fill(); }
  for (const f of flowers) if (inView(f.x, f.y)) { ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, 3.2, 0, TAU); ctx.fill(); }
  for (const o of obst) if (inView(o.x, o.y)) drawObstacle(o, false);

  for (const c of chests) if (inView(c.x, c.y)) drawChest(c, now);
  if (nearChest && state === 'play') {
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.arc(nearChest.x, nearChest.y - 3, 34, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(nearChest.x, nearChest.y - 3, 34, -Math.PI / 2, -Math.PI / 2 + TAU * openProg); ctx.stroke();
    if (!touchMode) {
      ctx.font = `900 ${13}px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText('HOLD SPACE / E', nearChest.x + 1, nearChest.y - 44);
      ctx.fillStyle = '#fff'; ctx.fillText('HOLD SPACE / E', nearChest.x, nearChest.y - 45);
    }
  }
  for (const b of bombs) {
    const k = 1 - b.t / b.max;
    ctx.beginPath(); ctx.arc(b.x, b.y, 100, 0, TAU); ctx.fillStyle = `rgba(255,60,40,${0.08 + 0.15 * k})`; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,80,60,.6)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x, b.y - 4, 11, 0, TAU); ctx.fillStyle = '#222'; ctx.fill();
    ctx.fillStyle = Math.floor(now * (6 + k * 20)) % 2 ? '#ff3b3b' : '#ffd34d'; ctx.beginPath(); ctx.arc(b.x + 6, b.y - 15, 4, 0, TAU); ctx.fill();
  }
  for (const e of enemies) if (inView(e.x, e.y)) drawEnemy(e, now);
  if (state !== 'title') drawPlayer(now);
  for (const o of obst) if (inView(o.x, o.y)) drawObstacle(o, true);

  if (tokenAnim) {
    const t = tokenAnim.t, rise = Math.min(1, t / 0.7);
    const ty = tokenAnim.y - 20 - rise * 55;
    ctx.save(); ctx.translate(tokenAnim.x, ty); ctx.rotate(t * 1.5);
    for (let i = 0; i < 10; i++) {
      ctx.rotate(TAU / 10); ctx.fillStyle = 'rgba(255,220,90,.28)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12, 120); ctx.lineTo(12, 120); ctx.fill();
    }
    ctx.restore();
    drawToken(tokenAnim.x, ty, 22 + rise * 6, Math.cos(t * 5));
  }
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.col;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // radar arrow
  if (P.radarT > 0 && tokenChest && !tokenAnim && state === 'play') {
    const a = Math.atan2(tokenChest.y - P.y, tokenChest.x - P.x), rr = 46 + Math.sin(now * 8) * 3;
    ctx.save(); ctx.translate(P.x + Math.cos(a) * rr, P.y + Math.sin(a) * rr); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath();
    ctx.fillStyle = '#ffd34d'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#7a4a00'; ctx.stroke();
    ctx.restore();
  }

  // storm
  if (state !== 'title' && storm) {
    ctx.beginPath(); ctx.rect(camX - vw - 300, camY - vh - 300, (vw + 300) * 2, (vh + 300) * 2);
    ctx.arc(storm.x, storm.y, storm.r, 0, TAU);
    ctx.fillStyle = 'rgba(115,40,200,0.4)'; ctx.fill('evenodd');
    ctx.beginPath(); ctx.arc(storm.x, storm.y, storm.r, 0, TAU); ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(210,130,255,.9)'; ctx.stroke();
    if (storm.phase < storm.phases.length) {
      ctx.setLineDash([18, 14]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.arc(storm.x, storm.y, storm.phases[storm.phase].to, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // floating text
  ctx.textAlign = 'center';
  for (const t of texts) {
    const k = t.t / t.life, size = (t.big ? 22 : 16) / Math.max(0.8, zoom) * (k < 0.15 ? 0.6 + k / 0.15 * 0.4 : 1);
    ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
    ctx.font = `italic 900 ${size}px ${FONT}`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(t.txt, t.x, t.y);
    ctx.fillStyle = t.col; ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  // ---------- screen space ----------
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (state === 'title') return;
  if (storm && dist(P.x, P.y, storm.x, storm.y) > storm.r) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(120,30,200,0)'); v.addColorStop(1, `rgba(140,40,220,${0.45 + 0.2 * Math.sin(now * 6)})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  drawHUD(now);
  drawMinimap();
  if (touchMode && state === 'play') {
    if (joy.active) {
      ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 58, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(joy.ox + joy.kx, joy.oy + joy.ky, 26, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
    } else {
      const bx = 96, by = H - 110;
      ctx.beginPath(); ctx.arc(bx, by, 58, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, by, 26, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill();
      ctx.font = `900 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.fillText('DRAG TO MOVE', bx, by + 78);
    }
  }
  if (banner) {
    const t = banner.t, a = t < 0.3 ? t / 0.3 : t > 2.1 ? Math.max(0, (2.6 - t) / 0.5) : 1;
    ctx.globalAlpha = a; ctx.textAlign = 'center';
    const bs = Math.min(64, W / 7);
    ctx.font = `italic 900 ${bs}px ${FONT}`;
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(20,10,60,.85)'; ctx.strokeText(banner.txt, W / 2, H * 0.3);
    ctx.fillStyle = '#ffd34d'; ctx.fillText(banner.txt, W / 2, H * 0.3);
    ctx.font = `italic 900 ${Math.min(20, W / 22)}px ${FONT}`; ctx.lineWidth = 5;
    ctx.strokeText(banner.sub, W / 2, H * 0.3 + bs * 0.62); ctx.fillStyle = '#fff'; ctx.fillText(banner.sub, W / 2, H * 0.3 + bs * 0.62);
    ctx.globalAlpha = 1;
  }
}
function hudText(txt, x, y, size, col, align) {
  ctx.font = `italic 900 ${size}px ${FONT}`; ctx.textAlign = align || 'left';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = col || '#fff'; ctx.fillText(txt, x, y);
}
function drawHUD(now) {
  const x0 = 12, y0 = 12;
  for (let i = 0; i < Math.max(3, lives); i++) heart(x0 + 12 + i * 26, y0, 22, i < lives ? '#ff4d6d' : 'rgba(255,255,255,.2)');
  for (let i = 0; i < shield; i++) {
    const hx = x0 + 12 + Math.max(3, lives) * 26 + 6 + i * 22, hy = y0 + 11;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; k ? ctx.lineTo(hx + Math.cos(a) * 9, hy + Math.sin(a) * 9) : ctx.moveTo(hx + Math.cos(a) * 9, hy + Math.sin(a) * 9); }
    ctx.closePath(); ctx.fillStyle = '#4fb6ff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#d8f1ff'; ctx.stroke();
  }
  hudText(`LVL ${level}`, x0, y0 + 48, 18, '#ffd34d');
  hudText(score.toLocaleString(), x0 + 72, y0 + 48, 18, '#fff');
  const opened = chests.filter((c) => c.state !== 'closed').length;
  hudText(`Chests ${opened}/${chests.length}`, x0, y0 + 72, 14, '#fff');
  let st = '';
  if (storm.phase < storm.phases.length) {
    const ph = storm.phases[storm.phase];
    if (storm.shrinking) st = 'STORM CLOSING!';
    else { const left = Math.max(0, Math.ceil(ph.wait - storm.t)); st = `Storm in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; }
  } else st = 'Final circle';
  hudText(st, x0, y0 + 92, 14, storm.shrinking ? '#e0a0ff' : '#d8c4ff');
  let bx = x0, by = y0 + 116;
  const buff = (label, t, col) => { hudText(`${label} ${Math.ceil(t)}`, bx, by, 13, col); by += 18; };
  if (P.speedT > 0) buff('SPEED', P.speedT, '#5cff8a');
  if (P.slowT > 0) buff('SLIMED', P.slowT, '#b6ff3b');
  if (P.radarT > 0) buff('RADAR', P.radarT, '#ffd34d');
  if (freezeT > 0) buff('FREEZE', freezeT, '#bff1ff');
  if (dist(P.x, P.y, storm.x, storm.y) > storm.r && !tokenAnim) hudText('GET INTO THE CIRCLE!', W / 2, H - 34, Math.min(22, W / 18), '#ff9cff', 'center');
}
function drawMinimap() {
  const mm = clamp(Math.min(W, H) * 0.24, 92, 150), k = mm / 1960;
  const ox = W - mm - 12, oy = 60;
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, mm, mm); ctx.fillStyle = 'rgba(10,60,120,.75)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
  ctx.clip();
  ctx.setTransform(DPR * k, 0, 0, DPR * k, (ox + mm / 2 - CX * k) * DPR, (oy + mm / 2 - CY * k) * DPR);
  ctx.fillStyle = '#e6cf84'; ctx.fill(islandPaths.sand);
  ctx.fillStyle = '#5ea843'; ctx.fill(islandPaths.grass);
  ctx.beginPath(); ctx.rect(-500, -500, 3000, 3000); ctx.arc(storm.x, storm.y, storm.r, 0, TAU); ctx.fillStyle = 'rgba(130,40,210,.5)'; ctx.fill('evenodd');
  if (storm.phase < storm.phases.length) { ctx.beginPath(); ctx.arc(storm.x, storm.y, storm.phases[storm.phase].to, 0, TAU); ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.stroke(); }
  for (const c of chests) {
    ctx.beginPath(); ctx.arc(c.x, c.y, c.state === 'closed' ? 34 : 22, 0, TAU);
    ctx.fillStyle = c.state === 'closed' ? RARITY[c.ri].col : 'rgba(60,40,20,.6)'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(P.x, P.y, 44, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 14; ctx.strokeStyle = '#0b4f4a'; ctx.stroke();
  ctx.restore();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

/* ---------------- input ---------------- */
const KM = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'open', KeyE: 'open' };
window.addEventListener('keydown', (e) => {
  const k = KM[e.code];
  if (k) { keys[k] = 1; e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'KeyP' || e.code === 'Escape') setPaused(state === 'play');
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Enter' || e.code === 'Space') {
    const ov = document.querySelector('.overlay.show');
    if (ov) { const b = ov.querySelector('.big'); if (b) { e.preventDefault(); b.click(); } }
  }
});
window.addEventListener('keyup', (e) => { const k = KM[e.code]; if (k) { keys[k] = 0; e.preventDefault(); } });
function clearInput() { for (const k in keys) keys[k] = 0; joy.active = false; joy.dx = joy.dy = 0; openBtnHeld = false; }
window.addEventListener('blur', () => { clearInput(); setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); setPaused(true); } });

function setTouchMode(on) {
  if (touchMode === on) return;
  touchMode = on;
  $('hMove').textContent = on ? 'drag anywhere (left side) / WASD' : 'WASD / arrows';
  $('hOpen').textContent = on ? 'hold the OPEN button / SPACE' : 'hold SPACE or E';
  updateOpenBtn();
}
cvs.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' || e.pointerType === 'pen') setTouchMode(true);
  if (state !== 'play' || joy.active) return;
  joy.active = true; joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.dx = joy.dy = joy.kx = joy.ky = 0;
  try { cvs.setPointerCapture(e.pointerId); } catch (err) {}
  e.preventDefault();
});
cvs.addEventListener('pointermove', (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
  const m = Math.hypot(dx, dy), R = 58;
  if (m > R) { joy.ox += dx / m * (m - R); joy.oy += dy / m * (m - R); dx = dx / m * R; dy = dy / m * R; }
  joy.kx = dx; joy.ky = dy; joy.dx = dx / R; joy.dy = dy / R;
  e.preventDefault();
});
const endJoy = (e) => { if (joy.active && e.pointerId === joy.id) { joy.active = false; joy.dx = joy.dy = joy.kx = joy.ky = 0; } };
cvs.addEventListener('pointerup', endJoy);
cvs.addEventListener('pointercancel', endJoy);
cvs.addEventListener('lostpointercapture', endJoy);
document.addEventListener('touchmove', (e) => { if (e.target === cvs) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
cvs.addEventListener('contextmenu', (e) => e.preventDefault());

const openBtn = $('openBtn');
openBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); initAudio(); openBtnHeld = true; openBtn.classList.add('held'); try { openBtn.setPointerCapture(e.pointerId); } catch (err) {} });
const releaseOpen = () => { openBtnHeld = false; openBtn.classList.remove('held'); };
openBtn.addEventListener('pointerup', releaseOpen);
openBtn.addEventListener('pointercancel', releaseOpen);
openBtn.addEventListener('lostpointercapture', releaseOpen);
openBtn.addEventListener('contextmenu', (e) => e.preventDefault());
let lastBtnState = '';
function updateOpenBtn() {
  const show = touchMode && state === 'play';
  const near = show && !!nearChest;
  const key = `${show}|${near}`;
  if (key === lastBtnState) return;
  lastBtnState = key;
  openBtn.classList.toggle('hidden', !show);
  openBtn.classList.toggle('near', near);
}
function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('tokenRush.muted', muted ? '1' : '0'); } catch (e) {}
  $('muteBtn').innerHTML = muted ? '&#128263;' : '&#128266;';
  if (!muted) { initAudio(); sfx.click(); }
}
const tapBtn = (id, fn) => $(id).addEventListener('click', () => { initAudio(); sfx.click(); fn(); });
tapBtn('playBtn', startGame);
tapBtn('resumeBtn', () => setPaused(false));
tapBtn('quitBtn', toTitle);
tapBtn('nextBtn', () => startLevel(level + 1));
tapBtn('againBtn', startGame);
tapBtn('titleBtn', toTitle);
tapBtn('keepBtn', () => startLevel(level + 1));
tapBtn('winAgainBtn', startGame);
$('pauseBtn').addEventListener('click', () => setPaused(state === 'play'));
$('muteBtn').addEventListener('click', toggleMute);

/* ---------------- loop ---------------- */
let last = performance.now();
function frame(t) {
  let dt = (t - last) / 1000; last = t;
  if (!(dt > 0)) dt = 0; if (dt > 0.05) dt = 0.05;
  clock += dt;
  if (state === 'play') update(dt);
  else if (state === 'title') { camX = CX + Math.cos(clock * 0.12) * 380; camY = CY + Math.sin(clock * 0.12) * 300; }
  shake = Math.max(0, shake - dt * 30);
  draw();
  requestAnimationFrame(frame);
}
window.addEventListener('resize', resize);
resize();
setTouchMode(!!(window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
$('muteBtn').innerHTML = muted ? '&#128263;' : '&#128266;';
toTitle();
requestAnimationFrame(frame);
if (/[?&]debug/.test(location.search)) window.__trDebug = { P, get chests() { return chests; }, get enemies() { return enemies; }, get storm() { return storm; }, get state() { return state; }, get lives() { return lives; }, get score() { return score; }, openChest, update, draw, startGame, startLevel, keys, setLives(v) { lives = v; } };
window.__tokenRush = { get state() { return state; }, get level() { return level; }, get chests() { return chests.length; }, get enemies() { return enemies.length; }, get touchMode() { return touchMode; } };
})();
