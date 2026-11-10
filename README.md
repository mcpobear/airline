# Global Airline

A casual, single-player airline management game on an interactive 3D globe. No backend, no accounts, no paid services.

**Status: all 10 phases complete (v1.1).** Pick a headquarters among 145 real airports, unlock more, buy aircraft (two A220-100s to start, 29 models to buy), hand-pick passenger and cargo jobs to load, choose a destination and dispatch. Flights play out on the 3D globe (takeoff, cruise, landing), pay when jobs reach their final destination, and keep going while the browser is closed. Jobs never expire, nothing loads automatically, and there are no competitors.

## How to play
1. Name your airline and pick a headquarters. Click airports on the globe or use the Airports list to unlock more (price rises with the size of the airport and your network).
2. **Fleet** > pick an aircraft > load jobs from the airport board (seat and cargo limits apply) > choose a destination (range, airport category and cost are checked and explained) > **Dispatch flight**.
3. Jobs that need a stopover: fly to the layover, **Unload** them (they wait there, marked LAYOVER, and are paid only at their final destination) and carry them on with any aircraft.
4. **Finances** shows revenue, costs and per-aircraft profit. Aircraft can be sold for 60% of their price (not while loaded or flying, and never the last one). If you run out of cash with nothing able to fly, one-off emergency funding is offered.
5. Controls: drag to rotate, wheel/pinch to zoom, Esc closes the side panel, "Follow on globe" tracks a flying aircraft.

## Stack
React + TypeScript, Vite, Tailwind CSS 4, Three.js + React Three Fiber, Zustand, Dexie (IndexedDB), Vitest, Playwright.

## Develop
```
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build
npm run preview    # serve the production build
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end smoke test (Playwright; run `npx playwright install chromium` once)
npm run generate:landmask   # regenerate the land mask from world-atlas
```

## Deploy to GitHub Pages
1. Push to a GitHub repo with a `main` branch.
2. Repo Settings > Pages > Source: **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` tests, builds with `VITE_BASE=/<repo>/` and publishes.

## Save data
Progress autosaves to IndexedDB (via Dexie) a moment after every change and when the tab is hidden. Saves are versioned (`persistence/schema.ts`, with a migration hook) and validated on load.
- **Offline progress:** flights are stored as departure/arrival timestamps. On load, every flight that finished while you were away is landed and paid, exactly once.
- **Never silently overwritten:** an unreadable or invalid save is kept untouched (you can download it) and autosave stays off until you choose to start fresh. If another tab saved newer progress, saving pauses and you choose which to keep. Importing over an existing airline, and reset, ask for confirmation.
- **Export / import:** Settings > Export save downloads a JSON file; Import save (also on the new-airline screen) validates before loading.
- If the browser blocks IndexedDB (private mode), the game still plays and offers export.

## Tuning the game
Every balancing number lives in `src/config/balance.ts` (cash, prices, rewards, job counts, time acceleration, overhead, camera). Developer cheats (+$1M, land all flights) exist only in `npm run dev` builds and are removed from production bundles.

## Testing
`npm test` runs ~105 unit tests of the pure simulation (flight maths, dispatch rules, payouts, layovers, economy, persistence and migrations). `npm run test:e2e` drives the production build in a browser (airline creation, unlocking, buying, loading, dispatch to landing on a fast-forwarded clock, refresh persistence, offline catch-up, corrupt-save handling, export/import, selling). CI (`.github/workflows/ci.yml`) runs typecheck, unit and e2e tests; the deploy workflow runs the unit tests first.

## Known limitations
- Two tabs on one airline are detected and paused, not merged.
- Aircraft and airports are simplified models (real names, codes and coordinates; approximate specs and balancing prices). The 737 MAX 7/10 and 777-8/9 are flagged "not yet in service" (as of Nov 2026) and hidden unless enabled in Settings.
- Land outline is coarse (110 m Natural Earth) by design. The globe chunk is ~950 kB (loaded separately from the UI).
- Labels are decluttered by priority, so some airport codes appear only when zoomed in.
- The flat map's imagery is generated once at startup at 2048x1024, so it softens at the deepest zoom.
- Switching map mode loads a separate code chunk, which takes a moment on a slow machine.
- No tutorial beyond the hints in the panels.
