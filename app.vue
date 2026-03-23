<template>
  <v-app>
    <AppBar v-if="showAppBar" />
    <v-main class="jmus-noise-bg">
      <NuxtPage />
    </v-main>
    <GlobalNotifications />
  </v-app>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

// AppBar and GlobalNotifications are auto-imported from components/
const route = useRoute()

// Hide app bar on login and callback pages
const showAppBar = computed(() => {
  return !['/login', '/callback'].includes(route.path)
})
</script>

<style>
/* ── JMUS Global Design Tokens ─────────────────────────────────── */
:root {
  --color-green-base:  #0b3331;
  --color-green-dark:  #010909;
  --color-green-mid:   #0f3a2e;
  --color-gold:        #e2c050;
  --color-amber:       #c47c20;
  --color-amber-light: #d4922a;
  --font-display: 'Outfit', sans-serif;
  --font-body:    'Outfit', sans-serif;
}

html, body, .v-application {
  font-family: var(--font-body) !important;
  background-color: var(--color-green-dark) !important;
}

/* Applied shell background: gradient base + subtle noise texture */
.jmus-noise-bg {
  position: relative;
  overflow: hidden;
  background-color: var(--color-green-dark);
  background-image: none;
}
.jmus-noise-bg::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0;
  mix-blend-mode: soft-light;
  background-image: url("/noise-256.png");
  background-size: 256px 256px;
  background-repeat: repeat;
  filter: blur(0.35px);
  transform: translateZ(0);
}
.jmus-noise-bg > :deep(.v-main__wrap) {
  position: relative;
  z-index: 1;
}

h1, h2, h3, .text-h1, .text-h2, .text-h3 {
  font-family: var(--font-display) !important;
  font-weight: 300 !important;
  letter-spacing: -0.01em;
}

/* ── Hero background classes ─────────────────────────────────── */
.jmus-hero {
  position: relative;
  overflow: hidden;
  background: #152726;
  background-image:
    radial-gradient(ellipse at 65% 65%,
      rgba(147, 211, 195, 0.3) 0%,
      rgba(147, 211, 195, 0.2) 15%,
      rgba(147, 211, 195, 0.2) 55%,
      rgba(147, 211, 195, 0.1) 85%,
      rgba(255, 255, 255, 0) 100%);
  background-blend-mode: screen;
  color: #fff;
}
.jmus-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.3;
  mix-blend-mode: soft-light;
  background-image: url("/noise-256.png");
  background-size: 256px 256px;
  background-repeat: repeat;
  filter: blur(0.35px);
  transform: translateZ(0);
}

.jmus-hero-dark {
  position: relative;
  overflow: hidden;
  background: #152726;
  background-image:
    radial-gradient(circle at 50% 50%,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.05) 75%,
      rgba(255, 255, 255, 0) 100%);
  background-blend-mode: screen;
  color: #fff;
}
.jmus-hero-dark::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.2;
  mix-blend-mode: soft-light;
  background-image: url("/noise-256.png");
  background-size: 256px 256px;
  background-repeat: repeat;
  filter: blur(0.35px);
  transform: translateZ(0);
}

.jmus-hero-light {
  position: relative;
  overflow: hidden;
  background: #0b3331;
  background-image:
    radial-gradient(circle at 18% 18%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.00) 100%),
    radial-gradient(ellipse 60em 25em at 5% 5%,
      rgba(248, 135, 30, 0.0) 0%, rgba(253, 122, 0, 0.1) 20%,
      rgba(253, 122, 0, 0.15) 55%, rgba(253, 122, 0, 0.1) 85%,
      rgba(255, 255, 255, 0) 100%),
    radial-gradient(ellipse 50em 75em at 95% 95%,
      rgba(248, 135, 30, 0.0) 0%, rgba(255, 123, 0, 0.1) 25%,
      rgba(255, 123, 0, 0.15) 55%, rgba(255, 123, 0, 0.1) 85%,
      rgba(255, 255, 255, 0) 100%);
  background-blend-mode: screen, screen;
  color: #fff;
}
.jmus-hero-light::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.3;
  mix-blend-mode: soft-light;
  background-image: url("/noise-256.png");
  background-size: 320px 320px;
  background-repeat: repeat;
  filter: blur(0.35px);
  transform: translateZ(0);
}

