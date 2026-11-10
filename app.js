'use strict';
/* =========================================================
   Laboratorio Virtual de Espejos Esféricos — Física 11°
   Modelo: aproximación paraxial (los rayos se reflejan en el
   plano del vértice). Convención de signos "real es positivo":
     f > 0 cóncavo, f < 0 convexo
     d<sub>i</sub> > 0 imagen real (frente al espejo), d<sub>i</sub> < 0 virtual (detrás)
   Sistema de coordenadas del mundo (en cm): vértice V en (0,0),
   el objeto está a la izquierda (x = −d<sub>o</sub>).
   ========================================================= */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const COL = {
  r1: '#e63946', r2: '#1d6fe0', r3: '#12a150', r4: '#9b37d6',
  obj: '#f97316', img: '#0891b2', axis: '#1f2335',
  F: '#e11d74', C: '#4c1d95', V: '#1f2335',
};

const RAY_TEXT = {
  concavo: {
    r1: 'Llega paralelo al eje → se refleja pasando por F',
    r2: 'Pasa por F → se refleja paralelo al eje',
    r3: 'Pasa por C → se refleja sobre sí mismo',
    r4: 'Llega al vértice V → se refleja simétrico',
  },
  convexo: {
    r1: 'Llega paralelo → se refleja como si viniera de F',
    r2: 'Se dirige hacia F → se refleja paralelo al eje',
    r3: 'Se dirige hacia C → regresa sobre sí mismo',
    r4: 'Llega al vértice V → se refleja simétrico',
  },
};

const CASES = [
  { id: 1, esp: 'Cóncavo', obj: 'Más allá de C', img: 'Entre F y C', car: 'Real · Invertida · Menor' },
  { id: 2, esp: 'Cóncavo', obj: 'En C', img: 'En C', car: 'Real · Invertida · Igual' },
  { id: 3, esp: 'Cóncavo', obj: 'Entre C y F', img: 'Más allá de C', car: 'Real · Invertida · Mayor' },
  { id: 4, esp: 'Cóncavo', obj: 'En F', img: 'No se forma (∞)', car: 'Rayos paralelos' },
  { id: 5, esp: 'Cóncavo', obj: 'Entre F y V', img: 'Detrás del espejo', car: 'Virtual · Derecha · Mayor' },
  { id: 6, esp: 'Convexo', obj: 'Cualquier lugar', img: 'Detrás, entre V y F', car: 'Virtual · Derecha · Menor' },
];

const PRESETS = {
  1: { type: 'concavo', fAbs: 10, d: 30, ho: 5 },
  2: { type: 'concavo', fAbs: 10, d: 20, ho: 5 },
  3: { type: 'concavo', fAbs: 10, d: 15, ho: 4 },
  4: { type: 'concavo', fAbs: 10, d: 10, ho: 4 },
  5: { type: 'concavo', fAbs: 10, d: 6, ho: 3 },
  6: { type: 'convexo', fAbs: 10, d: 20, ho: 6 },
};

const LIM = { d: [0.5, 100], ho: [0.5, 25], fAbs: [2, 40] };

const state = {
  type: 'concavo', fAbs: 10, d: 25, ho: 5, shape: 'flecha',
  rays: { r1: true, r2: true, r3: true, r4: false },
  snap: true, dims: true, labels: true, photons: true,
  mode: 'lab', hide: false, hint: false,
};

const view = { scale: 22, ox: 0, oy: 0, w: 0, h: 0, dpr: 1, fitted: false };
let hover = null;        // posición del cursor en píxeles
let hoverTarget = null;  // 'tip' | 'body' | 'focus' | null
let drag = null;
let traceT = Infinity;   // progreso de la animación "Trazar rayos"
let photonT = 0;
let lastTime = performance.now();

/* ---------------- Utilidades ---------------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = (v, n) => Math.round(v * 10 ** n) / 10 ** n;

function fmt(x, n = 2) {
  if (!isFinite(x)) return '∞';
  if (Math.abs(x) < 0.5 * 10 ** -n) x = 0;
  let s = x.toFixed(n).replace('.', ',');
  if (s.startsWith('-')) s = '−' + s.slice(1);
  return s;
}
const fmtS = (x, n = 2) => (x > 0 && isFinite(x) ? '+' : '') + fmt(x, n);
const par = (x, n = 2) => (x < 0 ? `(${fmt(x, n)})` : fmt(x, n));
const frac = (a, b) => `<span class="frac"><span>${a}</span><span>${b}</span></span>`;

/* ---------------- Física ---------------- */
function signedF() { return state.type === 'concavo' ? state.fAbs : -state.fAbs; }

function optics() {
  const f = signedF(), d = state.d, h = state.ho;
  const inf = Math.abs(d - f) < 1e-9;
  const di = inf ? Infinity : (f * d) / (d - f);
  const m = inf ? Infinity : -di / d;
  const hi = inf ? Infinity : m * h;
  return { f, d, h, di, m, hi, inf };
}

function classify(o) {
  const c = {};
  const E = 1e-6, f = Math.abs(o.f), d = o.d;
  if (o.f > 0) {
    if (d > 2 * f + E) { c.caso = 1; c.objPos = 'Más allá de C'; c.imgPos = 'Entre F y C'; }
    else if (Math.abs(d - 2 * f) <= E) { c.caso = 2; c.objPos = 'En el centro de curvatura C'; c.imgPos = 'En C'; }
    else if (d > f + E) { c.caso = 3; c.objPos = 'Entre C y F'; c.imgPos = 'Más allá de C'; }
    else if (Math.abs(d - f) <= E) { c.caso = 4; c.objPos = 'En el foco F'; c.imgPos = 'No se forma (∞)'; }
    else { c.caso = 5; c.objPos = 'Entre F y V'; c.imgPos = 'Detrás del espejo'; }
  } else {
    c.caso = 6; c.objPos = 'Frente al espejo'; c.imgPos = 'Detrás, entre V y F';
  }
  if (o.inf) { c.nat = 'No se forma'; c.ori = '—'; c.tam = '—'; c.real = null; }
  else {
    c.real = o.di > 0;
    c.nat = c.real ? 'Real' : 'Virtual';
    c.ori = o.m < 0 ? 'Invertida' : 'Derecha';
    const am = Math.abs(o.m);
    c.tam = am > 1 + 1e-6 ? 'Mayor' : am < 1 - 1e-6 ? 'Menor' : 'Igual';
  }
  return c;
}

/* ---------------- Transformaciones mundo ↔ pantalla ---------------- */
const X = (x) => view.ox + x * view.scale;
const Y = (y) => view.oy - y * view.scale;
const WX = (px) => (px - view.ox) / view.scale;
const WY = (py) => (view.oy - py) / view.scale;

