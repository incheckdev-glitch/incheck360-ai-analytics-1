// Supabase Edge Function: ai-generate-insights
// Internal ML/rule-scoring engine. No OpenAI key and no external AI API are required.
// Deploy with: supabase functions deploy ai-generate-insights
// Set secrets: supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

type RunType = 'daily' | 'manual' | 'location' | 'backfill';
type Severity = 'low' | 'medium' | 'high' | 'critical';

interface RequestBody {
  organization_id: string;
  location_id?: string;
  run_type?: RunType;
}

interface LocationRow {
  location_id: string;
  location_code: string;
  location_name: string;
  status: string;
  region?: string;
  city?: string;
}

interface TaskRow {
  task_id: string;
  location_id: string | null;
  title: string;
  priority: Severity;
  status: string;
  completion_percent: number;
  due_at: string | null;
}

interface IncidentRow {
  incident_id: string;
  location_id: string | null;
  incident_reference: string;
  title: string;
  category: string;
  severity: Severity;
  status: string;
  reported_at: string;
}

interface CorrectiveActionRow {
  corrective_action_id: string;
  location_id: string | null;
  title: string;
  status: string;
  severity: Severity;
  due_at: string | null;
  evidence_required: boolean;
}

interface SubmissionRow {
  submission_id: string;
  location_id: string;
  score: number | null;
  submitted_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });

  try {
    const body = await req.json() as RequestBody;
    if (!body.organization_id) return json({ error: 'organization_id is required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets are required' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: run, error: runError } = await supabase
      .from('ai_model_runs')
      .insert({
        organization_id: body.organization_id,
        run_type: body.run_type ?? 'manual',
        model_provider: 'internal_ml',
        model_name: 'ops_risk_v1',
        status: 'running'
      })
      .select('*')
      .single();
    if (runError) throw runError;

    const locationQuery = supabase
      .from('locations')
      .select('location_id, location_code, location_name, status, region, city')
      .eq('organization_id', body.organization_id)
      .neq('status', 'paused');

    if (body.location_id) locationQuery.eq('location_id', body.location_id);

    const [locationsResult, tasksResult, incidentsResult, actionsResult, submissionsResult] = await Promise.all([
      locationQuery,
      supabase
        .from('execution_tasks')
        .select('task_id, location_id, title, priority, status, completion_percent, due_at')
        .eq('organization_id', body.organization_id)
        .neq('status', 'done'),
      supabase
        .from('incidents')
        .select('incident_id, location_id, incident_reference, title, category, severity, status, reported_at')
        .eq('organization_id', body.organization_id)
        .in('status', ['open', 'investigating']),
      supabase
        .from('corrective_actions')
        .select('corrective_action_id, location_id, title, status, severity, due_at, evidence_required')
        .eq('organization_id', body.organization_id)
        .neq('status', 'done'),
      supabase
        .from('checklist_submissions')
        .select('submission_id, location_id, score, submitted_at')
        .eq('organization_id', body.organization_id)
        .order('submitted_at', { ascending: false })
        .limit(500)
    ]);

    if (locationsResult.error) throw locationsResult.error;
    if (tasksResult.error) throw tasksResult.error;
    if (incidentsResult.error) throw incidentsResult.error;
    if (actionsResult.error) throw actionsResult.error;
    if (submissionsResult.error) throw submissionsResult.error;

    const locations = (locationsResult.data ?? []) as LocationRow[];
    const tasks = (tasksResult.data ?? []) as TaskRow[];
    const incidents = (incidentsResult.data ?? []) as IncidentRow[];
    const actions = (actionsResult.data ?? []) as CorrectiveActionRow[];
    const submissions = (submissionsResult.data ?? []) as SubmissionRow[];

    const scoreRows: Record<string, unknown>[] = [];
    const insightRows: Record<string, unknown>[] = [];
    const snapshotRows: Record<string, unknown>[] = [];

    for (const location of locations) {
      const features = buildFeatures(location, tasks, incidents, actions, submissions);
      const { riskScore, healthScore, severity, confidence, topDrivers } = scoreLocation(features);

      scoreRows.push({
        organization_id: body.organization_id,
        run_id: run.run_id,
        location_id: location.location_id,
        risk_score: riskScore,
        health_score: healthScore,
        predicted_risk_level: severity,
        confidence,
        features,
        top_drivers: topDrivers
      });

      snapshotRows.push({
        organization_id: body.organization_id,
        run_id: run.run_id,
        entity_type: 'location',
        entity_id: location.location_id,
        entity_reference: location.location_code,
        location_id: location.location_id,
        source_module: 'internal_ml',
        source_data: location,
        feature_data: features
      });

      if (severity !== 'low') {
        insightRows.push(buildLocationInsight(body.organization_id, run.run_id, location, features, riskScore, severity, confidence, topDrivers));
      }

      const foodSafetyInsight = buildFoodSafetyInsight(body.organization_id, run.run_id, location, incidents, actions);
      if (foodSafetyInsight) insightRows.push(foodSafetyInsight);
    }

    if (scoreRows.length) {
      const { error } = await supabase.from('internal_ml_location_scores').insert(scoreRows);
      if (error) throw error;
    }

    if (snapshotRows.length) {
      const { error } = await supabase.from('ai_entity_snapshots').insert(snapshotRows);
      if (error) throw error;
    }

    let insertedInsights = 0;
    if (insightRows.length) {
      const { error } = await supabase.from('ai_insights').insert(insightRows);
      if (error) throw error;
      insertedInsights = insightRows.length;
    }

    await supabase
      .from('ai_model_runs')
      .update({
        status: 'completed',
        rows_scored: scoreRows.length,
        insights_created: insertedInsights,
        finished_at: new Date().toISOString()
      })
      .eq('run_id', run.run_id);

    return json({
      run_id: run.run_id,
      model_provider: 'internal_ml',
      model_name: 'ops_risk_v1',
      rows_scored: scoreRows.length,
      insights_created: insertedInsights,
      scores: scoreRows,
      insights: insightRows
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

function buildFeatures(
  location: LocationRow,
  tasks: TaskRow[],
  incidents: IncidentRow[],
  actions: CorrectiveActionRow[],
  submissions: SubmissionRow[]
) {
  const now = new Date();
  const locationTasks = tasks.filter((task) => task.location_id === location.location_id);
  const locationIncidents = incidents.filter((incident) => incident.location_id === location.location_id);
  const locationActions = actions.filter((action) => action.location_id === location.location_id);
  const locationSubmissions = submissions.filter((submission) => submission.location_id === location.location_id);

  const latestSubmission = locationSubmissions[0];
  const recentScores = locationSubmissions
    .filter((submission) => submission.score !== null)
    .slice(0, 10)
    .map((submission) => Number(submission.score));
  const averageChecklistScore = recentScores.length
    ? round(recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length, 2)
    : null;

  const daysSinceLastAudit = latestSubmission
    ? Math.floor((now.getTime() - new Date(latestSubmission.submitted_at).getTime()) / 86_400_000)
    : null;

  return {
    open_tasks: locationTasks.length,
    overdue_tasks: locationTasks.filter((task) => isOverdue(task.due_at, now) || task.status === 'overdue').length,
    blocked_tasks: locationTasks.filter((task) => task.status === 'blocked').length,
    critical_open_tasks: locationTasks.filter((task) => task.priority === 'critical').length,
    high_open_tasks: locationTasks.filter((task) => task.priority === 'high').length,
    avg_open_task_completion: locationTasks.length
      ? round(locationTasks.reduce((sum, task) => sum + Number(task.completion_percent ?? 0), 0) / locationTasks.length, 2)
      : 100,
    open_incidents: locationIncidents.length,
    critical_incidents: locationIncidents.filter((incident) => incident.severity === 'critical').length,
    high_incidents: locationIncidents.filter((incident) => incident.severity === 'high').length,
    food_safety_incidents: locationIncidents.filter((incident) => incident.category.toLowerCase().includes('food')).length,
    open_corrective_actions: locationActions.length,
    overdue_corrective_actions: locationActions.filter((action) => isOverdue(action.due_at, now) || action.status === 'overdue').length,
    blocked_corrective_actions: locationActions.filter((action) => action.status === 'blocked').length,
    evidence_required_open_actions: locationActions.filter((action) => action.evidence_required).length,
    average_checklist_score: averageChecklistScore,
    low_checklist_score_gap: averageChecklistScore === null ? 0 : Math.max(0, 90 - averageChecklistScore),
    days_since_last_audit: daysSinceLastAudit,
    days_since_last_audit_over_7: daysSinceLastAudit === null ? 7 : Math.max(0, daysSinceLastAudit - 7)
  };
}

function scoreLocation(features: Record<string, number | null>) {
  const contributions = [
    driver('Overdue tasks', Number(features.overdue_tasks) * 12),
    driver('Blocked tasks', Number(features.blocked_tasks) * 18),
    driver('Critical open tasks', Number(features.critical_open_tasks) * 10),
    driver('Open incidents', Number(features.open_incidents) * 10),
    driver('Critical incidents', Number(features.critical_incidents) * 25),
    driver('High incidents', Number(features.high_incidents) * 15),
    driver('Overdue corrective actions', Number(features.overdue_corrective_actions) * 14),
    driver('Blocked corrective actions', Number(features.blocked_corrective_actions) * 18),
    driver('Evidence-required actions', Number(features.evidence_required_open_actions) * 6),
    driver('Checklist score gap below 90', Number(features.low_checklist_score_gap) * 1.2),
    driver('Audit gap over 7 days', Number(features.days_since_last_audit_over_7) * 2)
  ].map((item) => ({ ...item, contribution: Math.min(item.contribution, item.cap ?? 100) }));

  const rawRisk = contributions.reduce((sum, item) => sum + item.contribution, 0);
  const riskScore = round(Math.min(100, rawRisk), 2);
  const healthScore = round(100 - riskScore, 2);
  const severity = severityFromScore(riskScore);
  const openSignals = contributions.filter((item) => item.contribution > 0).length;
  const confidence = round(Math.min(0.95, Math.max(0.55, 0.58 + openSignals * 0.045 + (features.average_checklist_score !== null ? 0.12 : 0))), 3);
  const topDrivers = contributions
    .filter((item) => item.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5);

  return { riskScore, healthScore, severity, confidence, topDrivers };
}

function buildLocationInsight(
  organizationId: string,
  runId: string,
  location: LocationRow,
  features: Record<string, number | null>,
  riskScore: number,
  severity: Severity,
  confidence: number,
  topDrivers: Array<{ label: string; contribution: number }>
) {
  const evidence = topDrivers.map((driverItem) => `${driverItem.label}: ${round(driverItem.contribution, 1)} risk points`);
  return {
    organization_id: organizationId,
    run_id: runId,
    module: 'locations',
    entity_type: 'location',
    entity_id: location.location_id,
    entity_reference: location.location_code,
    location_id: location.location_id,
    title: `${location.location_name} predicted as ${severity} operational risk`,
    summary: `Internal ML score is ${riskScore}/100. Open tasks: ${features.open_tasks}, open incidents: ${features.open_incidents}, open corrective actions: ${features.open_corrective_actions}.`,
    recommendation: recommendationForSeverity(severity),
    severity,
    confidence,
    evidence,
    output_json: { model: 'ops_risk_v1', features, top_drivers: topDrivers, risk_score: riskScore }
  };
}

function buildFoodSafetyInsight(
  organizationId: string,
  runId: string,
  location: LocationRow,
  incidents: IncidentRow[],
  actions: CorrectiveActionRow[]
) {
  const foodIncidents = incidents.filter((incident) => incident.location_id === location.location_id && incident.category.toLowerCase().includes('food'));
  const evidenceActions = actions.filter((action) => action.location_id === location.location_id && action.evidence_required && action.status !== 'done');
  if (!foodIncidents.length && evidenceActions.length < 2) return null;

  const severity: Severity = foodIncidents.some((incident) => incident.severity === 'critical') ? 'critical' : 'high';
  return {
    organization_id: organizationId,
    run_id: runId,
    module: 'compliance',
    entity_type: 'location',
    entity_id: location.location_id,
    entity_reference: location.location_code,
    location_id: location.location_id,
    title: `Compliance evidence review needed at ${location.location_name}`,
    summary: `The internal model detected ${foodIncidents.length} food-safety incidents and ${evidenceActions.length} evidence-required open actions.`,
    recommendation: 'Escalate to the area manager, review photo evidence, and close corrective actions only after proof is uploaded.',
    severity,
    confidence: 0.86,
    evidence: [
      ...foodIncidents.map((incident) => `${incident.incident_reference}: ${incident.title}`),
      ...evidenceActions.slice(0, 3).map((action) => `Evidence required: ${action.title}`)
    ],
    output_json: { model: 'ops_risk_v1', food_incidents: foodIncidents, evidence_required_actions: evidenceActions }
  };
}

function driver(label: string, contribution: number, cap = 100) {
  return { label, contribution, cap };
}

function severityFromScore(score: number): Severity {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function recommendationForSeverity(severity: Severity) {
  if (severity === 'critical') return 'Escalate today, assign an owner, and verify evidence before the next shift closes.';
  if (severity === 'high') return 'Schedule manager follow-up within 24 hours and clear overdue corrective actions first.';
  return 'Monitor during the next audit cycle and confirm that open tasks are progressing.';
}

function isOverdue(dateValue: string | null, now: Date) {
  return Boolean(dateValue && new Date(dateValue).getTime() < now.getTime());
}

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
