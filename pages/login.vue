<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({ middleware: [] })

// Demo mode: no auth needed - immediately redirect to the app.
const router = useRouter()
onMounted(() => router.replace('/'))
</script>
