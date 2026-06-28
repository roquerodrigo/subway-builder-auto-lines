// 64 maximally-distinct line colors from the Glasbey palette (colorcet's
// glasbey_bw_minc_20_minl_30 variant): perceptually far apart in CAM02-UCS, and
// the "bw"/"minl" variant keeps them clear of both black and white so every one
// stands out against the dark map. The same color drives the map preview, the
// panel list, and the committed route; the "change color" button walks the list.
const COLORS = [
  '#d70000', '#028800', '#b600ff', '#06acc6', '#98ff00', '#ffa530',
  '#ff8fc8', '#79525f', '#00fecf', '#b0a5ff', '#94ad84', '#9a6900',
  '#376a62', '#d3008c', '#fef590', '#c86f66', '#9ee3ff', '#00c946',
  '#a977ad', '#b8bb02', '#f4c0b1', '#ff28fd', '#f3ceff', '#009f7d',
  '#ff6200', '#56652b', '#963f1f', '#91318f', '#ff3465', '#a0e492',
  '#8d9bb2', '#829126', '#ae093f', '#78c7bb', '#bc9258', '#e58fff',
  '#72b9ff', '#c6a5c1', '#ff9171', '#d3c37d', '#bdeedb', '#6b8568',
  '#926e56', '#f9ff00', '#bac2e0', '#ad577d', '#ffce03', '#ff4ab1',
  '#c25703', '#5d8c90', '#c244bd', '#007540', '#ba6ffe', '#00d494',
  '#00ff76', '#49a251', '#cc9891', '#00ebee', '#db7e01', '#f8758a',
  '#b99600', '#c94248', '#00d0fa', '#765827',
]

export class LineColorPalette {
  // The next color after `current`, wrapping around; the first color if
  // `current` isn't in the palette. Used by the "change color" button.
  static next(current: string): string {
    const index = COLORS.findIndex((color) => color.toLowerCase() === (current || '').toLowerCase())
    return COLORS[(index + 1) % COLORS.length]
  }

  // Picks a color given a 0..1 random value, preferring colors not in `used`
  // (case-insensitive). Pure — the randomness is supplied by the caller.
  static pick(used: Set<string>, random: number): string {
    const taken = new Set(Array.from(used, (color) => color.toLowerCase()))
    const available = COLORS.filter((color) => !taken.has(color.toLowerCase()))
    const pool = available.length ? available : COLORS
    const index = Math.min(pool.length - 1, Math.floor(random * pool.length))
    return pool[index]
  }
}
