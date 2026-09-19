import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://nlmtcimkqymynsyflimv.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_w9bbRaugaYY2CnyO3DMd9g_LrU0xVcY";

let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (!browserClient) {
    browserClient = createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  }
  return browserClient;
}
