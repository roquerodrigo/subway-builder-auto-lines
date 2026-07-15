// Splits the region reachable from a junction into non-overlapping branches, one
// per end of the tracks. A spanning BFS from `root` gives every station one
// parent, so a loop/triangle divides into distinct arms; each LEAF of that tree
// (a true dead-end, or a merge point whose only way on was claimed by another
// arm) is an end. Returns one path per leaf, ordered junction-adjacent → leaf,
// excluding the root. `neighborsOf` yields adjacent station ids; stations in
// `blocked` are never traversed. `folds(prev, current, next)` (optional) prunes a
// step that would bend the branch back on itself at `current`, so a branch stops
// before a fold rather than running through it.
export class BranchExplorer {
  static leafPaths(
    root: string,
    neighborsOf: (stationId: string) => Iterable<string>,
    blocked: Set<string>,
    folds?: (prev: null | string, current: string, next: string) => boolean,
  ): string[][] {
    const parent = new Map<string, null | string>([[root, null]])
    const order: string[] = [root]
    const queue: string[] = [root]
    while (queue.length) {
      const current = queue.shift() as string
      for (const neighbor of neighborsOf(current)) {
        if (neighbor === root || blocked.has(neighbor) || parent.has(neighbor)) {
          continue
        }
        if (folds?.(parent.get(current) ?? null, current, neighbor)) {
          continue
        }
        parent.set(neighbor, current)
        queue.push(neighbor)
        order.push(neighbor)
      }
    }

    const parents = new Set([...parent.values()].filter((p): p is string => p != null))
    const paths: string[][] = []
    for (const leaf of order) {
      if (leaf === root || parents.has(leaf)) {
        continue
      }
      const path: string[] = []
      let cur: null | string = leaf
      while (cur != null && cur !== root) {
        path.push(cur)
        cur = parent.get(cur) ?? null
      }
      path.reverse()
      if (path.length) {
        paths.push(path)
      }
    }

    return paths
  }
}
