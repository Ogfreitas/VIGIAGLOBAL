// RESUMO DO DIA ("O que importa hoje"): as histórias que mais fontes deram, sem IA (não gasta nada).
// Base: as manchetes principais do Google Notícias (Mundo e Destaques do Brasil), que já vêm agrupadas e em ordem de importância,
// conferidas com as 8 fontes rápidas do Plantão (quantas também deram a história nas últimas 24 h) e com os plantões.
// De manhã, no horário escolhido, vai para o Telegram.
const fs = require('fs');
const path = require('path');
const { UA, limpar, tag, guardarLinks } = require('./noticias');
const { paisesNoTexto, semAcento, ehFora } = require('./paises-texto');
const plantao = require('./plantao');
const calor = require('./calor');
const avisos = require('./avisos');
const sentinela = require('./sentinela');
const PAISES = require('./paises.json');

const FEEDS = {
  mundo: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=pt-BR&gl=BR&ceid=BR:pt-419',
  brasil: 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419',
};
const ARQ = path.join(__dirname, '..', 'dados', 'resumo.json');
let estado = { enviadoEm: '' };
try { estado = { ...estado, ...JSON.parse(fs.readFileSync(ARQ, 'utf8')) }; } catch { }
let atual = null, montando = null;

// cada item do Google é uma história com até 5 fontes (na descrição vem a lista delas)
async function lerDestaques(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('Google Notícias respondeu ' + r.status);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m, pos) => {
    const it = m[1], fonte = tag(it, 'source');
    let titulo = tag(it, 'title'); if (fonte && titulo.endsWith(' - ' + fonte)) titulo = titulo.slice(0, -(fonte.length + 3));
    const desc = (it.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
    const html = desc.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const fontes = [...new Set([fonte, ...[...html.matchAll(/<font[^>]*>([^<]+)<\/font>/g)].map(x => limpar(x[1]))].filter(Boolean))];
    const data = new Date(tag(it, 'pubDate')), link = tag(it, 'link');
    return { pos, titulo, fonte, fontes, link: /^https:\/\//.test(link) ? link : '', quando: isNaN(data) ? null : data.toISOString() };
  }).filter(n => n.titulo && !/^https?:\/\//.test(n.titulo) && !ehFora(n.titulo));
}

// quantas fontes rápidas (Reddit, BBC, Al Jazeera, g1...) também deram a história, e se ela virou plantão
function conferir(n, recentes, plantoes) {
  const r = plantao.raizes(n.titulo), ps = paisesNoTexto(n.titulo), fontes = new Set();
  for (const x of recentes) {
    let comuns = 0; for (const w of x.raizes || []) if (r.has(w)) comuns++;
    const pais = x.paises.some(p => ps.has(p));
    if ((pais && comuns >= 2) || comuns >= 3) fontes.add(x.fonte);
  }
  const virouPlantao = plantoes.some(p => (p.raizes || []).filter(w => r.has(w)).length >= 3);
  return { rapidas: [...fontes], plantao: virouPlantao, paises: [...ps], urgencia: plantao.urgencia(n.titulo) };
}

function ranquear(lista, recentes, plantoes, quantos) {
  const vistos = [];
  return lista.map(n => {
    const c = conferir(n, recentes, plantoes);
    const todas = [...new Set([...n.fontes, ...c.rapidas])];
    // pontos: fontes diferentes + posição que o Google deu + urgência + plantão
    const pontos = todas.length + Math.max(0, 12 - n.pos) / 3 + (c.urgencia >= 3 ? 2 : 0) + (c.plantao ? 3 : 0);
    return { ...n, ...c, todas, pontos: Math.round(pontos * 10) / 10 };
  }).sort((a, b) => b.pontos - a.pontos).filter(n => {
    // a mesma história contada por dois veículos aparece uma vez só
    const r = plantao.raizes(n.titulo);
    if (vistos.some(v => [...v].filter(w => r.has(w)).length >= 3)) return false;
    vistos.push(r); return true;
  }).slice(0, quantos).map(n => ({
    titulo: n.titulo, link: n.link, fonte: n.fonte, quando: n.quando, paises: n.paises,
    fontes: n.todas.length, nomes: n.todas.slice(0, 6), plantao: n.plantao, urgente: n.urgencia >= 3,
  }));
}

async function montar() {
  if (montando) return montando;
  montando = (async () => {
    const [mundo, brasil] = await Promise.all([lerDestaques(FEEDS.mundo).catch(() => []), lerDestaques(FEEDS.brasil).catch(() => [])]);
    if (!mundo.length && !brasil.length) throw new Error('Sem resposta do Google Notícias');
    const recentes = plantao.recentes(), plantoes = plantao.plantoesSalvos().filter(p => Date.now() - new Date(p.em).getTime() < 24 * 3600e3);
    const m = ranquear(mundo, recentes, plantoes, 10);
    // Brasil: só o que não é do mundo (o que já está no Mundo não repete)
    const rm = m.map(x => plantao.raizes(x.titulo));
    const b = ranquear(brasil.filter(n => !rm.some(r => [...plantao.raizes(n.titulo)].filter(w => r.has(w)).length >= 3)), recentes, plantoes, 5);
    guardarLinks([...m, ...b]);
    const sobe = plantao.dados().subindo.slice(0, 3);
    const quentes = calor.maisAquecidos(3).map(x => ({ ...x, nome: PAISES[x.cod] }));
    atual = { em: new Date().toISOString(), mundo: m, brasil: b, subindo: sobe, aquecidos: quentes, plantoes: plantoes.slice(0, 3).map(({ raizes, itens, ...p }) => p) };
    return atual;
  })().finally(() => { montando = null; });
  return montando;
}
// guarda 15 min (o Google atualiza os destaques mais ou menos nesse ritmo)
async function obter() {
  if (atual && Date.now() - new Date(atual.em).getTime() < 15 * 60e3) return atual;
  try { return await montar(); } catch (e) { if (atual) return atual; throw e; }
}

// ---------- Telegram ----------
const bandeira = cod => cod && /^[A-Z]{2}$/.test(cod) && cod !== 'XK' ? String.fromCodePoint(...[...cod].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '🌐';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function textoTelegram(r) {
  const d = new Date(), linha = (n, i, lista) => `${i + 1}. ${bandeira(n.paises[0] || (lista === r.brasil ? 'BR' : ''))} ${n.link ? `<a href="${esc(n.link)}">${esc(n.titulo)}</a>` : esc(n.titulo)}${n.plantao ? ' 🚨' : ''} <i>(${n.fontes} fonte${n.fontes > 1 ? 's' : ''})</i>`;
  const partes = [`☀️ <b>Vigia Global · Resumo de ${DIAS[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}</b>`, '',
    '🌍 <b>MUNDO</b>', ...r.mundo.map(linha)];
  if (r.brasil.length) partes.push('', '🇧🇷 <b>BRASIL</b>', ...r.brasil.map(linha));
  if (r.aquecidos.length) partes.push('', `🔥 <b>Esquentaram:</b> ${r.aquecidos.map(q => `${bandeira(q.cod)} ${esc(q.nome[0] + q.nome.slice(1).toLowerCase())}`).join(', ')}`);
  partes.push('', '<i>toque na manchete para abrir · abra o Vigia para o resto</i>');
  return partes.join('\n');
}
async function enviar() {
  const r = await obter();
  return avisos.telegram(textoTelegram(r), { html: true });
}
// todo minuto: se passou da hora escolhida e ainda não mandou hoje, manda (até 6 h depois: se o PC ligou tarde, ainda chega)
function conferirHora() {
  const cfg = sentinela.config().resumo;
  if (!cfg.telegram || !avisos.telegramPronto()) return;
  const agora = new Date(), hoje = agora.toLocaleDateString('sv-SE');      // AAAA-MM-DD (hora do PC)
  if (estado.enviadoEm === hoje) return;
  const [h, m] = cfg.hora.split(':').map(Number), alvo = new Date(agora); alvo.setHours(h, m, 0, 0);
  if (agora < alvo || agora - alvo > 6 * 3600e3) return;
  estado.enviadoEm = hoje;
  try { fs.writeFileSync(ARQ, JSON.stringify(estado)); } catch { }
  enviar().then(r => console.log('Resumo do dia no Telegram: ' + (r.ok ? 'enviado' : r.motivo))).catch(e => console.log('Resumo do dia: ' + e.message));
}

function iniciar() {
  setTimeout(() => obter().catch(() => { }), 90e3);      // monta o primeiro depois que o Plantão leu as fontes
  setInterval(conferirHora, 60e3);
}

module.exports = { iniciar, obter, enviar, textoTelegram };
