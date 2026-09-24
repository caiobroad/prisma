import { BrowserWindow, dialog, nativeImage } from 'electron'
import type { Profile } from '@shared/types'
import { getDb } from './db'
import { adoptOrphanSessions, getSetting, setSetting } from './db/games'

/**
 * Perfis locais: várias pessoas no mesmo PC, cada uma com foto, banner, nickname,
 * ajustes e sessões próprias. A biblioteca (jogos instalados e da conta) é do computador.
 */
interface Row {
  id: number
  nickname: string
  avatar: string | null
  banner: string | null
  steam_linked: number
  created_at: number
  last_used: number | null
}

const toProfile = (r: Row): Profile => ({
  id: Number(r.id),
  nickname: r.nickname,
  avatar: r.avatar,
  banner: r.banner,
  steamLinked: Number(r.steam_linked) === 1,
  createdAt: Number(r.created_at),
  lastUsed: r.last_used == null ? null : Number(r.last_used)
})

let activeId: number | null = null
/** O usuário já escolheu um perfil nesta execução (a janela recriada após hibernar não pergunta de novo). */
let chosen = false

/** Perfil ativo; até a escolha na tela de perfis, o último usado (sessões em segundo plano precisam de dono). */
export function activeProfileId(): number | null {
  if (activeId == null) activeId = listProfiles()[0]?.id ?? null
  return activeId
}

export function needsPick(): boolean {
  return !chosen
}

export function listProfiles(): Profile[] {
  ensureDefault()
  const rows = getDb().prepare('SELECT * FROM profiles ORDER BY last_used DESC NULLS LAST, id').all() as unknown as Row[]
  return rows.map(toProfile)
}

export function getProfile(id: number): Profile | null {
  const r = getDb().prepare('SELECT * FROM profiles WHERE id = ?').get(id) as unknown as Row | undefined
  return r ? toProfile(r) : null
}

/** Primeiro uso: cria o perfil inicial, dono da conta Steam, herdando ajustes e sessões atuais. */
function ensureDefault(): void {
  const n = (getDb().prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number }).n
  if (Number(n) > 0) return
  const info = getDb()
    .prepare('INSERT INTO profiles (nickname, steam_linked, created_at) VALUES (?, 1, ?)')
    .run('Jogador', Date.now())
  const id = Number(info.lastInsertRowid)
  adoptOrphanSessions(id)
  const legacy = getSetting('settings')
  if (legacy) setSetting(`settings:${id}`, legacy)
}

export function selectProfile(id: number): void {
  if (!getProfile(id)) throw new Error('Perfil não encontrado')
  activeId = id
  chosen = true
  getDb().prepare('UPDATE profiles SET last_used = ? WHERE id = ?').run(Date.now(), id)
}

export function createProfile(nickname: string): Profile {
  const name = nickname.trim().slice(0, 32) || 'Jogador'
  const info = getDb().prepare('INSERT INTO profiles (nickname, created_at) VALUES (?, ?)').run(name, Date.now())
  return getProfile(Number(info.lastInsertRowid))!
}

export function updateProfile(id: number, patch: Partial<Pick<Profile, 'nickname' | 'avatar' | 'banner' | 'steamLinked'>>): Profile {
  const db = getDb()
  if (patch.nickname != null) db.prepare('UPDATE profiles SET nickname = ? WHERE id = ?').run(patch.nickname.trim().slice(0, 32) || 'Jogador', id)
  if (patch.avatar !== undefined) db.prepare('UPDATE profiles SET avatar = ? WHERE id = ?').run(patch.avatar, id)
  if (patch.banner !== undefined) db.prepare('UPDATE profiles SET banner = ? WHERE id = ?').run(patch.banner, id)
  if (patch.steamLinked != null) {
    // Só um perfil pode ser o dono da conta Steam da máquina.
    if (patch.steamLinked) db.prepare('UPDATE profiles SET steam_linked = 0').run()
    db.prepare('UPDATE profiles SET steam_linked = ? WHERE id = ?').run(patch.steamLinked ? 1 : 0, id)
  }
  return getProfile(id)!
}

export function removeProfile(id: number): void {
  const n = (getDb().prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number }).n
  if (Number(n) <= 1) throw new Error('É preciso manter pelo menos um perfil')
  getDb().prepare('DELETE FROM profiles WHERE id = ?').run(id)
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(`settings:${id}`)
  if (activeId === id) activeId = null
}

/** Seletor de imagem: recorta ao centro e reduz (avatar 256×256, banner 1600×500) em JPEG. */
export async function pickImage(win: BrowserWindow | null, kind: 'avatar' | 'banner'): Promise<string | null> {
  const opts: Electron.OpenDialogOptions = {
    title: kind === 'avatar' ? 'Escolher foto do perfil' : 'Escolher banner do perfil',
    properties: ['openFile'],
    filters: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }]
  }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (r.canceled || !r.filePaths[0]) return null
  const img = nativeImage.createFromPath(r.filePaths[0])
  if (img.isEmpty()) return null
  const [tw, th] = kind === 'avatar' ? [256, 256] : [1600, 500]
  const { width, height } = img.getSize()
  const scale = Math.max(tw / width, th / height)
  const cw = Math.round(tw / scale)
  const ch = Math.round(th / scale)
  const cropped = img.crop({ x: Math.round((width - cw) / 2), y: Math.round((height - ch) / 2), width: cw, height: ch })
  const out = cropped.resize({ width: tw, height: th, quality: 'best' })
  return 'data:image/jpeg;base64,' + out.toJPEG(kind === 'avatar' ? 88 : 82).toString('base64')
}
