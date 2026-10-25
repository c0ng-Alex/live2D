/* 绯衣公子 · Live2D 动作台
 * 逐层 Canvas 绘制 + 参数驱动 + 关键帧动作 + 眨眼/视线/拆解
 */
(() => {
'use strict';

const VIEW = { w: 1440, h: 2560 };
// 人物有效范围（用于自动缩放取景）
const CHAR = { x0: 103, x1: 1367, y0: 200, y1: 2516, cx: 735, ground: 2494 };

/* ------------------------------------------------------------------ *
 * 变换层级：body → torso → head → (hair, eyes)，sleeves 挂在 torso
 * ------------------------------------------------------------------ */
const NODES = {
  body:     { parent: null,   pivot: [735, 1900], angle: p => p.sway, shift: p => [0, p.bodyDY] },
  torso:    { parent: 'body', pivot: [735, 1010], angle: p => p.lean + p.bend * 1.5,
              scale: p => [1 + 0.03 * p.bend, 1 + 0.008 * p.breath - 0.09 * p.bend],
              dir: [0, -30] },
  head:     { parent: 'torso', pivot: [735, 700], angle: p => p.headTilt,
              shift: p => [p.headShiftX, p.headDy + p.bend * 6], dir: [0, -68] },
  sleeve_L: { parent: 'torso', pivot: [572, 712], angle: p => p.sleeveL + p.breath * 1.2, dir: [-120, -20] },
  sleeve_R: { parent: 'torso', pivot: [900, 706], angle: p => p.sleeveR - p.breath * 1.2, dir: [120, -20] },
  hair_L:   { parent: 'head',  pivot: [640, 690], angle: p => p.hairL, dir: [-42, -62] },
  hair_R:   { parent: 'head',  pivot: [838, 690], angle: p => p.hairR, dir: [42, -62] },
  skirt:    { parent: 'body',  pivot: [735, 1250], angle: p => p.skirt, dir: [0, 76] },
  feet_L:   { parent: null,    pivot: [610, 2345], angle: p => p.footL, dir: [-62, 18] },
  feet_R:   { parent: null,    pivot: [905, 2345], angle: p => p.footR, dir: [62, 18] },
  eye_L:    { parent: 'head',  pivot: [695, 458], shift: p => [p.gazeX * 3.4, p.gazeY * 2.4], dir: [-9, -14] },
  eye_R:    { parent: 'head',  pivot: [785, 459], shift: p => [p.gazeX * 3.4, p.gazeY * 2.4], dir: [9, -14] },
};

const DEFAULT_PARAMS = {
  headTilt: 0, headShiftX: 0, headDy: 0,
  gazeX: 0, gazeY: 0, eyeOpen: 1,
  lean: 0, sway: 0, bend: 0, breath: 0, bodyDY: 0, zoom: 1,
  skirt: 0,
  sleeveL: 0, sleeveR: 0,
  hairL: 0, hairR: 0,
  footL: 0, footR: 0,
};

/* ------------------------------------------------------------------ *
 * 动作预设
 * ------------------------------------------------------------------ */
const MOTIONS = [
  {
    id: 'idle', name: '待机 · 呼吸', dur: 5.2, gif: 'idle.gif',
    desc: '胸腔缓缓起伏，广袖与垂发随风轻摆，期间自然眨眼两次。',
    ch: {
      bodyDY:    [[0, 0], [0.5, -5], [1, 0]],
      breath:    [[0, 0], [0.5, 1], [1, 0]],
      sleeveL:   [[0, 0], [0.5, 2], [1, 0]],
      sleeveR:   [[0, 0], [0.5, -2], [1, 0]],
      hairL:     [[0, 0], [0.5, 2.2], [1, 0]],
      hairR:     [[0, 0], [0.5, -2.4], [1, 0]],
      skirt:     [[0, 0], [0.5, 1.4], [1, 0]],
      headTilt:  [[0, 0], [0.3, 0.9], [0.72, -0.7], [1, 0]],
      eyeOpen:   [[0, 1], [0.18, 1], [0.22, 0.05], [0.27, 1], [0.62, 1], [0.66, 0.04], [0.71, 1], [1, 1]],
    },
  },
  {
    id: 'wave', name: '扬袖 · 挥手', dur: 2.8, gif: 'wave.gif',
    desc: '右广袖向外扬起并来回挥动，镜头稍稍拉远，头部微侧、目光随手。',
    ch: {
      sleeveR:   [[0, -8], [0.18, -22], [0.32, -12], [0.46, -22], [0.6, -12], [0.74, -21], [0.88, -10], [1, -8]],
      sleeveL:   [[0, 0], [0.4, -4], [0.7, 2], [1, 0]],
      headTilt:  [[0, 0], [0.3, 6], [0.68, 3], [1, 0]],
      headShiftX:[[0, 0], [0.28, -16], [1, 0]],
      gazeX:     [[0, 0], [0.26, -0.7], [0.72, -0.45], [1, 0]],
      zoom:      [[0, 1], [0.16, 0.86], [0.84, 0.86], [1, 1]],
      skirt:     [[0, 0], [0.5, 2], [1, 0]],
      eyeOpen:   [[0, 1], [0.4, 1], [0.45, 0.1], [0.5, 1], [1, 1]],
    },
  },
  {
    id: 'nod', name: '点头', dur: 2.0, gif: 'nod.gif',
    desc: '头颈前点两下，衣身随之轻微前倾，落定时眨一次眼。',
    ch: {
      headDy:    [[0, 0], [0.16, 34], [0.3, -5], [0.46, 29], [0.62, 0], [1, 0]],
      headTilt:  [[0, 0], [0.16, 4], [0.46, -2], [1, 0]],
      lean:      [[0, 0], [0.2, 3], [0.5, 1], [1, 0]],
      sleeveL:   [[0, 0], [0.2, 2], [0.5, -1], [1, 0]],
      sleeveR:   [[0, 0], [0.2, -2], [0.5, 1], [1, 0]],
      eyeOpen:   [[0, 1], [0.2, 1], [0.25, 0.06], [0.32, 1], [1, 1]],
    },
  },
  {
    id: 'turn', name: '摇曳 · 转身', dur: 4.2, gif: 'turn.gif',
    desc: '重心左右轻移，裙摆与长发反向荡开，像缓缓转身回望。',
    ch: {
      sway:      [[0, 0], [0.28, -2.6], [0.55, 0], [0.8, 2.6], [1, 0]],
      skirt:     [[0, 0], [0.28, 7], [0.55, 0], [0.8, -7], [1, 0]],
      hairL:     [[0, 0], [0.28, 6], [0.55, 0], [0.8, -7], [1, 0]],
      hairR:     [[0, 0], [0.28, 7], [0.55, 0], [0.8, -6], [1, 0]],
      sleeveL:   [[0, 0], [0.28, 3], [0.55, 0], [0.8, -2], [1, 0]],
      sleeveR:   [[0, 0], [0.28, -3], [0.55, 0], [0.8, 2], [1, 0]],
      headTilt:  [[0, 0], [0.28, -4], [0.55, 0], [0.8, 4], [1, 0]],
      gazeX:     [[0, 0], [0.28, 0.6], [0.55, 0], [0.8, -0.6], [1, 0]],
      footL:     [[0, 0], [0.3, -1.6], [0.7, 1], [1, 0]],
      footR:     [[0, 0], [0.3, 1.2], [0.7, -1.4], [1, 0]],
    },
  },
  {
    id: 'smile', name: '眨眼 · 轻笑', dur: 2.6, gif: 'smile.gif',
    desc: '连眨两次眼，头微偏、目光流盼，广袖轻颤，似低头浅笑。',
    ch: {
      headTilt:  [[0, 0], [0.3, 5.5], [0.7, 2.5], [1, 0]],
      headDy:    [[0, 0], [0.3, -8], [0.7, -2], [1, 0]],
      eyeOpen:   [[0, 1], [0.16, 1], [0.21, 0.05], [0.3, 1], [0.5, 1], [0.54, 0.03], [0.63, 1], [1, 1]],
      gazeX:     [[0, 0], [0.3, 0.55], [0.7, -0.25], [1, 0]],
      gazeY:     [[0, 0], [0.3, 0.35], [1, 0]],
      sleeveL:   [[0, 0], [0.5, 3], [1, 0]],
      sleeveR:   [[0, 0], [0.5, -3], [1, 0]],
      hairL:     [[0, 0], [0.5, 2], [1, 0]],
      hairR:     [[0, 0], [0.5, -2], [1, 0]],
    },
  },
  {
    id: 'bow', name: '一揖', dur: 3.6, gif: 'bow.gif',
    desc: '躬身作揖：上身微俯、双袖向中收拢，低头片刻后缓缓直起。',
    ch: {
      bend:      [[0, 0], [0.25, 1], [0.66, 1], [1, 0]],
      headDy:    [[0, 0], [0.25, 24], [0.66, 24], [1, 0]],
      headTilt:  [[0, 0], [0.25, 6], [0.66, 6], [1, 0]],
      sleeveL:   [[0, 0], [0.25, -18], [0.66, -18], [1, 0]],
      sleeveR:   [[0, 0], [0.25, 18], [0.66, 18], [1, 0]],
      skirt:     [[0, 0], [0.25, 2], [0.66, 2], [1, 0]],
      eyeOpen:   [[0, 1], [0.3, 1], [0.36, 0.12], [0.5, 1], [1, 1]],
    },
  },
];

/* ------------------------------------------------------------------ *
 * 状态
 * ------------------------------------------------------------------ */
const state = {
  base: { ...DEFAULT_PARAMS },
  current: { ...DEFAULT_PARAMS },
  visible: {},
  solo: null,
  explode: 0,
  explodeTarget: 0,
  motionId: null,
  motionTime: 0,
  loops: {},
  autoBlink: true,
  blink: { active: false, t: 0, dur: 0.26, next: 0 },
  gaze: { x: 0, y: 0, tx: 0, ty: 0 },
  label: '待机 · 呼吸',
};

let manifest = null;
const images = {};
let ORDER = [];
let canvas = null, ctx = null, cssW = 0, cssH = 0, dpr = 1;
const inputs = {};
let lastUI = 0;

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = x => x * x * (3 - 2 * x);
const fmt = v => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1));

