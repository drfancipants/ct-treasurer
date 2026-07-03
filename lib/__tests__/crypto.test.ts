import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { encryptSecret, decryptSecret } from '../crypto'

describe('encryptSecret / decryptSecret', () => {
  beforeEach(() => {
    vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('round-trips a secret', () => {
    const ciphertext = encryptSecret('super-secret-app-password')
    expect(decryptSecret(ciphertext)).toBe('super-secret-app-password')
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptSecret('same-plaintext')
    const b = encryptSecret('same-plaintext')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('same-plaintext')
    expect(decryptSecret(b)).toBe('same-plaintext')
  })

  it('throws when the ciphertext has been tampered with', () => {
    const ciphertext = encryptSecret('super-secret-app-password')
    const [iv, tag, data] = ciphertext.split('.')
    const tamperedByte = Buffer.from(data, 'base64')
    tamperedByte[0] ^= 0xff
    const tampered = [iv, tag, tamperedByte.toString('base64')].join('.')
    expect(() => decryptSecret(tampered)).toThrow()
  })

  it('throws when decrypted with the wrong key', () => {
    const ciphertext = encryptSecret('super-secret-app-password')
    vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', Buffer.alloc(32, 9).toString('base64'))
    expect(() => decryptSecret(ciphertext)).toThrow()
  })

  it('throws when the key is missing', () => {
    vi.unstubAllEnvs()
    expect(() => encryptSecret('x')).toThrow('CREDENTIALS_ENCRYPTION_KEY is not set')
  })
})
