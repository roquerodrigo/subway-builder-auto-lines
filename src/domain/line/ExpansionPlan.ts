import type { StationIndex } from '@/domain/network/StationIndex'

// A branch the user can pick at a fork: it follows the tracks to a far terminus.
// `stationId`/`name` are that terminus; `stationIds` is the full branch path
// (fork-adjacent → terminus); `applyStationNodeIds` are the station-node ids to add for it.
export interface ForkOption {
  stationId: string
  name: string
  stationIds: string[]
  applyStationNodeIds: string[]
}

// A fork encountered while walking a endpoint outward: more than one continuation.
export interface Fork {
  atName: string
  options: ForkOption[]
}

// One endpoint of a line and how it can grow: an auto-extendable chain
// of single continuations, then optionally a fork the user must resolve.
export interface Endpoint {
  stationId: string
  name: string
  autoStationNodeIds: string[]
  autoNames: string[]
  autoStationIds: string[]
  fork: Fork | null
}

export type ForkChoices = Record<string, ForkOption | null | undefined>

// The plan for extending a whole line: its current footprint plus a endpoint per
// growable endpoint. Pure value object produced by LineExpansionPlanner.
export class ExpansionPlan {
  constructor(
    readonly index: StationIndex,
    readonly lineStationNodeIds: Set<string>,
    readonly lineStationIds: Set<string>,
    readonly endpoints: Endpoint[],
  ) {}

  // station-node ids to add: every endpoint's auto chain plus any chosen fork option.
  addStationNodeIds(choices: ForkChoices): string[] {
    const add: string[] = []
    const push = (id: string | undefined): void => {
      if (id && add.indexOf(id) < 0) {
        add.push(id)
      }
    }
    for (const endpoint of this.endpoints) {
      endpoint.autoStationNodeIds.forEach(push)
      if (endpoint.fork) {
        const choice = choices[endpoint.stationId]
        if (choice) {
          choice.applyStationNodeIds.forEach(push)
        }
      }
    }
    return add
  }

  hasAction(): boolean {
    return this.endpoints.some((endpoint) => endpoint.autoNames.length > 0 || endpoint.fork != null)
  }
}
