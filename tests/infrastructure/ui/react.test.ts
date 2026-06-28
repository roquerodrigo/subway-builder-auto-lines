import * as ReactModule from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Fragment, h, isReactAvailable, React } from '@/infrastructure/ui/react'

type Host = { SubwayBuilderAPI?: unknown }

// The shim reads the host React at module-init, so the only way to see it miss is
// to re-evaluate the module against a host that has none.
async function importWithHost(hostApi: unknown): Promise<typeof import('@/infrastructure/ui/react')> {
  vi.resetModules()
  const host = globalThis as Host
  const original = host.SubwayBuilderAPI
  host.SubwayBuilderAPI = hostApi
  try {
    return await import('@/infrastructure/ui/react')
  } finally {
    host.SubwayBuilderAPI = original
  }
}

describe('the host React shim', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('hands back the React the host supplies, never a bundled one', () => {
    expect(React).toBe(ReactModule)
    expect(h).toBe(ReactModule.createElement)
    expect(Fragment).toBe(ReactModule.Fragment)
  })

  it('reports React available when the host supplies a usable one', () => {
    expect(isReactAvailable()).toBe(true)
  })

  it('builds elements through the host factory', () => {
    const element = h('div', { title: 'Auto Lines' }) as { props: { title: string }, type: string }

    expect(element.type).toBe('div')
    expect(element.props.title).toBe('Auto Lines')
  })

  // A missing API must not throw at module-init: imports hoist, so this runs
  // before main.tsx can guard and disable the mod gracefully.
  it('loads without throwing when the game exposes no api', async () => {
    const shim = await importWithHost(undefined)

    expect(shim.isReactAvailable()).toBe(false)
    expect(shim.h).toBeUndefined()
    expect(shim.Fragment).toBeUndefined()
  })

  it('reports React unavailable when the api carries no React', async () => {
    const shim = await importWithHost({ utils: {} })

    expect(shim.isReactAvailable()).toBe(false)
  })

  it('reports React unavailable when the host React has no createElement', async () => {
    const shim = await importWithHost({ utils: { React: {} } })

    expect(shim.isReactAvailable()).toBe(false)
  })
})
