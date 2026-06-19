import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client navigateur uniquement — safe dans les composants "use client"
export function createSupabaseBrowserClient() {
  return createBrowserClient(url, anon);
}
