// Ferramentas: seleção, preenchimento por área/repetição, pincel, paredes, sala, carimbo, luz, régua, borracha
(function () {
  const FM = window.FM, S = FM.state, O = FM.opts, D2R = Math.PI / 180;
  const T = FM.tools = { defs: {}, wall: [], measure: null };
  let drag = null, hover = { x: 0, y: 0 }, space = false, panning = null;
  const cell = () => S.project.map.cell;
  const ptr = e => { const r = FM.canvas.getBoundingClientRect(); return FM.toWorld(e.clientX - r.left, e.clientY - r.top); };
  const sp = (p, e) => (e && e.altKey) ? p : FM.snapP(p);
  const toast = m => FM.ui.toast(m);
  const mkFill = (x, y, w, h, asset, tw, th, layer) => FM.addItem({ type: 'fill', layer, asset, x, y, w, h, tw, th, rot: 0, opacity: 1 });

  // ===== SELECIONAR =====
  T.defs.select = {
    cursor: 'default',
    down(p, e) {
      const its = FM.selItems();
      if (its.length === 1 && FM.isXf(its[0])) { const h = FM.hitHandle(its[0], p); if (h) { drag = { mode: h === 'rot' ? 'rotate' : 'resize', h, it: its[0], orig: FM.clone(its[0]) }; return; } }
      if (its.length === 1 && its[0].type === 'wall') { const w = its[0], r = 8 / S.view.zoom, i = w.points.findIndex(q => Math.hypot(q[0] - p.x, q[1] - p.y) <= r); if (i >= 0) { T.vsel = { id: w.id, i }; drag = { mode: 'vertex', it: w, i, moved: false, orig: FM.clone(w) }; FM.requestRender(); return; } }
      T.vsel = null;
      const hit = FM.hit(p);
      if (hit) {
        if (e.shiftKey) { const grp = FM.expand([hit.id]); FM.setSel(S.sel.includes(hit.id) ? S.sel.filter(i => !grp.includes(i)) : [...S.sel, ...grp]); if (!S.sel.includes(hit.id)) return; }
        else if (!S.sel.includes(hit.id)) FM.setSel([hit.id]);
        const orig = {}; FM.selItems().forEach(i => { orig[i.id] = FM.clone(i); });
        FM.selItems().forEach(w => { if (w.type === 'wall') S.project.items.forEach(d => { if (d.type === 'door' && d.wall === w.id && !orig[d.id]) orig[d.id] = FM.clone(d); }); }); // portas acompanham a parede
        drag = { mode: 'move', start: p, orig, moved: false };
      } else { if (!e.shiftKey) FM.setSel([]); drag = { mode: 'marquee', start: p, cur: p, base: e.shiftKey ? S.sel.slice() : [] }; }
    },
    move(p, e) {
      if (!drag) { const its = FM.selItems(); let c = 'default'; if (its.length === 1 && FM.isXf(its[0])) { const h = FM.hitHandle(its[0], p); if (h) c = h === 'rot' ? 'grab' : ({ nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' })[h]; } if (c === 'default' && FM.hit(p)) c = 'move'; FM.canvas.style.cursor = c; return; }
      if (drag.mode === 'move') {
        let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if (!drag.moved) { if (Math.hypot(dx, dy) * S.view.zoom < 3) return; drag.moved = true; }
        const ids = Object.keys(drag.orig), o0 = drag.orig[ids[0]];
        if (O.snap !== 'off' && !e.altKey && FM.isHex()) { const b = FM.bbox(o0), c0 = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, t = FM.nearestHex({ x: c0.x + dx, y: c0.y + dy }); dx = t.x - c0.x; dy = t.y - c0.y; }
        else if (O.snap !== 'off' && !e.altKey) { const ref = o0.type === 'wall' ? { x: o0.points[0][0], y: o0.points[0][1] } : { x: o0.x, y: o0.y }; dx = FM.snapV(ref.x + dx) - ref.x; dy = FM.snapV(ref.y + dy) - ref.y; }
        ids.forEach(id => FM.moveItem(FM.itemById(id), drag.orig[id], dx, dy)); FM.requestRender();
      } else if (drag.mode === 'vertex') {
        if (!drag.moved) { if (Math.hypot(p.x - (drag.orig.points[drag.i][0]), p.y - (drag.orig.points[drag.i][1])) * S.view.zoom < 3) return; drag.moved = true; }
        const q = e.altKey ? p : FM.snapP(p); drag.it.points[drag.i] = [q.x, q.y]; FM.requestRender();
      } else if (drag.mode === 'resize') {
        const o = drag.orig, it = drag.it, c = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
        let q = p; if (O.snap !== 'off' && !e.altKey && FM.normRot(o.rot || 0) % 90 === 0) q = FM.snapP(p);
        const l = FM.rotPt(q.x - c.x, q.y - c.y, -(o.rot || 0)), [hx, hy] = FM.HDIR[drag.h], MIN = 8;
        let nw = o.w, nh = o.h; if (hx) nw = Math.max(MIN, (l.x + hx * o.w / 2) * hx); if (hy) nh = Math.max(MIN, (l.y + hy * o.h / 2) * hy);
        const keep = (it.type === 'image') !== !!e.shiftKey; // imagens mantêm proporção (Shift inverte)
        if (hx && hy && keep) { const k = Math.max(nw / o.w, nh / o.h); nw = o.w * k; nh = o.h * k; }
        const wc = FM.rotPt(hx * (nw - o.w) / 2, hy * (nh - o.h) / 2, o.rot || 0);
        it.w = nw; it.h = nh; it.x = c.x + wc.x - nw / 2; it.y = c.y + wc.y - nh / 2; FM.requestRender();
      } else if (drag.mode === 'rotate') {
        const it = drag.it, c = FM.center(it); let a = Math.atan2(p.y - c.y, p.x - c.x) / D2R + 90; if (e.shiftKey || O.snap !== 'off') a = Math.round(a / (e.shiftKey ? 15 : 5)) * (e.shiftKey ? 15 : 5);
        it.rot = FM.normRot(a); FM.requestRender();
      } else if (drag.mode === 'marquee') { drag.cur = p; FM.requestRender(); }
    },
    up() {
      if (!drag) return; const d = drag; drag = null;
      if (d.mode === 'marquee') {
        const x0 = Math.min(d.start.x, d.cur.x), x1 = Math.max(d.start.x, d.cur.x), y0 = Math.min(d.start.y, d.cur.y), y1 = Math.max(d.start.y, d.cur.y), ok = FM.visibleUnlocked();
        if ((x1 - x0) * S.view.zoom > 3 || (y1 - y0) * S.view.zoom > 3) { const ids = S.project.items.filter(i => ok[i.layer] && (b => b.x1 >= x0 && b.x0 <= x1 && b.y1 >= y0 && b.y0 <= y1)(FM.bbox(i))).map(i => i.id); FM.setSel([...new Set([...d.base, ...ids])]); }
        FM.requestRender();
      } else if ((d.mode !== 'move' && d.mode !== 'vertex') || d.moved) FM.commit();
      else FM.requestRender();
    },
    overlay(ctx, px) { if (drag && drag.mode === 'marquee') { ctx.fillStyle = 'rgba(0,179,126,.12)'; ctx.strokeStyle = '#00b37e'; ctx.lineWidth = px; const x = Math.min(drag.start.x, drag.cur.x), y = Math.min(drag.start.y, drag.cur.y), w = Math.abs(drag.cur.x - drag.start.x), h = Math.abs(drag.cur.y - drag.start.y); ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); } }
  };
  T.defs.select.dbl = function (p) {
    const hit = FM.hit(p); if (!hit) return;
    if (hit.type === 'door') { hit.open = !hit.open; FM.commit(); return; }
    if (hit.type === 'wall') {
      const pts = hit.points, n = pts.length; let best = null, bd = 1e18;
      for (let i = 0; i < (hit.closed ? n : n - 1); i++) { const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / l2)), d = Math.hypot(p.x - (a[0] + t * dx), p.y - (a[1] + t * dy)); if (d < bd) { bd = d; best = { i, x: a[0] + t * dx, y: a[1] + t * dy }; } }
      if (best) { const q = O.snap === 'off' ? best : FM.snapP(best); pts.splice(best.i + 1, 0, [q.x, q.y]); T.vsel = { id: hit.id, i: best.i + 1 }; FM.setSel([hit.id]); FM.commit(); }
    }
  };
  T.deleteVertex = () => { const v = T.vsel, w = v && FM.itemById(v.id); if (!w || w.points.length <= 2) { if (w) FM.ui.toast('A parede precisa de ao menos 2 pontos.'); return false; } w.points.splice(v.i, 1); T.vsel = null; FM.commit(); return true; };
  T.defs.pan = { cursor: 'grab', down() { }, move() { }, up() { } };

  // ===== PREENCHER ÁREA (com repetição) =====
  const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });
  function tileSize(r) { // calcula tamanho do tile conforme o modo de repetição
    const c = cell(); if (O.fillMode === 'count') return { tw: r.w / Math.max(0.01, O.rx), th: r.h / Math.max(0.01, O.ry), rx: O.rx, ry: O.ry };
    const t = Math.max(0.05, O.tileCells) * c; return { tw: t, th: t, rx: r.w / t, ry: r.h / t };
  }
  T.defs.fill = {
    cursor: 'crosshair',
    down(p, e) { if (!S.asset.floor) return toast('Escolha um piso na biblioteca (aba Pisos).'); const a = sp(p, e); drag = { start: a, cur: a }; },
    move(p, e) { if (drag) { drag.cur = sp(p, e); FM.requestRender(); } },
    up() {
      if (!drag) return; const r = rectOf(drag.start, drag.cur); drag = null;
      if (r.w < 4 || r.h < 4) return FM.requestRender();
      const L = FM.layerFor('terrain'); if (!L) return; const t = tileSize(r);
      const it = mkFill(r.x, r.y, r.w, r.h, S.asset.floor, t.tw, t.th, L); FM.setSel([it.id]); FM.commit();
    },
    overlay(ctx, px) {
      if (!drag) return; const r = rectOf(drag.start, drag.cur), t = tileSize(r), c = cell(); ctx.fillStyle = 'rgba(0,179,126,.18)'; ctx.strokeStyle = '#00b37e'; ctx.lineWidth = 1.5 * px; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeRect(r.x, r.y, r.w, r.h);
      label(ctx, px, r.x + r.w / 2, r.y + r.h / 2, `${(r.w / c).toFixed(1)} × ${(r.h / c).toFixed(1)} células · ${+t.rx.toFixed(2)} × ${+t.ry.toFixed(2)} repetições`);
    }
  };
  function label(ctx, px, x, y, txt) { ctx.save(); ctx.font = `${12 * px}px Segoe UI, sans-serif`; const w = ctx.measureText(txt).width + 12 * px; ctx.fillStyle = 'rgba(0,0,0,.78)'; ctx.fillRect(x - w / 2, y - 11 * px, w, 22 * px); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y); ctx.restore(); }

  // ===== PINCEL DE CÉLULAS =====
  let brush = null;
  const brushCells = (p) => { const c = cell(), n = O.brush, cx = Math.floor(p.x / c) - Math.floor((n - 1) / 2), cy = Math.floor(p.y / c) - Math.floor((n - 1) / 2), out = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push([cx + i, cy + j]); return out; };
  function inMap(cx, cy) { const m = S.project.map; return cx >= 0 && cy >= 0 && cx < m.cols && cy < m.rows; }
  function brushAdd(p) {
    const a = brush.last || p, steps = Math.max(1, Math.ceil(Math.hypot(p.x - a.x, p.y - a.y) / (cell() / 3)));
    for (let s = 1; s <= steps; s++) { const q = { x: a.x + (p.x - a.x) * s / steps, y: a.y + (p.y - a.y) * s / steps }; brushCells(q).forEach(([x, y]) => { if (inMap(x, y)) brush.cells.add(x + ',' + y); }); }
    brush.last = p;
  }
  T.defs.brush = {
    cursor: 'crosshair',
    down(p) { if (!S.asset.floor) return toast('Escolha um piso na biblioteca (aba Pisos).'); brush = { cells: new Set(), last: null }; brushAdd(p); FM.requestRender(); },
    move(p) { if (brush) { brushAdd(p); FM.requestRender(); } },
    up() {
      if (!brush) return; const cells = [...brush.cells].map(s => s.split(',').map(Number)); brush = null; if (!cells.length) return;
      const L = FM.layerFor('terrain'); if (!L) return FM.requestRender(); const c = cell();
      const rows = {}; cells.forEach(([x, y]) => (rows[y] = rows[y] || []).push(x));
      const open = []; // retângulos abertos para fusão vertical
      Object.keys(rows).map(Number).sort((a, b) => a - b).forEach(y => {
        const xs = rows[y].sort((a, b) => a - b); let i = 0;
        while (i < xs.length) { let j = i; while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++; const x0 = xs[i], len = j - i + 1, o = open.find(r => r.x0 === x0 && r.len === len && r.y1 === y - 1); if (o) o.y1 = y; else open.push({ x0, len, y0: y, y1: y }); i = j + 1; }
      });
      const ids = open.map(r => mkFill(r.x0 * c, r.y0 * c, r.len * c, (r.y1 - r.y0 + 1) * c, S.asset.floor, c, c, L).id); FM.setSel(ids); FM.commit();
    },
    overlay(ctx, px) { const c = cell(); ctx.fillStyle = 'rgba(0,179,126,.25)'; ctx.strokeStyle = '#00b37e'; ctx.lineWidth = px; const draw = (x, y) => { ctx.fillRect(x * c, y * c, c, c); ctx.strokeRect(x * c, y * c, c, c); }; if (brush) brush.cells.forEach(k => { const [x, y] = k.split(',').map(Number); draw(x, y); }); else brushCells(hover).forEach(([x, y]) => { if (inMap(x, y)) draw(x, y); }); }
  };

  // ===== PAREDES (polilinha) =====
  const wallMat = () => O.wallMat === 'tex' && S.asset.wall ? { asset: S.asset.wall } : { color: O.wallColor };
  function constrain(last, p, e) { if (!e.shiftKey || !last) return p; const dx = p.x - last[0], dy = p.y - last[1], a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), d = Math.hypot(dx, dy); return FM.snapP({ x: last[0] + Math.cos(a) * d, y: last[1] + Math.sin(a) * d }); }
  T.finishWall = (closed) => {
    const pts = T.wall; T.wall = []; if (pts.length < 2) return FM.requestRender();
    const L = FM.layerFor('walls'); if (!L) return FM.requestRender();
    const it = FM.addItem(Object.assign({ type: 'wall', layer: L, points: pts, closed: !!closed, thick: O.wallThick }, wallMat())); FM.setSel([it.id]); FM.commit();
  };
  T.defs.wall = {
    cursor: 'crosshair',
    down(p, e) {
      let a = sp(p, e); const w = T.wall, last = w[w.length - 1]; a = constrain(last, a, e);
      if (last && Math.hypot(a.x - last[0], a.y - last[1]) * S.view.zoom < 3) return T.finishWall(false);
      if (w.length >= 3 && Math.hypot(a.x - w[0][0], a.y - w[0][1]) * S.view.zoom < 10) return T.finishWall(true);
      w.push([a.x, a.y]); FM.requestRender();
    },
    move() { FM.requestRender(); }, up() { },
    overlay(ctx, px) {
      const w = T.wall; let a = sp(hover, T.lastEv); if (T.lastEv) a = constrain(w[w.length - 1], a, T.lastEv);
      ctx.save(); ctx.lineWidth = O.wallThick; ctx.strokeStyle = 'rgba(0,179,126,.55)'; ctx.lineJoin = 'miter'; ctx.lineCap = 'square';
      if (w.length) { ctx.beginPath(); ctx.moveTo(w[0][0], w[0][1]); w.slice(1).forEach(q => ctx.lineTo(q[0], q[1])); ctx.lineTo(a.x, a.y); ctx.stroke(); }
      ctx.fillStyle = '#fff'; w.forEach(q => { ctx.beginPath(); ctx.arc(q[0], q[1], 4 * px, 0, 6.2832); ctx.fill(); }); ctx.beginPath(); ctx.arc(a.x, a.y, 4 * px, 0, 6.2832); ctx.fillStyle = '#00b37e'; ctx.fill(); ctx.restore();
      if (w.length) { const l = w[w.length - 1]; label(ctx, px, (l[0] + a.x) / 2, (l[1] + a.y) / 2 - 16 * px, (Math.hypot(a.x - l[0], a.y - l[1]) / cell()).toFixed(1) + ' células'); }
    }
  };

  // ===== SALA (retângulo de paredes + piso opcional) =====
  T.defs.room = {
    cursor: 'crosshair',
    down(p, e) { const a = sp(p, e); drag = { start: a, cur: a }; },
    move(p, e) { if (drag) { drag.cur = sp(p, e); FM.requestRender(); } },
    up() {
      if (!drag) return; const r = rectOf(drag.start, drag.cur); drag = null; if (r.w < cell() / 2 || r.h < cell() / 2) return FM.requestRender();
      const Lw = FM.layerFor('walls'); if (!Lw) return; const made = [];
      if (O.roomFloor && S.asset.floor) { const Lt = FM.layerFor('terrain'); if (Lt) { const t = Math.max(0.05, O.tileCells) * cell(); made.push(mkFill(r.x, r.y, r.w, r.h, S.asset.floor, t, t, Lt).id); } }
      made.push(FM.addItem(Object.assign({ type: 'wall', layer: Lw, points: [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]], closed: true, thick: O.wallThick }, wallMat())).id);
      FM.setSel(made); FM.commit();
    },
    overlay(ctx, px) { if (!drag) return; const r = rectOf(drag.start, drag.cur), c = cell(); ctx.save(); if (O.roomFloor) { ctx.fillStyle = 'rgba(0,179,126,.15)'; ctx.fillRect(r.x, r.y, r.w, r.h); } ctx.strokeStyle = 'rgba(0,179,126,.7)'; ctx.lineWidth = O.wallThick; ctx.lineJoin = 'miter'; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.restore(); label(ctx, px, r.x + r.w / 2, r.y + r.h / 2, `${(r.w / c).toFixed(1)} × ${(r.h / c).toFixed(1)} células`); }
  };

  // ===== CARIMBO (objetos; arrastar = preencher área em grade ou espalhar) =====
  function stampSize() { const a = FM.assets.get(S.asset.object), c = cell(); return a ? { w: (a.cw || 1) * c, h: (a.ch || 1) * c } : null; }
  function stampItem(a, x, y, w, h, rot, L) { return FM.addItem({ type: 'image', layer: L, asset: a.id, x, y, w, h, rot, flipX: false, opacity: 1 }); }
  function stampPlan(r) {
    const a = FM.assets.get(S.asset.object), sz = stampSize(), out = []; if (!a || !sz) return out;
    const rot0 = O.stampRot; const sw = (rot0 % 180) ? sz.h : sz.w, shh = (rot0 % 180) ? sz.w : sz.h;
    if (O.scatter) { const n = Math.min(500, Math.round(r.w * r.h / (sw * shh) * O.density / 100)); for (let i = 0; i < n; i++) { const jitter = 0.8 + Math.random() * 0.5; out.push({ cx: r.x + Math.random() * r.w, cy: r.y + Math.random() * r.h, k: jitter, rot: O.randRot ? Math.floor(Math.random() * 360) : rot0 }); } return out; }
    const cols = Math.max(1, Math.floor(r.w / sw + 0.001)), rows = Math.max(1, Math.floor(r.h / shh + 0.001));
    for (let i = 0; i < Math.min(cols, 100); i++) for (let j = 0; j < Math.min(rows, 100); j++) out.push({ cx: r.x + sw * (i + 0.5), cy: r.y + shh * (j + 0.5), k: 1, rot: O.randRot ? [0, 90, 180, 270][Math.floor(Math.random() * 4)] : rot0 });
    return out;
  }
  T.defs.stamp = {
    cursor: 'copy',
    down(p, e) { if (!S.asset.object) return toast('Escolha um objeto na biblioteca (aba Objetos).'); const a = sp(p, e); drag = { start: a, cur: a, raw: p, area: false }; },
    move(p, e) { if (drag) { drag.cur = sp(p, e); if (Math.hypot(p.x - drag.raw.x, p.y - drag.raw.y) * S.view.zoom > 8) drag.area = true; drag.plan = null; FM.requestRender(); } },
    up(p, e) {
      if (!drag) return; const d = drag; drag = null; const a = FM.assets.get(S.asset.object), sz = stampSize(); if (!a) return;
      const L = FM.layerFor('objects'); if (!L) return; const made = [];
      if (!d.area) { const rot = O.stampRot, sw = (rot % 180) ? sz.h : sz.w, shh = (rot % 180) ? sz.w : sz.h, c = d.raw, q = O.snap === 'off' || e.altKey ? { x: c.x - sw / 2, y: c.y - shh / 2 } : FM.isHex() ? (h => ({ x: h.x - sw / 2, y: h.y - shh / 2 }))(FM.nearestHex(c)) : { x: FM.snapV(c.x - sw / 2), y: FM.snapV(c.y - shh / 2) }; made.push(stampItem(a, q.x + sw / 2 - sz.w / 2, q.y + shh / 2 - sz.h / 2, sz.w, sz.h, rot, L).id); }
      else { stampPlan(rectOf(d.start, d.cur)).forEach(s => { const w = sz.w * s.k, h = sz.h * s.k; made.push(stampItem(a, s.cx - w / 2, s.cy - h / 2, w, h, s.rot, L).id); }); }
      if (made.length) { FM.setSel(made); FM.commit(); toast(made.length > 1 ? made.length + ' objetos criados' : ''); }
    },
    overlay(ctx, px) {
      const a = FM.assets.get(S.asset.object), sz = stampSize(), im = a && FM.assets.img(a.id); if (!a || !sz) return;
      const draw = (cx, cy, w, h, rot, al) => { if (!im) return; ctx.save(); ctx.globalAlpha = al; ctx.translate(cx, cy); ctx.rotate(rot * D2R); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); };
      if (drag && drag.area) { const r = rectOf(drag.start, drag.cur); ctx.strokeStyle = '#00b37e'; ctx.lineWidth = px; ctx.setLineDash([6 * px, 4 * px]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]); if (!drag.plan) drag.plan = stampPlan(r); drag.plan.forEach(s => draw(s.cx, s.cy, sz.w * s.k, sz.h * s.k, s.rot, 0.65)); label(ctx, px, r.x + r.w / 2, r.y - 14 * px, drag.plan.length + ' objetos'); }
      else if (!drag) { const rot = O.stampRot, sw = (rot % 180) ? sz.h : sz.w, shh = (rot % 180) ? sz.w : sz.h, q = O.snap === 'off' ? { x: hover.x - sw / 2, y: hover.y - shh / 2 } : FM.isHex() ? (h => ({ x: h.x - sw / 2, y: h.y - shh / 2 }))(FM.nearestHex(hover)) : { x: FM.snapV(hover.x - sw / 2), y: FM.snapV(hover.y - shh / 2) }; draw(q.x + sw / 2, q.y + shh / 2, sz.w, sz.h, rot, 0.6); }
    }
  };

  // ===== LUZ =====
  T.defs.light = {
    cursor: 'crosshair',
    down(p, e) { const a = sp(p, e), L = FM.layerFor('light'); if (!L) return; const it = FM.addItem({ type: 'light', layer: L, x: a.x, y: a.y, r: O.lightRadius * cell(), color: O.lightColor, intensity: O.lightIntensity }); FM.setSel([it.id]); FM.commit(); },
    move() { FM.requestRender(); }, up() { },
    overlay(ctx, px) { ctx.save(); ctx.strokeStyle = O.lightColor; ctx.setLineDash([6 * px, 5 * px]); ctx.lineWidth = px * 1.5; const a = sp(hover, T.lastEv); ctx.beginPath(); ctx.arc(a.x, a.y, O.lightRadius * cell(), 0, 6.2832); ctx.stroke(); ctx.restore(); }
  };

  // ===== RÉGUA =====
  T.defs.measure = {
    cursor: 'crosshair',
    down(p, e) { const a = sp(p, e); T.measure = { a, b: a }; drag = { measure: true }; },
    move(p, e) { if (drag && drag.measure) { T.measure.b = sp(p, e); FM.requestRender(); } },
    up() { drag = null; },
    overlay(ctx, px) {
      const m = T.measure; if (!m) return; ctx.save(); ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2 * px; ctx.setLineDash([8 * px, 5 * px]); ctx.beginPath(); ctx.moveTo(m.a.x, m.a.y); ctx.lineTo(m.b.x, m.b.y); ctx.stroke(); ctx.restore();
      const d = Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y) / cell(), u = S.project.map; label(ctx, px, (m.a.x + m.b.x) / 2, (m.a.y + m.b.y) / 2 - 16 * px, `${(d * u.unitVal).toFixed(1)} ${u.unitName} · ${d.toFixed(1)} células`);
    }
  };

  // ===== PORTA (encaixa na parede mais próxima) =====
  function nearestWall(p) {
    const ok = FM.visibleUnlocked(); let best = null, bd = 1e18, maxD = cell() * 0.9;
    S.project.items.forEach(w => { if (w.type !== 'wall' || !ok[w.layer]) return; const pts = w.points, n = pts.length;
      for (let i = 0; i < (w.closed ? n : n - 1); i++) { const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, s0 = (p.x - a[0]) * ux + (p.y - a[1]) * uy, off = Math.abs(-(p.x - a[0]) * uy + (p.y - a[1]) * ux); if (s0 < -4 || s0 > L + 4 || off > maxD + w.thick / 2) continue; if (off < bd) { bd = off; best = { w, a, ux, uy, L, s: s0 }; } } });
    return best;
  }
  function doorPlan(p, e) {
    const n = nearestWall(p); if (!n) return null; const len = Math.max(0.5, O.doorLen) * cell(); let s0 = n.s;
    if (O.snap !== 'off' && !(e && e.altKey)) { const st = cell() / 2; s0 = Math.round((s0 - len / 2) / st) * st + len / 2; }
    s0 = Math.max(len / 2, Math.min(n.L - len / 2, s0));
    return { wall: n.w, x: n.a[0] + n.ux * s0, y: n.a[1] + n.uy * s0, ang: Math.atan2(n.uy, n.ux) / D2R, len, th: n.w.thick };
  }
  T.defs.door = {
    cursor: 'crosshair',
    down(p, e) { const d = doorPlan(p, e); if (!d) return toast('Aproxime o cursor de uma parede para encaixar a porta.'); const L = FM.layerFor('walls'); if (!L) return; const it = FM.addItem({ type: 'door', layer: L, wall: d.wall.id, x: d.x, y: d.y, len: d.len, th: d.th, ang: d.ang, open: !!O.doorOpen, style: O.doorStyle }); FM.setSel([it.id]); FM.commit(); },
    move() { FM.requestRender(); }, up() { },
    overlay(ctx, px) { const d = doorPlan(hover, T.lastEv); if (!d) return; ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.ang * D2R); ctx.fillStyle = 'rgba(0,179,126,.35)'; ctx.strokeStyle = '#00b37e'; ctx.lineWidth = 1.5 * px; ctx.fillRect(-d.len / 2, -d.th / 2, d.len, d.th); ctx.strokeRect(-d.len / 2, -d.th / 2, d.len, d.th); ctx.restore(); }
  };

  // ===== BORRACHA: item inteiro ou por célula =====
  function eraseCells(p) {
    const c = cell(), n = O.eraseSize, cx = Math.floor(p.x / c) - Math.floor((n - 1) / 2), cy = Math.floor(p.y / c) - Math.floor((n - 1) / 2), ok = FM.visibleUnlocked();
    const ex0 = cx * c, ey0 = cy * c, ex1 = (cx + n) * c, ey1 = (cy + n) * c; let changed = 0;
    S.project.items.slice().forEach(it => {
      if (!ok[it.layer] || (O.eraseActiveOnly && it.layer !== S.activeLayer)) return;
      if (it.type === 'fill' && !(it.rot % 360)) {
        const x0 = Math.max(it.x, ex0), y0 = Math.max(it.y, ey0), x1 = Math.min(it.x + it.w, ex1), y1 = Math.min(it.y + it.h, ey1); if (x0 >= x1 - 0.01 || y0 >= y1 - 0.01) return;
        const po = it.po || [it.x, it.y], parts = [], R = { x: it.x, y: it.y, X: it.x + it.w, Y: it.y + it.h };
        const mk = (x, y, X, Y) => { if (X - x > 0.5 && Y - y > 0.5) { const q = FM.clone(it); q.x = x; q.y = y; q.w = X - x; q.h = Y - y; q.po = po.slice(); parts.push(q); } };
        mk(R.x, R.y, R.X, y0); mk(R.x, y1, R.X, R.Y); mk(R.x, y0, x0, y1); mk(x1, y0, R.X, y1);
        FM.replaceItem(it, parts); changed++;
      } else if (it.type === 'image') { const b = FM.bbox(it), mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2; if (mx >= ex0 && mx < ex1 && my >= ey0 && my < ey1) { S.project.items.splice(S.project.items.indexOf(it), 1); S.sel = S.sel.filter(i => i !== it.id); changed++; } }
    });
    return changed;
  }
  T.defs.erase = {
    cursor: 'not-allowed',
    down(p) { drag = { n: 0 }; this.sweep(p); },
    move(p) { if (drag) this.sweep(p); else FM.requestRender(); },
    sweep(p) {
      if (O.eraseMode === 'cell') { const a = drag.last || p, st = Math.max(1, Math.ceil(Math.hypot(p.x - a.x, p.y - a.y) / (cell() / 3))); for (let k = 1; k <= st; k++) drag.n += eraseCells({ x: a.x + (p.x - a.x) * k / st, y: a.y + (p.y - a.y) * k / st }); drag.last = p; FM.requestRender(); return; }
      const it = FM.hit(p, O.eraseActiveOnly ? S.activeLayer : null); if (it) { S.project.items.splice(S.project.items.indexOf(it), 1); S.project.items = S.project.items.filter(d => !(d.type === 'door' && d.wall === it.id)); S.sel = S.sel.filter(i => i !== it.id); drag.n++; FM.requestRender(); }
    },
    up() { if (drag && drag.n) FM.commit(); drag = null; },
    overlay(ctx, px) { if (O.eraseMode !== 'cell') return; const c = cell(), n = O.eraseSize, cx = Math.floor(hover.x / c) - Math.floor((n - 1) / 2), cy = Math.floor(hover.y / c) - Math.floor((n - 1) / 2); ctx.fillStyle = 'rgba(239,68,68,.25)'; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = px * 1.5; ctx.fillRect(cx * c, cy * c, n * c, n * c); ctx.strokeRect(cx * c, cy * c, n * c, n * c); }
  };

  // ---------- Troca de ferramenta ----------
  T.set = name => { if (!T.defs[name]) return; if (S.tool === 'wall' && name !== 'wall') T.wall = []; S.tool = name; drag = null; brush = null; FM.canvas.style.cursor = T.defs[name].cursor; FM.requestRender(); FM.ui && FM.ui.refresh(); };
  T.overlay = (ctx, px) => { const d = T.defs[S.tool]; if (d && d.overlay) d.overlay(ctx, px); };
  T.cancel = () => { if (T.wall.length) { T.wall = []; FM.requestRender(); } else if (drag || brush) { drag = null; brush = null; FM.requestRender(); } else if (S.tool !== 'select') T.set('select'); else FM.setSel([]); };

  // ---------- Eventos do canvas ----------
  T.bind = cv => {
    cv.addEventListener('contextmenu', e => e.preventDefault());
    const ptrs = new Map(); let pinch = null;
    const pinchInfo = () => { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); T.lastEv = e; const p = ptr(e);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { drag = null; brush = null; panning = null; pinch = Object.assign(pinchInfo(), { z: S.view.zoom, vx: S.view.x, vy: S.view.y }); return; }
      if (ptrs.size > 2) return;
      if (e.button === 1 || e.button === 2 || space || S.tool === 'pan') { panning = { x: e.clientX, y: e.clientY, vx: S.view.x, vy: S.view.y }; cv.style.cursor = 'grabbing'; return; }
      if (e.button !== 0) return; T.defs[S.tool].down(p, e);
    });
    cv.addEventListener('pointermove', e => {
      T.lastEv = e; const p = ptr(e); hover = p; FM.ui.coords(p);
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size === 2) { const n = pinchInfo(), r = cv.getBoundingClientRect(), z = Math.min(4, Math.max(0.05, pinch.z * n.d / pinch.d)), wx = (pinch.cx - r.left - pinch.vx) / pinch.z, wy = (pinch.cy - r.top - pinch.vy) / pinch.z; S.view.zoom = z; S.view.x = n.cx - r.left - wx * z; S.view.y = n.cy - r.top - wy * z; FM.requestRender(); FM.ui.status(); return; }
      if (panning) { S.view.x = panning.vx + e.clientX - panning.x; S.view.y = panning.vy + e.clientY - panning.y; FM.requestRender(); return; }
      T.defs[S.tool].move(p, e); if (['stamp', 'brush', 'light'].includes(S.tool) || (S.tool === 'wall')) FM.requestRender();
    });
    const end = e => { ptrs.delete(e.pointerId); if (pinch) { if (ptrs.size < 2) pinch = null; return; } if (panning) { panning = null; cv.style.cursor = space ? 'grab' : T.defs[S.tool].cursor; return; } T.lastEv = e; T.defs[S.tool].up(ptr(e), e); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { hover = { x: -1e6, y: -1e6 }; });
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); FM.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
    cv.addEventListener('dblclick', e => { if (S.tool === 'wall' && T.wall.length > 1) T.finishWall(false); else if (S.tool === 'select' && T.defs.select.dbl) T.defs.select.dbl(ptr(e)); });
    window.addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) { space = true; cv.style.cursor = 'grab'; e.preventDefault(); } });
    window.addEventListener('keyup', e => { if (e.code === 'Space') { space = false; cv.style.cursor = T.defs[S.tool].cursor; } });
  };
  T.hover = () => hover;
})();
