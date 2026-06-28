// A connected group (>=2) of stations that belong to no route, track-linked to
// each other. `terminalNames` are the ends of the longest corridor through the
// group (for the dropdown label); `key` is a stable identity for selection.
export class OrphanGroup {
  get key(): string {
    return this.stationIds.slice().sort().join('|')
  }

  constructor(
    readonly stationIds: string[],
    readonly names: string[],
    readonly terminalNames: [string, string] | null,
  ) {}
}
