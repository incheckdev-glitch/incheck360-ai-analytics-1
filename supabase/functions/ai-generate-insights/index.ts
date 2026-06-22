// Supabase Edge Function: ai-generate-insights
// InCheck360 AI Engine gateway.
// The Edge Function validates the request and securely runs the Supabase AI engine RPC.
// Deploy with: supabase functions deploy ai-generate-insights
// Set secrets: supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type RequestBody = {
  organization_id?: string;
  organizationId?: string;
  period_start?: string;
  periodStart?: string;
  period_end?: string;
  periodEnd?: string;
  triggered_by?: string;
  run_type?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await readBody(req);
    const organizationId = body.organization_id ?? body.organizationId;
    const periodStart = body.period_start ?? body.periodStart ?? defaultPeriodStart();
    const periodEnd = body.period_end ?? body.periodEnd ?? new Date().toISOString().slice(0, 10);
    const triggeredBy = body.triggered_by ?? `edge:${body.run_type ?? 'manual'}`;

    if (!organizationId) return json({ error: 'organization_id is required' }, 400);
    if (!isUuid(organizationId)) return json({ error: 'organization_id must be a valid UUID' }, 400);
    if (!isDate(periodStart) || !isDate(periodEnd)) return json({ error: 'period_start and period_end must use YYYY-MM-DD' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets are required' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const attempts = [
      {
        name: 'run_ai_engine_v2',
        args: {
          p_organization_id: organizationId,
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_triggered_by: triggeredBy
        }
      },
      {
        name: 'run_ai_analytics_engine_v1',
        args: {
          p_organization_id: organizationId,
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_triggered_by: triggeredBy
        }
      },
      {
        name: 'run_advanced_report_ml_v3',
        args: {
          p_organization_id: organizationId,
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_triggered_by: triggeredBy
        }
      }
    ];

    const errors: Array<{ function_name: string; message: string }> = [];
    for (const attempt of attempts) {
      const { data, error } = await supabase.rpc(attempt.name, attempt.args);
      if (!error) {
        const resultRow = Array.isArray(data) ? data[0] : data;
        return json({
          ok: true,
          gateway: 'edge-function',
          function_name: attempt.name,
          organization_id: organizationId,
          period_start: periodStart,
          period_end: periodEnd,
          triggered_by: triggeredBy,
          result: resultRow ?? data,
          raw: data
        });
      }
      errors.push({ function_name: attempt.name, message: error.message });
    }

    return json({
      ok: false,
      error: 'No AI engine RPC succeeded. Install true_ai_engine_v2_modular_neural_fixed.sql first.',
      attempts: errors
    }, 500);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

async function readBody(req: Request): Promise<RequestBody> {
  try {
    return await req.json() as RequestBody;
  } catch {
    return {};
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function defaultPeriodStart() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
