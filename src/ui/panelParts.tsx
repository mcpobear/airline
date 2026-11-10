import type { ReactNode } from 'react'

export const leftShell =
  'fixed top-[76px] bottom-2 left-[76px] z-10 flex w-[327px] max-w-[calc(100vw-84px)] flex-col rounded-3xl border border-line/60 bg-panel/90 shadow-xl shadow-black/40 backdrop-blur-md'

export const rightShell =
  'fixed top-[76px] right-2 bottom-2 z-20 flex w-[327px] flex-col max-sm:top-auto max-sm:left-2 max-sm:h-[55vh] max-sm:w-auto gap-3 overflow-y-auto rounded-3xl border border-line/60 bg-panel/90 p-5 shadow-xl shadow-black/40 backdrop-blur-md panel-scroll'

export function PanelHeader({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
      <h2 className="text-2xl font-black">{title}</h2>
      {hint && <span className="text-sm font-bold text-muted">{hint}</span>}
    </div>
  )
}

export function Meter({ value, max, tone = 'bg-cyan' }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-space/70">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function profitTone(n: number) {
  return n > 0 ? 'text-good' : n < 0 ? 'text-bad' : 'text-muted'
}
