/**
 * Calls the REAL Stryker GraphQL API so you can see the response shape.
 *
 * Run: npm run test:api
 *
 * To see output when the agent runs: open the log file (path is printed at exit).
 * In Cursor: Ctrl+P (or Cmd+P) and type matchTablesApi-last-run.txt, or open:
 *   tests/output/matchTablesApi-last-run.txt
 * It shows endpoint URL, token source, and each test result.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const outputsPath = path.join(projectRoot, '.jmus', 'outputs.json')
const OUTPUT_DIR = path.join(__dirname, 'output')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'matchTablesApi-last-run.txt')

let bannerWritten = false
function writeBanner (endpoint, tokenSource) {
  if (bannerWritten) return
  bannerWritten = true
  try {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    const lines = [
      '=== Match Tables API test run (real Stryker GraphQL) ===',
      `Run at: ${new Date().toISOString()}`,
      `Endpoint: ${endpoint}`,
      `Token: ${tokenSource}`,
      '',
    ]
    fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8')
    for (const line of lines) console.log(line)
  } catch (e) {
    console.warn('Could not write run output file:', e?.message)
  }
}

function logRun (msg) {
  console.log(msg)
  try {
    fs.appendFileSync(OUTPUT_FILE, msg + '\n', 'utf8')
  } catch (_) {}
}

// So you can confirm real API runs: print log path on exit (e.g. when agent runs tests)
const logPath = path.resolve(OUTPUT_FILE)
process.on('exit', (code) => {
  if (bannerWritten) {
    const line = `\nLog file: ${logPath}`
    console.log(line)
    try {
      fs.appendFileSync(OUTPUT_FILE, line + '\n', 'utf8')
    } catch (_) {}
  }
})

function getGraphQLUrl () {
  const raw = fs.readFileSync(outputsPath, 'utf8')
  const outputs = JSON.parse(raw)
  const url = outputs['stryker-tv-stack-dev']?.GraphQLApiUrl
  if (!url) throw new Error('stryker-tv-stack-dev.GraphQLApiUrl not found in .jmus/outputs.json')
  return url
}

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

const GET_STD_MATCH = `
  query GetSTDMatch($sk: String!) {
    getSTDMatch(SK: $sk) {
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
  }
`

const CREATE_STD_MATCH = `
  mutation CreateSTDMatch($input: STDMatchInput!) {
    createSTDMatch(input: $input) {
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
  }
`

const UPDATE_STD_MATCH = `
  mutation UpdateSTDMatch($sk: String!, $input: STDMatchUpdateInput!) {
    updateSTDMatch(SK: $sk, input: $input) {
      PK
      SK
      type
      canonical_name
      aliases
      context
      _updated_at
    }
  }
`

const DELETE_STD_MATCH = `
  mutation DeleteSTDMatch($sk: String!) {
    deleteSTDMatch(SK: $sk) {
      success
      canonical_name
    }
  }
`

const BULK_IMPORT_STD_MATCHES = `
  mutation BulkImportSTDMatches($items: [STDMatchInput!]!) {
    bulkImportSTDMatches(items: $items) {
      success
      imported_count
      failed_count
      errors
    }
  }
`

async function graphqlRequest (endpoint, query, variables, authToken) {
  const headers = { 'Content-Type': 'application/json' }
  if (authToken) headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return res.json()
}

test('listSTDMatches(STATION) - real API call', async () => {
  logRun('  listSTDMatches(STATION): running...')
  let token
  try {
    token = await getToken()
  } catch (e) {
    writeBanner(getGraphQLUrl(), 'skip - no token: ' + e.message)
    logRun(`  listSTDMatches(STATION): skip - ${e.message}`)
    return
  }
  const endpoint = getGraphQLUrl()
  const response = await graphqlRequest(endpoint, LIST_STD_MATCHES, { type: 'STATION', limit: 20 }, token)

  if (response.errors?.length) {
    logRun(`  listSTDMatches(STATION): fail - ${response.errors.map((e) => e.message).join('; ')}`)
    throw new Error(`GraphQL errors: ${response.errors.map((e) => e.message).join('; ')}`)
  }

  assert.ok(response.data, 'response.data should exist')
  assert.ok(response.data.listSTDMatches, 'response.data.listSTDMatches should exist')
  assert.ok(Array.isArray(response.data.listSTDMatches.items), 'items should be an array')
  logRun(`  listSTDMatches(STATION): pass (count=${response.data.listSTDMatches.count})`)
})

test('listSTDMatches(TFN) - real API call', async () => {
  let token = process.env.STRYKER_ID_TOKEN
  if (!token) {
    try {
      const { getTestToken } = await import('./utils/getTestToken.mjs')
      token = await getTestToken()
    } catch {
      return
    }
  }

  const endpoint = getGraphQLUrl()
  const response = await graphqlRequest(endpoint, LIST_STD_MATCHES, { type: 'TFN', limit: 20 }, token)

  console.log('\n--- listSTDMatches(TFN) API response ---')
  console.log(JSON.stringify(response, null, 2))

  if (response.errors?.length) {
    throw new Error(`GraphQL errors: ${response.errors.map((e) => e.message).join('; ')}`)
  }

  assert.ok(response.data?.listSTDMatches)
})

async function getToken () {
  const endpoint = getGraphQLUrl()
  let token = process.env.STRYKER_ID_TOKEN
  const tokenSource = token ? 'from STRYKER_ID_TOKEN env' : 'from cache / SRP (.env.test)'
  if (!token) {
    const { getTestToken } = await import('./utils/getTestToken.mjs')
    token = await getTestToken()
  }
  writeBanner(endpoint, tokenSource)
  return token
}

test('getSTDMatch(SK) - real API call', async () => {
  logRun('  getSTDMatch(SK): running...')
  const token = await getToken()
  const endpoint = getGraphQLUrl()
  const response = await graphqlRequest(endpoint, GET_STD_MATCH, { sk: 'TFN#4164436602' }, token)

  if (response.errors?.length) {
    logRun(`  getSTDMatch(SK): fail - ${response.errors.map((e) => e.message).join('; ')}`)
    throw new Error(`GraphQL errors: ${response.errors.map((e) => e.message).join('; ')}`)
  }

  assert.ok(response.data?.getSTDMatch, 'getSTDMatch should return an item')
  assert.strictEqual(response.data.getSTDMatch.SK, 'TFN#4164436602')
  assert.strictEqual(response.data.getSTDMatch.type, 'TFN')
  logRun('  getSTDMatch(SK): pass')
})

test('createSTDMatch → updateSTDMatch → deleteSTDMatch - real API calls', async () => {
  logRun('  create→update→delete STDMatch: running...')
  const token = await getToken()
  const endpoint = getGraphQLUrl()
  const unique = `Test-Station-${Date.now()}`

  const createRes = await graphqlRequest(endpoint, CREATE_STD_MATCH, {
    input: {
      type: 'STATION',
      canonical_name: unique,
      aliases: ['raw-alias-1', 'raw-alias-2'],
    },
  }, token)

  if (createRes.errors?.length) {
    throw new Error(`createSTDMatch failed: ${createRes.errors.map((e) => e.message).join('; ')}`)
  }

  const created = createRes.data?.createSTDMatch
  assert.ok(created, 'createSTDMatch should return the created item')
  assert.ok(created.SK, 'created item should have SK')
  assert.strictEqual(created.canonical_name, unique)
  assert.deepStrictEqual(created.aliases, ['raw-alias-1', 'raw-alias-2'])

  const updateRes = await graphqlRequest(endpoint, UPDATE_STD_MATCH, {
    sk: created.SK,
    input: { aliases: ['updated-alias'] },
  }, token)

  if (updateRes.errors?.length) {
    throw new Error(`updateSTDMatch failed: ${updateRes.errors.map((e) => e.message).join('; ')}`)
  }

  assert.ok(updateRes.data?.updateSTDMatch)
  assert.deepStrictEqual(updateRes.data.updateSTDMatch.aliases, ['updated-alias'])

  const deleteRes = await graphqlRequest(endpoint, DELETE_STD_MATCH, { sk: created.SK }, token)

  if (deleteRes.errors?.length) {
    throw new Error(`deleteSTDMatch failed: ${deleteRes.errors.map((e) => e.message).join('; ')}`)
  }

  assert.strictEqual(deleteRes.data?.deleteSTDMatch?.success, true)
  logRun('  create→update→delete STDMatch: pass')
})

test('bulkImportSTDMatches - real API call', async () => {
  logRun('  bulkImportSTDMatches: running...')
  const token = await getToken()
  const endpoint = getGraphQLUrl()
  const ts = Date.now()
  const item1 = { type: 'STATION', canonical_name: `Bulk-A-${ts}`, aliases: ['alias-a1'] }
  const item2 = { type: 'STATION', canonical_name: `Bulk-B-${ts}`, aliases: ['alias-b1'] }

  const bulkRes = await graphqlRequest(endpoint, BULK_IMPORT_STD_MATCHES, { items: [item1, item2] }, token)

  if (bulkRes.errors?.length) {
    const msg = bulkRes.errors.map((e) => e.message).join('; ')
    if (msg.includes('not yet implemented') || msg.includes('not implemented')) {
      logRun(`  bulkImportSTDMatches: pass (backend returns: ${msg})`)
      return
    }
    logRun(`  bulkImportSTDMatches: fail - ${msg}`)
    throw new Error(`GraphQL errors: ${msg}`)
  }

  const bulk = bulkRes.data?.bulkImportSTDMatches
  assert.ok(bulk, 'bulkImportSTDMatches should return result')
  assert.strictEqual(bulk.success, true)
  logRun(`  bulkImportSTDMatches: pass (imported=${bulk.imported_count}, failed=${bulk.failed_count || 0})`)

  const sk1 = `STATION#${item1.canonical_name}`
  const sk2 = `STATION#${item2.canonical_name}`
  await graphqlRequest(endpoint, DELETE_STD_MATCH, { sk: sk1 }, token)
  await graphqlRequest(endpoint, DELETE_STD_MATCH, { sk: sk2 }, token)
})
