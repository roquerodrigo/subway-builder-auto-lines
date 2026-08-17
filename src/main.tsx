import { ApplyLineServiceUseCase } from '@/application/ApplyLineServiceUseCase'
import { ApplyServiceToAllLinesUseCase } from '@/application/ApplyServiceToAllLinesUseCase'
import { CreateNewLineUseCase } from '@/application/CreateNewLineUseCase'
import { DiscardNewLinePreviewUseCase } from '@/application/DiscardNewLinePreviewUseCase'
import { ExtendLineUseCase } from '@/application/ExtendLineUseCase'
import { PreviewNewLineUseCase } from '@/application/PreviewNewLineUseCase'
import { ProvisionServiceUseCase } from '@/application/ProvisionServiceUseCase'
import { CrossoverInjector } from '@/infrastructure/crossover/CrossoverInjector'
import { FleetProvisioner } from '@/infrastructure/fleet/FleetProvisioner'
import { TrainTypeCatalog } from '@/infrastructure/game/TrainTypeCatalog'
import { PreviewMapOverlay } from '@/infrastructure/map/PreviewMapOverlay'
import { RouteEditGuard } from '@/infrastructure/routing/RouteEditGuard'
import { RouteMaintenance } from '@/infrastructure/routing/RouteMaintenance'
import { RoutePreviewEditor } from '@/infrastructure/routing/RoutePreviewEditor'
import { OrphanTrackRescue } from '@/infrastructure/save/OrphanTrackRescue'
import { ServiceSettingsStore } from '@/infrastructure/settings/ServiceSettingsStore'
import { GameStore } from '@/infrastructure/store/GameStore'
import { FloatingPanelRegistrar } from '@/infrastructure/ui/FloatingPanelRegistrar'
import { clampStoredPanelGeometry } from '@/infrastructure/ui/PanelViewport'
import { createAutoLinesPanel } from '@/presentation/AutoLinesPanel'
import { logger } from '@/shared/Logger'

// Composition root. The mod uses the internal store for all line/track/train work
// and the public UI API for its window; it disables itself if either is missing.
function bootstrap(): void {
  const api = window.SubwayBuilderAPI
  const storeCallbacks = window.__subwayBuilder_storeCallbacks__
  if (!api) {
    logger.error('SubwayBuilderAPI not found!')

    return
  }
  if (!storeCallbacks || typeof storeCallbacks.getState !== 'function') {
    logger.error('internal store not found — mod disabled.')

    return
  }

  const store = new GameStore(storeCallbacks)
  // Before anything else: the city is loaded after the mods are, so this still
  // gets to fix up a save whose crossovers an older version left unowned.
  new OrphanTrackRescue(store).install()
  const catalog = new TrainTypeCatalog(api)
  const guard = new RouteEditGuard()
  const maintenance = new RouteMaintenance(store)
  const previewEditor = new RoutePreviewEditor(store, guard, maintenance)
  const crossovers = new CrossoverInjector(store)
  const fleet = new FleetProvisioner(store, catalog)
  const previewOverlay = new PreviewMapOverlay(api)
  const settings = new ServiceSettingsStore()

  const provisionService = new ProvisionServiceUseCase(store, fleet, settings)
  const applyServiceToAllLines = new ApplyServiceToAllLinesUseCase(store, provisionService)
  const applyLineService = new ApplyLineServiceUseCase(store, settings, provisionService)
  const extendLine = new ExtendLineUseCase(store, crossovers, previewEditor, provisionService)
  const previewNewLine = new PreviewNewLineUseCase(store)
  const createNewLine = new CreateNewLineUseCase(store, guard, maintenance, crossovers, previewEditor, provisionService)
  const discardPreview = new DiscardNewLinePreviewUseCase(store, guard, maintenance)

  const panel = createAutoLinesPanel({
    api,
    applyLineService,
    applyServiceToAllLines,
    createNewLine,
    discardPreview,
    extendLine,
    maintenance,
    previewNewLine,
    previewOverlay,
    settings,
    store,
  })

  // Pull a stale saved position back on-screen before the game reads it (so the
  // game's own position state stays consistent); re-checked on each lifecycle hook,
  // e.g. after the game window is resized.
  clampStoredPanelGeometry()

  const registrar = new FloatingPanelRegistrar(api, panel, clampStoredPanelGeometry)
  registrar.register()
  registrar.installLifecycleHooks()
  logger.log('mod loaded.')
}

bootstrap()
