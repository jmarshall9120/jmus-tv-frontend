/**
 * Pre-cache a Cognito ID token for API tests (SRP flow).
 * Run: npm run test:auth
 * Requires: COGNITO_TEST_USER and COGNITO_TEST_PASSWORD in env (or .env.test loaded by you).
 */
import { getTestToken } from '../tests/utils/getTestToken.mjs'

getTestToken()
  .then(() => console.log('Token cached at tests/utils/.test_auth_cache.json'))
  .catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
