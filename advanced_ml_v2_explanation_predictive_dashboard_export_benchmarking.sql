-- InCheck360 Advanced ML v2
-- Adds: ML explanation, predictive risk, client/company dashboard,
-- management report export, and benchmarking.
-- Run AFTER:
--   1) final_fix_refresh_ml_location_report_features_ambiguity.sql
--   2) advanced_report_ml_analytics_upgrade.sql
--   3) imported_report_sample_seed_org_100.sql or your real imports

create or replace view public.v_report_location_names as
select
  x.organization_id,
  x.location_id,
  max(x.location_name) filter (where x.location_name is not null and x.location_name <> '') as location_name
from (
  select organization_id, location_id, location_name_text as location_name
  from public.audit_reports
  where location_id is not null
  union all
  select organization_id, location_id, location_name_text as location_name
  from public.completion_rate_reports
  where location_id is not null
) x
group by x.organization_id, x.location_id;

create or replace view public.v_ml_explanation_driver_breakdown as
with base as (
  select
    f.organization_id,
    f.location_id,
    coalesce(ln.location_name, f.location_id::text) as location_name,
    f.period_start,
    f.period_end,
    f.calculated_risk_score as risk_score,
    greatest(0, coalesce(100 - f.avg_audit_score_percentage, 0) * 0.90)::numeric(8,2) as audit_gap_points,
    greatest(0, coalesce(f.failed_item_count, 0) * 1.80)::numeric(8,2) as failed_item_points,
    greatest(0, coalesce(f.critical_failed_item_count, 0) * 10.00)::numeric(8,2) as critical_failure_points,
    greatest(0, coalesce(f.repeated_failure_count, 0) * 5.00)::numeric(8,2) as repeated_issue_points,
    greatest(0, coalesce(f.cross_contamination_failures, 0) * 8.00)::numeric(8,2) as cross_contamination_points,
    greatest(0, coalesce(f.temperature_control_failures, 0) * 6.00)::numeric(8,2) as temperature_control_points,
    greatest(0, coalesce(f.monitoring_record_failures, 0) * 5.00)::numeric(8,2) as monitoring_points,
    greatest(0, coalesce(f.labeling_failures, 0) * 4.00)::numeric(8,2) as labeling_points,
    greatest(0, coalesce(f.personal_hygiene_failures, 0) * 4.00)::numeric(8,2) as hygiene_points,
    greatest(0, coalesce(f.avg_lists_missed_pct, 0) * 0.45)::numeric(8,2) as missed_lists_points,
    greatest(0, coalesce(f.avg_items_missed_pct, 0) * 0.35)::numeric(8,2) as missed_items_points,
    f.avg_audit_score_percentage,
    f.failed_item_count,
    f.critical_failed_item_count,
    f.repeated_failure_count,
    f.cross_contamination_failures,
    f.temperature_control_failures,
    f.monitoring_record_failures,
    f.labeling_failures,
    f.personal_hygiene_failures,
    f.avg_lists_missed_pct,
    f.avg_items_missed_pct
  from public.ml_location_report_features f
  left join public.v_report_location_names ln
    on ln.organization_id = f.organization_id
   and ln.location_id = f.location_id
), drivers as (
  select
    b.organization_id,
    b.location_id,
    b.location_name,
    b.period_start,
    b.period_end,
    b.risk_score,
    d.driver_key,
    d.driver_label,
    d.driver_group,
    d.actual_value,
    d.impact_points,
    d.explanation,
    row_number() over (
      partition by b.organization_id, b.location_id, b.period_start, b.period_end
      order by d.impact_points desc, d.driver_label
    ) as driver_rank
  from base b
  cross join lateral (
    values
      ('audit_gap', 'Audit score gap', 'Audit Performance', b.avg_audit_score_percentage, b.audit_gap_points, 'Risk added because the audit score is below 100%.'),
      ('failed_items', 'Failed audit items', 'Audit Failures', b.failed_item_count::numeric, b.failed_item_points, 'Each failed item increases operational risk.'),
      ('critical_failures', 'Critical failed items', 'Critical Control', b.critical_failed_item_count::numeric, b.critical_failure_points, 'Critical food-safety failures carry the highest weight.'),
      ('repeated_issues', 'Repeated issues', 'Repeat Pattern', b.repeated_failure_count::numeric, b.repeated_issue_points, 'Repeated issues indicate weak follow-through or training gaps.'),
      ('cross_contamination', 'Cross-contamination', 'Food Safety', b.cross_contamination_failures::numeric, b.cross_contamination_points, 'Cross-contamination failures are high severity.'),
      ('temperature_control', 'Temperature control', 'Food Safety', b.temperature_control_failures::numeric, b.temperature_control_points, 'Temperature-control failures can create food safety exposure.'),
      ('monitoring_records', 'Monitoring records', 'Process Discipline', b.monitoring_record_failures::numeric, b.monitoring_points, 'Missing monitoring records reduce confidence in execution.'),
      ('labeling', 'Labeling', 'Process Discipline', b.labeling_failures::numeric, b.labeling_points, 'Labeling failures indicate poor storage/rotation discipline.'),
      ('personal_hygiene', 'Personal hygiene', 'Food Safety', b.personal_hygiene_failures::numeric, b.hygiene_points, 'Personal hygiene failures require immediate correction.'),
      ('missed_lists', 'Missed checklist lists', 'Execution Discipline', b.avg_lists_missed_pct, b.missed_lists_points, 'Missed checklist lists indicate poor routine completion.'),
      ('missed_items', 'Missed checklist items', 'Execution Discipline', b.avg_items_missed_pct, b.missed_items_points, 'Missed checklist items show incomplete execution.')
  ) d(driver_key, driver_label, driver_group, actual_value, impact_points, explanation)
)
select *
from drivers
where impact_points > 0;

