/**
 * Test auth with cached Cognito tokens (SRP, no browser).
 * Mirrors Python: load .env, SRP with BackendJMusTestingClient, cache in .test_auth_cache.json.
 *
 * Config: .env or .env.test (COGNITO_TEST_EMAIL, COGNITO_TEST_PASSWORD, optional COGNITO_TEST_CLIENT_ID).
 * Default client: BackendJMusTestingClient from .jmus/outputs.json (cognito-dev).
 * Cache: tests/utils/.test_auth_cache.json (gitignored), per-email, with cached_at; reuse if not expired.
 *
 * Set DEBUG_COGNITO=1 to log raw request/response to Cognito (InitiateAuth / RespondToAuthChallenge).
 */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const outputsPath = path.join(projectRoot, '.jmus', 'outputs.json')
const envFile = path.join(projectRoot, '.env')
const envTestPath = path.join(projectRoot, '.env.test')
const CACHE_FILE = path.join(__dirname, '.test_auth_cache.json')

const BUFFER_MS = 5 * 60 * 1000 // refresh 5 min before expiry
const DEFAULT_EXPIRES_IN_MS = 60 * 60 * 1000 // 1 hour

function loadEnvFile (filePath) {
  try {
    if (!fs.existsSync(filePath)) return
    const raw = fs.readFileSync(filePath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (key && !process.env[key]) process.env[key] = value
    }
  } catch (_) {}
}

function loadEnv () {
  loadEnvFile(envFile)
  loadEnvFile(envTestPath)
}

function loadOutputs () {
  const raw = fs.readFileSync(outputsPath, 'utf8')
  return JSON.parse(raw)
}

function loadCache () {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {}
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function saveCache (data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (e) {
    console.warn('Could not save auth cache:', e?.message)
  }
}

function isTokenExpired (cachedAt, expiresInMs = DEFAULT_EXPIRES_IN_MS) {
  const age = Date.now() - cachedAt
  return age > (expiresInMs - BUFFER_MS)
}

// amazon-cognito-identity-js-node hardcodes LocalStorage('/tmp/storage'); on Windows that becomes M:\tmp\storage
function ensureLocalStorageDir () {
  const tmpStorage = path.join(path.resolve(projectRoot).split(path.sep)[0] || '', 'tmp', 'storage')
  fs.mkdirSync(tmpStorage, { recursive: true })
}

/**
 * Get ID token for testing: from cache if valid, else SRP auth and cache.
 * Uses COGNITO_TEST_EMAIL (or COGNITO_TEST_USER) and COGNITO_TEST_PASSWORD from .env / .env.test.
 * Uses COGNITO_TEST_CLIENT_ID or BackendJMusTestingClient from outputs.
 */
export async function getTestToken () {
  loadEnv()

  const email = process.env.COGNITO_TEST_EMAIL || process.env.COGNITO_TEST_USER
  const password = process.env.COGNITO_TEST_PASSWORD

  if (!email || !password) {
    throw new Error(
      'Email and password required. Set in .env or .env.test:\n' +
      '  COGNITO_TEST_EMAIL=your-email@example.com\n' +
      '  COGNITO_TEST_PASSWORD=your-password'
    )
  }

  // Check cache first
  const cache = loadCache()
  const userCache = cache[email]
  if (userCache?.id_token && !isTokenExpired(userCache.cached_at)) {
    return userCache.id_token
  }

  // SRP auth
  ensureLocalStorageDir()

  // Optional: log raw Cognito API request/response for debugging (run with DEBUG_COGNITO=1)
  function patchRequest (module) {
    const original = module.request
    module.request = function (options, callback) {
      const host = typeof options === 'object' && (options.hostname || options.host || '')
      const isCognito = String(host).includes('cognito-idp')
      const out = original.call(this, options, (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString()
          console.log('[DEBUG_COGNITO] Response:', res.statusCode, body)
        })
        if (callback) callback(res)
      })
      if (isCognito && options?.method === 'POST' && out?.write) {
        const origWrite = out.write.bind(out)
        out.write = function (chunk, ...args) {
          try {
            const body = typeof chunk === 'string' ? chunk : chunk?.toString?.()
            if (body) console.log('[DEBUG_COGNITO] Request body:', body)
          } catch (_) {}
          return origWrite(chunk, ...args)
        }
      }
      return out
    }
  }
  if (process.env.DEBUG_COGNITO === '1') {
    patchRequest(http)
    patchRequest(https)
  }

  const { AmazonCognitoSrp } = await import('amazon-cognito-srp')

  const outputs = loadOutputs()
  const cognito = outputs['cognito-dev'] || {}
  const userPoolId = cognito.UserPoolId
  const clientId = process.env.COGNITO_TEST_CLIENT_ID || cognito.BackendJMusTestingClient

  if (!userPoolId || !clientId) {
    throw new Error(
      'Missing UserPoolId or BackendJMusTestingClient in .jmus/outputs.json (cognito-dev). ' +
      'Or set COGNITO_TEST_CLIENT_ID in .env (e.g. BackendJMusTestingClient from outputs).'
    )
  }

  // Log request info (no password) for debugging
  console.log('[test:auth] Request:')
  console.log('  userPoolId:', userPoolId)
  console.log('  clientId:', clientId)
  console.log('  username:', email)

  const srp = new AmazonCognitoSrp({
    userPoolId,
    clientId,
    username: email,
    password,
  })

  let result
  try {
    result = await srp.authenticate()
  } catch (err) {
    // Log full error and any response so you can see what Cognito returned
    console.error('[test:auth] Response/error:')
    console.error('  message:', err?.message)
    console.error('  code:', err?.code)
    console.error('  name:', err?.name)
    if (err?.statusCode) console.error('  statusCode:', err.statusCode)
    if (err?.response) console.error('  response:', JSON.stringify(err.response, null, 2))
    if (err?.body) console.error('  body:', typeof err.body === 'string' ? err.body : JSON.stringify(err.body, null, 2))
    const rest = { ...err }
    delete rest.message
    delete rest.code
    delete rest.name
    delete rest.response
    delete rest.body
    if (Object.keys(rest).length) console.error('  other:', rest)
    throw err
  }

  const idToken = result.idToken
  const accessToken = result.accessToken
  const refreshToken = result.refreshToken
  if (!idToken) throw new Error('SRP authenticate did not return idToken')

  cache[email] = {
    id_token: idToken,
    access_token: accessToken,
    refresh_token: refreshToken,
    cached_at: Date.now(),
  }
  saveCache(cache)

  return idToken
}
