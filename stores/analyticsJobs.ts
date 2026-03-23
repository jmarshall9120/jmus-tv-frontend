import type { } from 'pinia'

/**
 * Analytics Job Update — shape used by jobs.vue pipeline monitoring.
 */
export interface AnalyticsJobUpdate {
  PK: string
  SK: string
  type: string
  job_id: string
  status: string
  started_at?: string
  completed_at?: string
  error_message?: string | null
  _created_at?: string
  _updated_at?: string
}

export type AnalyticsJobEventListener = (update: AnalyticsJobUpdate) => void

/**
 * Demo-mode Analytics Jobs Store.
 * No real AppSync subscription — all methods are no-ops so jobs.vue compiles
 * and renders without crashing.
 */
export const useAnalyticsJobsStore = defineStore('analyticsJobs', () => {
  const isConnected = ref(false)
  const activeJobs = ref<Map<string, { sk: string; type: string; status: string; startTime: number }>>(new Map())

  const registerListener = (_jobSk: string, _listener: AnalyticsJobEventListener) => { /* demo no-op */ }
  const unregisterListener = (_jobSk: string, _listener: AnalyticsJobEventListener) => { /* demo no-op */ }
  const registerGlobalListener = (_listener: AnalyticsJobEventListener) => { /* demo no-op */ }
  const unregisterGlobalListener = (_listener: AnalyticsJobEventListener) => { /* demo no-op */ }
  const forceClose = () => { /* demo no-op */ }

  return {
    isConnected,
    activeJobs,
    registerListener,
    unregisterListener,
    registerGlobalListener,
    unregisterGlobalListener,
    forceClose,
  }
})
