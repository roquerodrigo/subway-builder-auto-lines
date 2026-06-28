import { describe, expect, it } from 'vitest'

import { OrphanGroup } from '@/domain/newline/OrphanGroup'

describe('OrphanGroup.key', () => {
  // The finder walks the component in whatever order the graph hands it over, so
  // the same group has to key the same way from one refresh to the next or the
  // dropdown loses the user's selection.
  it('is the same for the same stations found in a different order', () => {
    const first = new OrphanGroup(['a', 'b', 'c'], ['A', 'B', 'C'], ['A', 'C'])
    const second = new OrphanGroup(['c', 'a', 'b'], ['C', 'A', 'B'], ['A', 'C'])
    expect(second.key).toBe(first.key)
  })

  it('differs between two groups that hold different stations', () => {
    const first = new OrphanGroup(['a', 'b'], ['A', 'B'], null)
    const second = new OrphanGroup(['a', 'c'], ['A', 'C'], null)
    expect(second.key).not.toBe(first.key)
  })

  it('does not reorder the stations it was given', () => {
    const group = new OrphanGroup(['c', 'a', 'b'], ['C', 'A', 'B'], null)
    void group.key
    expect(group.stationIds).toEqual(['c', 'a', 'b'])
  })
})
