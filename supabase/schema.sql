-- Mi Oficina IA: base de datos. Pégalo entero en Supabase > SQL Editor y pulsa "Run".
-- Cada usuario solo puede ver y tocar sus propias filas (Row Level Security).

-- Todos los datos del programa (clientes, agenda, presupuestos, facturas, gastos...)
create table if not exists public.docs (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  coll       text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, coll, id)
);
alter table public.docs enable row level security;
drop policy if exists "cada usuario sus datos" on public.docs;
create policy "cada usuario sus datos" on public.docs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Cambios en vivo entre el móvil y el ordenador
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- Consumo de IA por usuario y día (solo lo usa la función del servidor)
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  n       int  not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;

create or replace function public.bump_ai_usage(p_user uuid, p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare cur int;
begin
  insert into ai_usage(user_id, day, n) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set n = ai_usage.n + 1
  returning n into cur;
  return cur <= p_limit;
end $$;
revoke all on function public.bump_ai_usage(uuid, int) from public, anon, authenticated;

-- Fotos de tickets y facturas (privadas, una carpeta por usuario)
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false)
on conflict (id) do nothing;
drop policy if exists "fotos propias leer" on storage.objects;
drop policy if exists "fotos propias subir" on storage.objects;
drop policy if exists "fotos propias borrar" on storage.objects;
create policy "fotos propias leer" on storage.objects for select
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos propias subir" on storage.objects for insert
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos propias borrar" on storage.objects for delete
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Suscripciones de pago (las escribe solo el webhook de Stripe)
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  status                 text,          -- trialing, active, past_due, canceled...
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "ver mi suscripcion" on public.subscriptions;
create policy "ver mi suscripcion" on public.subscriptions for select using (user_id = auth.uid());
