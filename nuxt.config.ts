import type { ModuleOptions, Nuxt } from "nuxt/schema";
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

function vuetify_hook(_options:ModuleOptions, nuxt:Nuxt){
  nuxt.hooks.hook("vite:extendConfig", (config) => {
    // @ts-expect-error believes autoimport is not a valid option, but it is.
    config.plugins!.push(vuetify({ autoimport: true }));
  });
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap' },
        { rel: 'icon', type: 'image/png', href: '/favicon.ico' },
      ],
    },
  },
  runtimeConfig: {
    public: {
      env: process.env.JMUS_ENV || 'local',
      outputsKey: process.env.JMUS_ENV === 'prod' ? 'prod' : 'dev',
      isAmplifyHosting: !!process.env.AWS_EXECUTION_ENV,
      useLocalStaticFiles: process.env.JMUS_ENV === 'local',
      cognitoClientAppId: process.env.COGNITO_CLIENT_APP_ID || ''
    }
  },
  build: {
    transpile: ["vuetify"],
  },
  modules: [
    vuetify_hook,
    '@pinia/nuxt',
    '@nuxt/eslint'
  ],
  css: [
    'vuetify/styles',
    '@mdi/font/css/materialdesignicons.css'
  ],
  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
  },
})