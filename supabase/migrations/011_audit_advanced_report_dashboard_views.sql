-- Audit Advanced Report Dashboard Views
-- Dashboard/report only. Checklist configuration, licensing, formulas, rules, and section setup remain in InCheck.
-- These views consume completed audit report data and expose final score/result, urgent findings,
-- pass/fail rate, top failed items, section failure rate, and completed-vs-planned widgets.

begin;

drop view if exists public.v_audit_dashboard_summary cascade;
drop view if exists public.v_audit_dashboard_score_by_location cascade;
drop view if exists public.v_audit_dashboard_pass_fail_rate cascade;
drop view if exists public.v_audit_dashboard_top_failed_items cascade;
drop view if exists public.v_audit_dashboard_failure_rate_by_section cascade;
drop view if exists public.v_audit_dashboard_completed_vs_planned cascade;
drop view if exists public.v_audit_pdf_urgent_findings cascade;
drop view if exists public.v_audit_pdf_report_data cascade;
drop view if exists public.v_audit_final_results cascade;

-- Final audit result used by dashboard, reporting, PDF, and mobile summary.
-- If InCheck later stores final_score/final_result from formulas/rules, replace these derived fields with stored values.
create or replace view public.v_audit_final_results as
with failed_items as (
  select
    ai.audit_report_id,
    count(*) filter (
      where coalesce(ai.is_pass, true) = false
         or (ai.score_total is not null and ai.score_total > 0 and coalesce(ai.score_earned, 0) < ai.score_total)
    )::integer as failed_item_count,
    count(*) filter (
      where coalesce(ai.is_critical, false) = true
        and (
          coalesce(ai.is_pass, true) = false
          or (ai.score_total is not null and ai.score_total > 0 and coalesce(ai.score_earned, 0) < ai.score_total)
        )
    )::integer as critical_failed_item_count
  from public.audit_report_items ai
  group by ai.audit_report_id
)
select
  ar.organization_id,
  ar.location_id,
  coalesce(l.location_name, ar.location_name_text, ar.brand_name, 'Imported report location') as location_name,
  ar.client_name,
  ar.group_modes,
  ar.audit_report_id,
  ar.checklist_name,
  ar.report_date,
  ar.completed_at,
  ar.submitted_by_name as auditor_name,
  ar.source_file_name,
  coalesce(ar.score_percentage, 0)::numeric(8,2) as final_score,
  coalesce(fi.failed_item_count, 0)::integer as failed_item_count,
  coalesce(fi.critical_failed_item_count, 0)::integer as critical_failed_item_count,
  case
    when coalesce(fi.critical_failed_item_count, 0) > 0 then 'Fail'
    when coalesce(ar.score_percentage, 0) < 80 then 'Fail'
    else 'Pass'
  end as final_result,
  case
    when coalesce(fi.critical_failed_item_count, 0) > 0 then 'Audit failed because at least one critical audit item failed.'
    when coalesce(ar.score_percentage, 0) < 80 then 'Audit failed because final audit score is below the pass threshold.'
    else 'Audit passed.'
  end as final_result_reason,
  case when coalesce(fi.critical_failed_item_count, 0) > 0 then true else false end as failed_due_to_critical_item
from public.audit_reports ar
left join failed_items fi on fi.audit_report_id = ar.audit_report_id
left join public.locations l on l.location_id = ar.location_id;

create or replace view public.v_audit_dashboard_summary as
select
  organization_id,
  count(*)::integer as audit_count,
  count(distinct location_id)::integer as location_count,
  count(distinct checklist_name)::integer as checklist_count,
  round(avg(final_score)::numeric, 2) as average_audit_score,
  count(*) filter (where final_result = 'Pass')::integer as pass_count,
  count(*) filter (where final_result = 'Fail')::integer as fail_count,
  round((count(*) filter (where final_result = 'Pass')::numeric / nullif(count(*), 0)) * 100, 2) as pass_rate_pct,
  round((count(*) filter (where final_result = 'Fail')::numeric / nullif(count(*), 0)) * 100, 2) as fail_rate_pct,
  sum(failed_item_count)::integer as failed_item_count,
  sum(critical_failed_item_count)::integer as critical_failed_item_count,
  max(completed_at) as latest_audit_at
from public.v_audit_final_results
group by organization_id;

create or replace view public.v_audit_dashboard_score_by_location as
select
  organization_id,
  location_id,
  location_name,
  count(*)::integer as audit_count,
  round(avg(final_score)::numeric, 2) as average_audit_score,
  round(min(final_score)::numeric, 2) as lowest_audit_score,
  count(*) filter (where final_result = 'Pass')::integer as pass_count,
  count(*) filter (where final_result = 'Fail')::integer as fail_count,
  round((count(*) filter (where final_result = 'Fail')::numeric / nullif(count(*), 0)) * 100, 2) as fail_rate_pct,
  sum(failed_item_count)::integer as failed_item_count,
  sum(critical_failed_item_count)::integer as critical_failed_item_count,
  max(completed_at) as latest_audit_at
from public.v_audit_final_results
group by organization_id, location_id, location_name;