function evalChannel(keys, t) {
  if (!keys || !keys.length) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const span = b[0] - a[0] || 1;
      return a[1] + (b[1] - a[1]) * smooth((t - a[0]) / span);
    }
  }
  return last[1];
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败 ' + src));
    img.src = src;
  });
}

function fitTo(W, H) {
  const s = Math.min((W * 0.94) / (CHAR.x1 - CHAR.x0), (H * 0.95) / (CHAR.y1 - CHAR.y0));
  return { s, ox: W / 2 - CHAR.cx * s, oy: H * 0.985 - CHAR.y1 * s };
}

/* ------------------------------------------------------------------ *
 * 矩阵
 * ------------------------------------------------------------------ */
function matrices(p, explode) {
  const cache = {};
  function mat(name) {
    if (cache[name]) return cache[name];
    const node = NODES[name];
    if (!node) return (cache[name] = new DOMMatrix());
    const parent = node.parent ? mat(node.parent) : new DOMMatrix();
    const px = node.pivot[0], py = node.pivot[1];
    const ang = node.angle ? node.angle(p) : 0;
    const sc = node.scale ? node.scale(p) : [1, 1];
    const sh = node.shift ? node.shift(p) : [0, 0];
    let local = new DOMMatrix()
      .translate(sh[0] || 0, sh[1] || 0)
      .translate(px, py)
      .rotate(ang || 0)
      .scale(sc[0], sc[1])
      .translate(-px, -py);
    let m = parent.multiply(local);
    if (explode > 0.001 && node.dir) {
      m = new DOMMatrix().translate(node.dir[0] * explode, node.dir[1] * explode).multiply(m);
    }
    cache[name] = m;
    return m;
  }
  return mat;
}

