# Architecture

```
src/
  types/      Serialisable domain models (Airport, AircraftModel, OwnedAircraft, Job)
  config/     balance.ts - every tunable number (cash, prices, multipliers, time acceleration)
  sim/        Pure, deterministic simulation code. No React, no Three.js, no DOM. (geo, airline rules, unlock pricing so far)
  data/       Static databases (land mask now; airports/aircraft in Phases 2-3)
  state/      Zustand stores: gameStore (snapshot, Phase 2+), uiStore (selection, camera commands)
  globe/      React Three Fiber renderer: geometry builder, camera rig, markers (reads state, never mutates sim)
  ui/         Floating panels: StatusBar, Sidebar, LeftPanel, RightPanel, CameraButtons
```

**Rule:** `sim/` and `data/` never import from `ui/`, `globe/` or React. The renderer and UI only read a
snapshot of game state, so a backend or cloud save can replace persistence without touching the engine.

**Airports:** `data/airports.ts` is a table of rows (real IATA/ICAO codes and coordinates, guarded by tests that check
known great-circle distances). Markers are one InstancedMesh; IATA labels are an imperative DOM overlay with
level-of-detail by class and zoom. Unlock prices come from `BALANCE.airports` (class x city size x network growth).

**Fleet:** `data/aircraft.ts` holds 29 models (figures documented at the top of the file; prices and per-km costs are balancing
values). `sim/aircraft.ts` has the pure rules: purchase (cash, availability, whether the HQ airport class can handle the
aircraft category), delivery to the HQ, starter fleet, and airport compatibility. Registrations (`sim/registration.ts`)
use the HQ country's real format and are deterministic from the game seed and never duplicated. The whole simulation state is
the `GameCore` type in `sim/core.ts`; the zustand store only adapts it for React.

**Jobs:** `sim/jobs.ts` generates passenger and cargo jobs deterministically from the game seed (destination weighted by
population, airport class and distance; size and reward varied; reward = rate x quantity x distance x demand). Jobs exist only
between unlocked airports. Refills are event-driven (airport unlock, a job loaded or dismissed), never timer-driven, so they
stay correct offline. Each airport has a hard cap on waiting jobs and generation never deletes anything. Return jobs are
guaranteed towards the HQ and the nearest unlocked airports. `sim/loading.ts` holds the load/unload/dismiss rules and capacity
checks; `sim/testUtils.ts` has invariants (no duplicated jobs, aircraft and job records agree) that tests assert after operations.
Jobs have no expiry fields at all. All numbers are in `BALANCE.jobs`.

**Time model:** flights store `departedAt` / `arrivesAt` epoch timestamps. Position is derived from
`now`, never advanced by a timer, so refreshes and closed tabs reconcile on load (Phase 8).
`sim/flightProfile.ts` maps progress to route fraction, altitude and phase (climb/cruise/descent), all pure.
`sim/flight.ts` holds `dispatchFlight` (validates range, airport category, funds, destination and onward routing of
loaded jobs; charges operating cost) and `advanceFlights(game, now)` (lands every flight whose time has passed, pays
each delivered job once, refills job boards). A 500 ms `FlightClock` plus a `visibilitychange` handler just calls
`tick(Date.now())`; catching up after a long absence is the same call. `globe/FlightLayer.tsx` only draws what the
profile says: one instanced mesh for aircraft, an invisible instanced hit-mesh for clicks, cached great-circle lines.

**Globe:** a flat-shaded vertex-coloured icosphere (geometry built once, memoised) from a pre-generated
land mask of Natural Earth data (`scripts/generate-landmask.mjs`). Live sun position drives the
day/night terminator. `OrbitControls` plus a `CameraRig` for eased reset/zoom; any manual drag cancels it.

**Layovers and economy:** a job keeps its final destination across stops; unloading away from its origin marks it `at_layover`
and it shows up on that airport's board for any aircraft to carry on. Dispatch refuses flights that would take an onboard job
further from its destination. `sim/economy.ts` has resale, finance summaries and the stuck-airline rescue (`isStuck`).

**Persistence:** `persistence/` is the only code that touches storage. `schema.ts` (version, migrations, parse), `validate.ts`
(structural checks, run on every load and import), `storage.ts` (`SaveStorage` interface; Dexie and in-memory
implementations) and `persistence.ts` (the `Persistence` controller: boot, debounced autosave, other-tab conflict detection,
corrupt-save quarantine, import/export). The sim never imports it; `FlightClock` + `advanceFlights` reconcile time.

**Deployment:** `vite.config.ts` reads `VITE_BASE` (set to `/<repo>/` by the workflow); local builds use `./`.
No router, so refreshes need no rewrite rules. The globe (Three.js) is lazy-loaded as its own chunk.

**Risks:** (1) headless CI needs software GL for e2e (flags in `playwright.config.ts`); (2) a future change to the saved shape
must bump `SCHEMA_VERSION` and add a migration, or old saves will be refused (by design) rather than corrupted.
