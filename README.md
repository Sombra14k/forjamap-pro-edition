# ForjaMap Pro 3.1 — Versão Github

Editor web de mapas de batalha para RPG. **Sem dependências e 100% offline**: abra o `index.html`
no navegador (ou `npm start`). Os assets próprios ficam salvos no navegador (IndexedDB) e o
mapa é salvo automaticamente.

## O que há de novo
- **Preencher área com repetição** (R): arraste uma área e escolha *por tamanho do tile* ou
  *Repetir X × Y vezes*. Depois, as repetições podem ser editadas no painel de propriedades.
- **Pincel de células** (B), **Sala** (Q: paredes + piso de uma vez), **Parede** (W, polilinha/fechada),
  **Carimbo** (S: clique = 1 objeto; arrastar = preenche a área em grade ou *espalha* com variação).
- **Repetir em matriz**: selecione qualquer coisa → colunas × linhas + espaçamento.
- **Camadas completas**: criar, renomear (duplo clique), reordenar, ocultar, bloquear, excluir,
  opacidade e modo de mesclagem por camada. Camada automática por tipo (pode desligar).
- **Assets do usuário**: importe várias imagens (botão ou arraste arquivos), escolha a categoria,
  defina tamanho em células, edite/exclua, crie **categorias próprias**, exporte/importe **pacotes**.
- **Projeto**: salvar/abrir `.forjamap.json` (os assets personalizados vão embutidos), autosave,
  desfazer/refazer (Ctrl+Z / Ctrl+Y), copiar/colar/duplicar, alinhar, ordem Z.
- **Seleção profissional**: caixa de seleção, Shift, alças de redimensionar e girar, setas para mover.
- **Iluminação**: luzes coloridas + escuridão ambiente do mapa. **Régua** com escala configurável.
- **Exportação PNG** em 0.5×–3× com informação de px por célula para importar em VTTs.

## Atalhos
V selecionar · H mover vista (ou Espaço/botão do meio) · R preencher · B pincel · W parede · Q sala ·
S carimbo · L luz · M régua · E borracha · G grade · 0 ajustar · +/- zoom · Del apagar · Esc cancelar ·
Ctrl+A/C/V/D · `[` `]` ordem Z · X gira 90° · Alt desliga o snap · Enter finaliza parede

## Estrutura
`js/engine.js` (estado, histórico, renderização, hit-test) · `js/tools.js` (ferramentas) ·
`js/assets.js` (biblioteca + IndexedDB) · `js/ui.js` (painéis e diálogos) · `js/export.js` (formatos) ·
`js/templates.js` (modelos) · `js/icons.js`

## Novidades da 3.1
- **Paredes editáveis**: arraste os pontos, duplo clique no segmento cria ponto, Del remove o ponto selecionado.
- **Borracha por célula** (E → modo "Por célula"): divide pisos mantendo o padrão alinhado.
- **Portas** (D): encaixam na parede mais próxima, abrem um vão nela, abrem/fecham (duplo clique ou O)
  e acompanham a parede ao mover/duplicar. Estilos: madeira, ferro e abertura.
- **Luz bloqueada por paredes** e portas fechadas (desligável no mapa ou por luz).
- **Grade hexagonal** (ponta p/ cima ou p/ o lado) com snap ao centro dos hexágonos.
- **Agrupar** (Ctrl+G), **modelos de mapa** (Taverna, Masmorra, Acampamento), **minimapa**, atalhos (?),
  tutorial inicial, zoom por pinça em telas de toque, +25 assets embutidos (categorias Natureza e Masmorra).

## Exportação (botão Exportar)
PNG · JPEG · WebP · **Universal VTT** (.dd2vtt/.uvtt) · **Foundry VTT** (ZIP) · **Owlbear Rodeo** (ZIP) ·
**Roll20** (ZIP) · **PDF em escala real** (páginas A4/Carta com marcas de corte) · **camadas separadas** (ZIP) ·
projeto `.json`. Paredes, portas e luzes saem como dados nos formatos de VTT.

> Os formatos de VTT foram gerados seguindo a estrutura pública do Universal VTT e as convenções de cada
> plataforma, mas **não foram testados dentro** do Foundry, Roll20 ou Owlbear Rodeo. Se algum campo não
> for aceito pela sua versão, use a opção UVTT ou as imagens e ajuste a grade manualmente.
> Grades hexagonais não são suportadas pelos formatos UVTT/Foundry/Roll20 (use imagem ou Owlbear).
