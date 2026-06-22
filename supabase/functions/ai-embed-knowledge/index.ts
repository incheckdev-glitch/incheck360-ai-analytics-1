// Supabase Edge Function: ai-embed-knowledge
// Creates an embedding for SOPs, incident summaries, checklist notes, or audit reports.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { organization_id, source_module, source_table, source_id, source_reference, location_id, title, content, metadata } = body;
    if (!organization_id || !source_module || !content) return json({ error: 'organization_id, source_module and content are required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!supabaseUrl || !serviceRoleKey || !openAiKey) return json({ error: 'Missing required secrets' }, 500);

    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: content })
    });
    if (!embeddingResponse.ok) throw new Error(await embeddingResponse.text());

    const embeddingJson = await embeddingResponse.json();
    const embedding = embeddingJson.data[0].embedding;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from('ai_knowledge_chunks')
      .insert({
        organization_id,
        source_module,
        source_table,
        source_id,
        source_reference,
        location_id,
        title,
        content,
        metadata: metadata ?? {},
        embedding
      })
      .select('*')
      .single();

    if (error) throw error;
    return json({ chunk: data });
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
