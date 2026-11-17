// Gera as CURVAS DE NÍVEL do globo topográfico (pasta relevo/) a partir do mapa de altitude público "Terrain Tiles"
// (AWS Open Data / Mapzen, formato terrarium, zoom 4 = 256 imagens de 256x256, ~18 MB).
// Baixe as imagens numa pasta (nome x_y.png) de https://s3.amazonaws.com/elevation-tiles-prod/terrarium/4/{x}/{y}.png e rode:
//   node ferramentas/gerar-relevo.js <pasta das imagens> [XX]      (XX = só um país, para testar)
// Saída:
//   relevo/mundo.json  curvas do planeta inteiro (grade de 0,5°): terra e fundo do mar
//   relevo/XX.json     curvas mais finas de cada país (grade ~1/300 do tamanho dele), com o estado de cada trecho
// Formato das linhas: [nível, (estado,) x0, y0, dx1, dy1, ...] em graus x Q (inteiros, cada ponto relativo ao anterior)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [, , PASTA_TILES, SO] = process.argv;
if (!PASTA_TILES) { console.log('uso: node ferramentas/gerar-relevo.js <pasta das imagens z4> [XX]'); process.exit(1); }
const RAIZ = path.join(__dirname, '..'), SAIDA = path.join(RAIZ, 'relevo');
fs.mkdirSync(SAIDA, { recursive: true });

// ---------- PNG (só o que os tiles usam: 8 bits, RGB/RGBA, sem entrelaçar) ----------
function lerPNG(buf) {
  let p = 8, w = 0, h = 0, tipoCor = 0; const idat = [];
  while (p < buf.length) {
    const n = buf.readUInt32BE(p), tipo = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + n);
    if (tipo === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); tipoCor = d[9]; if (d[8] !== 8 || d[12]) throw new Error('PNG sem suporte'); }
    else if (tipo === 'IDAT') idat.push(d);
    else if (tipo === 'IEND') break;
    p += 12 + n;
  }
  const bpp = tipoCor === 6 ? 4 : tipoCor === 2 ? 3 : 0; if (!bpp) throw new Error('PNG com cor sem suporte: ' + tipoCor);
  const raw = zlib.inflateSync(Buffer.concat(idat)), linha = w * bpp, px = Buffer.alloc(h * linha);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (linha + 1)], src = y * (linha + 1) + 1, cur = y * linha, ant = cur - linha;
    for (let x = 0; x < linha; x++) {
      const a = x >= bpp ? px[cur + x - bpp] : 0, b = y ? px[ant + x] : 0, c = x >= bpp && y ? px[ant + x - bpp] : 0, v = raw[src + x];
      let r;
      if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      px[cur + x] = r & 255;
    }
  }
  return { w, h, bpp, px };
}

// ---------- mosaico de altitude (Web Mercator, 4096 x 4096) ----------
const Z = 4, T = 256, LADO = T << Z;
const ALT = new Float32Array(LADO * LADO);
for (let tx = 0; tx < 1 << Z; tx++) for (let ty = 0; ty < 1 << Z; ty++) {
  const { px, bpp } = lerPNG(fs.readFileSync(path.join(PASTA_TILES, `${tx}_${ty}.png`)));
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const k = (y * T + x) * bpp;
    ALT[(ty * T + y) * LADO + tx * T + x] = px[k] * 256 + px[k + 1] + px[k + 2] / 256 - 32768;
  }
}
console.log('mosaico de altitude pronto');
const D2R = Math.PI / 180;
function altEm(lon, lat) {                       // bilinear no mosaico (a longitude dá a volta)
  lat = Math.max(-85.05, Math.min(85.05, lat));
  const fx = ((((lon + 180) / 360) % 1) + 1) % 1 * LADO - 0.5;
  const fy = (1 - Math.log(Math.tan(Math.PI / 4 + lat * D2R / 2)) / Math.PI) / 2 * LADO - 0.5;
  const x0 = Math.floor(fx), y0 = Math.max(0, Math.min(LADO - 2, Math.floor(fy))), ax = fx - x0, ay = Math.max(0, Math.min(1, fy - y0));
  const xa = ((x0 % LADO) + LADO) % LADO, xb = (xa + 1) % LADO;
  const v00 = ALT[y0 * LADO + xa], v10 = ALT[y0 * LADO + xb], v01 = ALT[(y0 + 1) * LADO + xa], v11 = ALT[(y0 + 1) * LADO + xb];
  return (v00 * (1 - ax) + v10 * ax) * (1 - ay) + (v01 * (1 - ax) + v11 * ax) * ay;
}
// grade de nós: nó (i, j) em lon0 + i*pLon, lat0 - j*pLat; cada nó é a média de sub x sub amostras em volta (sem serrilhado)
function grade(lon0, lat0, pLon, pLat, nx, ny, sub) {
  const g = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let s = 0;
    for (let a = 0; a < sub; a++) for (let b = 0; b < sub; b++)
      s += altEm(lon0 + (i + (a + 0.5) / sub - 0.5) * pLon, lat0 - (j + (b + 0.5) / sub - 0.5) * pLat);
    g[j * nx + i] = s / (sub * sub);
  }
  return g;
}
function suavizar(g, nx, ny) {                   // 1-2-1 nas duas direções
  const t = new Float32Array(g.length);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = g[j * nx + Math.max(0, i - 1)], b = g[j * nx + i], c = g[j * nx + Math.min(nx - 1, i + 1)]; t[j * nx + i] = (a + 2 * b + c) / 4;
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = t[Math.max(0, j - 1) * nx + i], b = t[j * nx + i], c = t[Math.min(ny - 1, j + 1) * nx + i]; g[j * nx + i] = (a + 2 * b + c) / 4;
  }
}

