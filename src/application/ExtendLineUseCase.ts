import type { ProvisionServiceUseCase } from '@/application/ProvisionServiceUseCase'
import type { ExpansionPlan, ForkChoices } from '@/domain/line/ExpansionPlan'
import type { CrossoverInjector } from '@/infrastructure/crossover/CrossoverInjector'
import type { RoutePreviewEditor } from '@/infrastructure/routing/RoutePreviewEditor'
import type { GameStore } from '@/infrastructure/store/GameStore'

import { TerminusCrossoverFactory } from '@/domain/crossover/TerminusCrossoverFactory'

export interface ExtendOutcome {
  committed: boolean
  hadAdditions: boolean
}

// Extends a line at each growable endpoint: fabricates the turnaround crossover
// at every new terminus, applies the additions through the preview flow, and —
// if the line actually grew — provisions demand-based service on it.
export class ExtendLineUseCase {
  constructor(
    private readonly store: GameStore,
    private readonly crossovers: CrossoverInjector,
    private readonly previewEditor: RoutePreviewEditor,
    private readonly provisionService: ProvisionServiceUseCase,
  ) {}

  async execute(routeId: string, plan: ExpansionPlan, choices: ForkChoices): Promise<ExtendOutcome> {
    const addStationNodeIds = plan.addStationNodeIds(choices)
    if (!addStationNodeIds.length) {
      return { committed: false, hadAdditions: false }
    }

    this.ensureExtensionCrossovers(plan, choices)
    const result = await this.previewEditor.applyAdditions(routeId, addStationNodeIds)
    if (result.committed) {
      this.provisionService.execute(routeId)
    }
    return { committed: result.committed, hadAdditions: true }
  }

  // Create the turnaround crossover at each extended endpoint's NEW terminus (the far
  // end of its auto chain / chosen fork), so the reversal path resolves there too.
  private ensureExtensionCrossovers(plan: ExpansionPlan, choices: ForkChoices): void {
    const state = this.store.state()
    const diagonals = plan.endpoints.map((endpoint) => {
      const chain = endpoint.autoStationIds.slice()
      const choice = choices[endpoint.stationId]
      if (endpoint.fork && choice) {
        chain.push(...choice.stationIds)
      }
      if (!chain.length) {
        return null
      }
      const terminus = chain[chain.length - 1]
      const neighbor = chain.length >= 2 ? chain[chain.length - 2] : endpoint.stationId
      return TerminusCrossoverFactory.create(state, plan.index, terminus, neighbor)
    })
    this.crossovers.inject(diagonals)
  }
}
