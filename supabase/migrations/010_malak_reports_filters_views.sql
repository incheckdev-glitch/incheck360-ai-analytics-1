-- InCheck360 AI Analytics: Malak Al Tawouk sample raw data + dashboard compatibility views
-- Adds the 3 uploaded PDF reports as raw imported data and creates missing views used by frontend filters/dashboard.

begin;

create extension if not exists pgcrypto;

-- Keep views stable: PostgreSQL cannot remove columns with CREATE OR REPLACE VIEW.
drop view if exists public.v_client_company_dashboard cascade;
drop view if exists public.v_location_benchmarking cascade;
drop view if exists public.v_category_benchmarking cascade;
drop view if exists public.v_section_benchmarking cascade;
drop view if exists public.v_predictive_location_risk cascade;
drop view if exists public.v_ml_explanation_driver_breakdown cascade;
drop view if exists public.v_advanced_report_location_analytics cascade;
drop view if exists public.v_advanced_report_action_plan cascade;
drop view if exists public.v_advanced_report_repeated_issues cascade;
drop view if exists public.v_advanced_report_section_analytics cascade;
drop view if exists public.v_advanced_report_category_analytics cascade;
drop view if exists public.v_advanced_report_failed_items cascade;

-- Seed organization and location
insert into public.organizations (organization_id, organization_name, legal_name, industry)
values ('10000000-0000-0000-0000-000000000001', 'POC Account 7', 'POC Account 7', 'F&B / Quick Service Restaurant')
on conflict (organization_id) do update set organization_name = excluded.organization_name, legal_name = excluded.legal_name;

insert into public.locations (location_id, organization_id, location_code, location_name, brand_name, region, city, status)
values ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'ZOUK-MALAK-AL-TAWOUK', 'Zouk - Malak Al Tawouk', 'Malak Al Tawouk', 'Lebanon', 'Zouk', 'active')
on conflict (organization_id, location_code) do update set location_name = excluded.location_name, brand_name = excluded.brand_name, status = 'active';

-- Remove old copies of the 3 uploaded sample reports, then insert fresh raw data.
delete from public.completion_rate_reports where organization_id = '10000000-0000-0000-0000-000000000001' and source_file_name in ('report.pdf', 'report_completion_malak_zouk_2026_06_01_2026_06_22.pdf');
delete from public.audit_reports where organization_id = '10000000-0000-0000-0000-000000000001' and source_file_name in ('report (2)(1).pdf', 'report (1)(1).pdf', 'report_chillers_freezers_malak_zouk_1.pdf', 'report_chillers_freezers_malak_zouk_2.pdf');

-- Completion Rate report: report.pdf
with cr as (
  insert into public.completion_rate_reports (
    organization_id, location_id, client_name, group_modes, location_name_text, employees_filter, checklists_filter, items_filter,
    date_range_start, date_range_end, duration_label, checklist_status,
    lists_completed_pct, lists_done_on_time_count, lists_done_on_time_pct, lists_done_late_count, lists_done_late_pct,
    lists_partially_done_count, lists_partially_done_pct, lists_missed_count, lists_missed_pct,
    items_completed_pct, items_done_on_time_count, items_done_on_time_pct, items_done_late_count, items_done_late_pct,
    items_missed_count, items_missed_pct, source_file_name, raw_report
  ) values (
    '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000007','POC Account 7','Malak Al Tawouk','Zouk - Malak Al Tawouk','all','all','all',
    '2026-06-01','2026-06-22','This Month','Closed',
    20.50,51,15.84,15,4.66,27,8.39,229,71.12,
    27.35,2356,24.38,287,2.97,7021,72.65,'report.pdf',
    jsonb_build_object('source','uploaded_pdf','client','POC Account 7','group_modes','Malak Al Tawouk','location','Zouk - Malak Al Tawouk')
  ) returning completion_report_id
)
insert into public.completion_rate_checklists (completion_report_id, organization_id, location_id, checklist_name, done_on_time_count, done_on_time_pct, done_late_count, done_late_pct, partially_done_count, partially_done_pct, missed_count, missed_pct, raw_checklist)
select cr.completion_report_id, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000007', x.checklist_name, x.done_on_time_count, x.done_on_time_pct, x.done_late_count, x.done_late_pct, x.partially_done_count, x.partially_done_pct, x.missed_count, x.missed_pct, to_jsonb(x)
from cr
cross join (values
  ('FRYING OIL MONITORING LOG',16,19.05,3,3.57,9,10.71,56,66.67),
  ('CHILLERS & FREEZERS TEMPERATURE MONITORING LOG',24,12.50,8,4.17,3,1.56,157,81.77),
  ('WEEKLY AREA MANAGER CHECK LIST',2,50.00,0,0.00,2,50.00,0,0.00),
  ('MINI OPERATION REVIEW AUDIT',0,0.00,0,0.00,6,54.55,5,45.45),
  ('BRANCH MANAGER OPENING CHECK LIST',2,13.33,4,26.67,4,26.67,5,33.33),
  ('BRANCH MANAGER CLOSING CHECK LIST',7,43.75,0,0.00,3,18.75,6,37.50)
) as x(checklist_name, done_on_time_count, done_on_time_pct, done_late_count, done_late_pct, partially_done_count, partially_done_pct, missed_count, missed_pct);

