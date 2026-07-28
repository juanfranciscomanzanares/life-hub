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

-- ------------------------------------------------------------
--  La marca de tiempo la pone SIEMPRE el servidor.
--
--  Antes la enviaba el cliente con new Date().toISOString(). Como los
--  conflictos se resuelven con "gana la marca mayor", bastaba con que el reloj
--  del móvil fuera unos minutos adelantado para que el móvil ganara siempre,
--  aunque su cambio fuera más antiguo. Con un solo dispositivo daba igual; con
--  dos, es pérdida de datos silenciosa.
-- ------------------------------------------------------------
create or replace function public.app_state_marcar_hora()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_state_hora on public.app_state;
create trigger app_state_hora
  before insert or update on public.app_state
  for each row execute function public.app_state_marcar_hora();

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
--
--  Va dentro de un IF porque "alter publication ... add table" falla con
--  "relation is already member of publication" si ya está añadida, y este
--  script está pensado para poder ejecutarse tantas veces como haga falta.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_state'
  ) then
    alter publication supabase_realtime add table public.app_state;
  end if;
end
$$;

-- ============================================================
--  Almacenamiento para Adjuntos (fotos, apuntes)
--  Bucket PRIVADO: cada usuario solo ve y gestiona sus propios archivos.
--
--  Antes el bucket era público y la política de lectura no comprobaba el dueño,
--  así que cualquiera con el enlace podía abrir un adjunto sin estar
--  autenticado, y cualquier usuario registrado podía leer los de los demás.
--  La app ahora pide URLs firmadas temporales en lugar de URLs públicas.
--
--  El "do update" es importante: si ya creaste el bucket público, esto lo
--  vuelve privado. Con "do nothing" se habría quedado como estaba.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('adjuntos', 'adjuntos', false)
on conflict (id) do update set public = false;

drop policy if exists "adjuntos subir" on storage.objects;
create policy "adjuntos subir" on storage.objects
  for insert with check (bucket_id = 'adjuntos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "adjuntos ver" on storage.objects;
create policy "adjuntos ver" on storage.objects
  for select using (bucket_id = 'adjuntos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "adjuntos borrar" on storage.objects;
create policy "adjuntos borrar" on storage.objects
  for delete using (bucket_id = 'adjuntos' and auth.uid()::text = (storage.foldername(name))[1]);
