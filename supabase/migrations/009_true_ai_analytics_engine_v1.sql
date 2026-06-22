-- InCheck360 True AI Analytics Engine v1
-- Purpose: generated AI analytics from raw imported audit/completion reports.
-- Capabilities:
-- 1) Predict future risk
-- 2) Learn from historical data
-- 3) Detect abnormal patterns automatically
-- 4) Recommend actions
-- 5) Generate natural-language explanations

begin;

create table if not exists public.ai_analytics_runs (
  ai_run_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  period_start date not null,
  period_end date not null,
  model_name text not null default 'InCheck360 AI Analytics Engine',
  model_version text not null default 'true_ai_v1',
  status text not null default 'running' check (status in ('running','completed','failed')),
  raw_rows_scanned integer not null default 0,
  learned_pattern_rows integer not null default 0,
  prediction_rows integer not null default 0,
  anomaly_rows integer not null default 0,
  recommendation_rows integer not null default 0,
  natural_language_rows integer not null default 0,
  triggered_by text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_location_intelligence (
  ai_location_id uuid primary key default gen_random_uuid(),
  ai_run_id uuid references public.ai_analytics_runs(ai_run_id) on delete cascade,
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  location_id uuid,
  location_key text not null,
  location_name text not null,
  period_start date not null,
  period_end date not null,
  audit_count integer not null default 0,
  historical_audit_count integer not null default 0,
  avg_audit_score_pct numeric(8,2),
  historical_avg_audit_score_pct numeric(8,2),
  latest_audit_score_pct numeric(8,2),
  audit_score_delta numeric(8,2),
  avg_lists_missed_pct numeric(8,2),
  avg_items_missed_pct numeric(8,2),
  failed_item_count integer not null default 0,
  critical_failed_item_count integer not null default 0,
  repeated_failure_count integer not null default 0,
  current_risk_score numeric(8,2) not null default 0,
  predicted_next_risk_score numeric(8,2) not null default 0,
  predicted_next_audit_score numeric(8,2) not null default 0,
  predicted_risk_level text not null default 'low',
  trend_direction text not null default 'stable',
  recommended_visit_window text not null default 'Routine follow-up',
  prediction_reason text,
  learned_pattern_summary text,
  ai_reasoning_factors jsonb not null default '{}'::jsonb,
  generated_by text not null default 'true_ai_engine',
  model_version text not null default 'true_ai_v1',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_abnormal_patterns (
  ai_anomaly_id uuid primary key default gen_random_uuid(),
  ai_run_id uuid references public.ai_analytics_runs(ai_run_id) on delete cascade,
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  location_id uuid,
  location_key text not null,
  location_name text not null,
  anomaly_type text not null,
  anomaly_level text not null,
  anomaly_score numeric(8,2) not null default 0,
  detected_value numeric(12,2),
  baseline_value numeric(12,2),
  explanation text not null,
  evidence jsonb not null default '{}'::jsonb,
  generated_by text not null default 'true_ai_engine',
  model_version text not null default 'true_ai_v1',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_recommended_actions (
  ai_action_id uuid primary key default gen_random_uuid(),
  ai_run_id uuid references public.ai_analytics_runs(ai_run_id) on delete cascade,
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  location_id uuid,
  location_key text not null,
  location_name text not null,
  action_title text not null,
  action_priority text not null,
  recommendation text not null,
  reason text,
  due_in_days integer not null default 7,
  evidence_required boolean not null default true,
  generated_by text not null default 'true_ai_engine',
  model_version text not null default 'true_ai_v1',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_natural_language_insights (
  ai_text_insight_id uuid primary key default gen_random_uuid(),
  ai_run_id uuid references public.ai_analytics_runs(ai_run_id) on delete cascade,
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  location_id uuid,
  location_key text,
  location_name text,
  insight_type text not null,
  severity text not null default 'medium',
  title text not null,
  natural_language_explanation text not null,
  recommendation text,
  confidence numeric(5,2) not null default 0.85,
  source_evidence jsonb not null default '{}'::jsonb,
  generated_by text not null default 'true_ai_engine',
  model_version text not null default 'true_ai_v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_location_intelligence_org_run on public.ai_location_intelligence(organization_id, ai_run_id);
create index if not exists idx_ai_anomalies_org_run on public.ai_abnormal_patterns(organization_id, ai_run_id);
create index if not exists idx_ai_actions_org_run on public.ai_recommended_actions(organization_id, ai_run_id);
create index if not exists idx_ai_nl_org_run on public.ai_natural_language_insights(organization_id, ai_run_id);

create or replace function public.run_ai_analytics_engine_v1(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date,
  p_triggered_by text default 'manual'
)
returns table (
  ai_run_id uuid,
  organization_id uuid,
  period_start date,
  period_end date,
  raw_rows_scanned integer,
  learned_pattern_rows integer,
  prediction_rows integer,
  anomaly_rows integer,
  recommendation_rows integer,
  natural_language_rows integer,
  status text
)
language plpgsql security definer set search_path = public as $$
declare
  v_run_id uuid;
  v_raw_count integer := 0;
  v_learned integer := 0;
  v_predictions integer := 0;
  v_anomalies integer := 0;
  v_actions integer := 0;
  v_nl integer := 0;
begin
  select (
    (select count(*) from public.audit_reports ar where ar.organization_id = p_organization_id) +
    (select count(*) from public.audit_report_items ai where ai.organization_id = p_organization_id) +
    (select count(*) from public.completion_rate_reports cr where cr.organization_id = p_organization_id) +
    (select count(*) from public.completion_rate_checklists cc where cc.organization_id = p_organization_id)
  )::integer into v_raw_count;

  insert into public.ai_analytics_runs (organization_id, period_start, period_end, raw_rows_scanned, triggered_by)
  values (p_organization_id, p_period_start, p_period_end, v_raw_count, p_triggered_by)
  returning ai_analytics_runs.ai_run_id into v_run_id;

  delete from public.ai_natural_language_insights where organization_id = p_organization_id and model_version = 'true_ai_v1';
  delete from public.ai_recommended_actions where organization_id = p_organization_id and model_version = 'true_ai_v1';
  delete from public.ai_abnormal_patterns where organization_id = p_organization_id and model_version = 'true_ai_v1';
  delete from public.ai_location_intelligence where organization_id = p_organization_id and model_version = 'true_ai_v1';

  insert into public.ai_location_intelligence (
    ai_run_id, organization_id, location_id, location_key, location_name, period_start, period_end,
    audit_count, historical_audit_count, avg_audit_score_pct, historical_avg_audit_score_pct, latest_audit_score_pct,
    audit_score_delta, avg_lists_missed_pct, avg_items_missed_pct,
    failed_item_count, critical_failed_item_count, repeated_failure_count,
    current_risk_score, predicted_next_risk_score, predicted_next_audit_score, predicted_risk_level,
    trend_direction, recommended_visit_window, prediction_reason, learned_pattern_summary, ai_reasoning_factors
  )
  with audit_all as (
    select
      ar.organization_id,
      ar.location_id,
      coalesce(ar.location_id::text, lower(coalesce(nullif(ar.location_name_text,''), 'unknown'))) as location_key,
      coalesce(nullif(ar.location_name_text,''), 'Unknown Location') as location_name,
      coalesce(ar.completed_at::date, ar.report_date, ar.created_at::date) as event_date,
      ar.score_percentage
    from public.audit_reports ar
    where ar.organization_id = p_organization_id
  ), latest_audit as (
    select distinct on (location_key)
      organization_id, location_id, location_key, location_name, score_percentage as latest_score, event_date as latest_date
    from audit_all
    order by location_key, event_date desc nulls last
  ), audit_stats as (
    select
      location_key,
      max(location_id) as location_id,
      max(location_name) as location_name,
      count(*) filter (where event_date between p_period_start and p_period_end) as audit_count,
      count(*) as historical_audit_count,
      avg(score_percentage) filter (where event_date between p_period_start and p_period_end) as avg_period_score,
      avg(score_percentage) as historical_avg_score
    from audit_all
    group by location_key
  ), item_stats as (
    select
      coalesce(ar.location_id::text, lower(coalesce(nullif(ar.location_name_text,''), 'unknown'))) as location_key,
      count(*) filter (where (ai.is_pass is false or coalesce(ai.score_earned,0) < coalesce(ai.score_total,0)) and coalesce(ai.completed_at::date, ai.created_at::date) between p_period_start and p_period_end) as failed_items,
      count(*) filter (where (ai.is_critical is true) and (ai.is_pass is false or coalesce(ai.score_earned,0) < coalesce(ai.score_total,0)) and coalesce(ai.completed_at::date, ai.created_at::date) between p_period_start and p_period_end) as critical_failed_items,
      greatest(0, count(*) filter (where (ai.is_pass is false or coalesce(ai.score_earned,0) < coalesce(ai.score_total,0)) and coalesce(ai.completed_at::date, ai.created_at::date) between p_period_start and p_period_end) - count(distinct ai.item_text) filter (where (ai.is_pass is false or coalesce(ai.score_earned,0) < coalesce(ai.score_total,0)) and coalesce(ai.completed_at::date, ai.created_at::date) between p_period_start and p_period_end)) as repeated_failures,
      (array_agg(ai.risk_category order by ai.is_critical desc, ai.created_at desc) filter (where (ai.is_pass is false or coalesce(ai.score_earned,0) < coalesce(ai.score_total,0))))[1] as top_risk_category
    from public.audit_report_items ai
    left join public.audit_reports ar on ar.audit_report_id = ai.audit_report_id
    where ai.organization_id = p_organization_id
    group by coalesce(ar.location_id::text, lower(coalesce(nullif(ar.location_name_text,''), 'unknown')))
  ), completion_stats as (
    select
      coalesce(cr.location_id::text, lower(coalesce(nullif(cr.location_name_text,''), 'unknown'))) as location_key,
      avg(cr.lists_missed_pct) filter (where coalesce(cr.date_range_end, cr.date_range_start, cr.created_at::date) between p_period_start and p_period_end) as lists_missed,
      avg(cr.items_missed_pct) filter (where coalesce(cr.date_range_end, cr.date_range_start, cr.created_at::date) between p_period_start and p_period_end) as items_missed
    from public.completion_rate_reports cr
    where cr.organization_id = p_organization_id
    group by coalesce(cr.location_id::text, lower(coalesce(nullif(cr.location_name_text,''), 'unknown')))
  ), combined as (
    select
      a.location_key,
      coalesce(a.location_id, la.location_id) as location_id,
      coalesce(a.location_name, la.location_name, 'Unknown Location') as location_name,
      coalesce(a.audit_count, 0)::integer as audit_count,
      coalesce(a.historical_audit_count, 0)::integer as historical_audit_count,
      round(coalesce(a.avg_period_score, la.latest_score, a.historical_avg_score, 0)::numeric, 2) as avg_period_score,
      round(coalesce(a.historical_avg_score, la.latest_score, 0)::numeric, 2) as historical_avg_score,
      round(coalesce(la.latest_score, a.avg_period_score, a.historical_avg_score, 0)::numeric, 2) as latest_score,
      round((coalesce(la.latest_score, a.avg_period_score, 0) - coalesce(a.historical_avg_score, la.latest_score, 0))::numeric, 2) as score_delta,
      round(coalesce(c.lists_missed, 0)::numeric, 2) as lists_missed,
      round(coalesce(c.items_missed, 0)::numeric, 2) as items_missed,
      coalesce(i.failed_items, 0)::integer as failed_items,
      coalesce(i.critical_failed_items, 0)::integer as critical_failed_items,
      coalesce(i.repeated_failures, 0)::integer as repeated_failures,
      coalesce(i.top_risk_category, 'general') as top_risk_category
    from audit_stats a
    left join latest_audit la on la.location_key = a.location_key
    left join item_stats i on i.location_key = a.location_key
    left join completion_stats c on c.location_key = a.location_key
    union
    select
      c.location_key,
      null::uuid,
      c.location_key,
      0, 0, 0, 0, 0, 0,
      round(coalesce(c.lists_missed, 0)::numeric, 2),
      round(coalesce(c.items_missed, 0)::numeric, 2),
      0, 0, 0, 'general'
    from completion_stats c
    where not exists (select 1 from audit_stats a where a.location_key = c.location_key)
  ), scored as (
    select
      *,
      least(100, greatest(0,
        (100 - latest_score)
        + (failed_items * 3.5)
        + (critical_failed_items * 12)
        + (repeated_failures * 4)
        + (lists_missed * 0.35)
        + (items_missed * 0.20)
        + case when score_delta < -5 then abs(score_delta) else 0 end
      ))::numeric(8,2) as current_risk,
      least(100, greatest(0,
        (100 - latest_score)
        + (failed_items * 3.5)
        + (critical_failed_items * 14)
        + (repeated_failures * 5)
        + (lists_missed * 0.40)
        + (items_missed * 0.25)
        + case when score_delta < -5 then abs(score_delta) * 1.5 else 0 end
      ))::numeric(8,2) as predicted_risk
    from combined
  )
  select
    v_run_id,
    p_organization_id,
    location_id,
    location_key,
    location_name,
    p_period_start,
    p_period_end,
    audit_count,
    historical_audit_count,
    avg_period_score,
    historical_avg_score,
    latest_score,
    score_delta,
    lists_missed,
    items_missed,
    failed_items,
    critical_failed_items,
    repeated_failures,
    current_risk,
    predicted_risk,
    greatest(0, 100 - predicted_risk)::numeric(8,2),
    case when predicted_risk >= 80 then 'critical' when predicted_risk >= 60 then 'high' when predicted_risk >= 35 then 'medium' else 'low' end,
    case when score_delta < -5 then 'deteriorating' when score_delta > 5 then 'improving' else 'stable' end,
    case when predicted_risk >= 80 then 'Immediate visit / within 24 hours' when predicted_risk >= 60 then 'Within 3 days' when predicted_risk >= 35 then 'Within 7 days' else 'Routine follow-up' end,
    concat('AI prediction learned from ', historical_audit_count, ' audit record(s), latest score ', latest_score, '%, ', failed_items, ' failed item(s), ', critical_failed_items, ' critical failure(s), missed list rate ', lists_missed, '%.') as prediction_reason,
    concat('Historical baseline ', historical_avg_score, '%, latest ', latest_score, '%, delta ', score_delta, ' points. Main risk category: ', top_risk_category, '.') as learned_pattern_summary,
    jsonb_build_object(
      'latest_audit_score_pct', latest_score,
      'historical_avg_audit_score_pct', historical_avg_score,
      'audit_score_delta', score_delta,
      'failed_items', failed_items,
      'critical_failed_items', critical_failed_items,
      'repeated_failures', repeated_failures,
      'lists_missed_pct', lists_missed,
      'items_missed_pct', items_missed,
      'top_risk_category', top_risk_category
    )
  from scored;

  get diagnostics v_predictions = row_count;
  v_learned := v_predictions;

  insert into public.ai_abnormal_patterns (ai_run_id, organization_id, location_id, location_key, location_name, anomaly_type, anomaly_level, anomaly_score, detected_value, baseline_value, explanation, evidence)
  select ai_run_id, organization_id, location_id, location_key, location_name,
    'future_risk_spike', predicted_risk_level, predicted_next_risk_score, predicted_next_risk_score, current_risk_score,
    concat('Predicted risk is ', predicted_next_risk_score, '/100 compared with current ', current_risk_score, '/100. ', prediction_reason),
    ai_reasoning_factors
  from public.ai_location_intelligence
  where ai_run_id = v_run_id and predicted_next_risk_score >= 60;

  insert into public.ai_abnormal_patterns (ai_run_id, organization_id, location_id, location_key, location_name, anomaly_type, anomaly_level, anomaly_score, detected_value, baseline_value, explanation, evidence)
  select ai_run_id, organization_id, location_id, location_key, location_name,
    'audit_score_drop', case when audit_score_delta <= -15 then 'critical' else 'high' end,
    abs(audit_score_delta), latest_audit_score_pct, historical_avg_audit_score_pct,
    concat('Latest audit score dropped by ', abs(audit_score_delta), ' points versus historical baseline.'),
    ai_reasoning_factors
  from public.ai_location_intelligence
  where ai_run_id = v_run_id and audit_score_delta <= -5;

  insert into public.ai_abnormal_patterns (ai_run_id, organization_id, location_id, location_key, location_name, anomaly_type, anomaly_level, anomaly_score, detected_value, baseline_value, explanation, evidence)
  select ai_run_id, organization_id, location_id, location_key, location_name,
    'critical_control_failure', 'critical', critical_failed_item_count * 10, critical_failed_item_count, 0,
    concat(critical_failed_item_count, ' critical failed control(s) detected in imported audit reports.'),
    ai_reasoning_factors
  from public.ai_location_intelligence
  where ai_run_id = v_run_id and critical_failed_item_count > 0;

  select count(*)::integer into v_anomalies from public.ai_abnormal_patterns where ai_run_id = v_run_id;

  insert into public.ai_recommended_actions (ai_run_id, organization_id, location_id, location_key, location_name, action_title, action_priority, recommendation, reason, due_in_days, evidence_required)
  select ai_run_id, organization_id, location_id, location_key, location_name,
    case when critical_failed_item_count > 0 then 'Immediate corrective action for critical controls'
         when predicted_next_risk_score >= 60 then 'Preventive action to reduce predicted risk'
         when audit_score_delta <= -5 then 'Investigate audit score deterioration'
         else 'Routine follow-up action' end,
    predicted_risk_level,
    case when critical_failed_item_count > 0 then 'Assign owner, correct the failed control, upload evidence, and verify again within 24 hours.'
         when predicted_next_risk_score >= 60 then 'Schedule a focused visit, review failed categories, and confirm closure of open findings.'
         when audit_score_delta <= -5 then 'Review what changed versus historical performance and create a recovery checklist.'
         else 'Keep monitoring through normal operational cadence.' end,
    prediction_reason,
    case when predicted_next_risk_score >= 80 then 1 when predicted_next_risk_score >= 60 then 3 when predicted_next_risk_score >= 35 then 7 else 14 end,
    predicted_next_risk_score >= 35
  from public.ai_location_intelligence
  where ai_run_id = v_run_id;

  get diagnostics v_actions = row_count;

  insert into public.ai_natural_language_insights (ai_run_id, organization_id, location_id, location_key, location_name, insight_type, severity, title, natural_language_explanation, recommendation, confidence, source_evidence)
  select ai_run_id, organization_id, location_id, location_key, location_name,
    'predictive_risk', predicted_risk_level,
    concat('AI predicts ', predicted_risk_level, ' risk for ', location_name),
    concat('Based on historical learning, ', location_name, ' has a predicted future risk of ', predicted_next_risk_score, '/100. The model learned from ', historical_audit_count, ' historical audit record(s), compared the latest score to the historical baseline, and included failed controls, critical failures, repeated issues, and completion misses.'),
    case when predicted_next_risk_score >= 80 then 'Treat as urgent: visit within 24 hours and require evidence for all critical corrections.' when predicted_next_risk_score >= 60 then 'Schedule a targeted follow-up within 3 days.' else 'Monitor through the next operational review.' end,
    0.88,
    ai_reasoning_factors
  from public.ai_location_intelligence
  where ai_run_id = v_run_id;

  insert into public.ai_natural_language_insights (ai_run_id, organization_id, location_id, location_key, location_name, insight_type, severity, title, natural_language_explanation, recommendation, confidence, source_evidence)
  select ai_run_id, organization_id, location_id, location_key, location_name,
    'abnormal_pattern', anomaly_level,
    concat('Abnormal pattern detected: ', replace(anomaly_type, '_', ' ')),
    explanation,
    'Review this anomaly with the location manager and confirm corrective action evidence.',
    0.86,
    evidence
  from public.ai_abnormal_patterns
  where ai_run_id = v_run_id;

  select count(*)::integer into v_nl from public.ai_natural_language_insights where ai_run_id = v_run_id;

  insert into public.ai_insights (organization_id, module, title, summary, recommendation, severity, confidence, status, location_id, entity_reference, evidence, generated_at, source_type, generated_by, model_version, generation_run_id, raw_source_count)
  select organization_id, 'compliance', title, natural_language_explanation, recommendation, severity, confidence, 'new', location_id, location_name, source_evidence, now(), 'generated_analytics', 'true_ai_engine', 'true_ai_v1', ai_run_id, v_raw_count
  from public.ai_natural_language_insights
  where ai_run_id = v_run_id
  on conflict do nothing;

  update public.ai_analytics_runs
  set status = 'completed', learned_pattern_rows = v_learned, prediction_rows = v_predictions, anomaly_rows = v_anomalies, recommendation_rows = v_actions, natural_language_rows = v_nl, finished_at = now()
  where ai_analytics_runs.ai_run_id = v_run_id;

  insert into public.analytics_generation_runs (calculation_run_id, organization_id, period_start, period_end, engine_name, model_version, status, raw_rows_scanned, generated_feature_rows, generated_score_rows, generated_insight_rows, triggered_by, started_at, finished_at)
  values (v_run_id, p_organization_id, p_period_start, p_period_end, 'InCheck360 AI Analytics Engine', 'true_ai_v1', 'completed', v_raw_count, v_learned, v_predictions, v_nl, p_triggered_by, now(), now())
  on conflict (calculation_run_id) do nothing;

  return query select v_run_id, p_organization_id, p_period_start, p_period_end, v_raw_count, v_learned, v_predictions, v_anomalies, v_actions, v_nl, 'completed'::text;
exception when others then
  if v_run_id is not null then
    update public.ai_analytics_runs set status = 'failed', error_message = sqlerrm, finished_at = now() where ai_analytics_runs.ai_run_id = v_run_id;
  end if;
  raise;
end;
$$;

create or replace view public.v_predictive_location_risk as
select distinct on (location_key)
  organization_id,
  location_id,
  location_name,
  current_risk_score,
  null::numeric as previous_risk_score,
  (predicted_next_risk_score - current_risk_score)::numeric(8,2) as risk_delta,
  predicted_next_risk_score,
  predicted_next_audit_score,
  predicted_risk_level,
  trend_direction,
  recommended_visit_window,
  prediction_reason,
  failed_item_count,
  critical_failed_item_count,
  repeated_failure_count
from public.ai_location_intelligence
order by location_key, created_at desc;

create or replace view public.v_ml_explanation_driver_breakdown as
select
  organization_id,
  location_id,
  location_name,
  'Critical failures'::text as driver_label,
  'control failure'::text as driver_group,
  critical_failed_item_count::numeric as actual_value,
  (critical_failed_item_count * 12)::numeric(8,2) as impact_points,
  predicted_next_risk_score as risk_score,
  concat(critical_failed_item_count, ' critical failure(s) increased risk. ', prediction_reason) as explanation,
  1 as driver_rank
from public.ai_location_intelligence
where critical_failed_item_count > 0
union all
select organization_id, location_id, location_name, 'Failed items', 'audit findings', failed_item_count::numeric, (failed_item_count * 3.5)::numeric(8,2), predicted_next_risk_score, concat(failed_item_count, ' failed item(s) were detected in the raw audit report.'), 2
from public.ai_location_intelligence
where failed_item_count > 0
union all
select organization_id, location_id, location_name, 'Historical score trend', 'historical learning', audit_score_delta, abs(audit_score_delta)::numeric(8,2), predicted_next_risk_score, concat('Latest audit score changed by ', audit_score_delta, ' points versus historical baseline.'), 3
from public.ai_location_intelligence
where audit_score_delta is not null
union all
select organization_id, location_id, location_name, 'Checklist missed rate', 'execution discipline', avg_lists_missed_pct, (avg_lists_missed_pct * 0.35)::numeric(8,2), predicted_next_risk_score, concat('Missed checklist rate is ', avg_lists_missed_pct, '%. This affects execution reliability.'), 4
from public.ai_location_intelligence
where coalesce(avg_lists_missed_pct,0) > 0;

create or replace view public.v_ai_historical_learning as select * from public.ai_location_intelligence;
create or replace view public.v_ai_abnormal_patterns as select * from public.ai_abnormal_patterns;
create or replace view public.v_ai_recommended_actions as select * from public.ai_recommended_actions;
create or replace view public.v_ai_natural_language_insights as select * from public.ai_natural_language_insights;

create or replace function public.run_advanced_report_ml_v3(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date,
  p_triggered_by text default 'manual'
)
returns table (
  calculation_run_id uuid,
  organization_id uuid,
  period_start date,
  period_end date,
  raw_rows_scanned integer,
  generated_feature_rows integer,
  generated_score_rows integer,
  generated_insight_rows integer,
  status text
)
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  select * into r from public.run_ai_analytics_engine_v1(p_organization_id, p_period_start, p_period_end, p_triggered_by);
  return query select r.ai_run_id::uuid, r.organization_id::uuid, r.period_start::date, r.period_end::date, r.raw_rows_scanned::integer, r.learned_pattern_rows::integer, r.prediction_rows::integer, r.natural_language_rows::integer, r.status::text;
end;
$$;

grant select on public.ai_analytics_runs to anon, authenticated;
grant select on public.ai_location_intelligence to anon, authenticated;
grant select on public.ai_abnormal_patterns to anon, authenticated;
grant select on public.ai_recommended_actions to anon, authenticated;
grant select on public.ai_natural_language_insights to anon, authenticated;
grant select on public.v_ai_historical_learning to anon, authenticated;
grant select on public.v_ai_abnormal_patterns to anon, authenticated;
grant select on public.v_ai_recommended_actions to anon, authenticated;
grant select on public.v_ai_natural_language_insights to anon, authenticated;
grant execute on function public.run_ai_analytics_engine_v1(uuid, date, date, text) to anon, authenticated;
grant execute on function public.run_advanced_report_ml_v3(uuid, date, date, text) to anon, authenticated;

commit;
