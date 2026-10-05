// Warnings for problems the library recovered from
// Each message is logged once so a loop cannot flood the console

const seen = new Set<string>()

export function warn(message: string): void {
  if (seen.has(message)) return
  seen.add(message)
  if (seen.size > 500) seen.clear()
  if (typeof console !== 'undefined') console.warn(`[dashboard-grid] ${message}`)
}
