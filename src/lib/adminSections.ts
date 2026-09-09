// One source of truth for: the dashboard sidebar, the route → section map, and
// the owner's per-staff grant checklist.
//
// ⚠ Three lists must stay in sync or a mismatch fails SILENTLY:
//     1. the `key` values here
//     2. the has_section('…') strings in supabase/migrations/0002_admin.sql + 0004_rls.sql
//     3. ALLOWED_SECTIONS in supabase/functions/create-worker/index.ts
//   A key here that is missing from (2)/(3) is granted in the UI and dropped on
//   save — the staff member sees a nav item that redirects.

export interface AdminSection {
  key: string;          // MUST equal the has_section(...) string in the DB
  route: string;        // under /admin
  exact?: boolean;      // match this route exactly (the overview)
  labelKey: string;     // i18n key under `admin.nav`
  icon: string;         // lucide name available in src/components/Icon.astro
  always?: boolean;     // visible to every active admin (the overview)
  ownerOnly?: boolean;  // only the owner (the Team page)
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { key: 'overview', route: '/admin',           exact: true, labelKey: 'overview', icon: 'check-circle', always: true },
  { key: 'blog',     route: '/admin/blog',                    labelKey: 'blog',     icon: 'message-circle' },
  { key: 'content',  route: '/admin/content',                 labelKey: 'content',  icon: 'user-check' },
  { key: 'bookings', route: '/admin/bookings',                labelKey: 'bookings', icon: 'car-silhouette' },
  { key: 'messages', route: '/admin/messages',                labelKey: 'messages', icon: 'mail' },
  { key: 'team',     route: '/admin/team',                    labelKey: 'team',     icon: 'users', ownerOnly: true },
];

/** The sections an owner can tick on/off for a staff member. */
export const GRANTABLE_SECTIONS = ADMIN_SECTIONS.filter((s) => !s.always && !s.ownerOnly);

/** Sections the Edge Function is allowed to persist (re-validate server-side). */
export const ALLOWED_SECTIONS = GRANTABLE_SECTIONS.map((s) => s.key);

/**
 * Resolve a pathname to its section key. Matches the exact overview first, then
 * the LONGEST route prefix — otherwise `/admin` shadows everything and
 * `/admin/blog/new` fails to map to `blog`.
 */
export function routeToSection(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '') || '/admin';
  const exact = ADMIN_SECTIONS.find((s) => s.exact && s.route === clean);
  if (exact) return exact.key;
  const prefixed = ADMIN_SECTIONS.filter((s) => !s.exact && clean.startsWith(s.route)).sort(
    (a, b) => b.route.length - a.route.length,
  );
  return prefixed[0]?.key ?? null;
}

/** Mirror of the DB gate — hides what RLS would refuse. Never the boundary. */
export function canAccess(
  section: AdminSection,
  ctx: { isOwner: boolean; sections: string[] },
): boolean {
  if (section.always) return true;
  if (section.ownerOnly) return ctx.isOwner;
  return ctx.isOwner || ctx.sections.includes(section.key);
}
