// Tradução rápida de manchetes para português (o mesmo serviço grátis do Google Tradutor, sem chave).
// Só traduz o que vai aparecer (manchetes urgentes) e no máximo 60 a cada 10 minutos; se falhar, fica no original.
const { UA } = require('./noticias');

const cache = new Map();
let usos = [];

// reserva: quantas traduções deixar livres (as de fundo deixam espaço para as urgentes que chegarem)
async function traduzir(texto, reserva = 0) {
  if (!texto) return null;
  if (cache.has(texto)) return cache.get(texto);
  usos = usos.filter(t => Date.now() - t < 10 * 60e3);
  if (usos.length >= 60 - reserva) return null;
  usos.push(Date.now());
  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=' + encodeURIComponent(texto.slice(0, 400));
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json(), pt = (j[0] || []).map(x => x[0]).join('').trim();
    if (!pt) return null;
    cache.set(texto, pt);
    if (cache.size > 3000) cache.delete(cache.keys().next().value);
    return pt;
  } catch { return null; }
}

module.exports = { traduzir };
