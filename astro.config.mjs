// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://thedriver.fr',

  // One canonical URL shape for every page: always a trailing slash.
  // The static build emits directories (`dist/flotte/index.html`), the sitemap
  // emits `/flotte/`, and `vercel.json` 308-redirects `/flotte` → `/flotte/`.
  // All three must agree or Google sees two URLs for one page.
  trailingSlash: 'always',

  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en', 'es', 'it'],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  integrations: [
    sitemap({
      // `/thank-you/` ships `<meta name="robots" content="noindex">`. Listing a
      // noindex URL in the sitemap makes Search Console report
      // "Submitted URL marked 'noindex'", so keep it out.
      filter: (page) => !page.includes('/thank-you'),
      i18n: {
        defaultLocale: 'fr',
        locales: {
          fr: 'fr-FR',
          en: 'en-US',
          es: 'es-ES',
          it: 'it-IT',
        },
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});