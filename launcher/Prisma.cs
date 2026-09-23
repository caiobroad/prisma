// Atalho executável do Prisma: abre o Electron apontando para a pasta do projeto,
// sem janela de terminal. Se o build ainda não existir, compila antes (em segundo plano).
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Prisma")]
[assembly: System.Reflection.AssemblyProduct("Prisma")]
[assembly: System.Reflection.AssemblyVersion("0.1.0.0")]

static class Prisma
{
    [STAThread]
    static int Main()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
        string electron = Path.Combine(dir, @"node_modules\electron\dist\electron.exe");
        string entry = Path.Combine(dir, @"out\main\index.js");

        if (!File.Exists(electron))
        {
            MessageBox.Show(
                "Não encontrei o Electron em:\n" + electron + "\n\nRode \"npm install\" na pasta do projeto.",
                "Prisma", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }

        if (!File.Exists(entry))
        {
            string path = Environment.GetEnvironmentVariable("PATH") ?? "";
            var build = new ProcessStartInfo("cmd.exe", "/c npm run build")
            {
                WorkingDirectory = dir,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            build.EnvironmentVariables["PATH"] = @"C:\Claude\tools\node;" + path;
            try
            {
                using (var p = Process.Start(build)) { p.WaitForExit(); }
            }
            catch (Exception e)
            {
                MessageBox.Show("Falha ao compilar o app:\n" + e.Message, "Prisma",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
            if (!File.Exists(entry))
            {
                MessageBox.Show("O build não gerou " + entry + ".\nAbra dev.cmd para ver o erro.", "Prisma",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }

        var psi = new ProcessStartInfo(electron, "\"" + dir + "\"")
        {
            WorkingDirectory = dir,
            UseShellExecute = false
        };
        Process.Start(psi);
        return 0;
    }
}
