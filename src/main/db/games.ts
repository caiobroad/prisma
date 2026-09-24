import type { Achievement, Game, Platform, ProfileStats, Session, SourceStatus } from '@shared/types'
import { getDb, transaction } from './index'
import type { DetectedGame } from '../scanners/types'

interface GameRow {
  id: number
  title: string
  platform: Platform
  platform_id: string
  install_dir: string | null
  exe_path: string | null
  launch_uri: string | null
  cover_url: string | null
  banner_url: string | null
  logo_url: string | null
  icon_url: string | null
  icon_data: string | null
  developer: string | null
  publisher: string | null
  release_date: number | null
  genres: string | null
  description: string | null
  favorite: number
  installed: number
  added_at: number
  last_played: number | null
  playtime_sec: number
  platform_playtime_sec: number
  platform_last_played: number | null
  zone_color: string | null
  details_fetched: number
  install_size: number | null
  trailer_url: string | null
  steam_ref: string | null
  tags: string | null
  franchise: string | null
  review_pct: number | null
  review_label: string | null
  review_count: number | null
  metacritic: number | null
  min_requirements: string | null
  min_ram_gb: number | null
  completed: number
}

const num = (v: number | null | undefined): number | null => (v == null ? null : Number(v))

function parseList(v: string | null): string[] {
  if (!v) return []
  try {
    const a = JSON.parse(v) as unknown
    return Array.isArray(a) ? (a as string[]) : []
  } catch {
    return []
  }
}

function toGame(r: GameRow, ach?: { u: number; t: number }): Game {
  const genres = parseList(r.genres)
  return {
    id: Number(r.id),
    title: r.title,
    platform: r.platform,
    platformId: r.platform_id,
    installDir: r.install_dir,
    exePath: r.exe_path,
    launchUri: r.launch_uri,
    coverUrl: r.cover_url,
    bannerUrl: r.banner_url,
    logoUrl: r.logo_url,
    iconUrl: r.icon_url,
    iconData: r.icon_data,
    developer: r.developer,
    publisher: r.publisher,
    releaseDate: num(r.release_date),
    genres,
    description: r.description,
    installSize: num(r.install_size),
    favorite: Number(r.favorite) === 1,
    installed: Number(r.installed) === 1,
    addedAt: Number(r.added_at),
    lastPlayed: num(r.last_played),
    playtimeSeconds: Number(r.playtime_sec),
    platformPlaytimeSeconds: Number(r.platform_playtime_sec ?? 0),
    platformLastPlayed: num(r.platform_last_played),
    zoneColor: r.zone_color,
    trailerUrl: r.trailer_url,
    achievementsUnlocked: ach?.u ?? 0,
    achievementsTotal: ach?.t ?? 0,
    tags: parseList(r.tags),
    franchise: r.franchise,
    reviewPct: num(r.review_pct),
    reviewLabel: r.review_label,
    reviewCount: num(r.review_count),
    metacritic: num(r.metacritic),
    minRequirements: r.min_requirements,
    minRamGb: num(r.min_ram_gb),
    // Concluído: marcado pelo usuário, ou todas as conquistas desbloqueadas.
    completed: Number(r.completed) === 1 || (!!ach && ach.t > 0 && ach.u >= ach.t)
  }
}

function achievementCounts(): Map<number, { u: number; t: number }> {
  const rows = getDb()
    .prepare('SELECT game_id AS g, COUNT(*) AS t, SUM(unlocked_at IS NOT NULL) AS u FROM achievements GROUP BY game_id')
    .all() as unknown as Array<{ g: number; t: number; u: number }>
  return new Map(rows.map((r) => [Number(r.g), { u: Number(r.u), t: Number(r.t) }]))
}

