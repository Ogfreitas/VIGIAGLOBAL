// Monta o dist/VigiaGlobal.exe: UM arquivo para levar o Vigia Global a outro computador com Windows 10/11, sem instalar nada.
// Dentro dele vão o Node deste PC (node.exe), o motor, a janela, a TV, os mapas dos estados e as cidades, num app.zip
// embutido no lançador (ferramentas/lancador.cs, compilado com o csc do .NET Framework 4 que já vem no Windows).
// Não vão: dados/ (token do Telegram, vigiados, histórico), versoes/, relevo/, .git. Cada montagem tem uma versão nova
// (data e hora): abrir um .exe mais novo no outro PC atualiza o programa e mantém os dados de lá.
// Uso: node ferramentas/gerar-exe.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..'), DIST = path.join(RAIZ, 'dist'), MONTA = path.join(DIST, '_montagem');
const WIN = process.env.WINDIR || 'C:\\Windows';
const CSC = path.join(WIN, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
const TAR = path.join(WIN, 'System32', 'tar.exe');           // o tar do Windows (bsdtar) faz .zip
const NET = path.dirname(CSC);
for (const f of [CSC, TAR]) if (!fs.existsSync(f)) { console.error('faltou ' + f); process.exit(1); }

fs.rmSync(MONTA, { recursive: true, force: true });
fs.mkdirSync(MONTA, { recursive: true });
const copiar = rel => { const de = path.join(RAIZ, rel), para = path.join(MONTA, rel); fs.mkdirSync(path.dirname(para), { recursive: true }); fs.copyFileSync(de, para); };
const ARQUIVOS = ['servidor.js', 'abrir.js', 'vigia-global.html', 'tv.html', 'cidades.js', 'icone.ico', 'icone.png', 'icone.svg', 'README.md',
  'ferramentas/reiniciar-motor.js', 'ferramentas/conferir-tv.js'];
ARQUIVOS.forEach(copiar);
for (const f of fs.readdirSync(path.join(RAIZ, 'motor'))) if (/\.(js|json|cs)$/.test(f)) copiar('motor/' + f);
for (const f of fs.readdirSync(path.join(RAIZ, 'estados'))) if (/^[A-Z]{2}\.json$/.test(f)) copiar('estados/' + f);
fs.copyFileSync(process.execPath, path.join(MONTA, 'node.exe'));
fs.writeFileSync(path.join(MONTA, 'NODE-LICENCA.txt'), `node.exe é o Node.js ${process.version} (licença MIT, https://nodejs.org), levado junto para o Vigia rodar sem instalar nada.\n`);
let commit = ''; try { commit = execFileSync('git', ['-C', RAIZ, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { }
const versao = new Date().toISOString().slice(0, 19).replace('T', ' ') + (commit ? ' ' + commit : '');
fs.writeFileSync(path.join(MONTA, 'versao.txt'), versao + '\n');

const zip = path.join(DIST, 'app.zip');
fs.rmSync(zip, { force: true });
execFileSync(TAR, ['-a', '-c', '-f', zip, '-C', MONTA, '.'], { stdio: 'inherit' });
console.log(`pacote: ${(fs.statSync(zip).size / 1048576).toFixed(1)} MB`);

const exe = path.join(DIST, 'VigiaGlobal.exe');
execFileSync(CSC, ['/nologo', '/optimize+', '/target:winexe', `/out:${exe}`, `/win32icon:${path.join(RAIZ, 'icone.ico')}`,
  `/resource:${zip},app.zip`, `/r:${path.join(NET, 'System.IO.Compression.dll')}`, `/r:${path.join(NET, 'System.IO.Compression.FileSystem.dll')}`,
  `/r:${path.join(NET, 'System.Windows.Forms.dll')}`, path.join(__dirname, 'lancador.cs')], { stdio: 'inherit' });
fs.rmSync(MONTA, { recursive: true, force: true }); fs.rmSync(zip, { force: true });
console.log(`pronto: ${exe} (${(fs.statSync(exe).size / 1048576).toFixed(1)} MB) · versão ${versao}`);
