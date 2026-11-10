import { useNotifyStore, type ToastTone } from '../state/notifyStore'

const TONE: Record<ToastTone, string> = {
  good: 'border-good/50 text-good',
  bad: 'border-bad/50 text-bad',
  info: 'border-cyan/50 text-cyan',
}

/** Non-blocking notifications; they fade by themselves and ignore pointer events. */
export function Toasts() {
  const toasts = useNotifyStore((s) => s.toasts)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 left-1/2 z-30 flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col items-stretch gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-2xl border bg-panel/95 px-4 py-2.5 text-sm font-bold shadow-lg shadow-black/40 backdrop-blur-md ${TONE[t.tone]}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