/* ------------------------------------------------------------------ *
 * 绘制
 * ------------------------------------------------------------------ */
function drawScene(g, W, H, p, opt = {}) {
  const ratio = opt.dpr || 1;
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  g.clearRect(0, 0, W, H);

  if (opt.bg) {
    const lg = g.createLinearGradient(0, 0, W * 0.35, H);
    lg.addColorStop(0, '#fbf5e9');
    lg.addColorStop(0.55, '#f2e7d5');
    lg.addColorStop(1, '#e6d6bd');
    g.fillStyle = lg;
    g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W * 0.5, H * 0.34, H * 0.05, W * 0.5, H * 0.4, H * 0.72);
    rg.addColorStop(0, 'rgba(255,253,247,.85)');
    rg.addColorStop(1, 'rgba(255,253,247,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
  }

  const f = fitTo(W, H);
  g.save();
  g.translate(f.ox, f.oy);
  g.scale(f.s, f.s);
  const ex = opt.explode || 0;
  const z = (p.zoom || 1) * (1 - 0.18 * ex);
  if (z !== 1) {
    g.translate(735, CHAR.ground);
    g.scale(z, z);
    g.translate(-735, -CHAR.ground);
  }

  // 地面淡影
  if (opt.shadow !== false) {
    g.save();
    g.translate(735, CHAR.ground);
    g.scale(1, 0.115);
    const sh = g.createRadialGradient(0, 0, 10, 0, 0, 330);
    sh.addColorStop(0, 'rgba(96, 70, 52, .22)');
    sh.addColorStop(0.62, 'rgba(96, 70, 52, .09)');
    sh.addColorStop(1, 'rgba(96, 70, 52, 0)');
    g.fillStyle = sh;
    g.beginPath();
    g.arc(0, 0, 330, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  const M = matrices(p, opt.explode || 0);
  const solo = opt.solo || null;
  const vis = opt.visible || null;
  const open = clamp(p.eyeOpen, 0, 1);

  for (const name of ORDER) {
    if (solo && name !== solo) continue;
    if (vis && vis[name] === false) continue;
    const part = manifest.parts[name];
    if (!part) continue;
    const img = images[name];
    if (!img) continue;

    const nodeKey = name.startsWith('eye_') ? name.slice(0, 5) : name; // eye_L / eye_R
    const m = M(nodeKey);

    let alpha = 1;
    if (name.endsWith('_open')) alpha = open;
    else if (name.endsWith('_closed')) alpha = 1 - open;
    if (alpha <= 0.004) continue;

    g.save();
    g.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    g.globalAlpha = alpha;
    g.drawImage(img, part.x, part.y, part.w, part.h);
    g.restore();
  }
  g.restore();
}

/* ------------------------------------------------------------------ *
 * 每帧参数
 * ------------------------------------------------------------------ */
function idleOffsets(clock) {
  return {
    bodyDY: Math.sin(clock * 1.18) * 2.0,
    breath: 0.5 + 0.5 * Math.sin(clock * 1.18 - 0.7),
    sway: Math.sin(clock * 0.62) * 0.8,
    sleeveL: Math.sin(clock * 0.95 + 0.5) * 1.6,
    sleeveR: Math.sin(clock * 0.95 + 2.4) * 1.7,
    hairL: Math.sin(clock * 0.8 + 1.2) * 1.8,
    hairR: Math.sin(clock * 0.8 + 2.8) * 1.9,
    skirt: Math.sin(clock * 0.7 + 0.4) * 1.2,
    headTilt: Math.sin(clock * 0.5 + 1.8) * 0.6,
  };
}

function currentMotion() {
  return MOTIONS.find(m => m.id === state.motionId) || null;
}

function motionPhase(m) {
  let t = state.motionTime / m.dur;
  if (state.loops[m.id]) t = ((t % 1) + 1) % 1;
  else t = clamp(t, 0, 1);
  return t;
}

function buildTarget(clock) {
  const p = { ...state.base };
  const idle = idleOffsets(clock);
  for (const k in idle) p[k] = (p[k] || 0) + idle[k];

  p.gazeX = state.gaze.x;
  p.gazeY = state.gaze.y;
  p.headShiftX += state.gaze.x * 4;

  const m = currentMotion();
  if (m) {
    const t = motionPhase(m);
    for (const k in m.ch) p[k] = evalChannel(m.ch[k], t);
    if (m.ch.eyeOpen) p.eyeOpen = evalChannel(m.ch.eyeOpen, t);
  }

  if (state.blink.active && !(m && m.ch.eyeOpen)) {
    const k = clamp(1 - state.blink.t / state.blink.dur, 0, 1);
    p.eyeOpen = k < 0.34 ? 1 - smooth(k / 0.34) : smooth((k - 0.34) / 0.66);
  }
  return p;
}

function update(dt, clock) {
  const m = currentMotion();
  if (m) {
    state.motionTime += dt;
    if (!state.loops[m.id] && state.motionTime >= m.dur) stopMotion();
  }

  if (state.blink.active) {
    state.blink.t -= dt;
    if (state.blink.t <= 0) {
      state.blink.active = false;
      state.blink.next = clock + 2.2 + Math.random() * 3.4;
    }
  } else if (state.autoBlink && clock >= state.blink.next) {
    triggerBlink();
  }

  const gk = 1 - Math.exp(-dt * 7);
  state.gaze.x += (state.gaze.tx - state.gaze.x) * gk;
  state.gaze.y += (state.gaze.ty - state.gaze.y) * gk;

  const target = buildTarget(clock);
  const k = 1 - Math.exp(-dt * 16);
  for (const key in state.current) {
    const v = target[key] === undefined ? state.base[key] : target[key];
    state.current[key] += (v - state.current[key]) * k;
  }

  state.explode += (state.explodeTarget - state.explode) * (1 - Math.exp(-dt * 5.5));
}

function triggerBlink() {
  state.blink.active = true;
  state.blink.t = state.blink.dur;
}

/* ------------------------------------------------------------------ *
 * 主循环
 * ------------------------------------------------------------------ */
let lastT = 0;
function tick(now) {
  const clock = now / 1000;
  const dt = lastT ? Math.min(0.06, clock - lastT) : 0.016;
  lastT = clock;
  update(dt, clock);
  drawScene(ctx, cssW, cssH, state.current, {
    dpr,
    visible: state.visible,
    solo: state.solo,
    explode: state.explode,
  });
  if (state.motionId && state.motionId !== 'idle' && clock - lastUI > 0.12) {
    lastUI = clock;
    syncSliderUI(state.current);
  }
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ *
 * UI
 * ------------------------------------------------------------------ */
const PARAM_GROUPS = [
  {
    group: '头部 · 面部',
    items: [
      ['headTilt', '头部倾斜', -16, 16, 1, '°'],
      ['headShiftX', '头部平移', -28, 28, 1, 'px'],
      ['headDy', '头部俯仰', -36, 36, 1, 'px'],
      ['gazeX', '视线水平', -1, 1, 0.01, ''],
      ['gazeY', '视线垂直', -1, 1, 0.01, ''],
      ['eyeOpen', '眼睛开合', 0, 1, 0.01, ''],
    ],
  },
  {
    group: '身体 · 裙摆',
    items: [
      ['lean', '身体倾侧', -14, 14, 1, '°'],
      ['sway', '重心摆动', -6, 6, 0.1, '°'],
      ['skirt', '裙摆摆动', -12, 12, 1, '°'],
    ],
  },
  {
    group: '广袖 · 发丝 · 双足',
    items: [
      ['sleeveL', '左广袖', -70, 40, 1, '°'],
      ['sleeveR', '右广袖', -70, 40, 1, '°'],
      ['hairL', '左侧垂发', -16, 16, 0.5, '°'],
      ['hairR', '右侧垂发', -16, 16, 0.5, '°'],
      ['footL', '左足', -6, 6, 0.5, '°'],
      ['footR', '右足', -6, 6, 0.5, '°'],
    ],
  },
];

function buildMotions() {
  const list = document.getElementById('motionList');
  MOTIONS.forEach((m, i) => {
    const el = document.createElement('div');
    el.className = 'motion';
    el.dataset.id = m.id;
    el.innerHTML = `
      <div class="m-top">
        <span class="m-idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="m-name">${m.name}</span>
        <span class="m-dur">${m.dur.toFixed(1)}s</span>
      </div>
      <p class="m-desc">${m.desc}</p>
      <div class="m-actions">
        <button data-act="play">播放</button>
        <button data-act="loop" class="loop ${state.loops[m.id] ? 'on' : ''}">循环</button>
        <a href="gifs/${m.gif}" download data-act="gif">下载 GIF</a>
      </div>`;
    el.addEventListener('click', e => {
      const act = e.target.dataset.act;
      if (act === 'loop') { e.stopPropagation(); toggleLoop(m.id); return; }
      if (act === 'gif' || e.target.closest('a')) return;
      playMotion(m.id);
    });
    list.appendChild(el);
  });

  const chips = document.getElementById('quickMotions');
  MOTIONS.forEach(m => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.dataset.id = m.id;
    b.textContent = m.name;
    b.addEventListener('click', () => playMotion(m.id));
    chips.appendChild(b);
  });

  const grid = document.getElementById('gifGrid');
  MOTIONS.forEach(m => {
    const d = document.createElement('div');
    d.className = 'gif-item';
    d.innerHTML = `<img src="gifs/${m.gif}" alt="${m.name}"><span>${m.name} · GIF</span>`;
    d.querySelector('img').addEventListener('error', () => d.remove());
    d.addEventListener('click', () => playMotion(m.id));
    grid.appendChild(d);
  });
}

function playMotion(id) {
  const m = MOTIONS.find(x => x.id === id);
  if (!m) return;
  state.motionId = id;
  state.motionTime = 0;
  state.label = m.name;
  syncMotionUI();
}

function stopMotion() {
  state.motionId = null;
  state.motionTime = 0;
  state.label = '自由调节';
  syncMotionUI();
  syncSliderUI(state.base);
}

function toggleLoop(id) {
  state.loops[id] = !state.loops[id];
  const card = document.querySelector(`.motion[data-id="${id}"] .loop`);
  if (card) card.classList.toggle('on', state.loops[id]);
}

function syncMotionUI() {
  document.querySelectorAll('.motion').forEach(el => {
    el.classList.toggle('on', el.dataset.id === state.motionId);
  });
  document.querySelectorAll('#quickMotions .chip').forEach(el => {
    el.classList.toggle('on', el.dataset.id === state.motionId);
  });
  const lab = document.getElementById('motionLabel');
  if (lab) lab.textContent = state.label;
}

function buildParams() {
  const host = document.getElementById('paramList');
  PARAM_GROUPS.forEach(g => {
    const wrap = document.createElement('div');
    wrap.className = 'p-group';
    const h = document.createElement('h3');
    h.textContent = g.group;
    wrap.appendChild(h);
    g.items.forEach(([key, name, min, max, step, unit]) => {
      const row = document.createElement('div');
      row.className = 'p-row';
      row.innerHTML = `<span class="p-name">${name}</span>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${state.base[key]}">
        <span class="p-val">${fmt(state.base[key])}${unit}</span>`;
      const input = row.querySelector('input');
      const val = row.querySelector('.p-val');
      input.addEventListener('input', () => {
        if (state.motionId) stopMotion();
        state.base[key] = parseFloat(input.value);
        val.textContent = fmt(state.base[key]) + unit;
      });
      inputs[key] = { input, val, unit };
      wrap.appendChild(row);
    });
    host.appendChild(wrap);
  });
}

function syncSliderUI(p) {
  for (const key in inputs) {
    const it = inputs[key];
    const v = p[key];
    if (v === undefined) continue;
    const slider = it.input;
    if (document.activeElement === slider) continue;
    const step = parseFloat(slider.step) || 0.1;
    if (Math.abs(parseFloat(slider.value) - v) > step * 0.5) slider.value = v;
    it.val.textContent = fmt(v) + it.unit;
  }
}

function buildLayers() {
  const host = document.getElementById('layerList');
  [...ORDER].reverse().forEach((name, i) => {
    const part = manifest.parts[name];
    const row = document.createElement('div');
    row.className = 'layer';
    row.dataset.name = name;
    row.innerHTML = `
      <span class="lidx">${ORDER.length - i}</span>
      <span class="thumb"><img src="${part.file}" alt=""></span>
      <span class="lname">${part.label}</span>
      <button class="eye-btn" data-act="vis" title="显示 / 隐藏">◉</button>`;
    row.querySelector('[data-act="vis"]').addEventListener('click', e => {
      e.stopPropagation();
      state.visible[name] = !state.visible[name];
      row.classList.toggle('hidden', !state.visible[name]);
      row.querySelector('.eye-btn').textContent = state.visible[name] ? '◉' : '○';
    });
    row.querySelector('.lname').addEventListener('click', () => {
      state.solo = state.solo === name ? null : name;
      syncLayerUI();
    });
    host.appendChild(row);
  });
}

function syncLayerUI() {
  document.querySelectorAll('.layer').forEach(row => {
    row.classList.toggle('solo', state.solo === row.dataset.name);
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.pane').forEach(p => {
        p.classList.toggle('active', p.dataset.pane === tab.dataset.tab);
      });
    });
  });
}

