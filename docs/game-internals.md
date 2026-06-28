# Subway Builder — game internals (reverse-engineered)

Everything this mod relies on that is **not** in the public modding API. All of it
was discovered by inspecting the running renderer over CDP (see
[`inspecting-the-game.md`](inspecting-the-game.md)) and reading the obfuscated
bundle. Treat it as version-specific (found on app 1.3.0 / API v1.0.0); verify
with live probes before trusting it in a new version.

---

## 1. The internal store

`window.__subwayBuilder_storeCallbacks__.getState()` — a zustand-style store. The
**single most important handle** in this mod. The app invokes its action functions
through this same object, so wrapping/calling them intercepts/drives the game.

Other globals: `window.__uiState__` (only `{selectedTrackType}`), `window.electronAPI`
(`loadDataFile, getDataServerPort, buildBlueprints, findRoutePathOrder, submitDailyChallenge`).

### State (read)
`stations, stationsMap, stNodes, routes, tracks, trackGroups, trackGraph, signals,
intersections, trains, ownedTrainCount, ownedCarsByType, timeConfig, demandData,
previewRoute, pendingStNodeChanges, money, gameMode, cityCode, …`

### Actions (call)
`setStations, setStNodes, setRoutes, setTracks, setTrains, setSignals,
generateRoute, generateTrain, spawnTrainAtStation, buyTrains, setOwnedTrainCount,
resetTrains, setPreviewRoute, setManualRouteOrdering, changePreviewRoute,
batchPreviewRouteUpdates, confirmRouteChange, clearPendingStNodeChanges,
updateRouteProperty, deleteRoute, calculatePaths, simulateCommutes,
recalculateAllRouteGeojsons, togglePause, …`

---

## 2. Stations & stNodes (the two-platform model)

- **A station has TWO `stNodes`** = its two platforms / faixas (directions).
  `station.stNodeIds = [a, b]`.
- `stNode = { id, center:[lng,lat], trackIds:["<uuid>@@1","<uuid>@@2"], buildType }`.
- `station = { id, name, coords, trackIds, trackGroupId, buildType, stNodeIds,
  routeIds, stationType, createdAt, maxCars, nearbyStations }`.
- **Orphan station** = `routeIds` empty → not served by any line.
- `state.stNodes` is the master pool; you can only add an stNode id to a route if
  it exists there.

---

## 3. Connectivity — `trackGraph`

- `state.trackGraph` is a **`Map<coordKey, edge[]>`**.
- **The coordKey format has changed three times across versions:**
  - `"S" + lng + lat` — game 1.0 (e.g. `"S-46.631768-23.482519"`)
  - `lng + "-" + lat` — game 1.4.2 (`"S"` prefix dropped)
  - `"S" + lng + lat` — game **1.4.10** (reverted to the 1.0 format)

  Build it from `stNode.center`. Matching the game's format exactly is mandatory
  or every adjacency lookup silently returns empty. Because the format is
  unstable, the mod **detects it at runtime** (`detectCoordKeyFmt` in `buildIndex`)
  by probing candidate formats against live `trackGraph.has(...)`, rather than
  hardcoding one.
- `edge = { trackId, trackLength, coordsString /* neighbor coordKey */, trackIsReversed }`.
- The graph is built from **tracks**; a track yields a reverse edge **only if
  `track.reversable`**.
