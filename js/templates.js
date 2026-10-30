// Modelos de mapa prontos (usam apenas assets embutidos)
(function () {
  const FM = window.FM, C = 64;
  function B(P) {
    const add = it => { it.id = 'i' + (P.nextId++); if (it.opacity == null) it.opacity = 1; P.items.push(it); return it; };
    const L = { t: 'l1', w: 'l2', o: 'l3', l: 'l5' };
    return {
      add,
      fill: (x, y, w, h, a, t = 1) => add({ type: 'fill', layer: L.t, asset: a, x: x * C, y: y * C, w: w * C, h: h * C, tw: t * C, th: t * C, rot: 0 }),
      room: (x, y, w, h, a = 'w_pedra', th = 16) => add({ type: 'wall', layer: L.w, asset: a, points: [[x * C, y * C], [(x + w) * C, y * C], [(x + w) * C, (y + h) * C], [x * C, (y + h) * C]], closed: true, thick: th }),
      wall: (pts, a = 'w_pedra', th = 16) => add({ type: 'wall', layer: L.w, asset: a, points: pts.map(p => [p[0] * C, p[1] * C]), closed: false, thick: th }),
      door: (wall, x, y, vertical, len = 1, style = 'wood', open = false) => add({ type: 'door', layer: L.w, wall: wall.id, x: x * C, y: y * C, len: len * C, th: wall.thick, ang: vertical ? 90 : 0, open, style }),
      obj: (a, x, y, w = 1, h = 1, rot = 0) => add({ type: 'image', layer: L.o, asset: a, x: x * C, y: y * C, w: w * C, h: h * C, rot, flipX: false }),
      light: (x, y, r, color = '#ffa94d', i = 0.9) => add({ type: 'light', layer: L.l, x: x * C, y: y * C, r: r * C, color, intensity: i })
    };
  }
  FM.templates = [
    { id: 'blank', name: 'Mapa em branco', desc: '30 × 20 células, grade quadrada.', build: P => { } },
    { id: 'tavern', name: 'Taverna', desc: 'Salão de madeira com lareira, mesas, bar e iluminação.', build(P) {
      P.name = 'Taverna'; P.map.cols = 24; P.map.rows = 16; P.map.ambient = 0.35; const b = B(P);
      b.fill(0, 0, 24, 16, 't_grama'); b.fill(3, 3, 18, 10, 't_madeira'); b.fill(9, 3, 6, 10, 't_carpete', 2);
      const w = b.room(3, 3, 18, 10); b.door(w, 12, 13, false, 2, 'wood'); b.door(w, 3, 8, true, 1, 'wood');
      b.obj('o_lareira', 11, 3.2, 2, 1); b.obj('o_estante', 4, 3.3, 2, 1); b.obj('o_estante', 18, 3.3, 2, 1);
      [[5, 6], [5, 9], [16, 6], [16, 9]].forEach(([x, y]) => { b.obj('o_mesa', x, y, 2, 1); b.obj('o_cadeira', x, y - 1); b.obj('o_cadeira', x + 1, y + 1, 1, 1, 180); });
      b.obj('o_barril', 19.5, 4); b.obj('o_barril', 19.5, 5); b.obj('o_bau', 4, 11); b.obj('o_cama', 19.5, 10, 1, 2);
      b.obj('o_arvore', -1, 9, 3, 3); b.obj('o_arvore', 21.5, 12, 3, 3);
      b.light(12, 4, 7); b.light(6, 3.6, 4, '#ffcf7a', 0.7); b.light(19, 3.6, 4, '#ffcf7a', 0.7);
    } },
    { id: 'dungeon', name: 'Masmorra', desc: 'Três salas ligadas por corredores, com portas e tochas.', build(P) {
      P.name = 'Masmorra'; P.map.cols = 30; P.map.rows = 20; P.map.bg = '#15151a'; P.map.ambient = 0.6; P.map.ambientColor = '#05060f'; const b = B(P);
      b.fill(2, 2, 8, 6, 't_masmorra'); b.fill(15, 2, 11, 9, 't_cobble'); b.fill(4, 12, 10, 6, 't_masmorra'); b.fill(10, 4, 5, 2, 't_masmorra'); b.fill(8, 8, 2, 4, 't_masmorra'); b.fill(14, 14, 12, 2, 't_masmorra');
      const A = b.room(2, 2, 8, 6), Bm = b.room(15, 2, 11, 9), Cm = b.room(4, 12, 10, 6);
      b.wall([[10, 4], [15, 4]], 'w_pedra', 12); b.wall([[10, 6], [15, 6]], 'w_pedra', 12); b.wall([[8, 8], [8, 12]], 'w_pedra', 12); b.wall([[10, 8], [10, 12]], 'w_pedra', 12);
      b.door(A, 10, 5, true, 1, 'wood'); b.door(Bm, 15, 5, true, 1, 'iron'); b.door(Cm, 9, 12, false, 2, 'wood', true);
      b.obj('o_altar', 18, 3, 2, 1); b.obj('o_estatua', 24, 3); b.obj('o_estatua', 24, 9); b.obj('o_pilar', 17, 6); b.obj('o_pilar', 21, 6); b.obj('o_sarcofago', 22, 5, 1, 2);
      b.obj('o_bau', 3, 3); b.obj('o_ossos', 6, 6); b.obj('o_teia', 2.1, 2.1); b.obj('o_armadilha', 9, 6.5); b.obj('o_caixote', 12, 16); b.obj('o_barril', 5, 16);
      b.light(2.5, 2.5, 4, '#ff9a3c', 0.9); b.light(19, 4, 6, '#7fa8ff', 0.7); b.light(14, 17, 5, '#ff9a3c', 0.8); b.light(25, 5, 3, '#ff9a3c', 0.8);
    } },
    { id: 'camp', name: 'Acampamento na floresta', desc: 'Clareira com fogueira, tendas, árvores e rochas.', build(P) {
      P.name = 'Acampamento'; P.map.cols = 24; P.map.rows = 16; P.map.ambient = 0.55; const b = B(P);
      b.fill(0, 0, 24, 16, 't_folhas'); b.fill(6, 4, 12, 8, 't_grama'); b.fill(10, 6, 4, 4, 't_terra');
      b.obj('o_fogueira', 11.5, 7.5); b.obj('o_tenda', 6.5, 4.5, 2, 2); b.obj('o_tenda', 15.5, 4.5, 2, 2); b.obj('o_tenda', 8, 9.5, 2, 2); b.obj('o_banco', 10.5, 6.2, 2, 1); b.obj('o_barril', 14.5, 10); b.obj('o_caixote', 15.5, 10);
      [[0, 0], [3, 2], [20, 0], [21, 5], [0, 11], [4, 13], [19, 12], [21, 9], [10, 0], [14, 13]].forEach(([x, y]) => b.obj('o_arvore', x, y, 3, 3));
      b.obj('o_arbusto', 5, 8); b.obj('o_arbusto', 18, 8); b.obj('o_rocha', 17, 11); b.obj('o_cogumelos', 7, 12); b.obj('o_rocha', 6, 2);
      b.light(12, 8, 6.5, '#ff9a3c', 0.95);
    } }
  ];
})();
