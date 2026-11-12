// Abre uma notícia no navegador Brave e traz a janela dele para a frente.
// O motor roda escondido, e o Windows não deixa programa escondido passar para a frente:
// sem o ajudante (trazer-brave.exe), a aba abria no Brave mas a janela ficava atrás.
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const PF = process.env.ProgramFiles || 'C:\\Program Files', PF86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
const CANDIDATOS = [
  path.join(PF, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  path.join(PF86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
].filter(Boolean);
const caminhoBrave = () => CANDIDATOS.find(c => fs.existsSync(c)) || null;

// o ajudante é compilado na primeira vez com o compilador C# que já vem no Windows
const FONTE = path.join(__dirname, 'trazer-brave.cs'), EXE = path.join(__dirname, 'trazer-brave.exe');
const CSC = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
let compilando = null;
function ajudante() {
  try { if (fs.statSync(EXE).mtimeMs >= fs.statSync(FONTE).mtimeMs) return Promise.resolve(EXE); } catch { }
  if (!fs.existsSync(CSC) || !fs.existsSync(FONTE)) return Promise.resolve(null);
  return compilando || (compilando = new Promise(ok => execFile(CSC, ['/nologo', '/optimize+', '/target:winexe', '/r:System.Management.dll', `/out:${EXE}`, FONTE],
    { windowsHide: true, timeout: 60000 }, err => { compilando = null; ok(err ? null : EXE); })));
}

// o ajudante anota o que fez aqui (para entender se um dia a janela não vier para a frente)
const LOG = path.join(__dirname, '..', 'dados', 'trazer-brave.log');
try { if (fs.statSync(LOG).size > 200e3) fs.writeFileSync(LOG, fs.readFileSync(LOG, 'utf8').slice(-50e3)); } catch { }

let ultimo = { link: '', em: 0 };
// true = mandou abrir no Brave; false = Brave não está instalado
async function abrirNoBrave(link) {
  const brave = caminhoBrave();
  if (!brave) return false;
  if (link === ultimo.link && Date.now() - ultimo.em < 1500) return true;   // clique duplo não abre duas abas
  ultimo = { link, em: Date.now() };
  // VIGIA_BRAVE_TESTE = pasta de um perfil separado (só nos testes, para não mexer no Brave de verdade)
  const teste = process.env.VIGIA_BRAVE_TESTE ? [`--user-data-dir=${process.env.VIGIA_BRAVE_TESTE}`, '--no-first-run', '--no-default-browser-check'] : [];
  spawn(brave, [...teste, link], { detached: true, stdio: 'ignore' }).unref();
  const exe = await ajudante();
  if (exe) spawn(exe, [LOG, process.env.VIGIA_BRAVE_TESTE || ''], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  return true;
}

module.exports = { abrirNoBrave, caminhoBrave, ajudante };
