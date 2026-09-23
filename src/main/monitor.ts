import os from 'os'
import { existsSync } from 'fs'
import { spawn, type ChildProcess } from 'child_process'
import type { PerfSample } from '@shared/types'
import { setSessionPerf } from './db/games'

/**
 * Monitor de desempenho com custo proporcional ao uso:
 * - desligado quando ninguém olha e nenhum jogo roda;
 * - 1 s enquanto o Performance Center está aberto;
 * - 5 s em segundo plano durante o jogo.
 * Fontes: os (CPU/RAM), nvidia-smi em modo contínuo (GPU/VRAM/temperatura),
 * WMI num único PowerShell persistente (temperatura ACPI e GPU de outros fabricantes)
 * e PresentMon, se configurado, para FPS.
 */
type Listener = (s: PerfSample) => void

interface GameTrack {
  sessionId: number
  pid: number | null
  n: number
  cpu: number
  gpu: number
  gpuN: number
  fps: number
  fpsN: number
  maxGpuTemp: number | null
}

const NVSMI = ['C:\\Windows\\System32\\nvidia-smi.exe', 'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe']

const WMI_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
while ($true) {
  $o = @{}
  if ($env:NX_GPU -eq '1') {
    $eng = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine | Where-Object { $_.Name -like '*engtype_3D' }
    $byAdapter = $eng | Group-Object { ($_.Name -replace '^pid_\\d+_', '') -replace '_phys.*$', '' }
    $max = 0
    foreach ($a in $byAdapter) { $s = ($a.Group | Measure-Object UtilizationPercentage -Sum).Sum; if ($s -gt $max) { $max = $s } }
    $o.gpu = [math]::Min(100, $max)
    $o.vram = (Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory | Measure-Object DedicatedUsage -Maximum).Maximum
  }
  $t = (Get-CimInstance Win32_PerfFormattedData_Counters_ThermalZoneInformation | Measure-Object HighPrecisionTemperature -Maximum).Maximum
  if ($t) { $o.temp = [math]::Round($t / 10 - 273.15, 1) }
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds ([int]$env:NX_MS)
}
`

class Monitor {
  private watchers = 0
  private game: GameTrack | null = null
  private timer: NodeJS.Timeout | null = null
  private interval = 0
  private prevCpu = os.cpus().map((c) => c.times)
  private last: PerfSample | null = null
  private listeners = new Set<Listener>()

  private nv: ChildProcess | null = null
  private nvPath: string | null | undefined = undefined
  private nvData: { gpu: number; temp: number; used: number; total: number; name: string } | null = null

  private wmi: ChildProcess | null = null
  private wmiData: { gpu?: number; vram?: number; temp?: number } = {}

  private pm: ChildProcess | null = null
  private pmFrames: number[] = []
  private presentMonPath = ''

  onSample(l: Listener): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  latest(): PerfSample | null {
    return this.last
  }

  setPresentMon(path: string): void {
    this.presentMonPath = path
  }

  watch(on: boolean): void {
    this.watchers = Math.max(0, this.watchers + (on ? 1 : -1))
    this.reconfigure()
  }

  gameStarted(sessionId: number, pid: number | null): void {
    this.game = { sessionId, pid, n: 0, cpu: 0, gpu: 0, gpuN: 0, fps: 0, fpsN: 0, maxGpuTemp: null }
    this.reconfigure()
    if (pid) this.startPresentMon(pid)
  }

  gamePid(sessionId: number, pid: number): void {
    if (this.game?.sessionId === sessionId && this.game.pid !== pid) {
      this.game.pid = pid
      this.startPresentMon(pid)
    }
  }

  gameEnded(sessionId: number): void {
    const g = this.game
    if (!g || g.sessionId !== sessionId) return
    if (g.n > 0) {
      setSessionPerf(sessionId, {
        avgCpu: round(g.cpu / g.n),
        avgGpu: g.gpuN ? round(g.gpu / g.gpuN) : null,
        avgFps: g.fpsN ? round(g.fps / g.fpsN) : null,
        maxGpuTemp: g.maxGpuTemp
      })
    }
    this.game = null
    this.stopPresentMon()
    this.reconfigure()
  }

  stopAll(): void {
    this.watchers = 0
    this.game = null
    this.reconfigure()
    this.stopPresentMon()
  }

  private reconfigure(): void {
    const want = this.watchers > 0 ? 1000 : this.game ? 5000 : 0
    if (want === this.interval) return
    this.interval = want
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.stopNv()
    this.stopWmi()
    if (!want) return
    this.prevCpu = os.cpus().map((c) => c.times)
    this.startNv(want)
    this.startWmi(Math.max(2000, want))
    this.timer = setInterval(() => this.tick(), want)
    this.timer.unref?.()
  }

  private tick(): void {
    const now = os.cpus().map((c) => c.times)
    let idle = 0
    let total = 0
    now.forEach((t, i) => {
      const p = this.prevCpu[i] ?? t
      const d = (t.user - p.user) + (t.nice - p.nice) + (t.sys - p.sys) + (t.irq - p.irq) + (t.idle - p.idle)
      idle += t.idle - p.idle
      total += d
    })
    this.prevCpu = now
    const cpu = total > 0 ? round(100 * (1 - idle / total)) : 0
    const nv = this.nvData
    const fps = this.currentFps()
    const s: PerfSample = {
      t: Date.now(),
      cpu,
      ramUsed: os.totalmem() - os.freemem(),
      ramTotal: os.totalmem(),
      gpu: nv ? nv.gpu : (this.wmiData.gpu ?? null),
      vramUsed: nv ? nv.used * 1024 * 1024 : this.wmiData.vram != null ? this.wmiData.vram : null,
      vramTotal: nv ? nv.total * 1024 * 1024 : null,
      cpuTemp: this.wmiData.temp ?? null,
      gpuTemp: nv ? nv.temp : null,
      fps,
      gpuName: nv?.name ?? null,
      gameRunning: !!this.game,
      sources: {
        gpu: nv ? 'nvidia' : this.wmiData.gpu != null ? 'wmi' : null,
        cpuTemp: this.wmiData.temp != null ? 'acpi' : null,
        fps: fps != null ? 'presentmon' : null
      }
    }
    this.last = s
    const g = this.game
    if (g) {
      g.n++
      g.cpu += s.cpu
      if (s.gpu != null) {
        g.gpu += s.gpu
        g.gpuN++
      }
      if (s.fps != null) {
        g.fps += s.fps
        g.fpsN++
      }
      if (s.gpuTemp != null) g.maxGpuTemp = Math.max(g.maxGpuTemp ?? 0, s.gpuTemp)
    }
    for (const l of this.listeners) l(s)
  }

  // ---------- NVIDIA ----------

  private findNv(): string | null {
    if (this.nvPath !== undefined) return this.nvPath
    this.nvPath = NVSMI.find((p) => existsSync(p)) ?? null
    return this.nvPath
  }

  private startNv(ms: number): void {
    const exe = this.findNv()
    if (!exe) return
    const p = spawn(
      exe,
      ['--query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total', '--format=csv,noheader,nounits', `--loop-ms=${ms}`],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }
    )
    this.nv = p
    let buf = ''
    p.stdout?.setEncoding('utf8')
    p.stdout?.on('data', (d: string) => {
      buf += d
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        const parts = line.split(',').map((x) => x.trim())
        if (parts.length >= 5) {
          const [name, gpu, temp, used, total] = parts
          const n = (v: string): number => (Number.isFinite(Number(v)) ? Number(v) : 0)
          this.nvData = { name, gpu: n(gpu), temp: n(temp), used: n(used), total: n(total) }
        }
      }
    })
    p.on('error', () => {
      this.nvPath = null
      this.nv = null
    })
    p.on('exit', () => {
      if (this.nv === p) this.nv = null
    })
  }

  private stopNv(): void {
    this.nv?.kill()
    this.nv = null
  }

  // ---------- WMI (temperatura ACPI; GPU quando não há NVIDIA) ----------

  private startWmi(ms: number): void {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', WMI_SCRIPT], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, NX_GPU: this.findNv() ? '0' : '1', NX_MS: String(ms) }
    })
    this.wmi = p
    let buf = ''
    p.stdout?.setEncoding('utf8')
    p.stdout?.on('data', (d: string) => {
      buf += d
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        try {
          const o = JSON.parse(line) as { gpu?: number; vram?: number; temp?: number }
          this.wmiData = o
        } catch {
          /* linha parcial */
        }
      }
    })
    p.on('error', () => (this.wmi = null))
    p.on('exit', () => {
      if (this.wmi === p) this.wmi = null
    })
  }

  private stopWmi(): void {
    this.wmi?.kill()
    this.wmi = null
  }

  // ---------- PresentMon (FPS, opcional) ----------

  private startPresentMon(pid: number): void {
    this.stopPresentMon()
    const exe = this.presentMonPath
    if (!exe || !existsSync(exe)) return
    const run = (args: string[], fallback?: () => void): void => {
      const t0 = Date.now()
      const p = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
      this.pm = p
      let buf = ''
      let col = -1
      p.stdout?.setEncoding('utf8')
      p.stdout?.on('data', (d: string) => {
        buf += d
        let i: number
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim()
          buf = buf.slice(i + 1)
          const cells = line.split(',')
          if (col < 0) {
            col = cells.findIndex((c) => /^(msBetweenPresents|MsBetweenPresents|FrameTime)$/.test(c.trim()))
            continue
          }
          const ms = Number(cells[col])
          if (ms > 0) this.pmFrames.push(Date.now(), ms)
          if (this.pmFrames.length > 4000) this.pmFrames.splice(0, this.pmFrames.length - 2000)
        }
      })
      p.on('exit', () => {
        if (this.pm === p) this.pm = null
        // Saiu logo de cara: provavelmente sintaxe da outra versão do PresentMon.
        if (fallback && Date.now() - t0 < 2500) fallback()
      })
      p.on('error', () => (this.pm = null))
    }
    const common = ['--process_id', String(pid), '--output_stdout', '--stop_existing_session', '--terminate_on_proc_exit', '--session_name', 'Prisma']
    run([...common, '--no_console_stats', '--v1_metrics'], () =>
      run(['-process_id', String(pid), '-output_stdout', '-stop_existing_session', '-terminate_on_proc_exit', '-no_top', '-session_name', 'Prisma'])
    )
  }

  private stopPresentMon(): void {
    this.pm?.kill()
    this.pm = null
    this.pmFrames = []
  }

  private currentFps(): number | null {
    if (!this.pm || this.pmFrames.length < 4) return null
    const cutoff = Date.now() - 1500
    let sum = 0
    let n = 0
    for (let i = this.pmFrames.length - 2; i >= 0; i -= 2) {
      if (this.pmFrames[i] < cutoff) break
      sum += this.pmFrames[i + 1]
      n++
    }
    return n ? round(1000 / (sum / n)) : null
  }
}

function round(v: number): number {
  return Math.round(v * 10) / 10
}

export const monitor = new Monitor()
