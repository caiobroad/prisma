# Gera o ícone do Prisma (prisma com feixe de luz) em todos os formatos e compila "Prisma.exe".
#   launcher\prisma.ico        -> instalador, Prisma.exe e executável empacotado
#   src\main\iconData.ts       -> PNG 256 px embutido (janela, barra de tarefas, bandeja)
Add-Type -AssemblyName System.Drawing
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$ico  = Join-Path $here 'prisma.ico'

function C([int]$r, [int]$g, [int]$b, [int]$a = 255) { [System.Drawing.Color]::FromArgb($a, $r, $g, $b) }
function P([double]$x, [double]$y, [double]$k) { New-Object System.Drawing.PointF ([single]($x * $k)), ([single]($y * $k)) }

function New-IconPng([int]$s) {
  $k = $s / 64.0
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)

  # Fundo: quadrado arredondado escuro, levemente mais claro no topo, com borda de vidro.
  $r = 15 * $k; $d = $r * 2; $x0 = 2 * $k; $w = 60 * $k
  $bg = New-Object System.Drawing.Drawing2D.GraphicsPath
  $bg.AddArc($x0, $x0, $d, $d, 180, 90)
  $bg.AddArc($x0 + $w - $d, $x0, $d, $d, 270, 90)
  $bg.AddArc($x0 + $w - $d, $x0 + $w - $d, $d, $d, 0, 90)
  $bg.AddArc($x0, $x0 + $w - $d, $d, $d, 90, 90)
  $bg.CloseFigure()
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (P 0 2 $k), (P 0 62 $k), (C 22 28 44), (C 8 10 17)
  $g.FillPath($bgBrush, $bg)
  $edge = New-Object System.Drawing.Pen (C 255 255 255 38), ([single][Math]::Max(1, 1.2 * $k))
  $g.DrawPath($edge, $bg)

  $lw = [single][Math]::Max(1.1, 2.6 * $k)
  $pen = { param($col) $p = New-Object System.Drawing.Pen $col, $lw; $p.StartCap = 'Round'; $p.EndCap = 'Round'; $p }

  # Feixe branco entrando.
  $g.DrawLine((& $pen (C 255 255 255)), (P 7 37 $k), (P 23 32 $k))

  # Prisma: duas faces com gradiente (luz vindo da esquerda).
  $left = [System.Drawing.PointF[]]@((P 31 14 $k), (P 17 46 $k), (P 31 46 $k))
  $right = [System.Drawing.PointF[]]@((P 31 14 $k), (P 31 46 $k), (P 45 46 $k))
  $gl = New-Object System.Drawing.Drawing2D.LinearGradientBrush (P 17 14 $k), (P 31 46 $k), (C 176 196 255), (C 92 122 240)
  $gr = New-Object System.Drawing.Drawing2D.LinearGradientBrush (P 31 14 $k), (P 45 46 $k), (C 150 240 248), (C 30 176 200)
  $g.FillPolygon($gl, $left)
  $g.FillPolygon($gr, $right)
  $rim = New-Object System.Drawing.Pen (C 255 255 255 110), ([single][Math]::Max(0.8, 1.1 * $k))
  $rim.LineJoin = 'Round'
  $g.DrawPolygon($rim, [System.Drawing.PointF[]]@((P 31 14 $k), (P 17 46 $k), (P 45 46 $k)))

  # Espectro saindo: ciano, azul, violeta.
  $g.DrawLine((& $pen (C 61 217 235)), (P 40 31 $k), (P 57 26 $k))
  $g.DrawLine((& $pen (C 124 156 255)), (P 41 34.5 $k), (P 57 34.5 $k))
  $g.DrawLine((& $pen (C 197 139 255)), (P 42 38 $k), (P 57 43 $k))

  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  if ($s -ge 256) {
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  } else {
    # Tamanhos pequenos em DIB 32 bits (BITMAPINFOHEADER + BGRA de baixo para cima + máscara AND):
    # é o formato que Explorer antigo, GDI+ e o NSIS leem sem erro.
    $bw2 = New-Object System.IO.BinaryWriter $ms
    $bw2.Write([uint32]40); $bw2.Write([int32]$s); $bw2.Write([int32]($s * 2))
    $bw2.Write([uint16]1); $bw2.Write([uint16]32); $bw2.Write([uint32]0)
    $maskRow = [int]([Math]::Ceiling($s / 32.0) * 4)
    $bw2.Write([uint32]($s * $s * 4 + $maskRow * $s))
    $bw2.Write([int32]0); $bw2.Write([int32]0); $bw2.Write([uint32]0); $bw2.Write([uint32]0)
    for ($y = $s - 1; $y -ge 0; $y--) {
      for ($x = 0; $x -lt $s; $x++) {
        $c = $bmp.GetPixel($x, $y)
        $bw2.Write([byte]$c.B); $bw2.Write([byte]$c.G); $bw2.Write([byte]$c.R); $bw2.Write([byte]$c.A)
      }
    }
    $bw2.Write((New-Object byte[] ($maskRow * $s)))
    $bw2.Flush()
  }
  $bmp.Dispose()
  return ,$ms.ToArray()
}

$sizes = 16, 24, 32, 48, 64, 128, 256
$pngs = foreach ($s in $sizes) { ,(New-IconPng $s) }

# .ico com todas as resoluções (PNG comprimido dentro).
$fs = [System.IO.File]::Create($ico)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]; $len = $pngs[$i].Length
  $bw.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))
  $bw.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))
  $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([uint16]1); $bw.Write([uint16]32)
  $bw.Write([uint32]$len); $bw.Write([uint32]$offset)
  $offset += $len
}
foreach ($p in $pngs) { $bw.Write($p) }
$bw.Close()

# PNG 256 embutido no processo principal (funciona igual em desenvolvimento e no app instalado).
$b64 = [Convert]::ToBase64String($pngs[$sizes.IndexOf(256)])
$ts = "// Gerado por launcher/build-launcher.ps1. Não editar à mão.`nexport const ICON_PNG_256 = 'data:image/png;base64,$b64'`n"
[IO.File]::WriteAllText((Join-Path $root 'src\main\iconData.ts'), $ts, (New-Object Text.UTF8Encoding $false))

$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$out = Join-Path $root 'Prisma.exe'
& $csc /nologo /target:winexe /optimize+ "/win32icon:$ico" "/out:$out" /r:System.Windows.Forms.dll (Join-Path $here 'Prisma.cs')
if ($LASTEXITCODE -eq 0) { "OK $out" } else { "FALHOU ($LASTEXITCODE)" }
