// A station. `stNodeIds` are its two platform nodes; `routeIds` the lines that
// serve it (empty/absent = an orphan station, eligible for a new line).
export interface Station {
  id: string
  name: string
  stNodeIds?: string[]
  routeIds?: string[]
}
