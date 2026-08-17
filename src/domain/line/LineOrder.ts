import type { Route } from '@/shared/game/Route'

// Digits compare as numbers, so "Line 9" comes before "Line 10" rather than after
// it, and case and accents don't split otherwise-equal names apart.
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

// The order the game's own line list reads off the routes array: lines are grouped
// by color in first-appearance order, and follow the array within each group. So
// sorting the array is what sorts the panel.
export class LineOrder {
  static byName(routes: Route[]): Route[] {
    const real = routes.filter((route) => route.tempParentId == null)
    const temporary = routes.filter((route) => route.tempParentId != null)

    return real
      .slice()
      .sort((one, other) => byName.compare(LineOrder.nameOf(one), LineOrder.nameOf(other)))
      .concat(temporary)
  }

  // What the game shows for the line: its name, or the bullet it was labelled with.
  static nameOf(route: Route): string {
    return route.fullName ?? route.bullet ?? ''
  }

  static sameOrder(one: Route[], other: Route[]): boolean {
    return one.length === other.length && one.every((route, index) => route.id === other[index].id)
  }
}