function fitView() {
  if (!view.w) return;
  const o = optics();
  const fa = Math.abs(o.f);
  let left = Math.max(o.d, o.f > 0 ? 2 * fa : 0);
  if (!o.inf && o.di > 0) left = Math.max(left, Math.min(o.di, 70));
  left = left * 1.12 + 2;
  let right = 5;
  if (o.f < 0) right = Math.max(right, 2 * fa * 1.08 + 1);
  if (!o.inf && o.di < 0) right = Math.max(right, Math.min(-o.di, 70) * 1.15 + 2);
  const hiAbs = o.inf ? 0 : Math.min(Math.abs(o.hi), 50);
  const top = Math.max(o.h, !o.inf && o.hi > 0 ? hiAbs : 0) * 1.3 + 2.5;
  const bottom = Math.max(!o.inf && o.hi < 0 ? hiAbs : 0, 2) * 1.25 + 4.5;
  const padX = 40, padY = 70;
  const s = Math.min((view.w - padX * 2) / (left + right), (view.h - padY * 2) / (top + bottom));
  view.scale = clamp(s, 3, 120);
  const usedW = (left + right) * view.scale, usedH = (top + bottom) * view.scale;
  view.ox = (view.w - usedW) / 2 + left * view.scale;
  view.oy = (view.h - usedH) / 2 + top * view.scale + 10;
  view.fitted = true;
}

/* ---------------- Lienzo ---------------- */
const cv = $('#lab');
const ctx = cv.getContext('2d');

function resize() {
  const r = $('#canvasWrap').getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  const oldW = view.w, oldH = view.h;
  view.dpr = window.devicePixelRatio || 1;
  view.w = r.width; view.h = r.height;
  cv.width = Math.round(r.width * view.dpr);
  cv.height = Math.round(r.height * view.dpr);
  if (!view.fitted) fitView();
  else { view.ox += (view.w - oldW) / 2; view.oy += (view.h - oldH) / 2; }
  render();
}

/* ---------- Hoja milimetrada ---------- */
function drawPaper() {
  const W = view.w, H = view.h, s = view.scale;
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, W, H);

  // Zona detrás del espejo (virtual) levemente sombreada
  const xm = X(0);
  if (xm < W) {
    const g = ctx.createLinearGradient(xm, 0, W, 0);
    g.addColorStop(0, 'rgba(110,90,200,0.09)');
    g.addColorStop(1, 'rgba(110,90,200,0.03)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.max(0, xm), 0, W - Math.max(0, xm), H);
  }

  const x0 = WX(0), x1 = WX(W), y0 = WY(H), y1 = WY(0);
  const levels = [
    { step: 0.1, color: 'rgba(236,120,60,0.20)', lw: 0.5, min: 3 },
    { step: 0.5, color: 'rgba(236,110,50,0.36)', lw: 0.75, min: 3 },
    { step: 1, color: 'rgba(225,95,35,0.58)', lw: 1, min: 4 },
    { step: 5, color: 'rgba(200,75,25,0.75)', lw: 1.5, min: 3 },
  ];
  for (const L of levels) {
    if (L.step * s < L.min) continue;
    ctx.strokeStyle = L.color;
    ctx.lineWidth = L.lw;
    ctx.beginPath();
    const ia = Math.floor(x0 / L.step), ib = Math.ceil(x1 / L.step);
    for (let i = ia; i <= ib; i++) {
      const px = Math.round(X(i * L.step)) + 0.5;
      ctx.moveTo(px, 0); ctx.lineTo(px, H);
    }
    const ja = Math.floor(y0 / L.step), jb = Math.ceil(y1 / L.step);
    for (let j = ja; j <= jb; j++) {
      const py = Math.round(Y(j * L.step)) + 0.5;
      ctx.moveTo(0, py); ctx.lineTo(W, py);
    }
    ctx.stroke();
  }

  // Rótulos de zonas
  if (state.labels) {
    ctx.font = '700 11px Poppins';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(194,65,12,0.75)';
    ctx.textAlign = 'right';
    const zy = 70;
    if (xm > 380) ctx.fillText('◀ FRENTE AL ESPEJO · zona de imágenes reales', xm - 70, zy);
    ctx.fillStyle = 'rgba(91,33,182,0.75)';
    ctx.textAlign = 'left';
    if (W - xm > 340) ctx.fillText('DETRÁS DEL ESPEJO · imágenes virtuales ▶', xm + 70, zy);
  }

  const mmLbl = s * 0.1 >= 3 ? '1 cuadro pequeño = 1 mm · 1 cuadro grande = 1 cm' : '1 cuadro = 1 cm (acerca el zoom para ver los mm)';
  $('#scaleInfo').textContent = mmLbl;
}

function niceStep(minPx) {
  const steps = [0.5, 1, 2, 5, 10, 20, 50, 100];
  for (const st of steps) if (st * view.scale >= minPx) return st;
  return 200;
}

function drawAxis() {
  const W = view.w, ay = Math.round(Y(0)) + 0.5;
  ctx.save();
  ctx.strokeStyle = COL.axis;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(W, ay); ctx.stroke();

  // Números de distancia (valor absoluto desde el vértice)
  const st = niceStep(42);
  const x0 = WX(0), x1 = WX(W);
  ctx.font = '600 10px "JetBrains Mono"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = Math.ceil(x0 / st); i <= Math.floor(x1 / st); i++) {
    const v = round(i * st, 2);
    const px = X(v);
    ctx.beginPath(); ctx.moveTo(px, ay - 4); ctx.lineTo(px, ay + 4); ctx.stroke();
    if (v === 0) continue;
    const txt = fmt(Math.abs(v), st < 1 ? 1 : 0);
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(255,253,246,0.9)';
    ctx.fillRect(px - tw / 2 - 2, ay + 6, tw + 4, 12);
    ctx.fillStyle = v < 0 ? '#9a3412' : '#5b21b6';
    ctx.fillText(txt, px, ay + 6);
  }
  if (state.labels) {
    ctx.textAlign = 'left';
    ctx.font = 'italic 600 11px Poppins';
    ctx.fillStyle = '#3b3f5c';
    ctx.fillText('Eje principal (cm)', 12, ay - 18);
  }
  ctx.restore();
}

/* ---------- Espejo ---------- */
function drawMirror(o, Hm) {
  const concave = o.f > 0;
  const R = 2 * Math.abs(o.f);
  const rawMax = (Hm * Hm) / (2 * R);
  const maxSag = Math.min(Hm * 0.16, 2.5);
  const k = rawMax > maxSag ? maxSag / rawMax : 1;
  const sx = (y) => (concave ? -1 : 1) * ((y * y) / (2 * R)) * k;

  const pts = [];
  for (let i = 0; i <= 90; i++) {
    const y = -Hm + (2 * Hm * i) / 90;
    pts.push([X(sx(y)), Y(y)]);
  }
  ctx.save();
  // Rayado posterior (parte no reflectora)
  ctx.strokeStyle = 'rgba(55,65,95,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let py = Y(Hm) + 4; py <= Y(-Hm); py += 8) {
    const px = X(sx(WY(py)));
    ctx.moveTo(px + 3, py); ctx.lineTo(px + 12, py - 8);
  }
  ctx.stroke();

  // Superficie plateada
  const g = ctx.createLinearGradient(0, Y(Hm), 0, Y(-Hm));
  g.addColorStop(0, '#9fb0cf'); g.addColorStop(0.3, '#e9eff9');
  g.addColorStop(0.55, '#7f93b8'); g.addColorStop(0.8, '#dfe7f5'); g.addColorStop(1, '#8798bb');
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(40,60,120,0.35)'; ctx.shadowBlur = 8;
  ctx.strokeStyle = g; ctx.lineWidth = 7;
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(40,52,90,0.9)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x - 3.2, y) : ctx.moveTo(x - 3.2, y))); ctx.stroke();
  ctx.restore();

  if (state.labels) {
    pillText(concave ? 'Espejo cóncavo' : 'Espejo convexo', X(0), Math.max(Y(Hm) - 18, 90), '#fff', '#3b3f6b');
  }
}

