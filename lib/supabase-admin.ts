import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client admin — UNIQUEMENT pour les jobs serveur (cron, webhooks) qui
// n'ont pas de session utilisateur. Contourne la RLS : ne jamais exposer
// au navigateur ni utiliser dans un contexte où l'utilisateur n'est pas
// déjà authentifié et vérifié.
export function createSupabaseAdminClient() {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
