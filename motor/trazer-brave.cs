// trazer-brave.exe [arquivo-de-log] [perfil-de-teste]
// Espera a janela do Brave aparecer (até 12 s) e traz ela para a frente.
// O motor roda escondido e o Windows não deixa um programa em segundo plano trocar a janela da frente;
// por isso o link abria no Brave mas a janela ficava atrás. Aqui a gente "se junta" à janela da frente e passa a vez pro Brave.
// Compilado pelo motor com o csc.exe que já vem no Windows (.NET Framework 4).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

static class TrazerBrave {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("user32.dll")] static extern void SwitchToThisWindow(IntPtr h, bool altTab);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int t);

  static string arqLog, perfil;
  static readonly Stopwatch relogio = Stopwatch.StartNew();
  static void Log(string s) {
    if (arqLog == null) return;
    try { File.AppendAllText(arqLog, DateTime.Now.ToString("HH:mm:ss.fff") + " +" + relogio.ElapsedMilliseconds + "ms " + s + Environment.NewLine); } catch { }
  }
  static string Desc(IntPtr h) {
    if (h == IntPtr.Zero) return "(nenhuma)";
    uint pid; GetWindowThreadProcessId(h, out pid); var s = new StringBuilder(120); GetWindowText(h, s, 120);
    string nome = "?"; try { nome = Process.GetProcessById((int)pid).ProcessName; } catch { }
    return h + " " + nome + " '" + s + "'";
  }

  // processos do Brave (no teste, só os do perfil de teste)
  static HashSet<uint> PidsDoBrave() {
    var pids = new HashSet<uint>();
    if (perfil == null) { foreach (var p in Process.GetProcessesByName("brave")) pids.Add((uint)p.Id); return pids; }
    using (var q = new ManagementObjectSearcher("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='brave.exe'"))
      foreach (ManagementObject o in q.Get()) {
        var cl = o["CommandLine"] as string;
        if (cl != null && cl.IndexOf(perfil, StringComparison.OrdinalIgnoreCase) >= 0) pids.Add((uint)o["ProcessId"]);
      }
    return pids;
  }

  // a janela do Brave mais de cima (é nela que o Brave abre a aba nova)
  static IntPtr JanelaDoBrave() {
    var pids = PidsDoBrave();
    if (pids.Count == 0) return IntPtr.Zero;
    IntPtr achou = IntPtr.Zero;
    EnumWindows((h, l) => {                       // vem na ordem da tela: a de cima primeiro
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (!pids.Contains(pid) || !IsWindowVisible(h) || GetWindowTextLength(h) == 0) return true;
      var cls = new StringBuilder(64); GetClassName(h, cls, 64);
      if (cls.ToString() != "Chrome_WidgetWin_1") return true;
      int ex = GetWindowLong(h, -20);             // pula "picture-in-picture" (sempre no topo) e janelinhas de ferramenta
      if ((ex & 0x8) != 0 || (ex & 0x80) != 0) return true;
      int oculta; if (DwmGetWindowAttribute(h, 14, out oculta, 4) == 0 && oculta != 0) return true;   // em outra área de trabalho
      achou = h; return false;
    }, IntPtr.Zero);
    return achou;
  }

  // tentativa 0-1: junta com a janela da frente; 2: SwitchToThisWindow (o mesmo do Alt+Tab); 3+: toque no Alt
  static bool NaFrente(IntPtr alvo, int tentativa) {
    IntPtr fg = GetForegroundWindow();
    if (fg == alvo) return true;
    if (IsIconic(alvo)) ShowWindow(alvo, 9);    // minimizada -> volta ao tamanho de antes
    if (tentativa < 2) {
      uint p; uint dela = GetWindowThreadProcessId(fg, out p), minha = GetCurrentThreadId();
      bool junto = dela != 0 && dela != minha && AttachThreadInput(minha, dela, true);
      BringWindowToTop(alvo); bool ok = SetForegroundWindow(alvo);
      if (junto) AttachThreadInput(minha, dela, false);
      Log("tentativa " + tentativa + ": junto=" + junto + " SetForeground=" + ok);
    } else if (tentativa == 2) {
      SwitchToThisWindow(alvo, true); Log("tentativa 2: SwitchToThisWindow");
    } else {
      keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero);   // Alt aperta e solta
      bool ok = SetForegroundWindow(alvo); Log("tentativa " + tentativa + ": Alt + SetForeground=" + ok);
    }
    Thread.Sleep(60);
    return GetForegroundWindow() == alvo;
  }

  static int Main(string[] args) {
    if (args.Length > 0 && args[0].Length > 0) arqLog = args[0];
    if (args.Length > 1 && args[1].Length > 0) perfil = args[1];
    IntPtr antes = JanelaDoBrave();                 // Brave já aberto: a aba nova cai nessa janela
    Log("inicio: frente=" + Desc(GetForegroundWindow()) + " brave=" + Desc(antes) + (perfil != null ? " (teste)" : ""));
    if (antes != IntPtr.Zero) Thread.Sleep(250);
    while (relogio.ElapsedMilliseconds < 12000) {
      IntPtr h = JanelaDoBrave();
      if (h != IntPtr.Zero) {
        if (antes == IntPtr.Zero) Thread.Sleep(400);  // Brave acabou de abrir: deixa a janela terminar de montar
        for (int i = 0; i < 5; i++) {
          if (NaFrente(h, i)) { Log("ok: " + Desc(h)); return 0; }
          Thread.Sleep(120);
        }
        Log("falhou: frente=" + Desc(GetForegroundWindow()) + " alvo=" + Desc(h));
        return 2;
      }
      Thread.Sleep(150);
    }
    Log("Brave não apareceu em 12 s");
    return 1;
  }
}
