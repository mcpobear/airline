import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { startPersistence } from './persistence/instance'

startPersistence()

// Development only: a handle on the stores for debugging and for driving the
// app from test scripts. `import.meta.env.DEV` is false in production, so the
// whole block is removed from the shipped bundle.
if (import.meta.env.DEV) {
  void Promise.all([import('./state/gameStore'), import('./state/uiStore')]).then(([game, ui]) => {
    Object.assign(window, { __gameStore: game.useGameStore, __uiStore: ui.useUiStore })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
