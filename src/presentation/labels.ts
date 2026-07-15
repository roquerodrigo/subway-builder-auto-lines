import type { OrphanGroup } from '@/domain/newline/OrphanGroup'
import type { Route } from '@/shared/game/Route'
import type { SubwayBuilderApi } from '@/shared/game/SubwayBuilderApi'

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function groupLabel(group: OrphanGroup): string {
  const terminals = group.terminalNames

  return terminals ? `${terminals[0]} ↔ ${terminals[1]}` : group.names.slice(0, 2).join(', ')
}

// Real (non-preview) routes from the public API.
export function realRoutes(api: SubwayBuilderApi): Route[] {
  const routes = api.gameState?.getRoutes?.() ?? []

  return routes.filter((route) => route.tempParentId == null)
}

export function routeLabel(route: Route): string {
  return 'Line ' + (route.bullet ?? '?')
}
