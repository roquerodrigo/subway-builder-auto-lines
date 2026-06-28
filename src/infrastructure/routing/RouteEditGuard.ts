import { UserAction } from '@/shared/game/UserAction'

// Satisfies game 1.4.10's RouteEditGuard: it pops an "Unsaved Route Changes"
// modal whenever a previewRoute is active while the UI's userAction isn't
// "draw-line-track". This mod builds previews without going through the game's
// route-edit action, so it must pair them like the game's own flow does:
// setUserAction("draw-line-track") before setting a non-null preview, and
// setUserAction("none") after clearing it.
//
// userAction lives in a React context (useUi), not the store, so its setter is
// reached through the fiber tree from the mod's own toolbar button (a descendant
// of the UiProvider). Best-effort — if the shape changes this silently no-ops
// (worst case: the modal returns, nothing breaks).
const MAX_FIBER_WALK_DEPTH = 500

export class RouteEditGuard {
  begin(): void {
    this.setUserAction(UserAction.DrawLineTrack)
  }

  end(): void {
    this.setUserAction(UserAction.None)
  }

  private setUserAction(value: UserAction): void {
    try {
      const element = document.querySelector('[title="Auto Lines"]') ?? document.body
      const fiberKey = Object.keys(element).find((key) => key.indexOf('__reactFiber') === 0)
      let fiber = fiberKey ? ((element as unknown as Record<string, unknown>)[fiberKey] as FiberNode | null) : null
      let steps = 0
      while (fiber && steps++ < MAX_FIBER_WALK_DEPTH) {
        const contextValue = fiber.memoizedProps?.value
        if (
          contextValue &&
          typeof contextValue.setUserAction === 'function' &&
          'userAction' in contextValue
        ) {
          contextValue.setUserAction(value)
          return
        }
        fiber = fiber.return ?? null
      }
    } catch {
      /* guard suppression is best-effort */
    }
  }
}

interface FiberNode {
  memoizedProps?: { value?: { setUserAction?: (value: string) => void, userAction?: unknown } }
  return?: FiberNode | null
}
