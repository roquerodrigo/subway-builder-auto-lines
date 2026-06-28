import type { CreateNewLineUseCase } from '@/application/CreateNewLineUseCase'
import type { DiscardNewLinePreviewUseCase } from '@/application/DiscardNewLinePreviewUseCase'
import type { ExtendLineUseCase } from '@/application/ExtendLineUseCase'
import type { PreviewNewLineUseCase } from '@/application/PreviewNewLineUseCase'
import type { PreviewMapOverlay } from '@/infrastructure/map/PreviewMapOverlay'
import type { RouteMaintenance } from '@/infrastructure/routing/RouteMaintenance'
import type { GameStore } from '@/infrastructure/store/GameStore'
import type { SubwayBuilderApi } from '@/shared/game/SubwayBuilderApi'

// Everything the panel needs, injected by the composition root (main.tsx) so the
// presentation layer never reaches into window/store directly.
export interface PanelDependencies {
  store: GameStore
  api: SubwayBuilderApi
  maintenance: RouteMaintenance
  previewOverlay: PreviewMapOverlay
  extendLine: ExtendLineUseCase
  previewNewLine: PreviewNewLineUseCase
  createNewLine: CreateNewLineUseCase
  discardPreview: DiscardNewLinePreviewUseCase
}
