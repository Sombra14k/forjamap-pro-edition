// Interface: biblioteca, camadas, propriedades, opções de ferramenta, diálogos, projeto, atalhos
(function () {
  const FM = window.FM, S = FM.state, O = FM.opts, I = FM.icon;
  const $ = id => document.getElementById(id);
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = () => S.project, cell = () => P().map.cell;
  const r2 = v => Math.round(v * 100) / 100;
  const U = FM.ui = {};
  let lib = { cat: 'piso', q: '' }, propsLock = false, clip = [];

  // ---------- Toast / Modais ----------
  U.toast = msg => { if (!msg) return; const t = el(`<div class="toast">${esc(msg)}</div>`); $('toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100); };
  U.modal = ({ title, body, buttons = [], wide }) => {
    const ov = el(`<div class="overlay"><div class="modal ${wide ? 'wide' : ''}"><div class="modal-h"><h3>${esc(title)}</h3><button class="icon-btn" data-x>${I('x')}</button></div><div class="modal-b"></div><div class="modal-f"></div></div></div>`);
    const close = () => ov.remove(); ov.querySelector('[data-x]').onclick = close;
    const b = ov.querySelector('.modal-b'); typeof body === 'string' ? b.innerHTML = body : b.appendChild(body);
    const f = ov.querySelector('.modal-f'); buttons.forEach(x => { const bt = el(`<button class="btn ${x.primary ? 'primary' : ''}">${esc(x.text)}</button>`); bt.onclick = () => { if (x.onClick ? x.onClick(ov) !== false : true) close(); }; f.appendChild(bt); });
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); }); document.body.appendChild(ov);
    const first = ov.querySelector('input,select'); if (first) first.focus(); return { close, el: ov };
  };
  U.prompt = (title, value = '') => new Promise(res => { let done = false; const body = el(`<div><input type="text" class="wfull" value="${esc(value)}"></div>`), inp = body.querySelector('input'); const m = U.modal({ title, body, buttons: [{ text: 'Cancelar', onClick: () => { if (!done) { done = true; res(null); } } }, { text: 'OK', primary: true, onClick: () => { done = true; res(inp.value.trim() || null); } }] }); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { done = true; res(inp.value.trim() || null); m.close(); } }); inp.select(); });
  U.confirm = (title, text) => new Promise(res => { let done = false; U.modal({ title, body: `<p>${esc(text)}</p>`, buttons: [{ text: 'Cancelar', onClick: () => { if (!done) { done = true; res(false); } } }, { text: 'Confirmar', primary: true, onClick: () => { done = true; res(true); } }] }); });

  // ---------- Campos reutilizáveis ----------
  const commitProps = () => { propsLock = true; FM.commit(); propsLock = false; };
  function fNum(label, get, set, o = {}) { const r = el(`<label class="f"><span>${label}</span><input type="number" step="${o.step || 0.5}" ${o.min != null ? `min="${o.min}"` : ''} ${o.max != null ? `max="${o.max}"` : ''}></label>`), i = r.querySelector('input'); i.value = r2(get()); i.onchange = () => { const v = parseFloat(i.value); if (isNaN(v)) return; set(o.min != null ? Math.max(o.min, v) : v); FM.requestRender(); commitProps(); i.value = r2(get()); }; return r; }
  function fRange(label, get, set, o = {}) { const r = el(`<label class="f"><span>${label} <b></b></span><input type="range" min="${o.min}" max="${o.max}" step="${o.step || 0.01}"></label>`), i = r.querySelector('input'), b = r.querySelector('b'), show = () => { b.textContent = o.fmt ? o.fmt(+i.value) : r2(+i.value); }; i.value = get(); show(); i.oninput = () => { set(parseFloat(i.value)); show(); FM.requestRender(); }; i.onchange = commitProps; return r; }
  function fColor(label, get, set) { const r = el(`<label class="f"><span>${label}</span><input type="color"></label>`), i = r.querySelector('input'); i.value = get(); i.oninput = () => { set(i.value); FM.requestRender(); }; i.onchange = commitProps; return r; }
  function fSel(label, opts, get, set) { const r = el(`<label class="f"><span>${label}</span><select>${opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>`), i = r.querySelector('select'); i.value = get(); i.onchange = () => { set(i.value); FM.requestRender(); commitProps(); }; return r; }
  function fChk(label, get, set) { const r = el(`<label class="f chk"><input type="checkbox"><span>${label}</span></label>`), i = r.querySelector('input'); i.checked = !!get(); i.onchange = () => { set(i.checked); FM.requestRender(); commitProps(); }; return r; }
  const btn = (icon, text, fn, cls = '') => { const b = el(`<button class="btn ${cls}" title="${esc(text)}">${I(icon, 15)}<span>${esc(text)}</span></button>`); b.onclick = fn; return b; };
  const section = (title, ...kids) => { const s = el(`<div class="sec"><h4>${title}</h4></div>`); kids.flat().forEach(k => k && s.appendChild(k)); return s; };
  const grid = (...k) => { const g = el('<div class="btns"></div>'); k.forEach(x => g.appendChild(x)); return g; };

  // ---------- Ferramentas (barra lateral) ----------
  const TOOLS = [['select', 'Selecionar', 'V'], ['pan', 'Mover vista', 'H'], ['fill', 'Preencher área (repetição)', 'R'], ['brush', 'Pincel de células', 'B'], ['wall', 'Parede', 'W'], ['door', 'Porta (encaixa na parede)', 'D'], ['room', 'Sala (paredes + piso)', 'Q'], ['stamp', 'Carimbo de objetos', 'S'], ['light', 'Luz', 'L'], ['measure', 'Régua', 'M'], ['erase', 'Borracha', 'E']];
  function buildRail() { const r = $('toolRail'); r.innerHTML = ''; TOOLS.forEach(([id, t, k]) => { const b = el(`<button class="rail-btn ${S.tool === id ? 'active' : ''}" title="${t} (${k})">${I(id === 'erase' ? 'eraser' : id === 'measure' ? 'ruler' : id)}<kbd>${k}</kbd></button>`); b.onclick = () => FM.tools.set(id); r.appendChild(b); }); }

  // ---------- Barra de opções da ferramenta ----------
  const thumb = id => { const a = FM.assets.get(id); return a ? `<span class="thumb"><img src="${a.src}"><b>${esc(a.name)}</b></span>` : '<span class="thumb none"><b>nenhum</b></span>'; };
  function oNum(l, k, min, max, step, w) { const r = el(`<label class="o"><span>${l}</span><input type="number" min="${min}" max="${max}" step="${step}" style="width:${w || 58}px"></label>`), i = r.querySelector('input'); i.value = O[k]; i.onchange = () => { let v = parseFloat(i.value); if (isNaN(v)) v = O[k]; O[k] = Math.min(max, Math.max(min, v)); i.value = O[k]; FM.requestRender(); }; return r; }
  function oSel(l, k, opts, cb) { const r = el(`<label class="o"><span>${l}</span><select>${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`), i = r.querySelector('select'); i.value = O[k]; i.onchange = () => { O[k] = isNaN(+i.value) || i.value === '' ? i.value : +i.value; if (cb) cb(); FM.requestRender(); }; return r; }
  function oChk(l, k, cb) { const r = el(`<label class="o chk"><input type="checkbox"><span>${l}</span></label>`), i = r.querySelector('input'); i.checked = !!O[k]; i.onchange = () => { O[k] = i.checked; if (cb) cb(); FM.requestRender(); }; return r; }
  function oColor(l, k) { const r = el(`<label class="o"><span>${l}</span><input type="color"></label>`), i = r.querySelector('input'); i.value = O[k]; i.oninput = () => { O[k] = i.value; FM.requestRender(); }; return r; }
  function oRange(l, k, min, max, step) { const r = el(`<label class="o"><span>${l}</span><input type="range" min="${min}" max="${max}" step="${step}" style="width:90px"><b></b></label>`), i = r.querySelector('input'), b = r.querySelector('b'); i.value = O[k]; b.textContent = O[k]; i.oninput = () => { O[k] = +i.value; b.textContent = O[k]; FM.requestRender(); }; return r; }
  const tileOptions = () => FM.assets.list.filter(a => FM.assets.kind(a.id) === 'tile').map(a => [a.id, a.name]);
  function buildOptions() {
    const b = $('optionsBar'); b.innerHTML = ''; const add = (...k) => k.forEach(x => b.appendChild(typeof x === 'string' ? el(x) : x)), t = S.tool, hint = s => add(`<span class="hint">${s}</span>`);
    if (t === 'select') hint('Clique: selecionar · Shift: vários · arraste o vazio: área · Alt: sem snap · parede selecionada: arraste os pontos, duplo clique cria ponto · Ctrl+G: agrupar');
    if (t === 'pan') hint('Arraste para mover a vista · roda do mouse: zoom (Espaço ou botão do meio também movem)');
    if (t === 'fill' || t === 'brush' || t === 'room') add(`<span class="o">Piso: ${thumb(S.asset.floor)}</span>`);
    if (t === 'fill') {
      add(oSel('Repetição', 'fillMode', [['cell', 'Por tamanho do tile'], ['count', 'Repetir X × Y vezes']], buildOptions));
      if (O.fillMode === 'count') add(oNum('X', 'rx', 0.25, 500, 1), oNum('Y', 'ry', 0.25, 500, 1)); else add(oNum('Tile (células)', 'tileCells', 0.25, 16, 0.25));
      hint('Arraste uma área: ela é preenchida com o piso repetido.');
    }
    if (t === 'brush') { add(oNum('Pincel (células)', 'brush', 1, 12, 1)); hint('Pinte célula por célula; trechos vizinhos são fundidos automaticamente.'); }
    if (t === 'wall' || t === 'room') {
      add(oNum('Espessura (px)', 'wallThick', 4, 64, 1), oSel('Material', 'wallMat', [['tex', 'Textura'], ['color', 'Cor sólida']], buildOptions));
      if (O.wallMat === 'tex') { const r = el(`<label class="o"><span>Textura</span><select>${tileOptions().map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join('')}</select></label>`), i = r.querySelector('select'); i.value = S.asset.wall || ''; i.onchange = () => { S.asset.wall = i.value; U.renderLib(); }; add(r); } else add(oColor('Cor', 'wallColor'));
    }
    if (t === 'wall') hint('Clique para pontos · duplo clique/Enter: terminar · clique no 1º ponto: fechar · Shift: 45° · Backspace: desfaz ponto');
    if (t === 'room') { add(oChk('Preencher piso', 'roomFloor'), oNum('Tile (células)', 'tileCells', 0.25, 16, 0.25)); hint('Arraste para criar uma sala.'); }
    if (t === 'stamp') {
      add(`<span class="o">Objeto: ${thumb(S.asset.object)}</span>`, oSel('Rotação', 'stampRot', [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']]), oChk('Rot. aleatória', 'randRot'), oChk('Espalhar', 'scatter', buildOptions));
      if (O.scatter) add(oRange('Densidade %', 'density', 5, 200, 5)); hint(O.scatter ? 'Arraste uma área para espalhar com variação.' : 'Clique: 1 objeto · arraste: preenche a área em grade.');
    }
    if (t === 'light') add(oColor('Cor', 'lightColor'), oNum('Raio (células)', 'lightRadius', 0.5, 40, 0.5), oRange('Intensidade', 'lightIntensity', 0.1, 1, 0.05), `<span class="hint">Use "Escuridão ambiente" nas propriedades do mapa para ver o efeito.</span>`);
    if (t === 'measure') hint('Arraste para medir (usa a escala definida nas propriedades do mapa).');
    if (t === 'door') { add(oNum('Largura (células)', 'doorLen', 0.5, 4, 0.5), oSel('Estilo', 'doorStyle', [['wood', 'Madeira'], ['iron', 'Ferro'], ['arch', 'Abertura (sem porta)']]), oChk('Já aberta', 'doorOpen')); hint('Passe sobre uma parede e clique para encaixar · duplo clique na porta (ou O): abrir/fechar'); }
    if (t === 'erase') { add(oSel('Modo', 'eraseMode', [['item', 'Item inteiro'], ['cell', 'Por célula (divide pisos)']], buildOptions)); if (O.eraseMode === 'cell') add(oNum('Tamanho (células)', 'eraseSize', 1, 8, 1)); add(oChk('Só na camada ativa', 'eraseActiveOnly')); hint(O.eraseMode === 'cell' ? 'Apaga só as células sob o cursor, mantendo o resto do piso.' : 'Clique/arraste sobre itens para apagá-los.'); }
    const sp = el('<span class="grow"></span>'); add(sp, oChk('Camada automática', 'autoLayer', () => U.refresh()));
  }

  // ---------- Biblioteca ----------
  U.renderLib = function () {
    const A = FM.assets; if (!A.cat(lib.cat)) lib.cat = 'piso';
    const tabs = $('libTabs'); tabs.innerHTML = '';
    A.cats.forEach(c => { const b = el(`<button class="tab ${lib.cat === c.id ? 'active' : ''}">${esc(c.name)}</button>`); b.onclick = () => { lib.cat = c.id; U.renderLib(); }; tabs.appendChild(b); });
    const nb = el(`<button class="tab add" title="Nova categoria">${I('plus', 14)}</button>`); nb.onclick = newCategory; tabs.appendChild(nb);
    const g = $('assetGrid'); g.innerHTML = ''; const q = lib.q.toLowerCase(), cat = A.cat(lib.cat);
    const list = A.byCat(lib.cat).filter(a => !q || a.name.toLowerCase().includes(q));
    const active = new Set(Object.values(S.asset));
    list.forEach(a => {
      const c = el(`<div class="card ${active.has(a.id) ? 'active' : ''}" draggable="true" title="${esc(a.name)}"><img src="${a.src}" draggable="false"><span>${esc(a.name)}</span>${a.builtin ? '' : `<div class="card-tools"><button data-e title="Editar">${I('edit', 13)}</button><button data-d title="Excluir">${I('trash', 13)}</button></div>`}</div>`);
      c.onclick = ev => { if (ev.target.closest('[data-e],[data-d]')) return; useAsset(a); };
      c.addEventListener('dragstart', ev => { ev.dataTransfer.setData('text/forjamap', a.id); });
      const e = c.querySelector('[data-e]'), d = c.querySelector('[data-d]'); if (e) e.onclick = () => editAsset(a); if (d) d.onclick = () => deleteAsset(a);
      g.appendChild(c);
    });
    if (!list.length) g.appendChild(el(`<div class="empty">${cat && !cat.builtin || A.byCat(lib.cat).length === 0 ? 'Nada aqui ainda. Importe imagens ou arraste arquivos para este painel.' : 'Nenhum resultado.'}</div>`));
    $('catActions').innerHTML = ''; if (cat && !cat.builtin) { const b = btn('trash', 'Excluir categoria', async () => { if (await U.confirm('Excluir categoria', `Excluir "${cat.name}" e todos os ${A.byCat(cat.id).length} assets dentro dela?`)) { await A.removeCat(cat.id); lib.cat = 'piso'; U.renderLib(); FM.requestRender(); } }, 'small danger'); $('catActions').appendChild(b); }
  };
  function useAsset(a) {
    const kind = FM.assets.kind(a.id), t = S.tool;
    if (kind === 'object') { S.asset.object = a.id; FM.tools.set('stamp'); }
    else if (a.cat === 'parede') { S.asset.wall = a.id; O.wallMat = 'tex'; if (t !== 'wall' && t !== 'room') FM.tools.set('wall'); else U.refresh(); }
    else { S.asset.floor = a.id; if (!['fill', 'brush', 'room'].includes(t)) FM.tools.set('fill'); else U.refresh(); }
    U.renderLib();
  }
  async function newCategory() {
    const body = el(`<div class="form"><label class="f"><span>Nome</span><input type="text" class="wfull"></label><label class="f"><span>Tipo</span><select><option value="tile">Textura repetível (pisos, paredes)</option><option value="object">Objeto / peça (carimbo)</option></select></label></div>`);
    U.modal({ title: 'Nova categoria', body, buttons: [{ text: 'Cancelar' }, { text: 'Criar', primary: true, onClick: async () => { const n = body.querySelector('input').value.trim(); if (!n) return false; const c = { id: 'c_' + FM.assets.uid(), name: n, kind: body.querySelector('select').value }; await FM.assets.addCat(c); lib.cat = c.id; U.renderLib(); } }] });
  }
  async function deleteAsset(a) {
    const n = P().items.filter(i => i.asset === a.id).length;
    if (!(await U.confirm('Excluir asset', n ? `"${a.name}" é usado ${n}x neste mapa; esses itens ficarão sem imagem. Excluir mesmo assim?` : `Excluir "${a.name}"?`))) return;
    for (const k of Object.keys(S.asset)) if (S.asset[k] === a.id) S.asset[k] = null;
    await FM.assets.remove(a.id); U.renderLib(); FM.requestRender(); U.refresh();
  }
  function editAsset(a) {
    const kind = FM.assets.kind(a.id), body = el(`<div class="form"><label class="f"><span>Nome</span><input type="text" class="wfull" value="${esc(a.name)}"></label>${kind === 'object' ? `<div class="row2"><label class="f"><span>Largura (células)</span><input type="number" step="0.5" min="0.25" id="ew" value="${a.cw || 1}"></label><label class="f"><span>Altura (células)</span><input type="number" step="0.5" min="0.25" id="eh" value="${a.ch || 1}"></label></div>` : `<label class="f"><span>Tamanho do tile (células)</span><input type="number" step="0.25" min="0.25" id="et" value="${a.tile || 1}"></label>`}<label class="f"><span>Categoria</span><select id="ec">${FM.assets.cats.filter(c => c.kind === kind).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label></div>`);
    body.querySelector('#ec').value = a.cat;
    U.modal({ title: 'Editar asset', body, buttons: [{ text: 'Cancelar' }, { text: 'Salvar', primary: true, onClick: async () => { const n = Object.assign({}, a, { name: body.querySelector('input').value.trim() || a.name, cat: body.querySelector('#ec').value }); if (kind === 'object') { n.cw = Math.max(0.25, +body.querySelector('#ew').value || 1); n.ch = Math.max(0.25, +body.querySelector('#eh').value || 1); } else n.tile = Math.max(0.25, +body.querySelector('#et').value || 1); await FM.assets.update(n); lib.cat = n.cat; U.renderLib(); FM.requestRender(); } }] });
  }

  // Importação de imagens do usuário
  function readFile(f) { return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f); }); }
  function loadImg(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
  async function prepareImage(f) {
    let src = await readFile(f); if (!src) return null; const im = await loadImg(src); if (!im) return null;
    const nw = im.naturalWidth || 128, nh = im.naturalHeight || 128, MAX = 2048;
    if (f.type !== 'image/svg+xml' && Math.max(nw, nh) > MAX) { const k = MAX / Math.max(nw, nh), c = document.createElement('canvas'); c.width = Math.round(nw * k); c.height = Math.round(nh * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); src = c.toDataURL('image/png'); }
    return { src, nw, nh, name: f.name.replace(/\.[^.]+$/, '') };
  }
  U.importFiles = async function (files, forceCat) {
    files = [...files].filter(f => f.type.startsWith('image/')); if (!files.length) return U.toast('Nenhuma imagem válida selecionada.');
    const imgs = (await Promise.all(files.map(prepareImage))).filter(Boolean); if (!imgs.length) return;
    const body = el(`<div class="form"><label class="f"><span>Categoria</span><select id="ic"></select></label><div class="imp-list"></div><p class="hint2">Em categorias de <b>objeto</b>, defina o tamanho em células. Em categorias de <b>textura</b>, o tamanho do tile.</p></div>`);
    const sel = body.querySelector('#ic'); sel.innerHTML = FM.assets.cats.map(c => `<option value="${c.id}">${esc(c.name)} (${c.kind === 'tile' ? 'textura' : 'objeto'})</option>`).join(''); sel.value = forceCat || (FM.assets.cat(lib.cat) ? lib.cat : 'objeto');
    const list = body.querySelector('.imp-list'), rows = [];
    imgs.forEach(m => { const cw = Math.min(12, Math.max(1, Math.round(m.nw / 128))), ch = Math.max(1, Math.round(cw * m.nh / m.nw)); const r = el(`<div class="imp-row"><img src="${m.src}"><input type="text" class="nm" value="${esc(m.name)}"><span class="sz"></span></div>`); m.cw = cw; m.ch = ch; rows.push([m, r]); list.appendChild(r); });
    const paint = () => { const kind = FM.assets.cat(sel.value).kind; rows.forEach(([m, r]) => { r.querySelector('.sz').innerHTML = kind === 'object' ? `<input type="number" class="cw" step="0.5" min="0.25" value="${m.cw}"> × <input type="number" class="ch" step="0.5" min="0.25" value="${m.ch}"> cél.` : `tile <input type="number" class="ti" step="0.25" min="0.25" value="1"> cél.`; }); };
    sel.onchange = paint; paint();
    U.modal({ title: `Importar ${imgs.length} asset(s)`, body, wide: true, buttons: [{ text: 'Cancelar' }, { text: 'Importar', primary: true, onClick: async () => {
      const cat = FM.assets.cat(sel.value); let last;
      for (const [m, r] of rows) { const a = { id: FM.assets.uid(), cat: cat.id, name: r.querySelector('.nm').value.trim() || m.name, src: m.src }; if (cat.kind === 'object') { a.cw = Math.max(0.25, +r.querySelector('.cw').value || 1); a.ch = Math.max(0.25, +r.querySelector('.ch').value || 1); } else a.tile = Math.max(0.25, +r.querySelector('.ti').value || 1); await FM.assets.add(a); last = a; }
      lib.cat = cat.id; U.renderLib(); U.toast(rows.length + ' asset(s) importado(s)' + (FM.db.ok ? '' : ' (somente nesta sessão: armazenamento do navegador indisponível)'));
    } }] });
  };
  async function exportPack() {
    const custom = FM.assets.list.filter(a => !a.builtin), cats = FM.assets.cats.filter(c => !c.builtin);
    if (!custom.length) return U.toast('Você ainda não tem assets próprios.');
    download(new Blob([JSON.stringify({ forjamapPack: 1, cats, assets: custom })], { type: 'application/json' }), 'ForjaMap_Pacote_Assets.json');
  }
  async function importPack(file) {
    try { const d = JSON.parse(await file.text()); if (!d.forjamapPack) throw 0; await mergePack(d); lib.cat = (d.assets[0] && d.assets[0].cat) || lib.cat; U.renderLib(); FM.requestRender(); U.toast(d.assets.length + ' asset(s) importado(s).'); } catch (e) { U.toast('Arquivo de pacote inválido.'); }
  }
  async function mergePack(d) { for (const c of d.cats || []) if (!FM.assets.cat(c.id)) await FM.assets.addCat(c); for (const a of d.assets || []) if (!FM.assets.get(a.id)) await FM.assets.add(a); }

  // ---------- Camadas ----------
  function buildLayers() {
    const box = $('layers'); box.innerHTML = ''; const Ls = P().layers, cnt = {}; P().items.forEach(i => { cnt[i.layer] = (cnt[i.layer] || 0) + 1; });
    Ls.slice().reverse().forEach(L => {
      const r = el(`<div class="layer ${S.activeLayer === L.id ? 'active' : ''}"><button class="icon-btn" data-v title="Mostrar/ocultar">${I(L.visible ? 'eye' : 'eyeoff', 16)}</button><button class="icon-btn" data-l title="Bloquear/desbloquear">${I(L.locked ? 'lock' : 'unlock', 16)}</button><span class="ln ${L.visible ? '' : 'dim'}">${esc(L.name)}</span><small>${cnt[L.id] || 0}</small></div>`);
      r.querySelector('[data-v]').onclick = ev => { ev.stopPropagation(); L.visible = !L.visible; FM.commit(); };
      r.querySelector('[data-l]').onclick = ev => { ev.stopPropagation(); L.locked = !L.locked; if (L.locked) S.sel = S.sel.filter(id => FM.itemById(id).layer !== L.id); FM.commit(); };
      r.onclick = () => { S.activeLayer = L.id; U.refresh(); };
      r.ondblclick = async () => { const n = await U.prompt('Renomear camada', L.name); if (n) { L.name = n; FM.commit(); } };
      box.appendChild(r);
    });
    const L = FM.layer(S.activeLayer), ft = $('layerFoot'); ft.innerHTML = '';
    ft.appendChild(grid(btn('plus', 'Nova', () => { const id = 'l' + (P().nextLayer++); P().layers.splice(Ls.indexOf(FM.layer(S.activeLayer)) + 1, 0, { id, name: 'Camada ' + (P().nextLayer - 1), role: 'custom', visible: true, locked: false, opacity: 1, blend: 'source-over' }); S.activeLayer = id; FM.commit(); }, 'small'),
      btn('up', 'Subir', () => { const i = Ls.indexOf(L); if (i < Ls.length - 1) { [Ls[i], Ls[i + 1]] = [Ls[i + 1], Ls[i]]; FM.commit(); } }, 'small'),
      btn('down', 'Descer', () => { const i = Ls.indexOf(L); if (i > 0) { [Ls[i], Ls[i - 1]] = [Ls[i - 1], Ls[i]]; FM.commit(); } }, 'small'),
      btn('trash', 'Excluir', async () => { if (Ls.length < 2) return U.toast('É preciso manter ao menos uma camada.'); const n = cnt[L.id] || 0; if (!(await U.confirm('Excluir camada', `Excluir "${L.name}"${n ? ' e seus ' + n + ' itens' : ''}?`))) return; P().items = P().items.filter(i => i.layer !== L.id); Ls.splice(Ls.indexOf(L), 1); S.activeLayer = Ls[Math.min(Ls.length - 1, 0)].id; S.sel = S.sel.filter(id => FM.itemById(id)); FM.commit(); }, 'small danger')));
    ft.appendChild(fRange('Opacidade da camada', () => L.opacity, v => { L.opacity = v; }, { min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' }));
    ft.appendChild(fSel('Mesclagem', [['source-over', 'Normal'], ['multiply', 'Multiplicar'], ['screen', 'Clarear (screen)'], ['overlay', 'Sobrepor'], ['soft-light', 'Luz suave']], () => L.blend, v => { L.blend = v; }));
  }

  // ---------- Propriedades ----------
  const typeName = it => it.type === 'door' ? 'Porta' : it.type === 'fill' ? 'Piso' : it.type === 'image' ? 'Objeto' : it.type === 'wall' ? 'Parede' : 'Luz';
  function layerSel(items) { return fSel('Camada', P().layers.map(l => [l.id, l.name]), () => items[0].layer, v => { items.forEach(i => { i.layer = v; }); }); }
  function actions(items) {
    const g = grid(btn('copy', 'Duplicar', () => duplicate(), 'small'), btn('matrix', 'Repetir em matriz', arrayDialog, 'small'), btn('front', 'Frente', () => { items.forEach(i => FM.reorder(i, 'front')); FM.commit(); }, 'small'), btn('back', 'Trás', () => { items.forEach(i => FM.reorder(i, 'back')); FM.commit(); }, 'small'));
    if (items.length === 1 && FM.isXf(items[0])) { g.appendChild(btn('rot', 'Girar 90°', () => { items[0].rot = FM.normRot((items[0].rot || 0) + 90); FM.commit(); }, 'small')); g.appendChild(btn('flip', 'Espelhar', () => { items[0].flipX = !items[0].flipX; FM.commit(); }, 'small')); }
    if (items.length > 1) g.appendChild(btn('group', 'Agrupar', groupSel, 'small'));
    if (items.some(i => i.g)) g.appendChild(btn('group', 'Desagrupar', ungroupSel, 'small'));
    g.appendChild(btn('trash', 'Excluir', deleteSel, 'small danger')); return g;
  }
  function buildProps() {
    const box = $('props'); box.innerHTML = ''; const items = FM.selItems(), cs = cell();
    if (!items.length) return buildMapProps(box);
    if (items.length > 1) {
      box.appendChild(el(`<div class="sec"><h4>${items.length} itens selecionados</h4></div>`));
      box.appendChild(section('Alinhar', grid(...[['alignL', 'Esquerda', 'l'], ['alignC', 'Centro H', 'c'], ['alignR', 'Direita', 'r'], ['alignT', 'Topo', 't'], ['alignM', 'Meio V', 'm'], ['alignB', 'Base', 'b']].map(([ic, t, k]) => btn(ic, t, () => align(k), 'small icon-only')))));
      box.appendChild(section('Ajustes', layerSel(items), fRange('Opacidade', () => items[0].opacity, v => items.forEach(i => { i.opacity = v; }), { min: 0.1, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' })));
      box.appendChild(section('Ações', actions(items))); return;
    }
    const it = items[0], a = it.asset && FM.assets.get(it.asset);
    box.appendChild(el(`<div class="sec"><h4>${typeName(it)}${a ? ' · ' + esc(a.name) : ''}</h4></div>`));
    if (FM.isXf(it)) {
      box.appendChild(section('Transformar', el('<div class="row2"></div>'), fNum('X (células)', () => it.x / cs, v => { const d = v * cs - it.x; it.x += d; if (it.po) it.po[0] += d; }), fNum('Y (células)', () => it.y / cs, v => { const d = v * cs - it.y; it.y += d; if (it.po) it.po[1] += d; }), fNum('Largura', () => it.w / cs, v => { it.w = v * cs; }, { min: 0.1 }), fNum('Altura', () => it.h / cs, v => { it.h = v * cs; }, { min: 0.1 }), fNum('Rotação (°)', () => it.rot || 0, v => { it.rot = FM.normRot(v); }, { step: 5 })));
      if (it.type === 'fill') box.appendChild(section('Repetição do piso', fNum('Repetições X', () => it.w / it.tw, v => { it.tw = it.w / Math.max(0.01, v); }, { min: 0.01, step: 1 }), fNum('Repetições Y', () => it.h / it.th, v => { it.th = it.h / Math.max(0.01, v); }, { min: 0.01, step: 1 }), fNum('Tile (células)', () => it.tw / cs, v => { it.tw = it.th = v * cs; }, { min: 0.05, step: 0.25 })));
    } else if (it.type === 'wall') {
      box.appendChild(el('<p class="hint2" style="padding:0 12px">Arraste os pontos brancos para editar · duplo clique no segmento: novo ponto · Del: remove o ponto selecionado.</p>'));
      box.appendChild(section('Parede', fNum('Espessura (px)', () => it.thick, v => { it.thick = v; }, { min: 2, step: 2 }), fSel('Material', [['tex', 'Textura'], ['color', 'Cor sólida']], () => it.asset ? 'tex' : 'color', v => { if (v === 'tex') { it.asset = S.asset.wall || (FM.assets.byCat('parede')[0] || {}).id; } else delete it.asset; setTimeout(buildProps, 0); }), it.asset ? fSel('Textura', tileOptions(), () => it.asset, v => { it.asset = v; }) : fColor('Cor', () => it.color || '#4a4a4f', v => { it.color = v; }), fChk('Fechada', () => it.closed, v => { it.closed = v; })));
    } else if (it.type === 'door') {
      box.appendChild(section('Porta', fNum('Largura (células)', () => it.len / cs, v => { it.len = v * cs; }, { min: 0.5 }), fSel('Estilo', [['wood', 'Madeira'], ['iron', 'Ferro'], ['arch', 'Abertura (sem porta)']], () => it.style, v => { it.style = v; }), fChk('Aberta (O)', () => it.open, v => { it.open = v; }), fNum('Ângulo (°)', () => it.ang || 0, v => { it.ang = v; }, { step: 15 })));
    } else if (it.type === 'light') {
      box.appendChild(section('Luz', fNum('X (células)', () => it.x / cs, v => { it.x = v * cs; }), fNum('Y (células)', () => it.y / cs, v => { it.y = v * cs; }), fColor('Cor', () => it.color, v => { it.color = v; }), fNum('Raio (células)', () => it.r / cs, v => { it.r = v * cs; }, { min: 0.5 }), fRange('Intensidade', () => it.intensity, v => { it.intensity = v; }, { min: 0.1, max: 1, step: 0.05 }), fChk('Sombras (paredes bloqueiam)', () => it.shadows !== false, v => { it.shadows = v; })));
    }
    if (it.type !== 'light' && it.type !== 'door') box.appendChild(section('Aparência', fRange('Opacidade', () => it.opacity, v => { it.opacity = v; }, { min: 0.1, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' })));
    box.appendChild(section('Camada', layerSel(items)));
    box.appendChild(section('Ações', actions(items)));
  }
  function rescaleItems(k) { P().items.forEach(i => { ['x', 'y', 'w', 'h', 'tw', 'th', 'r', 'thick', 'len'].forEach(f => { if (i[f] != null) i[f] *= k; }); if (i.type === 'door') i.th *= k; if (i.po) i.po = i.po.map(v => v * k); if (i.points) i.points = i.points.map(q => [q[0] * k, q[1] * k]); }); }
  function buildMapProps(box) {
    const m = P().map, nameF = el(`<label class="f"><span>Nome do mapa</span><input type="text" class="wfull"></label>`), ni = nameF.querySelector('input'); ni.value = P().name; ni.onchange = () => { P().name = ni.value.trim() || 'Mapa'; $('projName').value = P().name; FM.autosave(); };
    box.appendChild(section('Mapa', nameF, fNum('Colunas', () => m.cols, v => { m.cols = Math.round(v); }, { min: 1, max: 400, step: 1 }), fNum('Linhas', () => m.rows, v => { m.rows = Math.round(v); }, { min: 1, max: 400, step: 1 }),
      (() => { const r = fNum('Tamanho da célula (px)', () => m.cell, v => { v = Math.max(16, Math.round(v)); if ($('rescale').checked) rescaleItems(v / m.cell); m.cell = v; }, { min: 16, max: 512, step: 8 }); const c = el('<label class="f chk"><input type="checkbox" id="rescale" checked><span>Redimensionar itens junto</span></label>'); const w = document.createElement('div'); w.appendChild(r); w.appendChild(c); return w; })(),
      fColor('Cor de fundo', () => m.bg, v => { m.bg = v; }), fSel('Tipo de grade', [['square', 'Quadrada'], ['hexp', 'Hexagonal (ponta p/ cima)'], ['hexf', 'Hexagonal (ponta p/ o lado)']], () => m.grid || 'square', v => { m.grid = v; })));
    box.appendChild(section('Escala', fNum('1 célula =', () => m.unitVal, v => { m.unitVal = v; }, { min: 0.1, step: 0.5 }), (() => { const r = el('<label class="f"><span>Unidade</span><input type="text" class="wfull" maxlength="6"></label>'), i = r.querySelector('input'); i.value = m.unitName; i.onchange = () => { m.unitName = i.value || 'm'; commitProps(); }; return r; })()));
    box.appendChild(section('Grade', fChk('Mostrar grade', () => m.gridOn, v => { m.gridOn = v; }), fColor('Cor', () => m.gridColor, v => { m.gridColor = v; }), fRange('Opacidade', () => m.gridAlpha, v => { m.gridAlpha = v; }, { min: 0.02, max: 0.8, step: 0.02, fmt: v => Math.round(v * 100) + '%' })));
    box.appendChild(section('Iluminação', fRange('Escuridão ambiente', () => m.ambient, v => { m.ambient = v; }, { min: 0, max: 0.95, step: 0.05, fmt: v => Math.round(v * 100) + '%' }), fColor('Cor da escuridão', () => m.ambientColor, v => { m.ambientColor = v; }), fChk('Paredes bloqueiam a luz', () => m.shadows !== false, v => { m.shadows = v; })));
  }

  // ---------- Ações sobre itens ----------
  function deleteSel() { const ids = new Set(S.sel); if (!ids.size) return; P().items = P().items.filter(i => !ids.has(i.id) && !(i.type === 'door' && ids.has(i.wall))); S.sel = []; FM.commit(); }
  const newG = () => 'g' + Math.random().toString(36).slice(2, 8);
  // Clona itens (levando as portas das paredes e refazendo os vínculos / grupos)
  function cloneSet(src, dx, dy, gm, withDoors) {
    const all = src.slice(), map = {}, out = [];
    if (withDoors) src.forEach(w => { if (w.type === 'wall') P().items.forEach(d => { if (d.type === 'door' && d.wall === w.id && !all.includes(d)) all.push(d); }); });
    all.forEach(o => { const n = FM.clone(o); FM.addItem(n); map[o.id] = n; FM.moveItem(n, o, dx, dy); if (n.g) { gm[n.g] = gm[n.g] || newG(); n.g = gm[n.g]; } out.push(n); });
    out.forEach(n => { if (n.type === 'door' && map[n.wall]) n.wall = map[n.wall].id; }); return out;
  }
  function duplicate() { const its = FM.selItems(); if (!its.length) return; const c = cell(); FM.setSel(cloneSet(its, c, c, {}, true).map(i => i.id)); FM.commit(); }
  function groupSel() { const its = FM.selItems(); if (its.length < 2) return U.toast('Selecione 2 ou mais itens para agrupar.'); const g = newG(); its.forEach(i => { i.g = g; }); FM.commit(); U.toast('Itens agrupados: agora se movem juntos.'); }
  function ungroupSel() { FM.selItems().forEach(i => { delete i.g; }); FM.commit(); }
  function align(k) {
    const its = FM.selItems(), bs = its.map(FM.bbox), x0 = Math.min(...bs.map(b => b.x0)), x1 = Math.max(...bs.map(b => b.x1)), y0 = Math.min(...bs.map(b => b.y0)), y1 = Math.max(...bs.map(b => b.y1));
    its.forEach((it, n) => { const b = bs[n], o = FM.clone(it); let dx = 0, dy = 0; if (k === 'l') dx = x0 - b.x0; if (k === 'r') dx = x1 - b.x1; if (k === 'c') dx = (x0 + x1) / 2 - (b.x0 + b.x1) / 2; if (k === 't') dy = y0 - b.y0; if (k === 'b') dy = y1 - b.y1; if (k === 'm') dy = (y0 + y1) / 2 - (b.y0 + b.y1) / 2; FM.moveItem(it, o, dx, dy); }); FM.commit();
  }
  function arrayDialog() {
    const its = FM.selItems(); if (!its.length) return U.toast('Selecione algo para repetir.');
    const bs = its.map(FM.bbox), bw = Math.max(...bs.map(b => b.x1)) - Math.min(...bs.map(b => b.x0)), bh = Math.max(...bs.map(b => b.y1)) - Math.min(...bs.map(b => b.y0)), c = cell();
    const body = el(`<div class="form"><div class="row2"><label class="f"><span>Colunas (repetições →)</span><input type="number" id="ac" min="1" max="200" value="4"></label><label class="f"><span>Linhas (repetições ↓)</span><input type="number" id="ar" min="1" max="200" value="1"></label></div><div class="row2"><label class="f"><span>Espaço entre X (células)</span><input type="number" id="ag" step="0.5" value="0"></label><label class="f"><span>Espaço entre Y (células)</span><input type="number" id="ah" step="0.5" value="0"></label></div><p class="hint2" id="ap"></p></div>`);
    const v = id => body.querySelector(id), upd = () => { const n = Math.max(1, +v('#ac').value || 1) * Math.max(1, +v('#ar').value || 1); v('#ap').textContent = `Serão criadas ${n - 1} cópias (tamanho da seleção: ${(bw / c).toFixed(1)} × ${(bh / c).toFixed(1)} células).`; }; body.addEventListener('input', upd); upd();
    U.modal({ title: 'Repetir seleção em matriz', body, buttons: [{ text: 'Cancelar' }, { text: 'Aplicar', primary: true, onClick: () => {
      const cols = Math.min(200, Math.max(1, Math.round(+v('#ac').value || 1))), rows = Math.min(200, Math.max(1, Math.round(+v('#ar').value || 1))), sx = bw + (+v('#ag').value || 0) * c, sy = bh + (+v('#ah').value || 0) * c;
      if (cols * rows > 3000) { U.toast('Máximo de 3000 cópias por vez.'); return false; }
      const made = []; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { if (!i && !j) continue; cloneSet(its, i * sx, j * sy, {}, true).forEach(n => made.push(n.id)); }
      FM.setSel([...S.sel, ...made]); FM.commit(); U.toast(made.length + ' itens criados');
    } }] });
  }
  function placeAsset(id, p) {
    const a = FM.assets.get(id); if (!a) return; const c = cell(), kind = FM.assets.kind(id);
    if (kind === 'object') { const L = FM.layerFor('objects'); if (!L) return; const w = (a.cw || 1) * c, h = (a.ch || 1) * c; const it = FM.addItem({ type: 'image', layer: L, asset: id, x: FM.snapV(p.x - w / 2), y: FM.snapV(p.y - h / 2), w, h, rot: 0, opacity: 1 }); FM.setSel([it.id]); }
    else { const L = FM.layerFor(a.cat === 'parede' ? 'walls' : 'terrain'); if (!L) return; const t = (a.tile || 1) * c, it = FM.addItem({ type: 'fill', layer: L, asset: id, x: FM.snapV(p.x - c), y: FM.snapV(p.y - c), w: c * 2, h: c * 2, tw: t, th: t, rot: 0, opacity: 1 }); FM.setSel([it.id]); }
    FM.commit();
  }

  // ---------- Projeto: salvar / carregar / exportar ----------
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  const safe = s => (s || 'mapa').replace(/[^\w\-À-ÿ ]+/g, '').trim().replace(/\s+/g, '_') || 'mapa';
  function saveProject() {
    const used = new Set(); P().items.forEach(i => i.asset && used.add(i.asset));
    const assets = [...used].map(id => FM.assets.get(id)).filter(a => a && !a.builtin), catIds = new Set(assets.map(a => a.cat)), cats = FM.assets.cats.filter(c => !c.builtin && catIds.has(c.id));
    download(new Blob([JSON.stringify({ forjamap: 3, project: P(), cats, assets })], { type: 'application/json' }), safe(P().name) + '.forjamap.json'); U.toast('Projeto salvo (assets personalizados incluídos).');
  }
  async function loadFile(file) {
    try {
      const d = JSON.parse(await file.text());
      if (d.className === 'Stage') return U.toast('Este arquivo é do formato antigo (Konva) e não pode ser aberto.');
      if (!d.project || !d.project.map) throw 0; await mergePack(d);
      const p = Object.assign(FM.newProject(), d.project); p.nextLayer = p.nextLayer || p.layers.length + 10; FM.loadProject(p); $('projName').value = p.name; U.toast('Projeto carregado.');
    } catch (e) { U.toast('Arquivo de projeto inválido.'); }
  }
  function exportDialog() {
    const X = FM.exporter, o = X.defaults(); o.pgrid = true; let fmt = 'png';
    const body = el('<div class="form"><label class="f"><span>Formato</span><select id="xf"></select></label><p class="hint2" id="xd"></p><div id="xo"></div><p class="hint2" id="xi"></p></div>');
    const sel = body.querySelector('#xf'), box = body.querySelector('#xo'), groups = {};
    X.formats.forEach(f => { let g = groups[f.group]; if (!g) { g = groups[f.group] = document.createElement('optgroup'); g.label = f.group; sel.appendChild(g); } const op = document.createElement('option'); op.value = f.id; op.textContent = f.name; g.appendChild(op); });
    const field = (label, key, opts, num) => { const r = el(`<label class="f"><span>${label}</span><select>${opts.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select></label>`), i = r.querySelector('select'); i.value = String(o[key]); i.onchange = () => { o[key] = num ? +i.value : i.value; info(); }; box.appendChild(r); };
    const check = (label, key) => { const r = el(`<label class="f chk"><input type="checkbox"><span>${label}</span></label>`), i = r.querySelector('input'); i.checked = !!o[key]; i.onchange = () => { o[key] = i.checked; info(); }; box.appendChild(r); };
    const lightF = (data) => field('Iluminação', 'light', [['embed', 'Embutida na imagem'], ...(data ? [['data', 'Apenas como dados (luzes do VTT)']] : []), ['none', 'Sem iluminação']]);
    const info = () => { const f = X.formats.find(x => x.id === fmt); body.querySelector('#xd').textContent = f.desc; let t = X.info(fmt, o); if (FM.isHex() && ['uvtt', 'foundry', 'roll20'].includes(fmt)) t = 'Atenção: este formato não suporta grade hexagonal. Use PNG/JPEG/WebP ou o pacote Owlbear Rodeo.'; body.querySelector('#xi').textContent = t; };
    function paint() {
      box.innerHTML = ''; const img = ['png', 'jpg', 'webp'].includes(fmt);
      if (img) { field('Resolução', 'scale', [[0.5, '0.5× (rascunho)'], [1, '1× (tamanho da célula do mapa)'], [2, '2× (alta)'], [3, '3×']], true); check('Incluir grade', 'grid'); lightF(false); if (fmt !== 'png') field('Qualidade', 'quality', [[70, '70%'], [80, '80%'], [90, '90%'], [95, '95%']], true); }
      if (fmt === 'uvtt') { field('Extensão', 'ext', [['dd2vtt', '.dd2vtt'], ['uvtt', '.uvtt']]); }
      if (['uvtt', 'foundry', 'owlbear'].includes(fmt)) { field('Pixels por célula', 'ppg', [[70, '70 (leve)'], [100, '100'], [140, '140'], [200, '200'], [256, '256 (máxima qualidade)'], [0, 'Original do mapa (' + P().map.cell + ')']], true); field('Dimensão máxima da imagem', 'maxSide', [[0, 'Sem limite'], [8192, '8192 px'], [4096, '4096 px'], [2048, '2048 px']], true); }
      if (['foundry', 'owlbear'].includes(fmt)) { field('Formato da imagem', 'imgFmt', [['png', 'PNG'], ['jpg', 'JPEG'], ['webp', 'WebP']]); if (o.imgFmt !== 'png') field('Qualidade', 'quality', [[70, '70%'], [80, '80%'], [90, '90%'], [95, '95%']], true); }
      if (['uvtt', 'foundry', 'owlbear', 'roll20'].includes(fmt)) { lightF(true); if (!o.light) o.light = 'embed'; }
      if (fmt === 'pdf') { field('Papel', 'paper', [['a4', 'A4'], ['letter', 'Carta (Letter)']]); field('Escala (polegadas por célula)', 'ipc', [[0.5, '0,5"'], [0.75, '0,75"'], [1, '1" (padrão de mesa)'], [1.5, '1,5"'], [2, '2"']], true); field('Orientação', 'orient', [['auto', 'Automática'], ['portrait', 'Retrato'], ['landscape', 'Paisagem']]); check('Incluir grade', 'pgrid'); lightF(false); }
      if (fmt === 'layers') field('Resolução', 'scale', [[0.5, '0.5×'], [1, '1×'], [2, '2×']], true);
      info();
    }
    sel.onchange = () => { fmt = sel.value; paint(); }; paint();
    U.modal({ title: 'Exportar mapa', body, wide: true, buttons: [{ text: 'Cancelar' }, { text: 'Exportar', primary: true, onClick: () => { runExport(fmt, o); } }] });
  }
  async function runExport(fmt, o) {
    try {
      if (fmt === 'project') return saveProject();
      U.toast('Gerando arquivo… aguarde.'); await new Promise(r => setTimeout(r, 30));
      const oo = Object.assign({}, o); if (fmt === 'pdf') oo.grid = o.pgrid; const r = await FM.exporter.run(fmt, oo);
      download(r.blob, r.name); U.toast('Exportado: ' + r.name + (r.pages ? ` (${r.pages} páginas)` : ''));
    } catch (e) { U.toast('Não foi possível exportar: ' + (e && e.message ? e.message : e)); }
  }
  U.saveProject = saveProject;
  function newProject() {
    const body = el('<div><p class="hint2" style="margin:0 0 10px">Escolha um ponto de partida:</p><div class="tpl-list"></div></div>'), list = body.querySelector('.tpl-list'); let m;
    FM.templates.forEach(t => { const b = el(`<button class="tpl"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></button>`); b.onclick = async () => { if (P().items.length && !(await U.confirm('Substituir mapa atual', 'O mapa atual será descartado. Salve antes se quiser guardá-lo. Continuar?'))) return; m.close(); const p = FM.newProject(); t.build(p); FM.loadProject(p); $('projName').value = p.name; FM.commit(); }; list.appendChild(b); });
    m = U.modal({ title: 'Novo mapa', body, buttons: [{ text: 'Cancelar' }] });
  }
  const KEYS = [['V / H', 'Selecionar / mover a vista (ou Espaço, botão do meio)'], ['R', 'Preencher área com repetição'], ['B', 'Pincel de células'], ['W', 'Parede (Enter termina; clique no 1º ponto fecha)'], ['D', 'Porta encaixada na parede (O abre/fecha)'], ['Q', 'Sala: paredes + piso'], ['S', 'Carimbo (arraste para preencher/espalhar)'], ['L', 'Luz'], ['M', 'Régua'], ['E', 'Borracha (item ou por célula)'], ['Ctrl+Z / Ctrl+Y', 'Desfazer / refazer'], ['Ctrl+C / V / D', 'Copiar / colar / duplicar'], ['Ctrl+G · Ctrl+Shift+G', 'Agrupar / desagrupar'], ['[ ]  (Shift = extremos)', 'Ordem dos itens na camada'], ['Setas (Shift = 1 célula)', 'Mover seleção'], ['X', 'Girar 90°'], ['Alt', 'Desliga o snap durante a ação'], ['G · 0 · + −', 'Grade · ajustar vista · zoom'], ['Del', 'Apagar (ou ponto selecionado de uma parede)']];
  function helpDialog() { U.modal({ title: 'Atalhos e dicas', wide: true, body: `<div class="keys">${KEYS.map(([k, t]) => `<div><kbd>${esc(k)}</kbd><span>${esc(t)}</span></div>`).join('')}</div><p class="hint2">Dica: importe suas imagens pelo botão <b>Importar</b> (ou arraste arquivos para a biblioteca) e use-as como pisos, paredes ou objetos.</p>`, buttons: [{ text: 'Fechar', primary: true }] }); }
  function tour() {
    try { if (localStorage.getItem('forjamap.tour')) return; localStorage.setItem('forjamap.tour', '1'); } catch (e) { return; }
    U.modal({ title: 'Bem-vindo ao ForjaMap Pro', body: `<ol class="tour"><li><b>Escolha um piso</b> na biblioteca e use <b>Preencher (R)</b>: arraste uma área e defina quantas vezes ele se repete.</li><li>Desenhe <b>paredes (W)</b> ou <b>salas (Q)</b> e encaixe <b>portas (D)</b>.</li><li>Use o <b>carimbo (S)</b> para espalhar objetos; arraste para preencher uma área.</li><li>Organize em <b>camadas</b> (olho, cadeado, mesclagem) no painel da direita.</li><li><b>Importe seus assets</b> pelo botão Importar ou arrastando arquivos.</li><li>Exporte em <b>PNG, Universal VTT, Foundry, Owlbear Rodeo, Roll20, PDF em escala</b> e mais.</li></ol><p class="hint2">Pressione <b>?</b> a qualquer momento para ver os atalhos. Seu mapa é salvo automaticamente neste navegador.</p>`, buttons: [{ text: 'Começar', primary: true }] });
  }

  // ---------- Minimapa ----------
  const mini = { thumb: null, dirty: true, last: 0, on: true, w: 190, h: 120 };
  FM.miniDirty = () => { mini.dirty = true; };
  FM.miniDraw = () => {
    const cv = $('mini'); if (!cv || !S.project) return; cv.style.display = mini.on ? 'block' : 'none'; if (!mini.on) return;
    const MS = FM.mapSize(), k = Math.min(190 / MS.W, 130 / MS.H), w = Math.max(20, Math.round(MS.W * k)), h = Math.max(20, Math.round(MS.H * k)), dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; mini.dirty = true; }
    const now = performance.now();
    if (mini.dirty && now - mini.last > 250) { mini.dirty = false; mini.last = now; const t = mini.thumb = mini.thumb || document.createElement('canvas'); t.width = cv.width; t.height = cv.height; FM.render(t.getContext('2d'), t.width, t.height, { s: k * dpr, ox: 0, oy: 0, dpr }, { ui: false, grid: false }); mini.k = k; }
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); if (mini.thumb) c.drawImage(mini.thumb, 0, 0);
    const v = S.view, sc = k * dpr, x0 = (-v.x / v.zoom) * sc, y0 = (-v.y / v.zoom) * sc, ww = (FM.canvas.clientWidth / v.zoom) * sc, hh = (FM.canvas.clientHeight / v.zoom) * sc;
    c.strokeStyle = '#00b37e'; c.lineWidth = 1.5 * dpr; c.fillStyle = 'rgba(0,179,126,.12)'; c.fillRect(x0, y0, ww, hh); c.strokeRect(x0, y0, ww, hh); mini.k = k;
    if (mini.dirty) setTimeout(() => FM.requestRender(), 280);
  };
  function bindMini() {
    const cv = $('mini'); let down = false; const go = e => { const r = cv.getBoundingClientRect(), k = mini.k || 1; const wx = (e.clientX - r.left) / k, wy = (e.clientY - r.top) / k; S.view.x = FM.canvas.clientWidth / 2 - wx * S.view.zoom; S.view.y = FM.canvas.clientHeight / 2 - wy * S.view.zoom; FM.requestRender(); };
    cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); go(e); }); cv.addEventListener('pointermove', e => { if (down) go(e); }); cv.addEventListener('pointerup', () => { down = false; });
    $('btnMini').onclick = () => { mini.on = !mini.on; $('btnMini').classList.toggle('on', mini.on); FM.requestRender(); }; $('btnMini').classList.add('on');
  }

  // ---------- Status / refresh ----------
  U.coords = p => { const c = cell(); $('stCoord').textContent = `Célula ${Math.floor(p.x / c)}, ${Math.floor(p.y / c)}`; };
  U.status = () => { $('zoomVal').textContent = Math.round(S.view.zoom * 100) + '%'; };
  function status() { const L = FM.layer(S.activeLayer); $('stSel').textContent = S.sel.length ? S.sel.length + ' selecionado(s)' : ''; $('stLayer').textContent = 'Camada ativa: ' + (L ? L.name : '-'); $('stMap').textContent = `${P().map.cols}×${P().map.rows} células · ${P().items.length} itens`; U.status(); }
  U.refresh = function (full) {
    if (!S.project) return; buildRail(); buildOptions(); buildLayers(); if (!propsLock) buildProps(); status(); if (document.activeElement !== $('projName')) $('projName').value = P().name;
    $('btnUndo').disabled = FM.history.idx <= 0; $('btnRedo').disabled = FM.history.idx >= FM.history.stack.length - 1; $('btnGrid').classList.toggle('on', P().map.gridOn); $('snapSel').value = O.snap;
    if (full) U.renderLib();
  };

  // ---------- Inicialização ----------
  async function init() {
    document.querySelectorAll('[data-ic]').forEach(e => { e.innerHTML = I(e.dataset.ic, +e.dataset.s || 18) + (e.dataset.t ? `<span>${e.dataset.t}</span>` : ''); });
    FM.canvas = $('cv'); await FM.assets.init();
    let p; try { const s = localStorage.getItem('forjamap.autosave'); if (s) p = Object.assign(FM.newProject(), JSON.parse(s)); } catch (e) { p = null; }
    S.asset.floor = 't_masmorra'; S.asset.wall = 'w_pedra'; S.asset.object = 'o_mesa';
    FM.tools.bind(FM.canvas); FM.loadProject(p || FM.newProject()); $('projName').value = P().name; if (p) U.toast('Último mapa restaurado automaticamente.');
    // Barra superior
    $('btnUndo').onclick = FM.undo; $('btnRedo').onclick = FM.redo; $('btnGrid').onclick = () => { P().map.gridOn = !P().map.gridOn; FM.commit(); };
    $('snapSel').onchange = e => { O.snap = e.target.value; FM.requestRender(); };
    $('btnHelp').onclick = helpDialog; bindMini();
    $('btnSave').onclick = saveProject; $('btnLoad').onclick = () => $('fileProj').click(); $('btnNew').onclick = newProject; $('btnExport').onclick = exportDialog;
    $('fileProj').onchange = e => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; };
    $('projName').onchange = e => { P().name = e.target.value.trim() || 'Mapa'; FM.autosave(); };
    $('zoomIn').onclick = () => FM.zoomAt(FM.canvas.clientWidth / 2, FM.canvas.clientHeight / 2, 1.25); $('zoomOut').onclick = () => FM.zoomAt(FM.canvas.clientWidth / 2, FM.canvas.clientHeight / 2, 0.8);
    $('zoomVal').onclick = () => FM.zoomAt(FM.canvas.clientWidth / 2, FM.canvas.clientHeight / 2, 1 / S.view.zoom); $('zoomFit').onclick = FM.fitView;
    // Biblioteca
    $('libSearch').oninput = e => { lib.q = e.target.value; U.renderLib(); };
    $('btnImport').onclick = () => $('fileImg').click(); $('fileImg').onchange = e => { U.importFiles(e.target.files); e.target.value = ''; };
    $('btnPackOut').onclick = exportPack; $('btnPackIn').onclick = () => $('filePack').click(); $('filePack').onchange = e => { if (e.target.files[0]) importPack(e.target.files[0]); e.target.value = ''; };
    const left = $('left'); ['dragenter', 'dragover'].forEach(ev => left.addEventListener(ev, e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); left.classList.add('drop'); } }));
    ['dragleave', 'drop'].forEach(ev => left.addEventListener(ev, () => left.classList.remove('drop')));
    left.addEventListener('drop', e => { if (e.dataTransfer.files.length) { e.preventDefault(); U.importFiles(e.dataTransfer.files); } });
    // Soltar na tela
    FM.canvas.addEventListener('dragover', e => e.preventDefault());
    FM.canvas.addEventListener('drop', e => { e.preventDefault(); const r = FM.canvas.getBoundingClientRect(), pt = FM.toWorld(e.clientX - r.left, e.clientY - r.top), id = e.dataTransfer.getData('text/forjamap'); if (id) placeAsset(id, pt); else if (e.dataTransfer.files.length) U.importFiles(e.dataTransfer.files, 'objeto'); });
    window.addEventListener('resize', () => FM.requestRender());
    new ResizeObserver(() => { FM.requestRender(); }).observe($('stageWrap'));
    window.addEventListener('beforeunload', e => { try { localStorage.setItem('forjamap.autosave', JSON.stringify(P())); } catch (x) { } });
    window.addEventListener('keydown', onKey);
    U.refresh(true); requestAnimationFrame(() => { FM.fitView(); tour(); });
  }
  function onKey(e) {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || document.querySelector('.overlay')) return;
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey, c = cell();
    if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? FM.redo() : FM.undo(); return; }
    if (ctrl && k === 'y') { e.preventDefault(); FM.redo(); return; }
    if (ctrl && k === 's') { e.preventDefault(); saveProject(); return; }
    if (ctrl && k === 'a') { e.preventDefault(); const ok = FM.visibleUnlocked(); FM.setSel(P().items.filter(i => ok[i.layer]).map(i => i.id)); return; }
    if (ctrl && k === 'd') { e.preventDefault(); duplicate(); return; }
    if (ctrl && k === 'g') { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); return; }
    if (ctrl && k === 'c') { const its = FM.selItems(), all = its.slice(); its.forEach(w => { if (w.type === 'wall') P().items.forEach(d => { if (d.type === 'door' && d.wall === w.id && !all.includes(d)) all.push(d); }); }); clip = all.map(FM.clone); return; }
    if (ctrl && k === 'v') { e.preventDefault(); if (!clip.length) return; const made = cloneSet(clip, c, c, {}, false); made.forEach(n => { if (!FM.layer(n.layer)) n.layer = S.activeLayer; }); clip = made.map(FM.clone); FM.setSel(made.map(n => n.id)); FM.commit(); return; }
    if (ctrl) return;
    if (k === 'delete' || k === 'backspace') { if (S.tool === 'wall' && FM.tools.wall.length) { FM.tools.wall.pop(); FM.requestRender(); } else if (!(FM.tools.vsel && FM.tools.vsel.id === S.sel[0] && S.sel.length === 1 && FM.tools.deleteVertex())) { if (!(FM.tools.vsel && FM.tools.vsel.id === S.sel[0] && S.sel.length === 1)) deleteSel(); } e.preventDefault(); return; }
    if (k === 'enter' && S.tool === 'wall') { FM.tools.finishWall(e.shiftKey); return; }
    if (k === 'escape') { FM.tools.cancel(); return; }
    if (k === 'o') { const ds = FM.selItems().filter(i => i.type === 'door'); if (ds.length) { ds.forEach(d => { d.open = !d.open; }); FM.commit(); return; } }
    if (k === '?' || k === 'f1') { e.preventDefault(); helpDialog(); return; }
    const map = { v: 'select', h: 'pan', r: 'fill', b: 'brush', w: 'wall', d: 'door', q: 'room', s: 'stamp', l: 'light', m: 'measure', e: 'erase' }; if (map[k]) { FM.tools.set(map[k]); return; }
    if (k === 'g') { P().map.gridOn = !P().map.gridOn; FM.commit(); return; }
    if (k === '0') { FM.fitView(); return; }
    if (k === '+' || k === '=') { FM.zoomAt(FM.canvas.clientWidth / 2, FM.canvas.clientHeight / 2, 1.25); return; }
    if (k === '-') { FM.zoomAt(FM.canvas.clientWidth / 2, FM.canvas.clientHeight / 2, 0.8); return; }
    if (k === ']' || k === '[') { FM.selItems().forEach(i => FM.reorder(i, k === ']' ? (e.shiftKey ? 'front' : 'up') : (e.shiftKey ? 'back' : 'down'))); FM.commit(); return; }
    if (k === 'r' && S.sel.length) return;
    if (k.startsWith('arrow') && S.sel.length) { e.preventDefault(); const st = e.shiftKey ? c : (O.snap === 'off' ? 1 : c / 2), dx = k === 'arrowleft' ? -st : k === 'arrowright' ? st : 0, dy = k === 'arrowup' ? -st : k === 'arrowdown' ? st : 0; FM.selItems().forEach(i => FM.moveItem(i, FM.clone(i), dx, dy)); FM.commit(); }
    if (k === 'x' && S.sel.length === 1) { const it = FM.selItems()[0]; if (FM.isXf(it)) { it.rot = FM.normRot((it.rot || 0) + 90); FM.commit(); } }
  }
  window.addEventListener('DOMContentLoaded', init);
})();
