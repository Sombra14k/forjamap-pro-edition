// Biblioteca de assets: embutidos (SVG procedurais) + do usuário (IndexedDB)
(function () {
  const FM = window.FM;

  // ---------- Armazenamento persistente (IndexedDB) ----------
  FM.db = (() => {
    let db = null;
    const open = () => new Promise(res => {
      try {
        const rq = indexedDB.open('forjamap', 1);
        rq.onupgradeneeded = () => { const d = rq.result; d.createObjectStore('assets', { keyPath: 'id' }); d.createObjectStore('cats', { keyPath: 'id' }); };
        rq.onsuccess = () => { db = rq.result; res(true); };
        rq.onerror = () => res(false);
      } catch (e) { res(false); }
    });
    const st = (s, m) => db.transaction(s, m).objectStore(s);
    const wrap = (fn) => new Promise(r => { if (!db) return r(null); try { const q = fn(); q.onsuccess = () => r(q.result === undefined ? true : q.result); q.onerror = () => r(null); } catch (e) { r(null); } });
    return {
      open,
      get ok() { return !!db; },
      all: s => wrap(() => st(s, 'readonly').getAll()).then(v => Array.isArray(v) ? v : []),
      put: (s, v) => wrap(() => st(s, 'readwrite').put(v)),
      del: (s, k) => wrap(() => st(s, 'readwrite').delete(k))
    };
  })();

  // ---------- Gerador procedural de texturas ----------
  const rng = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const svg = (w, h, b) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${b}</svg>`;
  const uri = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  function speckle(seed, w, h, n, cols, r0, r1) {
    const r = rng(seed); let o = '';
    for (let i = 0; i < n; i++) o += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(r0 + r() * (r1 - r0)).toFixed(1)}" fill="${pick(r, cols)}"/>`;
    return o;
  }
  function blades(seed, w, h, n, cols) {
    const r = rng(seed); let o = '';
    for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, l = 4 + r() * 6; o += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${(r() * 4 - 2).toFixed(1)} ${(-l).toFixed(1)}" stroke="${pick(r, cols)}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`; }
    return o;
  }

  const B = []; // built-ins
  const tile = (id, cat, name, body, size = 128) => B.push({ id, cat, name, builtin: true, tile: 1, src: uri(svg(size, size, body)) });
  const obj = (id, name, cw, ch, body, cat = 'objeto') => B.push({ id, cat, name, builtin: true, cw, ch, src: uri(svg(cw * 64, ch * 64, body)) });

  // Pisos
  tile('t_grama', 'piso', 'Grama', `<rect width="128" height="128" fill="#2f6b2a"/>${speckle(1, 128, 128, 40, ['#3b7d34', '#245a21'], 1, 3)}${blades(2, 128, 128, 60, ['#4a9440', '#1d4f1a', '#3d8736'])}`);
  tile('t_terra', 'piso', 'Terra', `<rect width="128" height="128" fill="#7a5a3a"/>${speckle(3, 128, 128, 90, ['#6a4d30', '#8b6a46', '#5a4128'], 1, 4)}`);
  tile('t_areia', 'piso', 'Areia', `<rect width="128" height="128" fill="#d9c38f"/>${speckle(4, 128, 128, 120, ['#c7ad74', '#ecdcae', '#bfa46a'], 0.8, 2.2)}`);
  tile('t_neve', 'piso', 'Neve', `<rect width="128" height="128" fill="#e8eef5"/>${speckle(5, 128, 128, 70, ['#cdd8e6', '#ffffff', '#d8e2ee'], 1, 4)}`);
  tile('t_agua', 'piso', 'Água', `<rect width="128" height="128" fill="#1d5a8a"/><g stroke="#5aa5d6" fill="none" stroke-width="2" opacity=".55"><path d="M0 24q16-10 32 0t32 0 32 0 32 0"/><path d="M0 72q16-10 32 0t32 0 32 0 32 0"/><path d="M0 112q16-10 32 0t32 0 32 0 32 0"/></g>`);
  tile('t_lava', 'piso', 'Lava', `<rect width="128" height="128" fill="#3a0d06"/>${speckle(6, 128, 128, 30, ['#ff7a1a', '#ffb13b', '#c93b08'], 2, 7)}<path d="M0 30l30 20 20-10 40 30 38-20M20 128l25-40 30 10 20-30" stroke="#ff9a2a" stroke-width="3" fill="none" opacity=".8"/>`);
  tile('t_masmorra', 'piso', 'Piso de Masmorra', `<rect width="128" height="128" fill="#222"/><rect x="3" y="3" width="58" height="58" fill="#444"/><rect x="67" y="3" width="58" height="58" fill="#4a4a4a"/><rect x="3" y="67" width="58" height="58" fill="#404040"/><rect x="67" y="67" width="58" height="58" fill="#464646"/>${speckle(7, 128, 128, 40, ['#555', '#383838'], 1, 2)}`);
  (function () { const r = rng(8); let o = '<rect width="128" height="128" fill="#2b2b2b"/>'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const cx = 16 + x * 32 + (y % 2) * 14 + r() * 4, cy = 16 + y * 32 + r() * 4; o += `<ellipse cx="${cx}" cy="${cy}" rx="${13 + r() * 3}" ry="${12 + r() * 3}" fill="${pick(r, ['#6b6b6b', '#777', '#5f5f5f', '#808080'])}" stroke="#333" stroke-width="1.5"/>`; } tile('t_cobble', 'piso', 'Pedra Irregular', o); })();
  (function () { const r = rng(9); let o = '<rect width="128" height="128" fill="#5c3a21"/>'; for (let i = 0; i < 4; i++) { o += `<rect y="${i * 32}" width="128" height="32" fill="${pick(r, ['#6b4527', '#5c3a21', '#734b2b'])}" stroke="#362010" stroke-width="2"/>`; o += `<path d="M0 ${i * 32 + 10}h128M0 ${i * 32 + 22}h128" stroke="#4a2e18" stroke-width=".8" opacity=".6"/>`; const x = 20 + r() * 90; o += `<path d="M${x} ${i * 32}v32" stroke="#362010" stroke-width="2"/>`; } tile('t_madeira', 'piso', 'Piso de Madeira', o); })();
  (function () { const r = rng(10); let o = '<rect width="128" height="128" fill="#3a2414"/>'; for (let i = 0; i < 4; i++) { o += `<rect y="${i * 32}" width="128" height="32" fill="${pick(r, ['#47301b', '#3a2414', '#4f3520'])}" stroke="#1f1208" stroke-width="2"/>`; const x = 10 + r() * 100; o += `<path d="M${x} ${i * 32}v32" stroke="#1f1208" stroke-width="2"/>`; } tile('t_madeira_esc', 'piso', 'Madeira Escura', o); })();
  tile('t_carpete', 'piso', 'Carpete Vermelho', `<rect width="128" height="128" fill="#7a1d22"/><rect x="6" y="6" width="116" height="116" fill="none" stroke="#c9a24a" stroke-width="3"/><rect x="14" y="14" width="100" height="100" fill="none" stroke="#c9a24a" stroke-width="1" opacity=".7"/><path d="M64 28l22 36-22 36-22-36z" fill="none" stroke="#c9a24a" stroke-width="2"/>`);
  tile('t_xadrez', 'piso', 'Xadrez', `<rect width="128" height="128" fill="#d8d4c8"/><rect width="64" height="64" fill="#2a2a2e"/><rect x="64" y="64" width="64" height="64" fill="#2a2a2e"/>`);
  tile('t_cascalho', 'piso', 'Cascalho', `<rect width="128" height="128" fill="#6f6f6f"/>${speckle(11, 128, 128, 220, ['#8a8a8a', '#5a5a5a', '#9a9a9a', '#4d4d4d'], 1, 3)}`);

  // Paredes (texturas para a ferramenta de parede)
  tile('w_pedra', 'parede', 'Parede de Pedra', `<rect width="128" height="128" fill="#1f1f22"/><rect x="3" y="3" width="122" height="58" fill="#5a5a5e"/><rect x="3" y="67" width="56" height="58" fill="#4a4a4e"/><rect x="65" y="67" width="60" height="58" fill="#56565a"/>${speckle(12, 128, 128, 40, ['#666', '#444'], 1, 3)}`);
  (function () { let o = '<rect width="128" height="128" fill="#3a1f1a"/>'; for (let y = 0; y < 4; y++) for (let x = -1; x < 3; x++) o += `<rect x="${x * 64 + (y % 2) * 32 + 2}" y="${y * 32 + 2}" width="60" height="28" fill="${(x + y) % 2 ? '#9b4a3a' : '#a85443'}"/>`; tile('w_tijolo', 'parede', 'Tijolos', o); })();
  (function () { const r = rng(13); let o = '<rect width="128" height="128" fill="#241408"/>'; for (let i = 0; i < 6; i++) o += `<rect x="${i * 21 + 1}" width="19" height="128" fill="${pick(r, ['#6b4527', '#5c3a21', '#734b2b'])}"/>`; tile('w_madeira', 'parede', 'Parede de Madeira', o); })();
  tile('w_caverna', 'parede', 'Rocha de Caverna', `<rect width="128" height="128" fill="#2a2724"/>${speckle(14, 128, 128, 40, ['#3d3935', '#4a4540', '#1f1d1a'], 6, 18)}`);

  // Objetos (64px = 1 célula)
  const sh = (x, y, w, h, rx = 6) => `<rect x="${x + 3}" y="${y + 4}" width="${w}" height="${h}" rx="${rx}" fill="rgba(0,0,0,.35)"/>`;
  obj('o_mesa', 'Mesa', 2, 1, `${sh(4, 4, 120, 54, 8)}<rect x="4" y="4" width="120" height="54" rx="8" fill="#8b5a2b" stroke="#4a2f14" stroke-width="3"/><path d="M12 20h104M12 32h104M12 44h104" stroke="#6e4520" stroke-width="1.5" opacity=".7"/>`);
  obj('o_mesa_red', 'Mesa Redonda', 2, 2, `<circle cx="67" cy="68" r="56" fill="rgba(0,0,0,.35)"/><circle cx="64" cy="64" r="56" fill="#8b5a2b" stroke="#4a2f14" stroke-width="4"/><circle cx="64" cy="64" r="40" fill="none" stroke="#6e4520" stroke-width="2" opacity=".7"/>`);
  obj('o_cadeira', 'Cadeira', 1, 1, `${sh(12, 12, 38, 38)}<rect x="12" y="12" width="38" height="38" rx="6" fill="#7a4d24" stroke="#432a12" stroke-width="3"/><rect x="12" y="8" width="38" height="9" rx="3" fill="#5b3818" stroke="#432a12" stroke-width="2"/>`);
  obj('o_barril', 'Barril', 1, 1, `<circle cx="35" cy="35" r="26" fill="rgba(0,0,0,.35)"/><circle cx="32" cy="32" r="26" fill="#724925" stroke="#3a2512" stroke-width="4"/><circle cx="32" cy="32" r="18" fill="none" stroke="#2a1a0c" stroke-width="2.5"/><path d="M10 32h44" stroke="#3a2512" stroke-width="1.5"/>`);
  obj('o_caixote', 'Caixote', 1, 1, `${sh(8, 8, 48, 48, 3)}<rect x="8" y="8" width="48" height="48" rx="3" fill="#a8773f" stroke="#5a3c1a" stroke-width="3"/><path d="M8 8l48 48M56 8L8 56" stroke="#5a3c1a" stroke-width="3"/>`);
  obj('o_bau', 'Baú', 1, 1, `${sh(6, 14, 52, 36)}<rect x="6" y="14" width="52" height="36" rx="5" fill="#7a4a1e" stroke="#3d2410" stroke-width="3"/><path d="M6 30h52" stroke="#3d2410" stroke-width="2"/><rect x="12" y="14" width="6" height="36" fill="#9a8a5a"/><rect x="46" y="14" width="6" height="36" fill="#9a8a5a"/><circle cx="32" cy="30" r="5" fill="#d9b23c" stroke="#6b5412" stroke-width="2"/>`);
  obj('o_cama', 'Cama', 1, 2, `${sh(6, 6, 52, 116)}<rect x="6" y="6" width="52" height="116" rx="6" fill="#6b4423" stroke="#3a2310" stroke-width="3"/><rect x="11" y="11" width="42" height="106" rx="4" fill="#ddd6c4"/><rect x="15" y="15" width="34" height="22" rx="6" fill="#f3efe4" stroke="#bfb8a4" stroke-width="2"/><rect x="11" y="48" width="42" height="69" rx="4" fill="#3d5a99" stroke="#27396a" stroke-width="2"/>`);
  obj('o_fogueira', 'Fogueira', 1, 1, `<circle cx="32" cy="32" r="26" fill="#3a3a3a" stroke="#222" stroke-width="3"/><circle cx="32" cy="32" r="18" fill="#1a1410"/><path d="M12 44L52 20M14 22L50 46" stroke="#5a3a1e" stroke-width="6" stroke-linecap="round"/><path d="M32 10Q46 32 32 52Q18 32 32 10" fill="#e65c00"/><path d="M32 20Q41 35 32 47Q24 35 32 20" fill="#ffb833"/>`);
  obj('o_pilar', 'Pilar', 1, 1, `<defs><radialGradient id="g"><stop offset="0" stop-color="#b9b9c0"/><stop offset="1" stop-color="#6d6d74"/></radialGradient></defs><circle cx="35" cy="35" r="24" fill="rgba(0,0,0,.35)"/><circle cx="32" cy="32" r="24" fill="url(#g)" stroke="#44444a" stroke-width="3"/><circle cx="32" cy="32" r="14" fill="none" stroke="#55555c" stroke-width="2"/>`);
  (function () { const r = rng(21); let o = '<circle cx="104" cy="106" r="84" fill="rgba(0,0,0,.3)"/><circle cx="96" cy="96" r="84" fill="#1f5a22"/>'; for (let i = 0; i < 30; i++) { const a = r() * 6.283, d = r() * 70; o += `<circle cx="${(96 + Math.cos(a) * d).toFixed(1)}" cy="${(96 + Math.sin(a) * d).toFixed(1)}" r="${(10 + r() * 18).toFixed(1)}" fill="${pick(r, ['#2c7a2e', '#256b27', '#348a35', '#1a4d1d'])}"/>`; } o += '<circle cx="96" cy="96" r="84" fill="none" stroke="#143b16" stroke-width="3"/>'; obj('o_arvore', 'Árvore', 3, 3, o); })();
  (function () { const r = rng(22); let o = '<circle cx="35" cy="35" r="24" fill="rgba(0,0,0,.3)"/>'; for (let i = 0; i < 9; i++) { const a = r() * 6.283, d = r() * 14; o += `<circle cx="${(32 + Math.cos(a) * d).toFixed(1)}" cy="${(32 + Math.sin(a) * d).toFixed(1)}" r="${(9 + r() * 8).toFixed(1)}" fill="${pick(r, ['#2c7a2e', '#348a35', '#1f6322'])}"/>`; } obj('o_arbusto', 'Arbusto', 1, 1, o); })();
  obj('o_rocha', 'Rocha', 1, 1, `<polygon points="14,40 18,22 32,12 48,18 54,36 44,52 24,54" fill="rgba(0,0,0,.3)" transform="translate(3 4)"/><polygon points="14,40 18,22 32,12 48,18 54,36 44,52 24,54" fill="#7d7d84" stroke="#4a4a50" stroke-width="3"/><polygon points="22,26 32,18 44,24 36,34" fill="#9a9aa2"/>`);
  obj('o_porta', 'Porta', 1, 1, `<rect x="2" y="22" width="60" height="20" fill="#6b4423" stroke="#3a2310" stroke-width="3"/><path d="M32 22v20" stroke="#3a2310" stroke-width="2"/><circle cx="26" cy="32" r="2.5" fill="#d9b23c"/><circle cx="38" cy="32" r="2.5" fill="#d9b23c"/>`);
  obj('o_porta_dupla', 'Porta Dupla', 2, 1, `<rect x="2" y="22" width="124" height="20" fill="#6b4423" stroke="#3a2310" stroke-width="3"/><path d="M64 22v20M33 22v20M95 22v20" stroke="#3a2310" stroke-width="2"/><circle cx="58" cy="32" r="2.5" fill="#d9b23c"/><circle cx="70" cy="32" r="2.5" fill="#d9b23c"/>`);
  (function () { let o = '<rect x="4" y="2" width="56" height="124" fill="#8a8a90" stroke="#44444a" stroke-width="3"/>'; for (let i = 1; i < 8; i++) o += `<path d="M4 ${i * 16 + 2}h56" stroke="#5a5a60" stroke-width="3"/><path d="M4 ${i * 16 + 4}h56" stroke="#a8a8ae" stroke-width="1.5"/>`; obj('o_escada', 'Escada', 1, 2, o); })();
  obj('o_poco', 'Poço', 1, 1, `<circle cx="35" cy="35" r="28" fill="rgba(0,0,0,.35)"/><circle cx="32" cy="32" r="28" fill="#6d6d74" stroke="#3a3a40" stroke-width="3"/><circle cx="32" cy="32" r="19" fill="#1d5a8a" stroke="#2a2a30" stroke-width="3"/><circle cx="32" cy="32" r="11" fill="none" stroke="#5aa5d6" stroke-width="1.5" opacity=".6"/>`);
  obj('o_tapete', 'Tapete', 2, 3, `<rect x="6" y="6" width="116" height="180" rx="4" fill="#8c2a2a" stroke="#c9a24a" stroke-width="4"/><rect x="18" y="18" width="92" height="156" fill="none" stroke="#c9a24a" stroke-width="2"/><path d="M64 50l28 46-28 46-28-46z" fill="none" stroke="#c9a24a" stroke-width="3"/>`);
  (function () { const r = rng(23); let o = `${sh(2, 6, 124, 52, 4)}<rect x="2" y="6" width="124" height="52" rx="4" fill="#5c3a21" stroke="#2f1d10" stroke-width="3"/>`; for (let i = 0; i < 14; i++) o += `<rect x="${8 + i * 8.4}" y="${12 + (i % 3)}" width="6.5" height="40" fill="${pick(r, ['#9b3a3a', '#3a5a9b', '#3a8a5a', '#c9a24a', '#6a3a8a'])}"/>`; obj('o_estante', 'Estante', 2, 1, o); })();

  // ---- Pacote extra: natureza, masmorra, mais pisos e paredes ----
  tile('t_lama', 'piso', 'Lama', `<rect width="128" height="128" fill="#4a3a28"/>${speckle(31, 128, 128, 60, ['#3b2e1f', '#5a4731', '#2e2418'], 3, 9)}<path d="M0 40q30-12 60 0t68-4M0 96q40-14 70 2t58-6" stroke="#6b583f" stroke-width="2" fill="none" opacity=".5"/>`);
  tile('t_gelo', 'piso', 'Gelo', `<rect width="128" height="128" fill="#bfe3f2"/><path d="M0 30l40 20 30-15 58 25M20 128l30-50 30 12 40-40M90 0l-10 40 30 20" stroke="#ffffff" stroke-width="2" fill="none" opacity=".7"/>${speckle(32, 128, 128, 30, ['#9ccfe6', '#e6f6fc'], 2, 8)}`);
  tile('t_folhas', 'piso', 'Chão de Floresta', `<rect width="128" height="128" fill="#3d3a1f"/>${speckle(33, 128, 128, 80, ['#5a5226', '#6b5a2a', '#2f4a1e', '#7a4a1e'], 2, 6)}${blades(34, 128, 128, 30, ['#4a7a2a', '#2f5a1c'])}`);
  tile('t_marmore', 'piso', 'Mármore', `<rect width="128" height="128" fill="#d9d9dd"/><rect x="2" y="2" width="124" height="124" fill="none" stroke="#9a9aa2" stroke-width="3"/><path d="M10 20q30 10 50 40t60 20M30 128q10-40 40-60t50-30" stroke="#b9b9c4" stroke-width="2" fill="none"/>`);
  (function () { let o = '<rect width="128" height="128" fill="#3a2414"/>'; for (let i = 0; i < 8; i++) o += `<rect x="${i * 16 + 1}" y="0" width="14" height="128" fill="${i % 2 ? '#7a5230' : '#6b4527'}" stroke="#2a170a" stroke-width="2"/>`; o += '<path d="M0 20h128M0 108h128" stroke="#2a170a" stroke-width="4"/>'; tile('t_ponte', 'piso', 'Ponte de Madeira', o); })();
  tile('w_cerca', 'parede', 'Cerca de Madeira', `<rect width="128" height="128" fill="#4a2f16"/><rect x="0" y="24" width="128" height="26" fill="#8a6234" stroke="#2a170a" stroke-width="3"/><rect x="0" y="78" width="128" height="26" fill="#7a5530" stroke="#2a170a" stroke-width="3"/>`);
  tile('w_marmore', 'parede', 'Parede de Mármore', `<rect width="128" height="128" fill="#8a8a94"/><rect x="3" y="3" width="122" height="122" fill="#c9c9d2" stroke="#6a6a74" stroke-width="3"/><path d="M10 30q30 10 50 40t60 20" stroke="#aaaab6" stroke-width="2" fill="none"/>`);
  tile('w_gelo', 'parede', 'Parede de Gelo', `<rect width="128" height="128" fill="#7fb5cf"/><path d="M0 40l40 20 30-15 58 25M20 128l30-50 30 12 40-40" stroke="#e8f8ff" stroke-width="3" fill="none" opacity=".8"/>${speckle(35, 128, 128, 20, ['#a9d7ea', '#5f9db9'], 4, 12)}`);
  obj('o_tocha', 'Tocha de Parede', 1, 1, `<circle cx="32" cy="32" r="10" fill="#3a2a1a" stroke="#1a120a" stroke-width="3"/><path d="M32 12Q42 30 32 44Q22 30 32 12" fill="#e65c00"/><path d="M32 20Q38 31 32 40Q26 31 32 20" fill="#ffd34d"/>`, 'masmorra');
  obj('o_estatua', 'Estátua', 1, 1, `<circle cx="35" cy="35" r="25" fill="rgba(0,0,0,.35)"/><rect x="8" y="8" width="48" height="48" rx="4" fill="#9a9aa2" stroke="#55555c" stroke-width="3"/><circle cx="32" cy="32" r="12" fill="#c4c4cc" stroke="#6a6a74" stroke-width="2"/><path d="M12 32h40M32 12v40" stroke="#6a6a74" stroke-width="3" opacity=".6"/>`, 'masmorra');
  obj('o_altar', 'Altar', 2, 1, `${sh(4, 8, 120, 48, 4)}<rect x="4" y="8" width="120" height="48" rx="4" fill="#8a8a94" stroke="#44444c" stroke-width="3"/><rect x="14" y="16" width="100" height="32" fill="#6f6f7a" stroke="#44444c" stroke-width="2"/><circle cx="64" cy="32" r="9" fill="#a83232" stroke="#3a1010" stroke-width="2"/>`, 'masmorra');
  obj('o_coluna_q', 'Coluna Quebrada', 1, 1, `<polygon points="14,38 18,18 34,10 50,16 54,34 44,52 22,52" fill="rgba(0,0,0,.3)" transform="translate(3 4)"/><polygon points="14,38 18,18 34,10 50,16 54,34 44,52 22,52" fill="#8a8a92" stroke="#4a4a52" stroke-width="3"/><path d="M20 24l14 6 14-8M24 44l10-12" stroke="#5a5a62" stroke-width="2" fill="none"/>`, 'masmorra');
  obj('o_cogumelos', 'Cogumelos', 1, 1, `<circle cx="22" cy="36" r="13" fill="#b5483a" stroke="#6a2a20" stroke-width="2"/><circle cx="19" cy="33" r="3" fill="#f3e3c8"/><circle cx="26" cy="40" r="2.5" fill="#f3e3c8"/><circle cx="44" cy="22" r="10" fill="#8a5ab5" stroke="#4a2a6a" stroke-width="2"/><circle cx="46" cy="44" r="8" fill="#c9a24a" stroke="#6b5412" stroke-width="2"/>`, 'natureza');
  obj('o_ossos', 'Pilha de Ossos', 1, 1, `<path d="M12 40l36-18M16 22l30 22M20 50l26-8" stroke="#e8e0cc" stroke-width="5" stroke-linecap="round"/><circle cx="12" cy="40" r="3.5" fill="#e8e0cc"/><circle cx="48" cy="22" r="3.5" fill="#e8e0cc"/><circle cx="34" cy="32" r="9" fill="#efe8d6" stroke="#9a9280" stroke-width="2"/><circle cx="31" cy="30" r="2" fill="#2a2620"/><circle cx="37" cy="30" r="2" fill="#2a2620"/>`, 'masmorra');
  obj('o_tenda', 'Tenda', 2, 2, `<polygon points="64,8 120,120 8,120" fill="rgba(0,0,0,.3)" transform="translate(5 6)"/><polygon points="64,8 120,120 8,120" fill="#b89a5e" stroke="#5a4520" stroke-width="4"/><polygon points="64,8 64,120 8,120" fill="#a38648"/><path d="M64 8V120" stroke="#5a4520" stroke-width="3"/><polygon points="64,60 84,120 44,120" fill="#2a1c0c"/>`, 'natureza');
  obj('o_sarcofago', 'Sarcófago', 1, 2, `${sh(8, 6, 48, 116, 10)}<rect x="8" y="6" width="48" height="116" rx="10" fill="#8f8f98" stroke="#44444c" stroke-width="3"/><rect x="16" y="14" width="32" height="100" rx="8" fill="#a9a9b2" stroke="#55555c" stroke-width="2"/><path d="M32 30v60M22 44h20" stroke="#55555c" stroke-width="3"/>`, 'masmorra');
  obj('o_lareira', 'Lareira', 2, 1, `<rect x="2" y="4" width="124" height="56" fill="#6f6f78" stroke="#33333a" stroke-width="3"/><rect x="18" y="16" width="92" height="40" fill="#1a1410"/><path d="M64 22Q80 40 64 54Q48 40 64 22" fill="#e65c00"/><path d="M64 30Q72 42 64 52Q56 42 64 30" fill="#ffd34d"/>`);
  obj('o_banco', 'Banco', 2, 1, `${sh(6, 18, 116, 28, 5)}<rect x="6" y="18" width="116" height="28" rx="5" fill="#8b5a2b" stroke="#4a2f14" stroke-width="3"/><path d="M14 32h100" stroke="#6e4520" stroke-width="2" opacity=".7"/>`);
  obj('o_teia', 'Teia de Aranha', 1, 1, `<g stroke="#e9e9ee" stroke-width="1.6" fill="none" opacity=".85"><path d="M2 2L62 62M2 22L42 62M22 2L62 42M2 2Q22 30 62 62"/><path d="M12 12Q30 8 36 36Q8 30 12 12M24 24Q40 20 44 44Q20 40 24 24" /></g>`, 'masmorra');
  obj('o_armadilha', 'Armadilha de Espinhos', 1, 1, `<rect x="6" y="6" width="52" height="52" fill="#3a3a40" stroke="#1a1a1e" stroke-width="3"/>${[0, 1, 2].map(i => [0, 1, 2].map(j => `<polygon points="${14 + i * 18},${12 + j * 18} ${20 + i * 18},${26 + j * 18} ${8 + i * 18},${26 + j * 18}" fill="#c4c4cc" stroke="#555" stroke-width="1"/>`).join('')).join('')}`, 'masmorra');
  ['o_arvore', 'o_arbusto', 'o_rocha', 'o_poco'].forEach(id => { const a = B.find(x => x.id === id); if (a) a.cat = 'natureza'; });
  ['o_pilar', 'o_escada'].forEach(id => { const a = B.find(x => x.id === id); if (a) a.cat = 'masmorra'; });

  // ---------- Registro ----------
  const BUILTIN_CATS = [
    { id: 'piso', name: 'Pisos', kind: 'tile', builtin: true },
    { id: 'parede', name: 'Paredes', kind: 'tile', builtin: true },
    { id: 'objeto', name: 'Objetos', kind: 'object', builtin: true },
    { id: 'natureza', name: 'Natureza', kind: 'object', builtin: true },
    { id: 'masmorra', name: 'Masmorra', kind: 'object', builtin: true }
  ];
  const A = FM.assets = {
    cats: BUILTIN_CATS.slice(), list: [], byId: {}, imgs: {}, ready: false,
    get(id) { return this.byId[id]; },
    byCat(id) { return this.list.filter(a => a.cat === id); },
    cat(id) { return this.cats.find(c => c.id === id); },
    kind(id) { const a = this.byId[id]; const c = a && this.cat(a.cat); return c ? c.kind : 'tile'; },
    _reg(a) { if (!this.byId[a.id]) this.list.push(a); this.byId[a.id] = a; },
    async init() {
      B.forEach(a => this._reg(a));
      await FM.db.open();
      const cats = await FM.db.all('cats'); cats.forEach(c => { if (!this.cat(c.id)) this.cats.push(c); });
      const as = await FM.db.all('assets'); as.forEach(a => this._reg(a));
      this.ready = true;
    },
    async add(a) { this._reg(a); delete this.imgs[a.id]; await FM.db.put('assets', a); },
    async update(a) { this.byId[a.id] = a; const i = this.list.findIndex(x => x.id === a.id); if (i >= 0) this.list[i] = a; await FM.db.put('assets', a); },
    async remove(id) { const a = this.byId[id]; if (!a || a.builtin) return; delete this.byId[id]; delete this.imgs[id]; if (FM.dropPattern) FM.dropPattern(id); this.list = this.list.filter(x => x.id !== id); await FM.db.del('assets', id); },
    async addCat(c) { this.cats.push(c); await FM.db.put('cats', c); },
    async removeCat(id) { const c = this.cat(id); if (!c || c.builtin) return; for (const a of this.byCat(id).slice()) await this.remove(a.id); this.cats = this.cats.filter(x => x.id !== id); await FM.db.del('cats', id); },
    img(id) {
      let e = this.imgs[id]; if (e) return e.ok ? e.img : null;
      const a = this.byId[id]; if (!a) return null;
      const im = new Image(); e = this.imgs[id] = { img: im, ok: false };
      im.onload = () => { e.ok = true; FM.requestRender && FM.requestRender(); };
      im.src = a.src; return null;
    },
    load(id) { return new Promise(res => { const a = this.byId[id]; if (!a) return res(null); this.img(id); const e = this.imgs[id]; if (e.ok) return res(e.img); e.img.addEventListener('load', () => res(e.img)); e.img.addEventListener('error', () => res(null)); }); },
    uid() { return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  };
})();