-- Daily completion rates from report.pdf
insert into public.completion_rate_daily (completion_report_id, organization_id, location_id, report_date, completion_pct, raw_day)
select cr.completion_report_id, cr.organization_id, cr.location_id, d.report_date, d.completion_pct, to_jsonb(d)
from public.completion_rate_reports cr
cross join (values
 ('2026-06-01'::date,0.00),('2026-06-02'::date,0.00),('2026-06-03'::date,0.00),('2026-06-04'::date,0.00),('2026-06-05'::date,0.00),('2026-06-06'::date,0.00),('2026-06-07'::date,0.00),('2026-06-08'::date,0.00),('2026-06-09'::date,0.00),('2026-06-10'::date,0.00),('2026-06-11'::date,35.29),('2026-06-12'::date,57.14),('2026-06-13'::date,42.86),('2026-06-14'::date,78.57),('2026-06-15'::date,20.00),('2026-06-16'::date,14.29),('2026-06-17'::date,13.33),('2026-06-18'::date,14.29),('2026-06-19'::date,38.89),('2026-06-20'::date,66.67),('2026-06-21'::date,50.00),('2026-06-22'::date,66.67)
) as d(report_date, completion_pct)
where cr.organization_id = '10000000-0000-0000-0000-000000000001' and cr.source_file_name = 'report.pdf';

