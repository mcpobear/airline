# Global Airline

A casual, single-player airline management game on an interactive 3D globe. No backend, no accounts, no paid services.

**Status: all 10 phases complete (v1.2).** Pick a headquarters among 145 real airports, unlock more, buy aircraft (two A220-100s to start, 29 models to buy), hand-pick passenger and cargo jobs to load, choose a destination and dispatch. Flights play out on the 3D globe (takeoff, cruise, landing), pay when jobs reach their final destination, and keep going while the browser is closed. Nothing loads automatically and there are no competitors.

## How to play
1. Name your airline and pick a headquarters. Click airports on the globe or use the Airports list to unlock more (price rises with the size of the airport and your network).
2. **Fleet** > pick an aircraft > load jobs from the airport board (seat and cargo limits apply) > choose a destination (range, airport category and cost are checked and explained) > **Dispatch flight**.
3. Jobs that need a stopover: fly to the layover, **Unload** them (they wait there, marked LAYOVER, and are paid only at their final destination) and carry them on with any aircraft.
4. **Finances** shows revenue, costs and per-aircraft profit. Aircraft can be sold for 60% of their price (not while loaded or flying, and never the last one). If you run out of cash with nothing able to fly, one-off emergency funding is offered.
5. Controls: drag to rotate the globe, wheel/pinch to zoom, Esc closes the side panel, "Follow on map" tracks a flying aircraft.

## The globe
The world is painted once at startup from the Natural Earth land mask: land, sea, a drawn coastline and a lightened
continental shelf, so land and water never read as the same surface. Five looks ship, switchable in Settings and
remembered in your browser:

| Style | Looks like |
| --- | --- |
| **Relief globe** (default) | A physical globe: real greens, tans and highland browns, shaded terrain, over a starfield. |
| **Printed atlas** | Ink and paper. Pale land, deep teal sea, a drawn coast and a faint graticule. |
| **Night routes** | The inflight map at 3am: near-black sea, slate continents, coastlines picked out in light. |
| **Bold poster** | Saturated flat colour, thick dark coastline, no shading at all. |
| **Low poly** | The original faceted globe, kept for comparison. |

A style is only a palette plus a lighting setup (`src/world/palettes.ts`), so adding another is a dozen lines and no
renderer changes. The key light follows the camera, so whatever you are looking at is lit; the low-poly style keeps the
real sun and its day/night line instead.

Aircraft are modelled per class, so a regional jet, a narrowbody, a widebody and a four-engined jumbo are all
recognisable in flight.

## Jobs and the board
Jobs themselves have no deadline: once a job is loaded, in the air, or set down at a layover, it waits for you
indefinitely and is paid in full on delivery. What does change is each airport's **board of offers, which is replaced
every 10 minutes** (`BALANCE.jobs.refreshIntervalMs`). The Jobs panel and the aircraft panel both count down to the
next board. The cycle is derived from the clock rather than a timer, so closing the browser for an hour gets you one
fresh board rather than six.

**Load all bound for** chips sit above the available jobs: one tap fills the aircraft with everything headed to that
city, best-paying first, and tells you if anything was left behind.

## Sound
A lounge score plays in the browser, synthesised with Web Audio: a slow jazz progression on electric piano, bass,
brushes and a sparse melody. There are no audio files, nothing is downloaded and nothing is licensed. It starts after
your first click (browsers require that) and can be muted from the speaker button in the top bar, with a volume slider
in Settings.

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
