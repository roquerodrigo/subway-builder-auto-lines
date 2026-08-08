import type { PanelDependencies } from '@/presentation/PanelDependencies'
import type { Route } from '@/shared/game/Route'

import { ExtendableRoutes } from '@/domain/line/ExtendableRoutes'
import { React } from '@/infrastructure/ui/react'
import { realRoutes } from '@/presentation/labels'
import { PanelMode } from '@/presentation/types'

// The lines the extend tab offers: only those that can grow right now. Planning
// every line is too much work for a render, so it is memoised on [mode, refreshKey]
// — the reload button and every commit bump that key.
export function useExtendableRoutes(
  dependencies: PanelDependencies,
  mode: PanelMode,
  refreshKey: number,
): Route[] {
  return React.useMemo<Route[]>(() => {
    if (mode !== PanelMode.Extend) {
      return []
    }

    return ExtendableRoutes.filter(dependencies.store.state(), realRoutes(dependencies.api))
    // `dependencies` is stable; keying on [mode, refreshKey] is deliberate (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, refreshKey])
}
