// TERMÔMETRO MUNDIAL: quantas manchetes das últimas 24 h citam cada país, por assunto.
// Em vez de buscar país por país (175 x 10 buscas), faz UMA busca global por assunto (+ a seção "Mundo")
// e conta os países citados nos títulos: 11 buscas a cada 15 minutos.
const fs = require('fs');
const path = require('path');
const { CATEGORIAS, lerFeed, buscaUrl, naFila } = require('./noticias');
const { paisesNoTexto, semAcento } = require('./paises-texto');

const A_CADA = 15 * 60e3;
const HIST = path.join(__dirname, '..', 'dados', 'calor-historico.json');
const ATUAL = path.join(__dirname, '..', 'dados', 'calor-atual.json');      // a última medição boa, para aparecer logo ao religar o PC
// sem internet (o PC acabou de ligar e o Wi-Fi ainda está conectando): tenta de novo logo, em vez de esperar 15 min
const ESPERAS = [30e3, 60e3, 2 * 60e3, 5 * 60e3];
const hora = () => new Date().toLocaleTimeString('pt-BR');
const MUNDO = 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=pt-BR&gl=BR&ceid=BR:pt-419';
const FONTES = [...Object.entries(CATEGORIAS).map(([id, c]) => ({ id, url: buscaUrl(`${c.q} when:1d`) })), { id: 'mundo', url: MUNDO }];

let atual = { em: null, paises: {}, max: 0, falhas: [] };
let historico = [];             // [{ em, n: { US: 34, ... } }] uma leitura a cada 15 min, até ~25 h
try { historico = JSON.parse(fs.readFileSync(HIST, 'utf8')).filter(h => h && h.n); } catch { }
// medição de até 6 h atrás: a janela já mostra (com "medido há X min") enquanto mede de novo
try { const a = JSON.parse(fs.readFileSync(ATUAL, 'utf8')); if (a && a.em && a.paises && Date.now() - new Date(a.em).getTime() < 6 * 3600e3) atual = a; } catch { }
let rodando = null;

async function atualizar() {
  if (rodando) return rodando;
  rodando = (async () => {
    const paises = {}, falhas = [], vistos = new Set();
    await Promise.all(FONTES.map(async f => {
      let itens;
      try { itens = await naFila(() => lerFeed(f.url, 100, 100)); } catch { falhas.push(f.id); return; }
      const ontem = Date.now() - 26 * 3600e3;
      for (const n of itens) {
        if (n.quando && new Date(n.quando).getTime() < ontem) continue;
        const chave = semAcento(n.titulo).toLowerCase(), repetida = vistos.has(chave); vistos.add(chave);
        for (const cod of paisesNoTexto(n.titulo)) {
          const p = paises[cod] || (paises[cod] = { total: 0, cats: {}, top: [] });
          p.cats[f.id] = (p.cats[f.id] || 0) + 1;
          if (repetida) continue;                   // a mesma manchete em dois assuntos conta uma vez no total
          p.total++;
          p.top.push({ ...n, cat: f.id });
        }
      }
    }));
    if (falhas.length === FONTES.length) throw new Error('Sem resposta do Google Notícias');
    for (const p of Object.values(paises)) p.top = p.top.sort((a, b) => (b.quando || '').localeCompare(a.quando || '')).slice(0, 4);
    const max = Math.max(0, ...Object.values(paises).map(p => p.total));
    atual = { em: new Date().toISOString(), paises, max, falhas };
    historico.push({ em: atual.em, n: Object.fromEntries(Object.entries(paises).map(([c, p]) => [c, p.total])) });
    historico = historico.slice(-100);
    try { fs.writeFileSync(HIST, JSON.stringify(historico)); } catch { }
    try { fs.writeFileSync(ATUAL, JSON.stringify(atual)); } catch { }
    return atual;
  })().finally(() => { rodando = null; });
  return rodando;
}

// país "esquentou": agora tem pelo menos 10 manchetes e o dobro do normal dele (mediana das leituras anteriores)
function esquentou(cod) {
  const ant = historico.slice(0, -1).map(h => h.n[cod] || 0);
  if (ant.length < 6) return null;
  const agora = (historico[historico.length - 1] || { n: {} }).n[cod] || 0;
  const ord = ant.slice(-24).sort((a, b) => a - b), normal = ord[Math.floor(ord.length / 2)];
  return agora >= 10 && agora >= 2 * Math.max(3, normal) ? { agora, normal } : null;
}

// os países que mais subiram em relação ao normal deles (para o resumo do dia); precisa de umas 2 h de leituras
function maisAquecidos(n = 3) {
  const ult = historico[historico.length - 1]; if (!ult || historico.length < 7) return [];
  return Object.entries(ult.n).map(([cod, agora]) => {
    const ord = historico.slice(-25, -1).map(h => h.n[cod] || 0).sort((a, b) => a - b), normal = ord[Math.floor(ord.length / 2)];
    return { cod, agora, normal, razao: agora / Math.max(3, normal) };
  }).filter(x => x.agora >= 8 && x.razao >= 1.5).sort((a, b) => b.razao - a.razao).slice(0, n);
}

function iniciar() {
  let falhas = 0;
  const vai = () => atualizar().then(() => { falhas = 0; setTimeout(vai, A_CADA); }, e => {
    const espera = ESPERAS[Math.min(falhas++, ESPERAS.length - 1)];
    console.log(`${hora()} Termômetro: ${e.message} (tento de novo em ${espera / 1000} s)`);
    setTimeout(vai, espera);
  });
  setTimeout(vai, 3000);
}

module.exports = { iniciar, atualizar, esquentou, maisAquecidos, dados: () => atual };
