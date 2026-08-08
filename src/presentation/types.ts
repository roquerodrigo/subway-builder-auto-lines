export enum PanelMode {
  Extend = 'extend',
  New = 'new',
  PerLine = 'per-line',
  Settings = 'settings',
}

export interface StationListItem {
  isNew: boolean
  name: string
}
