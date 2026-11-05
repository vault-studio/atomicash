// Galería de assets: interfaz vanilla (ES module). Sin framework.
const CELL = 128; // px por celda en las miniaturas
const MAX_LOADS = 4; // cargas simultáneas
const DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
const ANIM_ES = {
  run: 'correr',
  idle: 'reposo',
  death: 'muerte',
  hit: 'golpe',
  victory: 'victoria',
  attack: 'ataque',
  move: 'movimiento',
};
const LS_KEY = 'galeria.v1';

const $ = (sel) => document.querySelector(sel);

/** Crea un elemento: h('div', {class: 'x', onclick: fn}, hijos…). */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids) if (kid !== undefined && kid !== null) el.append(kid);
  return el;
}

const state = {
  items: [],
  sections: [],
  byId: new Map(),
  sel: new Set(),
  fmt: 'sheet',
  dir: 'S',
  paused: false,
  onlySel: false,
  search: '',
  section: '',
  newIds: new Set(),
  playing: '',
};

// --- Persistencia ---------------------------------------------------------------------------------
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if (Array.isArray(p.sel)) state.sel = new Set(p.sel.filter((x) => typeof x === 'string'));
    if (p.fmt === 'sheet' || p.fmt === 'frames') state.fmt = p.fmt;
    if (DIRS.includes(p.dir)) state.dir = p.dir;
    state.paused = !!p.paused;
    state.onlySel = !!p.onlySel;
  } catch {
    // almacenamiento no disponible o corrupto
  }
}
function savePrefs() {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        sel: [...state.sel],
        fmt: state.fmt,
        dir: state.dir,
        paused: state.paused,
        onlySel: state.onlySel,
      }),
    );
  } catch {
    // ignorar
  }
}