/** Jogos sintéticos para teste de carga (NEXUS_FAKE_GAMES=1200). Nunca vão para o banco. */
function fakeGames(base: Game[]): Game[] {
  const n = Number(process.env.NEXUS_FAKE_GAMES ?? 0)
  if (!n || !base.length) return []
  const out: Game[] = []
  for (let i = 0; i < n; i++) {
    const b = base[i % base.length]
    out.push({ ...b, id: 1_000_000 + i, title: `${b.title} ${i + 1}`, favorite: false, playtimeSeconds: 0, lastPlayed: null })
  }
  return out
}

export function listGames(): Game[] {
  const counts = achievementCounts()
  const rows = getDb().prepare('SELECT * FROM games ORDER BY title COLLATE NOCASE').all() as unknown as GameRow[]
  const games = rows.map((r) => toGame(r, counts.get(Number(r.id))))
  return games.concat(fakeGames(games))
}

export function getGame(id: number): Game | null {
  const r = getDb().prepare('SELECT * FROM games WHERE id = ?').get(id) as unknown as GameRow | undefined
  if (!r) return null
  const c = getDb()
    .prepare('SELECT COUNT(*) AS t, SUM(unlocked_at IS NOT NULL) AS u FROM achievements WHERE game_id = ?')
    .get(id) as { t: number; u: number }
  return toGame(r, { u: Number(c.u ?? 0), t: Number(c.t ?? 0) })
}

export function detailsState(id: number): { fetched: boolean; steamRef: string | null } {
  const r = getDb().prepare('SELECT details_fetched, steam_ref FROM games WHERE id = ?').get(id) as
    | { details_fetched: number; steam_ref: string | null }
    | undefined
  return { fetched: !!r && Number(r.details_fetched) === 1, steamRef: r?.steam_ref ?? null }
}

export function saveDetails(
  id: number,
  d: {
    description?: string | null
    genres?: string[]
    developer?: string | null
    publisher?: string | null
    releaseDate?: number | null
    trailerUrl?: string | null
    steamRef?: string | null
    minRequirements?: string | null
    minRamGb?: number | null
    metacritic?: number | null
  }
): void {
  getDb()
    .prepare(
      `UPDATE games SET
         description = COALESCE(description, ?),
         genres = CASE WHEN ? IS NOT NULL AND (genres IS NULL OR genres = '[]') THEN ? ELSE genres END,
         developer = COALESCE(developer, ?),
         publisher = COALESCE(publisher, ?),
         release_date = COALESCE(release_date, ?),
         trailer_url = COALESCE(?, trailer_url),
         steam_ref = COALESCE(?, steam_ref),
         min_requirements = COALESCE(?, min_requirements),
         min_ram_gb = COALESCE(?, min_ram_gb),
         metacritic = COALESCE(?, metacritic),
         details_fetched = 1
       WHERE id = ?`
    )
    .run(
      d.description ?? null,
      d.genres?.length ? 1 : null,
      d.genres?.length ? JSON.stringify(d.genres) : null,
      d.developer ?? null,
      d.publisher ?? null,
      d.releaseDate ?? null,
      d.trailerUrl ?? null,
      d.steamRef ?? null,
      d.minRequirements ?? null,
      d.minRamGb ?? null,
      d.metacritic ?? null,
      id
    )
}

export function setInstallSize(id: number, bytes: number): void {
  getDb().prepare('UPDATE games SET install_size = ? WHERE id = ?').run(bytes, id)
}

export function setZoneColor(id: number, color: string): void {
  getDb().prepare('UPDATE games SET zone_color = ? WHERE id = ?').run(color, id)
}

export function toggleFavorite(id: number): Game {
  getDb().prepare('UPDATE games SET favorite = CASE favorite WHEN 1 THEN 0 ELSE 1 END WHERE id = ?').run(id)
  return getGame(id)!
}

export function removeGame(id: number): void {
  getDb().prepare('DELETE FROM games WHERE id = ?').run(id)
}

