// LANÇADOR do Vigia Global (o VigiaGlobal.exe): um arquivo só para levar o Vigia a outro computador.
// Compilado por ferramentas/gerar-exe.js com o csc do .NET Framework 4 que vem no Windows (C# 5: nada de $"" nem ?.).
// Dentro dele vai o app.zip (Node + motor + janela + mapas). Ao abrir:
//   1. instala/atualiza em %LOCALAPPDATA%\VigiaGlobal\app (só quando a versão embutida é outra; a pasta dados\ nunca é tocada)
//   2. guarda uma cópia de si mesmo em %LOCALAPPDATA%\VigiaGlobal\VigiaGlobal.exe (os atalhos apontam para ela)
//   3. na primeira vez cria os atalhos (Área de Trabalho e Menu Iniciar) e PERGUNTA se o motor liga com o Windows
//   4. roda "node abrir.js" (liga o motor escondido e abre a janela; com --sem-janela, só o motor)
// Outras opções: --desinstalar (pergunta antes) e --extrair-em <pasta> (só extrai; usado no teste).
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("Vigia Global")]
[assembly: AssemblyProduct("Vigia Global")]
[assembly: AssemblyDescription("Portal de notícias do mundo em forma de globo")]
[assembly: AssemblyVersion("1.0.0.0")]