-- Helper CTE to create one Chillers & Freezers audit. We insert the same uploaded audit twice because the user uploaded two PDF copies.
with new_reports as (
  insert into public.audit_reports (
    organization_id, location_id, client_name, group_modes, locations_filter, employees_filter, checklists_filter, items_filter,
    checklist_name, brand_name, location_name_text, report_date, date_range_start, date_range_end, duration_label, checklist_status,
    display_at, due_at, expiry_at, completed_at, submitted_by_name, score_percentage, instance_status, done_on_time, source_file_name, raw_header
  )
  select '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000007','POC Account 7','Malak Al Tawouk','Zouk - Malak Al Tawouk','all','all','all',
    'CHILLERS & FREEZERS TEMPERATURE MONITORING LOG','Malak Al Tawouk','Zouk - Malak Al Tawouk','2026-06-22','2026-06-01','2026-06-22','This Month','Closed',
    '2026-06-22 08:00:00+00','2026-06-22 08:15:00+00','2026-06-22 08:30:00+00','2026-06-22 08:14:30+00','Elie Fahed',0.00,'Done On Time',true, source_file,
    jsonb_build_object('source','uploaded_pdf','group_modes','Malak Al Tawouk','duplicate_no',duplicate_no)
  from (values ('report (2)(1).pdf',1), ('report (1)(1).pdf',2)) as s(source_file, duplicate_no)
  returning audit_report_id, source_file_name
), sections as (
  insert into public.audit_report_sections (audit_report_id, organization_id, location_id, section_name, section_status, score_percentage, completed_by_name, completed_at, sort_order, raw_section)
  select nr.audit_report_id, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000007', s.section_name, 'completed', 0.00, 'Elie Fahed', '2026-06-22 08:14:30+00', s.sort_order, to_jsonb(s)
  from new_reports nr
  cross join (values ('CHILLERS',10),('FREEZERS',20),('FINAL VERIFICATION',30)) as s(section_name, sort_order)
  returning audit_section_id, audit_report_id, section_name
)
insert into public.audit_report_items (
  audit_report_id, audit_section_id, organization_id, location_id, item_text, result_value, is_pass, score_percentage,
  completed_by_name, completed_at, tags, comment_text, risk_category, is_critical, risk_keywords, sort_order, raw_item
)
select s.audit_report_id, s.audit_section_id, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000007', x.item_text, x.result_value, x.is_pass, 0.00,
  'Elie Fahed', x.completed_at::timestamptz, x.tags, x.comment_text, x.risk_category, x.is_critical, x.risk_keywords::jsonb, x.sort_order, to_jsonb(x)
from sections s
join (values
  ('CHILLERS','Take temperature of Chiller 1','5 Degree Celsius',false,'2026-06-22T08:01:00Z',array['Chiller Temperature Is Not Optimal'],'Temperature above optimal range','temperature_control',true,'["chiller","temperature","not_optimal"]',101),
  ('CHILLERS','Take temperature of Chiller 2','6 Degree Celsius',false,'2026-06-22T08:03:00Z',array['Chiller Temperature Is Not Optimal'],'Temperature above optimal range','temperature_control',true,'["chiller","temperature","not_optimal"]',102),
  ('CHILLERS','Take temperature of Chiller 3','7 Degree Celsius',false,'2026-06-22T08:03:00Z',array['Chiller Temperature Is Not Optimal'],'Temperature above optimal range','temperature_control',true,'["chiller","temperature","not_optimal"]',103),
  ('CHILLERS','Take temperature of Chiller 4','7 Degree Celsius',false,'2026-06-22T08:05:00Z',array['Chiller Temperature Is Not Optimal'],'Temperature above optimal range','temperature_control',true,'["chiller","temperature","not_optimal"]',104),
  ('CHILLERS','Take temperature of Chiller 5','5 Degree Celsius',false,'2026-06-22T08:06:00Z',array['Chiller Temperature Is Not Optimal'],'Temperature above optimal range','temperature_control',true,'["chiller","temperature","not_optimal"]',105),
  ('CHILLERS','Take temperature of Chiller 6','7 Degree Celsius',false,'2026-06-22T08:10:00Z',array['Chiller Temperature Is Not Optimal'],'Temperature above optimal range','temperature_control',true,'["chiller","temperature","not_optimal"]',106),
  ('CHILLERS','Take temperature of Chiller 7','6 Degree Celsius',false,'2026-06-22T08:11:00Z',array['Chiller Temperature Is Not Optimal'],'Temperature above optimal range','temperature_control',true,'["chiller","temperature","not_optimal"]',107),
  ('CHILLERS','Take temperature of Chiller 8','6 Degree Celsius',false,'2026-06-22T08:11:00Z',array['Chiller Temperature Is Not Optimal'],'Temperature above optimal range','temperature_control',true,'["chiller","temperature","not_optimal"]',108),
  ('CHILLERS','Take temperature of Chiller 9','8 Degree Celsius',false,'2026-06-22T08:13:00Z',array['Chiller Temperature Is Not Optimal'],'Temperature above optimal range','temperature_control',true,'["chiller","temperature","not_optimal"]',109),
  ('FREEZERS','Take temperature of Freezer 1','-22 Degree Celsius',true,'2026-06-22T08:13:00Z',array['Freezer Temperature Is Optimal'],null,'temperature_control',false,'["freezer","temperature","optimal"]',201),
  ('FREEZERS','Take temperature of Freezer 2','-22 Degree Celsius',true,'2026-06-22T08:13:00Z',array['Freezer Temperature Is Optimal'],null,'temperature_control',false,'["freezer","temperature","optimal"]',202),
  ('FREEZERS','Take temperature of Freezer 3','-19 Degree Celsius',true,'2026-06-22T08:14:00Z',array['Freezer Temperature Is Optimal'],null,'temperature_control',false,'["freezer","temperature","optimal"]',203),
  ('FINAL VERIFICATION','Do any chillers/freezers require any maintenance?','false',true,'2026-06-22T08:14:00Z',array[]::text[],null,'equipment_condition',false,'["maintenance"]',301),
  ('FINAL VERIFICATION','Any additional comments?','N/A',true,'2026-06-22T08:14:00Z',array[]::text[],null,'general',false,'[]',302),
  ('FINAL VERIFICATION','Verified by:','Elie Fahed',true,'2026-06-22T08:14:00Z',array[]::text[],null,'monitoring_records',false,'["verification"]',303)
) as x(section_name,item_text,result_value,is_pass,completed_at,tags,comment_text,risk_category,is_critical,risk_keywords,sort_order)
on x.section_name = s.section_name;

