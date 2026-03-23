import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AppNotification {
  id: number
  type: 'error' | 'info' | 'success' | 'warning'
  message: string
  detail: string
  timeout: number // ms; 0 = stays until dismissed
  _created_at: number
}

let counter = 1

// Helper to parse GraphQL style errors
export function extractGraphQLError(e: any): { message: string; detail?: string } | null {
  if(e && Array.isArray(e.errors) && e.errors.length){
    const msgs = e.errors.map((er: any)=> er?.message).filter(Boolean)
    if(msgs.length){
      return { message: msgs[0] || 'GraphQL error', detail: msgs.slice(1).join('; ') }
    }
  }
  return null
}

interface PushOptions { 
  dedupWindowMs: number
  allowDuplicate: boolean 
}

export const useNotificationsStore = defineStore('notifications', () => {
  const queue = ref<AppNotification[]>([])
  const recentKeys = ref<{ key: string; ts: number }[]>([])
  const DEFAULT_DEDUP_WINDOW = 4000

  function shouldDedup(key: string, windowMs: number){
    const now = Date.now()
    recentKeys.value = recentKeys.value.filter(r=> now - r.ts < windowMs)
    return recentKeys.value.some(r=> r.key === key)
  }
  function recordKey(key: string){ recentKeys.value.push({ key, ts: Date.now() }) }

  function push(n: Omit<AppNotification,'id'|'_created_at'>, opts: Partial<PushOptions> = {}) {
    const { dedupWindowMs = DEFAULT_DEDUP_WINDOW, allowDuplicate = false } = opts
    const key = `${n.type}|${n.message}|${n.detail}`
    if(!allowDuplicate && shouldDedup(key, dedupWindowMs)){
      return -1
    }
    const id = counter++
    const note: AppNotification = { 
      id, 
      _created_at: Date.now(), 
      type: n.type,
      message: n.message,
      detail: n.detail,
      timeout: n.timeout
    }
    queue.value.push(note)
    recordKey(key)
    if(note.timeout > 0){
      setTimeout(()=> dismiss(id), note.timeout)
    }
    return id
  }
  function error(message: string, detail = '', opts: Partial<PushOptions> = {}){ 
    console.error(`[Notification Error] ${message}`, detail ? `\nDetail: ${detail}` : '')
    return push({ type:'error', message, detail, timeout: 6000 }, opts) 
  }
  function info(message: string, detail = '', opts: Partial<PushOptions> = {}){ 
    console.info(`[Notification Info] ${message}`, detail || '')
    return push({ type:'info', message, detail, timeout: 6000 }, opts) 
  }
  function success(message: string, detail = '', opts: Partial<PushOptions> = {}){ 
    console.log(`[Notification Success] ${message}`, detail || '')
    return push({ type:'success', message, detail, timeout: 6000 }, opts) 
  }
  function warn(message: string, detail = '', opts: Partial<PushOptions> = {}){ 
    console.warn(`[Notification Warning] ${message}`, detail || '')
    return push({ type:'warning', message, detail, timeout: 6000 }, opts) 
  }
  function dismiss(id: number){ queue.value = queue.value.filter(n=> n.id !== id) }
  function clear(){ queue.value = [] }
  function latest(type: AppNotification['type'] | 'any' = 'any'){ const arr = [...queue.value].reverse(); return arr.find(n=> type==='any'||n.type===type) }
  function errorCount(){ return queue.value.filter(n=> n.type==='error').length }

  return { queue, push, error, info, success, warn, dismiss, clear, latest, errorCount }
})
