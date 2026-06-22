-- Audit Advanced Report entitlements and checklist eligibility.
-- The module is available only when the organization has active add-on access
-- and the checklist is marked as an Audit Report checklist.

create table if not exists public.audit_advanced_report_entitlements (
  entitlement_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  status text not null default 'inactive' check (status in ('active','inactive','expired','suspended')),
  fee_status text not null default 'pending' check (fee_status in ('pending','paid','waived','not_required','blocked')),
  valid_from date default current_date,
  valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.audit_report_checklist_settings (
  setting_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  template_id uuid references public.checklist_templates(template_id) on delete set null,
  checklist_name text not null,
  is_audit_report boolean not null default true,
  included_in_advanced_report boolean not null default true,
  fee_status text not null default 'paid' check (fee_status in ('pending','paid','waived','not_required','blocked')),
  audit_report_type text not null default 'operational_audit',
  risk_domain text not null default 'operations',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, checklist_name)
);

alter table if exists public.checklist_templates
  add column if not exists is_audit_report boolean not null default false,
  add column if not exists included_in_audit_advanced_report boolean not null default false,
  add column if not exists audit_report_type text,
  add column if not exists audit_advanced_report_fee_status text not null default 'pending';

insert into public.audit_advanced_report_entitlements (organization_id, status, fee_status, valid_from, notes)
values ('10000000-0000-0000-0000-000000000001', 'active', 'paid', '2026-06-01', 'Demo organization enabled for Audit Advanced Report.')
on conflict (organization_id) do update set status = excluded.status, fee_status = excluded.fee_status, updated_at = now();

insert into public.audit_report_checklist_settings (organization_id, checklist_name, is_audit_report, included_in_advanced_report, fee_status, audit_report_type, risk_domain, notes)
select distinct ar.organization_id, ar.checklist_name, true, true, 'paid',
  case when lower(ar.checklist_name) like '%temperature%' or lower(ar.checklist_name) like '%chiller%' or lower(ar.checklist_name) like '%freezer%' then 'temperature_audit' else 'operational_audit' end,
  case when lower(ar.checklist_name) like '%temperature%' or lower(ar.checklist_name) like '%chiller%' or lower(ar.checklist_name) like '%freezer%' then 'temperature_control' else 'operations' end,
  'Enabled from imported audit report.'
from public.audit_reports ar
where ar.checklist_name is not null
on conflict (organization_id, checklist_name) do update set is_audit_report = true, included_in_advanced_report = true, fee_status = 'paid', updated_at = now();

insert into public.audit_report_checklist_settings (organization_id, checklist_name, is_audit_report, included_in_advanced_report, fee_status, audit_report_type, risk_domain, notes)
select distinct cc.organization_id, cc.checklist_name, true, true, 'paid',
  case when lower(cc.checklist_name) like '%temperature%' or lower(cc.checklist_name) like '%chiller%' or lower(cc.checklist_name) like '%freezer%' then 'temperature_monitoring_audit' else 'checklist_completion_audit' end,
  case when lower(cc.checklist_name) like '%temperature%' or lower(cc.checklist_name) like '%chiller%' or lower(cc.checklist_name) like '%freezer%' then 'temperature_control' else 'execution_compliance' end,
  'Enabled from imported completion checklist.'
from public.completion_rate_checklists cc
where cc.checklist_name is not null
on conflict (organization_id, checklist_name) do update set is_audit_report = true, included_in_advanced_report = true, fee_status = 'paid', updated_at = now();

create or replace view public.v_audit_advanced_report_module_status as
select
  o.organization_id,
  o.organization_name as client_name,
  coalesce(e.status, 'inactive') as entitlement_status,
  coalesce(e.fee_status, 'pending') as fee_status,
  e.valid_from,
  e.valid_until,
  count(s.setting_id) filter (where s.is_audit_report)::integer as audit_report_checklist_count,
  count(s.setting_id) filter (where s.is_audit_report and s.included_in_advanced_report and s.fee_status in ('paid','waived','not_required'))::integer as enabled_checklist_count,
  case
    when coalesce(e.status, 'inactive') = 'active'
     and coalesce(e.fee_status, 'pending') in ('paid','waived','not_required')
     and count(s.setting_id) filter (where s.is_audit_report and s.included_in_advanced_report and s.fee_status in ('paid','waived','not_required')) > 0
    then true else false end as can_access_audit_advanced_report
from public.organizations o
left join public.audit_advanced_report_entitlements e on e.organization_id = o.organization_id
left join public.audit_report_checklist_settings s on s.organization_id = o.organization_id
group by o.organization_id, o.organization_name, e.status, e.fee_status, e.valid_from, e.valid_until;

create or replace view public.v_audit_report_checklists_access as
select
  s.organization_id,
  o.organization_name as client_name,
  s.template_id,
  s.checklist_name,
  s.is_audit_report,
  s.included_in_advanced_report,
  s.fee_status,
  s.audit_report_type,
  s.risk_domain,
  coalesce(e.status, 'inactive') as entitlement_status,
  case when coalesce(e.status, 'inactive') = 'active' and coalesce(e.fee_status, 'pending') in ('paid','waived','not_required') and s.is_audit_report and s.included_in_advanced_report and s.fee_status in ('paid','waived','not_required') then true else false end as can_use_in_audit_advanced_report,
  s.updated_at
from public.audit_report_checklist_settings s
join public.organizations o on o.organization_id = s.organization_id
left join public.audit_advanced_report_entitlements e on e.organization_id = s.organization_id;

notify pgrst, 'reload schema';
select 'audit_advanced_report_entitlements_ready' as status;