.jmus-hero-balanced {
  position: relative;
  overflow: hidden;
  background: #0b3331;
  background-image:
    radial-gradient(circle at 18% 18%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.00) 100%),
    radial-gradient(circle at 70% 55%,
      rgba(255, 255, 255, 0.07) 0%,
      rgba(255, 255, 255, 0.02) 55%,
      rgba(255, 255, 255, 0) 100%);
  background-blend-mode: screen, screen;
  color: #fff;
}
.jmus-hero-balanced::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.3;
  mix-blend-mode: soft-light;
  background-image: url("/noise-256.png");
  background-size: 256px 256px;
  background-repeat: repeat;
  filter: blur(0.35px);
  transform: translateZ(0);
}

/* ── In-card tables: single-surface background (no extra green layers) ── */
.sales-gut-check-table,
.sales-gut-check-table .v-table__wrapper,
.sales-gut-check-table table,
.sales-gut-check-table thead,
.sales-gut-check-table tbody,
.sales-gut-check-table tr,
.sales-gut-check-table th,
.sales-gut-check-table td,
.call-center-table,
.call-center-table .v-table__wrapper,
.call-center-table table,
.call-center-table thead,
.call-center-table tbody,
.call-center-table tr,
.call-center-table th,
.call-center-table td,
.stryker-chart-card .v-data-table,
.stryker-chart-card .v-data-table__wrapper,
.stryker-chart-card .v-data-table table,
.stryker-chart-card .v-data-table thead,
.stryker-chart-card .v-data-table tbody,
.stryker-chart-card .v-data-table tr,
.stryker-chart-card .v-data-table th,
.stryker-chart-card .v-data-table td {
  background: transparent !important;
  background-color: transparent !important;
}

.sales-gut-check-table thead tr th,
.call-center-table thead tr th {
  border-bottom: 2px solid rgba(226, 192, 80, 0.5) !important;
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.sales-gut-check-table tbody tr td,
.call-center-table tbody tr td {
  border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

.sales-gut-check-table tbody tr:last-child td {
  border-bottom: none !important;
  color: #fff !important;
  font-weight: 600;
}

/* ── Dialogs: JMUS modal palette ──────────────────────────────── */
.v-dialog > .v-overlay__content > .v-card {
  background: rgb(var(--v-theme-background)) !important;
  color: rgba(255, 255, 255, 0.94) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.45) !important;
}

.v-dialog > .v-overlay__content > .v-card > .v-card-title {
  background: rgb(var(--v-theme-primary)) !important;
  color: #fff !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.v-dialog > .v-overlay__content > .v-card > .v-card-text,
.v-dialog > .v-overlay__content > .v-card > .v-card-actions {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

.v-dialog > .v-overlay__content > .v-card > .v-card-actions {
  border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.v-dialog > .v-overlay__content > .v-card .v-divider {
  border-color: rgba(255, 255, 255, 0.08) !important;
}

.v-dialog > .v-overlay__content > .v-card .v-list,
.v-dialog > .v-overlay__content > .v-card .v-list-item {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

.v-dialog > .v-overlay__content > .v-card .text-medium-emphasis,
.v-dialog > .v-overlay__content > .v-card .text-disabled,
.v-dialog > .v-overlay__content > .v-card .text-caption {
  color: rgba(255, 255, 255, 0.7) !important;
}

.v-dialog > .v-overlay__content > .v-card .v-field {
  --v-field-input-opacity: 1;
}

.v-dialog > .v-overlay__content > .v-card .v-field__input,
.v-dialog > .v-overlay__content > .v-card .v-label,
.v-dialog > .v-overlay__content > .v-card .v-select__selection-text,
.v-dialog > .v-overlay__content > .v-card .v-field__append-inner,
.v-dialog > .v-overlay__content > .v-card .v-field__prepend-inner,
.v-dialog > .v-overlay__content > .v-card .v-input__details,
.v-dialog > .v-overlay__content > .v-card .v-messages {
  color: rgba(255, 255, 255, 0.88) !important;
}

.v-dialog > .v-overlay__content > .v-card .v-field__outline {
  color: rgba(255, 255, 255, 0.28) !important;
}

.v-dialog > .v-overlay__content > .v-card .v-btn,
.v-dialog > .v-overlay__content > .v-card .v-btn.v-btn--variant-text,
.v-dialog > .v-overlay__content > .v-card .v-btn.v-btn--variant-elevated,
.v-dialog > .v-overlay__content > .v-card .v-btn.v-btn--variant-flat,
.v-dialog > .v-overlay__content > .v-card .v-btn.v-btn--variant-tonal,
.v-dialog > .v-overlay__content > .v-card .v-btn .v-icon {
  color: #fff !important;
}
</style>
