import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

/**
 * Plaid API client — server-side only.
 * Never import this in client components.
 *
 * Sandbox credentials for testing:
 *   Username: user_good
 *   Password: pass_good
 *   (works at any institution shown in the Link UI)
 */
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV ?? 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID ?? '',
      'PLAID-SECRET': process.env.PLAID_SECRET ?? '',
    },
  },
})

export const plaidClient = new PlaidApi(configuration)