- **Station adjacency**: BFS from a node's `coordKey` through the graph, treating a
  vertex as a station node iff some `stNode.center` maps to it; stop at the first
  station node on each branch. (This mod's `adjacentStationNodeIds`.)

---

## 4. Tracks & trackGroups

- `track = { id, coords:[[lng,lat]…], buildType, displayType, type, reversable,
  interactable, length, startElevation, endElevation, trackType, createdAt,
  curveType?, waterIntersectionPercentage }`.
- Running/platform tracks have ids `"<uuid>@@1"` / `"@@2"` (two directional halves);
  `type:"station"` for platforms, `null` for plain running track.
- `trackGroup = { id, trackIds, trackLanesType, centerLine, type, trackType }`;
  `type ∈ { "station", "scissors-crossover", null }`.

---

## 5. Routes

`route = { id, bullet, stNodes, stCombos, stComboTimings, tempParentId, color,
textColor, idealTrainCount, shape, trainType, carsPerTrain, createdAt, trainSchedule }`.

- **Closed loop**: `stNodes[0].id === stNodes[last].id`. `confirmRouteChange`
  hard-requires it. The sequence lists the out-and-back, so intermediate stations
  appear **twice** and the apex terminus **once**. Clean distributions are
  `{1:1, 2:N}` (one single apex) or `{1:2, 2:N}` (two single termini). A station
  appearing **3×** is corruption (the path solver closed the loop two ways — e.g.
  reused a cycle edge or doubled a terminus).
- `stCombo = { startStNodeId, endStNodeId, path:[{trackId, reversed, length, signals}], distance }`.
- `stComboTimings`: per-node timing; **`stComboTimings[last].departureTime` = full
  round-trip (cycle) seconds**.
- `bullet` is auto-assigned **letters** by `generateRoute` (it **ignores
  `customBullet`**). To force a value, replace the route via `setRoutes`:
  `setRoutes(routes.map(r => r.id===id ? {...r, bullet} : r), false)`.
- `idealTrainCount` is legacy/hint (default 0); the live train target is computed
  from `trainSchedule` (§8).
- Preview/temp routes have `tempParentId != null`.

### Building / editing a route (the route builders are module-private)
1. `generateRoute({})` → adds an **empty** route to `state.routes` (auto letter bullet).
2. `setPreviewRoute({...route})` → enter edit mode (pauses the game).
3. `setManualRouteOrdering(false)` → order via `electronAPI.findRoutePathOrder`.
4. `changePreviewRoute({ stNodeId, action:"add"|"remove" })` → queues to
   `pendingStNodeChanges`. Only ids present in `state.stNodes` are honoured.
5. `await batchPreviewRouteUpdates()` → **async**. Orders the nodes, builds
   `stCombos` (module-private `generateStCombo` → `getPathBetweenStNodes` BFS), and
   `stComboTimings` (`estimateRouteTimes` simulates a train).
6. `confirmRouteChange()` → commits (remaps trains, invalidates pop movements).
   Has a license gate that silently no-ops when unlicensed — **this install is
   licensed** (commits work). Check the route actually changed.

**Gotchas**
- `batchPreviewRouteUpdates` throws **"No valid path found between station tracks"**
  if any consecutive pair (incl. the terminus turnaround) can't be pathed — usually
  a **missing crossover** (§7).
- An **empty route bootstraps only incrementally**: add nodes one-at-a-time and keep
  each if the preview grew. An all-at-once dump of many nodes makes
  `findRoutePathOrder` fail.
- `setRoutes(routes, full)`: `full=true` rebuilds route geojsons + station↔route
  mapping; `false` = cheap write.

---

## 6. ⚠️ Deleting routes & trains (pitfall)

- **Do NOT delete routes with `setRoutes(filteredList, …)`** — it drops the route
  objects but **leaves their trains orphaned**, causing per-tick
  `[GameLoop] Tick error: Route not found for train …`.
- Use **`deleteRoute(id)`** (removes the route *and* its trains) or **`resetTrains()`**
  (clears all trains). To purge only orphans:
  `setTrains(trains.filter(t => routeIdSet.has(t.routeId)))`.
- **Removing a station from a line spawns a temp route + reparents the train.**
  When the player (or the preview `action:"remove"` flow) drops a stop, the game
  leaves a `tempParentId`-tagged fragment route **and moves the line's train onto
  that temp route**. So `stripTempRoutes` (which drops `tempParentId` routes) then
  orphans that train → `Route not found`. Always **`purgeOrphanTrains()` right
  after dropping routes** (this mod does so inside `stripTempRoutes` and on panel
  entry). The game auto-respawns to the schedule, so a purged train is replaced.
- The game **autosaves** — any broken/half-built state (empty ghost routes,
  orphaned trains, partial lines) gets persisted. Never leave the game broken.
- An uncommitted `generateRoute` route (0 stNodes) can be autosaved as a ghost;
  strip routes with 0 `stNodes`.

---

## 7. Crossovers (terminus turnaround)

Without a crossover at a terminus a train can't switch from the inbound to the
outbound track, so the route's turnaround path fails ("No valid path…").

> **Crossover auto-placement is version-dependent — and the mod fabricates its
> own again as of 1.4.10:**
> - Game **1.4.0–1.4.2** auto-placed scissors-crossovers while a station was drawn
>   (changelog 1.4.0: "Automatic crossover placement during station drawing").
>   Verified live in 1.4.2: every station carried crossovers, so the mod dropped
>   its `terminusCrossoverDiag` / `ensureExtensionCrossovers` code.
> - Game **1.4.10** turns that into a **Settings toggle, "Auto Crossover", that
>   ships OFF by default** (`settingsCache.autoCrossover`, default `false`).
>   Verified live: freshly-drawn stations carry **no** crossover trackGroups, and
>   both "Nova linha" and "Estender" fail with "No valid path found between station
>   tracks" at the turnaround. Injecting a reversable diagonal at each terminus
>   (below) fixes it — confirmed live (route builds, `stComboTimings` populated,
>   trains spawn, no orphans, clean `{1:1, 2:N}` node distribution).
>
> So the mod **fabricates crossovers again** (`terminusCrossoverDiag`,
> `ensureExtensionCrossovers`, `injectCrossovers`), independent of the player's
> setting. Injection dedups on far-end graph linkage, so it's a no-op where a
> crossover already exists (setting on, or a station that shipped with one).

- A crossover = a `trackGroup` of `type:"scissors-crossover"` **plus diagonal
  Track objects**: plain-uuid id (no `@@`), `type:"scissors-crossover"`,
  **`reversable:true`**, `interactable:false`. A scissors X connects two parallel
  tracks: `diag1: t1.start↔t2.start`, `diag2: t1.end↔t2.end`.
- What the **pathfinder** actually needs is just a **graph edge** linking the two
  tracks — i.e. a `reversable` track whose endpoint coords **exactly** equal
  existing track endpoints. A straight 2-point diagonal is enough (bezier is
  cosmetic). The endpoints must match coord-for-coord so `coordKey` collides.
- **Fabricate + inject** (no public/`addCrossover` API; the native tool calls
  `electronAPI.buildBlueprints` in the main process):
  ```js
  store.getState().setTracks({
    newTracks: [...tracks, diag],   // diag = {id:uuid, coords:[c1,c2], type:"scissors-crossover",
                                    //         reversable:true, interactable:false, length, ...}
    regenStations: false,           // preserve stNode ids
    regenRoutesWithTrackIDs: [],
  });
  // setTracks rebuilds the whole trackGraph (+ derives stNodes, signals).
  ```
  Inject **before** the route's turnaround path is built.
- This mod's rule for a single terminus station + neighbor: take the station's two
  platform tracks, pick each one's endpoint **farthest from the neighbor** (the
  dead-end side), connect those two with a reversable diagonal. (`terminusCrossoverDiag`.)