function setupActions() {
  document.getElementById('btnReset').addEventListener('click', () => {
    state.base = { ...DEFAULT_PARAMS };
    for (const k in state.visible) state.visible[k] = true;
    document.querySelectorAll('.layer').forEach(r => {
      r.classList.remove('hidden');
      const b = r.querySelector('.eye-btn');
      if (b) b.textContent = '◉';
    });
    state.solo = null;
    state.explodeTarget = 0;
    document.getElementById('btnExplode').textContent = '拆解预览';
    syncLayerUI();
    syncSliderUI(state.base);
    playMotion('idle');
  });

  document.getElementById('btnBlink').addEventListener('click', triggerBlink);

  document.getElementById('autoBlink').addEventListener('change', e => {
    state.autoBlink = e.target.checked;
    if (!state.autoBlink) state.blink.active = false;
    else state.blink.next = performance.now() / 1000 + 1.5;
  });

  document.getElementById('btnAll').addEventListener('click', () => {
    for (const k in state.visible) state.visible[k] = true;
    document.querySelectorAll('.layer').forEach(r => {
      r.classList.remove('hidden');
      const b = r.querySelector('.eye-btn');
      if (b) b.textContent = '◉';
    });
    state.solo = null;
    syncLayerUI();
  });

  const ex = document.getElementById('btnExplode');
  ex.addEventListener('click', () => {
    state.explodeTarget = state.explodeTarget > 0.5 ? 0 : 1;
    ex.textContent = state.explodeTarget > 0.5 ? '合拢部件' : '拆解预览';
  });

  const stage = document.getElementById('stage');
  stage.addEventListener('mousemove', e => {
    const r = stage.getBoundingClientRect();
    state.gaze.tx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2.6, -1, 1);
    state.gaze.ty = clamp(((e.clientY - r.top) / r.height - 0.5) * 2.2, -1, 1);
  });
  stage.addEventListener('mouseleave', () => { state.gaze.tx = 0; state.gaze.ty = 0; });
}

