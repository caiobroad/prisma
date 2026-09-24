import { memo, type ReactNode } from 'react'

/**
 * Markdown mínimo para as notas de versão do GitHub: títulos (#, ##, ###), listas (- ou *),
 * parágrafos, **negrito**, `código` e [links](https://...). Nada de HTML cru: só texto.
 */
export const Markdown = memo(function Markdown({ text: full }: { text: string }) {
  // Instruções de download da página da release não fazem sentido dentro do app.
  const text = full.split(/\n#{1,4}\s*(?:Download|Como baixar|Como instalar)\b/i)[0]
  const blocks: ReactNode[] = []
  let list: ReactNode[] = []
  let para: string[] = []
  const flushList = (): void => {
    if (list.length) blocks.push(<ul key={`u${blocks.length}`}>{list}</ul>)
    list = []
  }
  const flushPara = (): void => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(' '))}</p>)
    para = []
  }
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd()
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    const li = line.match(/^\s*[-*]\s+(.*)$/)
    if (h) {
      flushList()
      flushPara()
      const level = h[1].length
      blocks.push(
        level <= 2 ? <h3 key={`h${blocks.length}`}>{inline(h[2])}</h3> : <h4 key={`h${blocks.length}`}>{inline(h[2])}</h4>
      )
    } else if (li) {
      flushPara()
      list.push(<li key={list.length}>{inline(li[1])}</li>)
    } else if (!line.trim()) {
      flushList()
      flushPara()
    } else {
      flushList()
      para.push(line.trim())
    }
  }
  flushList()
  flushPara()
  return <div className="md">{blocks}</div>
})

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    if (m[1] != null) out.push(<b key={m.index}>{m[1]}</b>)
    else if (m[2] != null) out.push(<code key={m.index}>{m[2]}</code>)
    else {
      const url = m[4]
      out.push(
        <button key={m.index} className="link" onClick={() => window.nexus.shell.openExternal(url)}>
          {m[3]}
        </button>
      )
    }
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}
