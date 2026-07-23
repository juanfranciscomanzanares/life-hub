-- ============================================================
--  Life Hub · Esquema de base de datos para Supabase
--  Cópialo y pégalo en:  Supabase > SQL Editor > New query > Run
-- ============================================================

-- Tabla única tipo "documento": cada sección guarda su estado en JSON.
-- La analítica mensual se calcula en el cliente a partir de estos datos.
create table if not exists public.app_state (
  user_id    uuid    not null references auth.users (id) on delete cascade,
  key        text    not null,
  value      jsonb   not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Seguridad a nivel de fila: cada usuario solo ve y edita SUS datos.
alter table public.app_state enable row level security;

drop policy if exists "own rows select" on public.app_state;
create policy "own rows select" on public.app_state
  for select using (auth.uid() = user_id);

drop policy if exists "own rows insert" on public.app_state;
create policy "own rows insert" on public.app_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "own rows update" on public.app_state;
create policy "own rows update" on public.app_state
  for update using (auth.uid() = user_id);

drop policy if exists "own rows delete" on public.app_state;
create policy "own rows delete" on public.app_state
  for delete using (auth.uid() = user_id);

-- ============================================================
--  Sincronización en tiempo real (Supabase Realtime)
--  Permite que los cambios aparezcan al instante en todos tus dispositivos.
-- ============================================================
alter publication supabase_realtime add table public.app_state;

-- ============================================================
--  Almacenamiento para Adjuntos (fotos, apuntes)
--  Crea el bucket y las políticas para que cada usuario gestione lo suyo.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('adjuntos', 'adjuntos', true)
on conflict (id) do nothing;

drop policy if exists "adjuntos subir" on storage.objects;
create policy "adjuntos subir" on storage.objects
  for insert with check (bucket_id = 'adjuntos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "adjuntos ver" on storage.objects;
create policy "adjuntos ver" on storage.objects
  for select using (bucket_id = 'adjuntos');

drop policy if exists "adjuntos borrar" on storage.objects;
create policy "adjuntos borrar" on storage.objects
  for delete using (bucket_id = 'adjuntos' and auth.uid()::text = (storage.foldername(name))[1]);
