// Reinicia o motor do Vigia (depois de mudar servidor.js ou motor/*): para o node do servidor.js, liga de novo e confere.
// uso: node ferramentas/reiniciar-motor.js
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const PASTA = path.join(__dirname, '..');
const esperar = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*Vigia Global*servidor.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $_.ProcessId }`;
  const parados = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
  console.log(parados ? `> motor parado (processo ${parados.split(/\s+/).join(', ')})` : '> motor não estava ligado');
  await esperar(800);
  spawnSync(process.execPath, [path.join(PASTA, 'abrir.js'), '--sem-janela'], { stdio: 'inherit' });
  for (let i = 0; i < 20; i++) {
    try { const r = await fetch('http://127.0.0.1:8788/api/saude'); if (r.ok) { console.log('> motor ligado de novo: ' + JSON.stringify(await r.json()).slice(0, 90) + '…'); return; } } catch { }
    await esperar(500);
  }
  console.log('> o motor não respondeu: veja dados/motor.log');
  process.exitCode = 1;
})();
