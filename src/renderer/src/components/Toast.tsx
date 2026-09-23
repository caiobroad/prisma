import { useStore } from '../lib/store'

export function Toast() {
  const toast = useStore((s) => s.toast)
  return (
    <div className={`toast ${toast ? 'show' : ''} ${toast?.kind === 'err' ? 'err' : ''}`} role="status" aria-live="polite">
      <i />
      <span>{toast?.text ?? ''}</span>
    </div>
  )
}