// --- Utilidades -----------------------------------------------------------------------------------
function fmtSize(n) {
  if (n >= 1048576) return `${(n / 1048576).toFixed(n >= 10485760 ? 0 : 1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
const ver = (it) => `${it.mtime}-${it.size}`;
const urlOf = (it) => `/files/${it.path.split('/').map(encodeURIComponent).join('/')}?v=${ver(it)}`;
function animLabel(name) {
  if (ANIM_ES[name]) return ANIM_ES[name];
  const m = /^(attack|move)_(\d+)$/.exec(name);
  if (m) return `${ANIM_ES[m[1]]} ${m[2]}`;
  return name;
}
const displayName = (it) => (it.kind === 'animation' ? animLabel(it.name) : it.name);
function cellOf(it) {
  const m = it.meta || {};
  if (it.kind === 'animation')
    return { cw: m.cell[0], ch: m.cell[1], cols: m.frames, rows: m.directions.length };
  return { cw: m.w, ch: m.h, cols: m.frames, rows: 1 };
}
const dirRow = (it) => {
  const i = it.kind === 'animation' ? it.meta.directions.indexOf(state.dir) : 0;
  return i < 0 ? 0 : i;
};

// --- Miniaturas: cola, observer y un único bucle rAF ----------------------------------------------
const recs = [];
const queue = [];
const players = new Set();
let active = 0;
let clock = 0;
let lastT = performance.now();

const observer = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const rec = e.target._rec;
      if (!rec) continue;
      if (e.isIntersecting) request(rec);
      else release(rec);
    }
  },
  { rootMargin: '300px' },
);

function request(rec) {
  if (rec.state === 'idle') {
    rec.state = 'queued';
    queue.push(rec);
    pump();
  } else if (rec.state === 'loading') rec.cancelled = false;
}
function release(rec) {
  if (rec.state === 'queued') {
    queue.splice(queue.indexOf(rec), 1);
    rec.state = 'idle';
  } else if (rec.state === 'loading') rec.cancelled = true;
  else if (rec.state === 'ready' && rec.player) {
    players.delete(rec.player);
    rec.player.bm.close();
    rec.player = null;
    rec.state = 'idle';
  }
}
function pump() {
  while (active < MAX_LOADS && queue.length) load(queue.shift());
}

async function load(rec) {
  active++;
  rec.state = 'loading';
  rec.cancelled = false;
  const it = rec.item;
  let bm = null;
  try {
    const res = await fetch(urlOf(it));
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const animated = it.kind === 'animation' || it.kind === 'strip';
    if (animated) {
      const { cw, ch, cols, rows } = cellOf(it);
      const s = Math.min(1, CELL / Math.max(cw, ch));
      bm = await createImageBitmap(blob, {
        resizeWidth: Math.max(1, Math.round(cols * cw * s)),
        resizeHeight: Math.max(1, Math.round(rows * ch * s)),
        resizeQuality: 'medium',
      });
    } else {
      bm = await createImageBitmap(blob, { resizeWidth: CELL * 2, resizeQuality: 'medium' });
    }
    if (rec.dead || rec.cancelled) {
      bm.close();
      rec.state = 'idle';
    } else if (animated) {
      const { cw, ch, cols, rows } = cellOf(it);
      rec.player = { rec, bm, cw, ch, cols, rows, fps: (it.meta && it.meta.fps) || 10, last: -1 };
      players.add(rec.player);
      rec.state = 'ready';
    } else {
      drawContain(rec.ctx, bm, 0, 0, bm.width, bm.height);
      bm.close();
      rec.state = 'done';
    }
  } catch {
    if (bm) bm.close();
    rec.state = 'error';
    if (!rec.dead) rec.canvas.title = 'No se pudo cargar';
  }
  active--;
  pump();
}

function drawContain(ctx, bm, sx, sy, sw, sh) {
  const W = ctx.canvas.width;
  const k = Math.min(W / sw, W / sh);
  const dw = sw * k;
  const dh = sh * k;
  ctx.clearRect(0, 0, W, W);
  ctx.drawImage(bm, sx, sy, sw, sh, (W - dw) / 2, (W - dh) / 2, dw, dh);
}

function drawPlayer(p, frame, row) {
  const rx = p.bm.width / (p.cols * p.cw);
  const ry = p.bm.height / (p.rows * p.ch);
  drawContain(
    p.rec.ctx,
    p.bm,
    frame * p.cw * rx,
    Math.min(row, p.rows - 1) * p.ch * ry,
    p.cw * rx,
    p.ch * ry,
  );
}

function rafLoop(now) {
  const dt = Math.min(now - lastT, 250);
  lastT = now;
  if (!state.paused) clock += dt;
  for (const p of players) {
    const frame = Math.floor((clock / 1000) * p.fps) % p.cols;
    const row = dirRow(p.rec.item);
    const key = frame * 16 + row;
    if (key !== p.last) {
      p.last = key;
      drawPlayer(p, frame, row);
    }
  }
  requestAnimationFrame(rafLoop);
}

function teardownThumbs() {
  observer.disconnect();
  queue.length = 0;
  for (const rec of recs) {
    rec.dead = true;
    if (rec.player) rec.player.bm.close();
    rec.player = null;
  }
  recs.length = 0;
  players.clear();
}

function makeThumb(it) {
  const canvas = h('canvas', { width: CELL, height: CELL });
  const rec = {
    item: it,
    canvas,
    ctx: canvas.getContext('2d'),
    state: 'idle',
    cancelled: false,
    dead: false,
    player: null,
  };
  canvas._rec = rec;
  recs.push(rec);
  observer.observe(canvas);
  return canvas;
}

// --- Filtros y render -----------------------------------------------------------------------------
function visibleItems() {
  const q = state.search.trim().toLowerCase();
  return state.items.filter((it) => {
    if (state.section && it.section !== state.section) return false;
    if (state.onlySel && !state.sel.has(it.id)) return false;
    if (q && !`${it.name} ${displayName(it)} ${it.group} ${it.path}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

const itemEls = new Map(); // id -> [{el, cb}]
const checkRefs = []; // {cb, ids}
const audioBtns = new Map();

function buildCard(it) {
  const cb = h('input', { type: 'checkbox', 'aria-label': 'marcar' });
  cb.checked = state.sel.has(it.id);
  cb.addEventListener('click', (e) => e.stopPropagation());
  cb.addEventListener('change', () => toggle(it.id, cb.checked));
  const isNew = state.newIds.has(it.id);
  let thumb;
  if (it.kind === 'model') thumb = h('div', { class: 'thumb' }, h('span', { class: 'glyph' }, '3D'));
  else thumb = h('div', { class: 'thumb' }, makeThumb(it));
  let info = fmtSize(it.size);
  if (it.kind === 'animation') info = `${it.meta.frames} fot. × ${it.meta.directions.length} dir.`;
  else if (it.kind === 'strip') info = `${it.meta.frames} fot. · ${fmtSize(it.size)}`;
  const el = h(
    'div',
    { class: 'card', title: it.path, onclick: () => openDetail(it) },
    thumb,
    h('div', { class: 'nm' }, displayName(it)),
    h('div', { class: 'info' }, info),
    h('label', { class: 'cb', onclick: (e) => e.stopPropagation() }, cb),
    isNew ? h('span', { class: 'badge' }, 'nuevo') : null,
  );
  register(it.id, el, cb);
  return el;
}

function buildAudioRow(it) {
  const cb = h('input', { type: 'checkbox', 'aria-label': 'marcar' });
  cb.checked = state.sel.has(it.id);
  cb.addEventListener('change', () => toggle(it.id, cb.checked));
  const btn = h(
    'button',
    { type: 'button', onclick: () => playAudio(it) },
    state.playing === it.id ? '■' : '▶',
  );
  audioBtns.set(it.id, btn);
  const el = h(
    'div',
    { class: 'arow', title: it.path },
    cb,
    btn,
    h('span', { class: 'nm', onclick: () => openDetail(it), style: 'cursor:pointer' }, it.name),
    state.newIds.has(it.id) ? h('span', { class: 'badge' }, 'nuevo') : null,
    h('span', { class: 'info' }, fmtSize(it.size)),
  );
  register(it.id, el, cb);
  return el;
}

function register(id, el, cb) {
  if (!itemEls.has(id)) itemEls.set(id, []);
  itemEls.get(id).push({ el, cb });
  el.classList.toggle('checked', cb.checked);
}

function checkAll(label, ids) {
  const cb = h('input', { type: 'checkbox', title: label, 'aria-label': label });
  cb.addEventListener('change', () => {
    for (const id of ids) {
      if (cb.checked) state.sel.add(id);
      else state.sel.delete(id);
    }
    afterSelectionChange();
  });
  checkRefs.push({ cb, ids });
  return cb;
}

function render() {
  const y = window.scrollY;
  teardownThumbs();
  itemEls.clear();
  checkRefs.length = 0;
  audioBtns.clear();
  const main = $('#main');
  main.replaceChildren();
  const vis = visibleItems();
  if (!vis.length) main.append(h('div', { class: 'empty' }, 'Sin resultados.'));
  const bySection = new Map();
  for (const it of vis) {
    if (!bySection.has(it.section)) bySection.set(it.section, []);
    bySection.get(it.section).push(it);
  }
  for (const sec of state.sections) {
    const list = bySection.get(sec.id);
    if (!list) continue;
    const head = h(
      'div',
      { class: 'sec-head', id: `sec-${sec.id}` },
      checkAll(
        `Marcar sección ${sec.title}`,
        list.map((i) => i.id),
      ),
      h('h2', null, sec.title),
      sec.auto ? h('span', { class: 'tag' }, '[sección automática]') : null,
      sec.local ? h('span', { class: 'tag' }, '[solo local]') : null,
      h('span', { class: 'tag' }, `${list.length}`),
    );
    main.append(head);
    const groups = new Map();
    for (const it of list) {
      if (!groups.has(it.group)) groups.set(it.group, []);
      groups.get(it.group).push(it);
    }
    for (const [group, gl] of groups) {
      main.append(
        h(
          'div',
          { class: 'grp-head' },
          checkAll(
            `Marcar grupo ${group}`,
            gl.map((i) => i.id),
          ),
          h('h3', null, group),
          `${gl.length}`,
        ),
      );
      const audio = gl.every((i) => i.kind === 'audio');
      const box = h('div', { class: audio ? 'audio-list' : 'grid' });
      let sub = null;
      for (const it of gl) {
        if (it.subgroup !== sub && it.subgroup) box.append(h('div', { class: 'sub-head' }, it.subgroup));
        sub = it.subgroup;
        box.append(it.kind === 'audio' ? buildAudioRow(it) : buildCard(it));
      }
      main.append(box);
    }
  }
  refreshChecks();
  renderSide();
  renderTotals(vis);
  window.scrollTo(0, y);
}

function renderSide() {
  const side = $('#side');
  side.replaceChildren(
    h(
      'button',
      { type: 'button', class: state.section ? '' : 'sel', onclick: () => pickSection('') },
      h('span', null, 'Todo'),
      h('small', null, String(state.items.length)),
    ),
    ...state.sections.map((s) =>
      h(
        'button',
        {
          type: 'button',
          class: state.section === s.id ? 'sel' : s.local ? 'local' : '',
          onclick: () => pickSection(s.id),
        },
        h('span', null, s.title),
        h('small', null, String(s.count)),
      ),
    ),
  );
}

function pickSection(id) {
  state.section = state.section === id ? '' : id;
  render();
  window.scrollTo(0, 0);
}

function renderTotals(vis) {
  const total = state.items.reduce((a, i) => a + i.size, 0);
  const shown = vis.length === state.items.length ? '' : `mostrando ${vis.length} · `;
  $('#totals').textContent = `${shown}${state.items.length} elementos · ${fmtSize(total)}`;
}

// --- Selección ------------------------------------------------------------------------------------
function toggle(id, on) {
  if (on) state.sel.add(id);
  else state.sel.delete(id);
  afterSelectionChange();
}
function afterSelectionChange() {
  savePrefs();
  refreshChecks();
  updateBar();
  if (state.onlySel) render();
}
function refreshChecks() {
  for (const [id, refs] of itemEls) {
    const on = state.sel.has(id);
    for (const r of refs) {
      r.cb.checked = on;
      r.el.classList.toggle('checked', on);
    }
  }
  for (const { cb, ids } of checkRefs) {
    const n = ids.filter((id) => state.sel.has(id)).length;
    cb.checked = n > 0 && n === ids.length;
    cb.indeterminate = n > 0 && n < ids.length;
  }
}
function updateBar() {
  const bar = $('#bar');
  bar.hidden = state.sel.size === 0 && !state.onlySel;
  let size = 0;
  for (const id of state.sel) size += state.byId.get(id)?.size ?? 0;
  $('#selinfo').textContent = `${state.sel.size} seleccionados · ≈${fmtSize(size)}`;
  $('#onlysel').checked = state.onlySel;
  $('#fmt').value = state.fmt;
}

// --- Audio ----------------------------------------------------------------------------------------
const audio = new Audio();
audio.addEventListener('ended', () => setPlaying(''));
function setPlaying(id) {
  state.playing = id;
  for (const [bid, btn] of audioBtns) btn.textContent = bid === id ? '■' : '▶';
}
function playAudio(it) {
  if (state.playing === it.id) {
    audio.pause();
    setPlaying('');
    return;
  }
  audio.src = urlOf(it);
  audio.play().catch(() => setPlaying(''));
  setPlaying(it.id);
}

// --- Detalle --------------------------------------------------------------------------------------
let detail = null; // {raf, bm}

function closeDetail() {
  const modal = $('#modal');
  if (modal.hidden) return;
  if (detail) {
    cancelAnimationFrame(detail.raf);
    if (detail.bm) detail.bm.close();
    detail = null;
  }
  modal.querySelectorAll('audio').forEach((a) => a.pause());
  modal.replaceChildren();
  modal.hidden = true;
}

function openDetail(it) {
  closeDetail();
  const modal = $('#modal');
  const dl = h('dl');
  const row = (k, v) => dl.append(h('dt', null, k), h('dd', null, String(v)));
  row('Ruta', it.path);
  row('Peso', fmtSize(it.size));
  const body = h('div', { class: 'dlg' }, h('h2', null, displayName(it)));
  const animated = it.kind === 'animation' || it.kind === 'strip';
  if (animated) {
    const m = it.meta;
    const c = cellOf(it);
    row('Celda', `${c.cw} × ${c.ch}`);
    row('Fotogramas', c.cols);
    if (it.kind === 'animation') {
      row('Direcciones', m.directions.join(' '));
      row('Pivote', m.pivot ? m.pivot.join(', ') : '—');
    }
    const d = {
      raf: 0,
      bm: null,
      fps: m.fps || 10,
      loop: m.loop !== false,
      dir: state.dir,
      t0: performance.now(),
      paused: false,
      tp: 0,
    };
    detail = d;
    const canvas = h('canvas', { width: c.cw, height: c.ch });
    const k = 400 / Math.max(c.cw, c.ch);
    canvas.style.width = `${Math.round(c.cw * k)}px`;
    const ctx = canvas.getContext('2d');
    const fpsIn = h('input', { type: 'number', min: '1', max: '60', value: String(d.fps) });
    fpsIn.addEventListener('input', () => {
      d.fps = Math.max(1, Math.min(60, Number(fpsIn.value) || d.fps));
      d.t0 = performance.now();
    });
    const loopCb = h('input', { type: 'checkbox' });
    loopCb.checked = d.loop;
    loopCb.addEventListener('change', () => {
      d.loop = loopCb.checked;
      d.t0 = performance.now();
    });
    const playBtn = h('button', { type: 'button' }, 'Pausa');
    playBtn.addEventListener('click', () => {
      if (d.paused) {
        d.paused = false;
        d.t0 = performance.now() - d.tp;
      } else {
        d.paused = true;
        d.tp = performance.now() - d.t0;
      }
      playBtn.textContent = d.paused ? 'Reproducir' : 'Pausa';
    });
    body.append(h('div', { class: 'view' }, canvas));
    const controls = h('div', { class: 'row' });
    if (it.kind === 'animation') {
      const btns = DIRS.map((n) =>
        h(
          'button',
          {
            type: 'button',
            class: n === d.dir ? 'on' : '',
            onclick: () => {
              d.dir = n;
              btns.forEach((b) => b.classList.toggle('on', b.textContent === n));
            },
          },
          n,
        ),
      );
      controls.append(...btns);
    }
    controls.append(h('label', null, 'fps ', fpsIn), h('label', null, loopCb, ' bucle'), playBtn);
    body.append(controls, dl);
    fetch(urlOf(it))
      .then((r) => r.blob())
      .then((b) => createImageBitmap(b))
      .then((bm) => {
        if (detail !== d) return bm.close();
        d.bm = bm;
        const rx = bm.width / (c.cols * c.cw);
        const ry = bm.height / (c.rows * c.ch);
        const loop = (now) => {
          const t = d.paused ? d.tp : now - d.t0;
          const n = Math.floor((t / 1000) * d.fps);
          const frame = d.loop ? n % c.cols : Math.min(n, c.cols - 1);
          const r = it.kind === 'animation' ? Math.max(0, m.directions.indexOf(d.dir)) : 0;
          ctx.clearRect(0, 0, c.cw, c.ch);
          ctx.drawImage(bm, frame * c.cw * rx, r * c.ch * ry, c.cw * rx, c.ch * ry, 0, 0, c.cw, c.ch);
          d.raf = requestAnimationFrame(loop);
        };
        d.raf = requestAnimationFrame(loop);
      })
      .catch(() => body.append(h('div', { class: 'empty' }, 'No se pudo cargar la imagen.')));
  } else if (it.kind === 'image') {
    body.append(h('div', { class: 'view' }, h('img', { src: urlOf(it), alt: it.name })), dl);
  } else if (it.kind === 'audio') {
    body.append(h('audio', { controls: true, src: urlOf(it), autoplay: true }), dl);
  } else {
    body.append(dl);
  }
  body.append(
    h('div', { class: 'row' }, h('button', { type: 'button', onclick: closeDetail }, 'Cerrar (Esc)')),
  );
  modal.replaceChildren(body);
  modal.hidden = false;
}

// --- Exportar ZIP ---------------------------------------------------------------------------------
let exporting = null; // AbortController

const zipPathOf = (p) => (p.startsWith('assets/') ? p.slice('assets/'.length) : p);
const dirOf = (p) => p.slice(0, p.lastIndexOf('/'));
const baseOf = (p) => p.slice(p.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
const fetchUrl = (p) => `/files/${p.split('/').map(encodeURIComponent).join('/')}`;

function planExport() {
  const seen = new Set();
  const jobs = [];
  const add = (job) => {
    if (seen.has(job.zip)) return;
    seen.add(job.zip);
    jobs.push(job);
  };
  const sidecars = [];
  const cutting = state.fmt === 'frames';
  for (const it of state.items) {
    if (!state.sel.has(it.id)) continue;
    const zp = zipPathOf(it.path);
    if (cutting && (it.kind === 'animation' || it.kind === 'strip')) {
      const base = baseOf(it.path);
      const folder = zipPathOf(dirOf(it.path));
      const prefix = `${folder}/${base}`;
      // el marcador evita colisiones; el recorte genera varias rutas, se comprueban al escribir
      add({ type: 'cut', zip: `${prefix}/`, item: it, prefix, base });
    } else {
      add({ type: 'copy', zip: zp, path: it.path });
    }
    for (const s of it.sidecars) sidecars.push(s);
  }
  for (const s of sidecars) add({ type: 'copy', zip: zipPathOf(s), path: s });
  return jobs;
}

function setProgress(done, total, text) {
  $('#progress').hidden = false;
  $('#pbar').max = total;
  $('#pbar').value = done;
  $('#ptext').textContent = text || `${done} / ${total} archivos`;
}

async function runExport() {
  if (exporting || !state.sel.size) return;
  const errBox = $('#exporterr');
  errBox.hidden = true;
  const ctrl = new AbortController();
  exporting = ctrl;
  $('#cancel').hidden = false;
  $('#export').disabled = true;
  try {
    const { Zip, ZipPassThrough } = await import('/vendor/fflate.js');
    const jobs = planExport();
    const chunks = [];
    const written = new Set();
    let finish;
    const finished = new Promise((resolve, reject) => {
      finish = { resolve, reject };
    });
    const zip = new Zip((err, chunk, final) => {
      if (err) return finish.reject(err);
      chunks.push(chunk);
      if (final) finish.resolve();
    });
    const check = () => {
      if (ctrl.signal.aborted) throw new DOMException('Cancelado', 'AbortError');
    };
    const addBytes = (name, bytes) => {
      if (written.has(name)) return;
      written.add(name);
      const f = new ZipPassThrough(name);
      zip.add(f);
      f.push(bytes, true);
    };
    const addFetched = async (name, path) => {
      if (written.has(name)) return;
      written.add(name);
      const res = await fetch(fetchUrl(path), { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error(`${res.status} ${path}`);
      const f = new ZipPassThrough(name);
      zip.add(f);
      if (res.body) {
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          f.push(value, false);
        }
        f.push(new Uint8Array(0), true);
      } else f.push(new Uint8Array(await res.arrayBuffer()), true);
    };
    const addCut = async (job) => {
      const it = job.item;
      const res = await fetch(fetchUrl(it.path), { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error(`${res.status} ${it.path}`);
      const bm = await createImageBitmap(await res.blob());
      try {
        const cols = it.meta.frames;
        const dirs = it.kind === 'animation' ? it.meta.directions : [null];
        const cw = Math.floor(bm.width / cols);
        const ch = Math.floor(bm.height / dirs.length);
        const canvas = new OffscreenCanvas(cw, ch);
        const ctx = canvas.getContext('2d');
        for (let r = 0; r < dirs.length; r++) {
          for (let c = 0; c < cols; c++) {
            check();
            ctx.clearRect(0, 0, cw, ch);
            ctx.drawImage(bm, c * cw, r * ch, cw, ch, 0, 0, cw, ch);
            const png = await canvas.convertToBlob({ type: 'image/png' });
            const nn = String(c).padStart(2, '0');
            const name = dirs[r]
              ? `${job.prefix}/${dirs[r]}/${job.base}_${dirs[r]}_${nn}.png`
              : `${job.prefix}/${job.base}_${nn}.png`;
            addBytes(name, new Uint8Array(await png.arrayBuffer()));
          }
        }
      } finally {
        bm.close();
      }
    };

    let done = 0;
    setProgress(0, jobs.length);
    for (const job of jobs) {
      check();
      if (job.type === 'cut') await addCut(job);
      else await addFetched(job.zip, job.path);
      setProgress(++done, jobs.length);
    }
    zip.end();
    await finished;
    const blob = new Blob(chunks, { type: 'application/zip' });
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `atomic-ash-assets-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`;
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 120000);
    setProgress(jobs.length, jobs.length, `Listo: ${written.size} archivos · ${fmtSize(blob.size)}`);
  } catch (e) {
    if (e && e.name === 'AbortError') setProgress(0, 1, 'Exportación cancelada');
    else {
      errBox.textContent = `Error al exportar: ${e && e.message ? e.message : e}`;
      errBox.hidden = false;
      $('#progress').hidden = true;
    }
  } finally {
    exporting = null;
    $('#cancel').hidden = true;
    $('#export').disabled = false;
  }
}

// --- Catálogo y actualización en vivo -------------------------------------------------------------
let refreshing = false;
let pending = false;
let first = true;
let noticeTimer;

function showNotice(text) {
  const n = $('#notice');
  n.textContent = text;
  n.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (n.hidden = true), 10000);
}

async function refreshCatalog() {
  if (refreshing) {
    pending = true;
    return;
  }
  refreshing = true;
  try {
    const res = await fetch('/api/catalog', { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const cat = await res.json();
    const oldIds = state.byId;
    const byId = new Map(cat.items.map((i) => [i.id, i]));
    if (!first) {
      let added = 0;
      let removed = 0;
      for (const id of byId.keys()) {
        if (!oldIds.has(id)) {
          added++;
          state.newIds.add(id);
        }
      }
      for (const id of oldIds.keys()) if (!byId.has(id)) removed++;
      if (added || removed) showNotice(`+${added} nuevos / −${removed} eliminados`);
    }
    first = false;
    state.items = cat.items;
    state.sections = cat.sections;
    state.byId = byId;
    for (const id of [...state.sel]) if (!byId.has(id)) state.sel.delete(id);
    for (const id of [...state.newIds]) if (!byId.has(id)) state.newIds.delete(id);
    if (state.section && !cat.sections.some((s) => s.id === state.section)) state.section = '';
    savePrefs();
    render();
    updateBar();
  } catch (e) {
    showNotice(`No se pudo leer el catálogo: ${e && e.message ? e.message : e}`);
  } finally {
    refreshing = false;
    if (pending) {
      pending = false;
      refreshCatalog();
    }
  }
}

// --- Arranque -------------------------------------------------------------------------------------
function init() {
  loadPrefs();
  const dirsBox = $('#dirs');
  const dirBtns = DIRS.map((n) =>
    h(
      'button',
      {
        type: 'button',
        class: n === state.dir ? 'on' : '',
        onclick: () => {
          state.dir = n;
          dirBtns.forEach((b) => b.classList.toggle('on', b.textContent === n));
          savePrefs();
        },
      },
      n,
    ),
  );
  dirsBox.append(...dirBtns);

  const pause = $('#pause');
  const syncPause = () => {
    pause.textContent = state.paused ? 'Reanudar animaciones' : 'Pausar animaciones';
    pause.classList.toggle('on', state.paused);
  };
  pause.addEventListener('click', () => {
    state.paused = !state.paused;
    syncPause();
    savePrefs();
  });
  syncPause();

  let st;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(st);
    st = setTimeout(() => {
      state.search = e.target.value;
      render();
    }, 150);
  });
  $('#onlysel').addEventListener('change', (e) => {
    state.onlySel = e.target.checked;
    savePrefs();
    updateBar();
    render();
  });
  $('#clear').addEventListener('click', () => {
    state.sel.clear();
    afterSelectionChange();
    render();
  });
  $('#fmt').addEventListener('change', (e) => {
    state.fmt = e.target.value;
    savePrefs();
  });
  $('#export').addEventListener('click', runExport);
  $('#cancel').addEventListener('click', () => exporting && exporting.abort());
  $('#notice').addEventListener('click', () => ($('#notice').hidden = true));
  $('#modal').addEventListener('click', (e) => {
    if (e.target === $('#modal')) closeDetail();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetail();
  });

  requestAnimationFrame(rafLoop);
  refreshCatalog();
  const es = new EventSource('/api/events');
  es.addEventListener('changed', refreshCatalog);
  let wasOpen = false;
  es.addEventListener('open', () => {
    if (wasOpen) refreshCatalog();
    wasOpen = true;
  });
}

init();
