/** Cream / charcoal used as text on accent-filled surfaces. */
const ON_DARK_ACCENT = '#f6f1e6'
const ON_LIGHT_ACCENT = '#1a1a1a'

/** Relative luminance 0–1 for a #RRGGBB color. */
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length !== 6) return 0
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Text color that stays readable on top of the given accent fill. */
export function onAccentColor(accentHex: string): string {
  return luminance(accentHex) > 0.6 ? ON_LIGHT_ACCENT : ON_DARK_ACCENT
}

/** Apply user accent (+ readable on-accent text). Does not touch brand terra. */
export function applyAccentColor(accentHex: string) {
  document.documentElement.style.setProperty('--color-accent', accentHex)
  document.documentElement.style.setProperty('--color-on-accent', onAccentColor(accentHex))
}
