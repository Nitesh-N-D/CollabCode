create extension if not exists pgcrypto;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  instructor_id uuid not null references auth.users(id) on delete cascade,
  instructor_name text not null,
  title text not null,
  assignment_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz
);
create index if not exists sessions_instructor_idx on public.sessions(instructor_id, created_at desc);

create table if not exists public.session_instructors (
  session_id uuid references public.sessions(id) on delete cascade,
  instructor_id uuid references auth.users(id) on delete cascade,
  primary key (session_id, instructor_id)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_key text not null,
  display_name text not null,
  connected boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(session_id, student_key)
);

create table if not exists public.events (
  id uuid primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_key text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null
);
create index if not exists events_replay_idx on public.events(session_id, student_key, occurred_at);

create table if not exists public.hints (
  id uuid primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  target_student_key text,
  message text not null,
  code_snippet text,
  instructor_name text not null,
  sent_at timestamptz not null default now()
);

create table if not exists public.hint_reads (
  hint_id uuid references public.hints(id) on delete cascade,
  student_key text not null,
  read_at timestamptz not null default now(),
  primary key(hint_id, student_key)
);

alter table public.sessions enable row level security;
drop policy if exists "instructors read owned sessions" on public.sessions;
create policy "instructors read owned sessions" on public.sessions for select
  using (auth.uid() = instructor_id or exists (
    select 1 from public.session_instructors si
    where si.session_id = id and si.instructor_id = auth.uid()
  ));

create table if not exists public.stuck_alerts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  affected_keys text[] not null default '{}',
  ai_reason text not null,
  ai_hint text not null,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists stuck_alerts_session_idx
  on public.stuck_alerts(session_id, created_at desc);

create table if not exists public.session_analytics (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  active_count integer not null default 0,
  stuck_count integer not null default 0,
  idle_count integer not null default 0,
  help_count integer not null default 0,
  edit_rate numeric(8,2) not null default 0,
  avg_stuck_score numeric(5,2) not null default 0
);
alter table public.session_analytics add column if not exists edit_rate numeric(8,2) not null default 0;
create index if not exists session_analytics_session_idx
  on public.session_analytics(session_id, recorded_at);

create table if not exists public.teaching_moments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_key text not null,
  title text not null,
  reason text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists teaching_moments_session_idx
  on public.teaching_moments(session_id, created_at desc);
