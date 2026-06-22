-- Internal ML analytics schema
-- No OpenAI / external API dependency is required for these tables.

create table if not exists public.ai_model_runs (
  run_id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(organization_id) on delete cascade,
  run_type text not null default 'manual' check (run_type in ('manual', 'daily', 'location', 'backfill')),
  model_provider text not null default 'internal_ml',
  model_name text not null default 'ops_risk_v1',
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  rows_scored integer default 0,
  insights_created integer default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.internal_ml_feature_weights (
  weight_id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(organization_id) on delete cascade,
  model_name text not null default 'ops_risk_v1',
  feature_key text not null,
  feature_label text not null,
  weight numeric(8,3) not null,
  max_contribution numeric(8,3),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, model_name, feature_key)
);

create table if not exists public.ai_entity_snapshots (
  snapshot_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  run_id uuid references public.ai_model_runs(run_id) on delete set null,
  snapshot_date date not null default current_date,
  entity_type text not null,
  entity_id uuid,
  entity_reference text,
  location_id uuid references public.locations(location_id) on delete cascade,
  source_module text not null,
  source_data jsonb not null default '{}'::jsonb,
  feature_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_ml_location_scores (
  score_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  run_id uuid references public.ai_model_runs(run_id) on delete set null,
  location_id uuid not null references public.locations(location_id) on delete cascade,
  risk_score numeric(6,2) not null check (risk_score >= 0 and risk_score <= 100),
  health_score numeric(6,2) not null check (health_score >= 0 and health_score <= 100),
  predicted_risk_level text not null check (predicted_risk_level in ('low', 'medium', 'high', 'critical')),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  features jsonb not null default '{}'::jsonb,
  top_drivers jsonb not null default '[]'::jsonb,
  scored_at timestamptz not null default now()
);

create table if not exists public.ai_insights (
  insight_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  run_id uuid references public.ai_model_runs(run_id) on delete set null,
  module text not null check (module in ('locations', 'checklists', 'tasks', 'incidents', 'corrective_actions', 'compliance')),
  entity_type text,
  entity_id uuid,
  entity_reference text,
  location_id uuid references public.locations(location_id) on delete cascade,
  title text not null,
  summary text not null,
  recommendation text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  confidence numeric(4,3) check (confidence >= 0 and confidence <= 1),
  status text not null default 'new' check (status in ('new', 'seen', 'resolved', 'dismissed')),
  evidence jsonb not null default '[]'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  seen_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_insight_feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  insight_id uuid not null references public.ai_insights(insight_id) on delete cascade,
  user_id uuid references public.user_profiles(profile_id) on delete set null,
  feedback_type text not null check (feedback_type in ('useful', 'not_useful', 'incorrect', 'resolved')),
  feedback_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_runs_org_status on public.ai_model_runs(organization_id, status);
create index if not exists idx_ai_insights_org_status on public.ai_insights(organization_id, status);
create index if not exists idx_ai_insights_org_severity on public.ai_insights(organization_id, severity);
create index if not exists idx_ai_insights_location on public.ai_insights(location_id);
create index if not exists idx_ai_snapshots_entity on public.ai_entity_snapshots(entity_type, entity_id);
create index if not exists idx_internal_ml_scores_org_location on public.internal_ml_location_scores(organization_id, location_id, scored_at desc);
create unique index if not exists idx_internal_ml_global_weights_unique on public.internal_ml_feature_weights(model_name, feature_key) where organization_id is null;

insert into public.internal_ml_feature_weights (organization_id, feature_key, feature_label, weight, max_contribution)
values
(null, 'overdue_tasks', 'Overdue tasks', 12.0, 36.0),
(null, 'blocked_tasks', 'Blocked tasks', 18.0, 36.0),
(null, 'critical_open_tasks', 'Critical open tasks', 10.0, 30.0),
(null, 'open_incidents', 'Open incidents', 10.0, 30.0),
(null, 'critical_incidents', 'Critical incidents', 25.0, 50.0),
(null, 'high_incidents', 'High incidents', 15.0, 30.0),
(null, 'overdue_corrective_actions', 'Overdue corrective actions', 14.0, 42.0),
(null, 'blocked_corrective_actions', 'Blocked corrective actions', 18.0, 36.0),
(null, 'evidence_required_open_actions', 'Evidence-required open actions', 6.0, 24.0),
(null, 'low_checklist_score_gap', 'Checklist score gap below 90', 1.2, 36.0),
(null, 'days_since_last_audit_over_7', 'Days since last audit over 7', 2.0, 30.0)
on conflict do nothing;

create or replace function public.internal_ml_risk_level(score numeric)
returns text
language sql
immutable
as $$
  select case
    when score >= 80 then 'critical'
    when score >= 60 then 'high'
    when score >= 35 then 'medium'
    else 'low'
  end;
$$;

create or replace function public.internal_ml_confidence(open_signals integer, has_checklist_score boolean)
returns numeric
language sql
immutable
as $$
  select least(0.95, greatest(0.55, 0.58 + (open_signals * 0.045) + case when has_checklist_score then 0.12 else 0 end))::numeric(4,3);
$$;
