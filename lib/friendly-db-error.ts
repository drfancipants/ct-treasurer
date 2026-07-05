import { Prisma } from '@prisma/client'

/**
 * Next.js redacts thrown-error messages from Server Actions in production
 * unless the action itself catches and rethrows — an unhandled Prisma error
 * would otherwise reach the client as an opaque digest with no detail. Maps
 * common Prisma error conditions to a message that's actually useful without
 * leaking raw DB/query internals (file paths, query text) to the client —
 * those still go to the server log via console.error.
 */
export function friendlyDbError(err: unknown, context: string, logTag: string): Error {
  console.error(`${logTag} ${context}:`, err)

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2000') {
      return new Error(`${context}: a field value is too long — check for an unusually long name, address, or note.`)
    }
    if (err.code === 'P2002') {
      return new Error(`${context}: a duplicate entry conflict occurred.`)
    }
    return new Error(`${context}: database error (${err.code}).`)
  }

  // Raw DB errors the query engine couldn't map to a known Prisma code
  // (e.g. a Postgres constraint violation) surface as PrismaClientUnknownRequestError,
  // whose .message is a full multi-line dump including file paths and query
  // text — never show that raw text to the client. Pattern-match the
  // Postgres error text for the cases worth calling out specifically.
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const raw = err.message
    if (raw.includes('numeric field overflow')) {
      return new Error(`${context}: an amount has too many digits (check for a typo, e.g. an extra zero).`)
    }
    return new Error(`${context}: unexpected database error. Check the CSV for unusual values.`)
  }

  const message = err instanceof Error ? err.message : String(err)
  // Only pass through short, single-line messages (e.g. our own thrown
  // "Forbidden" or "Event not found") — anything longer is likely an
  // unrelated internal error we shouldn't echo verbatim to the client.
  if (message.length < 200 && !message.includes('\n')) {
    return new Error(`${context}: ${message}`)
  }
  return new Error(`${context}: unexpected error.`)
}
