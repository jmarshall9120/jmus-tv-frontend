/**
 * Calls the REAL Stryker GraphQL API so you can see the response shape.
 * Run: npx vitest run tests/matchTablesApi.api.test.ts
 *
 * Set env before running:
 *   STRYKER_GRAPHQL_URL=https://your-appsync-api.appsync-api.region.amazonaws.com/graphql
 *   STRYKER_ID_TOKEN=<Cognito ID token (Bearer not required)>
 *
 * Get a token: sign in to the app, then in browser devtools Application > Local Storage
 * copy the token, or use Network tab and copy Authorization header value after "Bearer ".
 */
import { graphqlRequest } from '../utils/graphqlClient'

const LIST_STD_MATCHES = `
  query ListSTDMatches($type: String, $limit: Int, $nextToken: String) {
    listSTDMatches(type: $type, limit: $limit, nextToken: $nextToken) {
      items {
        PK
        SK
        type
        canonical_name
        aliases
        context
        _created_at
        _updated_at
        _is_retired
      }
      count
      nextToken
    }
  }
`

describe('Match Tables API (real call)', () => {
  it('calls listSTDMatches and logs response so we can see API shape', async () => {
    const endpoint = process.env.STRYKER_GRAPHQL_URL
    const token = process.env.STRYKER_ID_TOKEN

    if (!endpoint || !token) {
      console.log('\n--- Skip: set STRYKER_GRAPHQL_URL and STRYKER_ID_TOKEN to run this test ---')
      return
    }

    const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`
    const response = await graphqlRequest<{ listSTDMatches?: { items: unknown[]; count: number; nextToken?: string | null } }>(
      endpoint,
      {
        query: LIST_STD_MATCHES,
        variables: { type: 'STATION', limit: 20 },
      },
      authHeader
    )

    // Log full response so you can see it in the test run output
    console.log('\n--- listSTDMatches(STATION) API response ---')
    console.log(JSON.stringify(response, null, 2))

    if (response.errors?.length) {
      throw new Error(`GraphQL errors: ${response.errors.map((e) => e.message).join('; ')}`)
    }

    expect(response.data).toBeDefined()
    expect(response.data?.listSTDMatches).toBeDefined()
    expect(Array.isArray(response.data?.listSTDMatches?.items)).toBe(true)
  })

  it('calls listSTDMatches for TFN and logs response', async () => {
    const endpoint = process.env.STRYKER_GRAPHQL_URL
    const token = process.env.STRYKER_ID_TOKEN

    if (!endpoint || !token) {
      return
    }

    const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`
    const response = await graphqlRequest<{ listSTDMatches?: { items: unknown[]; count: number; nextToken?: string | null } }>(
      endpoint,
      {
        query: LIST_STD_MATCHES,
        variables: { type: 'TFN', limit: 20 },
      },
      authHeader
    )

    console.log('\n--- listSTDMatches(TFN) API response ---')
    console.log(JSON.stringify(response, null, 2))

    if (response.errors?.length) {
      throw new Error(`GraphQL errors: ${response.errors.map((e) => e.message).join('; ')}`)
    }

    expect(response.data).toBeDefined()
    expect(response.data?.listSTDMatches).toBeDefined()
  })
})
