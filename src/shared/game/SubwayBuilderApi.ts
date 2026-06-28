import type { Route } from '@/shared/game/Route'
import type { TrainType } from '@/shared/game/TrainType'

export interface FloatingPanelConfig {
  id: string
  icon: string
  tooltip: string
  title: string
  defaultWidth?: number
  defaultHeight?: number
  minWidth?: number
  minHeight?: number
  render: (props: { width?: number, height?: number }) => unknown
}

// The public modding API (window.SubwayBuilderAPI). Only the namespaces/members
// the mod actually uses are typed; all are optional and feature-detected.
export interface SubwayBuilderApi {
  utils?: { React?: typeof import('react'), getMap?(): unknown }
  ui?: {
    addFloatingPanel?(config: FloatingPanelConfig): void
    unregisterComponent?(location: string, id: string): void
    showNotification?(message: string, kind?: string): void
  }
  gameState?: {
    getRoutes?(): Route[]
  }
  trains?: {
    getTrainType?(id: string): TrainType | undefined
  }
  hooks?: Record<string, ((callback: () => void) => void) | undefined>
}
