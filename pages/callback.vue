<template>
  <div class="callback-page">
    <v-container class="fill-height">
      <v-row align="center" justify="center">
        <v-col cols="12" md="6" class="text-center">
          <v-progress-circular
            v-if="!error"
            indeterminate
            color="primary"
            size="64"
          />
          <v-icon v-else size="64" color="error">mdi-alert-circle</v-icon>

          <h2 class="mt-4">{{ error ? 'Authentication Failed' : 'Processing authentication...' }}</h2>
          <p class="text-grey">{{ error || 'Please wait while we complete your login.' }}</p>

          <v-btn v-if="error" color="primary" class="mt-4" @click="retryLogin">
            Try Again
          </v-btn>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: [],
})

const route = useRoute()
const router = useRouter()
const { exchangeCodeForTokens, saveTokens, signIn, fetchGrants } = useAuth()

const error = ref<string | null>(null)

const retryLogin = () => {
  localStorage.removeItem('oauth_state')
  signIn()
}

onMounted(async () => {
  try {
    const code = route.query.code as string
    const state = route.query.state as string

    if (!code || !state) {
      throw new Error('Missing authorization code or state parameter.')
    }

    const expectedState = localStorage.getItem('oauth_state')
    if (!expectedState) {
      throw new Error('OAuth state validation failed - please try again')
    }
    if (state !== expectedState) {
      throw new Error('OAuth state validation failed - security check failed')
    }

    localStorage.removeItem('oauth_state')
    window.history.replaceState({}, document.title, window.location.pathname)

    const tokens = await exchangeCodeForTokens(code)
    saveTokens(tokens)
    await fetchGrants()

    const redirectUrl = localStorage.getItem('auth_redirect')
    localStorage.removeItem('auth_redirect')

    await router.replace(redirectUrl || '/')
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('[callback] Authentication error:', err)
    error.value = err.message || 'Authentication failed'
    localStorage.removeItem('oauth_state')
  }
})
</script>

<style scoped>
.callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
