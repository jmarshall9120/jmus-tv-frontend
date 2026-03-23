import { useNotificationsStore, extractGraphQLError } from '@/stores/notifications'

export function useErrorNotify(){
  const store = useNotificationsStore()
  function report(e: unknown, context?: string){
    // Always log to console first
    console.error(`[ErrorNotify] ${context || 'Error'}:`, e)
    
    const gParsed = extractGraphQLError(e as any)
    if(gParsed){
      store.error(context ? `${context}: ${gParsed.message}` : gParsed.message, gParsed.detail)
      return
    }
    if(e instanceof Error){
      store.error(context ? `${context}: ${e.message}` : e.message, (e as any).stack)
      return
    }
    if(typeof e === 'string') {
      store.error(context ? `${context}: ${e}` : e)
      return
    }
    try {
      store.error(context || 'Unexpected error', JSON.stringify(e, null, 2))
    } catch {
      store.error(context || 'Unexpected error')
    }
  }
  return { report, notifyError: report }
}
