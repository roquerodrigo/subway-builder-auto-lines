import type { TrackNetwork } from '@/domain/network/TrackNetwork'

// Corridor traversals over a line's station set / an adjacency graph. Pure.
export class Corridor {
  // Longest corridor through a station-adjacency graph: a maximal run whose
  // internal stations all have exactly 2 neighbors. The walk stops at the first
  // bifurcation (3+ neighbors) or dead-end, so a line never runs through a
  // junction — it terminates there.
  static longest(ids: string[], adjacency: Map<string, Set<string>>): string[] {
    const degree = (id: string): number => (adjacency.get(id) ?? new Set()).size

    const walk = (start: string, first: string): string[] => {
      const corridor: string[] = [start]
      let prev = start
      let cur: null | string = first
      let guard = 0
      while (cur != null && guard++ < ids.length + 2) {
        corridor.push(cur)
        if (degree(cur) !== 2) {
          break
        } // junction or dead-end → stop here
        let next: null | string = null;
        (adjacency.get(cur) ?? new Set()).forEach((n) => {
          if (n !== prev) {
            next = n
          }
        })
        prev = cur
        cur = next
      }
      return corridor
    }

    let best: string[] = []
    // corridor endpoints are stations that aren't simple through-stops
    ids
      .filter((id) => degree(id) !== 2)
      .forEach((endpoint) => {
        (adjacency.get(endpoint) ?? new Set()).forEach((neighbor) => {
          const corridor = walk(endpoint, neighbor)
          if (corridor.length > best.length) {
            best = corridor
          }
        })
      })

    // pure cycle (every station degree 2): no endpoints — break it anywhere
    if (!best.length && ids.length >= 2) {
      const start = ids[0]
      let cur: null | string = null;
      (adjacency.get(start) ?? new Set()).forEach((n) => {
        cur = n
      })
      const corridor: string[] = [start]
      let prev = start
      let guard = 0
      while (cur != null && cur !== start && guard++ < ids.length + 2) {
        corridor.push(cur)
        let next: null | string = null;
        (adjacency.get(cur) ?? new Set()).forEach((n) => {
          if (n !== prev) {
            next = n
          }
        })
        prev = cur
        cur = next
      }
      best = corridor
    }

    return best
  }

  // Ordered station ids covering the WHOLE line (DFS from a terminus). A line can
  // branch (multiple termini), so this is a full traversal — every station once.
  static order(network: TrackNetwork, lineStationIds: Set<string>): string[] {
    const neighbors = (stationId: string): Set<string> =>
      network.neighborStationsWithin(stationId, lineStationIds)

    let start: null | string = null
    for (const stationId of lineStationIds) {
      if (start == null && neighbors(stationId).size <= 1) {
        start = stationId
      }
    }
    const ids = Array.from(lineStationIds)
    if (start == null) {
      start = ids[0] ?? null
    } // loop: arbitrary start

    const order: string[] = []
    const seen = new Set<string>()
    const visit = (stationId: string): void => {
      if (seen.has(stationId)) {
        return
      }
      seen.add(stationId)
      order.push(stationId)
      neighbors(stationId).forEach((neighbor) => visit(neighbor))
    }

    if (start != null) {
      visit(start)
    }
    ids.forEach((stationId) => visit(stationId)) // any disconnected remainder
    return order
  }
}
