-- Advanced InCheck360 Report ML & Analytics Upgrade
-- Run this after the report import schema + sample/import data.
-- It creates detailed analytics views and a safe read-only ML function.

-- 1) Failed item detail explorer
create or replace view public.v_advanced_report_failed_items as
select
  ai.organization_id,
  ai.location_id,
  coalesce(l.location_name, ar.location_name_text, ar.brand_name, 'Imported report location') as location_name,
  ar.client_name,
  ar.brand_name,
  ar.audit_report_id,
  ar.checklist_name,
  ar.report_date,
  ar.completed_at as audit_completed_at,
  ars.audit_section_id,
  coalesce(ars.section_name, 'Unsectioned') as section_name,
  ai.audit_item_id,
  ai.item_text,
  ai.result_value,
  ai.score_earned,
  ai.score_total,
  ai.score_percentage,
  ai.completed_by_name,
  ai.completed_at,
  ai.comment_text,
  ai.risk_category,
  ai.is_critical,
  case
    when ai.is_critical then 'critical'
    when ai.risk_category in ('cross_contamination','temperature_control','personal_hygiene') then 'high'
    when ai.risk_category in ('labeling','monitoring_records','equipment_condition','storage') then 'medium'
    else 'low'
  end as severity,
  case
    when ai.risk_category = 'cross_contamination' then 'Separate raw and ready-to-eat food, verify storage zones, retrain team, and add manager verification.'
    when ai.risk_category = 'temperature_control' then 'Check fridge/freezer temperature logs, repair equipment if needed, and require follow-up evidence.'
    when ai.risk_category = 'labeling' then 'Relabel all affected food/staff items, retrain on labeling rules, and check daily compliance.'
    when ai.risk_category = 'monitoring_records' then 'Complete missing monitoring sheets and assign a responsible manager for daily review.'
    when ai.risk_category = 'equipment_condition' then 'Repair or replace damaged/rusty equipment and upload proof after completion.'
    when ai.risk_category = 'personal_hygiene' then 'Refresh hygiene procedure training and conduct spot checks during the next shift.'
    else 'Create corrective action, assign owner, set due date, and require proof of completion.'
  end as recommended_action,
  case when ai.is_critical then 1 when ai.risk_category in ('cross_contamination','temperature_control') then 3 else 7 end as due_in_days,
  (coalesce(ai.is_pass, true) = false or (ai.score_total is not null and ai.score_total > 0 and coalesce(ai.score_earned,0) < ai.score_total)) as is_failed
from public.audit_report_items ai
join public.audit_reports ar on ar.audit_report_id = ai.audit_report_id
left join public.audit_report_sections ars on ars.audit_section_id = ai.audit_section_id
left join public.locations l on l.location_id = ai.location_id
where coalesce(ai.is_pass, true) = false
   or (ai.score_total is not null and ai.score_total > 0 and coalesce(ai.score_earned,0) < ai.score_total);

-- 2) Category analytics
create or replace view public.v_advanced_report_category_analytics as
select
  fi.organization_id,
  fi.location_id,
  fi.location_name,
  fi.risk_category,
  count(*)::integer as failed_item_count,
  count(*) filter (where fi.is_critical)::integer as critical_failed_item_count,
  count(distinct fi.audit_report_id)::integer as affected_audit_count,
  count(distinct fi.section_name)::integer as affected_section_count,
  round(avg(coalesce(fi.score_percentage, case when fi.score_total > 0 then (fi.score_earned / fi.score_total) * 100 end))::numeric, 2) as avg_item_score_pct,
  max(fi.completed_at) as latest_failure_at,
  case
    when count(*) filter (where fi.is_critical) > 0 then 'critical'
    when count(*) >= 5 then 'high'
    when count(*) >= 2 then 'medium'
    else 'low'
  end as category_risk_level
from public.v_advanced_report_failed_items fi
group by fi.organization_id, fi.location_id, fi.location_name, fi.risk_category;

-- 3) Section analytics
create or replace view public.v_advanced_report_section_analytics as
select
  ars.organization_id,
  ars.location_id,
  coalesce(l.location_name, ar.location_name_text, ar.brand_name, 'Imported report location') as location_name,
  ar.checklist_name,
  ars.section_name,
  count(distinct ars.audit_report_id)::integer as audit_report_count,
  round(avg(ars.score_percentage)::numeric, 2) as avg_section_score_pct,
  round(min(ars.score_percentage)::numeric, 2) as min_section_score_pct,
  count(fi.audit_item_id)::integer as failed_item_count,
  count(fi.audit_item_id) filter (where fi.is_critical)::integer as critical_failed_item_count,
  max(ars.completed_at) as latest_section_at,
  case
    when count(fi.audit_item_id) filter (where fi.is_critical) > 0 then 'critical'
    when avg(ars.score_percentage) < 70 then 'high'
    when avg(ars.score_percentage) < 85 then 'medium'
    else 'low'
  end as section_risk_level
