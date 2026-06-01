-- Kanna Workflow Platform MVP schema.
-- Events are stored as one Postgres row per event with JSONB payloads.
-- JSONL remains an import/export/debug format, not the primary source of truth.

create table if not exists workflow_definitions (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  description text,
  owner_project_id text,
  current_published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workflow_versions (
  id uuid primary key,
  workflow_definition_id uuid not null references workflow_definitions(id) on delete cascade,
  version text not null,
  status text not null check (status in ('draft', 'published', 'deprecated')),
  source_markdown text,
  manifest_jsonb jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (workflow_definition_id, version)
);

alter table workflow_definitions
  add constraint workflow_definitions_current_version_fk
  foreign key (current_published_version_id)
  references workflow_versions(id)
  deferrable initially deferred;

create table if not exists workflow_runs (
  id uuid primary key,
  project_id text not null,
  chat_id text,
  workflow_version_id uuid references workflow_versions(id),
  workflow_type text not null,
  status text not null check (status in ('horizon', 'known', 'running', 'done', 'failed', 'waiting', 'skipped')),
  input_jsonb jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists workflow_events (
  id uuid primary key,
  run_id uuid not null references workflow_runs(id) on delete cascade,
  sequence bigint not null,
  type text not null,
  payload_jsonb jsonb not null default '{}'::jsonb,
  actor_type text not null check (actor_type in ('user', 'agent', 'system')),
  actor_id text,
  created_at timestamptz not null default now(),
  unique (run_id, sequence)
);

create index if not exists workflow_events_run_sequence_idx
  on workflow_events (run_id, sequence);

create index if not exists workflow_events_type_created_idx
  on workflow_events (type, created_at desc);

create index if not exists workflow_events_payload_gin_idx
  on workflow_events using gin (payload_jsonb);

create table if not exists workflow_nodes (
  id text not null,
  run_id uuid not null references workflow_runs(id) on delete cascade,
  parent_id text,
  node_type text not null check (node_type in ('workflow', 'task', 'step', 'gate', 'artifact_check')),
  name text not null,
  status text not null check (status in ('horizon', 'known', 'running', 'done', 'failed', 'waiting', 'skipped')),
  source text not null check (source in ('imported', 'discovered', 'dynamic', 'conditional', 'spawned')),
  order_index integer not null default 0,
  agent text,
  agent_run_id text,
  spawned_by_node_id text,
  tokens integer,
  duration_ms integer,
  condition text,
  sealed boolean not null default false,
  children_sealed boolean not null default false,
  log_summary text,
  updated_at timestamptz not null default now(),
  primary key (run_id, id)
);

create index if not exists workflow_nodes_run_parent_order_idx
  on workflow_nodes (run_id, parent_id, order_index);

create table if not exists artifacts (
  id uuid primary key,
  project_id text not null,
  logical_path text not null,
  kind text not null,
  current_version_id uuid,
  reuse_scope text not null default 'private' check (reuse_scope in ('private', 'project', 'organization', 'platform_global')),
  metadata_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, logical_path)
);

create table if not exists artifact_versions (
  id uuid primary key,
  artifact_id uuid not null references artifacts(id) on delete cascade,
  storage_key text not null,
  checksum text not null,
  content_type text,
  size_bytes bigint,
  produced_by_run_id uuid references workflow_runs(id),
  produced_by_node_id text,
  metadata_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table artifacts
  add constraint artifacts_current_version_fk
  foreign key (current_version_id)
  references artifact_versions(id)
  deferrable initially deferred;

create index if not exists artifact_versions_artifact_created_idx
  on artifact_versions (artifact_id, created_at desc);

create index if not exists artifact_versions_checksum_idx
  on artifact_versions (checksum);

create table if not exists artifact_dependencies (
  source_artifact_id uuid not null references artifacts(id) on delete cascade,
  target_artifact_id uuid not null references artifacts(id) on delete cascade,
  relationship text not null,
  impact_policy text not null default 'maybe_review' check (impact_policy in ('must_review', 'maybe_review', 'ignore_minor_text_change')),
  confidence real not null default 1,
  evidence_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (source_artifact_id, target_artifact_id, relationship)
);

create table if not exists artifact_impacts (
  id uuid primary key,
  run_id uuid references workflow_runs(id) on delete cascade,
  source_artifact_id uuid not null references artifacts(id) on delete cascade,
  impacted_artifact_id uuid not null references artifacts(id) on delete cascade,
  status text not null check (status in ('needs_review', 'reviewed_ok', 'needs_repair', 'repaired', 'not_impacted', 'maybe_impacted')),
  relationship text not null check (relationship in ('direct', 'transitive')),
  reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists artifact_impacts_run_status_idx
  on artifact_impacts (run_id, status);

create index if not exists artifacts_kind_idx
  on artifacts (kind);