export function addManualGame(title: string, exePath: string, iconData: string | null): Game {
  const dir = exePath.replace(/[\\/][^\\/]+$/, '')
  const key = exePath.toLowerCase()
  getDb()
    .prepare(
      `INSERT INTO games (title, platform, platform_id, install_dir, exe_path, launch_uri, cover_url, icon_data, installed, added_at)
       VALUES (?, 'manual', ?, ?, ?, NULL, NULL, ?, 1, ?)
       ON CONFLICT(platform, platform_id) DO UPDATE SET title = excluded.title, icon_data = COALESCE(excluded.icon_data, games.icon_data)`
    )
    .run(title, key, dir, exePath, iconData, Date.now())
  const r = getDb().prepare("SELECT id FROM games WHERE platform = 'manual' AND platform_id = ?").get(key) as { id: number }
  return getGame(Number(r.id))!
}

/**
 * Funde o resultado de uma varredura com o banco. Jogos que sumiram da fonte saem,
 * a não ser que tenham tempo no Prisma ou sejam favoritos (ficam como não instalados).
 */
export function mergeScan(platform: Platform, detected: DetectedGame[]): { added: number; updated: number; removed: number } {
  const db = getDb()
  const upsert = db.prepare(
    `INSERT INTO games (title, platform, platform_id, install_dir, exe_path, launch_uri, cover_url, banner_url, logo_url, icon_url,
                        developer, publisher, release_date, genres, description, platform_playtime_sec, platform_last_played,
                        install_size, franchise, installed, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(platform, platform_id) DO UPDATE SET
       title = excluded.title,
       install_dir = excluded.install_dir,
       exe_path = COALESCE(excluded.exe_path, games.exe_path),
       launch_uri = COALESCE(excluded.launch_uri, games.launch_uri),
       cover_url = COALESCE(excluded.cover_url, games.cover_url),
       banner_url = COALESCE(excluded.banner_url, games.banner_url),
       logo_url = COALESCE(excluded.logo_url, games.logo_url),
       icon_url = COALESCE(excluded.icon_url, games.icon_url),
       developer = COALESCE(excluded.developer, games.developer),
       publisher = COALESCE(excluded.publisher, games.publisher),
       release_date = COALESCE(excluded.release_date, games.release_date),
       genres = CASE WHEN excluded.genres IS NOT NULL AND excluded.genres <> '[]' THEN excluded.genres ELSE games.genres END,
       description = COALESCE(games.description, excluded.description),
       platform_playtime_sec = MAX(excluded.platform_playtime_sec, games.platform_playtime_sec),
       platform_last_played = COALESCE(excluded.platform_last_played, games.platform_last_played),
       install_size = CASE WHEN excluded.installed = 0 THEN NULL ELSE COALESCE(excluded.install_size, games.install_size) END,
       franchise = COALESCE(excluded.franchise, games.franchise),
       zone_color = CASE WHEN excluded.banner_url IS NOT games.banner_url THEN NULL ELSE games.zone_color END,
       installed = excluded.installed`
  )
  const existing = db.prepare('SELECT id, platform_id, installed FROM games WHERE platform = ?').all(platform) as unknown as Array<{
    id: number
    platform_id: string
    installed: number
  }>
  const before = new Set(existing.map((e) => e.platform_id))
  let added = 0
  let updated = 0
  let removed = 0
  const seen = new Set<string>()
  transaction(() => {
    for (const g of detected) {
      if (seen.has(g.platformId)) continue
      seen.add(g.platformId)
      if (before.has(g.platformId)) updated++
      else added++
      upsert.run(
        g.title,
        g.platform,
        g.platformId,
        g.installDir,
        g.exePath,
        g.launchUri,
        g.coverUrl,
        g.bannerUrl ?? null,
        g.logoUrl ?? null,
        g.iconUrl ?? null,
        g.developer ?? null,
        g.publisher ?? null,
        g.releaseDate ?? null,
        g.genres?.length ? JSON.stringify(g.genres) : null,
        g.description ?? null,
        g.platformPlaytimeSeconds ?? 0,
        g.platformLastPlayed ?? null,
        g.installSize ?? null,
        g.franchise ?? null,
        g.installed ? 1 : 0,
        Date.now()
      )
    }
    const markGone = db.prepare('UPDATE games SET installed = 0 WHERE id = ?')
    const dropGone = db.prepare('DELETE FROM games WHERE id = ? AND playtime_sec = 0 AND favorite = 0')
    for (const e of existing) {
      if (seen.has(e.platform_id)) continue
      const dropped = Number(dropGone.run(e.id).changes) > 0
      if (!dropped && Number(e.installed) === 1) markGone.run(e.id)
      if (dropped || Number(e.installed) === 1) removed++
    }
  })
  return { added, updated, removed }
}

