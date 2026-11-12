// Gera a pasta estados/ (um mapa enxuto de estados por país) a partir do Natural Earth admin-1 (domínio público).
// Baixe ne_10m_admin_1_states_provinces.geojson de github.com/nvkelso/natural-earth-vector e rode:
//   node ferramentas/converter-estados.js <arquivo.geojson> vigia-global.html estados
// Converte o Natural Earth admin-1 (estados/províncias do mundo) em um arquivo enxuto por país: estados/XX.json
// uso: node converter.js <admin1.geojson> <vigia-global.html> <pasta de saída>
const fs = require('fs');
const path = require('path');
const [, , ARQ, HTML, SAIDA] = process.argv;

const feats = JSON.parse(fs.readFileSync(ARQ, 'utf8')).features;
// pontos dos países usados pela janela (onde o pontinho pousa): [código, nome, lon, lat]
const PONTOS = {};
for (const m of fs.readFileSync(HTML, 'utf8').matchAll(/\["([A-Z]{2})","[^"]+",(-?[\d.]+),(-?[\d.]+)/g)) PONTOS[m[1]] = [+m[2], +m[3]];

const ISO_EXTRA = { SOL: 'SO', CYN: 'CY', KAB: 'KZ', ESB: 'CY', WSB: 'CY', USG: 'CU' };
// países picotados demais: junta por região (as divisas internas somem)
const AGRUPAR = { GB: 'geonunit', SI: 'region', LV: 'region', PH: 'region', UG: 'region', IT: 'region', FR: 'region', MK: 'region', AZ: 'region', MT: 'region', ES: 'region', BF: 'region' };
const NOME_PT = {
  England: 'Inglaterra', Scotland: 'Escócia', Wales: 'País de Gales', 'Northern Ireland': 'Irlanda do Norte',
  'Guyane française': 'Guiana Francesa', 'Île-de-France': 'Île-de-France', Corse: 'Córsega', Bretagne: 'Bretanha', Normandie: 'Normandia',
  'Provence-Alpes-Côte-d\'Azur': 'Provença-Alpes-Costa Azul', Martinique: 'Martinica', Guadeloupe: 'Guadalupe', 'La Réunion': 'Reunião',
  Cataluña: 'Catalunha', Andalucía: 'Andaluzia', 'País Vasco': 'País Basco', 'Castilla y León': 'Castela e Leão', 'Castilla-La Mancha': 'Castela-Mancha',
  'Islas Baleares': 'Ilhas Baleares', Canarias: 'Ilhas Canárias', Aragón: 'Aragão', 'Foral de Navarra': 'Navarra', 'Comunidad de Madrid': 'Madri',
  'Comunidad Valenciana': 'Comunidade Valenciana', Sicilia: 'Sicília', Sardegna: 'Sardenha', Puglia: 'Apúlia', Campania: 'Campânia', Lazio: 'Lácio',
  Toscana: 'Toscana', Lombardia: 'Lombardia', Piemonte: 'Piemonte', Veneto: 'Vêneto', Liguria: 'Ligúria', Calabria: 'Calábria', Basilicata: 'Basilicata',
  'Canary Is.': 'Ilhas Canárias', Asturias: 'Astúrias', Cantabria: 'Cantábria', Galicia: 'Galícia', Apulia: 'Apúlia', Abruzzo: 'Abruzos',
  'Balearic Is.': 'Ilhas Baleares', 'Murcia': 'Múrcia', 'La Rioja': 'La Rioja', Extremadura: 'Estremadura',
};

const R6 = v => Math.round(v * 1e6) / 1e6, R3 = v => Math.round(v * 1e3) / 1e3;
const D2R = Math.PI / 180;
const ang = (a, b) => { // distância em graus entre [lon,lat]
  const s = Math.sin(a[1] * D2R) * Math.sin(b[1] * D2R) + Math.cos(a[1] * D2R) * Math.cos(b[1] * D2R) * Math.cos((a[0] - b[0]) * D2R);
  return Math.acos(Math.max(-1, Math.min(1, s))) / D2R;
};
function area(r) { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return Math.abs(s / 2); }
function centroide(r) { let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1]; } return [x / r.length, y / r.length]; }
function dentro(pt, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// Douglas-Peucker (linha aberta)
function simplificar(pts, tol) {
  if (pts.length <= 2) return pts.slice();
  const marca = new Uint8Array(pts.length); marca[0] = marca[pts.length - 1] = 1;
  const pilha = [[0, pts.length - 1]];
  while (pilha.length) {
    const [a, b] = pilha.pop(); let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L; if (d > max) { max = d; idx = i; } }
    if (max > tol && idx > 0) { marca[idx] = 1; pilha.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => marca[i]);
}
function simplificarAnel(r, tol) {
  // anel fechado: divide em duas metades para o DP não colapsar
  const meio = Math.floor(r.length / 2);
  const s = [...simplificar(r.slice(0, meio + 1), tol).slice(0, -1), ...simplificar(r.slice(meio), tol)];
  return s;
}
const plano = pts => pts.flatMap(p => [R3(p[0]), R3(p[1])]);
function caixa(r) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of r) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; }
function mediaEsferica(pts) {     // centro de um monte de pontos na esfera (funciona mesmo cruzando a linha de 180°)
  let X = 0, Y = 0, Z = 0;
  for (const [lon, lat] of pts) { X += Math.cos(lat * D2R) * Math.cos(lon * D2R); Y += Math.cos(lat * D2R) * Math.sin(lon * D2R); Z += Math.sin(lat * D2R); }
  return [Math.atan2(Y, X) / D2R, Math.atan2(Z, Math.hypot(X, Y)) / D2R];
}
// tira "de "/"da " do começo (o Natural Earth traz "de Antofagasta") e corrige os nomes que vêm em inglês
const limparNome = n => { const s = String(n || '').replace(/^(de|da|do|dos|das) /, '').trim(); return NOME_PT[s] || s; };
const aneisDe = g => g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map(p => p[0]) : [];