/* ---------- Puntos notables ---------- */
function drawPoints(o) {
  const pts = [
    { k: 'C', x: -2 * o.f, col: COL.C },
    { k: 'F', x: -o.f, col: COL.F },
    { k: 'V', x: 0, col: COL.V },
  ];
  const ay = Y(0);
  for (const p of pts) {
    const px = X(p.x);
    const isF = p.k === 'F';
    const active = isF && (hoverTarget === 'focus' || (drag && drag.type === 'focus'));
    ctx.save();
    if (isF && state.mode === 'lab') {
      ctx.beginPath(); ctx.arc(px, ay, active ? 13 : 10, 0, Math.PI * 2);
      ctx.fillStyle = active ? 'rgba(225,29,116,0.22)' : 'rgba(225,29,116,0.1)'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(px, ay, 5, 0, Math.PI * 2);
    ctx.fillStyle = p.x > 0 ? '#fff' : p.col; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = p.col; ctx.stroke();
    if (state.labels) {
      ctx.font = '800 15px Poppins'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = p.col;
      ctx.fillText(p.k, px + (p.k === 'V' ? 10 : 0), ay - 9);
      if (p.k !== 'V') {
        ctx.font = '500 10px "JetBrains Mono"'; ctx.fillStyle = 'rgba(40,40,70,0.8)';
        const val = p.k === 'F' ? `f=${fmt(Math.abs(o.f), 1)}` : `R=${fmt(Math.abs(2 * o.f), 1)}`;
        ctx.fillText(val, px, ay - 26);
      }
    }
    ctx.restore();
  }
}

/* ---------- Rayos ---------- */
function exitPoint(p, dir) {
  const xmin = WX(-60), xmax = WX(view.w + 60), ymin = WY(view.h + 60), ymax = WY(-60);
  let t = Infinity;
  if (dir.x < 0) t = Math.min(t, (xmin - p.x) / dir.x); else if (dir.x > 0) t = Math.min(t, (xmax - p.x) / dir.x);
  if (dir.y < 0) t = Math.min(t, (ymin - p.y) / dir.y); else if (dir.y > 0) t = Math.min(t, (ymax - p.y) / dir.y);
  if (!isFinite(t) || t < 0) t = 0;
  return { x: p.x + dir.x * t, y: p.y + dir.y * t };
}

// Prolongación detrás del espejo hasta xExt (recortada a la vista)
function virtTo(hit, slope, xExt) {
  const p = exitPoint(hit, { x: 1, y: slope });
  if (p.x < xExt) return p;
  return { x: xExt, y: hit.y + slope * xExt };
}

function buildRays(o) {
  const f = o.f, d = o.d, xo = -d, yo = o.h;
  const concave = f > 0;
  const tip = { x: xo, y: yo };
  const virt = !o.inf && o.di < 0;
  let xExt = 0;
  if (virt) xExt = Math.max(-o.di, concave ? 0 : -f) * 1.12 + 1;
  xExt = Math.min(xExt, WX(view.w + 60));
  const rays = [];

  // Rayo 1: paralelo al eje → por F
  {
    const hit = { x: 0, y: yo };
    const slope = yo / f;
    const segs = [
      { a: tip, b: hit, k: 'inc' },
      { a: hit, b: exitPoint(hit, { x: -1, y: -slope }), k: 'ref' },
    ];
    if (xExt > 0) segs.push({ a: hit, b: virtTo(hit, slope, xExt), k: 'virt' });
    rays.push({ id: 'r1', segs });
  }
  // Rayo 2: por F → paralelo
  if (Math.abs(d - f) > 1e-9) {
    const y2 = (-yo * f) / (d - f);
    const hit = { x: 0, y: y2 };
    const segs = [];
    if (concave && d < f) segs.push({ a: { x: -f, y: 0 }, b: tip, k: 'cons' });
    segs.push({ a: tip, b: hit, k: 'inc' });
    if (!concave) segs.push({ a: hit, b: { x: -f, y: 0 }, k: 'cons' });
    segs.push({ a: hit, b: exitPoint(hit, { x: -1, y: 0 }), k: 'ref' });
    if (xExt > 0) segs.push({ a: hit, b: virtTo(hit, 0, xExt), k: 'virt' });
    rays.push({ id: 'r2', segs });
  }
  // Rayo 3: por C → regresa sobre sí mismo
  if (Math.abs(d - 2 * f) > 1e-9) {
    const s3 = -yo / (d - 2 * f);
    const y3 = yo + s3 * d;
    const hit = { x: 0, y: y3 };
    const segs = [];
    if (concave && d < 2 * f) segs.push({ a: { x: -2 * f, y: 0 }, b: tip, k: 'cons' });
    segs.push({ a: tip, b: hit, k: 'inc' });
    if (!concave) segs.push({ a: hit, b: { x: -2 * f, y: 0 }, k: 'cons' });
    segs.push({ a: hit, b: exitPoint(hit, { x: -1, y: -s3 }), k: 'ref', offset: true });
    if (xExt > 0) segs.push({ a: hit, b: virtTo(hit, s3, xExt), k: 'virt' });
    rays.push({ id: 'r3', segs });
  }
  // Rayo 4: al vértice → simétrico
  {
    const hit = { x: 0, y: 0 };
    const slope = yo / d;
    const segs = [
      { a: tip, b: hit, k: 'inc' },
      { a: hit, b: exitPoint(hit, { x: -1, y: -slope }), k: 'ref' },
    ];
    if (xExt > 0) segs.push({ a: hit, b: virtTo(hit, slope, xExt), k: 'virt' });
    rays.push({ id: 'r4', segs });
  }
  return rays;
}

function arrowHead(x, y, ang, color, size = 10) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(size * 0.6, 0); ctx.lineTo(-size * 0.6, -size * 0.5); ctx.lineTo(-size * 0.35, 0); ctx.lineTo(-size * 0.6, size * 0.5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawRay(ray, frac) {
  const color = COL[ray.id];
  // Longitudes en píxeles para dibujo parcial (animación)
  const segs = ray.segs.map((s) => {
    const ax = X(s.a.x), ay = Y(s.a.y), bx = X(s.b.x), by = Y(s.b.y);
    let len = Math.hypot(bx - ax, by - ay);
    if (s.k === 'ref') len = Math.min(len, 900);
    return { ...s, ax, ay, bx, by, len };
  });
  const total = segs.reduce((a, s) => a + s.len, 0);
  let remaining = frac * total;
  for (const s of segs) {
    if (frac < 1 && remaining <= 0) break;
    const t = frac >= 1 ? 1 : Math.min(1, remaining / (s.len || 1));
    remaining -= s.len;
    let ex = s.ax + (s.bx - s.ax) * t, ey = s.ay + (s.by - s.ay) * t;
    if (s.k === 'ref' && t >= 1) { ex = s.bx; ey = s.by; }
    else if (s.k === 'ref') {
      const fullLen = Math.hypot(s.bx - s.ax, s.by - s.ay);
      const tt = (t * s.len) / (fullLen || 1);
      ex = s.ax + (s.bx - s.ax) * tt; ey = s.ay + (s.by - s.ay) * tt;
    }
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    if (s.k === 'inc' || s.k === 'ref') {
      ctx.lineWidth = 2.4;
      ctx.shadowColor = color; ctx.shadowBlur = 4;
    } else if (s.k === 'virt') {
      ctx.lineWidth = 1.7; ctx.setLineDash([8, 6]); ctx.globalAlpha = 0.85;
    } else {
      ctx.lineWidth = 1.4; ctx.setLineDash([2, 5]); ctx.globalAlpha = 0.65;
    }
    ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.restore();
    // Flechas de dirección
    const ang = Math.atan2(s.by - s.ay, s.bx - s.ax);
    if (s.k === 'inc' && t > 0.55) {
      arrowHead(s.ax + (s.bx - s.ax) * 0.5, s.ay + (s.by - s.ay) * 0.5, ang, color);
    } else if (s.k === 'ref') {
      const dist = Math.min(110, Math.hypot(ex - s.ax, ey - s.ay) * 0.6);
      if (dist > 30) arrowHead(s.ax + Math.cos(ang) * dist, s.ay + Math.sin(ang) * dist, ang, color);
    }
  }
}

function drawPhotons(rays, o) {
  const speed = 110, spacing = 64;
  ctx.save();
  for (const r of rays) {
    const inc = r.segs.find((s) => s.k === 'inc');
    const ref = r.segs.find((s) => s.k === 'ref');
    const pts = [[X(inc.a.x), Y(inc.a.y)], [X(inc.b.x), Y(inc.b.y)], [X(ref.b.x), Y(ref.b.y)]];
    const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    const l2 = Math.min(Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]), 1600);
    const L = l1 + l2;
    const off = (photonT * speed) % spacing;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = COL[r.id]; ctx.shadowBlur = 10;
    for (let dd = off; dd < L; dd += spacing) {
      let x, y;
      if (dd < l1) { const t = dd / l1; x = pts[0][0] + (pts[1][0] - pts[0][0]) * t; y = pts[0][1] + (pts[1][1] - pts[0][1]) * t; }
      else {
        const full = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]) || 1;
        const t = (dd - l1) / full; x = pts[1][0] + (pts[2][0] - pts[1][0]) * t; y = pts[1][1] + (pts[2][1] - pts[1][1]) * t;
      }
      if (x < -10 || x > view.w + 10 || y < -10 || y > view.h + 10) continue;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fillStyle = COL[r.id]; ctx.fill(); ctx.fillStyle = '#fff';
    }
  }
  ctx.restore();
}