from public.audit_report_sections ars
join public.audit_reports ar on ar.audit_report_id = ars.audit_report_id
left join public.locations l on l.location_id = ars.location_id
left join public.v_advanced_report_failed_items fi on fi.audit_section_id = ars.audit_section_id
group by ars.organization_id, ars.location_id, coalesce(l.location_name, ar.location_name_text, ar.brand_name, 'Imported report location'), ar.checklist_name, ars.section_name;

-- 4) Repeated issue analytics
create or replace view public.v_advanced_report_repeated_issues as
select
  fi.organization_id,
  fi.location_id,
  fi.location_name,
  lower(regexp_replace(fi.item_text, '[^a-zA-Z0-9]+', ' ', 'g')) as normalized_item_text,
  min(fi.item_text) as example_item_text,
  fi.risk_category,
  count(*)::integer as repeat_count,
  count(*) filter (where fi.is_critical)::integer as critical_repeat_count,
  count(distinct fi.audit_report_id)::integer as affected_audit_count,
  max(fi.completed_at) as latest_failure_at,
  array_agg(distinct fi.section_name) as affected_sections,
  case
    when count(*) filter (where fi.is_critical) > 0 then 'critical'
    when count(*) >= 3 then 'high'
    else 'medium'
  end as repeated_issue_level
from public.v_advanced_report_failed_items fi
group by fi.organization_id, fi.location_id, fi.location_name, lower(regexp_replace(fi.item_text, '[^a-zA-Z0-9]+', ' ', 'g')), fi.risk_category
having count(*) > 1;

-- 5) Action plan from failed report items
create or replace view public.v_advanced_report_action_plan as
select
  fi.organization_id,
  fi.location_id,
  fi.location_name,
  fi.audit_item_id as action_source_id,
  'ACT-' || upper(substr(fi.audit_item_id::text, 1, 8)) as action_reference,
  fi.severity,
  case when fi.severity = 'critical' then 1 when fi.severity = 'high' then 2 when fi.severity = 'medium' then 3 else 4 end as priority_rank,
  fi.risk_category,
  fi.section_name,
  fi.item_text as action_title,
  fi.comment_text as finding_comment,
  fi.recommended_action,
  fi.completed_by_name as assigned_from_audit_user,
  coalesce(fi.completed_at, fi.audit_completed_at, now()) + (fi.due_in_days || ' days')::interval as suggested_due_at,
  true as evidence_required,
  fi.audit_report_id,
  fi.checklist_name,
  fi.completed_at as finding_at
from public.v_advanced_report_failed_items fi;

