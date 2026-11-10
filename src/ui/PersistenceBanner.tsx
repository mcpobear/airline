import { useState } from 'react'
import { getPersistence } from '../persistence/instance'
import { usePersistStore } from '../persistence/persistence'
import { downloadText } from './download'

const bar =
  'fixed top-[76px] left-1/2 z-30 w-[min(560px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border border-line/70 bg-panel/95 p-4 text-sm shadow-xl shadow-black/50 backdrop-blur-md'
const primary = 'rounded-xl bg-cyan px-3 py-1.5 text-xs font-black text-space transition hover:brightness-110'
const secondary = 'rounded-xl bg-white/10 px-3 py-1.5 text-xs font-extrabold text-ink transition hover:bg-white/15'

/** Tells the player when saving isn't working or needs a decision. Never overwrites anything by itself. */
export function PersistenceBanner() {
  const { status, message, rawCorrupt } = usePersistStore()
  const [confirm, setConfirm] = useState(false)
  const p = getPersistence()

  if (status === 'corrupt') {
    return (
      <div className="fixed inset-0 z-40 grid place-items-center bg-space/80 p-4 backdrop-blur-sm" role="alertdialog" aria-labelledby="corrupt-title">
        <div className="w-full max-w-md rounded-3xl border border-line/70 bg-panel p-6 shadow-2xl">
          <h2 id="corrupt-title" className="text-xl font-black">Your saved game can't be loaded</h2>
          <p className="mt-2 text-sm text-muted">{message}</p>
          <p className="mt-2 text-sm text-muted">
            Nothing has been changed or deleted. Download the unreadable data first if you want to keep it, then start a new airline.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={secondary} onClick={() => downloadText('global-airline-unreadable-save.json', JSON.stringify(rawCorrupt, null, 2))}>
              Download unreadable save
            </button>
            {confirm ? (
              <button type="button" className="rounded-xl bg-bad px-3 py-1.5 text-xs font-black text-white" onClick={() => { setConfirm(false); void p.discardCorruptSave() }}>
                Yes, delete it and start fresh
              </button>
            ) : (
              <button type="button" className={secondary} onClick={() => setConfirm(true)}>
                Start a new airline…
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'conflict') {
    return (
      <div className={bar} role="alert">
        <b>Another tab is playing this airline.</b>
        <p className="mt-1 text-muted">Saving is paused here so one tab can't overwrite the other.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={primary} onClick={() => void p.useStoredSave()}>Load the other tab's progress</button>
          <button type="button" className={secondary} onClick={() => void p.keepThisTab()}>Keep this tab (overwrites the other)</button>
        </div>
      </div>
    )
  }

  if (status === 'unavailable' || status === 'error') {
    return (
      <div className={bar} role="status">
        {message}
        {status === 'unavailable' && (
          <button type="button" className={`${secondary} ml-3`} onClick={() => { const j = p.exportJson(); if (j) downloadText('global-airline-save.json', j) }}>
            Export save
          </button>
        )}
      </div>
    )
  }
  return null
}
