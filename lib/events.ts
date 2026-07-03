/** The nth spreadsheet-style letter: 0→A, 25→Z, 26→AA, … */
export function nthLetter(n: number): string {
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

/**
 * Decide the letter to store for an event. If `requested` is given it must be
 * a valid, unused letter (else throws); otherwise the first letter not already
 * used is returned. Comparison is case-insensitive; the result is uppercase.
 */
export function chooseEventLetter(requested: string | undefined, usedLetters: string[]): string {
  const used = new Set(usedLetters.map((l) => l.toUpperCase()))
  const chosen = requested?.trim().toUpperCase()
  if (chosen) {
    if (!/^[A-Z]{1,3}$/.test(chosen)) throw new Error('Event letter must be A–Z')
    if (used.has(chosen)) throw new Error(`Letter ${chosen} is already used by another event`)
    return chosen
  }
  for (let i = 0; ; i++) {
    const l = nthLetter(i)
    if (!used.has(l)) return l
  }
}
