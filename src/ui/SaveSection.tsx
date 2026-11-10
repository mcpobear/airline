import { useRef, useState } from 'react'
import { getPersistence } from '../persistence/instance'
import { usePersistStore } from '../persistence/persistence'
import type { SaveFile } from '../persistence/schema'
import { useGameStore } from '../state/gameStore'
import { useNotifyStore } from '../state/notifyStore'
import { downloadText } from './download'

/** Settings: autosave status, export to a file, import from a file (with confirmation before replacing). */
export function SaveSection() {
  const status = usePersistStore((s) => s.status)
  const lastSavedAt = usePersistStore((s) => s.lastSavedAt)
  const hasAirline = useGameStore((s) => !!s.airline)
  const notify = useNotifyStore((s) => s.push)
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<SaveFile | null>(null)
  const p = getPersistence()

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const parsed = p.parseImport(await file.text())
    if (!parsed.ok) return notify(parsed.error, 'bad')
    if (hasAirline) setPending(parsed.value)
    else {
      await p.applyImport(parsed.value)
      notify('Save imported.', 'good')
    }
    if (input.current) input.current.value = ''
  }

  const statusText =
    status === 'saved' && lastSavedAt
      ? `Autosaved ${new Date(lastSavedAt).toLocaleTimeString()}`
      : status === 'unavailable'
        ? 'Saving is unavailable in this browser'
        : status === 'conflict'
          ? 'Saving paused (another tab)'
          : 'Autosave on'

  return (
    <div className="rounded-2xl bg-panel-2/70 p-4">
      <div className="font-extrabold">Save data</div>
      <div className="text-xs text-muted">{statusText}. Progress is stored in this browser; flights keep going while you're away.</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!hasAirline}
          onClick={() => { const j = p.exportJson(); if (j) downloadText('global-airline-save.json', j) }}
          className="rounded-xl bg-ink/8 px-3 py-2 text-sm font-extrabold transition hover:bg-ink/12 disabled:opacity-40"
        >
          Export save
        </button>
        <button type="button" onClick={() => input.current?.click()} className="rounded-xl bg-ink/8 px-3 py-2 text-sm font-extrabold transition hover:bg-ink/12">
          Import save…
        </button>
        <input ref={input} type="file" accept="application/json,.json" aria-label="Import save file" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {pending && (
        <div className="mt-3 rounded-xl border border-bad/50 p-3 text-sm">
          Replace your current airline with “{pending.game.airline.name}”? Your current game will be lost unless you exported it.
          <div className="mt-2 flex gap-2">
            <button type="button" className="rounded-lg bg-bad px-3 py-1.5 text-xs font-black text-white" onClick={() => { void p.applyImport(pending); setPending(null); notify('Save imported.', 'good') }}>
              Yes, replace
            </button>
            <button type="button" className="rounded-lg bg-ink/8 px-3 py-1.5 text-xs font-extrabold" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Link-style import for the new-airline screen (there is no game to replace there, so no confirmation is needed). */
export function ImportSave() {
  const notify = useNotifyStore((s) => s.push)
  const input = useRef<HTMLInputElement>(null)
  const p = getPersistence()
  const onFile = async (file: File | undefined) => {
    if (!file) return
    const parsed = p.parseImport(await file.text())
    if (!parsed.ok) return notify(parsed.error, 'bad')
    await p.applyImport(parsed.value)
    notify('Save imported.', 'good')
  }
  return (
    <>
      <button type="button" onClick={() => input.current?.click()} className="font-extrabold text-teal underline">
        Import it
      </button>
      <input ref={input} type="file" accept="application/json,.json" aria-label="Import save file" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
    </>
  )
}
