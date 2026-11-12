// De que país é o veículo? (para o "visto em": mostrar DE ONDE vem a cobertura, não só quantas fontes)
// Regra: sem certeza, fica sem país. Nunca chuta.
//  1) as fontes rápidas fixas (BBC, Al Jazeera, g1, CNN Brasil, DW); o Reddit fica sem país
//  2) veículos conhecidos com site .com/.net/.org (lista abaixo)
//  3) o final do site (.br, .co.uk, .de, .fr…), menos os finais que o mundo usa à toa (.co, .io, .tv, .me…)
const PAISES = require('./paises.json');

const FIXAS = { bbc: 'GB', aljazeera: 'QA', g1: 'BR', cnnbr: 'BR', dw: 'DE' };
// nomes das fontes fixas (para os plantões antigos, que só guardaram o nome)
const NOMES_FIXOS = { 'BBC World': 'GB', 'Al Jazeera': 'QA', 'g1': 'BR', 'CNN Brasil': 'BR', 'DW Brasil': 'DE' };

// domínios conhecidos (o mais específico primeiro não importa: compara pelo final do endereço)
const CONHECIDOS = {
  US: 'cnn.com nytimes.com washingtonpost.com wsj.com apnews.com bloomberg.com foxnews.com nbcnews.com cbsnews.com abcnews.go.com npr.org politico.com axios.com usatoday.com latimes.com cnbc.com time.com newsweek.com thehill.com forbes.com businessinsider.com voanews.com nypost.com theatlantic.com vox.com',
  GB: 'bbc.com theguardian.com reuters.com ft.com economist.com skynews.com',
  QA: 'aljazeera.com aljazeera.net',
  DE: 'dw.com',
  FR: 'france24.com afp.com',
  ES: 'elpais.com',
  AR: 'clarin.com infobae.com',
  BR: 'globo.com metropoles.com exame.com r7.com brasil247.com ocafezinho.com istoedinheiro.com sbtnews.com',
  RU: 'rt.com tass.com sputnikglobe.com sputniknewsbr.com.br',
  CN: 'xinhuanet.com cgtn.com news.cn',
  IL: 'timesofisrael.com jpost.com haaretz.com ynetnews.com',
  IN: 'indiatimes.com hindustantimes.com ndtv.com thehindu.com',
  JP: 'kyodonews.net',
  KR: 'koreaherald.com',
  TR: 'dailysabah.com trtworld.com',
  UA: 'kyivindependent.com',
  PK: 'dawn.com',
  IR: 'tehrantimes.com',
  SA: 'arabnews.com',
  AE: 'thenationalnews.com gulfnews.com khaleejtimes.com',
  VE: 'telesurtv.net',
  CO: 'eltiempo.com',
  CL: 'emol.com latercera.com',
};
const DOMINIO = [];
for (const [cod, l] of Object.entries(CONHECIDOS)) for (const d of l.split(' ')) DOMINIO.push([d, cod]);
// finais de 2 letras que não dizem o país (usados por qualquer um)
const GENERICOS = new Set('co io tv me ai ly fm gg cc ws to la nu tk am sh so vc ms st ac bz ag gd fo im je ag ly cx eu'.split(' '));

function paisDoDominio(url) {
  if (!url) return '';
  let host = '';
  try { host = new URL(/^https?:\/\//.test(url) ? url : 'https://' + url).hostname.toLowerCase(); } catch { return ''; }
  host = host.replace(/^www\./, '');
  for (const [d, cod] of DOMINIO) if (host === d || host.endsWith('.' + d)) return cod;
  const fim = host.split('.').pop();
  if (fim === 'uk') return 'GB';
  if (fim.length === 2 && !GENERICOS.has(fim) && PAISES[fim.toUpperCase()]) return fim.toUpperCase();
  return '';
}
// país do veículo de uma manchete das fontes rápidas (fonteId das fixas; no Google Notícias, o site do veículo)
function paisDaFonte(n) {
  if (FIXAS[n.fonteId]) return FIXAS[n.fonteId];
  if (n.fonteId === 'gnews') return paisDoDominio(n.dominio);
  return '';
}
const paisDoNome = nome => NOMES_FIXOS[nome] || '';

module.exports = { paisDoDominio, paisDaFonte, paisDoNome };
