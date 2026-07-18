# CLAUDE.md

Guidance for working in this repo.

## What this is

A **TypeScript** mod for [Subway Builder](https://www.subwaybuilder.com) (tested
against game 1.4.10) that automates line building: **extend** an existing line
along its corridor, or create a **new line** from stations that have none — with
demand-based trains. Authored as a small **DDD** codebase under `src/` and
**bundled by esbuild into one IIFE** (`dist/index.js`) — the single file the game
loads. React comes from the host at runtime (never bundled).

## Layout

- `src/` — the mod, in TypeScript. **`main.tsx` is the entry** (composition root).
  Layers: `domain/` (pure logic over typed `GameState`), `application/` (use cases),
  `infrastructure/` (the only code that touches `window`/store/React),
  `presentation/` (the `.tsx` panel), `shared/game/` (typed game contracts).
- `src/manifest.json` — mod metadata; `main` is `index.js` (the built bundle).
- `dist/index.js` — esbuild output (gitignored); the file `install-mod` copies.
- `scripts/build.mjs` — esbuild bundle to a single IIFE (host React external).
- `scripts/package-release.mjs` — the two assets a Railyard release needs.
- `scripts/install-mod.mjs`, `debug.mjs`, `cdp-eval.mjs` — dev workflow (Node, macOS).
- `tests/` — vitest + jsdom, mirroring `src/` (90% coverage floor).
- `tsconfig.json` — TypeScript type-check config (`tsc --noEmit`; esbuild does the
  emit). `eslint.config.mjs` — flat-config ESLint 9 (adapted from
  `roquerodrigo/nextjs-boilerplate`, minus the Next presets): typescript-eslint
  (type-aware), @stylistic, perfectionist, jsx-a11y, react-hooks.
- `docs/game-internals.md` — **the reverse-engineered game internals this mod
  depends on** (store, routes, trackGraph, crossovers, trains, demand, UI). Read
  this first; it's the knowledge that's expensive to rediscover. The store/route/
  train shapes are typed in `src/shared/game/`.
- `docs/inspecting-the-game.md` — how to inspect/drive the live game over CDP.
- `package.json` — npm scripts (`build`, `typecheck`, `lint`/`lint:fix`,
  `install-mod`, `debug`, `inspect`, `play`).

**TypeScript version**: pinned to **5.9** — not 7. TS 7 (the native Go port) ships
no JS compiler API, so typescript-eslint (which needs it to parse `.ts`) can't run
against it. 5.9 type-checks the same source and keeps the linter working.

**Imports use the `@/*` alias for anything under `src/`** (`@/domain/line/Corridor`),
never `../../`. Declared once in `tsconfig.json` (`paths`), which esbuild reads on its
own; vite doesn't, so `vitest.config.ts` mirrors it in `resolve.alias`. The alias is
compile-time only — it's gone from `dist/index.js`.

## Commits & releases

