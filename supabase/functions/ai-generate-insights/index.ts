// Supabase Edge Function: ai-generate-insights
// Deploy with: supabase functions deploy ai-generate-insights
// Set secrets: supabase secrets set OPENAI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface RequestBody {
  organization_id: string;
  location_id?: string;
  run_type?: 'daily' | 'manual' | 'location';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as RequestBody;
    if (!body.organization_id) {
      return json({ error: 'organization_id is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Supabase service secrets are missing' }, 500);
    if (!openAiKey) return json({ error: 'OPENAI_API_KEY secret is missing' }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: run, error: runError } = await supabase
      .from('ai_model_runs')
      .insert({
        organization_id: body.organization_id,
        run_type: body.run_type ?? 'manual',
        model_provider: 'openai',
        model_name: 'gpt-4.1-mini',
        status: 'running'
      })
      .select('*')
      .single();

    if (runError) throw runError;

    const [locationsResult, tasksResult, incidentsResult, actionsResult] = await Promise.all([
      supabase.from('locations').select('*').eq('organization_id', body.organization_id),
      supabase.from('execution_tasks').select('*').eq('organization_id', body.organization_id).neq('status', 'done'),
      supabase.from('incidents').select('*').eq('organization_id', body.organization_id).neq('status', 'closed'),
      supabase.from('corrective_actions').select('*').eq('organization_id', body.organization_id).neq('status', 'done')
    ]);

    if (locationsResult.error) throw locationsResult.error;
    if (tasksResult.error) throw tasksResult.error;
    if (incidentsResult.error) throw incidentsResult.error;
    if (actionsResult.error) throw actionsResult.error;

    const context = {
      locations: locationsResult.data ?? [],
      open_tasks: tasksResult.data ?? [],
      open_incidents: incidentsResult.data ?? [],
      open_corrective_actions: actionsResult.data ?? [],
      instruction: 'Return only JSON matching the schema. Do not include markdown.'
    };

    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: 'You are an operations compliance analyst for multi-location F&B, QSR, and retail businesses. Generate concise, practical risk insights from checklist, incident, task, and corrective action data.'
          },
          {
            role: 'user',
            content: JSON.stringify(context)
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'operations_ai_insights',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                insights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      module: { type: 'string', enum: ['locations', 'checklists', 'tasks', 'incidents', 'corrective_actions', 'compliance'] },
                      entity_type: { type: 'string' },
                      entity_reference: { type: 'string' },
                      location_name: { type: 'string' },
                      title: { type: 'string' },
                      summary: { type: 'string' },
                      recommendation: { type: 'string' },
                      severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                      confidence: { type: 'number', minimum: 0, maximum: 1 },
                      evidence: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['module', 'entity_type', 'entity_reference', 'location_name', 'title', 'summary', 'recommendation', 'severity', 'confidence', 'evidence']
                  }
                }
              },
              required: ['insights']
            }
          }
        }
      })
    });

    if (!aiResponse.ok) {
      const details = await aiResponse.text();
      throw new Error(`OpenAI request failed: ${details}`);
    }

    const aiJson = await aiResponse.json();
    const outputText = aiJson.output_text ?? aiJson.output?.[0]?.content?.[0]?.text;
    const parsed = JSON.parse(outputText);

    const locationByName = new Map((locationsResult.data ?? []).map((location: any) => [location.location_name, location.location_id]));
    const rows = parsed.insights.map((insight: any) => ({
      organization_id: body.organization_id,
      run_id: run.run_id,
      module: insight.module,
      entity_type: insight.entity_type,
      entity_reference: insight.entity_reference,
      location_id: locationByName.get(insight.location_name) ?? null,
      title: insight.title,
      summary: insight.summary,
      recommendation: insight.recommendation,
      severity: insight.severity,
      confidence: insight.confidence,
      evidence: insight.evidence,
      output_json: insight
    }));

    const { error: insertError } = await supabase.from('ai_insights').insert(rows);
    if (insertError) throw insertError;

    await supabase
      .from('ai_model_runs')
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('run_id', run.run_id);

    return json({ run_id: run.run_id, inserted: rows.length, insights: parsed.insights });
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
