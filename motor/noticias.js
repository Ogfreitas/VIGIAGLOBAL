// Notícias de um país por ASSUNTO (15 assuntos: economia, mercados, conflitos, religião...), em português,
// pelo Google Notícias (RSS grátis, sem chave). Cada país + assunto fica guardado 15 min.
const PAISES = require('./paises.json');          // código ISO -> nome em português (gerado do mapa Natural Earth)
const { paisesNoTexto, ehFora } = require('./paises-texto');
const { paisDoDominio } = require('./fontes-pais');
const UA ={ 'User-Agent': 'Mozilla/5.0 (VigiaGlobal/1.0)' };
// países cujo nome no Google Notícias é escrito de outro jeito
const TERMO_ESPECIAL = {
  US: '(EUA OR "Estados Unidos")', GB: '("Reino Unido" OR Inglaterra)', AE: '("Emirados Árabes" OR Dubai)',
  NL: '(Holanda OR "Países Baixos")', CD: '("RD Congo" OR "República Democrática do Congo")', KR: '"Coreia do Sul"',
  KP: '"Coreia do Norte"', CZ: '(Tchéquia OR "República Tcheca")', CI: '("Costa do Marfim")', BA: '(Bósnia)',
};
// os 15 grandes assuntos globais -> palavras da busca + quantos dias para trás (sem um invadir o outro)
// Geopolítica = diplomacia, sanções, tarifas, cúpulas; Conflitos = guerra, terror e crime organizado (antes vinham juntos)
const CATEGORIAS = {
  economia: { q: '(economia OR inflação OR PIB OR juros OR "banco central" OR desemprego OR recessão OR orçamento OR exportações)', dias: 3 },
  mercados: { q: '("bolsa de valores" OR "mercado de ações" OR "mercado financeiro" OR "Wall Street" OR Ibovespa OR dólar OR câmbio OR investidores OR "títulos públicos")', dias: 3 },
  cripto: { q: '(bitcoin OR cripto OR criptomoedas OR blockchain OR ethereum OR stablecoin)', dias: 7 },
  geopolitica: { q: '(geopolítica OR diplomacia OR diplomático OR sanções OR cúpula OR chanceler OR OTAN OR ONU OR tarifas OR "acordo comercial" OR embaixador OR "disputa territorial")', dias: 3 },
  conflitos: { q: '(guerra OR terrorismo OR terrorista OR atentado OR "crime organizado" OR cartel OR facção OR milícia OR "ataque armado" OR bombardeio OR "grupo armado" OR insurgentes OR tropas)', dias: 3 },
  politica: { q: '(eleições OR eleição OR governo OR parlamento OR congresso OR presidente OR "primeiro-ministro" OR protestos OR oposição)', dias: 3 },
  justica: { q: '(corrupção OR condenado OR condenação OR "suprema corte" OR tribunal OR propina OR "lavagem de dinheiro" OR impeachment OR escândalo OR "preso por")', dias: 3 },
  tecnologia: { q: '(tecnologia OR "inteligência artificial" OR startup OR software OR chips OR semicondutores OR "big tech" OR ciberataque OR hackers)', dias: 7 },
  ciencia: { q: '(NASA OR SpaceX OR foguete OR satélite OR astronautas OR "descoberta científica" OR cientistas OR pesquisadores OR telescópio OR "estação espacial" OR astronomia)', dias: 7 },
  energia: { q: '(petróleo OR gás OR OPEP OR "energia renovável" OR "energia solar" OR eólica OR eletricidade OR "energia nuclear")', dias: 5 },
  commodities: { q: '(commodities OR soja OR milho OR café OR trigo OR "minério de ferro" OR ouro OR cobre OR agronegócio OR safra)', dias: 7 },
  clima: { q: '("mudanças climáticas" OR "crise climática" OR terremoto OR furacão OR tufão OR enchente OR enchentes OR seca OR "onda de calor" OR "incêndio florestal" OR tsunami OR ciclone)', dias: 5 },
  migracao: { q: '(imigrantes OR imigração OR refugiados OR deportação OR deportados OR migrantes OR "direitos humanos" OR "asilo político" OR "pedido de asilo" OR xenofobia)', dias: 5 },
  religiao: { q: '(Papa OR Vaticano OR igreja OR cristãos OR "perseguição religiosa" OR muçulmanos OR evangélicos OR "liberdade religiosa" OR católicos OR judeus OR religiosos)', dias: 7 },
  saude: { q: '(saúde OR OMS OR epidemia OR pandemia OR surto OR vacina OR vírus OR doença)', dias: 7 },
};
const cache = new Map();                          // 'BR|economia' -> { em, itens }
const LINKS = new Set();                          // links já entregues à janela (só esses o Brave abre)

