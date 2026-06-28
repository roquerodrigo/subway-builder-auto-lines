import type { Route } from '@/shared/game/Route'

// Next sequential numeric line label (1, 2, 3, …) — never letters. generateRoute
// ignores customBullet, so the mod assigns this onto the route itself.
export class BulletSequence {
  static next(routes: Route[]): string {
    const numbers = routes
      .filter((route) => route.tempParentId == null)
      .map((route) => parseInt(route.bullet ?? '', 10))
      .filter((n) => !Number.isNaN(n))
    return String((numbers.length ? Math.max(...numbers) : 0) + 1)
  }
}