// ---------- curvas de nível (marching squares, com os pedaços emendados em linhas) ----------
function curvas(g, nx, ny, L, ponto) {
  const segs = [];                                // pares de arestas: h(i,j) = (j*nx+i)*2, v(i,j) = (j*nx+i)*2+1
  const H = (i, j) => (j * nx + i) * 2, V = (i, j) => (j * nx + i) * 2 + 1;
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const tl = g[j * nx + i], tr = g[j * nx + i + 1], br = g[(j + 1) * nx + i + 1], bl = g[(j + 1) * nx + i];
    const c = (tl >= L ? 8 : 0) | (tr >= L ? 4 : 0) | (br >= L ? 2 : 0) | (bl >= L ? 1 : 0);
    if (c === 0 || c === 15) continue;
    const t = H(i, j), b = H(i, j + 1), e = V(i, j), d = V(i + 1, j);
    switch (c) {
      case 1: case 14: segs.push(e, b); break;
      case 2: case 13: segs.push(b, d); break;
      case 3: case 12: segs.push(e, d); break;
      case 4: case 11: segs.push(t, d); break;
      case 6: case 9: segs.push(t, b); break;
      case 7: case 8: segs.push(e, t); break;
      case 5: if ((tl + tr + br + bl) / 4 >= L) segs.push(e, t, b, d); else segs.push(e, b, t, d); break;
      case 10: if ((tl + tr + br + bl) / 4 >= L) segs.push(t, d, e, b); else segs.push(e, t, b, d); break;
    }
  }
  const pos = new Map();                          // aresta -> segmentos que passam nela (no máximo 2)
  for (let s = 0; s < segs.length / 2; s++) for (const a of [segs[2 * s], segs[2 * s + 1]]) { const l = pos.get(a); if (l) l.push(s); else pos.set(a, [s]); }
  const usado = new Uint8Array(segs.length / 2), linhas = [];
  const pontoDe = a => {
    const k = a >> 1, i = k % nx, j = (k / nx) | 0, vert = a & 1;
    const va = g[j * nx + i], vb = vert ? g[(j + 1) * nx + i] : g[j * nx + i + 1], f = Math.max(0, Math.min(1, (L - va) / (vb - va)));
    return vert ? ponto(i, j + f) : ponto(i + f, j);
  };
  const seguir = (s0, a0) => {                    // anda de segmento em segmento a partir da aresta a0
    const arestas = [a0]; let s = s0, a = a0;
    while (s >= 0 && !usado[s]) {
      usado[s] = 1; const prox = segs[2 * s] === a ? segs[2 * s + 1] : segs[2 * s]; arestas.push(prox); a = prox;
      const l = pos.get(a); s = l ? (l[0] !== s && !usado[l[0]] ? l[0] : l[1] !== undefined && !usado[l[1]] ? l[1] : -1) : -1;
    }
    return arestas.map(pontoDe);
  };
  for (const [a, l] of pos) if (l.length === 1 && !usado[l[0]]) linhas.push(seguir(l[0], a));       // abertas primeiro
  for (let s = 0; s < usado.length; s++) if (!usado[s]) linhas.push(seguir(s, segs[2 * s]));          // depois as fechadas
  return linhas;
}
function simplificar(p, tol) {                    // Douglas-Peucker (p = [[x,y],...])
  if (p.length < 3) return p;
  const manter = new Uint8Array(p.length); manter[0] = manter[p.length - 1] = 1;
  const pilha = [[0, p.length - 1]], t2 = tol * tol;
  while (pilha.length) {
    const [a, b] = pilha.pop(); let mx = 0, k = -1;
    const [x1, y1] = p[a], [x2, y2] = p[b], dx = x2 - x1, dy = y2 - y1, q = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      let u = q ? ((p[i][0] - x1) * dx + (p[i][1] - y1) * dy) / q : 0; u = Math.max(0, Math.min(1, u));
      const ex = x1 + u * dx - p[i][0], ey = y1 + u * dy - p[i][1], d = ex * ex + ey * ey;
      if (d > mx) { mx = d; k = i; }
    }
    if (mx > t2) { manter[k] = 1; pilha.push([a, k], [k, b]); }
  }
  return p.filter((_, i) => manter[i]);
}
const comprimento = p => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
function codificar(cabeca, p, Q) {               // [cabeça..., x0, y0, dx, dy, ...] inteiros
  const out = [...cabeca]; let px = 0, py = 0;
  for (let i = 0; i < p.length; i++) {
    const x = Math.round(p[i][0] * Q), y = Math.round(p[i][1] * Q);
    if (i && x === px && y === py) continue;
    out.push(i ? x - px : x, i ? y - py : y); px = x; py = y;
  }
  return out;
}

