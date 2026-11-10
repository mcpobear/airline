import { create } from 'zustand'

export type ToastTone = 'good' | 'bad' | 'info'
export interface Toast {
  id: number
  tone: ToastTone
  text: string
}

interface NotifyState {
  toasts: Toast[]
  push: (text: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

let nextId = 1
const LIFETIME_MS = 4000
const MAX_VISIBLE = 4

/** Non-blocking notifications: they fade on their own and never interrupt play. */
export const useNotifyStore = create<NotifyState>()((set, get) => ({
  toasts: [],
  push: (text, tone = 'info') => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, tone, text }].slice(-MAX_VISIBLE) }))
    setTimeout(() => get().dismiss(id), LIFETIME_MS)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
