-- Zaproszenia do przestrzeni zespołu.
--
-- Uruchom w Supabase → SQL Editor PO migracji 0002. Idempotentne.
--
-- Aplikacja jest frontendem bez własnego backendu, więc nie wysyła maili —
-- do tego potrzebny byłby klucz service_role, który nie może trafić do
-- przeglądarki. Zamiast tego generujemy link, a zapraszający przekazuje go
-- sam. Zaproszenie jest więc sekretem samym w sobie i stąd ostrożność niżej:
-- token losowy, termin ważności i wymóg zgodności adresu e-mail.

create table if not exists public.invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        text not null,
  role         text not null default 'member'
    check (role in ('manager', 'member', 'viewer')),
  token        text not null unique,
  invited_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users (id) on delete set null,
  revoked_at   timestamptz
);

create index if not exists invitations_workspace_idx on public.invitations (workspace_id);
create index if not exists invitations_token_idx on public.invitations (token);

comment on table public.invitations is
  'Zaproszenia do przestrzeni. Token jest sekretem przekazywanym linkiem.';
comment on column public.invitations.role is
  'Rola owner celowo niedostępna — właściciela nadaje się wyłącznie ręcznie.';

alter table public.invitations enable row level security;

-- Podgląd zaproszeń mają członkowie przestrzeni. Zapraszany jeszcze nim nie
-- jest, więc jego ścieżka prowadzi przez funkcję security definer niżej.
drop policy if exists "zaproszenia widoczne dla czlonkow" on public.invitations;
create policy "zaproszenia widoczne dla czlonkow" on public.invitations
  for select using (public.is_member(workspace_id));

drop policy if exists "zaproszenia zarzadzane przez kierownictwo" on public.invitations;
create policy "zaproszenia zarzadzane przez kierownictwo" on public.invitations
  for all
  using (public.has_role(workspace_id, array['owner', 'manager']))
  with check (public.has_role(workspace_id, array['owner', 'manager']));

