// Exportação: imagens, Universal VTT, Foundry, Owlbear Rodeo, Roll20, PDF em escala, camadas (ZIP)
(function () {
  const FM = window.FM, S = FM.state, P = () => S.project;
  const enc = new TextEncoder();
  const safe = s => (s || 'mapa').replace(/[^\w\-À-ÿ ]+/g, '').trim().replace(/\s+/g, '_') || 'mapa';
  const toBlob = (c, type, q) => new Promise(res => c.toBlob(res, type, q));
  const u8 = async blob => new Uint8Array(await blob.arrayBuffer());
  const b64 = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
  const hex2 = c => { const n = parseInt(c.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hexs = (r, g, b) => [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const round = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n;

  // ---------- ZIP (sem compressão, sem dependências) ----------
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = a => { let c = 0xFFFFFFFF; for (let i = 0; i < a.length; i++) c = crcT[(c ^ a[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) { // files: [{name, data: Uint8Array}]
    const parts = [], central = []; let off = 0;
    for (const f of files) {
      const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length, lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(lh.buffer), nm, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nm); off += 30 + nm.length + sz;
    }
    const cd = central.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }
  const txt = (name, s) => ({ name, data: enc.encode(s) });

  // ---------- PDF (páginas com JPEG, escala real) ----------
  function pdf(pages) { // pages: [{w,h (pt), jpeg:Uint8Array, jw, jh, x,y,iw,ih (pt), marks:[[x1,y1,x2,y2]], label}]
    const chunks = [], offs = []; let len = 0;
    const push = d => { const a = typeof d === 'string' ? enc.encode(d) : d; chunks.push(a); len += a.length; };
    const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n${body}\nendobj\n`); };
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'); const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
    pages.forEach((p, i) => {
      const pg = 3 + i * 3, ct = pg + 1, im = pg + 2;
      obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.w} ${p.h}] /Resources << /XObject << /Im0 ${im} 0 R >> /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${ct} 0 R >>`);
      let c = `q ${round(p.iw, 2)} 0 0 ${round(p.ih, 2)} ${round(p.x, 2)} ${round(p.y, 2)} cm /Im0 Do Q\n0.4 w 0.5 G\n`;
      p.marks.forEach(m => { c += `${round(m[0], 2)} ${round(m[1], 2)} m ${round(m[2], 2)} ${round(m[3], 2)} l S\n`; });
      c += `BT /F1 7 Tf 0.4 g ${round(p.x, 2)} ${round(Math.max(6, p.y - 12), 2)} Td (${p.label.replace(/[()\\]/g, '')}) Tj ET\n`;
      obj(ct, `<< /Length ${c.length} >>\nstream\n${c}endstream`);
      offs[im] = len; push(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.jw} /Height ${p.jh} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`); push(p.jpeg); push('\nendstream\nendobj\n');
    });
    const n = 3 + pages.length * 3, xr = len; push(`xref\n0 ${n}\n0000000000 65535 f \n`);
    for (let i = 1; i < n; i++) push(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
    push(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  // ---------- Planejamento de escala para VTTs ----------
  function plan(o) {
    const m = P().map, MS = FM.mapSize(); let ppg = o.ppg > 0 ? o.ppg : m.cell;
    if (o.maxSide > 0) { const side = Math.max(MS.W, MS.H) / m.cell * ppg; if (side > o.maxSide) ppg = Math.floor(ppg * o.maxSide / side); }
    ppg = Math.max(8, Math.floor(ppg)); return { ppg, s: ppg / m.cell, W: Math.round(MS.W / m.cell * ppg), H: Math.round(MS.H / m.cell * ppg) };
  }
  const imgType = f => f === 'jpg' ? ['image/jpeg', 'jpg'] : f === 'webp' ? ['image/webp', 'webp'] : ['image/png', 'png'];
  async function renderImage(o, pl, fmt) {
    const c = await FM.exportCanvas(pl.s, !!o.grid, { noLights: o.light !== 'embed' }), [type, ext] = imgType(fmt || 'png');
    return { blob: await toBlob(c, type, (o.quality || 90) / 100), ext, canvas: c };
  }

  // ---------- Dados para VTT (paredes, portas, luzes) ----------
  function vttData(o, pl) {
    const m = P().map, c = m.cell, g = v => round(v / c, 3), s = pl.s;
    const los = FM.blockers({ noDoors: true }).map(b => [{ x: g(b.x1), y: g(b.y1) }, { x: g(b.x2), y: g(b.y2) }]);
    const doors = P().items.filter(i => i.type === 'door' && i.style !== 'arch' && FM.layer(i.layer).visible);
    const lights = o.light === 'data' ? P().items.filter(i => i.type === 'light' && FM.layer(i.layer).visible) : [];
    return { c, g, s, los, doors, lights, segs: FM.blockers({ noDoors: true }) };
  }
  async function buildUVTT(o, pl, img) {
    const m = P().map, d = vttData(o, pl), amb = hex2(m.ambientColor), k = Math.min(1, m.ambient);
    const ambient = o.light === 'data' && m.ambient > 0 ? 'ff' + hexs(255 + (amb[0] - 255) * k, 255 + (amb[1] - 255) * k, 255 + (amb[2] - 255) * k) : 'ffffffff';
    const json = {
      format: 0.3,
      resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: round(pl.W / pl.ppg, 3), y: round(pl.H / pl.ppg, 3) }, pixels_per_grid: pl.ppg },
      line_of_sight: d.los, objects_line_of_sight: [],
      portals: d.doors.map(i => { const a = (i.ang || 0) * Math.PI / 180, hx = Math.cos(a) * i.len / 2, hy = Math.sin(a) * i.len / 2; return { position: { x: d.g(i.x), y: d.g(i.y) }, bounds: [{ x: d.g(i.x - hx), y: d.g(i.y - hy) }, { x: d.g(i.x + hx), y: d.g(i.y + hy) }], rotation: round(a, 5), closed: !i.open, freestanding: false }; }),
      environment: { baked_lighting: o.light === 'embed' && (m.ambient > 0 || P().items.some(i => i.type === 'light')), ambient_light: ambient },
      lights: d.lights.map(l => ({ position: { x: d.g(l.x), y: d.g(l.y) }, range: round(l.r / d.c, 2), intensity: l.intensity, color: 'ff' + hexs(...hex2(l.color)), shadows: l.shadows !== false })),
      image: await b64(img.blob)
    };
    return JSON.stringify(json);
  }
  async function buildFoundry(o, pl, imgName) {
    const m = P().map, d = vttData(o, pl), s = pl.s;
    const walls = d.segs.map(b => ({ c: [Math.round(b.x1 * s), Math.round(b.y1 * s), Math.round(b.x2 * s), Math.round(b.y2 * s)], move: 20, sense: 20, sound: 20, light: 20, door: 0, ds: 0, dir: 0 }));
    d.doors.forEach(i => { const a = (i.ang || 0) * Math.PI / 180, hx = Math.cos(a) * i.len / 2, hy = Math.sin(a) * i.len / 2; walls.push({ c: [Math.round((i.x - hx) * s), Math.round((i.y - hy) * s), Math.round((i.x + hx) * s), Math.round((i.y + hy) * s)], move: 20, sense: 20, sound: 20, light: 20, door: 1, ds: i.open ? 1 : 0, dir: 0 }); });
    const dist = m.unitVal;
    return JSON.stringify({
      name: P().name, active: false, navigation: false, padding: 0, width: pl.W, height: pl.H,
      background: { src: 'maps/' + imgName }, initial: { x: Math.round(pl.W / 2), y: Math.round(pl.H / 2), scale: 0.5 },
      grid: { type: 1, size: pl.ppg, distance: dist, units: m.unitName, color: '#000000', alpha: 0.2 },
      tokenVision: true, fogExploration: true, globalLight: m.ambient < 0.05, walls,
      lights: d.lights.map(l => ({ x: Math.round(l.x * s), y: Math.round(l.y * s), config: { dim: round(l.r / d.c * dist, 2), bright: round(l.r / d.c * dist / 2, 2), color: l.color, alpha: l.intensity * 0.5 } })),
      flags: { forjamap: { version: 3, note: 'Gerado pelo ForjaMap Pro' } }
    }, null, 2);
  }

  // ---------- Formatos ----------
  const F = FM.exporter = {};
  F.formats = [
    { id: 'png', group: 'Imagem', name: 'PNG', desc: 'Imagem sem perdas. Ideal para qualquer VTT e para edição.' },
    { id: 'jpg', group: 'Imagem', name: 'JPEG', desc: 'Menor tamanho de arquivo (com perdas). Bom para limites de upload.' },
    { id: 'webp', group: 'Imagem', name: 'WebP', desc: 'Tamanho muito menor que PNG, com boa qualidade.' },
    { id: 'uvtt', group: 'VTT', name: 'Universal VTT (.dd2vtt / .uvtt)', desc: 'Imagem + paredes + portas + luzes em um arquivo. Aceito por Roll20 (upload de UVTT), Fantasy Grounds Unity, Arkenforge e, via módulo, Foundry VTT.' },
    { id: 'foundry', group: 'VTT', name: 'Foundry VTT (ZIP: cena .json + imagem)', desc: 'Cena com grade, paredes, portas e luzes. A imagem precisa ser copiada para a pasta de dados do Foundry (veja o LEIA-ME no ZIP).' },
    { id: 'owlbear', group: 'VTT', name: 'Owlbear Rodeo (ZIP: imagem + UVTT)', desc: 'Imagem na resolução certa para alinhar a grade + arquivo UVTT para extensões de névoa/paredes (Dynamic Fog, Smoke & Spectre, importadores de cena).' },
    { id: 'roll20', group: 'VTT', name: 'Roll20 (ZIP: UVTT 70 px/célula + imagem)', desc: 'UVTT com 70 px por célula (padrão do Roll20) para Iluminação Dinâmica, mais a imagem avulsa.' },
    { id: 'pdf', group: 'Outros', name: 'PDF para impressão em escala real', desc: 'Divide o mapa em páginas A4/Carta com marcas de corte, na escala escolhida (ex.: 1 polegada por célula).' },
    { id: 'layers', group: 'Outros', name: 'Camadas separadas (ZIP de PNGs)', desc: 'Um PNG transparente por camada visível, para editar em outros programas.' },
    { id: 'project', group: 'Outros', name: 'Projeto ForjaMap (.json)', desc: 'Arquivo editável com seus assets personalizados embutidos.' }
  ];
  F.defaults = () => ({ scale: 1, grid: false, light: 'embed', quality: 90, ppg: 140, maxSide: 0, imgFmt: 'png', ext: 'dd2vtt', paper: 'a4', ipc: 1, orient: 'auto' });

  F.info = (id, o) => {
    const m = P().map, MS = FM.mapSize(), cells = `${m.cols} × ${m.rows} células`;
    if (['png', 'jpg', 'webp'].includes(id)) { const W = Math.round(MS.W * o.scale), H = Math.round(MS.H * o.scale); return `${cells} · imagem ${W} × ${H}px · ${Math.round(m.cell * o.scale)}px por célula`; }
    if (['uvtt', 'foundry', 'owlbear', 'roll20'].includes(id)) { const pl = plan(id === 'roll20' ? Object.assign({}, o, { ppg: 70 }) : o); return `${cells} · imagem ${pl.W} × ${pl.H}px · ${pl.ppg}px por célula (informe este valor ao importar)`; }
    if (id === 'pdf') { const w = MS.W / m.cell * o.ipc, h = MS.H / m.cell * o.ipc; return `Tamanho impresso: ${w.toFixed(1)} × ${h.toFixed(1)} polegadas (${(w * 2.54).toFixed(0)} × ${(h * 2.54).toFixed(0)} cm)`; }
    return cells;
  };

  F.run = async function (id, o) {
    const base = safe(P().name), m = P().map, hex = FM.isHex();
    if (['png', 'jpg', 'webp'].includes(id)) { const pl = { s: o.scale, ppg: m.cell * o.scale }, im = await renderImage(Object.assign({}, o, { light: o.light === 'embed' ? 'embed' : 'none' }), pl, id); return { name: `${base}_${m.cols}x${m.rows}_${Math.round(m.cell * o.scale)}pxgrid.${im.ext}`, blob: im.blob }; }
    if (id === 'project') return { name: base + '.forjamap.json', blob: null, project: true };
    if (id === 'layers') {
      const files = [], Ls = P().layers.filter(l => l.visible && P().items.some(i => i.layer === l.id && i.type !== 'light')); if (!Ls.length) throw new Error('Nenhuma camada visível com itens.');
      for (const [k, L] of Ls.entries()) { const c = await FM.exportCanvas(o.scale, false, { layer: L.id, nobg: true }); files.push({ name: `${String(k + 1).padStart(2, '0')}_${safe(L.name)}.png`, data: await u8(await toBlob(c, 'image/png')) }); }
      files.push(txt('LEIA-ME.txt', `Camadas do mapa "${P().name}" (de baixo para cima). Todas têm o mesmo tamanho e podem ser empilhadas.\nTamanho da célula nesta exportação: ${Math.round(m.cell * o.scale)}px.\nA opacidade/mesclagem de cada camada não é aplicada nos arquivos.\n`));
      return { name: base + '_camadas.zip', blob: zip(files) };
    }
    if (id === 'pdf') return pdfExport(o);
    // --- VTTs ---
    const eff = id === 'roll20' ? Object.assign({}, o, { ppg: 70, maxSide: 0 }) : o, pl = plan(eff);
    if (hex && id !== 'owlbear') throw new Error('Grades hexagonais não são suportadas por este formato. Use PNG/JPEG/WebP ou o pacote Owlbear Rodeo.');
    const lightEff = hex ? 'embed' : o.light;
    if (id === 'uvtt') { const im = await renderImage(Object.assign({}, eff, { light: lightEff }), pl, 'png'); return { name: `${base}.${o.ext}`, blob: new Blob([await buildUVTT(Object.assign({}, eff, { light: lightEff }), pl, im)], { type: 'application/json' }) }; }
    const im = await renderImage(Object.assign({}, eff, { light: lightEff }), pl, id === 'roll20' ? 'png' : o.imgFmt), imgName = `${base}.${im.ext}`, files = [{ name: imgName, data: await u8(im.blob) }];
    if (id === 'foundry') {
      files.push(txt(`${base}_cena.json`, await buildFoundry(Object.assign({}, eff, { light: lightEff }), pl, imgName)));
      files.push(txt('LEIA-ME.txt', `ForjaMap → Foundry VTT\n\n1) Copie "${imgName}" para a pasta de dados do Foundry (por exemplo: Data/maps/${imgName}).\n2) Crie uma cena (ou abra uma existente), clique com o botão direito e escolha importar dados (Import Data), selecionando "${base}_cena.json". Ajuste o caminho da imagem de fundo se necessário.\n3) A grade foi configurada com ${pl.ppg}px por célula (${m.unitVal} ${m.unitName} por célula).\n\nAlternativa mais testada pela comunidade: exporte "Universal VTT (.dd2vtt)" e importe com o módulo "Universal Battlemap Importer".\nO formato de cena do Foundry muda entre versões; se algum campo não for aceito, use a opção UVTT.\n`));
      return { name: base + '_foundry.zip', blob: zip(files) };
    }
    const uv = await buildUVTT(Object.assign({}, eff, { light: lightEff }), pl, im);
    files.push(txt(`${base}.dd2vtt`, uv));
    if (id === 'owlbear') files.push(txt('LEIA-ME.txt', `ForjaMap → Owlbear Rodeo\n\n1) Crie/abra uma cena e envie "${imgName}" como mapa.\n2) No editor de grade ao enviar o mapa, use ${pl.ppg}px por célula (o mapa tem ${m.cols} × ${m.rows} células)${hex ? '; escolha o tipo de grade hexagonal correspondente (' + (m.grid === 'hexp' ? 'ponta para cima' : 'ponta para o lado') + ')' : ''}.\n3) O Owlbear Rodeo não traz iluminação dinâmica nativa: para paredes, portas e luzes, instale uma extensão de névoa (ex.: Dynamic Fog ou Smoke & Spectre) ou um importador de cenas e importe "${base}.dd2vtt".\n4) Se o upload falhar por tamanho, exporte de novo reduzindo "Dimensão máxima" ou usando JPEG/WebP.\n${hex ? '\nObs.: o arquivo .dd2vtt usa grade quadrada e não representa hexágonos; use-o apenas pelas paredes/luzes se necessário.\n' : ''}`));
    else files.push(txt('LEIA-ME.txt', `ForjaMap → Roll20\n\n1) No menu da página (Page Menu) use o upload de UVTT e escolha "${base}.dd2vtt": a imagem vai para a camada de mapa e paredes, portas e luzes para a camada de Iluminação Dinâmica (recursos dinâmicos dependem do seu plano).\n2) A imagem avulsa "${imgName}" está incluída caso queira enviar manualmente (${pl.ppg}px por célula = 1 unidade de 70px).\n3) Se a iluminação ficar duplicada/clara demais, exporte com "Iluminação: apenas como dados" ou "nenhuma".\n`));
    return { name: `${base}_${id}.zip`, blob: zip(files) };
  };

  async function pdfExport(o) {
    const m = P().map, MS = FM.mapSize(), DPI = 150, ipc = o.ipc, mapWin = MS.W / m.cell * ipc, mapHin = MS.H / m.cell * ipc;
    const size = o.paper === 'letter' ? [612, 792] : [595.28, 841.89], mg = 28.35;
    const pagesFor = (pw, ph) => Math.ceil(mapWin * 72 / (pw - 2 * mg)) * Math.ceil(mapHin * 72 / (ph - 2 * mg));
    let [pw, ph] = size; if (o.orient === 'landscape' || (o.orient === 'auto' && pagesFor(ph, pw) < pagesFor(pw, ph))) [pw, ph] = [ph, pw];
    const s = ipc * DPI / m.cell, full = await FM.exportCanvas(s, o.grid !== false, { noLights: o.light !== 'embed' });
    const cw = pw - 2 * mg, ch = ph - 2 * mg, nx = Math.ceil(mapWin * 72 / cw), ny = Math.ceil(mapHin * 72 / ch), pages = [], k = DPI / 72;
    if (nx * ny > 120) throw new Error(`O mapa geraria ${nx * ny} páginas. Reduza a escala (polegadas por célula).`);
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
      const sx = c * cw, sy = r * ch, wpt = Math.min(cw, mapWin * 72 - sx), hpt = Math.min(ch, mapHin * 72 - sy);
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(wpt * k)); cv.height = Math.max(1, Math.round(hpt * k)); cv.getContext('2d').drawImage(full, Math.round(sx * k), Math.round(sy * k), cv.width, cv.height, 0, 0, cv.width, cv.height);
      const x = mg, y = ph - mg - hpt, t = 8;
      pages.push({ w: pw, h: ph, jpeg: await u8(await toBlob(cv, 'image/jpeg', 0.9)), jw: cv.width, jh: cv.height, x, y, iw: wpt, ih: hpt, label: `${P().name} - linha ${r + 1}/${ny}, coluna ${c + 1}/${nx} - escala ${ipc} pol./celula`,
        marks: [[x - t, y + hpt, x, y + hpt], [x, y + hpt, x, y + hpt + t], [x + wpt, y + hpt, x + wpt + t, y + hpt], [x + wpt, y + hpt, x + wpt, y + hpt + t], [x - t, y, x, y], [x, y, x, y - t], [x + wpt, y, x + wpt + t, y], [x + wpt, y, x + wpt, y - t]] });
    }
    return { name: safe(P().name) + `_${ipc}pol-por-celula.pdf`, blob: pdf(pages), pages: pages.length };
  }
  F.zip = zip;
})();
