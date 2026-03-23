export interface ApiErrorContext {
  operation: string
  variables: any
  errors: any[]
  response: any
  meta: Record<string, any>
}

// Unified API/GraphQL error to carry rich context for UI & logging.
export class ApiError extends Error {
  public operation: string
  public variables: any
  public errors: any[]
  public response: any
  public meta: Record<string, any>
  public kind = 'api'
  constructor(message: string, ctx: Partial<ApiErrorContext>){
    super(message)
    this.operation = ctx.operation || 'unknown'
    this.variables = ctx.variables || null
    this.errors = ctx.errors || []
    this.response = ctx.response || null
    this.meta = ctx.meta || {}
  }
  toDetail(maxString = 600){
    const sanitize = (input: any): any => {
      if(input === null || input === undefined) return input
      if(typeof input === 'string'){
        if(input.length > maxString) return input.slice(0, maxString) + `…(truncated ${input.length})`
        return input
      }
      if(Array.isArray(input)) return input.map(v=> sanitize(v))
      if(typeof input === 'object'){
        const out: Record<string, any> = {}
        for(const [k,v] of Object.entries(input)){
          out[k] = sanitize(v)
        }
        return out
      }
      return input
    }
    const payload = sanitize(this.variables)
    const detailObj = {
      operation: this.operation,
      message: this.message,
      errors: this.errors,
      payload,
      meta: this.meta
    }
    try { return JSON.stringify(detailObj, null, 2) } catch { return String(detailObj) }
  }
}
