// PLANTÃO: notícia bomba em minutos, não em meia hora.
// Lê fontes rápidas a cada 2–4 min (Reddit r/worldnews, Al Jazeera, BBC, g1, CNN Brasil, DW e o Google Notícias da última hora),
// traduz as manchetes em inglês que parecem urgentes e junta as que falam do mesmo assunto.
// Quando várias fontes diferentes dão a mesma coisa urgente em pouco tempo (e o Reddit está subindo), vira PLANTÃO:
// faixa vermelha na janela, notificação do Windows e Telegram.
const fs = require('fs');
const path = require('path');
const { UA, limpar, tag, guardarLinks, buscaUrl } = require('./noticias');
const { paisesNoTexto, semAcento, ehFora } = require('./paises-texto');
const { traduzir } = require('./traduzir');
const { paisDaFonte, paisDoNome } = require('./fontes-pais');
const avisos = require('./avisos');
const sentinela = require('./sentinela');

const ARQ = path.join(__dirname, '..', 'dados', 'plantao.json');
const FONTES = [
  { id: 'reddit', nome: 'Reddit r/worldnews', url: 'https://www.reddit.com/r/worldnews/new/.rss?limit=50', en: true, rede: true, min: 3 },
  { id: 'reddit-sobe', nome: 'Reddit (subindo)', url: 'https://www.reddit.com/r/worldnews/rising/.rss?limit=25', en: true, rede: true, sobe: true, min: 4 },
  { id: 'aljazeera', nome: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', en: true, min: 2 },
  { id: 'bbc', nome: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', en: true, min: 3 },
  { id: 'g1', nome: 'g1', url: 'https://g1.globo.com/rss/g1/', min: 2 },
  { id: 'cnnbr', nome: 'CNN Brasil', url: 'https://www.cnnbrasil.com.br/feed/', min: 3 },
  { id: 'dw', nome: 'DW Brasil', url: 'https://rss.dw.com/rdf/rss-br-all', min: 4 },
  { id: 'gnews', nome: 'Google Notícias', url: buscaUrl('(urgente OR "última hora" OR breaking) when:1h'), min: 3 },
].map((f, i) => ({ ...f, prox: Date.now() + (f.id === 'reddit-sobe' ? 50e3 : i * 1500), falhas: 0, etag: '', lastmod: '', ok: null, ultima: null, erro: null }));

// palavras de urgência (procuradas no título em português e no original em inglês, sem acento)
const FORTE = /\b(terremoto|sismo|tsunami|golpe de estado|golpe militar|atentado|explos(ao|oes)|assassinad\w*|nuclear|declara guerra|lei marcial|estado de emergencia|queda de aviao|aviao cai|acidente aereo|ataque terrorista|massacre|reféns|refens|renuncia|morre aos|morreu|earthquake|tsunami|coup|assassinat\w*|explosion|blast|declares war|martial law|plane crash|terror attack|massacre|mass shooting|hostages?|resigns|has died|dies at)\b/i;
const MEDIO = /\b(invas(ao|oes)|invade|invasion|invades|ataques?|atacam?|m[ií]sseis|missil|bombarde\w*|mortos|mortes|feridos|tiroteio|evacua\w*|ofensiva|drones?|incendio|enchentes?|furac(ao|oes)|tuf(ao|oes)|ciclone|confrontos?|sancoes|prisao|preso|killed|dead|wounded|shooting|strikes?|attack\w*|missiles?|evacuat\w*|offensive|wildfire|floods?|hurricane|typhoon|cyclone|clashes|arrested|sanctions)\b/i;
const URG = /\b(urgente|ultima hora|breaking|just in)\b/i;
const urgencia = t => { if (ehFora(t)) return 0; const s = semAcento(t); return (FORTE.test(s) ? 3 : MEDIO.test(s) ? 1 : 0) + (URG.test(s) ? 2 : 0); };

const PARADAS = new Set('para pela pelo pelos pelas como mais apos sobre entre contra quando onde depois antes ainda diz dizem afirma segundo apos esta este essa esse isso pode podem deve devem sera foram foi sao tem novo nova novos novas from with that this after over into amid says said will have been were their about than more what when where which while news world live updates video'.split(' '));
const raizes = t => new Set(semAcento(t).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !PARADAS.has(w)).map(w => w.slice(0, 6)));

const NIVEIS = { alta: 6, normal: 7.5, baixa: 9.5 };   // pontos para virar PLANTÃO (alta = avisa mais)
let itens = [];                                        // manchetes das últimas 24 h (todas as fontes)
const vistos = new Set();                              // ids já lidos
let grupos = [];                                       // assuntos das últimas 3 h
let salvo = { plantoes: [] };
try { salvo = { plantoes: [], ...JSON.parse(fs.readFileSync(ARQ, 'utf8')) }; } catch { }

// lê RSS ou Atom (Reddit): título, link, data; no Reddit, o link é o da notícia de fora
function lerItens(xml, fonte) {
  return [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(m => {
    const it = m[2];
    let link = tag(it, 'link') || (it.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '';
    if (fonte.rede) {
      const fora = (it.match(/&lt;a href=&quot;(.*?)&quot;&gt;\[link\]/) || [])[1];
      if (fora && !/reddit\.com|redd\.it/.test(fora)) link = limpar(fora);
    }
    let titulo = tag(it, 'title');
    if (fonte.id === 'gnews') { const f = tag(it, 'source'); if (f && titulo.endsWith(' - ' + f)) titulo = titulo.slice(0, -(f.length + 3)); }
    const data = new Date(tag(it, 'pubDate') || tag(it, 'published') || tag(it, 'dc:date') || tag(it, 'updated'));
    // no Google Notícias: nome e site do veículo (o site diz de que país ele é, para o "visto em")
    const gn = fonte.id === 'gnews';
    return { titulo, link: /^https:\/\//.test(link) ? link : '', quando: isNaN(data) ? null : data.toISOString(), veiculo: gn ? tag(it, 'source') : '', dominio: gn ? ((it.match(/<source[^>]*url="([^"]+)"/) || [])[1] || '') : '' };
  }).filter(n => n.titulo && n.titulo.length <= 300);
}

async function lerFonte(f) {
  const h = { ...UA }; if (f.etag) h['If-None-Match'] = f.etag; if (f.lastmod) h['If-Modified-Since'] = f.lastmod;
  const r = await fetch(f.url, { headers: h, signal: AbortSignal.timeout(15000) });
  if (r.status === 304) return [];                     // nada mudou desde a última leitura
  if (!r.ok) throw new Error('respondeu ' + r.status);
  f.etag = r.headers.get('etag') || ''; f.lastmod = r.headers.get('last-modified') || '';
  return lerItens(await r.text(), f);
}

let primeira = true;
async function rodada() {
  const agora = Date.now(), devidas = FONTES.filter(f => agora >= f.prox);
  if (!devidas.length) return;
  const novos = [];
  await Promise.all(devidas.map(async f => {
    try {
      const lidos = await lerFonte(f);
      f.ok = true; f.erro = null; f.falhas = 0; f.ultima = new Date().toISOString();
      f.prox = Date.now() + f.min * 60e3 + Math.random() * 20e3;
      for (const n of lidos) {
        const id = f.id.replace('-sobe', '') + '|' + (n.link || semAcento(n.titulo).toLowerCase());
        const velho = n.quando && agora - new Date(n.quando).getTime() > 24 * 3600e3;
        if (f.sobe) { const ja = itens.find(x => x.id === id); if (ja) { ja.sobe = true; continue; } }
        if (vistos.has(id) || velho) continue;
        vistos.add(id);
        novos.push({ id, fonteId: f.id.replace('-sobe', ''), fonte: n.veiculo || f.nome, dominio: n.dominio, en: !!f.en, rede: !!f.rede, sobe: !!f.sobe, original: n.titulo, link: n.link, quando: n.quando || new Date().toISOString(), chegou: new Date().toISOString() });
      }
    } catch (e) {
      f.ok = false; f.erro = e.message; f.falhas++;
      f.prox = Date.now() + Math.min(20, f.min * 2 ** Math.min(f.falhas, 3)) * 60e3;    // barrado: espera mais (até 20 min)
    }
  }));
  if (!novos.length) { primeira = false; return; }
  // urgência e tradução (só das que parecem urgentes, para não gastar)
  await Promise.all(novos.map(async n => {
    n.urgencia = urgencia(n.original);
    n.titulo = n.original;
    if (n.en && (n.urgencia >= 1 || n.sobe)) { const pt = await traduzir(n.original); if (pt) { n.titulo = pt; n.trad = true; n.urgencia = Math.max(n.urgencia, urgencia(pt)); } }
    n.paises = [...paisesNoTexto(n.titulo)];
    n.fora = ehFora(n.titulo);          // esporte, novela, loteria...: fica fora da lista AO VIVO
    n.raizes = [...raizes(n.titulo + (n.en ? ' ' + n.original : ''))];
  }));
  guardarLinks(novos);
  itens = [...novos, ...itens].filter(n => agora - new Date(n.quando).getTime() < 24 * 3600e3).slice(0, 4000);   // 24 h (o resumo do dia usa)
  versaoItens++;
  for (const n of novos) if (n.urgencia >= 1 || n.sobe) agrupar(n);
  const plantoes = avaliar();
  // vigiados: as manchetes rápidas também valem (sem esperar a conferida de 15 min)
  sentinela.doPlantao(novos.filter(n => agora - new Date(n.quando).getTime() < (primeira ? 30 : 120) * 60e3)).catch(() => { });
  if (plantoes.length) avisarPlantoes(plantoes);
  primeira = false;
}

// junta a manchete ao assunto parecido (mesmo país e palavras em comum) ou abre um assunto novo
function agrupar(n) {
  const r = new Set(n.raizes), ps = new Set(n.paises), agora = Date.now();
  grupos = grupos.filter(g => agora - g.ultimo < 3 * 3600e3);
  let melhor = null, nota = 0;
  for (const g of grupos) {
    let comuns = 0; for (const w of r) if (g.raizes.has(w)) comuns++;
    const pais = n.paises.some(c => g.paises.has(c));
    const s = comuns + (pais ? 1.5 : 0);
    if ((pais && comuns >= 2) || comuns >= 3) if (s > nota) { nota = s; melhor = g; }
  }
  if (!melhor) { melhor = { id: n.id, itens: [], raizes: new Set(), paises: new Set(), primeiro: new Date(n.quando).getTime(), ultimo: 0, alertado: false }; grupos.push(melhor); }
  melhor.itens.push(n); r.forEach(w => melhor.raizes.add(w)); ps.forEach(c => melhor.paises.add(c));
  melhor.primeiro = Math.min(melhor.primeiro, new Date(n.quando).getTime()); melhor.ultimo = Math.max(melhor.ultimo, Date.now());
}

function pontos(g) {
  const fontes = new Set(g.itens.map(i => i.fonteId === 'gnews' ? 'g:' + i.fonte : i.fonteId));
  const urg = Math.max(...g.itens.map(i => i.urgencia));
  return { fontes, pts: urg + 1.5 * (fontes.size - 1) + (g.itens.some(i => i.sobe) ? 2 : 0) + (g.itens.some(i => i.rede) ? 0.5 : 0) };
}
const principal = g => g.itens.slice().sort((a, b) => (b.en ? 0 : 1) - (a.en ? 0 : 1) || b.urgencia - a.urgencia)[0];   // de preferência em português
function paisDoGrupo(g) {
  const c = {}; for (const i of g.itens) for (const p of i.paises) c[p] = (c[p] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([p]) => p);
}

function avaliar() {
  const cfg = sentinela.config(), corte = NIVEIS[cfg.plantao.sensibilidade] || NIVEIS.normal, novos = [];
  for (const g of grupos) {
    if (g.alertado) continue;
    const { fontes, pts } = pontos(g);
    if (pts < corte || fontes.size < 3 || Date.now() - g.primeiro > 2 * 3600e3) continue;
    g.alertado = true;
    // o mesmo assunto já deu plantão nas últimas 12 h (ex.: o motor foi reiniciado): não repete
    if (salvo.plantoes.some(p => Date.now() - new Date(p.em).getTime() < 12 * 3600e3 && (p.raizes || []).filter(w => g.raizes.has(w)).length >= 3)) continue;
    const p = principal(g), paises = paisDoGrupo(g);
    novos.push({ id: g.id, em: new Date().toISOString(), titulo: p.titulo, original: p.en ? p.original : '', link: p.link, quando: new Date(g.primeiro).toISOString(),
      paises, fontes: [...new Set(g.itens.map(i => i.fonte))], vistoEm: [...new Set(g.itens.map(paisDaFonte).filter(Boolean))], n: g.itens.length, pontos: Math.round(pts * 10) / 10, raizes: [...g.raizes].slice(0, 40),
      itens: g.itens.slice(0, 8).map(i => ({ titulo: i.titulo, fonte: i.fonte, link: i.link, quando: i.quando })) });
  }
  if (novos.length) {
    salvo.plantoes = [...novos, ...salvo.plantoes].slice(0, 40);
    try { fs.writeFileSync(ARQ, JSON.stringify(salvo, null, 1)); } catch { }
  }
  return novos;
}

function avisarPlantoes(lista) {
  const cfg = sentinela.config();
  if (!cfg.plantao.avisar) return;
  const nomes = require('./paises.json');
  const achados = lista.map(p => ({ tipo: 'plantao', alvo: p.paises[0] || '', nome: p.paises[0] ? nomes[p.paises[0]] : 'MUNDO',
    titulo: `${p.titulo} (${p.fontes.length} fontes)`, fonte: p.fontes.slice(0, 3).join(', '), link: p.link }));
  avisos.avisar(achados, { windows: cfg.avisos.windows, telegram: cfg.avisos.telegram && avisos.telegramPronto() }).catch(() => { });
}

// o que a janela recebe: a faixa "ao vivo" (urgentes), os plantões e o estado das fontes
function dados(pais, estado) {
  const recentes = itens.filter(n => Date.now() - new Date(n.quando).getTime() < 3 * 3600e3), historias = gruposAgora();
  const enxuto = n => ({ id: n.id, titulo: n.titulo, original: n.en && n.titulo !== n.original ? n.original : '', fonte: n.fonte, link: n.link, quando: n.quando, paises: n.paises, urgencia: n.urgencia, sobe: n.sobe, vistoEm: vistoEmDe(n, historias.get(n.id)) });
  // na faixa: o que é forte (terremoto, atentado...) ou urgente de outro país / subindo no Reddit (crime local fica de fora)
  const deFora = n => n.paises.some(p => p !== 'BR');
  const faixa = recentes.filter(n => n.urgencia >= 3 || (n.urgencia >= 1 && (n.sobe || deFora(n))))
    .sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 30).map(enxuto);
  const r = {
    // plantões antigos não guardaram o "visto em": sai do nome das fontes fixas
    em: new Date().toISOString(), faixa, plantoes: salvo.plantoes.slice(0, 12).map(({ raizes, ...p }) => ({ ...p, vistoEm: p.vistoEm || [...new Set((p.itens || []).map(i => paisDoNome(i.fonte)).filter(Boolean))] })),
    fontes: FONTES.map(f => ({ nome: f.nome, ok: f.ok, ultima: f.ultima, erro: f.erro })),
    // assuntos que estão crescendo agora (ainda não viraram plantão): para a janela mostrar "esquentando"
    subindo: grupos.filter(g => !g.alertado && Date.now() - g.ultimo < 3600e3).map(g => ({ g, ...pontos(g) })).filter(x => x.fontes.size >= 2)
      .sort((a, b) => b.pts - a.pts).slice(0, 5).map(x => { const p = principal(x.g); return { titulo: p.titulo, link: p.link, fontes: x.fontes.size, paises: paisDoGrupo(x.g), quando: p.quando }; }),
  };
  if (pais) r.pais = itens.filter(n => n.paises.includes(pais)).sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 12).map(enxuto);
  const nomeE = estado && semAcento(estado.replace(/\s*\(.*\)\s*$/, '')).toLowerCase();
  if (estado && nomeE.length >= 4 && !['para', 'acre', 'centro', 'capital', 'norte', 'leste', 'oeste'].includes(nomeE)) {      // manchetes rápidas que citam o estado pelo nome
    const nome = nomeE, re =new RegExp(`(^|[^a-z])${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`);
    r.estado = itens.filter(n => re.test(semAcento(n.titulo).toLowerCase())).sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 10).map(enxuto);
  }
  return r;
}

// as manchetes em inglês que não eram urgentes vão sendo traduzidas aos poucos (as mais novas primeiro), para a lista AO VIVO
async function traduzirPendentes(max = 12) {
  const fila = itens.filter(n => n.en && !n.trad && (n.tentativas || 0) < 3).sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, max);
  for (const n of fila) {
    const pt = await traduzir(n.original, 15);
    if (!pt) { n.tentativas = (n.tentativas || 0) + 1; break; }   // sem cota agora: tenta na próxima rodada (3 falhas e desiste dela)
    n.titulo = pt; n.trad = true;
    n.urgencia = Math.max(n.urgencia, urgencia(pt));
    n.paises = [...new Set([...n.paises, ...paisesNoTexto(pt)])];
    n.fora = ehFora(pt);
    n.raizes = [...raizes(pt + ' ' + n.original)];       // agora em português também: junta melhor com as outras fontes
    versaoItens++;
  }
}
// quantas fontes diferentes deram a mesma história, para TODAS as manchetes (o agrupar acima só junta as urgentes).
// Mesma regra do agrupar (mesmo país e 2 palavras em comum, ou 3 palavras, em até 3 h), comparando manchete com manchete
// (por um índice de palavras, para ser rápido). Só recalcula quando chegam manchetes novas ou traduções.
let versaoItens = 0, cacheGrupos = { v: -1, m: new Map() };
const chaveFonte = n => n.fonteId === 'gnews' ? 'g:' + n.fonte : n.fonteId;
function gruposDaLista(lst) {
  if (cacheGrupos.v === versaoItens) return cacheGrupos.m;
  const ordem = lst.slice().sort((a, b) => a.q - b.q), idx = new Map(), grupo = new Map();
  ordem.forEach(({ n, q }, i) => {
    const comuns = new Map();
    for (const w of n.raizes || []) for (const j of idx.get(w) || []) if (q - ordem[j].q <= 3 * 3600e3) comuns.set(j, (comuns.get(j) || 0) + 1);
    let melhor = -1, nota = 0;
    for (const [j, c] of comuns) {
      const pais = n.paises.some(p => ordem[j].n.paises.includes(p));
      if (!((pais && c >= 2) || c >= 3)) continue;
      const s = c + (pais ? 1.5 : 0); if (s > nota) { nota = s; melhor = j; }
    }
    const g = melhor >= 0 ? grupo.get(ordem[melhor].n.id) : { id: n.id, fontes: new Set(), vistoEm: new Set() };
    g.fontes.add(chaveFonte(n)); grupo.set(n.id, g);
    const pf = paisDaFonte(n); if (pf) g.vistoEm.add(pf);          // de que países vem a cobertura (na ordem em que apareceu)
    for (const w of n.raizes || []) { if (!idx.has(w)) idx.set(w, []); idx.get(w).push(i); }
  });
  cacheGrupos = { v: versaoItens, m: grupo };
  return grupo;
}
// "visto em": os países dos veículos que deram a história; fora de qualquer história, só o da própria fonte
function vistoEmDe(n, g) { if (g && g.vistoEm.size) return [...g.vistoEm]; const p = paisDaFonte(n); return p ? [p] : []; }
// as histórias das últimas 12 h agora (para as listas do país, do estado e da faixa)
function gruposAgora() {
  const agora = Date.now();
  return gruposDaLista(itens.filter(n => !n.fora && agora - new Date(n.quando).getTime() < 12 * 3600e3).map(n => ({ n, q: Math.min(new Date(n.quando).getTime(), new Date(n.chegou).getTime()) })));
}
// lista AO VIVO: tudo o que as fontes rápidas trouxeram nas últimas 12 h (menos esporte e afins), a mais nova em cima
// (fontes = quantas fontes diferentes deram a mesma história; grupo = id da história, igual nas manchetes dela)
const DO_MUNDO = new Set(['reddit', 'aljazeera', 'bbc', 'dw']);
function lista() {
  const agora = Date.now();
  const todos = itens.filter(n => !n.fora && agora - new Date(n.quando).getTime() < 12 * 3600e3).map(n => ({ n, q: Math.min(new Date(n.quando).getTime(), new Date(n.chegou).getTime()) }));
  const grupos = gruposDaLista(todos);
  return {
    em: new Date().toISOString(),
    fontes: FONTES.filter(f => !f.sobe).map(f => ({ nome: f.nome, ok: f.ok, ultima: f.ultima })),
    itens: todos.sort((a, b) => b.q - a.q).slice(0, 300).map(({ n, q }) => {
      const g = grupos.get(n.id);
      return {
        id: n.id, titulo: n.titulo, original: n.en && n.trad ? n.original : '', en: n.en && !n.trad, fonte: n.fonte, link: n.link,
        quando: new Date(q).toISOString(), chegou: n.chegou, paises: n.paises, urgencia: n.urgencia, sobe: n.sobe,
        mundo: DO_MUNDO.has(n.fonteId) || n.paises.some(p => p !== 'BR'),
        fontes: g ? g.fontes.size : 1, grupo: g ? g.id : n.id, vistoEm: vistoEmDe(n, g),
      };
    }),
    agora,
  };
}

function iniciar() {
  const vai = () => rodada().then(() => traduzirPendentes()).catch(e => console.log('Plantão: ' + e.message));
  setTimeout(vai, 5000);
  setInterval(vai, 30e3);
}

// para o resumo do dia: as manchetes guardadas (24 h) e os plantões
const recentes = () => itens.filter(n => !n.fora);
const plantoesSalvos = () => salvo.plantoes;

module.exports = { iniciar, dados, lista, urgencia, raizes, recentes, plantoesSalvos };
