// jsdom normalizes CSS colors when it parses them (a hex literal comes back as
// `rgb(...)`), so a test can't compare a style against the raw constant the
// component was given. Round-tripping the constant through the same parser makes
// the comparison meaningful without hardcoding the normalized form.
export function asRenderedColor(color: string): string {
  const probe = document.createElement('div')
  probe.style.color = color
  return probe.style.color
}

export function backgroundsOf(elements: Iterable<HTMLElement>): string[] {
  return Array.from(elements, (element) => element.style.background)
}