/* ---------- Objeto e imagen ---------- */
function poly(points, fill, stroke, lw = 1.5) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function drawShape(kind, bx, h, opt) {
  const s = Math.abs(h);
  const P = (u, v) => [X(bx + u * s), Y(v * h)];
  const isImg = opt.role === 'img', virt = !!opt.virtual;
  ctx.save();
  ctx.globalAlpha = (opt.alpha ?? 1) * (virt ? 0.72 : 1);
  if (virt) ctx.setLineDash([6, 4]);
  if (isImg && !virt) { ctx.shadowColor = 'rgba(8,145,178,0.5)'; ctx.shadowBlur = 10; }

  if (kind === 'flecha') {
    const col = isImg ? COL.img : COL.obj;
    const [x0, y0] = P(0, 0), [x1, y1] = P(0, 0.78);
    ctx.strokeStyle = col; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.setLineDash([]);
    poly([P(0, 1), P(-0.17, 0.72), P(0.17, 0.72)], virt ? 'rgba(8,145,178,0.25)' : col, virt ? col : null, 2);
    if (virt) { ctx.setLineDash([6, 4]); }
  } else if (kind === 'vela') {
    const body = isImg ? (virt ? 'rgba(236,72,153,0.25)' : '#ec4899') : '#f472b6';
    const edge = isImg ? '#9d174d' : '#be185d';
    poly([P(-0.14, 0), P(0.14, 0), P(0.14, 0.66), P(-0.14, 0.66)], body, edge, 1.6);
    poly([P(-0.14, 0.18), P(0.14, 0.22), P(0.14, 0.27), P(-0.14, 0.23)], 'rgba(255,255,255,0.45)', null);
    poly([P(-0.14, 0.42), P(0.14, 0.46), P(0.14, 0.51), P(-0.14, 0.47)], 'rgba(255,255,255,0.45)', null);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    const [wx0, wy0] = P(0, 0.66), [wx1, wy1] = P(0, 0.74);
    ctx.beginPath(); ctx.moveTo(wx0, wy0); ctx.lineTo(wx1, wy1); ctx.stroke();
    // Llama (gota)
    const fl = [];
    for (let i = 0; i <= 32; i++) {
      const t = (i / 32) * Math.PI * 2;
      const u = 0.1 * Math.sin(t) * Math.sin(t / 2);   // gota: punta arriba, base redonda
      const v = 0.875 + 0.125 * Math.cos(t);
      fl.push(P(u, v));
    }
    poly(fl, virt ? 'rgba(251,191,36,0.35)' : '#fbbf24', '#f97316', 1.4);
    poly([P(-0.035, 0.78), P(0.035, 0.78), P(0, 0.9)], '#fff7cc', null);
  } else {
    // Árbol
    const leaf = virt ? 'rgba(22,163,74,0.28)' : isImg ? '#16a34a' : '#22c55e';
    const leafEdge = '#14532d';
    poly([P(-0.06, 0), P(0.06, 0), P(0.06, 0.3), P(-0.06, 0.3)], virt ? 'rgba(146,64,14,0.3)' : '#92400e', '#78350f', 1.4);
    poly([P(-0.32, 0.24), P(0.32, 0.24), P(0, 0.6)], leaf, leafEdge, 1.4);
    poly([P(-0.26, 0.44), P(0.26, 0.44), P(0, 0.8)], leaf, leafEdge, 1.4);
    poly([P(-0.19, 0.64), P(0.19, 0.64), P(0, 1)], leaf, leafEdge, 1.4);
  }
  ctx.restore();
}

