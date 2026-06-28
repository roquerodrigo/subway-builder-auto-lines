// UI edit actions the game's route-edit guard checks (setUserAction). The mod
// pairs a preview with DrawLineTrack while editing and clears to None after, so
// the guard doesn't treat the mod's preview as an orphaned unsaved change.
export enum UserAction {
  DrawLineTrack = 'draw-line-track',
  None = 'none',
}
