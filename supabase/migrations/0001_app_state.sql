-- Etap 1 synchronizacji: stan aplikacji w chmurze, jeden wiersz na użytkownika.
--
-- Uruchom w Supabase → SQL Editor. Idempotentne, można puścić ponownie.
--
-- Etap 2 (rozbicie na tabele encji i praca zespołowa na wspólnym projekcie)
-- opisany jest w docs/synchronizacja-online.md i będzie osobną migracją.

create table if not exists public.app_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb       not null,
  revision   bigint      not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.app_state is
  'Stan aplikacji projekty.dev — jeden wiersz na użytkownika (Etap 1).';
comment on column public.app_state.revision is
  'Licznik zmian z klienta. Podstawa blokady optymistycznej przy zapisie.';

-- Bez RLS każdy zalogowany widziałby cudze dane.
alter table public.app_state enable row level security;

drop policy if exists "wlasny odczyt"  on public.app_state;
drop policy if exists "wlasny zapis"   on public.app_state;
drop policy if exists "wlasna zmiana"  on public.app_state;
drop policy if exists "wlasne usuniecie" on public.app_state;

create policy "wlasny odczyt" on public.app_state
  for select using (auth.uid() = user_id);

create policy "wlasny zapis" on public.app_state
  for insert with check (auth.uid() = user_id);

create policy "wlasna zmiana" on public.app_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "wlasne usuniecie" on public.app_state
  for delete using (auth.uid() = user_id);

/*
  Zapis z blokadą optymistyczną.

  Zwraca false, gdy w bazie jest inna rewizja niż ta, którą klient widział
  ostatnio — czyli gdy zapisało inne urządzenie. Klient nie nadpisuje wtedy
  w ciemno, tylko pyta użytkownika, która wersja jest właściwa.

  Warunek sprawdzany jest w bazie, a nie w kliencie: przestarzała karta
  przeglądarki nie może przepchnąć starego stanu.
*/
create or replace function public.save_app_state(
  p_state             jsonb,
  p_revision          bigint,
  p_expected_revision bigint
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current bigint;
begin
  if auth.uid() is null then
    raise exception 'Brak uwierzytelnienia.';
  end if;

  select revision into v_current
    from public.app_state
   where user_id = auth.uid()
     for update;

  if v_current is null then
    insert into public.app_state (user_id, state, revision, updated_at)
    values (auth.uid(), p_state, p_revision, now());
    return true;
  end if;

  if v_current <> p_expected_revision then
    return false;
  end if;

  update public.app_state
     set state = p_state,
         revision = p_revision,
         updated_at = now()
   where user_id = auth.uid();

  return true;
end;
$$;

revoke all on function public.save_app_state(jsonb, bigint, bigint) from public;
grant execute on function public.save_app_state(jsonb, bigint, bigint) to authenticated;
