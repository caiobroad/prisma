import { readFileSync } from 'fs'

/**
 * Leitor do appcache/appinfo.vdf da Steam (formato binário, versões 28 e 29).
 * É daqui que saem nome, tipo, desenvolvedor, data de lançamento e caminhos das
 * imagens de cada app da conta, inclusive dos que não estão instalados.
 *
 * Layout: magic u32, universe u32, [v29: offset i64 da tabela de strings],
 * depois entradas { appid u32, size u32, info_state u32, last_updated u32,
 * pics_token u64, sha1[20], change_number u32, binary_sha1[20], KeyValues binário }.
 */
export type KV = { [key: string]: KV | string | number }

const V28 = 0x07564428
const V29 = 0x07564429

export function readAppInfo(path: string, wanted: (appid: string) => boolean): Map<string, KV> {
  const out = new Map<string, KV>()
  let buf: Buffer
  try {
    buf = readFileSync(path)
  } catch {
    return out
  }
  if (buf.length < 16) return out
  const magic = buf.readUInt32LE(0)
  if (magic !== V28 && magic !== V29 && (magic & 0xffffff00) !== 0x07564400) return out

  const strings: string[] = []
  let pos = 8
  const usesStringTable = magic >= V29
  if (usesStringTable) {
    const off = Number(buf.readBigInt64LE(8))
    pos = 16
    if (off > 0 && off < buf.length) {
      const count = buf.readUInt32LE(off)
      let p = off + 4
      for (let i = 0; i < count && p < buf.length; i++) {
        const e = buf.indexOf(0, p)
        if (e < 0) break
        strings.push(buf.toString('utf8', p, e))
        p = e + 1
      }
    }
  }

  const cstr = (p: number): [string, number] => {
    const e = buf.indexOf(0, p)
    return [buf.toString('utf8', p, e), e + 1]
  }

  const readObject = (start: number, end: number): [KV, number] => {
    const o: KV = {}
    let p = start
    while (p < end) {
      const t = buf[p++]
      if (t === 0x08) return [o, p]
      let key: string
      if (usesStringTable) {
        key = strings[buf.readUInt32LE(p)] ?? ''
        p += 4
      } else {
        ;[key, p] = cstr(p)
      }
      switch (t) {
        case 0x00: {
          const [v, np] = readObject(p, end)
          o[key] = v
          p = np
          break
        }
        case 0x01: {
          const [v, np] = cstr(p)
          o[key] = v
          p = np
          break
        }
        case 0x02:
        case 0x04:
        case 0x06:
          o[key] = buf.readInt32LE(p)
          p += 4
          break
        case 0x03:
          o[key] = buf.readFloatLE(p)
          p += 4
          break
        case 0x07:
        case 0x0a:
          o[key] = Number(buf.readBigUInt64LE(p))
          p += 8
          break
        default:
          throw new Error(`tipo KV desconhecido ${t}`)
      }
    }
    return [o, p]
  }

  while (pos + 8 <= buf.length) {
    const appid = buf.readUInt32LE(pos)
    if (appid === 0) break
    const size = buf.readUInt32LE(pos + 4)
    const start = pos + 8
    const end = start + size
    const id = String(appid)
    if (wanted(id)) {
      try {
        const [o] = readObject(start + 60, end)
        const info = o.appinfo
        if (info && typeof info === 'object') out.set(id, info)
      } catch {
        /* entrada corrompida: ignora só esta */
      }
    }
    pos = end
  }
  return out
}

export function kvObj(v: KV | string | number | undefined): KV | undefined {
  return v && typeof v === 'object' ? v : undefined
}

export function kvStr(v: KV | string | number | undefined): string | undefined {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined
}