-- Detailed failed items view
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
    when ai.risk_category = 'temperature_control' then 'Check chiller/freezer temperature, repair equipment if needed, and require photo evidence.'
    when ai.risk_category = 'cross_contamination' then 'Separate raw and ready-to-eat food, verify storage zones, retrain team, and add manager verification.'
    when ai.risk_category = 'labeling' then 'Relabel affected items and verify labeling during the next shift.'
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

create or replace view public.v_advanced_report_category_analytics as
select
  fi.organization_id, fi.location_id, fi.location_name, fi.risk_category,
  count(*)::integer as failed_item_count,
  count(*) filter (where fi.is_critical)::integer as critical_failed_item_count,
  count(distinct fi.audit_report_id)::integer as affected_audit_count,
  count(distinct fi.section_name)::integer as affected_section_count,
  round(avg(coalesce(fi.score_percentage, 0))::numeric, 2) as avg_item_score_pct,
  max(fi.completed_at) as latest_failure_at,
  case when count(*) filter (where fi.is_critical) > 0 then 'critical' when count(*) >= 5 then 'high' when count(*) >= 2 then 'medium' else 'low' end as category_risk_level
from public.v_advanced_report_failed_items fi
group by fi.organization_id, fi.location_id, fi.location_name, fi.risk_category;

create or replace view public.v_advanced_report_section_analytics as
select
  ars.organization_id, ars.location_id,
  coalesce(l.location_name, ar.location_name_text, ar.brand_name, 'Imported report location') as location_name,
  ar.checklist_name,
  ars.section_name,
  count(distinct ars.audit_report_id)::integer as audit_report_count,
  round(avg(ars.score_percentage)::numeric, 2) as avg_section_score_pct,
  round(min(ars.score_percentage)::numeric, 2) as min_section_score_pct,
  count(fi.audit_item_id)::integer as failed_item_count,
  count(fi.audit_item_id) filter (where fi.is_critical)::integer as critical_failed_item_count,
  max(ars.completed_at) as latest_section_at,
  case when count(fi.audit_item_id) filter (where fi.is_critical) > 0 then 'critical' when avg(ars.score_percentage) < 70 then 'high' when avg(ars.score_percentage) < 85 then 'medium' else 'low' end as section_risk_level
from public.audit_report_sections ars
join public.audit_reports ar on ar.audit_report_id = ars.audit_report_id
left join public.locations l on l.location_id = ars.location_id
left join public.v_advanced_report_failed_items fi on fi.audit_section_id = ars.audit_section_id
group by ars.organization_id, ars.location_id, coalesce(l.location_name, ar.location_name_text, ar.brand_name, 'Imported report location'), ar.checklist_name, ars.section_name;

