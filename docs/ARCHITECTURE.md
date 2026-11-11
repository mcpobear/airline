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

**Globe:** a textured sphere painted from a pre-generated land mask (`scripts/generate-landmask.mjs`); the `faceted`
style instead uses a flat-shaded vertex-coloured icosphere, geometry built once and memoised. Most styles light the
hemisphere facing the camera rather than the true sub-solar point, so the player's network is never half in darkness;
`faceted` keeps the real day/night terminator. `OrbitControls` plus a `CameraRig` for eased reset/zoom; any manual
drag cancels it.

**Layovers and economy:** a job keeps its final destination across stops; unloading away from its origin marks it `at_layover`
and it shows up on that airport's board for any aircraft to carry on. Dispatch refuses flights that would take an onboard job
further from its destination. `sim/economy.ts` has resale, finance summaries and the stuck-airline rescue (`isStuck`).

**Persistence:** `persistence/` is the only code that touches storage. `schema.ts` (version, migrations, parse), `validate.ts`
(structural checks, run on every load and import), `storage.ts` (`SaveStorage` interface; Dexie and in-memory
implementations) and `persistence.ts` (the `Persistence` controller: boot, debounced autosave, other-tab conflict detection,
corrupt-save quarantine, import/export). The sim never imports it; `FlightClock` + `advanceFlights` reconcile time.

**World imagery (`src/world/`):** `worldTexture.ts` paints the whole planet once into an RGBA buffer from the
4096x2048 land mask: bilinear landness, a small blur for an antialiased coastline, a wide blur for the continental
shelf, then biome colour, relief shading, the drawn coast and an optional graticule. The result is equirectangular,
which is exactly what a sphere's default UVs expect, so it uploads straight onto the globe (offset a quarter turn,
because `SphereGeometry` starts its UVs on the -X axis). `palettes.ts` holds the styles: each is a `WorldPalette`
(sea, land, coast, relief, shelf, graticule) plus a `GlobeLighting` (key light, whether it follows the camera, fill,
atmosphere, background, stars). Adding a look means adding a palette, not touching the renderer. The chosen style
lives in `uiStore` and browser storage, not in the save.

Painting at full size is eight million pixels and several seconds, far too long to hold up the first frame, so
`paintWorker.ts` does it off the main thread and transfers the bytes back. `GlobeCanvas` asks for a 1024x512 pass
first, which lands in well under a second, then swaps in the full one when it arrives; a phone skips the full pass
and keeps half size, where the globe is a third of the size on screen anyway. The two states need distinct
materials (hence the `key`): left to reuse one, the renderer keeps the placeholder's ocean tint multiplying the
finished map and never recompiles the shader to sample it.

**Aircraft shapes:** `globe/aircraftGeometry.ts` builds a low-poly airliner per `visualCategory` from real-ish
proportions (span, sweep, engine count and position), normalised to length 1. Both renderers use the same geometry:
seen from above on the flat map it reads as a top-down silhouette, and in 3D on the globe as a model.

**Job board cycle:** jobs have no deadline, but each airport's *waiting* offers are replaced on a fixed cycle
(`refreshJobsIfDue`). The cycle number is derived from `jobEpoch` and the clock rather than counted by a timer, so it
is correct after any absence and only ever regenerates once. Loaded, in-flight and layover jobs are untouched.

**Audio:** `audio/score.ts` is the arrangement as pure data (chords, bass, melody, brushes per bar, deterministic from
the bar number) and is unit-tested without a browser; `audio/LoungeEngine.ts` renders it through Web Audio with a
lookahead scheduler. It accepts any `BaseAudioContext`, so the output can be rendered offline and measured.

**Deployment:** `vite.config.ts` reads `VITE_BASE` (set to `/<repo>/` by the workflow); local builds use `./`.
No router, so refreshes need no rewrite rules. The globe (Three.js) is lazy-loaded as its own chunk.

**Risks:** (1) headless CI needs software GL for e2e (flags in `playwright.config.ts`); (2) a future change to the saved shape
must bump `SCHEMA_VERSION` and add a migration, or old saves will be refused (by design) rather than corrupted.

**Land mask (`scripts/generate-landmask.mjs`):** a 4096x2048 bitmap sampled from Natural Earth 10m land (with the
50m land filling in Antarctica below 85.2 S, where the 10m data stops), committed as base64 so there is nothing to
fetch at runtime. It ships run-length encoded, which at this size is about a fifth of the raw bitmap - 72 kB against
341 kB for the 2048x1024 bitmap it replaces, at four times the resolution. It matches the world texture pixel for pixel, so every painted
pixel gets a real sample rather than a blurred upscale of a coarser grid. Point-in-polygon testing two million cells
would take hours, so each row is filled by scanline: intersect the row's line of latitude with every ring edge, then
fill between the crossings. Three things make that correct rather than merely fast. Edges that straddle the date
line are unwrapped before interpolating, or their crossing lands in the middle of the Pacific. A row is a circle,
not a line: land spanning the date line means a row need not begin in the ocean, and where it does both of that
ring's seam crossings report at -180, so starting from the left edge cancels them against each other and inverts
every row through Chukotka or Antarctica. And the probe that settles which arcs are land is taken against the 50m
land rather than the 10m, because d3's spherical containment test answers "land" everywhere on the 10m data - one
probe per row, in the middle of the widest arc, which is open ocean or continental interior where the two sources
cannot disagree.

Each of those was a real bug, and each painted either a stripe of phantom land across the Arctic ocean or a world
that was 71% land. So the generator refuses to write a mask it cannot vouch for: it spot-checks 3000 points against
the 50m polygons (allowing only disagreements that have a matching cell within two pixels, since two sources drawn
at different scales put a coastline in slightly different places), looks for a row whose land cover jumps by more
than a third against its neighbour, and rejects a total land cover outside 20-45%.

**Layout:** the HUD, the section panel, the context panel and the navigation all float over the map, so their
positions have to agree without overlapping. The HUD is as tall as its contents - the stat cards wrap as the window
narrows - so it measures itself and publishes `--hud-h`; `--nav-h` is set by media query for the bottom bar that
replaces the left rail on a phone. Everything that floats hangs off `--panel-top` / `--panel-bottom` derived from
those two, so nothing can be left covering anything else at a size nobody tried. On a phone the panels fill the
width, the HUD's stats scroll sideways instead of wrapping, and tapping the open section's tab puts its panel away
to reveal the map.

Anything that floats over the whole screen rather than inside a panel - the opening hint, the camera buttons - has
to stand aside on a phone, where a panel or a context sheet already covers the map. Both check `useCompact` and
hide while one is showing; on a desktop there is room for all of them at once and they stay. The phone end-to-end
test asserts no section can scroll the document sideways, which is the failure that leaves a control off the edge
with no way to reach it.