/** Remove itens que a loja identifica como aplicativo ou ferramenta, junto com suas sessões. */
export function removeNotGames(platform: Platform, ids: string[]): number {
  if (!ids.length) return 0
  const del = getDb().prepare('DELETE FROM games WHERE platform = ? AND platform_id = ?')
  let n = 0
  transaction(() => {
    for (const id of ids) n += Number(del.run(platform, id).changes)
  })
  return n
}

export function updateSource(s: Omit<SourceStatus, 'installed'>): void {
  getDb()
    .prepare(
      `INSERT INTO sources (platform, last_scan, count, detail, ok) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(platform) DO UPDATE SET last_scan = excluded.last_scan, count = excluded.count, detail = excluded.detail, ok = excluded.ok`
    )
    .run(s.platform, s.lastScan, s.count, s.detail, s.ok ? 1 : 0)
}

export function listSources(): SourceStatus[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM sources').all() as unknown as Array<{
    platform: Platform
    last_scan: number | null
    count: number
    detail: string
    ok: number
  }>
  const counts = db
    .prepare('SELECT platform, COUNT(*) AS n, SUM(installed) AS i FROM games GROUP BY platform')
    .all() as unknown as Array<{ platform: Platform; n: number; i: number }>
  const countMap = new Map(counts.map((c) => [c.platform, c]))
  const order: Platform[] = ['steam', 'epic', 'gog', 'xbox', 'manual']
  return order.map((p) => {
    const r = rows.find((x) => x.platform === p)
    const c = countMap.get(p)
    return {
      platform: p,
      count: Number(c?.n ?? 0),
      installed: Number(c?.i ?? 0),
      lastScan: num(r?.last_scan),
      detail: r?.detail ?? (p === 'manual' ? 'adicionados por você' : 'ainda não verificado'),
      ok: r ? Number(r.ok) === 1 : true
    }
  })
}

// ---------- conquistas ----------

export function steamGamesForAchievements(onlyIds?: number[]): Array<{ id: number; platformId: string }> {
  const rows = getDb().prepare("SELECT id, platform_id FROM games WHERE platform = 'steam'").all() as unknown as Array<{
    id: number
    platform_id: string
  }>
  const filter = onlyIds ? new Set(onlyIds) : null
  return rows.filter((r) => !filter || filter.has(Number(r.id))).map((r) => ({ id: Number(r.id), platformId: r.platform_id }))
}

export function replaceAchievements(
  gameId: number,
  list: Array<{ apiName: string; name: string; description: string | null; icon: string | null; unlockedAt: number | null }>
): void {
  const db = getDb()
  const up = db.prepare(
    `INSERT INTO achievements (game_id, api_name, name, description, icon, unlocked_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_id, api_name) DO UPDATE SET name = excluded.name, description = excluded.description,
       icon = excluded.icon, unlocked_at = COALESCE(achievements.unlocked_at, excluded.unlocked_at)`
  )
  transaction(() => {
    for (const a of list) up.run(gameId, a.apiName, a.name, a.description, a.icon, a.unlockedAt)
  })
}