create or replace view public.v_predictive_location_risk as
with ordered as (
  select
    f.*,
    coalesce(ln.location_name, f.location_id::text) as location_name,
    lag(f.calculated_risk_score) over (
      partition by f.organization_id, f.location_id
      order by f.period_end
    ) as previous_risk_score,
    lag(f.latest_audit_score_percentage) over (
      partition by f.organization_id, f.location_id
      order by f.period_end
    ) as previous_audit_score
  from public.ml_location_report_features f
  left join public.v_report_location_names ln
    on ln.organization_id = f.organization_id
   and ln.location_id = f.location_id
), scored as (
  select
    o.organization_id,
    o.location_id,
    o.location_name,
    o.period_start,
    o.period_end,
    o.calculated_risk_score as current_risk_score,
    o.previous_risk_score,
    (o.calculated_risk_score - coalesce(o.previous_risk_score, o.calculated_risk_score))::numeric(8,2) as risk_delta,
    o.latest_audit_score_percentage as current_audit_score,
    o.previous_audit_score,
    o.failed_item_count,
    o.critical_failed_item_count,
    o.repeated_failure_count,
    o.avg_lists_missed_pct,
    o.avg_items_missed_pct,
    least(
      100,
      greatest(
        0,
        coalesce(o.calculated_risk_score, 0)
        + ((coalesce(o.calculated_risk_score, 0) - coalesce(o.previous_risk_score, coalesce(o.calculated_risk_score, 0))) * 0.65)
        + (coalesce(o.critical_failed_item_count, 0) * 2.50)
        + (coalesce(o.repeated_failure_count, 0) * 1.50)
        + (coalesce(o.avg_lists_missed_pct, 0) * 0.05)
      )
    )::numeric(8,2) as predicted_next_risk_score
  from ordered o
)
select
  s.*,
  greatest(0, least(100, 100 - (s.predicted_next_risk_score * 0.55)))::numeric(8,2) as predicted_next_audit_score,
  case
    when s.predicted_next_risk_score >= 75 then 'critical'
    when s.predicted_next_risk_score >= 55 then 'high'
    when s.predicted_next_risk_score >= 30 then 'medium'
    else 'low'
  end as predicted_risk_level,
  case
    when s.risk_delta > 5 then 'deteriorating'
    when s.risk_delta < -5 then 'improving'
    else 'stable'
  end as trend_direction,
  case
    when s.predicted_next_risk_score >= 75 then 'Visit within 24 hours'
    when s.predicted_next_risk_score >= 55 then 'Visit within 48 hours'
    when s.predicted_next_risk_score >= 30 then 'Review within 7 days'
    else 'Normal monitoring'
  end as recommended_visit_window,
  case
    when s.critical_failed_item_count > 0 then 'Critical failures are the main predictor.'
    when s.repeated_failure_count > 0 then 'Repeated failures are the main predictor.'
    when coalesce(s.avg_lists_missed_pct, 0) >= 50 then 'Checklist execution discipline is the main predictor.'
    when s.risk_delta > 5 then 'Risk trend is deteriorating.'
    else 'Risk is driven by general audit and completion patterns.'
  end as prediction_reason
from scored s;

