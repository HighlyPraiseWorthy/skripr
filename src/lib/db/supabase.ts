import { createClient, SupabaseClient } from "@supabase/supabase-js";

function createSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
  return createClient(url, key);
}

function createSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Use lazy initialization to avoid build-time errors
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) _supabase = createSupabaseClient();
    return (_supabase as any)[prop];
  }
});

export const supabaseAdmin: SupabaseClient | null = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (_supabaseAdmin === null) _supabaseAdmin = createSupabaseAdmin();
    if (!_supabaseAdmin) return undefined;
    return (_supabaseAdmin as any)[prop];
  }
});
