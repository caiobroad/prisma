import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { SCHEMA, SCHEMA_FTS } from './schema'

/**
 * Banco local em SQLite usando o driver embutido no Node (node:sqlite), o mesmo
 * que o Electron carrega. Sem compilação nativa. Arquivo em %AppData%\Prisma\prisma.db.
 */
let db: DatabaseSync | null = null
let ftsAvailable = false

export function dbPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const file = join(dir, 'prisma.db')
  if (!existsSync(file)) importLegacy(file)
  return file
}

/**
 * O app se chamava "Nexus Launcher": na primeira abertura como Prisma, traz a biblioteca,
 * as sessões, as conquistas e os ajustes de %AppData%\Nexus Launcher\nexus.db.
 * Copia (não move): a pasta antiga fica intacta.
 */
function importLegacy(target: string): void {
  const old = join(app.getPath('appData'), 'Nexus Launcher', 'nexus.db')
  if (!existsSync(old)) return
  try {
    copyFileSync(old, target)
    // O WAL guarda escritas ainda não consolidadas; tem de acompanhar o arquivo, com o novo nome.
    for (const suffix of ['-wal', '-shm']) {
      if (existsSync(old + suffix)) copyFileSync(old + suffix, target + suffix)
    }
  } catch {
    /* sem acesso à pasta antiga: começa do zero e a varredura refaz a biblioteca */
  }
}

/** Preenchido quando o banco abriu danificado e foi restaurado de um backup (a interface avisa). */
export let dbRecovery: { restoredFrom: string | null; movedTo: string } | null = null

const BACKUP_EVERY_MS = 12 * 3600_000
const BACKUPS_KEPT = 5

function backupDir(): string {
  return join(app.getPath('userData'), 'backups')
}

/** O banco está íntegro? (quick_check lê todas as páginas; num banco de ~1 MB leva milissegundos.) */
function healthy(file: string): boolean {
  let d: DatabaseSync | null = null
  try {
    d = new DatabaseSync(file)
    const r = d.prepare('PRAGMA quick_check').all() as Array<{ quick_check: string }>
    return r.length === 1 && r[0].quick_check === 'ok'
  } catch {
    return false
  } finally {
    try {
      d?.close()
    } catch {
      /* já fechado */
    }
  }
}

/**
 * Banco danificado: guarda os arquivos estragados numa pasta "danificado-<data>" (nada é
 * apagado) e põe no lugar o backup íntegro mais recente. Sem backup, o app começa do zero e
 * a varredura refaz a biblioteca.
 */
function recoverDb(file: string): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const moved = join(app.getPath('userData'), `danificado-${stamp}`)
  mkdirSync(moved, { recursive: true })
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(file + suffix)) renameSync(file + suffix, join(moved, 'prisma.db' + suffix))
  }
  let restored: string | null = null
  for (const b of listBackups()) {
    if (healthy(b)) {
      copyFileSync(b, file)
      restored = b
      break
    }
  }
  dbRecovery = { restoredFrom: restored, movedTo: moved }
}

function listBackups(): string[] {
  try {
    return readdirSync(backupDir())
      .filter((f) => /^prisma-\d{8}-\d{6}\.db$/.test(f))
      .sort()
      .reverse()
      .map((f) => join(backupDir(), f))
  } catch {
    return []
  }
}

/**
 * Cópia consistente do banco (VACUUM INTO grava um instantâneo transacional, mesmo com o app
 * escrevendo). Uma a cada 12 h, as 5 mais recentes ficam em %AppData%\Prisma\backups.
 */
export function backupDb(force = false): void {
  const d = db
  if (!d) return
  try {
    const last = listBackups()[0]
    if (!force && last && Date.now() - statSync(last).mtimeMs < BACKUP_EVERY_MS) return
    mkdirSync(backupDir(), { recursive: true })
    const now = new Date()
    const p = (n: number): string => String(n).padStart(2, '0')
    const name = `prisma-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.db`
    const target = join(backupDir(), name)
    d.prepare('VACUUM INTO ?').run(target)
    for (const old of listBackups().slice(BACKUPS_KEPT)) unlinkSync(old)
  } catch {
    /* disco cheio ou sem permissão: tenta de novo na próxima */
  }
}

export function getDb(): DatabaseSync {
  if (db) return db
  const file = dbPath()
  if (existsSync(file) && !healthy(file)) recoverDb(file)
  db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  migrate(db)
  try {
    db.exec(SCHEMA_FTS)
    ftsAvailable = true
  } catch {
    ftsAvailable = false
  }
  return db
}