function drawObject(o) {
  const bx = -o.d;
  drawShape(state.shape, bx, o.h, { role: 'obj' });
  const tx = X(bx), ty = Y(o.h);
  if (state.mode === 'lab') {
    const active = hoverTarget === 'tip' || (drag && drag.type === 'tip');
    ctx.save();
    ctx.beginPath(); ctx.arc(tx, ty, active ? 11 : 8, 0, Math.PI * 2);
    ctx.fillStyle = active ? 'rgba(249,115,22,0.3)' : 'rgba(249,115,22,0.15)'; ctx.fill();
    ctx.beginPath(); ctx.arc(tx, ty, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.obj; ctx.stroke();
    ctx.restore();
  }
  if (state.labels) {
    pillText('Objeto', tx, ty - 22, '#fff', COL.obj);
    pillText(`h_o = ${fmt(o.h)} cm`, tx, ty - 44, '#9a3412', 'rgba(255,237,213,0.95)');
  }
}

function drawImage(o, c, alpha) {
  const virt = o.di < 0;
  drawShape(state.shape, -o.di, o.hi, { role: 'img', virtual: virt, alpha });
  const tx = X(-o.di), ty = Y(o.hi);
  ctx.save();
  ctx.globalAlpha = alpha;
  // Punto de convergencia
  ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.img; ctx.stroke();
  if (state.labels) {
    const up = o.hi > 0;
    const y1 = up ? ty - 22 : ty + 22, y2 = up ? ty - 44 : ty + 44;
    pillText(virt ? 'Imagen virtual' : 'Imagen real', tx, y1, '#fff', virt ? '#7c3aed' : COL.img);
    pillText(`h_i = ${fmtS(o.hi)} cm`, tx, y2, '#164e63', 'rgba(207,250,254,0.95)');
  }
  ctx.restore();
}

// Texto en "píldora". Admite subíndices con la sintaxis  d_o  →  d con "o" pequeño abajo.
function pillText(text, x, y, color, bg) {
  ctx.save();
  const big = '600 11px Poppins', small = '600 8px Poppins';
  const parts = [];
  text.split(/(_\w)/).forEach((p) => { if (!p) return; parts.push(p[0] === '_' && p.length === 2 ? { t: p[1], sub: true } : { t: p, sub: false }); });
  let tw = 0;
  parts.forEach((p) => { ctx.font = p.sub ? small : big; p.w = ctx.measureText(p.t).width; tw += p.w; });
  const w = tw + 14, h = 20;
  ctx.fillStyle = bg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, 10); else ctx.rect(x - w / 2, y - h / 2, w, h);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let cx = x - tw / 2;
  parts.forEach((p) => { ctx.font = p.sub ? small : big; ctx.fillText(p.t, cx, y + (p.sub ? 4 : 0.5)); cx += p.w; });
  ctx.restore();
}

/* ---------- Cotas ---------- */
function dimLine(x1, x2, y, label, color, dashed) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.4;
  // Líneas de referencia verticales hasta el eje
  ctx.setLineDash([2, 3]); ctx.globalAlpha = 0.6;
  const ay = Y(0);
  ctx.beginPath(); ctx.moveTo(x1, ay); ctx.lineTo(x1, y + 6); ctx.moveTo(x2, ay); ctx.lineTo(x2, y + 6); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.setLineDash(dashed ? [6, 4] : []);
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.setLineDash([]);
  const dir = x2 > x1 ? 1 : -1;
  if (Math.abs(x2 - x1) > 16) {
    arrowHead(x1 + dir * 4, y, dir > 0 ? Math.PI : 0, color, 9);
    arrowHead(x2 - dir * 4, y, dir > 0 ? 0 : Math.PI, color, 9);
  }
  ctx.restore();
  const cx = clamp((x1 + x2) / 2, 70, view.w - 70);
  pillText(label, cx, y, '#fff', color);
}

function drawDims(o, showSol) {
  let yb = Y(0) + 40;
  if (showSol && !o.inf && o.hi < 0) yb = Math.max(yb, Y(o.hi) + 30);
  yb = Math.min(yb, view.h - 78);
  dimLine(X(-o.d), X(0), yb, `d_o = ${fmt(o.d)} cm`, '#ea580c');
  if (showSol && !o.inf && Math.abs(o.di) < 5000) {
    dimLine(X(-o.di), X(0), yb + 26, `d_i = ${fmtS(o.di)} cm`, o.di > 0 ? COL.img : '#7c3aed', o.di < 0);
  }
}

function drawInfNote() {
  pillText('⚠ Objeto en el foco: los rayos reflejados salen paralelos → la imagen se forma en el infinito', view.w / 2, 92, '#fff', '#be123c');
}

function drawHover() {
  if (!hover || drag || state.mode === 'teoria') return;
  const [px, py] = hover;
  const x = WX(px), y = WY(py);
  ctx.save();
  ctx.strokeStyle = 'rgba(30,35,60,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(px + 0.5, 0); ctx.lineTo(px + 0.5, view.h); ctx.moveTo(0, py + 0.5); ctx.lineTo(view.w, py + 0.5); ctx.stroke();
  ctx.restore();
  const txt = `${fmt(Math.abs(x), 1)} cm ${x < 0 ? 'frente' : 'detrás'} · altura ${fmtS(y, 1)} cm`;
  ctx.save();
  ctx.font = '600 11px "JetBrains Mono"';
  const w = ctx.measureText(txt).width + 16;
  const bx = px + 14 + w > view.w ? px - w - 14 : px + 14;
  const by = py + 30 > view.h ? py - 34 : py + 12;
  ctx.fillStyle = 'rgba(20,24,54,0.88)';
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, w, 22, 8); else ctx.rect(bx, by, w, 22); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, bx + 8, by + 11.5);
  ctx.restore();
}

/* ---------- Render principal ---------- */
function render() {
  if (!view.w || state.mode === 'teoria') return;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const o = optics(), c = classify(o);
  drawPaper();
  drawAxis();

  const rays = buildRays(o);
  const enabled = rays.filter((r) => state.rays[r.id]);
  let Hm = Math.max(o.h * 1.25, 3);
  if (!state.hide || state.hint) enabled.forEach((r) => { const inc = r.segs.find((s) => s.k === 'inc'); Hm = Math.max(Hm, Math.abs(inc.b.y) * 1.08 + 0.5); });
  if (!state.hide && !o.inf) Hm = Math.max(Hm, Math.abs(o.hi) * 1.05);
  const viewHalf = Math.max(Math.abs(WY(0)), Math.abs(WY(view.h)));
  Hm = Math.min(Hm, viewHalf + 1);
  drawMirror(o, Hm);
  drawPoints(o);

  const showRays = !state.hide || state.hint;
  const n = enabled.length;
  const tracing = traceT < n + 1;
  if (showRays) enabled.forEach((r, i) => drawRay(r, tracing ? clamp(traceT - i, 0, 1) : 1));
  drawObject(o);
  if (!state.hide && !o.inf) {
    const a = tracing ? clamp((traceT - n) / 0.8, 0, 1) : 1;
    if (a > 0) drawImage(o, c, a);
  }
  if (state.dims) drawDims(o, !state.hide);
  if (showRays && state.photons && !tracing) drawPhotons(enabled, o);
  if (o.inf && !state.hide) drawInfNote();
  drawHover();
}

function loop(t) {
  const dt = Math.min(0.05, (t - lastTime) / 1000);
  lastTime = t;
  photonT += dt;
  if (traceT < 50) traceT += dt * 0.85;
  render();
  requestAnimationFrame(loop);
}

/* ---------------- Paneles HTML ---------------- */
function step(n, title, body) {
  return `<div class="step"><div class="step-n">${n}</div><div class="step-body"><h3>${title}</h3>${body}</div></div>`;
}

function mmText(x) {
  const a = round(Math.abs(x), 2);
  const cm = Math.floor(a + 1e-9);
  const mm = round((a - cm) * 10, 1);
  return `<b>${cm}</b> cuadros grandes (cm) y <b>${fmt(mm, 1)}</b> mm`;
}

