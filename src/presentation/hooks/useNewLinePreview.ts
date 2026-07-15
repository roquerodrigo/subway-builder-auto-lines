import type { NewLinePreview } from '@/application/PreviewNewLineUseCase'
import type { OrphanGroup } from '@/domain/newline/OrphanGroup'
import type { PanelDependencies } from '@/presentation/PanelDependencies'

import { React } from '@/infrastructure/ui/react'
import { PanelMode } from '@/presentation/types'

// Computes the new-line preview for the selected group. Pure and synchronous — it
// never generates a route or draws a preview on the map, so browsing groups shows
// no ghost line. Memoised on [mode, selection, refreshKey].
export function useNewLinePreview(
  dependencies: PanelDependencies,
  mode: PanelMode,
  selection: null | string,
  refreshKey: number,
  groups: OrphanGroup[],
): NewLinePreview | null {
  return React.useMemo<NewLinePreview | null>(() => {
    if (mode !== PanelMode.New) {
      return null
    }
    const group = groups.find((candidate) => candidate.key === selection)
    if (!group) {
      return null
    }

    return dependencies.previewNewLine.execute(group.stationIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selection, refreshKey])
}
