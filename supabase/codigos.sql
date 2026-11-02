-- Mi Oficina: códigos de acceso y panel del dueño.
-- Pégalo entero en Supabase > SQL Editor y pulsa "Run". Se puede ejecutar más de una vez.
--
-- Qué hace:
--  * Nadie puede crear una cuenta sin un código de acceso válido. Cada código sirve UNA sola vez.
--    La comprobación la hace la base de datos, así que no se puede saltar desde el navegador.
--  * El dueño (tú) ve en el programa una sección "Control" para crear códigos, ver quién usó cada uno,
--    ver todas las cuentas y bloquear o desbloquear a quien quieras.
--
-- Después de ejecutarlo, hazte dueño con esta línea (cambia el email por el tuyo) en el SQL Editor:
--   insert into public.app_admins(user_id) select id from auth.users where email = 'TU_EMAIL' on conflict do nothing;

-- ---------- tablas ----------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_admins enable row level security;

create table if not exists public.invite_codes (
  code       text primary key,
  nota       text,                       -- para quién es (nombre, teléfono...)
  created_at timestamptz not null default now(),
  used_by    uuid references auth.users(id) on delete set null,
  used_email text,
  used_at    timestamptz,
  revoked    boolean not null default false
);
alter table public.invite_codes enable row level security;

create table if not exists public.app_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  code       text,
  blocked    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.app_users enable row level security;
drop policy if exists "ver mi estado" on public.app_users;
create policy "ver mi estado" on public.app_users for select using (user_id = auth.uid());

-- Las cuentas que ya existían quedan registradas sin código: tendrán que poner uno al entrar (menos el dueño).
insert into public.app_users(user_id, email, created_at)
select id, email, created_at from auth.users on conflict do nothing;

-- ---------- funciones de ayuda ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from app_admins where user_id = auth.uid())
$$;

create or replace function public.is_blocked() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select blocked from app_users where user_id = auth.uid()), false)
$$;

-- ---------- el código se exige al crear la cuenta ----------
create or replace function public.require_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare c text := upper(trim(coalesce(new.raw_user_meta_data->>'invite', '')));
begin
  if c = '' then raise exception 'INVITE_REQUIRED: Hace falta un código de acceso'; end if;
  update invite_codes set used_by = new.id, used_email = new.email, used_at = now()
   where code = c and used_by is null and not revoked;
  if not found then raise exception 'INVITE_INVALID: El código no es válido o ya se ha usado'; end if;
  insert into app_users(user_id, email, code) values (new.id, new.email, c) on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists require_invite on auth.users;
create trigger require_invite after insert on auth.users for each row execute function public.require_invite();

-- Para avisar en la pantalla de alta antes de intentarlo (no revela nada más que sí/no).
create or replace function public.check_invite(p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from invite_codes where code = upper(trim(p_code)) and used_by is null and not revoked)
$$;
grant execute on function public.check_invite(text) to anon, authenticated;

-- ---------- una cuenta bloqueada no puede leer ni guardar datos ----------
-- Acceso: el dueño siempre; los demás solo si no están bloqueados y han puesto un código.
-- Las cuentas que ya existían sin código tienen que poner uno al entrar (función redeem_invite).
create or replace function public.has_access() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists(select 1 from app_users where user_id = auth.uid() and not blocked and code is not null)
$$;

create or replace function public.needs_code() returns boolean
language sql stable security definer set search_path = public as $$
  select not is_admin() and not exists(select 1 from app_users where user_id = auth.uid() and code is not null)
$$;

create or replace function public.redeem_invite(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare c text := upper(trim(coalesce(p_code, ''))); em text;
begin
  if auth.uid() is null then return false; end if;
  if exists(select 1 from app_users where user_id = auth.uid() and code is not null) then return true; end if;
  select email into em from auth.users where id = auth.uid();
  update invite_codes set used_by = auth.uid(), used_email = em, used_at = now()
   where code = c and used_by is null and not revoked;
  if not found then return false; end if;
  insert into app_users(user_id, email, code) values (auth.uid(), em, c)
  on conflict (user_id) do update set code = excluded.code;
  return true;
end $$;

drop policy if exists "cada usuario sus datos" on public.docs;
create policy "cada usuario sus datos" on public.docs
  for all using (user_id = auth.uid() and public.has_access())
  with check (user_id = auth.uid() and public.has_access());

-- ---------- funciones del panel del dueño ----------
create or replace function public.admin_create_codes(p_n int, p_nota text default null)
returns setof public.invite_codes language plpgsql security definer set search_path = public as $$
declare i int; c text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if not is_admin() then raise exception 'Solo el dueño'; end if;
  for i in 1..greatest(1, least(coalesce(p_n, 1), 50)) loop
    loop
      c := 'MO-';
      for j in 1..4 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
      c := c || '-';
      for j in 1..4 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
      exit when not exists(select 1 from invite_codes where code = c);
    end loop;
    insert into invite_codes(code, nota) values (c, nullif(trim(p_nota), ''));
    return query select * from invite_codes where code = c;
  end loop;
end $$;

create or replace function public.admin_list_codes()
returns setof public.invite_codes language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo el dueño'; end if;
  return query select * from invite_codes order by created_at desc;
end $$;

create or replace function public.admin_revoke_code(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo el dueño'; end if;
  update invite_codes set revoked = true where code = p_code and used_by is null;
end $$;

create or replace function public.admin_list_users()
returns table(user_id uuid, email text, empresa text, oficio text, pais text, code text, blocked boolean,
              created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean, docs bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then raise exception 'Solo el dueño'; end if;
  return query
  select u.id, u.email::text,
         (select d.data->>'nombre' from public.docs d where d.user_id = u.id and d.coll = 'ajustes' and d.id = 'negocio'),
         (select d.data->>'oficio' from public.docs d where d.user_id = u.id and d.coll = 'ajustes' and d.id = 'negocio'),
         (select d.data->>'pais'   from public.docs d where d.user_id = u.id and d.coll = 'ajustes' and d.id = 'negocio'),
         a.code, coalesce(a.blocked, false), u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
         (select count(*) from public.docs d where d.user_id = u.id)
  from auth.users u left join public.app_users a on a.user_id = u.id
  order by u.created_at desc;
end $$;

create or replace function public.admin_set_blocked(p_user uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo el dueño'; end if;
  if p_user = auth.uid() then raise exception 'No puedes bloquearte a ti mismo'; end if;
  insert into app_users(user_id, blocked) values (p_user, p_blocked)
  on conflict (user_id) do update set blocked = excluded.blocked;
end $$;

revoke all on function public.admin_create_codes(int, text), public.admin_list_codes(), public.admin_revoke_code(text),
  public.admin_list_users(), public.admin_set_blocked(uuid, boolean) from public, anon;
grant execute on function public.admin_create_codes(int, text), public.admin_list_codes(), public.admin_revoke_code(text),
  public.admin_list_users(), public.admin_set_blocked(uuid, boolean), public.is_admin(), public.is_blocked(), public.has_access(), public.needs_code(), public.redeem_invite(text) to authenticated;
