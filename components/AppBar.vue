<template>
  <v-app-bar color="primary" density="comfortable" elevation="2" class="jmus-app-bar">
    <v-app-bar-title class="d-flex align-center">
      <NuxtLink to="/" class="d-flex align-center text-decoration-none" style="color: inherit;">
        <div class="jmus-app-bar-logo font-weight-bold text-h6">
          JMUS
        </div>
      </NuxtLink>
    </v-app-bar-title>

    <v-spacer />

    <!-- Client-only: nav and user menu depend on auth state (no tokens/grants on server) -->
    <ClientOnly>
      <!-- Navigation: only when user has jmus#admin#all -->
      <div v-if="showFullNav" class="d-flex align-center mr-4 navigation-buttons">
        <v-btn
          :variant="route.path === '/' ? 'flat' : 'text'"
          :color="route.path === '/' ? 'secondary' : undefined"
          density="comfortable"
          class="text-none"
          @click="router.push('/')"
        >
          <v-icon start size="small">mdi-view-dashboard</v-icon>
          Dashboard
        </v-btn>
        <v-btn
          :variant="route.path === '/clients' ? 'flat' : 'text'"
          :color="route.path === '/clients' ? 'secondary' : undefined"
          density="comfortable"
          class="text-none"
          @click="router.push('/clients')"
        >
          <v-icon start size="small">mdi-domain</v-icon>
          Clients
        </v-btn>
        <v-btn
          :variant="route.path === '/match-tables' ? 'flat' : 'text'"
          :color="route.path === '/match-tables' ? 'secondary' : undefined"
          density="comfortable"
          class="text-none"
          @click="router.push('/match-tables')"
        >
          <v-icon start size="small">mdi-table</v-icon>
          Match Tables
        </v-btn>
        <v-btn
          :variant="route.path === '/uploads' ? 'flat' : 'text'"
          :color="route.path === '/uploads' ? 'secondary' : undefined"
          density="comfortable"
          class="text-none"
          @click="router.push('/uploads')"
        >
          <v-icon start size="small">mdi-upload</v-icon>
          Uploads
        </v-btn>
        <v-btn
          :variant="route.path === '/datasets' ? 'flat' : 'text'"
          :color="route.path === '/datasets' ? 'secondary' : undefined"
          density="comfortable"
          class="text-none"
          @click="router.push('/datasets')"
        >
          <v-icon start size="small">mdi-database</v-icon>
          Data
        </v-btn>
        <v-btn
          :variant="route.path === '/jobs' ? 'flat' : 'text'"
          :color="route.path === '/jobs' ? 'secondary' : undefined"
          density="comfortable"
          class="text-none"
          @click="router.push('/jobs')"
        >
          <v-icon start size="small">mdi-cog-clockwise</v-icon>
          Jobs
        </v-btn>
      </div>

      <!-- User Menu -->
      <v-menu v-if="userEmail" :close-on-content-click="false">
        <template #activator="{ props }">
          <v-btn v-bind="props" variant="text" class="text-none">
            <v-icon class="mr-2">mdi-account-circle</v-icon>
            {{ userEmail }}
            <v-icon class="ml-1">mdi-menu-down</v-icon>
          </v-btn>
        </template>

        <v-list>
          <v-list-item>
            <v-list-item-title class="text-caption text-grey">
              User ID
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption font-mono">
              {{ cognitoId?.substring(0, 8) }}...
            </v-list-item-subtitle>
          </v-list-item>

          <v-divider class="my-2" />

          <v-list-item @click="handleSignOut" :disabled="signingOut">
            <template #prepend>
              <v-icon color="error">mdi-logout</v-icon>
            </template>
            <v-list-item-title>Sign Out</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
      <template #fallback>
        <div class="d-flex align-center" style="min-height: 40px;" />
      </template>
    </ClientOnly>
  </v-app-bar>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter, useRoute } from 'vue-router'

const auth = useAuth()
const router = useRouter()
const route = useRoute()

/** Demo mode: always show full nav. */
const showFullNav = computed(() => true)

const userEmail = ref<string | null>(null)
const cognitoId = ref<string | null>(null)
const signingOut = ref(false)

onMounted(async () => {
  userEmail.value = auth.getUserEmail()
  cognitoId.value = auth.getCognitoId()
  if (auth.userGrants.value.length === 0 && auth.getCognitoId()) {
    await auth.fetchGrants()
  }
})

async function handleSignOut() {
  // Demo mode: no real session to clear.
  await router.push('/')
}
</script>

<style scoped>
.jmus-app-bar {
  position: relative;
  overflow: hidden;
}
.jmus-app-bar::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.12;
  mix-blend-mode: soft-light;
  background-image: url('/noise-256.png');
  background-size: 256px 256px;
  background-repeat: repeat;
}
.jmus-app-bar :deep(.v-toolbar__content) {
  position: relative;
  z-index: 1;
}

.jmus-app-bar-logo {
  height: 36px;
  width: auto;
  display: block;
  padding: 0 8px;
}

.jmus-accent {
  color: rgb(var(--v-theme-secondary));
}

/* Navigation buttons: white text on dark app bar */
.navigation-buttons :deep(.v-btn) {
  color: rgba(255, 255, 255, 0.9) !important;
}
.navigation-buttons :deep(.v-btn:hover) {
  color: #fff !important;
  background: rgba(255, 255, 255, 0.1) !important;
}
.navigation-buttons :deep(.v-btn.v-btn--variant-flat) {
  color: #222 !important;
  background: rgb(var(--v-theme-secondary)) !important;
}
.navigation-buttons :deep(.v-btn .v-icon) {
  color: inherit;
}
</style>