create or replace view public.v_client_company_dashboard as
with latest_features as (
  select distinct on (organization_id, location_id)
    *
  from public.ml_location_report_features
  order by organization_id, location_id, period_end desc
), category_top as (
  select distinct on (organization_id)
    organization_id,
    risk_category as top_risk_category,
    failed_item_count as top_category_failures
  from public.v_advanced_report_category_analytics
  order by organization_id, failed_item_count desc nulls last
), action_summary as (
  select
    organization_id,
    count(*)::integer as open_action_count,
    count(*) filter (where severity in ('critical', 'high'))::integer as high_priority_action_count
  from public.v_advanced_report_action_plan
  group by organization_id
)
select
  f.organization_id,
  f.organization_id::text as company_name,
  count(distinct f.location_id)::integer as location_count,
  sum(coalesce(f.audit_report_count, 0))::integer as audit_report_count,
  sum(coalesce(f.completion_report_count, 0))::integer as completion_report_count,
  round(avg(f.calculated_risk_score)::numeric, 2) as avg_risk_score,
  round(avg(100 - f.calculated_risk_score)::numeric, 2) as avg_health_score,
  count(*) filter (where f.calculated_risk_score >= 75)::integer as critical_location_count,
  count(*) filter (where f.calculated_risk_score >= 55)::integer as high_risk_location_count,
  sum(coalesce(f.failed_item_count, 0))::integer as total_failed_items,
  sum(coalesce(f.critical_failed_item_count, 0))::integer as total_critical_failures,
  sum(coalesce(f.repeated_failure_count, 0))::integer as total_repeated_issues,
  round(avg(f.avg_lists_missed_pct)::numeric, 2) as avg_lists_missed_pct,
  round(avg(f.avg_items_missed_pct)::numeric, 2) as avg_items_missed_pct,
  ct.top_risk_category,
  coalesce(ct.top_category_failures, 0)::integer as top_category_failures,
  coalesce(a.open_action_count, 0)::integer as open_action_count,
  coalesce(a.high_priority_action_count, 0)::integer as high_priority_action_count,
  max(f.calculated_at) as latest_calculated_at
from latest_features f
left join category_top ct on ct.organization_id = f.organization_id
left join action_summary a on a.organization_id = f.organization_id
group by f.organization_id, ct.top_risk_category, ct.top_category_failures, a.open_action_count, a.high_priority_action_count;

create or replace view public.v_location_benchmarking as
with base as (
  select
    a.organization_id,
    a.location_id,
    a.location_name,
    a.risk_score,
    a.health_score,
    a.avg_audit_score_pct,
    a.failed_item_count,
    a.critical_failed_item_count,
    a.avg_lists_missed_pct,
    a.avg_items_missed_pct
  from public.v_advanced_report_location_analytics a
)
select
  b.*,
  dense_rank() over (partition by b.organization_id order by b.risk_score desc nulls last) as risk_rank_high_to_low,
  dense_rank() over (partition by b.organization_id order by b.health_score desc nulls last) as health_rank_best_to_worst,
  round((percent_rank() over (partition by b.organization_id order by b.risk_score))::numeric * 100, 2) as risk_percentile,
  round(avg(b.risk_score) over (partition by b.organization_id)::numeric, 2) as company_avg_risk_score,
  round((b.risk_score - avg(b.risk_score) over (partition by b.organization_id))::numeric, 2) as risk_vs_company_avg
from base b;

create or replace view public.v_category_benchmarking as
select
  c.organization_id,
  c.risk_category,
  sum(c.failed_item_count)::integer as total_failed_items,
  sum(c.critical_failed_item_count)::integer as total_critical_failed_items,
  count(distinct c.location_id)::integer as affected_location_count,
  round(avg(c.avg_item_score_pct)::numeric, 2) as avg_item_score_pct,
  dense_rank() over (partition by c.organization_id order by sum(c.failed_item_count) desc nulls last) as category_failure_rank
from public.v_advanced_report_category_analytics c
group by c.organization_id, c.risk_category;

create or replace view public.v_section_benchmarking as
select
  s.organization_id,
  s.section_name,
  count(distinct s.location_id)::integer as affected_location_count,
  count(*)::integer as section_row_count,
  round(avg(s.avg_section_score_pct)::numeric, 2) as avg_section_score_pct,
  round(min(s.min_section_score_pct)::numeric, 2) as min_section_score_pct,
  sum(s.failed_item_count)::integer as failed_item_count,
  sum(s.critical_failed_item_count)::integer as critical_failed_item_count,
  dense_rank() over (partition by s.organization_id order by avg(s.avg_section_score_pct) asc nulls last) as weakest_section_rank