- RMSP ships ~16 crossovers, so failures only appear at termini that lack one.

---

## 8. Trains & demand-based service

- **`trainSchedule = { highDemand, mediumDemand, lowDemand, veryLowDemand }` are
  TRAIN COUNTS** per time-of-day demand tier (NOT headways, NOT trains/hour) —
  **four** tiers, ordered `high ≥ medium ≥ low ≥ veryLow`. `veryLowDemand` is
  optional and the game reads it as `veryLowDemand ?? lowDemand`. `highDemand` is
  the peak fleet for that line.
- **Demand tier = time of day** (`HOUR_DEMAND_LEVELS`, indexed by hour 0–23), not
  ridership: **high** = 7–9 & 16–18; **medium** = 6, 10–15, 19; **low** = 3–5,
  20–22; **veryLow** = 0–2, 23. So a brand-new line needs no ridership history.
- **Headway ↔ count**: `count = round(cycleSeconds / headwaySeconds)`, where
  `cycleSeconds = route.stComboTimings[last].departureTime`. The mod uses
  **5/10/15/30-minute** headways: `round(cycle/300 | 600 | 900 | 1800)`.
- The game **auto-spawns** trains each tick (while unpaused) until each route hits
  its current-hour count, capped at `ownedTrainCount`, spacing them via
  `findOptimalSpawnStation`. So **setting `trainSchedule` is usually all you need.**
