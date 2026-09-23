/**
 * KeyValues binário da Steam no formato "clássico" (chaves como strings terminadas em zero),
 * usado em appcache/stats/*.bin. Tipos: 0 objeto, 1 string, 2 int32, 3 float, 4 ptr,
 * 6 cor, 7 uint64, 10 int64, 8/11 fim de objeto.
 */
export type BKV = { [key: string]: BKV | string | number }

export function parseBinaryKV(buf: Buffer): BKV {
  let p = 0
  const cstr = (): string => {
    const e = buf.indexOf(0, p)
    if (e < 0) throw new Error('string sem terminador')
    const s = buf.toString('utf8', p, e)
    p = e + 1
    return s
  }
  const obj = (): BKV => {
    const o: BKV = {}
    while (p < buf.length) {
      const t = buf[p++]
      if (t === 8 || t === 11) return o
      const k = cstr()
      switch (t) {
        case 0:
          o[k] = obj()
          break
        case 1:
          o[k] = cstr()
          break
        case 2:
        case 4:
        case 6:
          o[k] = buf.readInt32LE(p)
          p += 4
          break
        case 3:
          o[k] = buf.readFloatLE(p)
          p += 4
          break
        case 7:
        case 10:
          o[k] = Number(buf.readBigUInt64LE(p))
          p += 8
          break
        default:
          throw new Error(`tipo ${t}`)
      }
    }
    return o
  }
  return obj()
}

export function bkvObj(v: BKV | string | number | undefined): BKV | undefined {
  return v && typeof v === 'object' ? v : undefined
}
