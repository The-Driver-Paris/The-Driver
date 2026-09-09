// Minimal ambient declarations so a Node-based TypeScript server (VS Code's
// default) stops flagging this Deno file. The real types come from Deno itself
// at `supabase functions deploy` time. If you install the "Deno" VS Code
// extension, it supersedes all of this with the genuine Deno + npm types.

declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}

declare module 'npm:@supabase/supabase-js@2' {
  // Loose shape — enough for this function; the real client is fully typed
  // once `@supabase/supabase-js` is installed for the main app.
  export function createClient(
    url: string,
    key: string,
    options?: Record<string, unknown>,
  ): {
    auth: {
      getUser(jwt: string): Promise<{ data: { user: { id: string; email?: string } | null }; error: unknown }>;
      admin: {
        createUser(attrs: Record<string, unknown>): Promise<{ data: { user: { id: string } | null }; error: { message?: string } | null }>;
        deleteUser(id: string): Promise<{ data: unknown; error: unknown }>;
      };
    };
    from(table: string): {
      select(cols: string): {
        eq(col: string, val: unknown): { maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }> };
      };
      insert(row: Record<string, unknown>): Promise<{ error: { message?: string } | null }>;
    };
  };
}
