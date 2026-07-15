import { describe, expect, it } from 'vitest'

import { LineColorPalette } from '@/domain/newline/LineColorPalette'

// Walking `next` from the first colour all the way round enumerates the palette
// without the test having to duplicate the list.
function wholePalette(): string[] {
  const first = LineColorPalette.next('')
  const colors = [first]
  for (let color = LineColorPalette.next(first); color !== first; color = LineColorPalette.next(color)) {
    colors.push(color)
  }

  return colors
}

describe('LineColorPalette.next', () => {
  it('steps to the colour after the current one', () => {
    const [first, second] = wholePalette()
    expect(LineColorPalette.next(first)).toBe(second)
  })

  it('wraps around from the last colour to the first', () => {
    const palette = wholePalette()
    expect(LineColorPalette.next(palette[palette.length - 1])).toBe(palette[0])
  })

  it('starts at the first colour for a line with no colour yet', () => {
    expect(LineColorPalette.next('')).toBe(wholePalette()[0])
  })

  it('starts at the first colour for a colour outside the palette', () => {
    expect(LineColorPalette.next('#123456')).toBe(wholePalette()[0])
  })

  // The game hands colours back in whatever case it stored them.
  it('recognises the current colour whatever its case', () => {
    const [first, second] = wholePalette()
    expect(LineColorPalette.next(first.toUpperCase())).toBe(second)
  })

  it('reaches every colour of the palette before repeating', () => {
    const palette = wholePalette()
    expect(new Set(palette).size).toBe(palette.length)
    expect(palette.length).toBeGreaterThan(1)
  })
})

describe('LineColorPalette.pick', () => {
  it('picks the first colour for the lowest random value', () => {
    expect(LineColorPalette.pick(new Set(), 0)).toBe(wholePalette()[0])
  })

  it('picks the last colour for the highest random value', () => {
    const palette = wholePalette()
    expect(LineColorPalette.pick(new Set(), 1)).toBe(palette[palette.length - 1])
  })

  it('spreads across the palette as the random value climbs', () => {
    expect(LineColorPalette.pick(new Set(), 0.5)).not.toBe(LineColorPalette.pick(new Set(), 0))
  })

  // Two lines the same colour are the whole thing the palette exists to avoid.
  it('never hands back a colour another line already has', () => {
    const palette = wholePalette()
    const used = new Set(palette.slice(0, palette.length - 1))
    expect(LineColorPalette.pick(used, 0)).toBe(palette[palette.length - 1])
  })

  it('skips a used colour whatever case it was stored in', () => {
    const palette = wholePalette()
    expect(LineColorPalette.pick(new Set([palette[0].toUpperCase()]), 0)).toBe(palette[1])
  })

  // Better a repeat than no colour at all.
  it('falls back to the whole palette once every colour is taken', () => {
    const palette = wholePalette()
    expect(palette).toContain(LineColorPalette.pick(new Set(palette), 0.5))
  })

  it('ignores colours that are not in the palette at all', () => {
    const palette = wholePalette()
    expect(LineColorPalette.pick(new Set(['#123456']), 0)).toBe(palette[0])
  })
})
