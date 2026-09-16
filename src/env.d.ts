/// <reference types="astro/client" />

// Shared globals bridging _AdminShell.astro's inline script to each admin
// page's own inline script. Astro compiles each `<script>` block as its own
// module — they can't `import` from one another — so `window` is the
// sanctioned hand-off point for the admin dashboard's tiny "shell API"
// (i18n + toasts) and for the couple of pages that pass server-rendered
// data into a typed client script via an untyped `define:vars` shim.
//
// Declaring the shapes here replaces every `(window as any).x` cast across
// src/pages/admin/**/*.astro with a real, checked type.
declare global {
  interface Window {
    /** Translate a key in the admin's current language. Set by _AdminShell.astro. */
    adminT: (key: string) => string;
    /** The admin dashboard's current language code. Set by _AdminShell.astro. */
    adminLang: string;
    /** Re-run [data-i18n]/[data-i18n-ph] substitution over a DOM subtree. Set by _AdminShell.astro. */
    adminApplyI18n: (root?: ParentNode) => void;
    /** Show a toast notification. Set by _AdminShell.astro. */
    adminToast: (message: string, kind?: 'ok' | 'err' | '') => void;

    /** Set by admin/team/index.astro's define:vars shim. */
    __team?: { grantable: string[] };
    /** Set by admin/content/[page].astro's define:vars shim. */
    __contentEditor?: {
      pageKey: string;
      compiled: Record<string, { path: string; text: string }[]>;
      locales: string[];
    };
    /** Set by admin/blog/[id].astro's define:vars shim. */
    __blogEditor?: { paramId: string; isNew: boolean };
    /** Guards FancyDateTime.astro's document-level listener against double-binding when more than one instance is on the page. */
    __fdtBound?: boolean;
  }
}

export {};
