/**
 * Parser mínimo do formato KeyValues (VDF) usado pela Steam em
 * libraryfolders.vdf e appmanifest_*.acf. Suporta aninhamento, aspas e comentários.
 */
export type VdfValue = string | VdfObject
export interface VdfObject {
  [key: string]: VdfValue
}

export function parseVdf(text: string): VdfObject {
  const tokens = tokenize(text)
  let i = 0

  function parseObject(): VdfObject {
    const obj: VdfObject = {}
    while (i < tokens.length) {
      const t = tokens[i++]
      if (t === '}') return obj
      if (t === '{') continue
      const key = unquote(t)
      const next = tokens[i]
      if (next === '{') {
        i++
        obj[key] = parseObject()
      } else if (next !== undefined) {
        i++
        obj[key] = unquote(next)
      }
    }
    return obj
  }

  return parseObject()
}

function tokenize(text: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"') {
      let j = i + 1
      let s = ''
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\' && j + 1 < text.length) {
          s += text[j + 1]
          j += 2
        } else {
          s += text[j++]
        }
      }
      out.push('"' + s + '"')
      i = j + 1
    } else if (c === '{' || c === '}') {
      out.push(c)
      i++
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
    } else if (/\s/.test(c)) {
      i++
    } else {
      let j = i
      while (j < text.length && !/[\s{}"]/.test(text[j])) j++
      out.push(text.slice(i, j))
      i = j
    }
  }
  return out
}

function unquote(t: string): string {
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t
}

/** Busca sem diferenciar maiúsculas, já que a Steam alterna a caixa entre versões. */
export function vdfGet(obj: VdfObject | undefined, key: string): VdfValue | undefined {
  if (!obj) return undefined
  const k = Object.keys(obj).find((x) => x.toLowerCase() === key.toLowerCase())
  return k ? obj[k] : undefined
}