interface AchRow {
  game_id: number
  api_name: string
  name: string
  description: string | null
  icon: string | null
  unlocked_at: number | null
}

const toAch = (r: AchRow): Achievement => ({
  gameId: Number(r.game_id),
  apiName: r.api_name,
  name: r.name,
  description: r.description,
  icon: r.icon,
  unlockedAt: num(r.unlocked_at)
})

export function listAchievements(gameId: number): Achievement[] {
  const rows = getDb()
    .prepare('SELECT * FROM achievements WHERE game_id = ? ORDER BY unlocked_at IS NULL, unlocked_at DESC, name')
    .all(gameId) as unknown as AchRow[]
  return rows.map(toAch)
}

export function unlockedAchievements(): Achievement[] {
  const rows = getDb()
    .prepare('SELECT * FROM achievements WHERE unlocked_at IS NOT NULL ORDER BY unlocked_at DESC')
    .all() as unknown as AchRow[]
  return rows.map(toAch)
}

// ---------- sessões (por perfil) ----------

export function startSession(gameId: number, profileId: number | null): number {
  const db = getDb()
  const now = Date.now()
  const info = db.prepare('INSERT INTO sessions (game_id, profile_id, started_at) VALUES (?, ?, ?)').run(gameId, profileId, now)
  db.prepare('UPDATE games SET last_played = ? WHERE id = ?').run(now, gameId)
  return Number(info.lastInsertRowid)
}

export function endSession(sessionId: number): { gameId: number; durationSeconds: number; startedAt: number } | null {
  const db = getDb()
  const s = db.prepare('SELECT game_id, started_at, ended_at FROM sessions WHERE id = ?').get(sessionId) as
    | { game_id: number; started_at: number; ended_at: number | null }
    | undefined
  if (!s || s.ended_at != null) return null
  const now = Date.now()
  const duration = Math.max(0, Math.round((now - Number(s.started_at)) / 1000))
  transaction(() => {
    db.prepare('UPDATE sessions SET ended_at = ?, duration_sec = ? WHERE id = ?').run(now, duration, sessionId)
    db.prepare('UPDATE games SET playtime_sec = playtime_sec + ?, last_played = ? WHERE id = ?').run(duration, now, s.game_id)
  })
  return { gameId: Number(s.game_id), durationSeconds: duration, startedAt: Number(s.started_at) }
}

export function setSessionPerf(
  sessionId: number,
  p: { avgFps: number | null; avgCpu: number | null; avgGpu: number | null; maxGpuTemp: number | null; maxCpuTemp: number | null }
): void {
  getDb()
    .prepare('UPDATE sessions SET avg_fps = ?, avg_cpu = ?, avg_gpu = ?, max_gpu_temp = ?, max_cpu_temp = ? WHERE id = ?')
    .run(p.avgFps, p.avgCpu, p.avgGpu, p.maxGpuTemp, p.maxCpuTemp, sessionId)
}

export function setSessionScreenshot(sessionId: number, url: string): void {
  getDb().prepare('UPDATE sessions SET screenshot = ? WHERE id = ?').run(url, sessionId)
}

interface SessionRow {
  id: number
  game_id: number
  profile_id: number | null
  started_at: number
  ended_at: number | null
  duration_sec: number
  avg_fps: number | null
  avg_cpu: number | null
  avg_gpu: number | null
  max_gpu_temp: number | null
  max_cpu_temp: number | null
  screenshot: string | null
}

function toSession(r: SessionRow): Session {
  return {
    id: Number(r.id),
    gameId: Number(r.game_id),
    profileId: num(r.profile_id),
    startedAt: Number(r.started_at),
    endedAt: num(r.ended_at),
    durationSeconds: Number(r.duration_sec),
    avgFps: num(r.avg_fps),
    avgCpu: num(r.avg_cpu),
    avgGpu: num(r.avg_gpu),
    maxGpuTemp: num(r.max_gpu_temp),
    maxCpuTemp: num(r.max_cpu_temp),
    screenshot: r.screenshot
  }
}