-- 6) Location deep analytics and internal ML score
create or replace view public.v_advanced_report_location_analytics as
with audit_summary as (
  select
    ar.organization_id,
    ar.location_id,
    coalesce(l.location_name, ar.location_name_text, ar.brand_name, 'Imported report location') as location_name,
    count(*)::integer as audit_report_count,
    round(avg(ar.score_percentage)::numeric, 2) as avg_audit_score_pct,
    round(min(ar.score_percentage)::numeric, 2) as min_audit_score_pct,
    (array_agg(ar.score_percentage order by coalesce(ar.completed_at, ar.display_at, ar.created_at) desc))[1] as latest_audit_score_pct,
    max(coalesce(ar.completed_at, ar.display_at, ar.created_at)) as latest_audit_at
  from public.audit_reports ar
  left join public.locations l on l.location_id = ar.location_id
  group by ar.organization_id, ar.location_id, coalesce(l.location_name, ar.location_name_text, ar.brand_name, 'Imported report location')
),
completion_summary as (
  select
    cr.organization_id,
    cr.location_id,
    coalesce(l.location_name, cr.location_name_text, 'Imported report location') as location_name,
    count(*)::integer as completion_report_count,
    round(avg(cr.lists_completed_pct)::numeric, 2) as avg_lists_completed_pct,
    round(avg(cr.lists_missed_pct)::numeric, 2) as avg_lists_missed_pct,
    round(avg(cr.lists_partially_done_pct)::numeric, 2) as avg_lists_partially_done_pct,
    round(avg(cr.items_completed_pct)::numeric, 2) as avg_items_completed_pct,
    round(avg(cr.items_missed_pct)::numeric, 2) as avg_items_missed_pct,
    max(coalesce(cr.date_range_end::timestamptz, cr.created_at)) as latest_completion_at
  from public.completion_rate_reports cr
  left join public.locations l on l.location_id = cr.location_id
  group by cr.organization_id, cr.location_id, coalesce(l.location_name, cr.location_name_text, 'Imported report location')
),
failure_summary as (
  select
    fi.organization_id,
    fi.location_id,
    fi.location_name,
    count(*)::integer as failed_item_count,
    count(*) filter (where fi.is_critical)::integer as critical_failed_item_count,
    count(*) filter (where fi.risk_category = 'temperature_control')::integer as temperature_control_failures,
    count(*) filter (where fi.risk_category = 'labeling')::integer as labeling_failures,
    count(*) filter (where fi.risk_category = 'cross_contamination')::integer as cross_contamination_failures,
    count(*) filter (where fi.risk_category = 'cleanliness')::integer as cleanliness_failures,
    count(*) filter (where fi.risk_category = 'equipment_condition')::integer as equipment_condition_failures,
    count(*) filter (where fi.risk_category = 'personal_hygiene')::integer as personal_hygiene_failures,
    count(*) filter (where fi.risk_category = 'monitoring_records')::integer as monitoring_record_failures,
    max(fi.completed_at) as latest_failure_at
  from public.v_advanced_report_failed_items fi
  group by fi.organization_id, fi.location_id, fi.location_name
),
repeated_summary as (
  select organization_id, location_id, count(*)::integer as repeated_issue_count
  from public.v_advanced_report_repeated_issues
  group by organization_id, location_id
),
combined as (
  select
    coalesce(a.organization_id, c.organization_id, f.organization_id) as organization_id,
    coalesce(a.location_id, c.location_id, f.location_id) as location_id,
    coalesce(a.location_name, c.location_name, f.location_name, 'Imported report location') as location_name,
    coalesce(a.audit_report_count, 0) as audit_report_count,
    coalesce(c.completion_report_count, 0) as completion_report_count,
    a.avg_audit_score_pct,
    a.min_audit_score_pct,
    a.latest_audit_score_pct,
    c.avg_lists_completed_pct,
    c.avg_lists_missed_pct,
    c.avg_lists_partially_done_pct,
    c.avg_items_completed_pct,
    c.avg_items_missed_pct,
    coalesce(f.failed_item_count, 0) as failed_item_count,
    coalesce(f.critical_failed_item_count, 0) as critical_failed_item_count,
    coalesce(r.repeated_issue_count, 0) as repeated_issue_count,
    coalesce(f.temperature_control_failures, 0) as temperature_control_failures,
    coalesce(f.labeling_failures, 0) as labeling_failures,
    coalesce(f.cross_contamination_failures, 0) as cross_contamination_failures,
    coalesce(f.cleanliness_failures, 0) as cleanliness_failures,
    coalesce(f.equipment_condition_failures, 0) as equipment_condition_failures,
    coalesce(f.personal_hygiene_failures, 0) as personal_hygiene_failures,
    coalesce(f.monitoring_record_failures, 0) as monitoring_record_failures,
    greatest(coalesce(a.latest_audit_at, '1900-01-01'::timestamptz), coalesce(c.latest_completion_at, '1900-01-01'::timestamptz), coalesce(f.latest_failure_at, '1900-01-01'::timestamptz)) as latest_activity_at
  from audit_summary a
  full outer join completion_summary c on c.organization_id = a.organization_id and c.location_id = a.location_id
  full outer join failure_summary f on f.organization_id = coalesce(a.organization_id, c.organization_id) and f.location_id = coalesce(a.location_id, c.location_id)
  left join repeated_summary r on r.organization_id = coalesce(a.organization_id, c.organization_id, f.organization_id) and r.location_id = coalesce(a.location_id, c.location_id, f.location_id)
),
scored as (
  select
    c.*,
    least(100, greatest(0,
      coalesce(100 - c.avg_audit_score_pct, 0) * 0.85
      + c.failed_item_count * 1.7
      + c.critical_failed_item_count * 10
      + c.repeated_issue_count * 4.5
      + c.cross_contamination_failures * 8
      + c.temperature_control_failures * 6
      + c.monitoring_record_failures * 5
      + c.labeling_failures * 4
      + c.personal_hygiene_failures * 4
      + coalesce(c.avg_lists_missed_pct, 0) * 0.45
      + coalesce(c.avg_items_missed_pct, 0) * 0.35
      + coalesce(c.avg_lists_partially_done_pct, 0) * 0.12
    ))::numeric(6,2) as risk_score
  from combined c
)
select
  s.*,
  (100 - s.risk_score)::numeric(6,2) as health_score,
  case when s.risk_score >= 75 then 'critical' when s.risk_score >= 55 then 'high' when s.risk_score >= 30 then 'medium' else 'low' end as risk_level,
  least(0.98, greatest(0.55, 0.55 + ((s.audit_report_count + s.completion_report_count) * 0.08) + (least(s.failed_item_count, 10) * 0.015)))::numeric(4,2) as confidence,
  jsonb_build_object(
    'audit', jsonb_build_object('count', s.audit_report_count, 'avg_score', s.avg_audit_score_pct, 'latest_score', s.latest_audit_score_pct),
    'completion', jsonb_build_object('count', s.completion_report_count, 'lists_missed', s.avg_lists_missed_pct, 'items_missed', s.avg_items_missed_pct),
    'failures', jsonb_build_object('failed', s.failed_item_count, 'critical', s.critical_failed_item_count, 'repeated', s.repeated_issue_count),
    'categories', jsonb_build_object('cross_contamination', s.cross_contamination_failures, 'temperature_control', s.temperature_control_failures, 'labeling', s.labeling_failures, 'monitoring_records', s.monitoring_record_failures)
  ) as feature_json
