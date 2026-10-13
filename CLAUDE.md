# CLAUDE.md

A [Subway Builder](https://www.subwaybuilder.com) mod (tested against game 1.6.0),
**bundled by esbuild into one IIFE** (`dist/index.js`) — the single file the game loads.
React comes from the host at runtime (never bundled). **`main.tsx` is the composition
root; `infrastructure/` is the ONLY code allowed to touch `window`/store/React**.

**Read `docs/game-internals.md` first** — the reverse-engineered game internals this mod
depends on (store, routes, trackGraph, crossovers, trains, demand, UI); that knowledge is
expensive to rediscover, and the store/route/train shapes are typed in `src/shared/game/`.
`docs/inspecting-the-game.md` covers driving the live game over CDP.

**TypeScript version**: pinned to **5.9** — not 7. TS 7 (the native Go port) ships no JS
compiler API, so typescript-eslint (which needs it to parse `.ts`) can't run against it.
5.9 type-checks the same source and keeps the linter working.

**Imports use the `@/*` alias for anything under `src/`** (`@/domain/line/Corridor`),
never `../../`. Declared once in `tsconfig.json` (`paths`), which esbuild reads on its
own; vite doesn't, so `vitest.config.ts` mirrors it in `resolve.alias`. The alias is
compile-time only — it's gone from `dist/index.js`.

## Commits & releases

**Commits follow [Conventional Commits](https://www.conventionalcommits.org)** —
release-please parses the subject to decide the next version, so an unprefixed commit is
invisible to it. Keep the prose style; just prefix the subject: `feat:` (minor), any other
type — `fix:`, `chore:`, `docs:`, `refactor:`, `ci:`, … — (patch). Every type is
releasable here on purpose — `release-please-config.json` lists them all under
`changelog-sections` (none hidden), so a lone `chore:` such as a compatibility bump, or a
lone `docs:`, still cuts a patch release instead of being dropped.

`.github/workflows/release.yml` runs release-please on every push to main, where it grooms
a release PR; merging that PR bumps the version, writes `CHANGELOG.md`, tags, and attaches
the Railyard assets. Versions stay in step across `package.json`, `src/manifest.json` (via
`extra-files`) and `.release-please-manifest.json` — never bump them by hand.

> `include-component-in-tag: false` is load-bearing: the default prefixes tags with the
> package name, and the registry only accepts `X.Y.Z` or `vX.Y.Z`. The repo also needs
> **"Allow GitHub Actions to create and approve pull requests"** switched on, or
> release-please can't open its PR — that's separate from the workflow's own
> `permissions:` block.

## Publishing to Railyard

`npm run package` writes the two assets a release needs to `dist/release/`: the flat ZIP
(`index.js` + `manifest.json` at the archive root — the installer looks for the manifest
there and won't strip a wrapping folder) and the **standalone `manifest.json`**, which the
registry reads to check compatibility without pulling the ZIP. A release missing either
asset is rejected.

> ### ⚠️ `manifest.json`'s `id` must equal the Railyard mod id — **not** the game's template style
> The registry validates `manifest.id === <Railyard mod id>` (kebab-case, permanent,
> `auto-lines` here) and rejects the reverse-DNS id (`com.author.modname`) that the
> official `template-mod` still ships. Railyard also installs the mod into
> `<mods>/<id>/`, so the id doubles as the folder name. Already-listed mods predating
> the rule are grandfathered — don't copy their manifests.

The manifest must also carry `dependencies` with a `subway-builder` semver range (it's
required); `npm run package` refuses to build the assets when the manifest would fail
the registry's checks. Submission is an issue form (**Publish New Mod**) on
`Subway-Builder-Modded/registry`.

## How it hooks in

The public API has no routes/track/train surface, so the mod uses the **internal store**
`window.__subwayBuilder_storeCallbacks__.getState()` for all the line/track/train work,
and the **public UI API** for its window. We use `api.ui.addFloatingPanel`, **not**
`addToolbarPanel` — the latter opens a full-screen `fixed inset-0` modal backdrop that
swallows the map's wheel/drag events (you couldn't pan or zoom with the panel open); the
floating window is `pointer-events-auto` on **only** its own bounded rect, so the map
stays interactive underneath. The game rebuilds the top bar during city load — wiping a
registration done at mod-load time — so the panel is **re-registered on the lifecycle
hooks** (`onGameInit`/`onCityLoad`/`onMapReady`), unregister-first so it stays a single
button. It disables itself with a console error if the store handle is missing.

## Crossovers & fleet

Terminus crossovers: game 1.4.0–1.4.2 auto-placed scissors-crossovers, but **1.4.10 gates
auto-placement behind a Settings toggle ("Auto Crossover") that ships OFF**, leaving fresh
stations with no turnaround edge (route build fails "No valid path").
`TerminusCrossoverFactory` + `CrossoverInjector` fabricate them; injection is a no-op
where one already exists (dedup by far-end linkage). See game-internals.md §7.

> ### ⚠️ Every track needs a **trackGroup** that owns it, or the line dies on the next load
> Loading a save runs `removeOrphanTracks` first: a track no group lists is deleted,
> and `validateRoutesAndTrains` then drops every route that ran over it, trains and
> all. So `TerminusCrossoverFactory` returns a `TerminusCrossover` — the diagonal
> **and** the `TrackGroupFactory.own` group — and `CrossoverInjector` passes both
> (`newTracks` + `newTrackGroups`). `OrphanTrackRescue`, installed on the store's
> `loadSave` at bootstrap, repairs saves already broken this way: the tracks are
> still in the file, so adopting the unowned ones into groups on the way in brings
> the vanished lines back. See game-internals.md §4/§7.

Cars are the real budget: the game gates "add a train" / "increase cars per train" on
`ownedCarsByType[type]`, not the train cap. `FleetProvisioner.ensureCarInventory` grants
enough via `buyTrains(delta, type)` (raises cars **and** cap together) with the money
refunded, so it stays free. The cap is topped up separately by `ensureTrainCapacity`
(`FleetCapacityPolicy`), because spawning stops dead at `ownedTrainCount` and a save whose
cap fell behind the car stock would silently starve the schedules — it is a cap, not a
purchase, so granting it costs nothing. See game-internals.md §8.

A line the mod builds runs **full ten-car trains** (`TrainLength`, capped at the type's
`maxCars`) on a **5/15/30/60-min** peak/midday/off-peak/night schedule
(`ServiceSchedule`). `setTrainLength` runs **before** the schedule is derived, and the
cycle is read back afterwards: a longer train dwells longer at every stop, so the game
recomputes the round trip from it — and the round trip is what the schedule divides.

Those numbers are **defaults, not constants**: the panel's **Settings** tab writes
`ServiceSettings` to localStorage, and `ProvisionServiceUseCase` reads them on every run
via `ServiceSettingsPolicy.serviceFor(routeId)` — with `autoTrains` off it provisions
nothing, leaving a built line for the player to service. Everything read back is sanitized
(`ServiceSettingsPolicy`), and `ServiceSchedule` holds each quieter period to the busier
one's train count, so headways ordered upside down can't break the game's
`high >= medium >= low >= veryLow` invariant.

## Sorting the line list

The game's own line list is the `routes` array itself — grouped by colour in first-appearance
order, ordered by the array within each group — so `setRoutes(sorted, false)` is all it
takes to sort the panel. `SortLinesUseCase` does that after every change the mod makes
(build, extend, either service action) and the moment the switch is flipped, while
`LineOrder` decides the order: by `fullName`, falling back to the bullet, through a
**numeric** collator so "Line 9" precedes "Line 10". Temp routes keep to the end. On by
default (`sortLinesByName`), and a no-op when the list is already in order, since reordering
writes the whole array back. See game-internals.md §5.

On the **Per line** tab, a line handed the city-wide numbers drops its entry instead of
freezing a copy of them. The fields show the **configured** service; `LineHeadways.forRoute`
reads the **running** one back off the route's schedule for the note beneath them (whole
trains over the round trip rarely divide into the exact headway asked for).

## Workflow — ALWAYS verify live

Everything here was built by driving the running game over CDP; the internals are
undocumented, so **don't trust a change until you've run it live**. Scripts assume
**macOS** (`osascript`, app-bundle layout, app-support path); override with `SB_DATA_DIR`
(game data dir), `SB_APP` (app bundle) and `SB_DEBUG_PORT` (CDP port, default `9222`).

> ### ⚠️ Quitting the game pops a blocking "save progress?" dialog — kill it, don't `quit`
> A graceful quit (`osascript -e 'quit app "Subway Builder"'`) leaves the game behind a
> native **"Save progress?" dialog that blocks the quit**, invisible over CDP, so the
> next launch starts a **second** instance. Two instances fight over the CDP port and
> the autosave file: `[Window] Window closed event`, routes vanishing between
> relaunches, previews that build to 0 stNodes, CDP driving one instance while the DOM
> you read is the other. **If a live test suddenly behaves impossibly, suspect a stray
> second instance first.** `npm run debug` already force-kills every instance
> (`pkill -9`, no dialog) and waits until `pgrep` finds nothing before launching one;
> before any other launch, `pkill -9 -f "Subway Builder.app/Contents/MacOS"` and confirm
> `pgrep -fl` on the same pattern prints nothing.

**Tests** live in `tests/`, mirroring `src/`, on **vitest + jsdom**, with a 90% coverage
floor enforced in `vitest.config.ts` and in CI. They never touch the game: the game
surfaces are faked. Two things make the setup non-obvious — React is read off the host at
module-init, so `tests/setup.ts` installs it *before* any mod module is imported; and
vitest transforms with **oxc**, not esbuild, so the JSX pragma lives under `oxc:` in the
config (esbuild options there are silently ignored). Tests do not replace verifying live:
this mod edits real routes, and only the game tells you if that worked. `npm run debug`
launches the game with CDP on :9222; `node scripts/cdp-eval.mjs '<expr>'` reads state,
`--file <snippet.js>` runs an async IIFE (drive the panel, build lines). Typical loop:
edit `src/**/*.ts(x)` → **`npm run build`** → re-inject the bundle with
`node scripts/cdp-eval.mjs --file dist/index.js` → drive the panel and read
`getState().routes` to verify (`stComboTimings.length > 0`, clean node distribution,
trains, no orphans, no console errors). The re-inject re-runs the IIFE
(`registrar.register()`, unregister-first), so the toolbar button updates in place.
`npm run install-mod` builds **and** copies into the game for a fresh boot. Run
`npm run typecheck` before trusting a build — esbuild strips types without checking them.

> ### ⚠️ The game serves a **pre-built** Tailwind stylesheet — only classes it already uses exist
> The mod's classes are never compiled; they only work if the game's own CSS happens
> to define them. Fractional and arbitrary utilities (`top-0.5`, `left-[1.125rem]`)
> are **not** in it and silently do nothing — that is how the settings switch first
> shipped with its knob outside the track. Style **geometry inline** (`style={{}}`)
> and keep classes to ones the game's UI visibly uses; when unsure, probe live:
> append a `<div className="…">`, read `getComputedStyle`, remove it.

The native panel button registers under uiComponents location **`top-bar`** and renders as
a `<div title="Auto Lines">` in the mods strip (NOT a `<button>` — query by `[title]`).
The panel's action button is the `w-full` one; the active tab also carries `bg-primary`,
so don't match the action button by color alone. A clean reload (`location.reload()` over
CDP) is the truest test — it exercises the lifecycle-hook re-registration that survives
the city-load top-bar wipe.

