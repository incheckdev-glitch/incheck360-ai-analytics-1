create extension if not exists pgcrypto;

create table if not exists public.organizations (
  organization_id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  legal_name text,
  industry text default 'F&B / Retail Operations',
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  location_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  location_code text not null,
  location_name text not null,
  brand_name text,
  region text,
  city text,
  address text,
  manager_name text,
  status text not null default 'active' check (status in ('active', 'paused', 'setup')),
  created_at timestamptz not null default now(),
  unique (organization_id, location_code)
);

create table if not exists public.user_profiles (
  profile_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  organization_id uuid references public.organizations(organization_id) on delete cascade,
  full_name text not null,
  email text,
  role text not null default 'staff' check (role in ('admin', 'operations_manager', 'area_manager', 'store_manager', 'staff', 'auditor', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_templates (
  template_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  title text not null,
  category text not null,
  target_role text,
  shift_name text,
  frequency text,
  estimated_minutes integer default 10,
  version_no integer not null default 1,
  active boolean not null default true,
  created_by uuid references public.user_profiles(profile_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_questions (
  question_id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(template_id) on delete cascade,
  sort_order integer not null default 1,
  title text not null,
  question_type text not null check (question_type in ('yes_no', 'number', 'temperature', 'text', 'photo', 'signature', 'multi_select')),
  is_required boolean not null default true,
  requires_photo_on_fail boolean not null default false,
  min_value numeric,
  max_value numeric,
  options jsonb not null default '[]'::jsonb,
  sop_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.execution_tasks (
  task_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  location_id uuid references public.locations(location_id) on delete cascade,
  template_id uuid references public.checklist_templates(template_id) on delete set null,
  title text not null,
  assigned_to uuid references public.user_profiles(profile_id) on delete set null,
  due_at timestamptz,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done', 'overdue')),
  completion_percent integer not null default 0 check (completion_percent >= 0 and completion_percent <= 100),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.checklist_submissions (
  submission_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  location_id uuid not null references public.locations(location_id) on delete cascade,
  template_id uuid not null references public.checklist_templates(template_id) on delete restrict,
  task_id uuid references public.execution_tasks(task_id) on delete set null,
  submitted_by uuid references public.user_profiles(profile_id) on delete set null,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  score numeric(5,2),
  submitted_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.checklist_answers (
  answer_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.checklist_submissions(submission_id) on delete cascade,
  question_id uuid not null references public.checklist_questions(question_id) on delete restrict,
  answer_value jsonb not null default '{}'::jsonb,
  is_pass boolean,
  notes text,
  evidence_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.incidents (
  incident_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  location_id uuid references public.locations(location_id) on delete cascade,
  incident_reference text not null,
  title text not null,
  category text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'closed')),
  reported_by uuid references public.user_profiles(profile_id) on delete set null,
  summary text,
  evidence_urls jsonb not null default '[]'::jsonb,
  reported_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.corrective_actions (
  corrective_action_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  location_id uuid references public.locations(location_id) on delete cascade,
  incident_id uuid references public.incidents(incident_id) on delete set null,
  title text not null,
  owner_id uuid references public.user_profiles(profile_id) on delete set null,
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done', 'overdue')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  evidence_required boolean not null default false,
  closure_notes text,
  closure_evidence_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.reference_materials (
  material_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  title text not null,
  category text not null,
  content text,
  file_url text,
  version_no integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_locations_org on public.locations(organization_id);
create index if not exists idx_tasks_org_status on public.execution_tasks(organization_id, status);
create index if not exists idx_tasks_location_due on public.execution_tasks(location_id, due_at);
create index if not exists idx_incidents_org_status on public.incidents(organization_id, status);
create index if not exists idx_corrective_actions_org_status on public.corrective_actions(organization_id, status);