from public.v_advanced_report_section_analytics s
group by s.organization_id, s.section_name;

create or replace function public.get_management_report_export(
  p_organization_id uuid,
  p_period_start date default null,
  p_period_end date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company jsonb;
  v_locations jsonb;
  v_categories jsonb;
  v_actions jsonb;
  v_failed_items jsonb;
  v_repeated jsonb;
  v_predictions jsonb;
  v_explanations jsonb;
begin
  select to_jsonb(c) into v_company
  from public.v_client_company_dashboard c
  where c.organization_id = p_organization_id;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.risk_rank_high_to_low), '[]'::jsonb) into v_locations
  from (
    select *
    from public.v_location_benchmarking
    where organization_id = p_organization_id
    limit 100
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.category_failure_rank), '[]'::jsonb) into v_categories
  from (
    select *
    from public.v_category_benchmarking
    where organization_id = p_organization_id
    limit 50
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.priority_rank, x.suggested_due_at), '[]'::jsonb) into v_actions
  from (
    select *
    from public.v_advanced_report_action_plan
    where organization_id = p_organization_id
    order by priority_rank, suggested_due_at
    limit 100
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.is_critical desc, x.completed_at desc), '[]'::jsonb) into v_failed_items
  from (
    select *
    from public.v_advanced_report_failed_items
    where organization_id = p_organization_id
    order by is_critical desc, completed_at desc
    limit 150
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.repeat_count desc), '[]'::jsonb) into v_repeated
  from (
    select *
    from public.v_advanced_report_repeated_issues
    where organization_id = p_organization_id
    order by repeat_count desc
    limit 75
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.predicted_next_risk_score desc), '[]'::jsonb) into v_predictions
  from (
    select *
    from public.v_predictive_location_risk
    where organization_id = p_organization_id
    order by predicted_next_risk_score desc
    limit 100
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.location_name, x.driver_rank), '[]'::jsonb) into v_explanations
  from (
    select *
    from public.v_ml_explanation_driver_breakdown
    where organization_id = p_organization_id
      and driver_rank <= 5
    order by location_name, driver_rank
    limit 300
  ) x;

  return jsonb_build_object(
    'report_meta', jsonb_build_object(
      'organization_id', p_organization_id,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'generated_at', now(),
      'engine', 'InCheck360 Advanced Internal ML v2'
    ),
    'executive_summary', coalesce(v_company, '{}'::jsonb),
    'location_benchmarking', v_locations,
    'category_benchmarking', v_categories,
    'predictive_risk', v_predictions,
    'ml_explanations', v_explanations,
    'action_plan', v_actions,
    'failed_items', v_failed_items,
    'repeated_issues', v_repeated
  );
end;
$$;

create or replace function public.run_advanced_report_ml_v2(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  organization_id uuid,
  location_id uuid,
  risk_score numeric,
  predicted_next_risk_score numeric,
  predicted_risk_level text,
  top_driver text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.run_advanced_report_ml(p_organization_id, p_period_start, p_period_end);

  return query
  select
    p.organization_id,
    p.location_id,
    p.current_risk_score as risk_score,
    p.predicted_next_risk_score,
    p.predicted_risk_level,
    d.driver_label as top_driver
  from public.v_predictive_location_risk p
  left join lateral (
    select driver_label
    from public.v_ml_explanation_driver_breakdown d
    where d.organization_id = p.organization_id
      and d.location_id = p.location_id
      and d.period_start = p.period_start
      and d.period_end = p.period_end
    order by d.driver_rank
    limit 1
  ) d on true
  where p.organization_id = p_organization_id
    and p.period_start = p_period_start
    and p.period_end = p_period_end
  order by p.predicted_next_risk_score desc;
end;
$$;

grant select on public.v_report_location_names to anon, authenticated;
grant select on public.v_ml_explanation_driver_breakdown to anon, authenticated;
grant select on public.v_predictive_location_risk to anon, authenticated;
grant select on public.v_client_company_dashboard to anon, authenticated;
grant select on public.v_location_benchmarking to anon, authenticated;
grant select on public.v_category_benchmarking to anon, authenticated;
grant select on public.v_section_benchmarking to anon, authenticated;
grant execute on function public.get_management_report_export(uuid, date, date) to anon, authenticated;
grant execute on function public.run_advanced_report_ml_v2(uuid, date, date) to anon, authenticated;

-- Quick verification
select 'v2 advanced analytics installed' as status;