## Pitfalls (see docs/game-internals.md §6)

- **Never delete routes with `setRoutes([])`** — it orphans trains →
  `[GameLoop] Tick error: Route not found for train …`. Use `deleteRoute(id)` or
  `resetTrains()`; purge orphans with `setTrains(trains.filter(t => routeIds.has(t.routeId)))`.
- **Removing a station from a line leaves a `tempParentId` temp route and moves the train
  onto it** — so `stripTempRoutes` orphans that train. Always `purgeOrphanTrains()` after
  dropping routes (the mod does, in `stripTempRoutes`).
- `trackGraph` keys / edge `coordsString` have **changed format three times**:
  `"S"+lng+lat` (1.0), `lng+"-"+lat` (1.4.2), back to `"S"+lng+lat` (1.4.10). The coord
  key must match exactly or every adjacency lookup returns empty — so `StationIndex.build`
  **auto-detects** the format against the live graph (`detectCoordinateKey`) and exposes a
  **bound `coordKey` on the index** (no mutable module global) instead of hardcoding it.
- The game **autosaves** — never leave it in a broken state (empty routes, orphaned trains).
  Clean up after live tests.
- `setTracks` regenerates the whole trackGraph; pass `regenStations:false`.
- An empty route only bootstraps **incrementally** (add nodes one at a time).