// devolve o link pronto para abrir, ou null se não for uma notícia que o Vigia mostrou
function linkSeguro(u) {
  if (typeof u !== 'string' || u.length > 2048) return null;
  let x; try { x = new URL(u); } catch { return null; }
  if (x.protocol !== 'https:' || x.username || x.password) return null;
  if (LINKS.has(u)) return x.href;
  // a TV ao vivo abre o vídeo no YouTube (só o endereço de um vídeo, nada mais)
  if (x.hostname === 'www.youtube.com' && x.pathname === '/watch' && /^[\w-]{11}$/.test(x.searchParams.get('v') || '') && [...x.searchParams.keys()].length === 1) return x.href;
  // depois de reiniciar o motor a janela ainda tem links antigos: os do Google Notícias continuam valendo
  return x.hostname === 'news.google.com' && /^\/(rss\/)?articles\//.test(x.pathname) ? x.href : null;
}
function guardarLinks(itens) {
  for (const n of itens) if (n.link) LINKS.add(n.link);
  while (LINKS.size > 20000) LINKS.delete(LINKS.values().next().value);
}

function limpar(s) {
  return String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, ' ').trim();
}
const tag = (it, nome) => limpar((it.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`)) || [])[1]);
function termoDo(cod) {
  if (TERMO_ESPECIAL[cod]) return TERMO_ESPECIAL[cod];
  const nome = PAISES[cod].charAt(0) + PAISES[cod].slice(1).toLowerCase();   // o Google não liga para maiúsculas, mas fica legível
  return nome.includes(' ') ? `"${nome}"` : nome;
}

// no máximo 4 buscas ao mesmo tempo (educado com o Google e sem travar nada)
let emAndamento = 0; const fila = [];
function naFila(fn) {
  return new Promise((ok, erro) => {
    const vai = () => { emAndamento++; fn().then(ok, erro).finally(() => { emAndamento--; const prox = fila.shift(); if (prox) prox(); }); };
    emAndamento < 4 ? vai() : fila.push(vai);
  });
}

// endereço de uma busca no Google Notícias em português
const buscaUrl = q => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';
// lê um feed RSS: olha os "olhar" primeiros itens e devolve até "max" manchetes sem repetir
async function lerFeed(url, olhar = 15, max = 6) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('Google Notícias respondeu ' + r.status);
  const xml = await r.text(), vistos = new Set();
  const itens = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, olhar).map(m => {
    const it = m[1], fonte = tag(it, 'source');
    let titulo = tag(it, 'title');
    if (fonte && titulo.endsWith(' - ' + fonte)) titulo = titulo.slice(0, -(fonte.length + 3));
    const link = tag(it, 'link'), data = new Date(tag(it, 'pubDate'));
    // "visto em": o país do veículo, pelo site dele (sem certeza, fica vazio)
    const origem = paisDoDominio((it.match(/<source[^>]*url="([^"]+)"/) || [])[1] || '');
    return { titulo, fonte, link: /^https:\/\//.test(link) ? link : '', quando: isNaN(data) ? null : data.toISOString(), vistoEm: origem ? [origem] : [] };
  }).filter(n => n.titulo && n.titulo.length <= 240 && !vistos.has(n.titulo) && vistos.add(n.titulo)).slice(0, max);
  guardarLinks(itens);
  return itens;
}
// As 6 mais relevantes segundo o Google (a janela escolhe a mais recente entre as primeiras para o pop-up)
// O Google acha o país no TEXTO da matéria, então às vezes vem manchete que nem é dele (ex.: "Ebola no Congo" na Nigéria).
// Fora do Brasil: primeiro as que citam o país no título; se tem 3 ou mais, só elas. Esporte/novela/loteria saem sempre.
async function buscar(termo, cat, cod) {
  const { q, dias } = CATEGORIAS[cat];
  const itens = (await lerFeed(buscaUrl(`${termo} ${q} when:${dias}d`), 30, 30)).filter(n => !ehFora(n.titulo));
  if (!cod || cod === 'BR') return itens.slice(0, 6);       // notícia daqui quase nunca diz "Brasil" no título
  const cita = itens.filter(n => paisesNoTexto(n.titulo).has(cod));
  return cita.length >= 3 ? cita.slice(0, 6) : [...cita, ...itens.filter(n => !cita.includes(n))].slice(0, Math.max(cita.length, 4));
}

// ESTADOS: busca pelo nome do estado entre aspas; fora do Brasil vai junto o nome do país (para "Geórgia" dos EUA não virar o país)
const TERMO_ESTADO = { 'BR|Pará': '("estado do Pará" OR "no Pará" OR "do Pará" OR Belém)' };   // "Pará" sem acento vira "para"
function termoEstado(cod, estado) {
  const base = estado.replace(/\s*\(.*\)\s*$/, '').replace(/"/g, '').trim();
  return TERMO_ESTADO[cod + '|' + base] || `"${base}"` + (cod === 'BR' ? '' : ' ' + termoDo(cod));
}
// estado tem menos notícia: olha 3x mais dias para trás; "geral" = tudo sobre o estado nos últimos 2 dias
async function buscarEstado(termo, cat) {
  if (cat === 'geral') return (await lerFeed(buscaUrl(`${termo} when:2d`), 30, 30)).filter(n => !ehFora(n.titulo)).slice(0, 8);
  const { q, dias } = CATEGORIAS[cat];
  return (await lerFeed(buscaUrl(`${termo} ${q} when:${Math.min(14, dias * 3)}d`), 25, 25)).filter(n => !ehFora(n.titulo)).slice(0, 6);
}

// { economia: [...], geopolitica: [...], em } só com os assuntos pedidos. Um assunto que falhar volta vazio e não fica guardado.
// Com "estado", busca dentro daquele estado (e aceita o assunto "geral").
async function noticias(cod, cats, estado) {
  if (!PAISES[cod]) return null;
  const termo = estado ? termoEstado(cod, estado) : termoDo(cod), dados = { em: new Date().toISOString() }, falhas = [];
  await Promise.all(cats.map(async cat => {
    const k = cod + '|' + (estado || '') + '|' + cat, c = cache.get(k);
    if (c && Date.now() - c.em < 15 * 60e3) { dados[cat] = c.itens; return; }
    try { const itens = await naFila(() => estado ? buscarEstado(termo, cat) : buscar(termo, cat, cod)); guardarLinks(itens); cache.set(k, { em: Date.now(), itens }); dados[cat] = itens; }
    catch (e) { dados[cat] = []; falhas.push(cat); }
  }));
  if (falhas.length === cats.length) throw new Error('Sem resposta do Google Notícias');
  if (falhas.length) dados.falhas = falhas;
  if (cache.size > 3000) for (const [k, v] of cache) if (Date.now() - v.em > 15 * 60e3) cache.delete(k);
  return dados;
}

module.exports = { noticias, CATEGORIAS, linkSeguro, lerFeed, buscaUrl, naFila, termoDo, PAISES, guardarLinks, limpar, tag, UA };
