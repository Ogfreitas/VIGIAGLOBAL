// TV ao vivo: as emissoras de notícia de cada país que transmitem ao vivo, oficialmente, no YouTube.
// Conferido em 09/11/2026: canal oficial (verificado), ao vivo e liberado para assistir fora do YouTube.
// Ficaram de fora: Globo/GloboNews (o ao vivo é só no Globoplay, com login), Rússia (RT e Rossiya 24 saíram do YouTube),
// Sky TG24 (bloqueada no Brasil), Portugal, Chile, África do Sul e Quênia (sem ao vivo aberto na hora da conferência).
// O motor só procura o vídeo ao vivo quando alguém escolhe a emissora (parado, não gasta nada) e guarda a resposta por 10 min.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0';

// [código, nome, região, [[id do canal, nome, língua], …]] — a primeira emissora é a principal do país
const LISTA = [
  ['BR', 'Brasil', 'Américas', [['UCvdwhh_fDyWccR42-rReZLw', 'CNN Brasil', 'pt'], ['UCuiLR4p6wQ3xLEm15pEn1Xw', 'Record News', 'pt'], ['UC376n347Ob5Lwzq2WGzF1AA', 'SBT News', 'pt'], ['UCP391YRAjSOdM_bwievgaZA', 'Jovem Pan News', 'pt']]],
  ['US', 'Estados Unidos', 'Américas', [['UCBi2mrWuNuyYy4gbM6fU18Q', 'ABC News Live', 'en'], ['UCeY0bbntWzzVIaj2z3QigXg', 'NBC News NOW', 'en'], ['UCupvZG-5ko_eiXAupbDfxWw', 'CNN', 'en'], ['UCJg9wBPyKMNA5sRDnvzmkdg', 'LiveNOW from FOX', 'en']]],
  ['CA', 'Canadá', 'Américas', [['UCuFFtHWoLl5fauMMD5Ww2jA', 'CBC News', 'en']]],
  ['MX', 'México', 'Américas', [['UCUsm-fannqOY02PNN67C0KA', 'N+', 'es'], ['UCFxHplbcoJK9m70c4VyTIxg', 'Milenio', 'es'], ['UCUP6qv-_EIL0hwTsJaKYnvw', 'Azteca Noticias', 'es']]],
  ['AR', 'Argentina', 'Américas', [['UCj6PcyLvpnIRT_2W_mwa9Aw', 'TN Todo Noticias', 'es'], ['UCFgk2Q2mVO1BklRQhSv6p0w', 'C5N', 'es'], ['UCR9120YBAqMfntqgRTKmkjQ', 'A24', 'es']]],
  ['CO', 'Colômbia', 'Américas', [['UC2Xq2PK-got3Rtz9ZJ32hLQ', 'Noticias Caracol', 'es'], ['UCnr6pbeXJmkNQJ9PSYle7QQ', 'Noticias RCN', 'es']]],
  ['PE', 'Peru', 'Américas', [['UCpSJ5fGhmAME9Kx2D3ZvN3Q', 'Latina Noticias', 'es']]],
  ['VE', 'Venezuela', 'Américas', [['UCmuTmpLY35O3csvhyA6vrkg', 'teleSUR English (estatal)', 'en']]],
  ['GB', 'Reino Unido', 'Europa', [['UCoMdktPbSTixAyNGwb-UYkQ', 'Sky News', 'en'], ['UC0vn8ISa4LKMunLbzaXLnOQ', 'GB News', 'en']]],
  ['FR', 'França', 'Europa', [['UCCCPCZNChQdGa9EkATeye4g', 'France 24', 'fr'], ['UCQfwfsi5VrQ8yKZ-UWmAEFg', 'France 24 English', 'en'], ['UCO6K_kkdP-lnSCiO3tPx7WA', 'franceinfo', 'fr'], ['UCSrZ3UV4jOidv8ppoVuvW9Q', 'Euronews', 'en'], ['UCUmEPYxmnyQDeRUcFkslmQw', 'Euronews em Português', 'pt']]],
  ['DE', 'Alemanha', 'Europa', [['UCknLrEdhRCp1aegoMqRaCZg', 'DW News', 'en'], ['UCZMsvbAhhRblVGXmEXW8TSA', 'WELT', 'de']]],
  ['ES', 'Espanha', 'Europa', [['UC7QZIf0dta-XPXsp9Hv4dTw', 'RTVE Canal 24 Horas', 'es']]],
  ['PL', 'Polônia', 'Europa', [['UCzQZbOb86WvhOPoR7jgAfsA', 'TVP Info', 'pl']]],
  ['UA', 'Ucrânia', 'Europa', [['UCPY6gj8G7dqwPxg9KwHrj5Q', 'Suspilne Novyny', 'uk'], ['UCMEiyV8N2J93GdPNltPYM6w', 'Espreso TV', 'uk']]],
  ['TR', 'Turquia', 'Europa', [['UCBgTP2LOFVPmq15W-RH-WXA', 'TRT Haber', 'tr'], ['UCV6zcRug6Hqp1UX_FdyUeBg', 'CNN Türk', 'tr'], ['UC7fWeaHhqgM4Ry-RMpM2YYw', 'TRT World', 'en']]],
  ['VA', 'Vaticano', 'Europa', [['UCGYSq4b4DXmtK4jyq6r-FYg', 'Vatican News em Português', 'pt'], ['UC7E-LYc1wivk33iyt5bR5zQ', 'Vatican News', 'it']]],
  ['QA', 'Catar', 'Oriente Médio', [['UCNye-wNBqNL5ZzHSJj3l8Bg', 'Al Jazeera English', 'en'], ['UCfiwzLy-8yKzIbsmZTzxDgw', 'Al Jazeera Árabe', 'ar']]],
  ['SA', 'Arábia Saudita', 'Oriente Médio', [['UCahpxixMCwoANAftn6IxkTg', 'Al Arabiya', 'ar']]],
  ['AE', 'Emirados Árabes', 'Oriente Médio', [['UCIJXOvggjKtCagMfxvcCzAA', 'Sky News Arabia', 'ar']]],
  ['IL', 'Israel', 'Oriente Médio', [['UCgPYsPyGhhQJQ9zOUQDWDMA', 'i24NEWS (francês)', 'fr']]],
  ['IR', 'Irã', 'Oriente Médio', [['UCat6bC0Wrqq9Bcq7EkH_yQw', 'Iran International (de Londres)', 'fa']]],
  ['EG', 'Egito', 'Oriente Médio', [['UCktyejXTxWaKfrgp1Oq7CMQ', 'Al Qahera News', 'ar']]],
  ['NG', 'Nigéria', 'África', [['UCEXGDNclvmg6RW0vipJYsTQ', 'Channels Television', 'en']]],
  ['IN', 'Índia', 'Ásia e Oceania', [['UCYPvAwZP8pZhSMW8qs7cVCw', 'India Today', 'en'], ['UCZFMm1mMw0F81Z37aaEzTUA', 'NDTV', 'en'], ['UC_gUM8rL-Lrg6O3adPW9K1g', 'WION', 'en'], ['UCt4t-jeY85JegMlZ-E5UWtA', 'Aaj Tak', 'hi'], ['UC6RJ7-PaXg6TIH2BzZfTV7w', 'Times Now', 'en']]],
  ['PK', 'Paquistão', 'Ásia e Oceania', [['UC_vt34wimdCzdkrzVejwX9g', 'Geo News', 'ur']]],
  ['BD', 'Bangladesh', 'Ásia e Oceania', [['UCN6sm8iHiPd0cnoUardDAnw', 'Jamuna TV', 'bn']]],
  ['CN', 'China', 'Ásia e Oceania', [['UCgrNz-aDmcr2uuto8_DL2jg', 'CGTN (estatal)', 'en']]],
  ['JP', 'Japão', 'Ásia e Oceania', [['UCGCZAYq5Xxojl_tSXcVJhiQ', 'ANN News', 'ja'], ['UC6AG81pAkf6Lbi_1VC5NmPA', 'TBS NEWS DIG', 'ja'], ['UCoQBJMzcwmXrRSHBFAlTsIw', 'FNN', 'ja'], ['UCSPEjw8F2nQDtmUKPFNF7_A', 'NHK World', 'en']]],
  ['KR', 'Coreia do Sul', 'Ásia e Oceania', [['UChlgI3UHCOnwUGzWzbJ3H5w', 'YTN', 'ko']]],
  ['TW', 'Taiwan', 'Ásia e Oceania', [['UC5nwNW4KdC0SzrhF9BXEYOQ', 'TVBS', 'zh'], ['UCR3asjvr_WAaxwJYEDV_Bfw', 'EBC 東森', 'zh'], ['UC2VmWn8dAqkzlQqvy02E1PA', 'FTV 民視', 'zh']]],
  ['SG', 'Singapura', 'Ásia e Oceania', [['UC83jt4dlz1Gjl58fzQrrKZg', 'CNA', 'en']]],
  ['ID', 'Indonésia', 'Ásia e Oceania', [['UC5BMIWZe9isJXLZZWPWvBlg', 'Kompas TV', 'id'], ['UCzl0OrB3-ehunyotIQvK77A', 'Metro TV', 'id']]],
  ['PH', 'Filipinas', 'Ásia e Oceania', [['UCE2606prvXQc_noEqKxVJXA', 'ABS-CBN News', 'en'], ['UCqYw-CTd1dU2yGI71sEyqNw', 'GMA News', 'en']]],
  ['TH', 'Tailândia', 'Ásia e Oceania', [['UC5TOFhyb_LxL2VG_Zenhpzw', 'Thai PBS', 'th']]],
  ['AU', 'Austrália', 'Ásia e Oceania', [['UCVgO39Bk5sMo66-6o6Spn6Q', 'ABC News Australia', 'en']]],
];
const PAISES = LISTA.map(([p, nome, regiao, cs]) => ({ p, nome, regiao, canais: cs.map(([id, n, lingua]) => ({ id, nome: n, lingua })) }));
const POR_ID = new Map(PAISES.flatMap(x => x.canais.map(c => [c.id, { ...c, p: x.p }])));

