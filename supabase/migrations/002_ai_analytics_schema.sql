create extension if not exists vector with schema extensions;

create table if not exists public.ai_model_runs (
  run_id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(organization_id) on delete cascade,
  run_type text not null,
  model_provider text not null default 'openai',
  model_name text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  input_tokens integer default 0,
  output_tokens integer default 0,
  cost_usd numeric(12,6),
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.ai_entity_snapshots (
  snapshot_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
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

create table if not exists public.ai_knowledge_chunks (
  chunk_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id) on delete cascade,
  source_module text not null,
  source_table text,
  source_id uuid,
  source_reference text,
  location_id uuid references public.locations(location_id) on delete cascade,
  title text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_insights_org_status on public.ai_insights(organization_id, status);
create index if not exists idx_ai_insights_org_severity on public.ai_insights(organization_id, severity);
create index if not exists idx_ai_insights_location on public.ai_insights(location_id);
create index if not exists idx_ai_snapshots_entity on public.ai_entity_snapshots(entity_type, entity_id);
create index if not exists idx_ai_knowledge_source on public.ai_knowledge_chunks(source_module, source_table, source_id);
create index if not exists idx_ai_knowledge_embedding on public.ai_knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.match_ai_knowledge_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 5,
  filter_organization_id uuid default null,
  filter_location_id uuid default null
)
returns table (
  chunk_id uuid,
  source_module text,
  source_table text,
  source_id uuid,
  source_reference text,
  location_id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity numeric
)
language sql
stable
as $$
  select
    akc.chunk_id,
    akc.source_module,
    akc.source_table,
    akc.source_id,
    akc.source_reference,
    akc.location_id,
    akc.title,
    akc.content,
    akc.metadata,
    (1 - (akc.embedding <=> query_embedding))::numeric as similarity
  from public.ai_knowledge_chunks akc
  where akc.embedding is not null
    and (filter_organization_id is null or akc.organization_id = filter_organization_id)
    and (filter_location_id is null or akc.location_id = filter_location_id)
  order by akc.embedding <=> query_embedding
  limit match_count;
$$;