// 1) separa por país
const porPais = {};
for (const f of feats) {
  const p = f.properties;
  let cod = /^[A-Z]{2}$/.test(p.iso_a2) ? p.iso_a2 : ISO_EXTRA[p.adm0_a3];
  if (!cod || !PONTOS[cod] || !f.geometry) continue;
  (porPais[cod] = porPais[cod] || []).push(f);
}

fs.mkdirSync(SAIDA, { recursive: true });
let total = 0, nArq = 0;
for (const [cod, lista] of Object.entries(porPais)) {
  const ponto = PONTOS[cod];
  // 2) junta as unidades (por região nos países picotados)
  const grupos = new Map();
  for (const f of lista) {
    const p = f.properties, campo = AGRUPAR[cod];
    const nome = limparNome((campo && p[campo]) || p.name_pt || p.name || p.name_en || p.gn_name || p.adm1_code);
    if (!grupos.has(nome)) grupos.set(nome, { nome, tipo: campo ? 'Região' : (p.type || p.type_en || ''), tipoEn: campo ? 'Region' : p.type_en, unidades: [] });
    grupos.get(nome).unidades.push(f);
  }
  // nomes repetidos (ex.: cidade e condado com o mesmo nome) ganham o tipo entre parênteses
  // (já ficaram juntos no Map; separa de volta quando não é agrupamento por região)
  const estados = [];
  for (const g of grupos.values()) {
    if (!AGRUPAR[cod] && g.unidades.length > 1) {
      // primeiro tenta o nome local (ex.: "Ciudad de Buenos Aires"); um deles fica com o nome em português
      const vistos = new Set(); let base = false;
      for (const f of g.unidades) {
        const p = f.properties, local = limparNome(p.name || '');
        let n = local && local !== g.nome && !vistos.has(local) ? local : !base ? (base = true, g.nome) : `${g.nome} (${p.type_en || p.type || 'área'})`;
        let k = 2; while (vistos.has(n)) n = `${g.nome} (${p.type_en || 'área'} ${k++})`;
        vistos.add(n);
        estados.push({ nome: n, tipo: p.type || '', unidades: [f] });
      }
    } else estados.push(g);
  }
  // 3) anéis de todo o país (para achar o "continente" e o enquadramento)
  const todos = [];
  for (const e of estados) for (const f of e.unidades) for (const r of aneisDe(f.geometry)) todos.push({ r, a: area(r), c: centroide(r) });
  if (!todos.length) continue;
  // massas de terra: anéis cujas caixas se tocam (com folga de 1,5°) formam um bloco; o bloco do país é o que tem o ponto dele
  const cx = todos.map(x => caixa(x.r)), pai = todos.map((_, i) => i);
  const raiz = i => pai[i] === i ? i : (pai[i] = raiz(pai[i]));
  for (let i = 0; i < todos.length; i++) for (let j = i + 1; j < todos.length; j++)
    if (cx[i][0] - 1.5 <= cx[j][2] && cx[j][0] - 1.5 <= cx[i][2] && cx[i][1] - 1.5 <= cx[j][3] && cx[j][1] - 1.5 <= cx[i][3]) pai[raiz(i)] = raiz(j);
  const blocos = new Map();
  todos.forEach((x, i) => { const r = raiz(i); if (!blocos.has(r)) blocos.set(r, { aneis: [], a: 0 }); const b = blocos.get(r); b.aneis.push(x); b.a += x.a; });
  const lb = [...blocos.values()];
  const comPonto = todos.find(x => dentro(ponto, x.r));
  const princ = (comPonto && lb.find(b => b.aneis.includes(comPonto))) || lb.sort((a, b) => b.a - a.a)[0];
  const vPrinc = princ.aneis.flatMap(x => x.r), cPrinc = mediaEsferica(vPrinc);
  let rPrinc = 0; for (const p of vPrinc) rPrinc = Math.max(rPrinc, ang(p, cPrinc));
  // entram também as ilhas/blocos que ficam dentro do raio do bloco principal (Sicília, Córsega...); Alasca e Havaí não
  const usados = lb.filter(b => b === princ || ang(mediaEsferica(b.aneis.flatMap(x => x.r)), cPrinc) <= Math.max(rPrinc, 2));
  const vUsados = usados.flatMap(b => b.aneis.flatMap(x => x.r)), centro = mediaEsferica(vUsados);
  let raio = 0; for (const p of vUsados) raio = Math.max(raio, ang(p, centro));
  raio = Math.max(raio, 0.4);
  // tolerância da simplificação proporcional ao tamanho do país
  const tol = Math.max(0.004, Math.min(0.06, raio / 400));
  const minArea = (tol * 4) ** 2;
  const saida = { cod, centro: [R3(centro[0]), R3(centro[1])], raio: R3(raio), estados: [] };
  for (const e of estados) {
    // preenchimento: anéis simplificados (ilhotas minúsculas saem, menos quando é tudo o que o estado tem)
    const aneis = [], segs = new Map();
    const brutos = e.unidades.flatMap(f => aneisDe(f.geometry));
    const maior = brutos.reduce((m, r) => Math.max(m, area(r)), 0);
    for (const r of brutos) {
      if (area(r) < minArea && area(r) < maior) continue;
      const s = simplificarAnel(r, tol);
      if (s.length >= 4) aneis.push(plano(s));
    }
    if (!aneis.length) { const r = brutos.sort((a, b) => area(b) - area(a))[0]; aneis.push(plano(simplificarAnel(r, tol / 4))); }
    // contorno: só as bordas de fora (quando várias províncias viram uma região, as divisas de dentro somem)
    let contornos = null;
    if (e.unidades.length > 1) {
      const chave = (a, b) => { const k1 = R6(a[0]) + ',' + R6(a[1]), k2 = R6(b[0]) + ',' + R6(b[1]); return k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; };
      for (const r of brutos) for (let i = 0; i < r.length - 1; i++) { const k = chave(r[i], r[i + 1]); segs.set(k, (segs.get(k) || 0) + 1); }
      contornos = [];
      for (const r of brutos) {
        if (area(r) < minArea && area(r) < maior) continue;
        let linha = [];
        for (let i = 0; i < r.length - 1; i++) {
          if (segs.get(chave(r[i], r[i + 1])) === 1) { if (!linha.length) linha.push(r[i]); linha.push(r[i + 1]); }
          else if (linha.length) { contornos.push(linha); linha = []; }
        }
        if (linha.length) contornos.push(linha);
      }
      contornos = contornos.map(l => plano(simplificar(l, tol))).filter(l => l.length >= 4);
    }
    // ponto do nome: o do Natural Earth (média ponderada quando é região)
    let lat = 0, lon = 0, peso = 0;
    for (const f of e.unidades) { const w = Math.max(...aneisDe(f.geometry).map(area)) || 1e-9; lat += (f.properties.latitude ?? 0) * w; lon += (f.properties.longitude ?? 0) * w; peso += w; }
    saida.estados.push({ nome: e.nome, tipo: e.tipo, lon: R3(lon / peso), lat: R3(lat / peso), aneis, ...(contornos ? { contornos } : {}) });
  }
  saida.estados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const txt = JSON.stringify(saida);
  fs.writeFileSync(path.join(SAIDA, cod + '.json'), txt);
  total += txt.length; nArq++;
}
console.log(`${nArq} países, ${(total / 1e6).toFixed(2)} MB no total`);
