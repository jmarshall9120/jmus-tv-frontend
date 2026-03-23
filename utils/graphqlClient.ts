/**
 * GraphQL Client Utility
 * 
 * Direct fetch-based GraphQL client to replace Amplify API.
 * Gives us full control over authentication headers.
 */

interface GraphQLRequest {
  query: string
  variables?: Record<string, any>
  operationName?: string
}

interface GraphQLResponse<T = any> {
  data?: T
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
    extensions?: Record<string, any>
  }>
}

/**
 * Execute a GraphQL request
 */
export async function graphqlRequest<T = any>(
  endpoint: string,
  request: GraphQLRequest,
  authToken?: string
): Promise<GraphQLResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (authToken) {
    headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: request.query,
      variables: request.variables,
      operationName: request.operationName,
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Create a GraphQL client for a specific endpoint
 */
export function createGraphQLClient(endpoint: string) {
  return {
    /**
     * Execute a query or mutation
     */
    async request<T = any>(
      request: GraphQLRequest,
      authToken?: string
    ): Promise<GraphQLResponse<T>> {
      return graphqlRequest<T>(endpoint, request, authToken)
    },

    /**
     * Execute a query
     */
    async query<T = any>(
      query: string,
      variables?: Record<string, any>,
      authToken?: string
    ): Promise<GraphQLResponse<T>> {
      return graphqlRequest<T>(endpoint, { query, variables }, authToken)
    },

    /**
     * Execute a mutation
     */
    async mutate<T = any>(
      mutation: string,
      variables?: Record<string, any>,
      authToken?: string
    ): Promise<GraphQLResponse<T>> {
      return graphqlRequest<T>(endpoint, { query: mutation, variables }, authToken)
    },
  }
}