from scored s;

-- 7) Trend analytics by date
create or replace view public.v_advanced_report_trend_daily as
select
  ar.organization_id,
  ar.location_id,
  coalesce(l.location_name, ar.location_name_text, ar.brand_name, 'Imported report location') as location_name,
  coalesce(ar.report_date, ar.completed_at::date, ar.created_at::date) as trend_date,
  count(*)::integer as audit_count,
  round(avg(ar.score_percentage)::numeric, 2) as avg_audit_score_pct,
  count(fi.audit_item_id)::integer as failed_item_count,
  count(fi.audit_item_id) filter (where fi.is_critical)::integer as critical_failed_item_count
from public.audit_reports ar
left join public.locations l on l.location_id = ar.location_id
left join public.v_advanced_report_failed_items fi on fi.audit_report_id = ar.audit_report_id
group by ar.organization_id, ar.location_id, coalesce(l.location_name, ar.location_name_text, ar.brand_name, 'Imported report location'), coalesce(ar.report_date, ar.completed_at::date, ar.created_at::date);

-- 8) Safe read-only ML function for the frontend. No inserts, no ambiguity.
create or replace function public.run_advanced_report_ml(
  p_organization_id uuid default null,
  p_period_start date default null,
  p_period_end date default null
)
returns table (
  organization_id uuid,
  location_id uuid,
  location_name text,
  risk_score numeric,
  health_score numeric,
  risk_level text,
  confidence numeric,
  failed_item_count integer,
  critical_failed_item_count integer,
  repeated_issue_count integer,
  avg_audit_score_pct numeric,
  avg_lists_missed_pct numeric,
  avg_items_missed_pct numeric,
  feature_json jsonb
)
language sql
stable
as $$
  select
    la.organization_id,
    la.location_id,
    la.location_name,
    la.risk_score,
    la.health_score,
    la.risk_level,
    la.confidence,
    la.failed_item_count,
    la.critical_failed_item_count,
    la.repeated_issue_count,
    la.avg_audit_score_pct,
    la.avg_lists_missed_pct,
    la.avg_items_missed_pct,
    la.feature_json
  from public.v_advanced_report_location_analytics la
  where (p_organization_id is null or la.organization_id = p_organization_id)
    and (p_period_start is null or la.latest_activity_at::date >= p_period_start)
    and (p_period_end is null or la.latest_activity_at::date <= p_period_end)
  order by la.risk_score desc nulls last;
$$;

-- Verification queries after running:
-- select * from public.v_advanced_report_location_analytics order by risk_score desc;
-- select * from public.v_advanced_report_failed_items order by severity, completed_at desc;
-- select * from public.v_advanced_report_action_plan order by priority_rank, suggested_due_at;
-- select * from public.run_advanced_report_ml('10000000-0000-0000-0000-000000000001', '2026-02-01', '2026-02-28');