// ---------- o mundo (grade de 0,5°) ----------
if (!SO) {
  const P = 0.5, LON0 = -180, LAT0 = 84.5, NX = 721, NY = Math.round(2 * LAT0 / P) + 1;
  const g = grade(LON0, LAT0, P, P, NX, NY, 3);
  for (let j = 0; j < NY; j++) g[j * NX + NX - 1] = g[j * NX];          // a última coluna é a primeira (a volta fecha)
  suavizar(g, NX, NY);
  const NIVEIS = [-6000, -5000, -4000, -3000, -2000, -1000, -200, 0, 150, 300, 500, 750, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000];
  const linhas = []; let nPts = 0;
  NIVEIS.forEach((L, n) => {
    for (const l of curvas(g, NX, NY, L + 0.01, (i, j) => [LON0 + i * P, LAT0 - j * P])) {
      const s = simplificar(l, L < 0 ? 0.18 : 0.1);
      if (s.length < 3 || comprimento(s) < (L < 0 ? 3 : 1)) continue;
      linhas.push(codificar([n], s, 100)); nPts += s.length;
    }
  });
  fs.writeFileSync(path.join(SAIDA, 'mundo.json'), JSON.stringify({ q: 100, niveis: NIVEIS, linhas }));
  console.log(`mundo: ${linhas.length} linhas, ${nPts} pontos, ${(fs.statSync(path.join(SAIDA, 'mundo.json')).size / 1024).toFixed(0)} KB`);
}

