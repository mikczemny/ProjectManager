-- Etap 2 synchronizacji: rozbicie stanu na tabele encji, praca zespołowa.
--
-- Uruchom w Supabase → SQL Editor PO migracji 0001. Idempotentne.
--
-- Różnica wobec Etapu 1: tam cały stan był jednym dokumentem na użytkownika,
-- więc dwie osoby nadpisywały się nawzajem. Tu jednostką zapisu jest wiersz,
-- a przestrzeń robocza jest wspólna dla zespołu.

/* ---------------------------------------------------------------------- */
/*  Przestrzeń robocza i członkostwo                                       */
/* ---------------------------------------------------------------------- */

create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  created_by uuid        not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member'
    check (role in ('owner', 'manager', 'member', 'viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists memberships_user_idx on public.memberships (user_id);

/*
  Funkcje pomocnicze do RLS.

  security definer jest tu konieczny: polityka na `memberships` nie może
  odpytywać `memberships` przez zwykły select, bo wpadłaby w rekurencję.
*/
create or replace function public.is_member(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
     where workspace_id = p_workspace and user_id = auth.uid()
  );
$$;

create or replace function public.has_role(p_workspace uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
     where workspace_id = p_workspace
       and user_id = auth.uid()
       and role = any (p_roles)
  );
$$;

/* ---------------------------------------------------------------------- */
/*  Encje domenowe                                                          */
/* ---------------------------------------------------------------------- */

-- Każda tabela nosi workspace_id, mimo że dałoby się go wywieść przez złączenia.
-- To celowa denormalizacja: polityki RLS zostają jednym prostym warunkiem,
-- a nie łańcuchem podzapytań wykonywanym dla każdego wiersza.
--
-- Klucze encji są typu text, nie uuid: aplikacja generuje własne krótkie
-- identyfikatory i tworzy encje offline, zanim baza je zobaczy. Wymuszanie
-- uuid oznaczałoby przepisanie wszystkich istniejących identyfikatorów wraz
-- z odwołaniami między nimi — ryzyko bez realnej korzyści.

create table if not exists public.members (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null,
  role         text not null default '',
  -- Wypełnione, gdy członek zespołu ma konto: wiąże wpisy czasu z osobą.
  user_id      uuid references auth.users (id) on delete set null,
  updated_at   timestamptz not null default now()
);

create table if not exists public.templates (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null,
  description  text not null default '',
  phases       jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.projects (
  id                 text primary key,
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  name               text not null,
  description        text not null default '',
  template_id        text,
  template_name      text not null default '',
  repo_url           text not null default '',
  sprint_length_days int  not null default 14,
  milestones         jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  archived_at        timestamptz,
  updated_at         timestamptz not null default now()
);

create table if not exists public.phases (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id   text not null references public.projects (id) on delete cascade,
  "order"      int  not null default 1,
  name         text not null default '',
  tip          text not null default '',
  gate         text not null default '',
  completed_at timestamptz,
  completed_by uuid references auth.users (id),
  updated_at   timestamptz not null default now()
);

create table if not exists public.phase_criteria (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  phase_id     text not null references public.phases (id) on delete cascade,
  text         text not null default '',
  checked      boolean not null default false,
  checked_at   timestamptz,
  checked_by   uuid references auth.users (id),
  updated_at   timestamptz not null default now()
);

create table if not exists public.sprints (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id   text not null references public.projects (id) on delete cascade,
  number       int  not null default 1,
  goal         text not null default '',
  start_date   date,
  end_date     date,
  status       text not null default 'planned'
    check (status in ('planned', 'active', 'closed')),
  ceremonies   jsonb not null default '[]'::jsonb,
  retro_notes  text not null default '',
  closed_at    timestamptz,
  updated_at   timestamptz not null default now()
);

create table if not exists public.tasks (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id   text not null references public.projects (id) on delete cascade,
  phase_id     text references public.phases (id) on delete set null,
  sprint_id    text references public.sprints (id) on delete set null,
  title        text not null default '',
  description  text not null default '',
  status       text not null default 'todo',
  priority     text not null default 'medium',
  type         text not null default 'feature',
  assignee     text references public.members (id) on delete set null,
  points       int,
  estimate_h   numeric,
  due_date     date,
  blocked_by   text[] not null default '{}',
  created_at   timestamptz not null default now(),
  done_at      timestamptz,
  updated_at   timestamptz not null default now()
);

create index if not exists tasks_project_idx on public.tasks (project_id);

create table if not exists public.task_links (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id      text not null references public.tasks (id) on delete cascade,
  label        text not null default '',
  url          text not null
);

create table if not exists public.comments (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id      text not null references public.tasks (id) on delete cascade,
  author_id    uuid references auth.users (id) on delete set null,
  text         text not null,
  created_at   timestamptz not null default now()
);

/*
  Czas pracy per osoba.

  Kluczowa zmiana Etapu 2. Wcześniej czas był jednym polem na zadaniu, więc
  przy dwóch osobach jedna zatrzymywała pomiar drugiej i czas przepadał.
  Tu każdy mierzy swój, a suma powstaje przy odczycie.
*/
create table if not exists public.time_entries (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id      text not null references public.tasks (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  started_at   timestamptz not null,
  ended_at     timestamptz
);

create index if not exists time_entries_task_idx on public.time_entries (task_id);

-- Jedna osoba nie może mieć dwóch pomiarów naraz na tym samym zadaniu.
create unique index if not exists time_entries_one_open_per_user
  on public.time_entries (task_id, user_id)
  where ended_at is null;

/* ---------------------------------------------------------------------- */
/*  RLS                                                                     */
/* ---------------------------------------------------------------------- */

alter table public.workspaces     enable row level security;
alter table public.memberships    enable row level security;
alter table public.members        enable row level security;
alter table public.templates      enable row level security;
alter table public.projects       enable row level security;
alter table public.phases         enable row level security;
alter table public.phase_criteria enable row level security;
alter table public.sprints        enable row level security;
alter table public.tasks          enable row level security;
alter table public.task_links     enable row level security;
alter table public.comments       enable row level security;
alter table public.time_entries   enable row level security;

drop policy if exists "workspace widoczny dla czlonkow" on public.workspaces;
create policy "workspace widoczny dla czlonkow" on public.workspaces
  for select using (public.is_member(id));

drop policy if exists "workspace zaklada zalogowany" on public.workspaces;
create policy "workspace zaklada zalogowany" on public.workspaces
  for insert with check (auth.uid() = created_by);

drop policy if exists "workspace edytuje owner" on public.workspaces;
create policy "workspace edytuje owner" on public.workspaces
  for update using (public.has_role(id, array['owner']));

drop policy if exists "czlonkostwa widoczne" on public.memberships;
create policy "czlonkostwa widoczne" on public.memberships
  for select using (user_id = auth.uid() or public.is_member(workspace_id));

drop policy if exists "czlonkostwa zarzadza owner" on public.memberships;
create policy "czlonkostwa zarzadza owner" on public.memberships
  for all
  using (public.has_role(workspace_id, array['owner']) or user_id = auth.uid())
  with check (public.has_role(workspace_id, array['owner']) or user_id = auth.uid());

/*
  Reszta tabel dzieli ten sam wzorzec: czytają wszyscy członkowie, piszą
  wszyscy poza rolą viewer. Generujemy polityki pętlą, żeby nie powielać
  dwunastu razy tego samego i nie rozjechać ich przy zmianie zasady.
*/
do $$
declare
  t text;
begin
  foreach t in array array[
    'members', 'templates', 'projects', 'phases', 'phase_criteria',
    'sprints', 'tasks', 'task_links', 'comments', 'time_entries'
  ]
  loop
    execute format('drop policy if exists "odczyt czlonkow" on public.%I', t);
    execute format(
      'create policy "odczyt czlonkow" on public.%I for select using (public.is_member(workspace_id))', t
    );

    execute format('drop policy if exists "zapis zespolu" on public.%I', t);
    execute format(
      'create policy "zapis zespolu" on public.%I for all
         using (public.has_role(workspace_id, array[''owner'',''manager'',''member'']))
         with check (public.has_role(workspace_id, array[''owner'',''manager'',''member'']))', t
    );
  end loop;
end $$;

-- Własny czas pracy: nikt nie zapisuje ani nie kasuje cudzych pomiarów.
drop policy if exists "zapis zespolu" on public.time_entries;
drop policy if exists "wlasny czas" on public.time_entries;
create policy "wlasny czas" on public.time_entries
  for all
  using (user_id = auth.uid() and public.is_member(workspace_id))
  with check (user_id = auth.uid() and public.is_member(workspace_id));

/* ---------------------------------------------------------------------- */
/*  Bramki po stronie serwera                                              */
/* ---------------------------------------------------------------------- */

/*
  Domknięcie fazy.

  W trybie jednoosobowym warunek bramki pilnował reducer. Przy zespole klient
  przestaje być wiarygodny: wystarczy jedna nieodświeżona karta przeglądarki,
  żeby domknąć fazę, której bramka właśnie przestała być spełniona. Dlatego
  warunek sprawdzany jest tutaj, w transakcji, na aktualnych danych.
*/
create or replace function public.close_phase(p_phase text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ws        uuid;
  v_open_tasks int;
  v_open_crit  int;
begin
  select workspace_id into v_ws from public.phases where id = p_phase for update;
  if v_ws is null then
    raise exception 'Faza nie istnieje.';
  end if;
  if not public.has_role(v_ws, array['owner', 'manager']) then
    raise exception 'Domykanie faz wymaga roli manager lub owner.';
  end if;

  select count(*) into v_open_tasks
    from public.tasks where phase_id = p_phase and status <> 'done';

  select count(*) into v_open_crit
    from public.phase_criteria where phase_id = p_phase and checked = false;

  if v_open_tasks > 0 or v_open_crit > 0 then
    return jsonb_build_object(
      'ok', false,
      'open_tasks', v_open_tasks,
      'open_criteria', v_open_crit
    );
  end if;

  update public.phases
     set completed_at = now(), completed_by = auth.uid(), updated_at = now()
   where id = p_phase;

  return jsonb_build_object('ok', true);
end;
$$;

/*
  Domknięcie sprintu: niedowiezione zadania wracają do backlogu, żeby nie
  ciągnęły się w zamkniętym sprincie i nie zawyżały velocity.
*/
create or replace function public.close_sprint(p_sprint text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ws uuid;
  v_moved int;
begin
  select workspace_id into v_ws from public.sprints where id = p_sprint for update;
  if v_ws is null then
    raise exception 'Sprint nie istnieje.';
  end if;
  if not public.has_role(v_ws, array['owner', 'manager']) then
    raise exception 'Domykanie sprintów wymaga roli manager lub owner.';
  end if;

  update public.tasks
     set sprint_id = null, updated_at = now()
   where sprint_id = p_sprint and status <> 'done';
  get diagnostics v_moved = row_count;

  update public.sprints
     set status = 'closed', closed_at = now(), updated_at = now()
   where id = p_sprint;

  return jsonb_build_object('ok', true, 'moved_to_backlog', v_moved);
end;
$$;

revoke all on function public.close_phase(text)  from public;
revoke all on function public.close_sprint(text) from public;
grant execute on function public.close_phase(text)  to authenticated;
grant execute on function public.close_sprint(text) to authenticated;

/*
  Założenie przestrzeni razem z członkostwem właściciela.

  Osobne insert-y wymagałyby, żeby polityka na workspaces przepuszczała
  odczyt przed powstaniem członkostwa. Jedna funkcja rozwiązuje to czysto.
*/
create or replace function public.create_workspace(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Brak uwierzytelnienia.';
  end if;

  insert into public.workspaces (name, created_by)
  values (p_name, auth.uid())
  returning id into v_id;

  insert into public.memberships (workspace_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  return v_id;
end;
$$;

revoke all on function public.create_workspace(text) from public;
grant execute on function public.create_workspace(text) to authenticated;

/* ---------------------------------------------------------------------- */
/*  Realtime                                                                */
/* ---------------------------------------------------------------------- */

do $$
declare
  t text;
begin
  foreach t in array array[
    'members', 'templates', 'projects', 'phases', 'phase_criteria',
    'sprints', 'tasks', 'task_links', 'comments', 'time_entries'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;  -- już w publikacji
    end;
  end loop;
end $$;