function renderCalc(o, c) {
  const el = $('#calcPanel');
  if (state.hide) {
    el.innerHTML = `<div class="locked-msg"> Los cálculos paso a paso aparecerán cuando compruebes tu respuesta.</div>`;
    return;
  }
  const f = o.f, d = o.d, h = o.h;
  const invF = 1 / f, invD = 1 / d, invDi = invF - invD;
  const di = '<span><i>d</i><sub>i</sub></span>', dO = '<span><i>d</i><sub>o</sub></span>';
  let html = `<h2 class="panel-title"> Cálculos paso a paso</h2>`;
  html += `<div class="sign-box"><b>Convención de signos:</b> f &gt; 0 cóncavo · f &lt; 0 convexo · d<sub>i</sub> &gt; 0 imagen real · d<sub>i</sub> &lt; 0 imagen virtual · h<sub>i</sub> &gt; 0 derecha · h<sub>i</sub> &lt; 0 invertida.</div>`;

  html += step(1, 'Datos del problema', `
    <div class="data-grid">
      <div><span>f (distancia focal)</span><b>${fmtS(f)} cm</b><small>${f > 0 ? 'cóncavo → f positivo' : 'convexo → f negativo'}</small></div>
      <div><span>R = 2f</span><b>${fmtS(2 * f)} cm</b></div>
      <div><span>d<sub>o</sub> (distancia objeto)</span><b>${fmt(d)} cm</b></div>
      <div><span>h<sub>o</sub> (altura objeto)</span><b>${fmt(h)} cm</b></div>
    </div>`);

  html += step(2, 'Ecuación de los espejos', `
    <div class="eq">${frac('1', 'f')} = ${frac('1', dO)} + ${frac('1', di)}</div>
    <p>Despejamos el término de la imagen:</p>
    <div class="eq">${frac('1', di)} = ${frac('1', 'f')} − ${frac('1', dO)}</div>`);

  html += step(3, 'Sustituimos los valores', `
    <div class="eq">${frac('1', di)} = ${frac('1', par(f))} − ${frac('1', fmt(d))}</div>
    <div class="eq">${frac('1', di)} = ${fmt(invF, 4)} − ${fmt(invD, 4)} = <b>${fmt(invDi, 4)}</b> cm⁻¹</div>`);

  if (o.inf) {
    html += step(4, 'Distancia de la imagen', `
      <div class="eq">${frac('1', di)} = 0 &nbsp;⟹&nbsp; ${di} → ∞</div>
      <div class="inf-box">El objeto está exactamente en el <b>foco</b>. Los rayos reflejados salen <b>paralelos</b> y nunca se cortan: <b>no se forma imagen</b> (se forma "en el infinito"). Así funcionan las linternas y los faros. 🔦</div>`);
    el.innerHTML = html;
    return;
  }

  html += step(4, 'Distancia de la imagen', `
    <div class="eq">${di} = ${frac('1', fmt(invDi, 4))} ≈ <span class="hl">${fmtS(o.di)} cm</span></div>
    <p class="alt">Con la fórmula despejada: ${di} = ${frac('f · d<sub>o</sub>', 'd<sub>o</sub> − f')} = ${frac(`${par(f)} · ${fmt(d)}`, `${fmt(d)} − ${par(f)}`)} = ${frac(fmt(f * d), fmt(d - f))} = <b>${fmtS(o.di)} cm</b></p>
    <div class="ruler-note"> En la hoja milimetrada: la imagen está a ${mmText(o.di)} ${o.di > 0 ? '<b>frente al</b>' : '<b>detrás del</b>'} espejo.</div>`);

  html += step(5, 'Aumento lateral', `
    <div class="eq">m = − ${frac(di, dO)} = − ${frac(par(o.di), fmt(d))} = <span class="hl">${fmtS(o.m, 3)}</span></div>
    <p>La imagen mide ${fmt(Math.abs(o.m), 3)} veces la altura del objeto.</p>`);

  html += step(6, 'Altura de la imagen', `
    <div class="eq">h<sub>i</sub> = m · h<sub>o</sub> = ${par(o.m, 3)} · ${fmt(h)} = <span class="hl">${fmtS(o.hi)} cm</span></div>
    <div class="ruler-note"> Mide en la hoja: ${mmText(o.hi)} ${o.hi > 0 ? 'por encima' : 'por debajo'} del eje.</div>`);

  const am = Math.abs(o.m);
  html += step(7, 'Interpretación de los resultados', `
    <ul class="concl">
      <li><span>d<sub>i</sub> ${o.di > 0 ? '&gt;' : '&lt;'} 0</span><b style="color:${o.di > 0 ? '#7dffb8' : '#c9a7ff'}">${c.nat}</b></li>
      <li><span>m ${o.m < 0 ? '&lt;' : '&gt;'} 0</span><b>${c.ori}</b></li>
      <li><span>|m| = ${fmt(am, 3)} ${c.tam === 'Mayor' ? '&gt;' : c.tam === 'Menor' ? '&lt;' : '='} 1</span><b>${c.tam}</b></li>
      <li><span>Ubicación</span><b>${c.imgPos}</b></li>
    </ul>
    <p>${c.real ? 'Es <b>real</b>: los rayos reflejados se cortan de verdad, por eso se podría proyectar en una pantalla.' : 'Es <b>virtual</b>: se cortan las prolongaciones de los rayos detrás del espejo; solo se ve al mirar el espejo.'}</p>
    <div class="verify">✔ Verificación: 1/d<sub>o</sub> + 1/d<sub>i</sub> = ${fmt(invD, 4)} + ${fmt(1 / o.di, 4)} = ${fmt(invD + 1 / o.di, 4)} = 1/f</div>`);

  el.innerHTML = html;
}

function renderCases(c) {
  const el = $('#casesPanel');
  const rows = CASES.map((k) => `
    <tr data-case="${k.id}" class="${!state.hide && k.id === c.caso ? 'active' : ''}">
      <td>${k.id}</td><td>${k.esp}</td><td>${k.obj}</td><td>${k.img}</td><td>${k.car}</td>
    </tr>`).join('');
  el.innerHTML = `<h2 class="panel-title">Casos de formación de imágenes</h2>
    <table class="cases"><thead><tr><th>#</th><th>Espejo</th><th>Objeto</th><th>Imagen</th><th>Características</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="tip" style="margin:6px 4px"> Toca una fila para cargar ese caso en el laboratorio.</p>`;
}

function renderStrip(o, c) {
  const el = $('#resultStrip');
  const concave = o.f > 0;
  const q = state.hide;
  const b = (ico, lbl, val, cls = '') => `<div class="badge ${cls}"><span class="ico">${ico}</span><div><small>${lbl}</small><b>${val}</b></div></div>`;
  let html = b('', 'Espejo', concave ? 'Cóncavo' : 'Convexo');
  html += b('', 'Objeto', c.objPos);
  if (q) {
    html += b('', 'Naturaleza', '?', 'q') + b('↕', 'Orientación', '?', 'q') + b('', 'Tamaño', '?', 'q') + b('✖️', 'Aumento', '?', 'q');
    html += `<div class="summary"> <b>Modo reto:</b> calcula la imagen y responde en el panel derecho. ¡Tú puedes!</div>`;
  } else if (o.inf) {
    html += b('', 'Naturaleza', 'No se forma', 'q') + b('↕', 'Orientación', '—') + b('', 'Tamaño', '—') + b('✖️', 'Aumento', '∞');
    html += `<div class="summary">🔦 El objeto está en el foco: los rayos reflejados son <b>paralelos</b> y la imagen <b>no se forma</b> (está en el infinito).</div>`;
  } else {
    const cls = c.real ? 'real' : 'virtual';
    html += b('', 'Naturaleza', c.nat, cls) + b('↕', 'Orientación', c.ori) + b('', 'Tamaño', c.tam) + b('✖️', 'Aumento', `m = ${fmtS(o.m, 3)}`);
    html += `<div class="summary">✨ Caso ${c.caso}: la imagen es <b>${c.nat.toUpperCase()}</b>, <b>${c.ori.toUpperCase()}</b> y <b>${c.tam.toUpperCase()}</b> que el objeto, ubicada a <b>${fmt(Math.abs(o.di))} cm</b> ${o.di > 0 ? 'frente al' : 'detrás del'} espejo (${c.imgPos}).</div>`;
  }
  el.innerHTML = html;
}

