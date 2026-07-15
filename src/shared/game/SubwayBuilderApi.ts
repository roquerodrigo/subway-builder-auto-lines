import type { Route } from '@/shared/game/Route'
import type { TrainType } from '@/shared/game/TrainType'

export interface FloatingPanelConfig {
  defaultHeight?: number
  defaultWidth?: number
  icon: string
  id: string
  minHeight?: number
  minWidth?: number
  render: (props: { height?: number, width?: number }) => unknown
  title: string
  tooltip: string
}

// The public modding API (window.SubwayBuilderAPI). Only the namespaces/members
// the mod actually uses are typed; all are optional and feature-detected.
export interface SubwayBuilderApi {
  gameState?: {
    getRoutes?(): Route[]
  }
  hooks?: Record<string, ((callback: () => void) => void) | undefined>
  trains?: {
    getTrainType?(id: string): TrainType | undefined
  }
  ui?: {
    addFloatingPanel?(config: FloatingPanelConfig): void
    showNotification?(message: string, kind?: string): void
    unregisterComponent?(location: string, id: string): void
  }
  utils?: { getMap?(): unknown, React?: typeof import('react') }
}
