// Supabase Edge Function: ai-chat-ops
// Ask operational questions using retrieved context from ai_knowledge_chunks.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { organization_id, question } = await req.json();
    if (!organization_id || !question) return json({ error: 'organization_id and question are required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!supabaseUrl || !serviceRoleKey || !openAiKey) return json({ error: 'Missing required secrets' }, 500);

    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: question })
    });
    if (!embeddingResponse.ok) throw new Error(await embeddingResponse.text());
    const embeddingJson = await embeddingResponse.json();
    const embedding = embeddingJson.data[0].embedding;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: chunks, error } = await supabase.rpc('match_ai_knowledge_chunks', {
      query_embedding: embedding,
      match_count: 6,
      filter_organization_id: organization_id,
      filter_location_id: null
    });
    if (error) throw error;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: 'Answer as an operations compliance assistant. Use only the provided context. If context is insufficient, say what is missing.' },
          { role: 'user', content: JSON.stringify({ question, context: chunks ?? [] }) }
        ]
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const result = await response.json();

    return json({ answer: result.output_text, sources: chunks ?? [] });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