- Manual spawn: `generateTrain(routeId)` (one train at station index 0) /
  `spawnTrainAtStation(routeId, stationIndex)`. Neither decrements
  `ownedTrainCount` (it's a **cap**; starts at `RULES.STARTING_TRAIN_CARS = 30`).
  Raise the cap with `setOwnedTrainCount(n)` / `buyTrains(...)` only if needed.
- Set the schedule with `updateRouteProperty(routeId, "trainSchedule", schedule)`.

### ⚠️ Cars are the real budget — not the train cap (`ownedCarsByType`)

The binding inventory the game **charges for and gates on is CARS**
(`ownedCarsByType[trainType]`), not `ownedTrainCount`. A train uses
`route.carsPerTrain || trainType.stats.carsPerCarSet` cars; for **heavy-metro**
(the default type) `carsPerCarSet = minCars = 5`, `maxCars = 15`, `carCost = $2.7M`.
- The game computes **cars needed for a type** as `max` over demand periods of
  `Σ_routes trainSchedule[period] × carsPerTrain`. Both **"add a train to the
  schedule"** and **"increase cars per train"** are blocked when that total would
  exceed `ownedCarsByType[type]` — the latter surfaces the toast **"Not enough
  train cars to increase cars per train"** (`panels.routeDetails.notEnoughCarsToIncrease`).
- At game start `ownedTrainCount == ownedCarsByType["heavy-metro"] == 30`, and
  **`buyTrains(count, type)` raises BOTH in lockstep** (`+count` each) and charges
  `count × carCost`. `setOwnedTrainCount` raises **only the train cap** — it leaves
  the car inventory behind, breaking that invariant.
- **Mod consequence**: raising the fleet cap for free without adding cars lets the
  mod's aggressive peak schedules (a train every 5 min) run, but pins the car
  inventory at 30, so the player can't lengthen trains → the toast. `setRouteService`
  now calls **`ensureCarInventory`**: it targets the peak cars this type needs with
  the current route at `maxCars` (via the game's own formula), then reaches that via
  `buyTrains(delta, type)` **with the money refunded** (`setMoney(before)`), keeping
  it free while restoring the count/cars invariant. Verified live: cars 30→110,
  money unchanged, the increase gate clears at every length.
- `train = { id, routeId, length, cars, trainType, currentStComboInfo, motion,
  windows, timings, specs, operationalTime, operatingSchedule, stuckDetection }`.

---

## 9. UI modding API (`window.SubwayBuilderAPI`)

- Namespaces: `hooks` (22), `gameState`, `actions`, `stations`, `cities`, `ui`,
  `map`, `utils`, `storage`, `trains`, `popTiming`, `career`.
- All of `addToolbarButton`, **`addToolbarPanel`**, `addFloatingPanel`,
  `registerComponent` register into the **`"top-bar"`** uiComponents location.
  Their buttons render as **`<div title="…">`** in the mods strip (a scrollable
  `max-w-[200px] overflow-x-auto` row), **not `<button>`** — query the DOM by
  `[title]`. `icon` is a key into a curated set (e.g. `"Waypoints"`); an unknown
  icon makes the component render `null` (no button).
- Two panel variants, both with a `render` content prop (invoked as
  `React.createElement(render)`, i.e. a **real React component** — `api.utils.React`
  hooks `useState`/`useEffect`/`useMemo`/`useRef` work; closing the panel
  **unmounts** `render`, good for cleanup effects):
  - **`addToolbarPanel({ id, icon, tooltip, title, width, render })`** — a panel
    anchored top-right. ⚠️ It mounts a full-screen **`fixed inset-0 z-50` modal
    backdrop** (closes on outside-click) that **eats the map's wheel/drag events**
    — you can't pan/zoom with it open. Avoid for anything you want open while
    using the map.
  - **`addFloatingPanel({ id, icon, tooltip, title, defaultWidth, defaultHeight,
    minWidth, minHeight, render })`** — a draggable, resizable window (position/size
    persisted to `localStorage`). Its wrapper is `fixed z-50 pointer-events-auto`
    bounded to the window rect (NOT `inset-0`), so **the map stays interactive**.
    `render` gets `{ width, height }` props. **This mod uses this one.**
- ⚠️ **Registration timing**: a panel/button registered at mod-load time is **wiped
  when the game rebuilds the top bar during city load**. Re-register on the
  lifecycle hooks (`onGameInit`/`onCityLoad`/`onMapReady`). `addToolbarPanel` doesn't
  dedupe (`addFloatingPanel` replaces by id), so `unregisterComponent("top-bar", id)`
  first → exactly one button. (An earlier game version didn't render these reliably;
  in 1.4.2 they work.) Note: a renderer-only `location.reload()` can serve a **cached**
  mod bundle — a full app relaunch is the truest fresh-load test.
- `api.utils.components` are generic primitives only (Button, Card, Badge, Tooltip,
  Input, Select…) — **no** domain components (no route-details/station-list); style
  with the game's Tailwind tokens (`bg-primary`, `border-border`, `text-muted-foreground`).
- `api.gameState`: `getStations, getRoutes, getTracks, getTrains, getDemandData,
  getRouteRidership, getStationRidership, getLineMetrics, getStationGroups, …`
  (read-only; new lines report 0 ridership).
- `api.hooks`: `onStationBuilt, onBlueprintPlaced, onTrackBuilt, onCityLoad,
  onGameInit, …`. Note `onBlueprintPlaced` fires **before** the new station is in
  the store.
