export enum PanelMode {
  Extend = 'extend',
  New = 'new',
  Settings = 'settings',
}

export interface StationListItem {
  isNew: boolean
  name: string
}