function objetoDepois(s, marca) {          // o JSON {…} que vem depois de "marca" na página, respeitando as aspas
  let i = s.indexOf(marca); if (i < 0) return null;
  i = s.indexOf('{', i); if (i < 0) return null;
  let n = 0, aspas = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (aspas) { if (c === '\\') j++; else if (c === '"') aspas = false; continue; }
    if (c === '"') aspas = true; else if (c === '{') n++; else if (c === '}' && --n === 0) { try { return JSON.parse(s.slice(i, j + 1)); } catch { return null; } }
  }
  return null;
}

// a página /live do canal diz qual vídeo está no ar agora
async function procurar(id) {
  const r = await fetch(`https://www.youtube.com/channel/${id}/live`, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('YouTube respondeu ' + r.status);
  const s = await r.text();
  const pr = objetoDepois(s, 'var ytInitialPlayerResponse') || {}, vd = pr.videoDetails || {}, ps = pr.playabilityStatus || {};
  let vendo = 0;
  try {
    const d = objetoDepois(s, 'var ytInitialData') || {};
    const cs = d.contents.twoColumnWatchNextResults.results.results.contents;
    vendo = +(cs.find(c => c.videoPrimaryInfoRenderer).videoPrimaryInfoRenderer.viewCount.videoViewCountRenderer.originalViewCount) || 0;
  } catch { }
  const aoVivo = !!vd.isLive && ps.status === 'OK';
  return {
    id, aoVivo, videoId: aoVivo ? vd.videoId : null, titulo: aoVivo ? vd.title : '', vendo: aoVivo ? vendo : 0,
    embed: aoVivo ? ps.playableInEmbed !== false : null,
    motivo: aoVivo ? '' : ps.status && ps.status !== 'OK' ? (ps.reason || ps.status) : 'fora do ar agora',
  };
}
const cache = new Map();          // id → { em, dados } ou { pendente }
async function aoVivo(id, deNovo) {          // deNovo: a transmissão acabou, procura outra (se a resposta guardada tem mais de 1 min)
  if (!POR_ID.has(id)) return null;
  const k = cache.get(id);
  if (k && k.pendente) return k.pendente;
  const idade = k ? Date.now() - k.em : Infinity;
  if (k && idade < (deNovo ? 60e3 : k.dados.aoVivo ? 10 * 60e3 : 2 * 60e3)) return k.dados;
  const pendente = procurar(id).then(d => { cache.set(id, { em: Date.now(), dados: d }); return d; },
    e => { cache.delete(id); return { id, aoVivo: false, videoId: null, erro: true, motivo: 'não consegui falar com o YouTube (' + e.message + ')' }; });
  cache.set(id, { pendente });
  return pendente;
}
// a lista, com o que já se sabe de cada canal (só o que foi procurado nos últimos 10 min)
function lista() {
  const agora = Date.now();
  return {
    paises: PAISES.map(x => ({ ...x, canais: x.canais.map(c => { const k = cache.get(c.id); return { ...c, aoVivo: k && k.dados && agora - k.em < 10 * 60e3 ? k.dados.aoVivo : null }; }) })),
  };
}
module.exports = { lista, aoVivo };
