import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== 'false' || !supabaseUrl || !supabaseAnonKey;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
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
