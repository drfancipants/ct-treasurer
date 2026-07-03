import { describe, it, expect } from 'vitest'
import { nthLetter, chooseEventLetter } from '../events'

describe('nthLetter', () => {
  it('maps indexes to spreadsheet-style letters', () => {
    expect(nthLetter(0)).toBe('A')
    expect(nthLetter(25)).toBe('Z')
    expect(nthLetter(26)).toBe('AA')
    expect(nthLetter(27)).toBe('AB')
  })
})

describe('chooseEventLetter', () => {
  it('auto-assigns the first unused letter (fills gaps)', () => {
    expect(chooseEventLetter(undefined, [])).toBe('A')
    expect(chooseEventLetter(undefined, ['A', 'B'])).toBe('C')
    // A freed by deletion is reused before advancing
    expect(chooseEventLetter(undefined, ['B', 'C'])).toBe('A')
  })

  it('accepts a requested unused letter (case-insensitive, uppercased)', () => {
    expect(chooseEventLetter('d', ['A', 'B'])).toBe('D')
    expect(chooseEventLetter('A', ['B', 'C'])).toBe('A')
  })

  it('rejects a letter already in use', () => {
    expect(() => chooseEventLetter('B', ['A', 'B'])).toThrow(/already used/)
  })

  it('rejects invalid letters', () => {
    expect(() => chooseEventLetter('5', [])).toThrow(/A–Z/)
    expect(() => chooseEventLetter('AB1', [])).toThrow(/A–Z/)
  })
})
