// Gera o cidades.js (as cidades que brilham no globo) a partir do Natural Earth "populated places" (domínio público).
// Baixe ne_50m_populated_places_simple.geojson de github.com/nvkelso/natural-earth-vector (pasta geojson) e rode:
//   node ferramentas/gerar-cidades.js <arquivo.geojson>
// Saída: cidades.js na raiz, com const CIDADES = [[lon, lat, mil habitantes], ...] (só o que a janela precisa).
const fs = require('fs');
const path = require('path');
const [, , ARQ] = process.argv;
if (!ARQ) { console.log('uso: node ferramentas/gerar-cidades.js <ne_50m_populated_places_simple.geojson>'); process.exit(1); }
const d = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
const lista = d.features.map(f => {
  const p = f.properties, [lon, lat] = f.geometry.coordinates;
  return [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100, Math.max(1, Math.round((p.pop_max || p.pop_min || 0) / 1000))];
}).filter(c => isFinite(c[0]) && isFinite(c[1])).sort((a, b) => b[2] - a[2]);
const saida = path.join(__dirname, '..', 'cidades.js');
fs.writeFileSync(saida, '// Cidades que brilham no globo do Vigia (Natural Earth 50m populated places, domínio público), geradas por\n'
  + '// ferramentas/gerar-cidades.js: [longitude, latitude, mil habitantes], da maior para a menor.\n'
  + 'const CIDADES = ' + JSON.stringify(lista) + ';\n');
console.log(`${lista.length} cidades → cidades.js (${(fs.statSync(saida).size / 1024).toFixed(0)} KB)`);
