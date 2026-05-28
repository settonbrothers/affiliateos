// Safe truncation for values headed into bounded DB columns / logs.
export function truncate(value: string, max: number): string {
  if (max <= 0) return ''
  if (value.length <= max) return value
  return value.slice(0, max - 1) + '…'
}
