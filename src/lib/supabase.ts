import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    // Fallback to provided credentials if environment variables are missing
    const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://dkhnmkqeymampqegvout.supabase.co';
    const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_4JkvCTMHgkwtV0wxZqmJAg_uveLzCRh';

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}
