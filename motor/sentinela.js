// SENTINELA: confere os seus vigiados de tempos em tempos, mesmo com a janela fechada (basta o motor estar ligado).
// - palavras vigiadas: manchete nova com a palavra no título
// - países vigiados: manchete nova e urgente sobre o país (ataque, terremoto, golpe...) e quando o país "esquenta" no termômetro
// Na primeira vez que um vigiado entra, o que já existe só é anotado (sem avisar), para não chover notificação velha.
const fs = require('fs');
const path = require('path');
const { lerFeed, buscaUrl, naFila, termoDo, PAISES } = require('./noticias');
const { paisesNoTexto, semAcento } = require('./paises-texto');
const calor = require('./calor');
const avisos = require('./avisos');

const DADOS = path.join(__dirname, '..', 'dados');
const ARQ = { cfg: path.join(DADOS, 'vigiados.json'), vistos: path.join(DADOS, 'vistos.json'), achados: path.join(DADOS, 'achados.json') };
const PADRAO = { paises: [], termos: [], avisos: { windows: true, telegram: false }, intervalo: 15, plantao: { avisar: true, sensibilidade: 'normal' }, resumo: { telegram: true, hora: '07:30' } };
const SENSIBILIDADES = ['alta', 'normal', 'baixa'];
const INTERVALOS = [10, 15, 30, 60];
const URGENTE = '(urgente OR "última hora" OR ataque OR atentado OR explosão OR terremoto OR tsunami OR furacão OR golpe OR renúncia OR "estado de emergência" OR invasão OR bombardeio OR mísseis OR mortos)';
const PALAVRAS_URGENTES = /\b(urgente|ultima hora|ataques?|atentados?|explos(ao|oes)|terremotos?|sismo|tsunami|furac(ao|oes)|tufao|golpe|renuncia|renuncias|estado de emergencia|invas(ao|oes)|invade|bombardei\w*|misseis|missil|mortos|mortes|morrem|tiroteio|evacua\w*)\b/i;
const FRESCA = 6 * 3600e3;       // só avisa manchete das últimas 6 h

const ler = (arq, padrao) => { try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return padrao; } };
const gravar = (arq, obj) => { try { fs.mkdirSync(DADOS, { recursive: true }); fs.writeFileSync(arq, JSON.stringify(obj, null, 1)); } catch { } };
const chave = s => semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim();
const nomeBonito = cod => (PAISES[cod] || cod).toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