export function listSessions(gameId: number, limit: number, profileId: number | null): Session[] {
  const rows = getDb()
    .prepare('SELECT * FROM sessions WHERE game_id = ? AND (? IS NULL OR profile_id = ?) ORDER BY started_at DESC LIMIT ?')
    .all(gameId, profileId, profileId, limit) as unknown as SessionRow[]
  return rows.map(toSession)
}

export function allSessions(profileId: number | null): Session[] {
  const rows = getDb()
    .prepare('SELECT * FROM sessions WHERE (? IS NULL OR profile_id = ?) ORDER BY started_at DESC LIMIT 5000')
    .all(profileId, profileId) as unknown as SessionRow[]
  return rows.map(toSession)
}

export function recentSessions(limit: number, profileId: number | null): Array<Session & { title: string }> {
  const rows = getDb()
    .prepare(
      `SELECT s.*, g.title FROM sessions s JOIN games g ON g.id = s.game_id
       WHERE (? IS NULL OR s.profile_id = ?) ORDER BY s.started_at DESC LIMIT ?`
    )
    .all(profileId, profileId, limit) as unknown as Array<SessionRow & { title: string }>
  return rows.map((r) => ({ ...toSession(r), title: r.title }))
}

/** Última sessão encerrada do jogo, com as conquistas desbloqueadas durante ela. */
export function lastResume(gameId: number, profileId: number | null): { session: Session; achievements: Achievement[] } | null {
  const r = getDb()
    .prepare(
      `SELECT * FROM sessions WHERE game_id = ? AND ended_at IS NOT NULL AND duration_sec >= 30
       AND (? IS NULL OR profile_id = ?) ORDER BY started_at DESC LIMIT 1`
    )
    .get(gameId, profileId, profileId) as unknown as SessionRow | undefined
  if (!r) return null
  const s = toSession(r)
  const ach = getDb()
    .prepare('SELECT * FROM achievements WHERE game_id = ? AND unlocked_at BETWEEN ? AND ? ORDER BY unlocked_at')
    .all(gameId, s.startedAt - 60_000, (s.endedAt ?? Date.now()) + 5 * 60_000) as unknown as AchRow[]
  return { session: s, achievements: ach.map(toAch) }
}

export function closeDanglingSessions(): void {
  const open = getDb().prepare('SELECT id FROM sessions WHERE ended_at IS NULL').all() as unknown as Array<{ id: number }>
  for (const s of open) endSession(Number(s.id))
}

/** Sessões antigas (antes dos perfis) passam a ser do primeiro perfil. */
export function adoptOrphanSessions(profileId: number): void {
  getDb().prepare('UPDATE sessions SET profile_id = ? WHERE profile_id IS NULL').run(profileId)
}

