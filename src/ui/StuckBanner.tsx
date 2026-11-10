import { useShallow } from 'zustand/react/shallow'
import { BALANCE } from '../config/balance'
import { isStuck } from '../sim/economy'
import { toCore, useGameStore } from '../state/gameStore'
import { formatMoney } from './format'

/** Offers one-off emergency funding when the airline is out of cash and nothing can fly. */
export function StuckBanner() {
  const core = useGameStore(useShallow(toCore))
  const take = useGameStore((s) => s.takeRescueFunding)
  if (!core || !isStuck(core)) return null
  return (
    <div role="alert" className="fixed bottom-[76px] left-1/2 z-30 w-[min(520px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border border-orange/60 bg-panel/95 p-4 text-sm shadow-xl backdrop-blur-md">
      <b>You're out of cash and no aircraft can fly.</b>
      <p className="mt-1 text-muted">Take emergency funding of {formatMoney(BALANCE.economy.rescueGrant)} to get moving again (or sell an aircraft).</p>
      <button type="button" onClick={() => take()} className="mt-3 rounded-xl bg-orange px-4 py-2 font-black text-white transition hover:brightness-110">
        Accept emergency funding
      </button>
    </div>
  )
}