create or replace view public.v_advanced_report_repeated_issues as
select
  fi.organization_id, fi.location_id, fi.location_name,
  lower(regexp_replace(fi.item_text, '[^a-zA-Z0-9]+', ' ', 'g')) as normalized_item_text,
  min(fi.item_text) as example_item_text,
  fi.risk_category,
  count(*)::integer as repeat_count,
  count(*) filter (where fi.is_critical)::integer as critical_repeat_count,
  count(distinct fi.audit_report_id)::integer as affected_audit_count,
  max(fi.completed_at) as latest_failure_at,
  array_agg(distinct fi.section_name) as affected_sections,
  case when count(*) filter (where fi.is_critical) > 0 then 'critical' when count(*) >= 3 then 'high' else 'medium' end as repeated_issue_level
from public.v_advanced_report_failed_items fi
group by fi.organization_id, fi.location_id, fi.location_name, lower(regexp_replace(fi.item_text, '[^a-zA-Z0-9]+', ' ', 'g')), fi.risk_category
having count(*) > 1;

create or replace view public.v_advanced_report_action_plan as
select
  fi.organization_id, fi.location_id, fi.location_name, fi.audit_item_id as action_source_id,
  'ACT-' || upper(substr(fi.audit_item_id::text, 1, 8)) as action_reference,
  fi.severity,
  case when fi.severity = 'critical' then 1 when fi.severity = 'high' then 2 when fi.severity = 'medium' then 3 else 4 end as priority_rank,
  fi.risk_category, fi.section_name, fi.item_text as action_title, fi.comment_text as finding_comment,
  fi.recommended_action, fi.completed_by_name as assigned_from_audit_user,
  coalesce(fi.completed_at, fi.audit_completed_at, now()) + (fi.due_in_days || ' days')::interval as suggested_due_at,
  true as evidence_required, fi.audit_report_id, fi.checklist_name, fi.completed_at as finding_at
from public.v_advanced_report_failed_items fi;