export function profileStats(profileId: number, includePlatform: boolean, top = 12): ProfileStats {
  const db = getDb()
  const s = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(duration_sec), 0) AS secs, COALESCE(MAX(duration_sec), 0) AS longest,
              COUNT(DISTINCT game_id) AS games FROM sessions WHERE profile_id = ? AND ended_at IS NOT NULL`
    )
    .get(profileId) as { n: number; secs: number; longest: number; games: number }
  const perGame = db
    .prepare('SELECT game_id AS g, SUM(duration_sec) AS secs FROM sessions WHERE profile_id = ? AND ended_at IS NOT NULL GROUP BY game_id')
    .all(profileId) as unknown as Array<{ g: number; secs: number }>
  const totals = new Map<number, number>(perGame.map((r) => [Number(r.g), Number(r.secs)]))
  let achievements = 0
  if (includePlatform) {
    // O dono da conta Steam desta máquina herda o tempo registrado pelas lojas.
    const plat = db.prepare('SELECT id, platform_playtime_sec AS p FROM games WHERE platform_playtime_sec > 0').all() as unknown as Array<{ id: number; p: number }>
    for (const r of plat) totals.set(Number(r.id), (totals.get(Number(r.id)) ?? 0) + Number(r.p))
    achievements = Number((db.prepare('SELECT COUNT(*) AS n FROM achievements WHERE unlocked_at IS NOT NULL').get() as { n: number }).n)
  }
  const topGames = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([gameId, seconds]) => ({ gameId, seconds }))
  const seconds = [...totals.values()].reduce((a, b) => a + b, 0)
  return {
    profileId,
    hours: seconds / 3600,
    sessions: Number(s.n),
    gamesPlayed: totals.size,
    longestSessionSeconds: Number(s.longest),
    achievements,
    topGames
  }
}

// ---------- dados da loja ----------

export function setCompleted(id: number, completed: boolean): Game {
  getDb().prepare('UPDATE games SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id)
  return getGame(id)!
}

/** Jogos com appid da Steam conhecido (próprio ou encontrado pelo título) que ainda não têm tags/avaliação. */
export function gamesNeedingStore(): Array<{ id: number; appid: string }> {
  const rows = getDb()
    .prepare(
      `SELECT id, CASE WHEN platform = 'steam' THEN platform_id ELSE steam_ref END AS appid FROM games
       WHERE store_fetched = 0 AND (platform = 'steam' OR (steam_ref IS NOT NULL AND steam_ref <> ''))`
    )
    .all() as unknown as Array<{ id: number; appid: string }>
  return rows.map((r) => ({ id: Number(r.id), appid: String(r.appid) }))
}

export function gamesNeedingDetails(): number[] {
  const rows = getDb().prepare("SELECT id FROM games WHERE details_fetched = 0 AND platform <> 'manual' ORDER BY installed DESC, last_played DESC").all() as unknown as Array<{ id: number }>
  return rows.map((r) => Number(r.id))
}

export function saveStoreData(
  id: number,
  d: { tags: string[]; reviewPct: number | null; reviewLabel: string | null; reviewCount: number | null; releaseDate: number | null }
): void {
  getDb()
    .prepare(
      `UPDATE games SET tags = ?, review_pct = ?, review_label = ?, review_count = ?,
       release_date = COALESCE(release_date, ?), store_fetched = 1 WHERE id = ?`
    )
    .run(d.tags.length ? JSON.stringify(d.tags) : null, d.reviewPct, d.reviewLabel, d.reviewCount, d.releaseDate, id)
}

export function markStoreFetched(id: number): void {
  getDb().prepare('UPDATE games SET store_fetched = 1 WHERE id = ?').run(id)
}

export function steamAppIdFor(id: number): string | null {
  const r = getDb().prepare('SELECT platform, platform_id, steam_ref FROM games WHERE id = ?').get(id) as
    | { platform: string; platform_id: string; steam_ref: string | null }
    | undefined
  if (!r) return null
  if (r.platform === 'steam') return r.platform_id
  return r.steam_ref || null
}

export function cachedTags(appids: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  if (!appids.length) return out
  const stmt = getDb().prepare('SELECT tags FROM app_tags WHERE appid = ?')
  for (const a of appids) {
    const r = stmt.get(a) as { tags: string } | undefined
    if (r) out[a] = parseList(r.tags)
  }
  return out
}

export function saveTags(appid: string, tags: string[]): void {
  getDb()
    .prepare('INSERT INTO app_tags (appid, tags, fetched_at) VALUES (?, ?, ?) ON CONFLICT(appid) DO UPDATE SET tags = excluded.tags, fetched_at = excluded.fetched_at')
    .run(appid, JSON.stringify(tags), Date.now())
}
// ---------- settings ----------

export function getSetting(key: string): string | null {
  const r = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return r?.value ?? null
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value)
}
