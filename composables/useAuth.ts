/**
 * Authentication Composable - Simple OAuth Code Flow
 * 
 * Flow:
 * 1. Client app redirects to SSO with client_app_id from .env and redirect URL
 * 2. SSO authenticates user and generates a code
 * 3. SSO calls GraphQL StoreAuthCode with tokens, code, client id, and domain
 * 4. Backend validates client id against registered domain
 * 5. SSO redirects to client app with the code
 * 6. Client app calls GraphQL ExchangeAuthCode endpoint with the code
 * 7. Backend validates caller domain and code, returns tokens
 * 8. Client app stores tokens in localStorage
 * 9. Client fetches user grants via listGrantByCognito_id for feature visibility
 */

export interface Grant {
  cognito_id?: string | null
  action?: string | null
  granted_by?: string | null
  expires_at?: string | null
  _created_at?: string | null
  _updated_at?: string | null
  _is_retired?: boolean | null
  _row_hash?: string | null
}

export const useAuth = () => {
  const runtimeConfig = useRuntimeConfig()
  const cognitoClientAppId = (runtimeConfig.public.cognitoClientAppId as string) || 'demo-client'

  /**
   * Get SSO URL based on environment
   */
  const getSsoUrl = (): string => {
    const env = runtimeConfig.public.env || 'local'
    return env === 'prod' ? 'https://jmus.io/sso' : 'https://dev.jmus.io/sso'
  }

  /**
   * Get callback URL for OAuth redirect
   */
  const getCallbackUrl = (): string => {
    if (import.meta.server) return 'http://localhost:3000/callback'
    return `${window.location.origin}/callback`
  }

  /**
   * Get GraphQL endpoint URL
   */
  const getGraphQLEndpoint = (): string => {
    const config = useState<{ 
      grantsEndpoint: string
    }>('amplify:pub').value
    
    if (!config) {
      throw new Error('Amplify config not available')
    }
    
    return config.grantsEndpoint
  }

  /**
   * Get Grants API Key
   */
  const getGrantsApiKey = (): string => {
    const config = useState<{ 
      grantsApiKey: string
    }>('amplify:pub').value
    
    if (!config) {
      throw new Error('Amplify config not available')
    }
    
    return config.grantsApiKey
  }

  /** User grants from listGrantByCognito_id (for feature visibility). Cleared on signOut. */
  const userGrants = useState<Grant[]>('auth:userGrants', () => [])

  /**
   * Fetch user grants from the Grants API via getProfile (authenticated user's grants). AppSync Cognito auth requires the ID token (not access token). Do not send x-api-key so AppSync uses the Bearer token.
   */
  const fetchGrants = async (): Promise<Grant[]> => {
    if (import.meta.server) return []
    const idToken = getIdToken()
    if (!idToken) {
      userGrants.value = []
      return []
    }
    const endpoint = getGraphQLEndpoint()
    const query = `
      query GetProfile {
        getProfile {
          cognito_id
          grants {
            cognito_id
            action
            granted_by
            expires_at
            _created_at
            _updated_at
            _is_retired
            _row_hash
          }
        }
      }
    `
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: idToken.startsWith('Bearer ') ? idToken : `Bearer ${idToken}`,
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      })
      if (!response.ok) {
        console.warn('[useAuth] fetchGrants failed:', response.status)
        userGrants.value = []
        return []
      }
      const result = await response.json()
      if (result.errors) {
        console.warn('[useAuth] fetchGrants GraphQL errors:', result.errors)
        userGrants.value = []
        return []
      }
      const profile = result.data?.getProfile
      const list = profile?.grants
      const grants = Array.isArray(list) ? list : []
      userGrants.value = grants
      return grants
    } catch (e) {
      console.warn('[useAuth] fetchGrants error:', e)
      userGrants.value = []
      return []
    }
  }

  /**
   * Check if the current user has a grant for the given action (for feature flags). Uses API-fetched grants when available.
   * Optionally pass a second arg to treat expired grants as not granted.
   */
  const hasGrant = (action: string, options?: { ignoreExpired?: boolean }): boolean => {
    if (import.meta.server) return false
    const ignoreExpired = options?.ignoreExpired !== false
    const grants = userGrants.value
    if (grants.length === 0) {
      const fromToken = getUserGrants()
      if (fromToken.length > 0) return fromToken.includes(action)
      return false
    }
    const now = new Date().toISOString()
    for (const g of grants) {
      if (g.action !== action) continue
      if (g._is_retired) continue
      if (ignoreExpired && g.expires_at && g.expires_at < now) continue
      return true
    }
    return false
  }

  /**
   * Redirect to SSO for OAuth authorization
   */
  const signIn = (email?: string) => {
    if (import.meta.server) {
      console.warn('[useAuth] signIn called on server - ignoring')
      return
    }

    // Generate state parameter for CSRF protection
    const state = crypto.randomUUID()
    localStorage.setItem('oauth_state', state)
    
    // Store intended redirect (but not callback or login pages)
    const currentPath = window.location.pathname + window.location.search
    const shouldSaveRedirect = !currentPath.startsWith('/callback') && !currentPath.startsWith('/login')
    
    if (shouldSaveRedirect) {
      localStorage.setItem('auth_redirect', currentPath)
    } else {
      // Default to home if we're on callback or login
      localStorage.setItem('auth_redirect', '/')
    }

    const ssoUrl = getSsoUrl()
    const callbackUrl = getCallbackUrl()
    
    // Build OAuth authorization URL with client_id
    const params = new URLSearchParams()
    params.set('client_id', cognitoClientAppId)
    params.set('redirect_uri', callbackUrl)
    params.set('state', state)
    
    if (email) {
      params.set('email', email)
    }

    const loginUrl = `${ssoUrl}?${params.toString()}`
    console.log('[useAuth] Redirecting to SSO for OAuth')
    console.log('[useAuth] SSO URL:', loginUrl)
    console.log('[useAuth] client_id:', cognitoClientAppId)
    console.log('[useAuth] redirect_uri:', callbackUrl)
    console.log('[useAuth] state:', state)
    
    window.location.href = loginUrl
  }

  /**
   * Exchange authorization code for tokens via GraphQL
   */
  const exchangeCodeForTokens = async (code: string): Promise<{
    accessToken: string
    idToken: string
    refreshToken: string
    expiresAt: string
  }> => {
    const graphqlEndpoint = getGraphQLEndpoint()
    const apiKey = getGrantsApiKey()
    
    // Call ExchangeAuthCode GraphQL query with clientId
    const query = `
      query ExchangeAuthCode($code: String!, $clientId: String!) {
        exchangeAuthCode(code: $code, clientId: $clientId) {
          accessToken
          idToken
          refreshToken
          expiresAt
          clientId
        }
      }
    `
    
    const response = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        query,
        variables: { 
          code,
          clientId: cognitoClientAppId
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token exchange failed: ${error}`)
    }

    const result = await response.json()
    
    if (result.errors) {
      throw new Error(`GraphQL error: ${result.errors[0].message}`)
    }
    
    if (!result.data?.exchangeAuthCode) {
      throw new Error('No data returned from exchangeAuthCode')
    }
    
    return {
      accessToken: result.data.exchangeAuthCode.accessToken,
      idToken: result.data.exchangeAuthCode.idToken,
      refreshToken: result.data.exchangeAuthCode.refreshToken,
      expiresAt: result.data.exchangeAuthCode.expiresAt,
    }
  }

  /**
   * Refresh tokens using refresh token with Cognito
   */
  const refreshTokens = async (): Promise<boolean> => {
    const { refreshToken } = getTokens()
    
    if (!refreshToken) {
      console.error('[useAuth] No refresh token available')
      return false
    }

    // Cognito requires the same ClientId that issued the refresh token ("Refresh Token has different Client" otherwise).
    // Use the clientId returned from ExchangeAuthCode (the app client SSO used with Cognito), not necessarily our redirect client_id.
    const clientIdForRefresh = (typeof localStorage !== 'undefined' && localStorage.getItem('oauth_client_id')) || cognitoClientAppId

    try {
      const config = useState<{ 
        userPoolId: string
        region: string
      }>('amplify:pub').value
      
      if (!config) {
        throw new Error('Amplify config not available')
      }

      const cognitoEndpoint = `https://cognito-idp.${config.region}.amazonaws.com/`
      
      const response = await fetch(cognitoEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
        },
        body: JSON.stringify({
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          ClientId: clientIdForRefresh,
          AuthParameters: {
            REFRESH_TOKEN: refreshToken,
          },
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        console.warn('[useAuth] Cognito refresh failed:', response.status, body)
        // Clear invalid/expired tokens so we don't keep retrying
        if (response.status === 400 || response.status === 401) {
          clearStoredTokens()
        }
        throw new Error('Token refresh failed')
      }

      const data = await response.json()
      
      if (!data.AuthenticationResult) {
        throw new Error('No tokens in refresh response')
      }
      
      // Calculate new expiry time (typically 1 hour)
      const expiresIn = data.AuthenticationResult.ExpiresIn || 3600
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
      
      saveTokens({
        accessToken: data.AuthenticationResult.AccessToken,
        idToken: data.AuthenticationResult.IdToken,
        refreshToken: refreshToken, // Refresh token not returned on refresh
        expiresAt,
      })

      console.log('[useAuth] ✅ Tokens refreshed successfully')
      return true
    } catch (error) {
      console.error('[useAuth] Token refresh error:', error)
      return false
    }
  }

  /**
   * Start automatic token refresh loop
   */
  const startTokenRefreshLoop = () => {
    if (import.meta.server) return
    
    // Clear any existing interval
    const existingInterval = (window as any).__authRefreshInterval
    if (existingInterval) {
      clearInterval(existingInterval)
    }
    
    // Check every minute if tokens need refresh
    const interval = setInterval(async () => {
      const { tokenExpiry } = getTokens()
      if (!tokenExpiry) return
      
      const expiry = parseInt(tokenExpiry)
      const now = Date.now()
      const fiveMinutes = 5 * 60 * 1000
      
      // Refresh if expiring in less than 5 minutes
      if (expiry - now < fiveMinutes && expiry > now) {
        console.log('[useAuth] Tokens expiring soon, refreshing...')
        const success = await refreshTokens()
        if (!success) {
          console.error('[useAuth] Token refresh failed - user may need to re-login')
          clearInterval(interval)
        }
      }
    }, 60000) // Check every minute
    
    // Store interval reference for cleanup
    ;(window as any).__authRefreshInterval = interval
    
    console.log('[useAuth] ✅ Token refresh loop started')
  }

  /**
   * Store tokens in localStorage and start refresh loop.
   * clientId (from ExchangeAuthCode) is the Cognito app client that issued the tokens; we use it for refresh.
   */
  const saveTokens = (tokens: {
    accessToken: string
    idToken: string
    refreshToken: string
    expiresAt: string
    clientId?: string
  }) => {
    const expiryTime = new Date(tokens.expiresAt).getTime()
    
    localStorage.setItem('access_token', tokens.accessToken)
    localStorage.setItem('id_token', tokens.idToken)
    localStorage.setItem('refresh_token', tokens.refreshToken)
    localStorage.setItem('token_expiry', expiryTime.toString())
    if (tokens.clientId) {
      localStorage.setItem('oauth_client_id', tokens.clientId)
    }
    
    console.log('[useAuth] ✅ Tokens saved to localStorage')
    
    // Start automatic refresh loop
    startTokenRefreshLoop()
  }

  /**
   * Clear stored tokens (e.g. after failed refresh). Does not redirect.
   */
  const clearStoredTokens = () => {
    if (import.meta.server) return
    localStorage.removeItem('access_token')
    localStorage.removeItem('id_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('token_expiry')
    localStorage.removeItem('oauth_client_id')
    userGrants.value = []
    console.log('[useAuth] Cleared stored tokens (invalid/expired refresh)')
  }

  /**
   * Get stored tokens from localStorage
   */
  const getTokens = () => {
    return {
      accessToken: localStorage.getItem('access_token'),
      idToken: localStorage.getItem('id_token'),
      refreshToken: localStorage.getItem('refresh_token'),
      tokenExpiry: localStorage.getItem('token_expiry'),
    }
  }

  /**
   * Check if user is authenticated.
   * If access/id tokens are missing or expired but we have a refresh token,
   * we refresh directly with Cognito first. Only redirect to SSO when refresh fails or no refresh token.
   */
  const isAuthenticated = async (): Promise<boolean> => {
    if (import.meta.server) return false

    const { accessToken, idToken, refreshToken, tokenExpiry } = getTokens()

    const hasValidAccessTokens = accessToken && idToken && (() => {
      const expiry = parseInt(tokenExpiry || '0')
      return expiry > Date.now()
    })()

    if (hasValidAccessTokens) {
      console.log('[useAuth.isAuthenticated] ✅ Valid tokens')
      return true
    }

    // Tokens missing or expired — try refresh with Cognito before sending user to SSO
    if (refreshToken) {
      console.log('[useAuth.isAuthenticated] Tokens missing or expired; refreshing with Cognito...')
      const refreshed = await refreshTokens()
      if (refreshed) {
        console.log('[useAuth.isAuthenticated] ✅ Refreshed via Cognito')
        return true
      }
      console.log('[useAuth.isAuthenticated] ❌ Refresh failed')
    } else {
      console.log('[useAuth.isAuthenticated] ❌ No tokens (no refresh token)')
    }

    return false
  }

  /**
   * Get access token for API calls
   */
  const getAccessToken = (): string | null => {
    if (import.meta.server) return null
    return localStorage.getItem('access_token')
  }

  /**
   * Get ID token for user info
   */
  const getIdToken = (): string | null => {
    if (import.meta.server) return null
    return localStorage.getItem('id_token')
  }

  /**
   * Sign out user
   */
  const signOut = () => {
    if (import.meta.server) return

    clearStoredTokens()
    localStorage.removeItem('oauth_state')
    localStorage.removeItem('auth_redirect')

    // Redirect to SSO logout
    const ssoUrl = getSsoUrl()
    const redirectUrl = window.location.origin
    window.location.href = `${ssoUrl}/logout?redirect=${encodeURIComponent(redirectUrl)}`
  }

  /**
   * Get user email from ID token
   */
  const getUserEmail = (): string | null => {
    const idToken = getIdToken()
    if (!idToken) return null

    try {
      const parts = idToken.split('.')
      if (parts.length < 2 || !parts[1]) return null
      const payload = JSON.parse(atob(parts[1]))
      return payload.email || null
    } catch {
      return null
    }
  }

  /**
   * Get Cognito user ID from ID token
   */
  const getCognitoId = (): string | null => {
    const idToken = getIdToken()
    if (!idToken) return null

    try {
      const parts = idToken.split('.')
      if (parts.length < 2 || !parts[1]) return null
      const payload = JSON.parse(atob(parts[1]))
      return payload.sub || null
    } catch {
      return null
    }
  }

  /**
   * Get user grants from ID token
   */
  const getUserGrants = (): string[] => {
    const idToken = getIdToken()
    if (!idToken) return []

    try {
      const parts = idToken.split('.')
      if (parts.length < 2 || !parts[1]) return []
      const payload = JSON.parse(atob(parts[1]))
      return payload['custom:grants']?.split(',') || []
    } catch {
      return []
    }
  }

  return {
    signIn,
    signOut,
    isAuthenticated,
    exchangeCodeForTokens,
    saveTokens,
    getAccessToken,
    getIdToken,
    getUserEmail,
    getCognitoId,
    getUserGrants,
    userGrants,
    fetchGrants,
    hasGrant,
    refreshTokens,
    startTokenRefreshLoop,
  }
}
