import type { Mock, MockInstance } from 'vitest'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FloatingPanelConfig, SubwayBuilderApi } from '@/shared/game/SubwayBuilderApi'

import { FloatingPanelRegistrar } from '@/infrastructure/ui/FloatingPanelRegistrar'

// The registrar refuses to register without the host React, and the host is only
// swapped out at module-init — so the shim is faked to drive that branch.
const { host } = vi.hoisted(() => ({ host: { reactAvailable: true } }))

vi.mock('@/infrastructure/ui/react', () => ({
  isReactAvailable: (): boolean => host.reactAvailable,
}))

const PANEL_ID = 'autolines'
const LIFECYCLE_HOOKS = ['onGameInit', 'onCityLoad', 'onMapReady']

interface FakeUi {
  addFloatingPanel: Mock<(config: FloatingPanelConfig) => void>
  unregisterComponent: Mock<(location: string, id: string) => void>
}

describe('FloatingPanelRegistrar', () => {
  let api: SubwayBuilderApi
  let error: MockInstance<typeof console.error>
  let hookCallbacks: Map<string, () => void>
  let render: Mock<() => unknown>
  let ui: FakeUi

  function makeRegistrar(): FloatingPanelRegistrar {
    return new FloatingPanelRegistrar(api, render)
  }

  beforeEach(() => {
    host.reactAvailable = true
    error = vi.spyOn(console, 'error').mockImplementation((): void => {})
    hookCallbacks = new Map()
    render = vi.fn()
    ui = { addFloatingPanel: vi.fn(), unregisterComponent: vi.fn() }
    api = {
      ui,
      hooks: Object.fromEntries(LIFECYCLE_HOOKS.map((name) => [
        name,
        vi.fn((callback: () => void): void => {
          hookCallbacks.set(name, callback)
        }),
      ])),
    }
  })

  afterEach(() => {
    error.mockRestore()
  })

  describe('register', () => {
    it('registers the floating panel with the mod’s own render', () => {
      makeRegistrar().register()

      expect(ui.addFloatingPanel).toHaveBeenCalledWith(expect.objectContaining({
        id: PANEL_ID,
        render,
        title: 'Auto Lines',
        tooltip: 'Auto Lines',
      }) as FloatingPanelConfig)
    })

    // An unknown icon key makes the game render no button at all.
    it('asks for an icon the game’s curated set actually has', () => {
      makeRegistrar().register()

      expect(ui.addFloatingPanel.mock.calls[0][0].icon).toBe('Waypoints')
    })

    it('gives the window a starting and a minimum size', () => {
      makeRegistrar().register()

      expect(ui.addFloatingPanel).toHaveBeenCalledWith(expect.objectContaining({
        defaultHeight: 650,
        defaultWidth: 475,
        minHeight: 380,
        minWidth: 320,
      }) as FloatingPanelConfig)
    })

    // Registering twice without unregistering would leave two buttons in the strip.
    it('unregisters the previous button before registering, keeping a single one', () => {
      const calls: string[] = []
      ui.unregisterComponent.mockImplementation((): void => {
        calls.push('unregister')
      })
      ui.addFloatingPanel.mockImplementation((): void => {
        calls.push('register')
      })

      makeRegistrar().register()

      expect(ui.unregisterComponent).toHaveBeenCalledWith('top-bar', PANEL_ID)
      expect(calls).toEqual(['unregister', 'register'])
    })

    it('registers anyway on the first run, when there is nothing to unregister', () => {
      ui.unregisterComponent.mockImplementation((): never => {
        throw new Error('no such component')
      })

      makeRegistrar().register()

      expect(ui.addFloatingPanel).toHaveBeenCalledTimes(1)
    })

    it('registers on a game that exposes no unregister at all', () => {
      api.ui = { addFloatingPanel: ui.addFloatingPanel }

      makeRegistrar().register()

      expect(ui.addFloatingPanel).toHaveBeenCalledTimes(1)
    })

    it('disables itself with an error when the game exposes no ui namespace', () => {
      api.ui = undefined

      makeRegistrar().register()

      expect(error).toHaveBeenCalledWith('[AutoLines]', expect.stringContaining('mod disabled') as string)
    })

    it('disables itself when the game cannot host a floating panel', () => {
      api.ui = {}

      makeRegistrar().register()

      expect(ui.addFloatingPanel).not.toHaveBeenCalled()
      expect(error).toHaveBeenCalledTimes(1)
    })

    it('disables itself when the host supplies no React', () => {
      host.reactAvailable = false

      makeRegistrar().register()

      expect(ui.addFloatingPanel).not.toHaveBeenCalled()
      expect(error).toHaveBeenCalledTimes(1)
    })
  })

  describe('installLifecycleHooks', () => {
    it('subscribes to every hook that can wipe the top bar', () => {
      makeRegistrar().installLifecycleHooks()

      expect([...hookCallbacks.keys()]).toEqual(LIFECYCLE_HOOKS)
    })

    // The game rebuilds the top bar during city load, wiping a mod-load-time
    // registration — the button only survives because the hooks put it back.
    it('re-registers the panel when the game rebuilds the top bar', () => {
      makeRegistrar().installLifecycleHooks()
      expect(ui.addFloatingPanel).not.toHaveBeenCalled()

      hookCallbacks.get('onCityLoad')?.()

      expect(ui.unregisterComponent).toHaveBeenCalledWith('top-bar', PANEL_ID)
      expect(ui.addFloatingPanel).toHaveBeenCalledTimes(1)
    })

    it('does nothing when the game exposes no hooks', () => {
      api.hooks = undefined

      expect(() => makeRegistrar().installLifecycleHooks()).not.toThrow()
    })

    it('skips a hook this game version does not have', () => {
      api.hooks = { onCityLoad: undefined, onGameInit: api.hooks?.onGameInit }

      makeRegistrar().installLifecycleHooks()

      expect([...hookCallbacks.keys()]).toEqual(['onGameInit'])
    })

    it('keeps installing the rest when a hook rejects the subscription', () => {
      api.hooks = {
        ...api.hooks,
        onGameInit: vi.fn((): never => {
          throw new Error('hook is closed')
        }),
      }

      expect(() => makeRegistrar().installLifecycleHooks()).not.toThrow()
      expect([...hookCallbacks.keys()]).toEqual(['onCityLoad', 'onMapReady'])
    })
  })
})
