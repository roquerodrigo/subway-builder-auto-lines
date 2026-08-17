import type { ApplyLineServiceUseCase } from '@/application/ApplyLineServiceUseCase'
import type { ApplyServiceToAllLinesUseCase } from '@/application/ApplyServiceToAllLinesUseCase'
import type { CreateNewLineUseCase } from '@/application/CreateNewLineUseCase'
import type { DiscardNewLinePreviewUseCase } from '@/application/DiscardNewLinePreviewUseCase'
import type { ExtendLineUseCase } from '@/application/ExtendLineUseCase'
import type { PreviewNewLineUseCase } from '@/application/PreviewNewLineUseCase'
import type { SortLinesUseCase } from '@/application/SortLinesUseCase'
import type { PreviewMapOverlay } from '@/infrastructure/map/PreviewMapOverlay'
import type { RouteMaintenance } from '@/infrastructure/routing/RouteMaintenance'
import type { ServiceSettingsStore } from '@/infrastructure/settings/ServiceSettingsStore'
import type { GameStore } from '@/infrastructure/store/GameStore'
import type { SubwayBuilderApi } from '@/shared/game/SubwayBuilderApi'

// Everything the panel needs, injected by the composition root (main.tsx) so the
// presentation layer never reaches into window/store directly.
export interface PanelDependencies {
  api: SubwayBuilderApi
  applyLineService: ApplyLineServiceUseCase
  applyServiceToAllLines: ApplyServiceToAllLinesUseCase
  createNewLine: CreateNewLineUseCase
  discardPreview: DiscardNewLinePreviewUseCase
  extendLine: ExtendLineUseCase
  maintenance: RouteMaintenance
  previewNewLine: PreviewNewLineUseCase
  previewOverlay: PreviewMapOverlay
  settings: ServiceSettingsStore
  sortLines: SortLinesUseCase
  store: GameStore
}
