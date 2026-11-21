-- Supabase > SQL Editor'e yapıştırıp bir kez çalıştır.

-- Tüm kayıtlar (lastikler, satışlar, randevular) tek tabloda tutulur.
create table if not exists public.records (
  coll text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (coll, id)
);

-- Uygulamayı kullanmasına izin verilen e-postalar.
create table if not exists public.allowed_users (
  email text primary key
);

alter table public.records enable row level security;
alter table public.allowed_users enable row level security; -- politika yok: dışarıdan kimse okuyamaz

create or replace function public.is_allowed()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

drop policy if exists "izinli okur" on public.records;
drop policy if exists "izinli ekler" on public.records;
drop policy if exists "izinli gunceller" on public.records;
drop policy if exists "izinli siler" on public.records;

create policy "izinli okur" on public.records for select to authenticated using (public.is_allowed());
create policy "izinli ekler" on public.records for insert to authenticated with check (public.is_allowed());
create policy "izinli gunceller" on public.records for update to authenticated using (public.is_allowed()) with check (public.is_allowed());
create policy "izinli siler" on public.records for delete to authenticated using (public.is_allowed());

-- İzinli kişiler. E-postaları kendinle Berat'ın gerçek adresleriyle değiştir.
insert into public.allowed_users (email) values
  ('brkygms099@gmail.com'),
  ('beratyilmaz607@gmail.com')
on conflict do nothing;

-- Canlı güncelleme: bir cihazda yapılan değişiklik diğerinde anında görünsün.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;
