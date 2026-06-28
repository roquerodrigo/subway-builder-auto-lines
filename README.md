# Auto Lines

A mod for [Subway Builder](https://www.subwaybuilder.com) that automates building
transit lines: **extend an existing line along its corridor**, or **create a new line
for stations that have none** — each with proper terminus crossovers and demand-based
trains, in a few clicks.

## Install

Install **Auto Lines** from [Railyard](https://subwaybuildermodded.com), or grab the
ZIP from the [latest release](../../releases/latest) and unpack it into
`<game data>/mods/auto-lines/`. Then enable it in **Settings → Mods** and restart the
game. The toolbar button appears once a city is loaded.

## The panel

A toolbar button (icon **Waypoints**) in the top-right actions opens the panel. Two
tabs: **Extend** and **New line**.

### Extend

1. Pick a line from the dropdown.
2. The panel shows the **whole line** as a vertical list (a dot per station, in the
   line's color), with the stations that would be **added highlighted** at each end.
3. Each end is **walked outward along its corridor**, auto-including single
   continuations until a **bifurcation** (where you choose the branch) or a dead end.
   Stations are added as a single stop at the new terminus and as through-stops in the
   middle — the train never doubles back.
4. Click **Extend** to apply. The button is disabled when the line can't grow.

### New line

1. The dropdown lists **groups of connected stations that have no line**, labeled by
   the line's terminals ("A ↔ B"). It's hidden when there are none.
2. Pick a group and the panel previews the line it would build: the group's **longest
   corridor**, stopping at bifurcations so a junction becomes a terminus rather than a
   pass-through.
3. Click **Create line**. Lines are numbered 1, 2, 3… A branched group yields one valid
   line; the rest is reported and stays available for another line.

## What it does under the hood

- **Single-stop termini, no backtrack.** A line is a closed loop along tracks; the mod
  lays it so the train reverses cleanly (one platform at each terminus, both in the
  middle), never running through a junction or stopping twice at an end.
- **Turnaround crossovers.** Without a crossover at a terminus the game throws "No
  valid path found between station tracks". The mod fabricates a reversable
  scissors-crossover diagonal at each terminus when one is missing, so trains can
  reverse.
- **Demand-based trains.** On create/extend it sets the line's `trainSchedule` for
  5 / 10 / 15-minute headways (peak / midday / off-peak) — computed from the line's
  round-trip time — and spawns the current period's trains; the game auto-spawns the
  rest as the time of day changes.

None of this is in the public API. See
[`docs/game-internals.md`](docs/game-internals.md) for the exact mechanisms.

## Development

Requires Node. The dev scripts are macOS-only (they use the macOS app paths).

```bash
npm install
npm run install-mod    # build + copy the mod into the game
npm run debug          # relaunch the game with DevTools + a CDP port
npm run play           # install-mod, then debug
npm run package        # build the release assets into dist/release/
npm test               # vitest run
npm run test:coverage  # vitest + coverage (90% floor)
npm run typecheck      # tsc --noEmit (strict)
npm run lint           # eslint .
```

```
subway-builder-auto-lines/
├── src/                  # the mod, in TypeScript (bundled to one index.js)
│   ├── manifest.json
│   ├── main.tsx          #   composition root
│   ├── domain/           #   network, corridors, expansion + new-line planning
│   ├── application/      #   the use cases
│   ├── infrastructure/   #   the only code that touches the game/map/React
│   ├── presentation/     #   the React panel
│   └── shared/game/      #   typed game contracts
├── scripts/              # dev workflow (Node, macOS)
│   ├── build.mjs         #   esbuild → dist/index.js (one IIFE)
│   ├── install-mod.mjs   #   copy the built mod into the game
│   ├── package-release.mjs #  the ZIP + standalone manifest for a release
│   ├── debug.mjs         #   relaunch the game with DevTools + a CDP port
│   └── cdp-eval.mjs      #   evaluate JS in the running renderer (inspection)
├── tests/                # vitest + jsdom, mirrors src/ (90% coverage floor)
├── docs/
│   ├── game-internals.md       # reverse-engineered game internals this mod uses
│   └── inspecting-the-game.md  # how to inspect/drive the running game over CDP
└── package.json
```

API reference: <https://www.subwaybuilder.com/docs/v1.0.0/api-reference>

### Inspecting / driving the running game

`npm run debug` opens a Chrome DevTools Protocol port; `scripts/cdp-eval.mjs`
(`npm run inspect`) evaluates JS in the live renderer. This is how the mod was built
and verified. See [`docs/inspecting-the-game.md`](docs/inspecting-the-game.md).

```bash
node scripts/cdp-eval.mjs 'Object.keys(window.__subwayBuilder_storeCallbacks__.getState())'
```

### Paths & overrides

| Var | Default | Used by |
|---|---|---|
| `SB_DATA_DIR` | `~/Library/Application Support/metro-maker4` | `install-mod` (mod lands in `<dir>/mods/auto-lines/`) |
| `SB_APP` | `/Applications/Subway Builder.app` | `debug` (the `.app` bundle to launch) |
| `SB_DEBUG_PORT` | `9222` | `debug` / `cdp-eval` (Chrome DevTools Protocol port) |

## Known limitations

- macOS-only dev scripts.
- The track/route/train internals are **undocumented** and version-specific; verify
  against a new game version before trusting them.
- New lines can only be made from stations with **no** line; branched groups need one
  line per corridor (run it again for the rest).

## License

[MIT](LICENSE)
