// Avisos do Vigia: notificação do Windows (clicar abre a notícia) e, se configurado, Telegram no celular.
// O Telegram fica em dados/config.json: { "telegram": { "token": "...", "chatId": "..." } } (o token nunca vai para a janela).
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_ID = 'VigiaGlobal';
const ICONE = path.join(__dirname, '..', 'icone.png');
const CONFIG = path.join(__dirname, '..', 'dados', 'config.json');

// registra o nome e o ícone do Vigia para as notificações do Windows (só na sua conta)
function registrarApp() {
  const chave = `HKCU\\Software\\Classes\\AppUserModelId\\${APP_ID}`;
  spawnSync('reg', ['add', chave, '/v', 'DisplayName', '/t', 'REG_SZ', '/d', 'Vigia Global', '/f'], { windowsHide: true });
  spawnSync('reg', ['add', chave, '/v', 'IconUri', '/t', 'REG_SZ', '/d', ICONE, '/f'], { windowsHide: true });
}

// o texto vai por variável de ambiente e é escapado lá dentro: manchete nenhuma vira comando
const SCRIPT_TOAST = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$t = [System.Security.SecurityElement]::Escape($env:VG_TITULO)
$m = [System.Security.SecurityElement]::Escape($env:VG_TEXTO)
$r = [System.Security.SecurityElement]::Escape($env:VG_RODAPE)
$l = [System.Security.SecurityElement]::Escape($env:VG_LINK)
$abre = if ($l) { " activationType='protocol' launch='$l'" } else { "" }
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml("<toast$abre><visual><binding template='ToastGeneric'><text>$t</text><text>$m</text><text placement='attribution'>$r</text></binding></visual></toast>")
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($env:VG_APPID).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
`;
function windows(titulo, texto, rodape = '', link = '') {
  const cod = Buffer.from(SCRIPT_TOAST, 'utf16le').toString('base64');
  const env = { ...process.env, VG_TITULO: titulo, VG_TEXTO: texto, VG_RODAPE: rodape, VG_LINK: /^https:\/\//.test(link) ? link : '', VG_APPID: APP_ID };
  const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', cod], { windowsHide: true, stdio: 'ignore', env });
  p.on('error', () => { });
}

function lerTelegram() {
  try { const t = JSON.parse(fs.readFileSync(CONFIG, 'utf8')).telegram || {}; return t.token && t.chatId ? t : null; } catch { return null; }
}
// html: true = a mensagem usa <b>, <i> e <a href> (o link fica escondido na manchete e não ocupa espaço)
async function telegram(texto, { html = false } = {}) {
  const t = lerTelegram();
  if (!t) return { ok: false, motivo: 'Telegram não configurado' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${t.token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ chat_id: t.chatId, text: html ? texto : texto.slice(0, 4000), disable_web_page_preview: true, ...(html ? { parse_mode: 'HTML' } : {}) }),
    });
    const j = await r.json();
    return j.ok ? { ok: true } : { ok: false, motivo: j.description };
  } catch (e) { return { ok: false, motivo: e.message }; }
}

const ROTULO = a => a.tipo === 'termo' ? `★ ${a.alvo.toUpperCase()}` : a.tipo === 'pico' ? `🔥 ${a.nome} ESQUENTOU`
  : a.tipo === 'plantao' ? `🚨 PLANTÃO · ${a.nome}` : `⚠ ${a.nome}`;
// achados: [{ tipo: 'termo'|'pais'|'pico', alvo, nome, titulo, fonte, link, quando }]
async function avisar(achados, canais) {
  if (!achados.length) return;
  if (canais.windows) {
    const primeiros = achados.length > 3 ? achados.slice(0, 2) : achados;
    for (const a of primeiros) windows(`Vigia Global · ${ROTULO(a)}`, a.titulo, a.fonte || '', a.link);
    if (achados.length > 3) windows('Vigia Global', `Mais ${achados.length - 2} alertas dos seus vigiados.`, 'abra o Vigia para ver todos');
  }
  if (canais.telegram) {
    const linhas = achados.slice(0, 10).map(a => `${ROTULO(a)}\n${a.titulo}${a.fonte ? ` (${a.fonte})` : ''}${a.link ? '\n' + a.link : ''}`);
    if (achados.length > 10) linhas.push(`… e mais ${achados.length - 10} no Vigia.`);
    await telegram(`🌐 Vigia Global\n\n${linhas.join('\n\n')}`);
  }
}

module.exports = { registrarApp, avisar, windows, telegram, telegramPronto: () => !!lerTelegram() };