**Commits follow [Conventional Commits](https://www.conventionalcommits.org)** —
release-please parses the subject to decide the next version, so an unprefixed commit
is invisible to it. Keep the prose style; just prefix the subject: `feat:` (minor),
`fix:` (patch), `docs:`/`refactor:`/`ci:`/`chore:` (no release).

`.github/workflows/release.yml` runs release-please on every push to main, where it
grooms a release PR; merging that PR bumps the version, writes `CHANGELOG.md`, tags,
and attaches the Railyard assets. Versions stay in step across `package.json`,
`src/manifest.json` (via `extra-files`) and `.release-please-manifest.json` — never
bump them by hand. The `0.0.0` baseline means "nothing released yet", so the first
release is exactly **1.0.0**.

> `include-component-in-tag: false` is load-bearing: the default prefixes tags with the
> package name, and the registry only accepts `X.Y.Z` or `vX.Y.Z`. The repo also needs
> **"Allow GitHub Actions to create and approve pull requests"** switched on, or
> release-please can't open its PR — that's separate from the workflow's own
> `permissions:` block.

## Publishing to Railyard

`npm run package` writes the two assets a release needs to `dist/release/`: the flat
ZIP (`index.js` + `manifest.json` at the archive root — the installer looks for the
manifest there and won't strip a wrapping folder) and the **standalone
`manifest.json`**, which the registry reads to check compatibility without pulling the
ZIP. A release missing either asset is rejected.

> ### ⚠️ `manifest.json`'s `id` must equal the Railyard mod id — **not** the game's template style
> The registry validates `manifest.id === <Railyard mod id>` (kebab-case, permanent,
> `auto-lines` here) and rejects the reverse-DNS id (`com.author.modname`) that the
> official `template-mod` still ships. Railyard also installs the mod into
> `<mods>/<id>/`, so the id doubles as the folder name. Already-listed mods predating
> the rule are grandfathered — don't copy their manifests.

The manifest must also carry `dependencies` with a `subway-builder` semver range
(`<=1.4.12`); it's required, and `npm run package` refuses to build the assets when the
manifest would fail the registry's checks. Submission is an issue form (**Publish New
Mod**) on `Subway-Builder-Modded/registry`.

## How it hooks in

The public API has no routes/track/train surface, so the mod uses the **internal
store** `window.__subwayBuilder_storeCallbacks__.getState()` for all the line/track/
train work, and the **public UI API** for its window: `api.ui.addFloatingPanel`
gives a native toolbar button + a draggable, resizable game-styled window, whose
content is a React component (`api.utils.React`, hooks work). We use
`addFloatingPanel`, **not** `addToolbarPanel` — the latter opens a full-screen
`fixed inset-0` modal backdrop that swallows the map's wheel/drag events (you
couldn't pan or zoom with the panel open); the floating window is
`pointer-events-auto` on **only** its own bounded rect, so the map stays
interactive underneath. The game rebuilds the top bar during city load — wiping a
registration done at mod-load time — so the panel is **re-registered on the
lifecycle hooks** (`onGameInit`/`onCityLoad`/`onMapReady`), unregister-first so it
stays a single button. It disables itself with a console error if the store handle
is missing. Full details: `docs/game-internals.md`.

## Code map (`src/`)

**`domain/`** — pure logic over a typed `GameState` snapshot; no `window`, no side
effects. Unit-testable with fixtures.
- `network/CoordinateKey.ts` — `detectCoordinateKey(state)` auto-detects the
  trackGraph key format (3 variants across game versions).
- `network/StationIndex.ts` — `StationIndex.build(state)`: `nodeById/nodeByCoord/
  stationOfNode/stationById` **plus a bound `coordKey`** (no mutable global).
- `network/TrackNetwork.ts` — `adjacentStationNodeIds`, `neighborStationNodes`,
  `distance`. The graph adjacency queries every planner uses.
- `network/BranchExplorer.ts` — `leafPaths(root, neighborsOf, blocked)`: spanning
  BFS that splits the region past a junction into one path per **end of the tracks**
  (leaf). Shared by both fork flows (extend + new line) so a fork follows each branch
  to its terminus instead of stopping at the junction.
- `line/LineExpansionPlanner.ts` → `ExpansionPlan` (`endpoints`; `additionIds`,
  `hasAction`). At a fork it offers one `ForkOption` per branch-to-terminus (full
  path + its `applyNodeIds`). `line/Corridor.ts` — `order` (whole-line DFS) +
  `longest` (stops at bifurcations/dead-ends).
- `newline/OrphanGroupFinder.ts` → `OrphanGroup` (station-less components ≥2, with
  terminal names). `newline/NewLinePlanner.ts` — `corridor` (longest degree-2 path +
  the **forks** the user can continue into at each junction endpoint), `effectivePath`
  (base + chosen branches), `addIds` (clean add-node ids: `edgePair` bootstrap +
  middles both + far end single → **no 3× corruption**).
  `newline/BulletSequence.ts` — next sequential numeric bullet.
- `crossover/TerminusCrossoverFactory.ts` — geometry only: builds a scissors-
  crossover Track (or null if already linked).
- `fleet/DemandPeriod.ts` (hour→tier, 4 tiers), `fleet/ServiceSchedule.ts` (cycle→5/10/15/30-min
  counts), `fleet/CarInventoryPolicy.ts` (`peakCars`, `requiredCars`).

**`application/`** — use cases orchestrating domain + infra.
- `ExtendLineUseCase`, `PreviewNewLineUseCase`, `CreateNewLineUseCase`,
  `ProvisionServiceUseCase` (schedule + car inventory + spawn),
  `DiscardNewLinePreviewUseCase`.

**`infrastructure/`** — the only code that touches `window`/store/React.
- `store/GameStore.ts` — the typed `getState()` handle (old `G()`); always a fresh
  snapshot.
- `routing/RouteEditGuard.ts` (fiber-walk `setUserAction`), `RoutePreviewEditor.ts`
  (`applyAdditions` — **incremental one-node-at-a-time** preview flow),
  `RouteMaintenance.ts` (`purgeOrphanTrains` + `stripTempRoutes`).
- `crossover/CrossoverInjector.ts` (`setTracks`, `regenStations:false`),
  `fleet/FleetProvisioner.ts` (`ensureCarInventory` via `buyTrains`+money-refund;
  spawn), `game/TrainTypeCatalog.ts` (`getTrainType` stats + fallback).
- `ui/react.ts` (defensive host-React shim: `h`/`Fragment`/hooks),
  `ui/FloatingPanelRegistrar.ts` (`addFloatingPanel` + lifecycle re-register).

**`presentation/`** — the React panel (function components; hooks required).
`AutoLinesPanel.tsx` (a factory `createAutoLinesPanel(deps)` — one component drives
both tabs) + `components/` (`TabBar`, `Select`, `StationList`+`buildDisplay`,
`ForkSelector`), `view/` (`ExtendTab`, `NewLineTab`), `hooks/` (`useExtendPlan`
memoised on `[mode,sel,refreshKey]` for fork-identity stability; `useNewLinePreview`
async build whose **cleanup discards the uncommitted preview** on switch/close).

**`main.tsx`** — composition root: guards `SubwayBuilderAPI`/store, wires deps,
registers the panel.

Terminus crossovers: game 1.4.0–1.4.2 auto-placed scissors-crossovers, but **1.4.10
gates auto-placement behind a Settings toggle ("Auto Crossover") that ships OFF**,
leaving fresh stations with no turnaround edge (route build fails "No valid path").
`TerminusCrossoverFactory` + `CrossoverInjector` fabricate them; injection is a
no-op where one already exists (dedup by far-end linkage). See game-internals.md §7.

Cars are the real budget: the game gates "add a train" / "increase cars per train"
on `ownedCarsByType[type]`, not the train cap. `FleetProvisioner.ensureCarInventory`
grants enough via `buyTrains(delta, type)` (raises cars **and** cap together) with
the money refunded, so it stays free. See game-internals.md §8.

## Workflow — ALWAYS verify live

Everything here was built by driving the running game over CDP; the internals are
undocumented, so **don't trust a change until you've run it live**.

> ### ⚠️ Quitting the game pops a blocking "save progress?" dialog — kill it, don't `quit`
> A graceful quit (`osascript -e 'quit app "Subway Builder"'`, which is also what
> `npm run debug` runs internally before relaunching) makes the game show a native
> **"Save progress?" confirmation dialog that blocks the quit**. Over CDP you can't
> see it, so the old instance **stays alive**; the next `npm run debug` then launches
> a **second** instance. Two instances fight over the CDP port and the autosave file,
> which shows up as bogus, hard-to-explain symptoms: `[Window] Window closed event`,
> routes/lines silently vanishing between relaunches, previews that build to 0
> stNodes, CDP driving one instance while the DOM you read is the other. **If a live
> test suddenly behaves impossibly, suspect a stray second instance first.**
>
> Before every launch, **force-kill all instances** (no dialog) and confirm none
> remain, then launch exactly one:
> ```bash
> pkill -9 -f "Subway Builder.app/Contents/MacOS" ; sleep 2
> pgrep -fl "Subway Builder.app/Contents/MacOS"   # must print nothing
> npm run debug
> ```
> `pkill -9` skips the app's quit handler entirely, so no save dialog — you lose only
> changes since the last autosave, which for a scratch dev session is fine.

```bash
npm run build                                   # esbuild → dist/index.js
npm run typecheck                               # tsc --noEmit (strict; covers tests/ too)
npm run lint                                    # eslint . (npm run lint:fix to auto-fix)
npm test                                        # vitest run
npm run test:coverage                           # vitest + v8 coverage (fails under 90%)
npm run package                                 # the two Railyard release assets
npm run debug                                   # launches game + CDP :9222
node scripts/cdp-eval.mjs '<expr>'              # read state
node scripts/cdp-eval.mjs --file <snippet.js>   # async IIFE (drive the panel, build lines)
```

**Tests** live in `tests/`, mirroring `src/`, on **vitest + jsdom**, with a 90% coverage
floor enforced in `vitest.config.ts` and in CI. They never touch the game: the game
surfaces are faked. Two things make the setup non-obvious — React is read off the host
at module-init, so `tests/setup.ts` installs it *before* any mod module is imported;
and vitest transforms with **oxc**, not esbuild, so the JSX pragma lives under `oxc:`
in the config (esbuild options there are silently ignored). Tests do not replace
verifying live: this mod edits real routes, and only the game tells you if that worked.
Typical loop: edit `src/**/*.ts(x)` → **`npm run build`** → re-inject the bundle
with `node scripts/cdp-eval.mjs --file dist/index.js` → drive the panel and read
`getState().routes` to verify (`stComboTimings.length > 0`, clean node
distribution, trains, no orphans, no console errors). The re-inject re-runs the
IIFE (`registrar.register()`, unregister-first), so the toolbar button updates in
place. `npm run install-mod` builds **and** copies into the game for a fresh boot.
Run `npm run typecheck` before trusting a build — esbuild strips types without
checking them.

The native panel button registers under uiComponents location **`top-bar`** and
renders as a `<div title="Auto Lines">` in the mods strip (NOT a `<button>` — query
by `[title]`). The panel's action button is the `w-full` one; the active tab also
carries `bg-primary`, so don't match the action button by color alone. A clean
reload (`location.reload()` over CDP) is the truest test — it exercises the
lifecycle-hook re-registration that survives the city-load top-bar wipe.

## Pitfalls (see docs/game-internals.md §6)

- **Never delete routes with `setRoutes([])`** — it orphans trains →
  `[GameLoop] Tick error: Route not found for train …`. Use `deleteRoute(id)` or
  `resetTrains()`; purge orphans with
  `setTrains(trains.filter(t => routeIds.has(t.routeId)))`.
- **Removing a station from a line leaves a `tempParentId` temp route and moves
  the train onto it** — so `stripTempRoutes` orphans that train. Always
  `purgeOrphanTrains()` after dropping routes (the mod does, in `stripTempRoutes`).
- `trackGraph` keys / edge `coordsString` have **changed format three times**:
  `"S"+lng+lat` (1.0), `lng+"-"+lat` (1.4.2), back to `"S"+lng+lat` (1.4.10).
  The coord key must match exactly or every adjacency lookup returns empty — so
  `StationIndex.build` **auto-detects** the format against the live graph
  (`detectCoordinateKey`) and exposes a **bound `coordKey` on the index** (no
  mutable module global) instead of hardcoding it.
- The game **autosaves** — never leave it in a broken state (empty routes, orphaned
  trains). Clean up after live tests.
- `setTracks` regenerates the whole trackGraph; pass `regenStations:false`.
- An empty route only bootstraps **incrementally** (add nodes one at a time).

## Paths & env overrides

- Game data dir: `SB_DATA_DIR` || `~/Library/Application Support/metro-maker4`.
- App bundle: `SB_APP` || `/Applications/Subway Builder.app`.
- CDP port: `SB_DEBUG_PORT` || `9222`.

## Notes

- Scripts assume macOS (`osascript`, app-bundle layout, app-support path).
- Conventions mirror the sibling project `subway-builder-better-station-names`.