create or replace view public.v_advanced_report_location_analytics as
with audit_summary as (
  select ar.organization_id, ar.location_id, coalesce(l.location_name, ar.location_name_text, ar.brand_name, 'Imported report location') as location_name,
    count(*)::integer as audit_report_count,
    round(avg(ar.score_percentage)::numeric, 2) as avg_audit_score_pct,
    round(min(ar.score_percentage)::numeric, 2) as min_audit_score_pct,
    (array_agg(ar.score_percentage order by coalesce(ar.completed_at, ar.display_at, ar.created_at) desc))[1] as latest_audit_score_pct,
    max(coalesce(ar.completed_at, ar.display_at, ar.created_at)) as latest_audit_at
  from public.audit_reports ar left join public.locations l on l.location_id = ar.location_id
  group by ar.organization_id, ar.location_id, coalesce(l.location_name, ar.location_name_text, ar.brand_name, 'Imported report location')
), completion_summary as (
  select cr.organization_id, cr.location_id, coalesce(l.location_name, cr.location_name_text, 'Imported report location') as location_name,
    count(*)::integer as completion_report_count,
    round(avg(cr.lists_completed_pct)::numeric, 2) as avg_lists_completed_pct,
    round(avg(cr.lists_missed_pct)::numeric, 2) as avg_lists_missed_pct,
    round(avg(cr.items_completed_pct)::numeric, 2) as avg_items_completed_pct,
    round(avg(cr.items_missed_pct)::numeric, 2) as avg_items_missed_pct,
    max(coalesce(cr.date_range_end::timestamptz, cr.created_at)) as latest_completion_at
  from public.completion_rate_reports cr left join public.locations l on l.location_id = cr.location_id
  group by cr.organization_id, cr.location_id, coalesce(l.location_name, cr.location_name_text, 'Imported report location')
), failure_summary as (
  select fi.organization_id, fi.location_id, fi.location_name,
    count(*)::integer as failed_item_count,
    count(*) filter (where fi.is_critical)::integer as critical_failed_item_count,
    count(*) filter (where fi.risk_category = 'temperature_control')::integer as temperature_control_failures,
    max(fi.completed_at) as latest_failure_at
  from public.v_advanced_report_failed_items fi group by fi.organization_id, fi.location_id, fi.location_name
), repeated_summary as (
  select organization_id, location_id, count(*)::integer as repeated_issue_count from public.v_advanced_report_repeated_issues group by organization_id, location_id
), combined as (
  select coalesce(a.organization_id,c.organization_id,f.organization_id) as organization_id,
    coalesce(a.location_id,c.location_id,f.location_id) as location_id,
    coalesce(a.location_name,c.location_name,f.location_name,'Imported report location') as location_name,
    coalesce(a.audit_report_count,0) as audit_report_count,
    coalesce(c.completion_report_count,0) as completion_report_count,
    a.avg_audit_score_pct, a.min_audit_score_pct, a.latest_audit_score_pct,
    c.avg_lists_completed_pct, c.avg_lists_missed_pct, c.avg_items_completed_pct, c.avg_items_missed_pct,
    coalesce(f.failed_item_count,0) as failed_item_count,
    coalesce(f.critical_failed_item_count,0) as critical_failed_item_count,
    coalesce(r.repeated_issue_count,0) as repeated_issue_count,
    coalesce(f.temperature_control_failures,0) as temperature_control_failures,
    greatest(coalesce(a.latest_audit_at, '1900-01-01'::timestamptz), coalesce(c.latest_completion_at, '1900-01-01'::timestamptz), coalesce(f.latest_failure_at, '1900-01-01'::timestamptz)) as latest_activity_at
  from audit_summary a
  full outer join completion_summary c on c.organization_id = a.organization_id and c.location_id = a.location_id
  full outer join failure_summary f on f.organization_id = coalesce(a.organization_id,c.organization_id) and f.location_id = coalesce(a.location_id,c.location_id)
  left join repeated_summary r on r.organization_id = coalesce(a.organization_id,c.organization_id,f.organization_id) and r.location_id = coalesce(a.location_id,c.location_id,f.location_id)
), scored as (
  select c.*,
    least(100, greatest(0, coalesce(100 - c.avg_audit_score_pct, 0) * 0.7 + c.failed_item_count * 2.2 + c.critical_failed_item_count * 10 + c.repeated_issue_count * 4.5 + c.temperature_control_failures * 6 + coalesce(c.avg_lists_missed_pct,0) * 0.35 + coalesce(c.avg_items_missed_pct,0) * 0.2))::numeric(8,2) as risk_score
  from combined c
)
select s.*, s.risk_score as calculated_risk_score, (100 - s.risk_score)::numeric(8,2) as health_score,
  s.avg_audit_score_pct as avg_audit_score_percentage,
  case when s.risk_score >= 80 then 'critical' when s.risk_score >= 60 then 'high' when s.risk_score >= 35 then 'medium' else 'low' end as risk_level,
  case when s.risk_score >= 80 then 'critical' when s.risk_score >= 60 then 'high' when s.risk_score >= 35 then 'medium' else 'low' end as predicted_risk_level,
  round(least(0.98, greatest(0.55, 0.62 + (s.audit_report_count + s.completion_report_count) * 0.04 + s.failed_item_count * 0.01))::numeric, 2) as confidence
from scored s;

