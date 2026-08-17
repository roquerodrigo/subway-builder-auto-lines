let issued = 0

// Ids for the tracks and track groups the mod fabricates. The game's renderer has
// crypto.randomUUID; the fallback covers the environments that don't.
export class UniqueId {
  static create(prefix: string): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    issued += 1

    return prefix + '-' + Date.now() + '-' + issued
  }
}