function updatePanels() {
  const o = optics(), c = classify(o);
  renderCalc(o, c);
  renderCases(c);
  renderStrip(o, c);
  $$('#presets button').forEach((bt) => bt.classList.toggle('active', !state.hide && +bt.dataset.case === c.caso));
}

/* ---------------- Controles ---------------- */
const inputs = {
  fAbs: [$('#fRange'), $('#fNum')],
  d: [$('#dRange'), $('#dNum')],
  ho: [$('#hRange'), $('#hNum')],
};

function syncInputs() {
  for (const k in inputs) {
    const [r, n] = inputs[k];
    r.value = state[k];
    if (document.activeElement !== n) n.value = round(state[k], 2);
  }
  $('#rInfo').textContent = `R = 2f = ${fmt(2 * state.fAbs, 1)} cm`;
  $$('#typeSeg button').forEach((b) => b.classList.toggle('active', b.dataset.type === state.type));
  $$('[data-raytext]').forEach((s) => (s.textContent = RAY_TEXT[state.type][s.dataset.raytext]));
}

let panelTimer = null;
function changed(immediate = true) {
  syncInputs();
  if (immediate) updatePanels();
  else { clearTimeout(panelTimer); panelTimer = setTimeout(updatePanels, 40); }
}

function setParam(k, v, snapTo = null) {
  if (!isFinite(v)) return;
  v = clamp(v, LIM[k][0], LIM[k][1]);
  const n = snapTo ?? (state.snap ? 1 : 2);
  state[k] = round(v, n);
  changed(false);
}

for (const k in inputs) {
  const [r, n] = inputs[k];
  r.addEventListener('input', () => setParam(k, parseFloat(r.value), 2));
  n.addEventListener('input', () => { const v = parseFloat(n.value.replace(',', '.')); if (v >= LIM[k][0]) setParam(k, v, 2); });
  n.addEventListener('change', () => { syncInputs(); });
}

$$('#typeSeg button').forEach((b) => b.addEventListener('click', () => {
  state.type = b.dataset.type; changed(); fitView(); startTrace();
}));
$$('#shapeChips button').forEach((b) => b.addEventListener('click', () => {
  state.shape = b.dataset.shape;
  $$('#shapeChips button').forEach((x) => x.classList.toggle('active', x === b));
}));
$$('#rayToggles input').forEach((i) => i.addEventListener('change', () => { state.rays[i.dataset.ray] = i.checked; }));
$('#optSnap').addEventListener('change', (e) => (state.snap = e.target.checked));
$('#optDims').addEventListener('change', (e) => (state.dims = e.target.checked));
$('#optLabels').addEventListener('change', (e) => (state.labels = e.target.checked));
$('#optPhotons').addEventListener('change', (e) => (state.photons = e.target.checked));

function loadCase(id) {
  if (state.mode !== 'lab') return;
  Object.assign(state, PRESETS[id]);
  changed(); fitView(); startTrace();
}
$$('#presets button').forEach((b) => b.addEventListener('click', () => loadCase(+b.dataset.case)));
$('#casesPanel').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-case]'); if (tr) loadCase(+tr.dataset.case); });

function startTrace() { traceT = 0; }
$('#btnTrace').addEventListener('click', startTrace);
function zoomAt(px, py, factor) {
  const wx = WX(px), wy = WY(py);
  view.scale = clamp(view.scale * factor, 3, 160);
  view.ox = px - wx * view.scale;
  view.oy = py + wy * view.scale;
}
$('#btnZoomIn').addEventListener('click', () => zoomAt(view.w / 2, view.h / 2, 1.25));
$('#btnZoomOut').addEventListener('click', () => zoomAt(view.w / 2, view.h / 2, 0.8));
$('#btnFit').addEventListener('click', fitView);
$('#btnShot').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = `espejo-${state.type}-do${state.d}-f${state.fAbs}.png`;
  a.href = cv.toDataURL('image/png');
  a.click();
});

/* ---------- Interacción con el puntero ---------- */
function pointerPos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

function hitTest(px, py) {
  if (state.mode !== 'lab') return null;
  const o = optics();
  const tx = X(-o.d), ty = Y(o.h);
  if (Math.hypot(px - tx, py - ty) < 15) return 'tip';
  if (Math.hypot(px - X(-o.f), py - Y(0)) < 14) return 'focus';
  const halfW = Math.max(12, 0.3 * o.h * view.scale);
  if (Math.abs(px - tx) < halfW && py <= Y(0) + 6 && py >= ty - 6) return 'body';
  return null;
}

cv.addEventListener('pointerdown', (e) => {
  const [px, py] = pointerPos(e);
  const t = hitTest(px, py);
  cv.setPointerCapture(e.pointerId);
  if (t) drag = { type: t };
  else drag = { type: 'pan', sx: px, sy: py, ox: view.ox, oy: view.oy };
  $('#dragHint').classList.add('fade');
  traceT = Infinity;
});

cv.addEventListener('pointermove', (e) => {
  const [px, py] = pointerPos(e);
  hover = [px, py];
  if (!drag) {
    hoverTarget = hitTest(px, py);
    cv.style.cursor = hoverTarget === 'tip' ? 'move' : hoverTarget ? 'ew-resize' : 'crosshair';
    return;
  }
  if (drag.type === 'pan') {
    view.ox = drag.ox + (px - drag.sx); view.oy = drag.oy + (py - drag.sy);
    cv.style.cursor = 'grabbing';
  } else if (drag.type === 'tip') {
    setParam('d', -WX(px)); setParam('ho', WY(py));
  } else if (drag.type === 'body') {
    setParam('d', -WX(px));
  } else if (drag.type === 'focus') {
    const x = WX(px);
    setParam('fAbs', state.type === 'concavo' ? -x : x);
  }
});

function endDrag() { if (drag && drag.type !== 'pan') updatePanels(); drag = null; }
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('pointerleave', () => { hover = null; hoverTarget = null; });
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [px, py] = pointerPos(e);
  zoomAt(px, py, e.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });

document.addEventListener('keydown', (e) => {
  if (state.mode !== 'lab') return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' && document.activeElement.type !== 'range' && document.activeElement.type !== 'checkbox') return;
  const st = e.shiftKey ? 1 : 0.1;
  const map = { ArrowLeft: ['d', st], ArrowRight: ['d', -st], ArrowUp: ['ho', st], ArrowDown: ['ho', -st] };
  const m = map[e.key];
  if (!m) return;
  e.preventDefault();
  if (document.activeElement && document.activeElement.type === 'range') document.activeElement.blur();
  setParam(m[0], state[m[0]] + m[1], 1);
});