create or replace view public.v_predictive_location_risk as
select organization_id, location_id, location_name,
  risk_score as current_risk_score,
  null::numeric as previous_risk_score,
  (least(100, risk_score + critical_failed_item_count * 1.8 + repeated_issue_count * 0.8) - risk_score)::numeric(8,2) as risk_delta,
  least(100, risk_score + critical_failed_item_count * 1.8 + repeated_issue_count * 0.8)::numeric(8,2) as predicted_next_risk_score,
  greatest(0, 100 - least(100, risk_score + critical_failed_item_count * 1.8 + repeated_issue_count * 0.8))::numeric(8,2) as predicted_next_audit_score,
  case when least(100, risk_score + critical_failed_item_count * 1.8 + repeated_issue_count * 0.8) >= 80 then 'critical' when least(100, risk_score + critical_failed_item_count * 1.8 + repeated_issue_count * 0.8) >= 60 then 'high' when least(100, risk_score + critical_failed_item_count * 1.8 + repeated_issue_count * 0.8) >= 35 then 'medium' else 'low' end as predicted_risk_level,
  case when critical_failed_item_count > 0 or repeated_issue_count > 0 then 'risk increasing' else 'stable' end as trend_direction,
  case when risk_score >= 80 then 'Immediate visit / within 24 hours' when risk_score >= 60 then 'Within 3 days' when risk_score >= 35 then 'Within 7 days' else 'Routine follow-up' end as recommended_visit_window,
  concat('Prediction learned from ', audit_report_count, ' audit report(s), ', completion_report_count, ' completion report(s), ', failed_item_count, ' failed item(s), ', critical_failed_item_count, ' critical failure(s), and ', repeated_issue_count, ' repeated issue(s).') as prediction_reason,
  failed_item_count, critical_failed_item_count, repeated_issue_count
from public.v_advanced_report_location_analytics;

create or replace view public.v_ml_explanation_driver_breakdown as
select organization_id, location_id, location_name, 'Critical temperature failures'::text as driver_label, 'temperature_control'::text as driver_group,
  critical_failed_item_count::numeric as actual_value, (critical_failed_item_count * 12)::numeric(8,2) as impact_points, risk_score,
  concat(critical_failed_item_count, ' critical failure(s) are driving the location risk. Chiller temperatures above optimal range require action.') as explanation, 1 as driver_rank
from public.v_advanced_report_location_analytics where critical_failed_item_count > 0
union all
select organization_id, location_id, location_name, 'Missed checklist rate', 'execution discipline', avg_lists_missed_pct, (coalesce(avg_lists_missed_pct,0) * 0.35)::numeric(8,2), risk_score,
  concat('Lists missed rate is ', coalesce(avg_lists_missed_pct,0), '%, indicating execution discipline risk.'), 2
from public.v_advanced_report_location_analytics where coalesce(avg_lists_missed_pct,0) > 0
union all
select organization_id, location_id, location_name, 'Repeated failures', 'historical learning', repeated_issue_count::numeric, (repeated_issue_count * 4.5)::numeric(8,2), risk_score,
  concat(repeated_issue_count, ' repeated issue pattern(s) were learned from historical imported reports.'), 3
from public.v_advanced_report_location_analytics where repeated_issue_count > 0;

create or replace view public.v_location_benchmarking as
select a.*, dense_rank() over (partition by a.organization_id order by a.risk_score desc nulls last) as risk_rank_high_to_low,
  dense_rank() over (partition by a.organization_id order by a.health_score desc nulls last) as health_rank_best_to_worst,
  round((percent_rank() over (partition by a.organization_id order by a.risk_score))::numeric * 100, 2) as risk_percentile,
  round(avg(a.risk_score) over (partition by a.organization_id)::numeric, 2) as company_avg_risk_score,
  round((a.risk_score - avg(a.risk_score) over (partition by a.organization_id))::numeric, 2) as risk_vs_company_avg
from public.v_advanced_report_location_analytics a;

create or replace view public.v_category_benchmarking as
select c.organization_id, c.risk_category, sum(c.failed_item_count)::integer as total_failed_items,
  sum(c.critical_failed_item_count)::integer as total_critical_failed_items, count(distinct c.location_id)::integer as affected_location_count,
  round(avg(c.avg_item_score_pct)::numeric, 2) as avg_item_score_pct,
  dense_rank() over (partition by c.organization_id order by sum(c.failed_item_count) desc nulls last) as category_failure_rank
