/**
 * Composable for Stryker GraphQL API
 * Uses direct fetch with Authorization header (id token).
 * Endpoint and auth come from amplify:pub and useAuth.
 */
import { graphqlRequest } from '@/utils/graphqlClient'

export function useStrykerData() {
  const { getIdToken } = useAuth()

  function getEndpoint(): string {
    const config = useState<{ dataApiUrl: string }>('amplify:pub').value
    if (!config?.dataApiUrl) {
      throw new Error('Data API URL not available (amplify:pub.dataApiUrl)')
    }
    return config.dataApiUrl
  }

  /**
   * Execute a GraphQL request against the Stryker API with current auth token
   */
  async function request<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
    const endpoint = getEndpoint()
    const token = getIdToken()
    if (!token) {
      throw new Error('Not authenticated')
    }
    return graphqlRequest<T>(endpoint, { query, variables }, token)
  }

  /**
   * Check result for GraphQL errors and throw with a clear message
   */
  function checkGraphQLErrors(result: { errors?: Array<{ message: string }> }, operation: string): void {
    if (result.errors?.length) {
      const messages = result.errors.map((e) => e.message).join('; ')
      throw new Error(`GraphQL ${operation} failed: ${messages}`)
    }
  }

  return {
    getEndpoint,
    request,
    checkGraphQLErrors,
  }
}