/* ---------------- Modos (pestañas) ---------------- */
function setMode(m) {
  state.mode = m;
  $$('#tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === m));
  $('#theory').hidden = m !== 'teoria';
  $('#layout').hidden = m === 'teoria';
  $('#controls').classList.toggle('locked', m === 'reto');
  $('#quizPanel').hidden = m !== 'reto';
  if (m === 'reto') newChallenge();
  else if (m === 'lab') { state.hide = false; state.hint = false; changed(); }
  requestAnimationFrame(() => { resize(); });
}
$$('#tabs .tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
$$('[data-goto]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.goto)));

/* ---------------- Reto ---------------- */
const quiz = { score: 0, streak: 0, n: 0, hint: false, answered: false };
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function newChallenge() {
  quiz.n++; quiz.hint = false; quiz.answered = false;
  const concave = Math.random() < 0.72;
  const fAbs = rint(6, 14);
  let d;
  if (concave) {
    const cs = [1, 2, 3, 5][rint(0, 3)];
    if (cs === 1) d = rint(2 * fAbs + 2, Math.round(3.2 * fAbs));
    else if (cs === 2) d = 2 * fAbs;
    else if (cs === 3) d = rint(fAbs + 2, 2 * fAbs - 1);
    else d = rint(2, fAbs - 2);
  } else d = rint(5, 30);
  Object.assign(state, { type: concave ? 'concavo' : 'convexo', fAbs, d, ho: rint(2, 6), hide: true, hint: false });
  changed(); fitView();
  renderQuiz();
}

function renderQuiz() {
  const el = $('#quizPanel');
  const group = (name, t, opts) => `<div class="q-group"><span>${t}</span><div class="pills">${opts.map((o) => `<label class="pill"><input type="radio" name="q_${name}" value="${o}"><span>${o}</span></label>`).join('')}</div></div>`;
  el.innerHTML = `<div class="quiz">
    <div class="quiz-head"><h2 class="panel-title">🎯 Reto #${quiz.n}</h2><div class="streak">🔥 Racha: ${quiz.streak}</div></div>
    <p class="quiz-text">Un objeto de <b>${fmt(state.ho, 1)} cm</b> de altura se coloca a <b>${fmt(state.d, 1)} cm</b> de un <b>espejo ${state.type === 'concavo' ? 'cóncavo' : 'convexo'}</b> cuya distancia focal es <b>${fmt(state.fAbs, 1)} cm</b>.</p>
    <p class="quiz-sub">✏️ Calcula d<sub>i</sub> y h<sub>i</sub> (con su signo) y clasifica la imagen. Puedes usar la hoja milimetrada como apoyo.</p>
    <div class="q-inputs">
      <label><span>d<sub>i</sub> (cm)</span><input id="qDi" type="text" inputmode="decimal" placeholder="ej: 16,67" autocomplete="off"></label>
      <label><span>h<sub>i</sub> (cm)</span><input id="qHi" type="text" inputmode="decimal" placeholder="ej: −3,33" autocomplete="off"></label>
    </div>
    ${group('nat', 'Naturaleza', ['Real', 'Virtual'])}
    ${group('ori', 'Orientación', ['Derecha', 'Invertida'])}
    ${group('tam', 'Tamaño', ['Mayor', 'Menor', 'Igual'])}
    <div class="q-actions">
      <button class="btn" id="qHint" title="Muestra los rayos (resta 10 puntos)">💡 Pista</button>
      <button class="btn primary" id="qCheck">✅ Comprobar</button>
      <button class="btn" id="qNext">➡️ Nuevo</button>
    </div>
    <div id="qFeedback" class="feedback"></div>
  </div>`;
  $('#qHint').onclick = () => { quiz.hint = true; state.hint = true; startTrace(); $('#qHint').disabled = true; };
  $('#qCheck').onclick = checkAnswer;
  $('#qNext').onclick = newChallenge;
}

function parseNum(s) { return parseFloat(String(s).replace('−', '-').replace(',', '.')); }

function checkAnswer() {
  if (quiz.answered) return;
  const o = optics(), c = classify(o);
  const val = (n) => { const r = document.querySelector(`input[name=q_${n}]:checked`); return r ? r.value : null; };
  const aDi = parseNum($('#qDi').value), aHi = parseNum($('#qHi').value);
  const tol = (x) => Math.max(0.1, Math.abs(x) * 0.02);
  const items = [
    ['Distancia d<sub>i</sub>', isFinite(aDi) && Math.abs(aDi - o.di) <= tol(o.di), `${fmtS(o.di)} cm`],
    ['Altura h<sub>i</sub>', isFinite(aHi) && Math.abs(aHi - o.hi) <= tol(o.hi), `${fmtS(o.hi)} cm`],
    ['Naturaleza', val('nat') === c.nat, c.nat],
    ['Orientación', val('ori') === c.ori, c.ori],
    ['Tamaño', val('tam') === c.tam, c.tam],
  ];
  const okCount = items.filter((i) => i[1]).length;
  let pts = okCount * 10 - (quiz.hint ? 10 : 0);
  const perfect = okCount === items.length;
  if (perfect) { quiz.streak++; pts += quiz.streak >= 2 ? 5 * quiz.streak : 0; } else quiz.streak = 0;
  pts = Math.max(0, pts);
  quiz.score += pts;
  quiz.answered = true;
  $('#scoreVal').textContent = quiz.score;
  const pill = $('.score-pill'); pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');

  $('#qFeedback').innerHTML = items.map(([n, ok, sol]) => `<div class="fb ${ok ? 'ok' : 'bad'}"><span>${ok ? '✔' : '✘'} ${n}</span><b>${sol}</b></div>`).join('') +
    `<div class="fb-total">${perfect ? '🏆 ¡Perfecto!' : okCount >= 3 ? '👏 ¡Muy bien!' : '💪 ¡Sigue practicando!'} +${pts} pts</div>`;
  $('#qCheck').disabled = true; $('#qHint').disabled = true;
  state.hide = false; state.hint = false;
  updatePanels(); startTrace();
  if (perfect) confetti();
}

/* ---------------- Confeti ---------------- */
function confetti() {
  const c = $('#confetti'), g = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const colors = ['#7c5cff', '#00d4ff', '#ff4ecd', '#ffd166', '#2ee59d', '#f97316'];
  const parts = Array.from({ length: 180 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 300, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4,
    r: Math.random() * 6 + 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    col: colors[(Math.random() * colors.length) | 0],
  }));
  let frames = 0;
  (function anim() {
    g.clearRect(0, 0, c.width, c.height);
    parts.forEach((p) => {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.col; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore();
    });
    if (++frames < 200) requestAnimationFrame(anim); else g.clearRect(0, 0, c.width, c.height);
  })();
}

/* ---------------- Inicio ---------------- */
// Permite compartir enlaces a un caso concreto: index.html?caso=3  o  ?modo=reto / ?modo=teoria
const params = new URLSearchParams(location.search);
if (PRESETS[params.get('caso')]) Object.assign(state, PRESETS[params.get('caso')]);
new ResizeObserver(() => resize()).observe($('#canvasWrap'));
syncInputs();
updatePanels();
resize();
if (['reto', 'teoria'].includes(params.get('modo'))) setMode(params.get('modo'));
setTimeout(() => $('#dragHint').classList.add('fade'), 9000);
// Al iniciar mostramos todos los rayos e imagen de inmediato; el botón "▶ Trazar rayos" ejecuta la animación paso a paso
requestAnimationFrame(loop);
