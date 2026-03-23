/**
 * Demo mode Amplify plugin.
 * No real AWS backend — all data is served from static JSON stubs in public/.
 * Populates amplify:pub and data:pub useState with placeholder values so any
 * composable that reads them doesn't throw.
 */
export default defineNuxtPlugin(() => {
  useState('amplify:pub', () => ({
    userPoolId: 'demo-pool',
    webClientId: 'demo-client',
    webClientId2: 'demo-client2',
    webClientId3: 'demo-client3',
    grantsEndpoint: 'https://demo.example.com/graphql',
    grantsApiKey: 'demo-key',
    dataApiUrl: 'https://demo.example.com/graphql',
    region: 'us-west-2',
  }))
  useState('data:pub', () => ({
    dataBucket: 'demo-bucket',
    dataBaseUrl: 'https://demo-bucket.s3.us-west-2.amazonaws.com/',
  }))
})
