// Motor do Vigia Global: serve a janela e busca as notícias por país e assunto (só no seu PC: http://localhost:8788)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { noticias, CATEGORIAS, linkSeguro } = require('./motor/noticias');
const { abrirNoBrave, caminhoBrave, ajudante } = require('./motor/brave');
const calor = require('./motor/calor');
const sentinela = require('./motor/sentinela');
const avisos = require('./motor/avisos');
const plantao = require('./motor/plantao');
const resumo = require('./motor/resumo');
const tv = require('./motor/tv');

const PORT = 8788, ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
};
const PUBLICOS = new Set(['/vigia-global.html', '/tv.html', '/icone.svg', '/icone.png', '/icone.ico']);
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
// só a própria janela do Vigia pode pedir para abrir links (nenhum site de fora)
const ORIGENS = new Set([`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]);
// nomes dos estados de cada país (do mapa estados/XX.json), para só buscar estado que existe
const ESTADOS = new Map();
function estadosDe(cod) {
  if (!/^[A-Z]{2}$/.test(cod)) return new Set();
  if (!ESTADOS.has(cod)) { try { ESTADOS.set(cod, new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'estados', cod + '.json'), 'utf8')).estados.map(e => e.nome))); } catch { ESTADOS.set(cod, new Set()); } }
  return ESTADOS.get(cod);
}
function lerCorpo(req, max) {
  return new Promise((ok, erro) => {
    let s = ''; req.setEncoding('utf8');
    req.on('data', c => { s += c; if (s.length > max) { erro(new Error('Pedido grande demais')); req.destroy(); } });
    req.on('end', () => ok(s)); req.on('error', erro);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  try {
    if (rel === '/api/saude') return json(res, 200, { ok: true, app: 'vigia-global', assuntos: Object.keys(CATEGORIAS), brave: !!caminhoBrave() });
    // Termômetro: manchetes das últimas 24 h por país e assunto
    if (rel === '/api/calor') return json(res, 200, calor.dados());
    // Plantão: faixa "ao vivo", plantões e estado das fontes rápidas. ?p=BR = o que chegou desse país
    // AO VIVO: tudo o que as fontes rápidas trouxeram nas últimas 12 h
    if (rel === '/api/aovivo') return json(res, 200, plantao.lista());
    // Resumo do dia: GET lê; POST /api/resumo/enviar manda agora no Telegram (só a janela do Vigia pode pedir)
    if (rel === '/api/resumo') return json(res, 200, await resumo.obter());
    if (rel === '/api/resumo/enviar') {
      if (req.method !== 'POST') return json(res, 405, { erro: 'Use POST' });
      if (!ORIGENS.has(req.headers.origin) || !/^application\/json/.test(req.headers['content-type'] || '')) return json(res, 403, { erro: 'Pedido não permitido' });
      if (!avisos.telegramPronto()) return json(res, 400, { erro: 'Telegram não configurado' });
      return json(res, 200, await resumo.enviar());
    }
    if (rel === '/api/plantao') {
      const p = String(url.searchParams.get('p') || '').toUpperCase(), e = url.searchParams.get('e');
      return json(res, 200, plantao.dados(/^[A-Z]{2}$/.test(p) ? p : null, e && estadosDe(p).has(e) ? e : null));
    }
    // TV ao vivo: a lista das emissoras por país; /api/tv/aovivo?c=<canal> procura o vídeo que está no ar agora (só canais da lista)
    if (rel === '/api/tv') return json(res, 200, tv.lista());
    if (rel === '/api/tv/aovivo') {
      const d = await tv.aoVivo(String(url.searchParams.get('c') || ''), url.searchParams.has('denovo'));
      return d ? json(res, 200, d) : json(res, 400, { erro: 'Canal desconhecido' });
    }
    // Vigiados: GET lê; POST grava {paises, termos, avisos, intervalo}; POST /testar manda um aviso de teste
    if (rel === '/api/vigiados' || rel === '/api/vigiados/testar') {
      if (req.method === 'GET') return json(res, 200, sentinela.resumo());
      if (req.method !== 'POST') return json(res, 405, { erro: 'Use GET ou POST' });
      if (!ORIGENS.has(req.headers.origin) || !/^application\/json/.test(req.headers['content-type'] || '')) return json(res, 403, { erro: 'Pedido não permitido' });
      let corpo; try { corpo = JSON.parse(await lerCorpo(req, 8192) || '{}'); } catch { return json(res, 400, { erro: 'Pedido inválido' }); }
      if (rel === '/api/vigiados') { sentinela.salvarConfig(corpo || {}); return json(res, 200, sentinela.resumo()); }
      const r = sentinela.resumo(), tg = r.avisos.telegram && r.telegramPronto;
      if (r.avisos.windows) avisos.windows('Vigia Global · teste', 'Os avisos estão funcionando. Assim chega um alerta dos seus vigiados.', 'clique para abrir o Google Notícias', 'https://news.google.com/?hl=pt-BR&gl=BR&ceid=BR:pt-419');
      const t = tg ? await avisos.telegram('🌐 Vigia Global\n\nTeste: os avisos estão funcionando.') : null;
      return json(res, 200, { ok: true, windows: r.avisos.windows, telegram: t });
    }
    // Abre uma manchete no Brave. Corpo: {"link": "https://news.google.com/rss/articles/..."}
    if (rel === '/api/abrir') {
      if (req.method !== 'POST') return json(res, 405, { erro: 'Use POST' });
      if (!ORIGENS.has(req.headers.origin) || !/^application\/json/.test(req.headers['content-type'] || '')) return json(res, 403, { erro: 'Pedido não permitido' });
      let link; try { link = linkSeguro(JSON.parse(await lerCorpo(req, 4096)).link); } catch { link = null; }
      if (!link) return json(res, 400, { erro: 'Link desconhecido' });
      return (await abrirNoBrave(link)) ? json(res, 200, { ok: true }) : json(res, 404, { erro: 'Brave não encontrado' });
    }
    // Manchetes de um país, só dos assuntos pedidos. Ex.: /api/noticias?p=JP&cats=economia,tecnologia
    // De um estado: /api/noticias?p=BR&e=Minas%20Gerais&cats=geral,economia (o estado tem que existir no mapa do país)
    if (rel === '/api/noticias') {
      const p = String(url.searchParams.get('p') || '').toUpperCase(), e = url.searchParams.get('e');
      if (e && !estadosDe(p).has(e)) return json(res, 400, { erro: 'Estado desconhecido' });
      const pedidos = String(url.searchParams.get('cats') || '').split(',').filter(c => CATEGORIAS[c] || (e && c === 'geral'));
      const d = await noticias(p, pedidos.length ? pedidos : Object.keys(CATEGORIAS), e || null);
      return d ? json(res, 200, d) : json(res, 400, { erro: 'País desconhecido' });
    }
  } catch (e) {
    return json(res, 502, { erro: e.message });
  }
  // Arquivos da janela (só os públicos) e os mapas de estados (estados/BR.json)
  if (rel === '/') rel = '/vigia-global.html';
  if (rel === '/tv') rel = '/tv.html';
  if (/^\/estados\/[A-Z]{2}\.json$/.test(rel)) {
    return fs.readFile(path.join(ROOT, rel), (err, data) => {
      if (err) { res.writeHead(404); return res.end('{}'); }
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'max-age=86400' }); res.end(data);
    });
  }
  if (!PUBLICOS.has(rel)) { res.writeHead(404); return res.end('Não encontrado'); }
  fs.readFile(path.join(ROOT, rel), (err, data) => {
    if (err) { res.writeHead(404); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(rel).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Vigia Global rodando em http://localhost:${PORT}`);
  calor.iniciar(); sentinela.iniciar(); plantao.iniciar(); resumo.iniciar();
  ajudante().then(exe => console.log(exe ? 'Brave: ajudante pronto' : 'Brave: sem ajudante (a janela do Brave pode abrir atrás)'));
});