static class Lancador {
  const string TITULO = "Vigia Global";
  static readonly string BASE = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "VigiaGlobal");
  static readonly string APP = Path.Combine(BASE, "app");

  [STAThread]
  static int Main(string[] args) {
    try {
      int i = Array.IndexOf(args, "--extrair-em");
      if (i >= 0 && i + 1 < args.Length) { Extrair(Path.GetFullPath(args[i + 1])); return 0; }
      if (Array.IndexOf(args, "--desinstalar") >= 0) return Desinstalar();
      bool semJanela = Array.IndexOf(args, "--sem-janela") >= 0;

      string nova = VersaoEmbutida(), atual = VersaoInstalada();
      bool primeira = atual == "";
      if (nova != atual) { PararMotor(); Extrair(APP); }

      string fixo = Path.Combine(BASE, "VigiaGlobal.exe"), eu = Assembly.GetExecutingAssembly().Location;
      if (!string.Equals(Path.GetFullPath(eu), Path.GetFullPath(fixo), StringComparison.OrdinalIgnoreCase)) {
        try { File.Copy(eu, fixo, true); } catch { }          // (se a cópia estiver aberta, fica a anterior)
      }
      if (primeira) {
        Atalho(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Vigia Global.lnk"), fixo, "", 1);
        Atalho(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Vigia Global.lnk"), fixo, "", 1);
        Atalho(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Desinstalar Vigia Global.lnk"), fixo, "--desinstalar", 1);
        DialogResult r = MessageBox.Show(
          "O Vigia Global foi instalado neste computador e já tem atalho na Área de Trabalho e no Menu Iniciar.\n\n" +
          "Quer que o motor do Vigia ligue junto com o Windows?\n" +
          "Assim os avisos (plantão e vigiados) chegam mesmo com a janela fechada.",
          TITULO, MessageBoxButtons.YesNo, MessageBoxIcon.Question);
        if (r == DialogResult.Yes)
          Atalho(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "Vigia Global (motor).lnk"), fixo, "--sem-janela", 7);
      }
      Abrir(semJanela);
      return 0;
    } catch (Exception e) {
      MessageBox.Show("Não consegui abrir o Vigia Global:\n\n" + e.Message, TITULO, MessageBoxButtons.OK, MessageBoxIcon.Error);
      return 1;
    }
  }

  static Stream Pacote() {
    Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("app.zip");
    if (s == null) throw new Exception("o pacote do Vigia não está dentro deste .exe");
    return s;
  }
  static string VersaoEmbutida() {
    using (Stream s = Pacote()) using (ZipArchive z = new ZipArchive(s, ZipArchiveMode.Read)) {
      ZipArchiveEntry e = z.GetEntry("versao.txt");
      if (e == null) return "?";
      using (StreamReader r = new StreamReader(e.Open())) return r.ReadToEnd().Trim();
    }
  }
  static string VersaoInstalada() {
    string f = Path.Combine(APP, "versao.txt");
    return File.Exists(f) && File.Exists(Path.Combine(APP, "node.exe")) ? File.ReadAllText(f).Trim() : "";
  }
  // extrai tudo por cima, menos a pasta dados\ (vigiados, configuração do Telegram, histórico): essa é do usuário
  static void Extrair(string destino) {
    Directory.CreateDirectory(destino);
    using (Stream s = Pacote()) using (ZipArchive z = new ZipArchive(s, ZipArchiveMode.Read)) {
      foreach (ZipArchiveEntry e in z.Entries) {
        string nome = e.FullName.Replace('/', Path.DirectorySeparatorChar);
        if (nome.StartsWith("dados" + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) continue;
        string alvo = Path.GetFullPath(Path.Combine(destino, nome));
        if (!alvo.StartsWith(Path.GetFullPath(destino), StringComparison.OrdinalIgnoreCase)) continue;   // (nada fora da pasta)
        if (e.Name == "") { Directory.CreateDirectory(alvo); continue; }
        Directory.CreateDirectory(Path.GetDirectoryName(alvo));
        e.ExtractToFile(alvo, true);
      }
    }
  }
  // o motor instalado segura o node.exe aberto: para trocar os arquivos, ele é parado (só o desta pasta)
  static void PararMotor() {
    string meu = Path.GetFullPath(Path.Combine(APP, "node.exe"));
    foreach (Process p in Process.GetProcessesByName("node")) {
      try {
        if (string.Equals(Path.GetFullPath(p.MainModule.FileName), meu, StringComparison.OrdinalIgnoreCase)) { p.Kill(); p.WaitForExit(4000); }
      } catch { }
    }
  }
  static void Abrir(bool semJanela) {
    ProcessStartInfo ps = new ProcessStartInfo();
    ps.FileName = Path.Combine(APP, "node.exe");
    ps.Arguments = "\"" + Path.Combine(APP, "abrir.js") + "\"" + (semJanela ? " --sem-janela" : "");
    ps.WorkingDirectory = APP;
    ps.UseShellExecute = false;
    ps.CreateNoWindow = true;
    Process.Start(ps);
  }
  // atalho .lnk pelo WScript.Shell (estilo 1 = janela normal, 7 = minimizada)
  static void Atalho(string lnk, string alvo, string argumentos, int estilo) {
    Type t = Type.GetTypeFromProgID("WScript.Shell");
    object sh = Activator.CreateInstance(t);
    object a = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, sh, new object[] { lnk });
    Type ta = a.GetType();
    ta.InvokeMember("TargetPath", BindingFlags.SetProperty, null, a, new object[] { alvo });
    ta.InvokeMember("Arguments", BindingFlags.SetProperty, null, a, new object[] { argumentos });
    ta.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, a, new object[] { BASE });
    ta.InvokeMember("IconLocation", BindingFlags.SetProperty, null, a, new object[] { alvo + ",0" });
    ta.InvokeMember("Description", BindingFlags.SetProperty, null, a, new object[] { "Vigia Global: notícias do mundo num globo" });
    ta.InvokeMember("WindowStyle", BindingFlags.SetProperty, null, a, new object[] { estilo });
    ta.InvokeMember("Save", BindingFlags.InvokeMethod, null, a, null);
  }
  static int Desinstalar() {
    DialogResult r = MessageBox.Show("Tirar o Vigia Global deste computador?\n\nSaem o programa e os atalhos. Seus vigiados e configurações (pasta dados) também são apagados.",
      TITULO, MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
    if (r != DialogResult.Yes) return 0;
    PararMotor();
    string[] lnks = {
      Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Vigia Global.lnk"),
      Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Vigia Global.lnk"),
      Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Desinstalar Vigia Global.lnk"),
      Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "Vigia Global (motor).lnk"),
    };
    foreach (string l in lnks) { try { if (File.Exists(l)) File.Delete(l); } catch { } }
    try { if (Directory.Exists(APP)) Directory.Delete(APP, true); } catch { }
    MessageBox.Show("Pronto. Para terminar, apague a pasta:\n" + BASE, TITULO, MessageBoxButtons.OK, MessageBoxIcon.Information);
    return 0;
  }
}
