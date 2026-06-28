import type { Mock } from 'vitest'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RouteEditGuard } from '@/infrastructure/routing/RouteEditGuard'

const FIBER_KEY = '__reactFiber$test'
const MAX_FIBER_WALK_DEPTH = 500

interface FiberNode {
  memoizedProps?: { value?: unknown }
  return?: FiberNode | null
}

// The mod's own toolbar button, the descendant of the UiProvider the guard walks
// up from. The game renders it as a <div title="Auto Lines">, not a <button>.
function mountButton(): HTMLElement {
  const button = document.createElement('div')
  button.setAttribute('title', 'Auto Lines')
  document.body.appendChild(button)
  return button
}

function attachFiber(element: Element, fiber: FiberNode): void {
  Object.assign(element, { [FIBER_KEY]: fiber })
}

// React hangs the context value off the provider fiber's props; the mod's button
// sits some way below it, so the guard has to climb.
function chainTo(provider: FiberNode, depth: number): FiberNode {
  let leaf = provider
  for (let step = 0; step < depth; step++) {
    leaf = { return: leaf }
  }
  return leaf
}

describe('RouteEditGuard', () => {
  let guard: RouteEditGuard
  let setUserAction: Mock<(value: string) => void>
  let uiContext: { setUserAction: Mock<(value: string) => void>, userAction: string }

  beforeEach(() => {
    guard = new RouteEditGuard()
    setUserAction = vi.fn()
    uiContext = { setUserAction, userAction: 'none' }
  })

  afterEach(() => {
    document.body.innerHTML = ''
    delete (document.body as unknown as Record<string, unknown>)[FIBER_KEY]
  })

  // The 1.4.10 guard pops an "Unsaved Route Changes" modal whenever a previewRoute
  // is active while the userAction isn't the game's own route-edit action.
  it('claims the route-edit action before a preview is built', () => {
    attachFiber(mountButton(), chainTo({ memoizedProps: { value: uiContext } }, 3))

    guard.begin()

    expect(setUserAction).toHaveBeenCalledWith('draw-line-track')
  })

  it('releases the route-edit action once the preview is gone', () => {
    attachFiber(mountButton(), chainTo({ memoizedProps: { value: uiContext } }, 3))

    guard.end()

    expect(setUserAction).toHaveBeenCalledWith('none')
  })

  it('stops at the nearest fiber carrying the ui context', () => {
    const outer = { setUserAction: vi.fn(), userAction: 'none' }
    const outerFiber: FiberNode = { memoizedProps: { value: outer } }
    const nearestFiber: FiberNode = { memoizedProps: { value: uiContext }, return: outerFiber }
    attachFiber(mountButton(), { return: nearestFiber })

    guard.begin()

    expect(setUserAction).toHaveBeenCalledTimes(1)
    expect(outer.setUserAction).not.toHaveBeenCalled()
  })

  it('walks up from the document body when the mod button is not mounted', () => {
    attachFiber(document.body, chainTo({ memoizedProps: { value: uiContext } }, 2))

    guard.begin()

    expect(setUserAction).toHaveBeenCalledWith('draw-line-track')
  })

  it('ignores a fiber whose props value is not the ui context', () => {
    const provider: FiberNode = { memoizedProps: { value: { setUserAction } } }
    attachFiber(mountButton(), chainTo(provider, 1))

    guard.begin()

    expect(setUserAction).not.toHaveBeenCalled()
  })

  it('ignores a fiber with no props at all', () => {
    attachFiber(mountButton(), { memoizedProps: undefined, return: null })

    expect(() => guard.begin()).not.toThrow()
  })

  it('gives up rather than climb an unbounded tree', () => {
    attachFiber(mountButton(), chainTo({ memoizedProps: { value: uiContext } }, MAX_FIBER_WALK_DEPTH + 1))

    guard.begin()

    expect(setUserAction).not.toHaveBeenCalled()
  })

  it('does nothing when the element carries no fiber', () => {
    mountButton()

    expect(() => guard.begin()).not.toThrow()
    expect(setUserAction).not.toHaveBeenCalled()
  })

  // Suppressing the guard is best-effort: the worst case is the modal coming back.
  it('swallows a ui context that rejects the call', () => {
    uiContext.setUserAction.mockImplementation((): never => {
      throw new Error('context is torn down')
    })
    attachFiber(mountButton(), chainTo({ memoizedProps: { value: uiContext } }, 1))

    expect(() => guard.begin()).not.toThrow()
  })
})