export function hasFts(): boolean {
  getDb()
  return ftsAvailable
}

/** Colunas acrescentadas depois da primeira versão. ALTER TABLE só roda para as que faltam. */
const COLUMNS: Array<[string, string]> = [
  ['banner_url', 'TEXT'],
  ['logo_url', 'TEXT'],
  ['icon_url', 'TEXT'],
  ['developer', 'TEXT'],
  ['publisher', 'TEXT'],
  ['release_date', 'INTEGER'],
  ['genres', 'TEXT'],
  ['description', 'TEXT'],
  ['platform_playtime_sec', 'INTEGER NOT NULL DEFAULT 0'],
  ['platform_last_played', 'INTEGER'],
  ['zone_color', 'TEXT'],
  ['details_fetched', 'INTEGER NOT NULL DEFAULT 0'],
  ['install_size', 'INTEGER'],
  ['trailer_url', 'TEXT'],
  ['steam_ref', 'TEXT'],
  ['tags', 'TEXT'],
  ['franchise', 'TEXT'],
  ['review_pct', 'INTEGER'],
  ['review_label', 'TEXT'],
  ['review_count', 'INTEGER'],
  ['metacritic', 'INTEGER'],
  ['min_requirements', 'TEXT'],
  ['min_ram_gb', 'REAL'],
  ['completed', 'INTEGER NOT NULL DEFAULT 0'],
  ['store_fetched', 'INTEGER NOT NULL DEFAULT 0'],
  ['controller', 'TEXT'],
  ['emu_system', 'TEXT']
]

const SESSION_COLUMNS: Array<[string, string]> = [
  ['avg_fps', 'REAL'],
  ['avg_cpu', 'REAL'],
  ['avg_gpu', 'REAL'],
  ['max_gpu_temp', 'REAL'],
  ['max_cpu_temp', 'REAL'],
  ['profile_id', 'INTEGER'],
  ['screenshot', 'TEXT']
]

function addColumns(d: DatabaseSync, table: string, cols: Array<[string, string]>): void {
  const existing = new Set((d.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name))
  for (const [name, type] of cols) {
    if (!existing.has(name)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`)
  }
}

function migrate(d: DatabaseSync): void {
  addColumns(d, 'games', COLUMNS)
  addColumns(d, 'sessions', SESSION_COLUMNS)
  // Conta Steam do perfil: NULL = perfil antigo (vê tudo), '' = sem Steam, '<id da conta>' = só os jogos dela.
  addColumns(d, 'profiles', [['steam_account', 'TEXT']])
  const v = (d.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
  if (v < 3) {
    // Detalhes passam a incluir trailer e referência da Steam: busca de novo sob demanda.
    d.exec('UPDATE games SET details_fetched = 0')
    d.exec('PRAGMA user_version = 3')
  }
  if (v < 4) {
    // Detalhes passam a incluir requisitos mínimos e Metacritic.
    d.exec('UPDATE games SET details_fetched = 0')
    d.exec('PRAGMA user_version = 4')
  }
  if (v < 5) {
    // Suporte a controle vem com os dados da loja: busca de novo. Jogos de outras lojas eram
    // ligados à Steam por prefixo do título ("Spellbreak" virava "Spell Breakers") e herdavam
    // gêneros, tags e descrição errados: limpa e deixa a busca exata refazer.
    d.exec('UPDATE games SET store_fetched = 0')
    d.exec(`UPDATE games SET steam_ref = NULL, details_fetched = 0, genres = '[]', tags = NULL, description = NULL,
            trailer_url = NULL, min_requirements = NULL, min_ram_gb = NULL, metacritic = NULL,
            review_pct = NULL, review_label = NULL, review_count = NULL, controller = NULL
            WHERE platform NOT IN ('steam', 'manual') AND steam_ref IS NOT NULL`)
    d.exec('PRAGMA user_version = 5')
  }
}

/** Executa várias escritas numa transação; desfaz tudo se algo falhar. */
export function transaction<T>(fn: () => T): T {
  const d = getDb()
  d.exec('BEGIN')
  try {
    const r = fn()
    d.exec('COMMIT')
    return r
  } catch (e) {
    d.exec('ROLLBACK')
    throw e
  }
}

export function closeDb(): void {
  try {
    db?.close()
  } catch {
    /* já fechado */
  }
  db = null
}