create or replace view public.v_audit_dashboard_pass_fail_rate as
select
  organization_id,
  date_trunc('day', coalesce(completed_at, report_date::timestamptz))::date as audit_date,
  checklist_name,
  count(*)::integer as audit_count,
  count(*) filter (where final_result = 'Pass')::integer as pass_count,
  count(*) filter (where final_result = 'Fail')::integer as fail_count,
  round((count(*) filter (where final_result = 'Pass')::numeric / nullif(count(*), 0)) * 100, 2) as pass_rate_pct,
  round((count(*) filter (where final_result = 'Fail')::numeric / nullif(count(*), 0)) * 100, 2) as fail_rate_pct
from public.v_audit_final_results
group by organization_id, date_trunc('day', coalesce(completed_at, report_date::timestamptz))::date, checklist_name;

create or replace view public.v_audit_dashboard_top_failed_items as
select
  fi.organization_id,
  fi.location_id,
  fi.location_name,
  fi.checklist_name,
  fi.section_name,
  fi.item_text,
  fi.risk_category,
  fi.severity,
  count(*)::integer as failure_count,
  count(distinct fi.audit_report_id)::integer as affected_audit_count,
  max(fi.completed_at) as latest_failure_at,
  min(fi.recommended_action) as recommended_action
from public.v_advanced_report_failed_items fi
group by fi.organization_id, fi.location_id, fi.location_name, fi.checklist_name, fi.section_name, fi.item_text, fi.risk_category, fi.severity;

create or replace view public.v_audit_dashboard_failure_rate_by_section as
select
  s.organization_id,
  s.location_id,
  s.location_name,
  s.checklist_name,
  s.section_name,
  count(*)::integer as section_count,
  round(avg(s.avg_section_score_pct)::numeric, 2) as average_section_score,
  sum(s.failed_item_count)::integer as failed_item_count,
  sum(s.critical_failed_item_count)::integer as critical_failed_item_count,
  case
    when sum(s.critical_failed_item_count) > 0 then 'critical'
    when round(avg(s.avg_section_score_pct)::numeric, 2) < 70 then 'high'
    when round(avg(s.avg_section_score_pct)::numeric, 2) < 85 then 'medium'
    else 'low'
  end as section_risk_level
from public.v_advanced_report_section_analytics s
group by s.organization_id, s.location_id, s.location_name, s.checklist_name, s.section_name;

create or replace view public.v_audit_dashboard_completed_vs_planned as
select
  cc.organization_id,
  cc.location_id,
  cc.checklist_name,
  sum(coalesce(cc.done_on_time_count, 0) + coalesce(cc.done_late_count, 0) + coalesce(cc.partially_done_count, 0))::integer as completed_count,
  sum(coalesce(cc.done_on_time_count, 0) + coalesce(cc.done_late_count, 0) + coalesce(cc.partially_done_count, 0) + coalesce(cc.missed_count, 0))::integer as planned_count,
  sum(coalesce(cc.missed_count, 0))::integer as missed_count,
  round((sum(coalesce(cc.done_on_time_count, 0) + coalesce(cc.done_late_count, 0) + coalesce(cc.partially_done_count, 0))::numeric / nullif(sum(coalesce(cc.done_on_time_count, 0) + coalesce(cc.done_late_count, 0) + coalesce(cc.partially_done_count, 0) + coalesce(cc.missed_count, 0)), 0)) * 100, 2) as completion_rate_pct
from public.completion_rate_checklists cc
group by cc.organization_id, cc.location_id, cc.checklist_name;

create or replace view public.v_audit_pdf_urgent_findings as
select
  fi.organization_id,
  fi.location_id,
  fi.location_name,
  fi.audit_report_id,
  fi.checklist_name,
  fi.section_name,
  fi.item_text,
  fi.result_value,
  fi.comment_text,
  fi.severity,
  fi.risk_category,
  fi.recommended_action,
  fi.completed_at
from public.v_advanced_report_failed_items fi
where fi.severity in ('critical', 'high') or fi.is_critical is true;

create or replace view public.v_audit_pdf_report_data as
select
  fr.*,
  coalesce(uf.urgent_findings_count, 0)::integer as urgent_findings_count,
  coalesce(uf.urgent_findings, '[]'::jsonb) as urgent_findings
from public.v_audit_final_results fr
left join lateral (
  select
    count(*)::integer as urgent_findings_count,
    jsonb_agg(to_jsonb(u) order by u.severity, u.completed_at desc) as urgent_findings
  from public.v_audit_pdf_urgent_findings u
  where u.audit_report_id = fr.audit_report_id
) uf on true;

grant select on public.v_audit_final_results to anon, authenticated;
grant select on public.v_audit_dashboard_summary to anon, authenticated;
grant select on public.v_audit_dashboard_score_by_location to anon, authenticated;
grant select on public.v_audit_dashboard_pass_fail_rate to anon, authenticated;
grant select on public.v_audit_dashboard_top_failed_items to anon, authenticated;
grant select on public.v_audit_dashboard_failure_rate_by_section to anon, authenticated;
grant select on public.v_audit_dashboard_completed_vs_planned to anon, authenticated;
grant select on public.v_audit_pdf_urgent_findings to anon, authenticated;
grant select on public.v_audit_pdf_report_data to anon, authenticated;

notify pgrst, 'reload schema';
commit;
