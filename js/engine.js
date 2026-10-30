// Motor: estado, histórico, renderização em Canvas 2D, hit-test
(function () {
  const FM = window.FM, D2R = Math.PI / 180;
  const S = FM.state = { project: null, view: { x: 60, y: 60, zoom: 1 }, sel: [], activeLayer: null, tool: 'select', asset: { floor: null, wall: null, object: null } };
  FM.opts = { snap: 'cell', autoLayer: true, fillMode: 'cell', tileCells: 1, rx: 4, ry: 4, brush: 1, wallThick: 14, wallMat: 'tex', wallColor: '#4a4a4f', roomFloor: true, stampRot: 0, scatter: false, density: 40, randRot: false, lightColor: '#ffa94d', lightRadius: 4, lightIntensity: 0.9, eraseActiveOnly: false, eraseMode: 'item', eraseSize: 1, doorLen: 1, doorStyle: 'wood', doorOpen: false };
  const clone = o => JSON.parse(JSON.stringify(o));
  FM.clone = clone;
  const norm = r => ((r % 360) + 360) % 360;
  FM.normRot = norm;

  // ---------- Projeto ----------
  FM.newProject = function (name) {
    const L = (id, name, role) => ({ id, name, role, visible: true, locked: false, opacity: 1, blend: 'source-over' });
    return { v: 3, name: name || 'Novo Mapa', nextId: 1, nextLayer: 6,
      map: { grid: 'square', shadows: true, cols: 30, rows: 20, cell: 64, bg: '#2b2b2e', unitVal: 1.5, unitName: 'm', gridOn: true, gridColor: '#ffffff', gridAlpha: 0.14, ambient: 0, ambientColor: '#0a0f26' },
      layers: [L('l1', 'Terreno', 'terrain'), L('l2', 'Paredes', 'walls'), L('l3', 'Objetos', 'objects'), L('l4', 'Tokens / Extras', 'tokens'), L('l5', 'Iluminação', 'light')],
      items: [] };
  };
  FM.loadProject = function (p) {
    S.project = p; S.sel = []; S.activeLayer = (p.layers.find(l => l.role === 'terrain') || p.layers[0]).id;
    FM.history.reset(); FM.miniDirty && FM.miniDirty(); FM.fitView(); FM.requestRender(); FM.ui && FM.ui.refresh(true);
  };
  const P = () => S.project;
  // ---------- Grade (quadrada / hexagonal) ----------
  FM.isHex = () => { const g = P().map.grid; return g === 'hexp' || g === 'hexf'; };
  FM.hexInfo = m => { const d = m.cell, R = d / Math.sqrt(3); return m.grid === 'hexp' ? { p: true, R, dx: d, dy: 1.5 * R } : { p: false, R, dx: 1.5 * R, dy: d }; };
  FM.mapSize = m => {
    m = m || P().map; const h = FM.hexInfo(m);
    if (m.grid === 'hexp') return { W: m.cols * m.cell + m.cell / 2, H: m.rows * h.dy + h.R * 0.5 };
    if (m.grid === 'hexf') return { W: m.cols * h.dx + h.R * 0.5, H: m.rows * m.cell + m.cell / 2 };
    return { W: m.cols * m.cell, H: m.rows * m.cell };
  };
  FM.hexCenter = (c, r, m) => { m = m || P().map; const h = FM.hexInfo(m), d = m.cell; return h.p ? { x: d / 2 + c * d + (r & 1) * d / 2, y: h.R + r * 1.5 * h.R } : { x: h.R + c * 1.5 * h.R, y: d / 2 + r * d + (c & 1) * d / 2 }; };
  FM.nearestHex = p => {
    const m = P().map, h = FM.hexInfo(m), d = m.cell; let best = null, bd = 1e18;
    const test = (c, r) => { const q = FM.hexCenter(c, r, m), dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd < bd) { bd = dd; best = q; } };
    if (h.p) { const r0 = Math.round((p.y - h.R) / (1.5 * h.R)); for (let r = r0 - 1; r <= r0 + 1; r++) { const c0 = Math.round((p.x - d / 2 - (r & 1) * d / 2) / d); for (let c = c0 - 1; c <= c0 + 1; c++) test(c, r); } }
    else { const c0 = Math.round((p.x - h.R) / (1.5 * h.R)); for (let c = c0 - 1; c <= c0 + 1; c++) { const r0 = Math.round((p.y - d / 2 - (c & 1) * d / 2) / d); for (let r = r0 - 1; r <= r0 + 1; r++) test(c, r); } }
    return best;
  };
  FM.snapV = v => { const c = P().map.cell, m = FM.opts.snap; if (m === 'off') return v; const st = (m === 'half' || FM.isHex()) ? c / 2 : c; return Math.round(v / st) * st; };
  FM.snapP = p => (FM.isHex() && FM.opts.snap !== 'off') ? FM.nearestHex(p) : ({ x: FM.snapV(p.x), y: FM.snapV(p.y) });
  FM.snapC = FM.snapP; // alias: ponto central (centro do hexágono em grade hex)
  FM.itemById = id => P().items.find(i => i.id === id);
  FM.selItems = () => S.sel.map(FM.itemById).filter(Boolean);
  FM.isXf = it => it && (it.type === 'fill' || it.type === 'image');
  FM.setSel = ids => { S.sel = ids.length ? FM.expand(ids) : ids; FM.requestRender(); FM.ui && FM.ui.refresh(); };
  FM.layer = id => P().layers.find(l => l.id === id);
  FM.addItem = it => { it.id = 'i' + (P().nextId++); if (it.opacity == null) it.opacity = 1; P().items.push(it); return it; };

  // Camada de destino de um novo item (automática por função ou a camada ativa)
  FM.layerFor = role => {
    let L = FM.opts.autoLayer ? P().layers.find(l => l.role === role && !l.locked) : null;
    if (!L) L = FM.layer(S.activeLayer);
    if (!L) return null;
    if (L.locked) { FM.ui.toast('A camada "' + L.name + '" está bloqueada.'); return null; }
    if (!L.visible) L.visible = true;
    return L.id;
  };

  // ---------- Histórico (undo/redo) ----------
  const H = FM.history = { stack: [], idx: -1 };
  const snap = () => JSON.stringify({ map: P().map, layers: P().layers, items: P().items, nextId: P().nextId, nextLayer: P().nextLayer });
  H.reset = () => { H.stack = [snap()]; H.idx = 0; };
  FM.commit = () => {
    const s = snap(); if (s === H.stack[H.idx]) { FM.ui && FM.ui.refresh(); return; }
    H.stack.length = H.idx + 1; H.stack.push(s); if (H.stack.length > 150) H.stack.shift(); H.idx = H.stack.length - 1;
    FM.miniDirty && FM.miniDirty(); FM.requestRender(); FM.autosave(); FM.ui && FM.ui.refresh();
  };
  function restore() {
    Object.assign(P(), JSON.parse(H.stack[H.idx]));
    S.sel = S.sel.filter(id => P().items.some(i => i.id === id));
    if (!FM.layer(S.activeLayer)) S.activeLayer = P().layers[0].id;
    FM.miniDirty && FM.miniDirty(); FM.requestRender(); FM.autosave(); FM.ui && FM.ui.refresh(true);
  }
  FM.undo = () => { if (H.idx > 0) { H.idx--; restore(); } };
  FM.redo = () => { if (H.idx < H.stack.length - 1) { H.idx++; restore(); } };
  let saveT = 0;
  FM.autosave = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem('forjamap.autosave', JSON.stringify(P())); } catch (e) { /* cheio/bloqueado */ } }, 500); };

  // ---------- Vista ----------
  FM.toWorld = (sx, sy) => ({ x: (sx - S.view.x) / S.view.zoom, y: (sy - S.view.y) / S.view.zoom });
  FM.fitView = () => {
    const cv = FM.canvas; if (!cv) return; const ms = FM.mapSize(), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    const L = 64, z = Math.min((w - L - 40) / ms.W, (h - 60) / ms.H, 2);
    S.view.zoom = Math.max(0.05, z); S.view.x = L + (w - L - ms.W * S.view.zoom) / 2; S.view.y = (h - ms.H * S.view.zoom) / 2; FM.requestRender(); FM.ui && FM.ui.status && FM.ui.status();
  };
  FM.zoomAt = (sx, sy, f) => {
    const v = S.view, nz = Math.min(4, Math.max(0.05, v.zoom * f)); const wp = FM.toWorld(sx, sy);
    v.zoom = nz; v.x = sx - wp.x * nz; v.y = sy - wp.y * nz; FM.requestRender(); FM.ui && FM.ui.status && FM.ui.status();
  };

  // ---------- Geometria ----------
  const rotPt = (x, y, deg) => { const a = deg * D2R, c = Math.cos(a), s = Math.sin(a); return { x: x * c - y * s, y: x * s + y * c }; };
  FM.rotPt = rotPt;
  FM.center = it => ({ x: it.x + it.w / 2, y: it.y + it.h / 2 });
  FM.toLocal = (it, p) => { const c = FM.center(it); return rotPt(p.x - c.x, p.y - c.y, -(it.rot || 0)); };
  FM.bbox = it => {
    if (FM.isXf(it)) { const c = FM.center(it); let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = rotPt(sx * it.w / 2, sy * it.h / 2, it.rot || 0); x0 = Math.min(x0, c.x + q.x); x1 = Math.max(x1, c.x + q.x); y0 = Math.min(y0, c.y + q.y); y1 = Math.max(y1, c.y + q.y); } return { x0, y0, x1, y1 }; }
    if (it.type === 'door') { const r = it.len / 2 + it.th; return { x0: it.x - r, y0: it.y - r, x1: it.x + r, y1: it.y + r }; }
    if (it.type === 'wall') { const xs = it.points.map(p => p[0]), ys = it.points.map(p => p[1]), t = it.thick / 2; return { x0: Math.min(...xs) - t, y0: Math.min(...ys) - t, x1: Math.max(...xs) + t, y1: Math.max(...ys) + t }; }
    return { x0: it.x - 12, y0: it.y - 12, x1: it.x + 12, y1: it.y + 12 };
  };
  const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 ? ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (a[0] + t * dx), p.y - (a[1] + t * dy)); };
  function hitItem(it, p, z) {
    if (FM.isXf(it)) { const l = FM.toLocal(it, p); return Math.abs(l.x) <= it.w / 2 && Math.abs(l.y) <= it.h / 2; }
    if (it.type === 'door') { const l = rotPt(p.x - it.x, p.y - it.y, -(it.ang || 0)); return Math.abs(l.x) <= it.len / 2 && Math.abs(l.y) <= it.th / 2 + 4 / z; }
    if (it.type === 'wall') { const pts = it.points, n = pts.length, lim = it.thick / 2 + 3 / z; for (let i = 0; i < n - 1; i++) if (segDist(p, pts[i], pts[i + 1]) <= lim) return true; if (it.closed && n > 2 && segDist(p, pts[n - 1], pts[0]) <= lim) return true; return false; }
    return Math.hypot(p.x - it.x, p.y - it.y) <= 12 / z;
  }
  FM.visibleUnlocked = () => { const o = {}; P().layers.forEach(l => { o[l.id] = l.visible && !l.locked; }); return o; };
  FM.hit = (p, onlyLayer) => {
    const z = S.view.zoom, P_ = P(), by = {};
    P_.items.forEach(i => { (by[i.layer] = by[i.layer] || []).push(i); });
    for (let li = P_.layers.length - 1; li >= 0; li--) {
      const L = P_.layers[li]; if (!L.visible || L.locked || (onlyLayer && L.id !== onlyLayer)) continue;
      const arr = by[L.id] || []; for (let k = arr.length - 1; k >= 0; k--) if (hitItem(arr[k], p, z)) return arr[k];
    } return null;
  };
  FM.moveItem = (it, o, dx, dy) => { if (it.type === 'wall') it.points = o.points.map(q => [q[0] + dx, q[1] + dy]); else { it.x = o.x + dx; it.y = o.y + dy; if (o.po) it.po = [o.po[0] + dx, o.po[1] + dy]; } };
  FM.replaceItem = (old, news) => { const a = P().items, i = a.indexOf(old); news.forEach(n => { n.id = 'i' + (P().nextId++); }); a.splice(i, 1, ...news); S.sel = S.sel.filter(id => id !== old.id); return news; };
  // Grupos
  FM.expand = ids => { const set = new Set(ids), gs = new Set(); P().items.forEach(i => { if (set.has(i.id) && i.g) gs.add(i.g); }); return P().items.filter(i => set.has(i.id) || (i.g && gs.has(i.g))).map(i => i.id); };
  FM.reorder = (it, dir) => {
    const a = P().items, same = a.filter(i => i.layer === it.layer), k = same.indexOf(it);
    if (dir === 'front') { a.splice(a.indexOf(it), 1); a.push(it); }
    else if (dir === 'back') { a.splice(a.indexOf(it), 1); a.unshift(it); }
    else { const o = same[k + (dir === 'up' ? 1 : -1)]; if (!o) return; const i = a.indexOf(it), j = a.indexOf(o); a[i] = o; a[j] = it; }
  };

  // ---------- Renderização ----------
  const hex = h => { h = (h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
  FM.rgba = rgba;
  const offs = {};
  const offCanvas = (k, w, h) => { const c = offs[k] || (offs[k] = document.createElement('canvas')); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; };
  const pats = {};
  FM.dropPattern = id => { delete pats[id]; };
  const patternFor = (c, id, im) => pats[id] || (pats[id] = c.createPattern(im, 'repeat'));

  const doorPoly = (d, pad) => { const h = d.len / 2, t = d.th / 2 + pad, a = (d.ang || 0) * D2R, ca = Math.cos(a), sa = Math.sin(a); return [[-h, -t], [h, -t], [h, t], [-h, t]].map(([x, y]) => [d.x + x * ca - y * sa, d.y + x * sa + y * ca]); };
  function drawWall(c, it) {
    const pts = it.points; if (pts.length < 2) return;
    const doors = P().items.filter(i => i.type === 'door' && i.wall === it.id);
    if (doors.length) { c.save(); c.beginPath(); c.rect(-1e6, -1e6, 2e6, 2e6); doors.forEach(d => { const q = doorPoly(d, 2); c.moveTo(q[0][0], q[0][1]); q.slice(1).forEach(z => c.lineTo(z[0], z[1])); c.closePath(); }); c.clip('evenodd'); drawWallBody(c, it); c.restore(); } else drawWallBody(c, it);
  }
  function drawDoor(c, d) {
    c.save(); c.translate(d.x, d.y); c.rotate((d.ang || 0) * D2R); const L = d.len, t = d.th, h = L / 2;
    c.lineJoin = 'round'; c.lineWidth = 2;
    c.fillStyle = '#8a8a90'; c.strokeStyle = '#2b2b30'; [-h - t * 0.35, h - t * 0.15].forEach(x => { c.beginPath(); c.rect(x, -t / 2 - 1, t * 0.5, t + 2); c.fill(); c.stroke(); });
    if (d.style === 'arch') { c.strokeStyle = 'rgba(0,0,0,.35)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(-h, 0); c.lineTo(h, 0); c.stroke(); }
    else {
      const wood = d.style !== 'iron', fill = wood ? '#6b4423' : '#6f7782', edge = wood ? '#2a170a' : '#23272d';
      if (!d.open) { c.fillStyle = fill; c.strokeStyle = edge; c.beginPath(); c.rect(-h + t * 0.15, -t * 0.34, L - t * 0.3, t * 0.68); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, -t * 0.34); c.lineTo(0, t * 0.34); c.stroke(); c.fillStyle = wood ? '#d9b23c' : '#bfc5cf'; c.beginPath(); c.arc(-t * 0.5, 0, t * 0.12, 0, 6.2832); c.arc(t * 0.5, 0, t * 0.12, 0, 6.2832); c.fill(); }
      else { c.fillStyle = fill; c.strokeStyle = edge; c.beginPath(); c.rect(-h - t * 0.15, -L + t * 0.1, t * 0.34, L - t * 0.1); c.fill(); c.stroke(); c.save(); c.strokeStyle = 'rgba(255,255,255,.28)'; c.setLineDash([3, 4]); c.lineWidth = 1.2; c.beginPath(); c.arc(-h, 0, L, -Math.PI / 2, 0); c.stroke(); c.restore(); }
    }
    c.restore();
  }
  function drawWallBody(c, it) {
    const pts = it.points;
    c.lineJoin = 'miter'; c.miterLimit = 3; c.lineCap = it.closed ? 'butt' : 'square';
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); if (it.closed) c.closePath();
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = it.thick + 4; c.stroke();
    let style = it.color || '#4a4a4f';
    if (it.asset) { const im = FM.assets.img(it.asset); if (im) { const pat = patternFor(c, it.asset, im), t = it.thick * 3; pat.setTransform(new DOMMatrix([t / im.naturalWidth, 0, 0, t / im.naturalHeight, 0, 0])); style = pat; } }
    c.strokeStyle = style; c.lineWidth = it.thick; c.stroke();
  }
  function drawItem(c, it) {
    c.save(); c.globalAlpha *= it.opacity == null ? 1 : it.opacity;
    if (FM.isXf(it)) {
      c.translate(it.x + it.w / 2, it.y + it.h / 2); if (it.rot) c.rotate(it.rot * D2R); if (it.flipX) c.scale(-1, 1);
      const im = FM.assets.img(it.asset);
      if (!im) { if (!FM.assets.byId[it.asset]) { c.fillStyle = 'rgba(255,0,200,.25)'; c.fillRect(-it.w / 2, -it.h / 2, it.w, it.h); c.strokeStyle = '#ff00c8'; c.strokeRect(-it.w / 2, -it.h / 2, it.w, it.h); c.beginPath(); c.moveTo(-it.w / 2, -it.h / 2); c.lineTo(it.w / 2, it.h / 2); c.moveTo(it.w / 2, -it.h / 2); c.lineTo(-it.w / 2, it.h / 2); c.stroke(); } }
      else if (it.type === 'image') c.drawImage(im, -it.w / 2, -it.h / 2, it.w, it.h);
      else { const pat = patternFor(c, it.asset, im), ox = it.po ? it.po[0] - (it.x + it.w / 2) : -it.w / 2, oy = it.po ? it.po[1] - (it.y + it.h / 2) : -it.h / 2; pat.setTransform(new DOMMatrix([it.tw / im.naturalWidth, 0, 0, it.th / im.naturalHeight, ox, oy])); c.fillStyle = pat; c.fillRect(-it.w / 2, -it.h / 2, it.w, it.h); }
    } else if (it.type === 'wall') drawWall(c, it);
    else if (it.type === 'door') drawDoor(c, it);
    c.restore();
  }

  FM.blockers = (opts) => {
    opts = opts || {}; const out = [], items = P().items, doors = items.filter(i => i.type === 'door');
    items.forEach(w => {
      if (w.type !== 'wall') return; const pts = w.points, n = pts.length, mine = doors.filter(d => d.wall === w.id);
      for (let i = 0; i < (w.closed ? n : n - 1); i++) {
        const A = pts[i], B = pts[(i + 1) % n], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy); if (L < 1e-6) continue; const ux = dx / L, uy = dy / L, gaps = [];
        mine.forEach(d => { const s = (d.x - A[0]) * ux + (d.y - A[1]) * uy, off = Math.abs(-(d.x - A[0]) * uy + (d.y - A[1]) * ux); if (off <= d.th + 2 && s > -d.len / 2 && s < L + d.len / 2) gaps.push([s - d.len / 2, s + d.len / 2]); });
        gaps.sort((a, b) => a[0] - b[0]); let cur = 0;
        gaps.forEach(g => { if (g[0] > cur + 0.5) out.push({ x1: A[0] + ux * cur, y1: A[1] + uy * cur, x2: A[0] + ux * g[0], y2: A[1] + uy * g[0], wall: w.id }); cur = Math.max(cur, g[1]); });
        if (cur < L - 0.5) out.push({ x1: A[0] + ux * cur, y1: A[1] + uy * cur, x2: B[0], y2: B[1], wall: w.id });
      }
    });
    if (!opts.noDoors) doors.forEach(d => { if (!d.open && d.style !== 'arch') { const a = (d.ang || 0) * D2R, ux = Math.cos(a) * d.len / 2, uy = Math.sin(a) * d.len / 2; out.push({ x1: d.x - ux, y1: d.y - uy, x2: d.x + ux, y2: d.y + uy, door: d.id }); } });
    return out;
  };
  const polyCache = new Map();
  function visPoly(l, segs) {
    const R = l.r, near = segs.filter(s => Math.min(s.x1, s.x2) <= l.x + R && Math.max(s.x1, s.x2) >= l.x - R && Math.min(s.y1, s.y2) <= l.y + R && Math.max(s.y1, s.y2) >= l.y - R);
    if (!near.length || near.length > 600) return null;
    const key = l.x + ',' + l.y + ',' + l.r + '|' + near.length + '|' + near.reduce((a, s) => a + s.x1 * 1.1 + s.y1 * 1.3 + s.x2 * 1.7 + s.y2 * 1.9, 0).toFixed(2);
    if (polyCache.has(key)) return polyCache.get(key);
    const box = [[l.x - R, l.y - R, l.x + R, l.y - R], [l.x + R, l.y - R, l.x + R, l.y + R], [l.x + R, l.y + R, l.x - R, l.y + R], [l.x - R, l.y + R, l.x - R, l.y - R]].map(a => ({ x1: a[0], y1: a[1], x2: a[2], y2: a[3] })), all = near.concat(box), angs = [];
    all.forEach(s => { [[s.x1, s.y1], [s.x2, s.y2]].forEach(([x, y]) => { const a = Math.atan2(y - l.y, x - l.x); angs.push(a - 1e-4, a, a + 1e-4); }); });
    const pts = [];
    for (const a of angs) {
      const rx = Math.cos(a), ry = Math.sin(a); let best = 1e18;
      for (const s of all) { const sx = s.x2 - s.x1, sy = s.y2 - s.y1, den = rx * sy - ry * sx; if (Math.abs(den) < 1e-12) continue; const t = ((s.x1 - l.x) * sy - (s.y1 - l.y) * sx) / den, u = ((s.x1 - l.x) * ry - (s.y1 - l.y) * rx) / den; if (t > 0 && u >= 0 && u <= 1 && t < best) best = t; }
      if (best < 1e17) pts.push({ a, x: l.x + rx * best, y: l.y + ry * best });
    }
    pts.sort((p, q) => p.a - q.a); if (polyCache.size > 200) polyCache.clear(); polyCache.set(key, pts); return pts;
  }
  const polyPath = (c, pts) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); };
  function lighting(ctx, cw, ch, setT) {
    const m = P().map, vis = {}; P().layers.forEach(l => { vis[l.id] = l.visible ? l.opacity : 0; });
    const lights = P().items.filter(i => i.type === 'light' && vis[i.layer] > 0), segs = (m.shadows !== false) ? FM.blockers() : [];
    lights.forEach(l => { l._poly = (m.shadows !== false && l.shadows !== false && segs.length) ? visPoly(l, segs) : null; });
    if (m.ambient > 0) {
      const dc = offCanvas('dark', cw, ch), d = dc.getContext('2d');
      d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, cw, ch);
      d.fillStyle = rgba(m.ambientColor, m.ambient); d.fillRect(0, 0, cw, ch);
      setT(d); d.globalCompositeOperation = 'destination-out';
      for (const l of lights) { const g = d.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r), a = l.intensity * vis[l.layer]; g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.5})`); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.save(); if (l._poly) { polyPath(d, l._poly); d.clip(); } d.beginPath(); d.arc(l.x, l.y, l.r, 0, 6.2832); d.fill(); d.restore(); }
      d.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(dc, 0, 0); ctx.restore();
    }
    if (!lights.length) return;
    ctx.save(); setT(ctx); ctx.globalCompositeOperation = 'screen';
    for (const l of lights) { const a = 0.55 * l.intensity * vis[l.layer], g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); g.addColorStop(0, rgba(l.color, a)); g.addColorStop(0.5, rgba(l.color, a * 0.4)); g.addColorStop(1, rgba(l.color, 0)); ctx.fillStyle = g; ctx.save(); if (l._poly) { polyPath(ctx, l._poly); ctx.clip(); } ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, 6.2832); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }
  function drawGrid(ctx, T) {
    const m = P().map; if (m.cell * T.s < 5) return;
    const { W, H } = FM.mapSize();
    ctx.save(); ctx.setTransform(T.s, 0, 0, T.s, T.ox, T.oy); ctx.beginPath();
    if (FM.isHex()) {
      ctx.rect(0, 0, W, H); ctx.clip(); ctx.beginPath(); const h = FM.hexInfo(m);
      for (let r = 0; r < m.rows + 1; r++) for (let c = 0; c < m.cols + 1; c++) { const q = FM.hexCenter(c, r, m); for (let k = 0; k < 6; k++) { const a = (h.p ? 30 : 0) * D2R + k * Math.PI / 3, x = q.x + Math.cos(a) * h.R, y = q.y + Math.sin(a) * h.R; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); }
    } else {
      for (let x = 0; x <= m.cols; x++) { ctx.moveTo(x * m.cell, 0); ctx.lineTo(x * m.cell, H); }
      for (let y = 0; y <= m.rows; y++) { ctx.moveTo(0, y * m.cell); ctx.lineTo(W, y * m.cell); }
    }
    ctx.strokeStyle = rgba(m.gridColor, m.gridAlpha); ctx.lineWidth = 1 / T.s * (T.dpr || 1); ctx.stroke(); ctx.restore();
  }
  // T = {s: escala total (dispositivo), ox, oy, dpr}
  FM.render = function (ctx, cw, ch, T, o) {
    const m = P().map, setT = c => c.setTransform(T.s, 0, 0, T.s, T.ox, T.oy), MS = FM.mapSize();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch);
    if (o.ui) { ctx.fillStyle = '#0c0c0f'; ctx.fillRect(0, 0, cw, ch); }
    setT(ctx); ctx.imageSmoothingQuality = 'high'; if (!o.nobg) { ctx.fillStyle = m.bg; ctx.fillRect(0, 0, MS.W, MS.H); }
    const vx0 = -T.ox / T.s, vy0 = -T.oy / T.s, vx1 = (cw - T.ox) / T.s, vy1 = (ch - T.oy) / T.s;
    for (const L of P().layers) {
      if (!L.visible || (o.layer && o.layer !== L.id)) continue;
      const its = P().items.filter(i => i.layer === L.id && i.type !== 'light' && (b => b.x1 >= vx0 && b.x0 <= vx1 && b.y1 >= vy0 && b.y0 <= vy1)(FM.bbox(i))); if (!its.length) continue;
      if (L.opacity < 1 || L.blend !== 'source-over') {
        const oc = offCanvas('layer', cw, ch), c2 = oc.getContext('2d'); c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, cw, ch); setT(c2); c2.imageSmoothingQuality = 'high';
        its.forEach(i => drawItem(c2, i));
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = L.opacity; ctx.globalCompositeOperation = L.blend; ctx.drawImage(oc, 0, 0); ctx.restore();
      } else its.forEach(i => drawItem(ctx, i));
    }
    if (!o.noLights && !o.layer) lighting(ctx, cw, ch, setT);
    if (o.grid && m.gridOn) drawGrid(ctx, T);
    if (o.ui) {
      const W = MS.W, H = MS.H, px = 1 / S.view.zoom;
      ctx.save(); setT(ctx);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.rect(-1e6, -1e6, 2e6, 2e6); ctx.rect(0, 0, W, H); ctx.fill('evenodd');
      ctx.strokeStyle = '#00b37e'; ctx.lineWidth = 2 * px; ctx.strokeRect(0, 0, W, H);
      // marcadores de luz
      for (const l of P().items) if (l.type === 'light' && FM.layer(l.layer).visible) { ctx.beginPath(); ctx.arc(l.x, l.y, 7 * px, 0, 6.2832); ctx.fillStyle = l.color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * px; ctx.stroke(); }
      FM.drawSelection(ctx, px);
      if (FM.tools && FM.tools.overlay) FM.tools.overlay(ctx, px);
      ctx.restore();
    }
  };

  // ---------- Seleção: contorno e alças ----------
  const HD = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
  FM.HDIR = HD;
  FM.handlePos = (it, id, px) => { // posição de uma alça em coordenadas do mapa
    const c = FM.center(it); let lx, ly;
    if (id === 'rot') { lx = 0; ly = -it.h / 2 - 28 * px; } else { lx = HD[id][0] * it.w / 2; ly = HD[id][1] * it.h / 2; }
    const q = rotPt(lx, ly, it.rot || 0); return { x: c.x + q.x, y: c.y + q.y };
  };
  FM.hitHandle = (it, p) => {
    const px = 1 / S.view.zoom;
    for (const id of ['rot', ...Object.keys(HD)]) { const h = FM.handlePos(it, id, px); if (Math.abs(h.x - p.x) <= 7 * px && Math.abs(h.y - p.y) <= 7 * px) return id; }
    return null;
  };
  FM.drawSelection = (ctx, px) => {
    const items = FM.selItems(); ctx.save(); ctx.strokeStyle = '#00b37e'; ctx.lineWidth = 1.5 * px;
    for (const it of items) {
      if (FM.isXf(it)) { const c = FM.center(it); ctx.save(); ctx.translate(c.x, c.y); ctx.rotate((it.rot || 0) * D2R); ctx.strokeRect(-it.w / 2, -it.h / 2, it.w, it.h); ctx.restore(); }
      else if (it.type === 'wall') { const pts = it.points; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(q => ctx.lineTo(q[0], q[1])); if (it.closed) ctx.closePath(); ctx.save(); ctx.strokeStyle = 'rgba(0,179,126,.45)'; ctx.lineWidth = it.thick + 2 * px * 3; ctx.lineJoin = 'miter'; ctx.stroke(); ctx.restore(); }
      else if (it.type === 'door') { ctx.save(); ctx.translate(it.x, it.y); ctx.rotate((it.ang || 0) * D2R); ctx.strokeRect(-it.len / 2 - 3 * px, -it.th / 2 - 3 * px, it.len + 6 * px, it.th + 6 * px); ctx.restore(); }
      else if (it.type === 'light') { ctx.save(); ctx.setLineDash([6 * px, 5 * px]); ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, 6.2832); ctx.stroke(); ctx.restore(); ctx.beginPath(); ctx.arc(it.x, it.y, 11 * px, 0, 6.2832); ctx.stroke(); }
    }
    if (items.length === 1 && items[0].type === 'wall') { const w = items[0], vs = FM.tools && FM.tools.vsel; ctx.fillStyle = '#fff'; w.points.forEach((q, i) => { ctx.beginPath(); ctx.arc(q[0], q[1], 5 * px, 0, 6.2832); ctx.fillStyle = vs && vs.id === w.id && vs.i === i ? '#00b37e' : '#fff'; ctx.fill(); ctx.stroke(); }); }
    if (items.length > 1) { const b = items.map(FM.bbox); ctx.setLineDash([5 * px, 4 * px]); ctx.strokeRect(Math.min(...b.map(q => q.x0)), Math.min(...b.map(q => q.y0)), Math.max(...b.map(q => q.x1)) - Math.min(...b.map(q => q.x0)), Math.max(...b.map(q => q.y1)) - Math.min(...b.map(q => q.y0))); ctx.setLineDash([]); }
    if (items.length === 1 && FM.isXf(items[0])) {
      const it = items[0], t = FM.handlePos(it, 'n', px), r = FM.handlePos(it, 'rot', px);
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(r.x, r.y); ctx.stroke();
      ctx.fillStyle = '#fff'; for (const id of ['rot', ...Object.keys(HD)]) { const h = FM.handlePos(it, id, px); ctx.beginPath(); if (id === 'rot') ctx.arc(h.x, h.y, 5.5 * px, 0, 6.2832); else ctx.rect(h.x - 4.5 * px, h.y - 4.5 * px, 9 * px, 9 * px); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
  };

  // Loop de desenho sob demanda
  let dirty = false;
  FM.requestRender = () => { if (dirty) return; dirty = true; requestAnimationFrame(() => { dirty = false; FM.paint(); }); };
  FM.paint = () => {
    const cv = FM.canvas; if (!cv || !S.project) return; const dpr = window.devicePixelRatio || 1;
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    FM.render(cv.getContext('2d'), w, h, { s: dpr * S.view.zoom, ox: dpr * S.view.x, oy: dpr * S.view.y, dpr }, { ui: true, grid: true });
    if (FM.miniDraw) FM.miniDraw();
  };

  // Exportação PNG (mapa inteiro)
  FM.exportCanvas = async (scale, grid, extra) => {
    const used = new Set(); P().items.forEach(i => i.asset && used.add(i.asset)); await Promise.all([...used].map(id => FM.assets.load(id)));
const MS = FM.mapSize(), W = Math.round(MS.W * scale), H = Math.round(MS.H * scale);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    FM.render(c.getContext('2d'), W, H, { s: scale, ox: 0, oy: 0, dpr: 1 }, Object.assign({ ui: false, grid }, extra || {}));
    return c;
  };
})();