from public.v_advanced_report_category_analytics c
group by c.organization_id, c.risk_category;

create or replace view public.v_section_benchmarking as
select s.organization_id, s.section_name, sum(s.failed_item_count)::integer as failed_item_count,
  sum(s.critical_failed_item_count)::integer as critical_failed_item_count, count(distinct s.location_id)::integer as affected_location_count,
  round(avg(s.avg_section_score_pct)::numeric, 2) as avg_section_score_pct,
  round(min(s.min_section_score_pct)::numeric, 2) as min_section_score_pct,
  dense_rank() over (partition by s.organization_id order by avg(s.avg_section_score_pct) asc nulls last) as weakest_section_rank
from public.v_advanced_report_section_analytics s
group by s.organization_id, s.section_name;

create or replace view public.v_client_company_dashboard as
with category_top as (
  select distinct on (organization_id) organization_id, risk_category as top_risk_category, failed_item_count as top_category_failures
  from public.v_advanced_report_category_analytics order by organization_id, failed_item_count desc nulls last
), action_summary as (
  select organization_id, count(*)::integer as open_action_count, count(*) filter (where severity in ('critical','high'))::integer as high_priority_action_count
  from public.v_advanced_report_action_plan group by organization_id
)
select a.organization_id, coalesce(o.organization_name, a.organization_id::text) as company_name,
  count(distinct a.location_id)::integer as location_count,
  sum(coalesce(a.audit_report_count,0))::integer as audit_report_count,
  sum(coalesce(a.completion_report_count,0))::integer as completion_report_count,
  round(avg(a.risk_score)::numeric,2) as avg_risk_score,
  round(avg(a.health_score)::numeric,2) as avg_health_score,
  count(*) filter (where a.risk_score >= 80)::integer as critical_location_count,
  count(*) filter (where a.risk_score >= 60)::integer as high_risk_location_count,
  sum(coalesce(a.failed_item_count,0))::integer as total_failed_items,
  sum(coalesce(a.critical_failed_item_count,0))::integer as total_critical_failures,
  sum(coalesce(a.repeated_issue_count,0))::integer as total_repeated_issues,
  round(avg(a.avg_lists_missed_pct)::numeric,2) as avg_lists_missed_pct,
  round(avg(a.avg_items_missed_pct)::numeric,2) as avg_items_missed_pct,
  ct.top_risk_category, coalesce(ct.top_category_failures,0)::integer as top_category_failures,
  coalesce(act.open_action_count,0)::integer as open_action_count,
  coalesce(act.high_priority_action_count,0)::integer as high_priority_action_count,
  max(a.latest_activity_at) as latest_calculated_at
from public.v_advanced_report_location_analytics a
left join public.organizations o on o.organization_id = a.organization_id
left join category_top ct on ct.organization_id = a.organization_id
left join action_summary act on act.organization_id = a.organization_id
group by a.organization_id, o.organization_name, ct.top_risk_category, ct.top_category_failures, act.open_action_count, act.high_priority_action_count;

grant select on public.v_client_company_dashboard to anon, authenticated;
grant select on public.v_location_benchmarking to anon, authenticated;
grant select on public.v_category_benchmarking to anon, authenticated;
grant select on public.v_section_benchmarking to anon, authenticated;
grant select on public.v_predictive_location_risk to anon, authenticated;
grant select on public.v_ml_explanation_driver_breakdown to anon, authenticated;
grant select on public.v_advanced_report_location_analytics to anon, authenticated;
grant select on public.v_advanced_report_action_plan to anon, authenticated;
grant select on public.v_advanced_report_repeated_issues to anon, authenticated;
grant select on public.v_advanced_report_section_analytics to anon, authenticated;
grant select on public.v_advanced_report_category_analytics to anon, authenticated;
grant select on public.v_advanced_report_failed_items to anon, authenticated;

notify pgrst, 'reload schema';
commit;

select 'malak_zouk_uploaded_reports_seeded_and_views_ready' as status;
