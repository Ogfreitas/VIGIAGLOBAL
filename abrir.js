// Abre o Vigia Global: liga o motor escondido (se ainda não estiver ligado) e abre a janela do app.
// Com "--sem-janela", só liga o motor.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PASTA = __dirname;
const URL_APP = 'http://localhost:8788';
const EDGES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

async function motorLigado() {
  try { const r = await fetch(URL_APP + '/api/saude', { signal: AbortSignal.timeout(4000) }); return r.ok; }
  catch { return false; }
}
const esperar = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!(await motorLigado())) {
    fs.mkdirSync(path.join(PASTA, 'dados'), { recursive: true });
    const log = fs.openSync(path.join(PASTA, 'dados', 'motor.log'), 'a');
    spawn(process.execPath, [path.join(PASTA, 'servidor.js')], { cwd: PASTA, detached: true, windowsHide: true, stdio: ['ignore', log, log] }).unref();
    for (let i = 0; i < 30 && !(await motorLigado()); i++) await esperar(500);
  }
  // '--sem-janela': só liga o motor
  if (process.argv.includes('--sem-janela')) return setTimeout(() => process.exit(0), 300);
  const edge = EDGES.find(e => fs.existsSync(e));
  // perfil próprio da janela (assim as opções valem mesmo com o Edge normal aberto)
  const perfil = path.join(process.env.LOCALAPPDATA || PASTA, 'VigiaGlobal', 'janela-edge');
  // Placa de vídeo: a dedicada (NVIDIA). Medido em 08/11/2026: na RTX o globo custa ~2 W e 5% de CPU; na Intel ela ficava
  // 50% ocupada (e é a Intel que desenha a tela do Windows). Para usar a Intel: em dados/config.json, "gpuDedicada": false
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(PASTA, 'dados', 'config.json'), 'utf8')); } catch { }
  const gpu = cfg.gpuDedicada === false ? [] : ['--force_high_performance_gpu'];
  // Edge enxuto: sem extensões, sincronização, tradutor e serviços de fundo (menos memória)
  const enxuto = ['--disable-extensions', '--disable-sync', '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
    '--disable-features=Translate,MediaRouter,OptimizationHints,AutofillServerCommunication,msEdgeShopping,msEdgeSidebarV2'];
  if (edge) spawn(edge, [`--app=${URL_APP}`, '--start-maximized', `--user-data-dir=${perfil}`, ...gpu, ...enxuto, '--no-first-run', '--no-default-browser-check'], { detached: true, stdio: 'ignore' }).unref();
  else spawn('cmd', ['/c', 'start', '', URL_APP], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  setTimeout(() => process.exit(0), 300);
})();
