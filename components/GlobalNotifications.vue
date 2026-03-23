<template>
  <div class="global-notifications">
    <transition-group name="notify-fade" tag="div" class="stack">
      <v-alert
        v-for="n in notes"
        :key="n.id"
        :type="color(n.type)"
        variant="flat"
        density="comfortable"
        border="start"
        closable
        class="notify pa-3"
        @click:close="dismiss(n.id)"
      >
        <div class="d-flex flex-column" style="max-width:320px;">
          <div class="d-flex align-center justify-space-between mb-1">
            <strong>{{ n.message }}</strong>
            <small class="text-disabled">{{ time(n._created_at) }}</small>
          </div>
          <div v-if="n.detail">
            <div v-if="!expanded[n.id]" class="text-caption text-medium-emphasis truncate-detail" @click="toggle(n.id)">{{ n.detail }}</div>
            <pre v-else class="detail-pre" @click="toggle(n.id)">{{ n.detail }}</pre>
          </div>
        </div>
        <template #append>
          <div class="actions d-flex align-center">
            <v-btn v-if="n.detail" :icon="expanded[n.id] ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="x-small" variant="text" @click.stop="toggle(n.id)" />
            <v-btn :icon="copied[n.id] ? 'mdi-check' : 'mdi-content-copy'" size="x-small" variant="text" :title="copied[n.id] ? 'Copied' : 'Copy'" @click.stop="copy(n.id, n)" />
          </div>
        </template>
      </v-alert>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useNotificationsStore } from '@/stores/notifications'

const store = useNotificationsStore()
const notes = store.queue
const activeMap = reactive<Record<number, boolean>>({})
const expanded = reactive<Record<number, boolean>>({})
const copied = reactive<Record<number, boolean>>({})

watch(notes, (list) => {
  for (const n of list) {
    if (activeMap[n.id] === undefined) activeMap[n.id] = true
  }
}, { immediate: true })

function dismiss(id: number) {
  store.dismiss(id)
}

function color(t: string) {
  switch (t) {
    case 'error': return 'error'
    case 'success': return 'success'
    case 'warning': return 'warning'
    default: return 'info'
  }
}

function toggle(id: number) {
  expanded[id] = !expanded[id]
}

function time(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

async function copy(id: number, n: { message: string; detail: string }) {
  const text = n.detail ? `${n.message}\n\n${n.detail}` : n.message
  try {
    await navigator.clipboard.writeText(text)
    copied[id] = true
    setTimeout(() => { copied[id] = false }, 1500)
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      copied[id] = true
      setTimeout(() => { copied[id] = false }, 1500)
    } catch { /* ignore */ }
  }
}
</script>

<style scoped>
.global-notifications { position: fixed; bottom: 8px; right: 8px; z-index: 4000; max-width: 420px; }
.stack { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.notify { width: 420px; max-width: 100%; box-shadow: var(--v-shadow-6); }
.truncate-detail { cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.detail-pre { margin:0; font-size: 11px; max-height:160px; overflow:auto; background: rgba(0,0,0,0.15); padding:4px 6px; border-radius:4px; cursor: pointer; }
.notify-fade-enter-active, .notify-fade-leave-active { transition: all .18s ease; }
.notify-fade-enter-from, .notify-fade-leave-to { opacity:0; transform: translateY(6px); }
</style>
