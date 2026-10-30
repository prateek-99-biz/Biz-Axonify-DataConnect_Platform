import "server-only";
import { createClient } from "@supabase/supabase-js";

export const supabaseAdminConfigured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Supabase client with the service-role key, used only to invite people and resend their links from admin-only server
 * actions. The key never leaves the server and must never be given a NEXT_PUBLIC_ name.
 */
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