function resize() {
  const stage = document.getElementById('stage');
  const r = stage.getBoundingClientRect();
  cssW = Math.max(1, Math.round(r.width));
  cssH = Math.max(1, Math.round(r.height));
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.imageSmoothingEnabled = true;
}

/* ------------------------------------------------------------------ *
 * 对外接口（用于 GIF 导出）
 * ------------------------------------------------------------------ */
function paramsForFrame(id, t) {
  const m = MOTIONS.find(x => x.id === id);
  const p = { ...DEFAULT_PARAMS };
  if (!m) return p;
  for (const k in m.ch) p[k] = evalChannel(m.ch[k], t);
  return p;
}

const ready = (async () => {
  canvas = document.getElementById('stageCanvas');
  ctx = canvas.getContext('2d');

  manifest = await fetch('parts.json').then(r => r.json());
  ORDER = manifest.order.slice();
  ORDER.forEach(n => { state.visible[n] = true; });
  MOTIONS.forEach(m => { state.loops[m.id] = m.id === 'idle'; });

  await Promise.all(ORDER.map(async n => {
    images[n] = await loadImage(manifest.parts[n].file);
  }));

  buildMotions();
  buildParams();
  buildLayers();
  setupTabs();
  setupActions();
  state.blink.next = performance.now() / 1000 + 3;

  resize();
  new ResizeObserver(resize).observe(document.getElementById('stage'));
  window.addEventListener('resize', resize);

  playMotion('idle');
  requestAnimationFrame(tick);
  window.__L2D_READY__ = true;
})();

window.L2D = {
  ready,
  motions: () => MOTIONS.map(m => ({ id: m.id, name: m.name, dur: m.dur, gif: m.gif })),
  capture(id, t, w = 360, h = 640) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    drawScene(g, w, h, paramsForFrame(id, t), { dpr: 1, bg: true });
    return cv.toDataURL('image/png');
  },
};

})();