// ---------- cada país (com os estados de estados/XX.json) ----------
const NICE = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
const NICE_O = [50, 100, 200, 250, 500, 1000, 2000];
const codigos = SO ? [SO] : fs.readdirSync(path.join(RAIZ, 'estados')).filter(f => /^[A-Z]{2}\.json$/.test(f)).map(f => f.slice(0, 2));
let total = 0;
for (const cod of codigos) {
  const d = JSON.parse(fs.readFileSync(path.join(RAIZ, 'estados', cod + '.json'), 'utf8'));
  const c0 = d.centro[0], solta = lon => lon - c0 - 360 * Math.round((lon - c0) / 360) + c0;    // sem pulo na linha de data
  let a = 1e9, b = 1e9, c = -1e9, e = -1e9;
  for (const est of d.estados) for (const r of est.aneis) for (let k = 0; k < r.length; k += 2) {
    const lon = solta(r[k]); a = Math.min(a, lon); c = Math.max(c, lon); b = Math.min(b, r[k + 1]); e = Math.max(e, r[k + 1]);
  }
  const cosM = Math.max(0.25, Math.cos((b + e) / 2 * D2R));
  const lado = Math.max((c - a) * cosM, e - b), m = Math.max(0.5, lado * 0.2);
  const pLat = Math.max(0.02, (lado + 2 * m) / 300), pLon = pLat / cosM;
  const lon0 = a - m / cosM, lat0 = Math.min(85, e + m), lat1 = Math.max(-85, b - m);
  const nx = Math.ceil((c + m / cosM - lon0) / pLon) + 1, ny = Math.ceil((lat0 - lat1) / pLat) + 1;
  const g = grade(lon0, lat0, pLon, pLat, nx, ny, pLat > 0.12 ? 3 : pLat > 0.06 ? 2 : 1);
  suavizar(g, nx, ny); if (pLat < 0.05) suavizar(g, nx, ny);
  // máscara: qual estado tem cada nó (-1 = fora do país), preenchendo linha a linha (par-ímpar, como o canvas)
  const est = new Int16Array(nx * ny).fill(-1);
  d.estados.forEach((s, si) => {
    for (let j = 0; j < ny; j++) {
      const lat = lat0 - j * pLat, xs = [];
      for (const r of s.aneis) for (let k = 0, q = r.length - 2; k < r.length; q = k, k += 2) {
        const y1 = r[k + 1], y2 = r[q + 1]; if ((y1 > lat) === (y2 > lat)) continue;
        const x1 = solta(r[k]), x2 = solta(r[q]); xs.push(x1 + (lat - y1) * (x2 - x1) / (y2 - y1));
      }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k] - lon0) / pLon)), i1 = Math.min(nx - 1, Math.floor((xs[k + 1] - lon0) / pLon));
        for (let i = i0; i <= i1; i++) est[j * nx + i] = si;
      }
    }
  });
  // níveis: uns 12 a 22 dentro do país, "bonitos" (5, 10, 20, 25, 50... m); a cada 5 é linha mestra. No mar, até 8 níveis.
  let lo = 1e9, hi = -1e9, fundo = 0;
  for (let k = 0; k < g.length; k++) { if (est[k] >= 0) { lo = Math.min(lo, g[k]); hi = Math.max(hi, g[k]); } else fundo = Math.min(fundo, g[k]); }
  if (hi < lo) { lo = 0; hi = 100; }
  lo = Math.max(0, lo);
  const passo = NICE.find(s => (hi - lo) / s <= 22) || 1000;
  // níveis em passo fixo + níveis pelos "quantis" da altitude do país (assim a parte plana, como a Amazônia, também ganha linhas)
  const terra = []; for (let k = 0; k < g.length; k++) if (est[k] >= 0 && g[k] > 0) terra.push(g[k]);
  terra.sort((u, v) => u - v);
  const redondo = v => { const r = v < 60 ? 5 : v < 250 ? 10 : v < 1000 ? 25 : v < 3000 ? 50 : 100; return Math.max(r, Math.round(v / r) * r); };
  const conj = new Set();
  for (let L = Math.ceil(lo / passo) * passo || passo; L <= hi; L += passo) conj.add(L);
  if (terra.length > 50) for (let q = 0; q < 18; q++) conj.add(redondo(terra[Math.floor((q + 0.5) / 18 * terra.length)]));
  const folga = Math.max(4, (hi - lo) / 70), niveis = [];
  for (const L of [...conj].sort((u, v) => u - v)) if (L > 0 && L <= hi && (!niveis.length || L - niveis[niveis.length - 1] >= folga || L % (passo * 5) === 0)) niveis.push(L);
  if (fundo < -5 || lo <= passo) niveis.unshift(0);                           // a linha da costa
  if (fundo < -60) { const po = NICE_O.find(s => -fundo / s <= 8) || 2000; for (let L = -po; L >= fundo; L -= po) niveis.unshift(L); }
  // grade grossa (até 72 colunas) para levantar divisas e nomes junto com o relevo
  const pg = Math.max(1, Math.ceil(nx / 72)), gx = Math.ceil(nx / pg), gy = Math.ceil(ny / pg), gv = [];
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) gv.push(Math.round(Math.max(0, g[Math.min(ny - 1, j * pg) * nx + Math.min(nx - 1, i * pg)]) / 10));
  const linhas = []; let nPts = 0;
  const Q = 1000, tol = pLat * 0.35;
  niveis.forEach((L, n) => {
    for (const l of curvas(g, nx, ny, L + 0.01, (i, j) => [lon0 + i * pLon, lat0 - j * pLat])) {
      // corta a linha onde ela muda de estado (cada trecho sabe de qual estado é; -1 = fora do país)
      let ini = 0, atual = null;
      const qual = ([lon, lat]) => est[Math.max(0, Math.min(ny - 1, Math.round((lat0 - lat) / pLat))) * nx + Math.max(0, Math.min(nx - 1, Math.round((lon - lon0) / pLon)))];
      const fecha = (fim, s) => {
        const p = simplificar(l.slice(ini, fim + 1), tol);
        if (p.length >= 2 && comprimento(p) >= pLat * 2) { linhas.push(codificar([n, s], p, Q)); nPts += p.length; }
      };
      for (let k = 0; k < l.length; k++) {
        const s = qual(l[k]); if (atual === null) atual = s;
        if (s !== atual) { fecha(k, atual); ini = k; atual = s; }
      }
      fecha(l.length - 1, atual);
    }
  });
  const arq = path.join(SAIDA, cod + '.json');
  fs.writeFileSync(arq, JSON.stringify({ cod, q: Q, passo, niveis, mestre: passo * 5, grade: { lon0, lat0, p: pLat * pg, pLon: pLon * pg, nx: gx, ny: gy, v: gv }, linhas }));
  const kb = fs.statSync(arq).size / 1024; total += kb;
  if (SO || kb > 400) console.log(`${cod}: ${niveis.length} níveis de ${passo} m (${Math.round(lo)} a ${Math.round(hi)} m${fundo < -60 ? `, mar até ${Math.round(fundo)} m` : ''}), ${linhas.length} trechos, ${nPts} pontos, ${kb.toFixed(0)} KB`);
}
console.log(`${codigos.length} países, ${(total / 1024).toFixed(1)} MB`);
