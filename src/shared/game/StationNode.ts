import type { Coordinate } from '@/shared/game/Coordinate'

// A station track-node = one platform. A station owns two of them. The game's own
// field for these is `stNodes`/`stNodeIds`, kept verbatim on the contract types.
export interface StationNode {
  id: string
  center: Coordinate
  trackIds?: string[]
}