/*
  Utworzenie zaproszenia.

  Zwraca token, z którego klient składa link. Token generujemy z 24 losowych
  bajtów — zgadywanie odpada, a przy okazji unikamy znaków, które psują się
  w adresach URL.
*/
create or replace function public.create_invitation(
  p_workspace uuid,
  p_email     text,
  p_role      text default 'member'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_token text;
  v_email text;
  v_id    uuid;
begin
  if not public.has_role(p_workspace, array['owner', 'manager']) then
    raise exception 'Zapraszanie wymaga roli manager lub owner.';
  end if;

  if p_role not in ('manager', 'member', 'viewer') then
    raise exception 'Nieznana rola: %', p_role;
  end if;

  -- Manager nie może wynieść kogoś do swojego poziomu; to droga do obejścia
  -- ograniczeń, których sam podlega.
  if p_role = 'manager' and not public.has_role(p_workspace, array['owner']) then
    raise exception 'Tylko właściciel może zapraszać w roli manager.';
  end if;

  v_email := lower(trim(p_email));
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Niepoprawny adres e-mail.';
  end if;

  -- Powtórne zaproszenie tego samego adresu zastępuje poprzednie, zamiast
  -- mnożyć ważne linki do tej samej przestrzeni.
  update public.invitations
     set revoked_at = now()
   where workspace_id = p_workspace
     and lower(email) = v_email
     and accepted_at is null
     and revoked_at is null;

  v_token := replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_');
  v_token := replace(v_token, '=', '');

  insert into public.invitations (workspace_id, email, role, token, invited_by)
  values (p_workspace, v_email, p_role, v_token, auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'email', v_email, 'role', p_role);
end;
$$;

/*
  Podgląd zaproszenia przed przyjęciem.

  Zapraszany nie jest jeszcze członkiem, więc nie zobaczy nazwy przestrzeni
  przez RLS. Ta funkcja pokazuje mu wyłącznie to, co potrzebne do decyzji, i nie
  ujawnia niczego o zawartości przestrzeni.
*/
create or replace function public.peek_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv  public.invitations;
  v_name text;
begin
  select * into v_inv from public.invitations where token = p_token;

  if v_inv.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_inv.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_inv.accepted_at is not null then
    return jsonb_build_object('status', 'already_accepted');
  end if;
  if v_inv.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select name into v_name from public.workspaces where id = v_inv.workspace_id;

  return jsonb_build_object(
    'status',     'valid',
    'workspace',  v_name,
    'email',      v_inv.email,
    'role',       v_inv.role,
    'expires_at', v_inv.expires_at
  );
end;
$$;

/*
  Przyjęcie zaproszenia.

  security definer, bo zapraszany nie ma jeszcze prawa czytać ani tabeli
  zaproszeń, ani przestrzeni.

  Adres musi się zgadzać z tym, na który wystawiono zaproszenie. Bez tego
  przechwycony link wpuszczałby dowolną osobę — a link wędruje pocztą, czatem
  i bywa przeklejany w przypadkowe miejsca.
*/
create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv        public.invitations;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'Trzeba być zalogowanym, żeby przyjąć zaproszenie.';
  end if;

  select * into v_inv from public.invitations where token = p_token for update;

  if v_inv.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_inv.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_inv.accepted_at is not null then
    return jsonb_build_object('status', 'already_accepted');
  end if;
  if v_inv.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  v_user_email := lower(auth.jwt() ->> 'email');
  if v_user_email is distinct from lower(v_inv.email) then
    return jsonb_build_object(
      'status', 'email_mismatch',
      'expected', v_inv.email
    );
  end if;

  -- Ktoś już należący do przestrzeni nie traci przez zaproszenie swojej roli.
  if exists (
    select 1 from public.memberships
     where workspace_id = v_inv.workspace_id and user_id = auth.uid()
  ) then
    update public.invitations
       set accepted_at = now(), accepted_by = auth.uid()
     where id = v_inv.id;
    return jsonb_build_object('status', 'already_member', 'workspace_id', v_inv.workspace_id);
  end if;

  insert into public.memberships (workspace_id, user_id, role)
  values (v_inv.workspace_id, auth.uid(), v_inv.role);

  update public.invitations
     set accepted_at = now(), accepted_by = auth.uid()
   where id = v_inv.id;

  return jsonb_build_object(
    'status',       'accepted',
    'workspace_id', v_inv.workspace_id,
    'role',         v_inv.role
  );
end;
$$;

create or replace function public.revoke_invitation(p_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.invitations where id = p_id;
  if v_ws is null then
    return false;
  end if;
  if not public.has_role(v_ws, array['owner', 'manager']) then
    raise exception 'Cofanie zaproszeń wymaga roli manager lub owner.';
  end if;

  update public.invitations set revoked_at = now() where id = p_id and accepted_at is null;
  return true;
end;
$$;

/*
  Usunięcie osoby z przestrzeni.

  Właściciel nie może zostać usunięty ani odejść, jeśli jest jedyny — przestrzeń
  bez właściciela nie miałaby kto nią zarządzać.
*/
create or replace function public.remove_member(p_workspace uuid, p_user uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role     text;
  v_owners   int;
begin
  if not public.has_role(p_workspace, array['owner']) and p_user <> auth.uid() then
    raise exception 'Usuwanie innych osób wymaga roli owner.';
  end if;

  select role into v_role from public.memberships
   where workspace_id = p_workspace and user_id = p_user;
  if v_role is null then
    return false;
  end if;

  if v_role = 'owner' then
    select count(*) into v_owners from public.memberships
     where workspace_id = p_workspace and role = 'owner';
    if v_owners <= 1 then
      raise exception 'To jedyny właściciel przestrzeni — najpierw wyznacz innego.';
    end if;
  end if;

  delete from public.memberships
   where workspace_id = p_workspace and user_id = p_user;
  return true;
end;
$$;

revoke all on function public.create_invitation(uuid, text, text) from public;
revoke all on function public.peek_invitation(text)               from public;
revoke all on function public.accept_invitation(text)             from public;
revoke all on function public.revoke_invitation(uuid)             from public;
revoke all on function public.remove_member(uuid, uuid)           from public;

grant execute on function public.create_invitation(uuid, text, text) to authenticated;
grant execute on function public.peek_invitation(text)               to authenticated;
grant execute on function public.accept_invitation(text)             to authenticated;
grant execute on function public.revoke_invitation(uuid)             to authenticated;
grant execute on function public.remove_member(uuid, uuid)           to authenticated;

/*
  Widok składu zespołu.

  memberships trzyma wyłącznie identyfikatory, a adresy siedzą w auth.users,
  do której klient nie ma i nie powinien mieć dostępu. Ten widok wystawia
  tylko to, co potrzebne, i wyłącznie w obrębie własnych przestrzeni.
*/
create or replace view public.workspace_members
with (security_invoker = true) as
  select m.workspace_id, m.user_id, m.role, m.created_at, u.email
    from public.memberships m
    join auth.users u on u.id = m.user_id
   where public.is_member(m.workspace_id);

grant select on public.workspace_members to authenticated;
