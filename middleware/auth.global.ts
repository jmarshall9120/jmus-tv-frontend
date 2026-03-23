/**
 * Global auth middleware — demo mode.
 * Auth is bypassed: all routes are accessible without login.
 */

export default defineNuxtRouteMiddleware(() => {
  // Demo mode: no authentication required.
})
