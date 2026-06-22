import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const explicitMockMode = import.meta.env.VITE_USE_MOCK_DATA === 'true';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Live mode is enabled automatically when Supabase URL + anon key exist.
// Set VITE_USE_MOCK_DATA=true only when you intentionally want demo/local data.
export const useMockData = explicitMockMode || !isSupabaseConfigured;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export async function invokeAIGenerateInsights(payload: Record<string, unknown>) {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { data, error } = await supabase.functions.invoke('ai-generate-insights', {
    body: payload
  });

  if (error) throw error;
  return data;
}