function config() {
  const c = ler(ARQ.cfg, {});
  return { ...PADRAO, ...c, avisos: { ...PADRAO.avisos, ...(c.avisos || {}) }, plantao: { ...PADRAO.plantao, ...(c.plantao || {}) }, resumo: { ...PADRAO.resumo, ...(c.resumo || {}) } };
}
// grava só o que é válido: até 15 países conhecidos, até 12 palavras de 2 a 40 letras
function salvarConfig(parcial) {
  const c = config();
  if (Array.isArray(parcial.paises)) c.paises = [...new Set(parcial.paises.map(p => String(p).toUpperCase()).filter(p => PAISES[p]))].slice(0, 15);
  if (Array.isArray(parcial.termos)) {
    const vistos = new Set();
    c.termos = parcial.termos.map(t => String(t).replace(/[\u0000-\u001f"]/g, '').replace(/\s+/g, ' ').trim())
      .filter(t => t.length >= 2 && t.length <= 40 && !vistos.has(chave(t)) && vistos.add(chave(t))).slice(0, 12);
  }
  if (parcial.avisos && typeof parcial.avisos === 'object') {
    if (typeof parcial.avisos.windows === 'boolean') c.avisos.windows = parcial.avisos.windows;
    if (typeof parcial.avisos.telegram === 'boolean') c.avisos.telegram = parcial.avisos.telegram;
  }
  if (INTERVALOS.includes(+parcial.intervalo)) c.intervalo = +parcial.intervalo;
  if (parcial.plantao && typeof parcial.plantao === 'object') {
    if (typeof parcial.plantao.avisar === 'boolean') c.plantao.avisar = parcial.plantao.avisar;
    if (SENSIBILIDADES.includes(parcial.plantao.sensibilidade)) c.plantao.sensibilidade = parcial.plantao.sensibilidade;
  }
  if (parcial.resumo && typeof parcial.resumo === 'object') {          // resumo do dia no Telegram: liga/desliga e horário (HH:MM)
    if (typeof parcial.resumo.telegram === 'boolean') c.resumo.telegram = parcial.resumo.telegram;
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(parcial.resumo.hora || '')) c.resumo.hora = parcial.resumo.hora;
  }
  gravar(ARQ.cfg, c);
  agendar(4000);                 // vigiado novo: confere logo (e anota o que já existe)
  return c;
}

let vistos = ler(ARQ.vistos, {});
vistos = { titulos: vistos.titulos || [], semeados: vistos.semeados || [], picos: vistos.picos || {} };
const titulosVistos = new Set(vistos.titulos);
let achados = ler(ARQ.achados, []);
const estado = { ultima: null, proxima: null, rodando: false, erro: null };

// todas as palavras da expressão aparecem no título?
function tituloTem(titulo, termo) {
  const t = ' ' + chave(titulo).replace(/[^\p{L}\d]+/gu, ' ') + ' ';
  return chave(termo).split(/[^\p{L}\d]+/u).filter(Boolean).every(w => t.includes(' ' + w + ' ') || (w.length >= 5 && t.includes(' ' + w)));
}

async function conferir(alvo, busca, aceita) {
  let itens;
  try { itens = await naFila(() => lerFeed(buscaUrl(busca), 40, 40)); } catch { return null; }
  const semeado = vistos.semeados.includes(alvo.id), novos = [];
  for (const n of itens) {
    if (!aceita(n)) continue;
    const k = alvo.id + '|' + chave(n.titulo);
    if (titulosVistos.has(k)) continue;
    titulosVistos.add(k); vistos.titulos.push(k);
    const fresca = n.quando && Date.now() - new Date(n.quando).getTime() < FRESCA;
    if (semeado && fresca) novos.push({ ...alvo.info, ...n });
  }
  if (!semeado) vistos.semeados.push(alvo.id);
  return novos;
}

async function checar() {
  if (estado.rodando) return;
  estado.rodando = true; estado.erro = null;
  const c = config(), novos = [];
  let falhas = 0, total = 0;
  try {
    const tarefas = [
      ...c.termos.map(termo => conferir({ id: 't:' + chave(termo), info: { tipo: 'termo', alvo: termo } },
        `${/\s/.test(termo) ? `"${termo}"` : termo} when:1d`, n => tituloTem(n.titulo, termo))),
      ...c.paises.map(cod => conferir({ id: 'p:' + cod, info: { tipo: 'pais', alvo: cod, nome: nomeBonito(cod) } },
        `${termoDo(cod)} ${URGENTE} when:1d`, n => paisesNoTexto(n.titulo).has(cod) && PALAVRAS_URGENTES.test(semAcento(n.titulo)))),
    ];
    total = tarefas.length;
    for (const r of await Promise.all(tarefas)) { if (r === null) falhas++; else novos.push(...r); }
    // país vigiado que esquentou no termômetro (no máximo um aviso a cada 6 h por país)
    const d = calor.dados();
    for (const cod of c.paises) {
      const q = calor.esquentou(cod);
      if (!q || Date.now() - (vistos.picos[cod] || 0) < 6 * 3600e3) continue;
      vistos.picos[cod] = Date.now();
      const top = (d.paises[cod] && d.paises[cod].top[0]) || {};
      novos.push({ tipo: 'pico', alvo: cod, nome: nomeBonito(cod), titulo: `${q.agora} manchetes nas últimas 24 h (o normal é ~${q.normal}). Mais recente: ${top.titulo || '—'}`, fonte: top.fonte || '', link: top.link || '', quando: new Date().toISOString() });
    }
    if (total && falhas === total) estado.erro = 'Sem resposta do Google Notícias';
    await registrar(novos, c);
  } catch (e) { estado.erro = e.message; }
  finally { estado.rodando = false; estado.ultima = new Date().toISOString(); }
}

// guarda os achados novos e avisa (Windows / Telegram)
async function registrar(novos, c) {
  vistos.titulos = vistos.titulos.slice(-6000);
  gravar(ARQ.vistos, vistos);
  if (!novos.length) return;
  novos.sort((a, b) => (b.quando || '').localeCompare(a.quando || ''));
  const em = new Date().toISOString();
  achados = [...novos.map((a, i) => ({ id: `${Date.now()}-${i}`, em, ...a })), ...achados].slice(0, 150);
  gravar(ARQ.achados, achados);
  await avisos.avisar(novos, { windows: c.avisos.windows, telegram: c.avisos.telegram && avisos.telegramPronto() });
}

// manchetes que chegaram pelo Plantão (fontes rápidas, a cada 2–4 min): confere na hora com os vigiados
async function doPlantao(itens) {
  const c = config(), novos = [];
  if (!c.termos.length && !c.paises.length) return;
  const marcar = (alvo, n) => {
    if (!vistos.semeados.includes(alvo.id)) return;          // vigiado recém-adicionado: a conferida normal anota primeiro
    const k = alvo.id + '|' + chave(n.titulo);
    if (titulosVistos.has(k)) return;
    titulosVistos.add(k); vistos.titulos.push(k);
    novos.push({ ...alvo.info, titulo: n.titulo, fonte: n.fonte, link: n.link, quando: n.quando, rapido: true });
  };
  for (const n of itens) {
    for (const termo of c.termos) if (tituloTem(n.titulo, termo) || (n.original && tituloTem(n.original, termo))) { marcar({ id: 't:' + chave(termo), info: { tipo: 'termo', alvo: termo } }, n); break; }
    if (n.urgencia >= 1) for (const cod of c.paises) if (n.paises.includes(cod)) marcar({ id: 'p:' + cod, info: { tipo: 'pais', alvo: cod, nome: nomeBonito(cod) } }, n);
  }
  if (novos.length) await registrar(novos, c);
}

let timer = null;
function agendar(ms) {
  clearTimeout(timer);
  const espera = ms ?? config().intervalo * 60e3;
  estado.proxima = new Date(Date.now() + espera).toISOString();
  // sem internet (o PC acabou de ligar): confere de novo em 2 min, em vez de esperar o intervalo inteiro
  timer = setTimeout(async () => { await checar(); agendar(estado.erro === 'Sem resposta do Google Notícias' ? 2 * 60e3 : undefined); }, espera);
}

function iniciar() { avisos.registrarApp(); agendar(60e3); }       // a primeira conferida, 1 minuto depois de ligar

function resumo() {
  return { ...config(), telegramPronto: avisos.telegramPronto(), achados: achados.slice(0, 60), estado };
}

module.exports = { iniciar, resumo, salvarConfig, checar, tituloTem, config, doPlantao };
