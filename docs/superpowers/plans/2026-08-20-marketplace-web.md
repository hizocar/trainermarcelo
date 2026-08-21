# Marketplace web (bolsa de solicitudes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un alumno publique en la web que busca entrenador sin crear cuenta, y que hasta tres coaches se postulen, vean su WhatsApp y le escriban.

**Architecture:** Todo vive en `web/`. El navegador solo tiene la `ANON_KEY`, así que la autorización real está en Postgres: las tablas nuevas quedan sin política de lectura y todo pasa por dos vistas (`open_requests`, `my_applications`) y cuatro funciones `security definer` (`create_request`, `apply_to_request`, `claim_request`, `approve_coach`). El teléfono del alumno no viaja al cliente hasta que la función confirma cupo y aprobación. La lógica pura vive en `web/src/lib/marketplace.ts` con Vitest.

**Tech Stack:** Next.js 15 (App Router, Server Components), React 19, Supabase (Postgres + RLS + Edge Functions), Vitest, TypeScript.

## Global Constraints

- **Solo se toca `web/` y `trainer-app/supabase_migration_v19.sql`.** Ningún archivo de `trainer-app/src`.
- **Tope de postulaciones: 3 por solicitud.** Se hace cumplir en SQL, nunca en React.
- **Ventana del coach no suscrito: 12 horas.** Suscrito = `subscription_status in ('active','trialing')` — los dos valores, igual que `trainer-app/src/navigation/index.tsx:184`.
- **Vigencia de una solicitud: 21 días** (`expires_at`), evaluada por comparación, sin proceso en background.
- **El WhatsApp normalizado es `+569XXXXXXXX`.** Se valida en TypeScript y **otra vez** en SQL.
- **Paleta:** solo las variables de `web/src/app/globals.css`. El ámbar `--warning` (`#c9a227`) se usa **únicamente** para una solicitud nueva con cupo. Ningún otro color.
- **Sin dependencias nuevas.** Nada de captcha de terceros, librerías de formularios ni proveedores de correo.
- **Textos en español de Chile**, sin tuteo formal ni signos de exclamación de apertura sobrantes.
- Los mensajes de error al coach nunca revelan el teléfono ni por qué fue rechazado.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `trainer-app/supabase_migration_v19.sql` | Tablas, columnas, vistas y funciones. Único lugar con SQL. |
| `web/src/lib/marketplace.ts` | Lógica pura: normalizar teléfono, ventana, cupos, slug, bloqueo del panel. Sin IO. |
| `web/src/lib/__tests__/marketplace.test.ts` | Sus tests. |
| `web/src/lib/guard.ts` | `requireCoach()` / `requireAdmin()`: sesión + redirecciones. Único lugar con IO de autorización. |
| `web/src/app/busco-coach/page.tsx` + `RequestForm.tsx` | Formulario público. |
| `web/src/app/marketplace/page.tsx` + `RequestList.tsx` | La bolsa y las postulaciones del coach. |
| `web/src/app/perfil/page.tsx` + `ProfileForm.tsx` | Edición del perfil público. |
| `web/src/app/coach/[slug]/page.tsx` | Perfil público del coach. |
| `web/src/app/admin/coaches/page.tsx` + `ApprovalList.tsx` | Cola de aprobación. |
| `web/src/app/signup/page.tsx` | Se modifica: una opción de plan más. |

---

### Task 1: Lógica pura del marketplace

**Files:**
- Create: `web/src/lib/marketplace.ts`
- Test: `web/src/lib/__tests__/marketplace.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `MAX_APPLICATIONS = 3`, `FREE_COACH_DELAY_HOURS = 12`, `REQUEST_TTL_DAYS = 21`, `SUBSCRIBED_STATUSES`, `normalizeWhatsapp(raw: string): string | null`, `isVisibleTo(createdAt: string | Date, subscriptionStatus: string | null | undefined, now?: Date): boolean`, `slotsLeft(applications: number): number`, `slugify(name: string): string`, `panelLocked(gym: GymState | null, now?: Date): boolean`, `type GymState = { subscription_status: string; free_month_ends_at: string | null }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `web/src/lib/__tests__/marketplace.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  normalizeWhatsapp, isVisibleTo, slotsLeft, slugify, panelLocked,
  MAX_APPLICATIONS,
} from '../marketplace';

describe('normalizeWhatsapp', () => {
  it('acepta las formas en que la gente escribe su número', () => {
    for (const raw of [
      '912345678', '9 1234 5678', '9.1234.5678', '(9) 1234-5678',
      '+56 9 1234 5678', '56912345678', '+56912345678',
    ]) {
      expect(normalizeWhatsapp(raw)).toBe('+56912345678');
    }
  });

  it('rechaza lo que no es un móvil chileno', () => {
    for (const raw of ['', '221234567', '12345678', '5691234567', '+5491123456789', 'hola']) {
      expect(normalizeWhatsapp(raw)).toBeNull();
    }
  });
});

describe('isVisibleTo', () => {
  const now = new Date('2026-08-20T12:00:00Z');
  const reciente = '2026-08-20T11:00:00Z';   // 1 hora
  const vieja = '2026-08-19T23:00:00Z';      // 13 horas

  it('el suscrito la ve apenas se publica', () => {
    expect(isVisibleTo(reciente, 'active', now)).toBe(true);
    expect(isVisibleTo(reciente, 'trialing', now)).toBe(true);
  });

  it('el que no paga espera 12 horas', () => {
    expect(isVisibleTo(reciente, 'marketplace', now)).toBe(false);
    expect(isVisibleTo(reciente, 'past_due', now)).toBe(false);
    expect(isVisibleTo(reciente, null, now)).toBe(false);
    expect(isVisibleTo(vieja, 'marketplace', now)).toBe(true);
  });

  it('el borde de las 12 horas exactas ya es visible', () => {
    expect(isVisibleTo('2026-08-20T00:00:00Z', 'marketplace', now)).toBe(true);
  });
});

describe('slotsLeft', () => {
  it('cuenta hacia abajo desde 3 y nunca baja de cero', () => {
    expect(slotsLeft(0)).toBe(MAX_APPLICATIONS);
    expect(slotsLeft(2)).toBe(1);
    expect(slotsLeft(3)).toBe(0);
    expect(slotsLeft(9)).toBe(0);
  });
});

describe('slugify', () => {
  it('saca tildes, ñ y espacios', () => {
    expect(slugify('Marcelo Herrera')).toBe('marcelo-herrera');
    expect(slugify('José Muñoz  Ñuñoa')).toBe('jose-munoz-nunoa');
    expect(slugify('  Ana   ')).toBe('ana');
    expect(slugify('Coach #1 / Fit')).toBe('coach-1-fit');
  });
});

describe('panelLocked', () => {
  const now = new Date('2026-08-20T12:00:00Z');

  it('bloquea al coach gratis que todavía no toma a nadie', () => {
    expect(panelLocked({ subscription_status: 'marketplace', free_month_ends_at: null }, now)).toBe(true);
  });

  it('abre el panel durante el mes de regalo', () => {
    expect(panelLocked({ subscription_status: 'active', free_month_ends_at: '2026-09-19T12:00:00Z' }, now)).toBe(false);
  });

  it('vuelve a bloquear cuando el mes de regalo venció', () => {
    expect(panelLocked({ subscription_status: 'active', free_month_ends_at: '2026-08-19T12:00:00Z' }, now)).toBe(true);
  });

  it('no toca a los coaches que pagan', () => {
    expect(panelLocked({ subscription_status: 'active', free_month_ends_at: null }, now)).toBe(false);
    expect(panelLocked({ subscription_status: 'past_due', free_month_ends_at: null }, now)).toBe(true);
    expect(panelLocked(null, now)).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd web && npx vitest run src/lib/__tests__/marketplace.test.ts`
Expected: FAIL — `Failed to resolve import "../marketplace"`.

- [ ] **Step 3: Escribir la implementación**

Crear `web/src/lib/marketplace.ts`:

```ts
// Lógica pura del marketplace. Nada de acá toca la red ni Supabase: los
// invariantes que de verdad protegen (cupo, ventana, aprobación) viven en SQL
// —ver trainer-app/supabase_migration_v19.sql— porque el navegador solo tiene
// la ANON_KEY. Lo de acá es para que la interfaz muestre lo mismo que la base
// va a decidir, no para decidirlo.

export const MAX_APPLICATIONS = 3;
export const FREE_COACH_DELAY_HOURS = 12;
export const REQUEST_TTL_DAYS = 21;

/** Los estados de gyms.subscription_status que cuentan como "al día".
 *  Misma lista blanca que trainer-app/src/navigation/index.tsx:184. */
export const SUBSCRIBED_STATUSES = ['active', 'trialing'] as const;

export type GymState = {
  subscription_status: string;
  free_month_ends_at: string | null;
};

/** Móvil chileno a formato canónico. Devuelve null si no lo es. */
export function normalizeWhatsapp(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  let local: string | null = null;
  if (digits.length === 9 && digits.startsWith('9')) local = digits;
  else if (digits.length === 11 && digits.startsWith('569')) local = digits.slice(2);
  return local ? `+56${local}` : null;
}

export function isVisibleTo(
  createdAt: string | Date,
  subscriptionStatus: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (SUBSCRIBED_STATUSES.includes(subscriptionStatus as never)) return true;
  const created = new Date(createdAt).getTime();
  return now.getTime() - created >= FREE_COACH_DELAY_HOURS * 3_600_000;
}

export function slotsLeft(applications: number): number {
  return Math.max(0, MAX_APPLICATIONS - applications);
}

export function slugify(name: string): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** ¿Se le cierra el panel a este gimnasio?
 *  El mes de regalo no lo apaga ningún proceso —no hay ninguno en el
 *  proyecto— sino esta comparación, igual que expires_at en las solicitudes. */
export function panelLocked(gym: GymState | null, now: Date = new Date()): boolean {
  if (!gym) return true;
  if (gym.free_month_ends_at && new Date(gym.free_month_ends_at) <= now) return true;
  return !SUBSCRIBED_STATUSES.includes(gym.subscription_status as never);
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd web && npm test`
Expected: PASS, incluidos los tests que ya existían (`clientStatus`, `weeks`, `exerciseHistory`).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/marketplace.ts web/src/lib/__tests__/marketplace.test.ts
git commit -m "feat(marketplace): lógica pura de teléfono, ventana, cupos y bloqueo"
```

---

### Task 2: Esquema, vistas y funciones en Postgres

Esta tarea es la que sostiene la privacidad del teléfono. **RLS en Postgres es por
fila, no por columna**: una política que deje leer `coach_requests` deja leer el
WhatsApp. Por eso las tablas quedan **sin política de lectura para nadie** y todo el
acceso pasa por vistas y funciones.

**Files:**
- Create: `trainer-app/supabase_migration_v19.sql`

**Interfaces:**
- Consumes: `public.users` (`id`, `role`, `gym_id`, `is_owner`, `avatar_url`), `public.gyms` (`id`, `subscription_status`, `plan_tier`, `coach_limit`).
- Produces, para las tareas siguientes:
  - vista `public.open_requests(id uuid, comuna text, modality text, goal text, availability text, created_at timestamptz, slots_left int, already_applied boolean)`
  - vista `public.my_applications(request_id uuid, name text, whatsapp text, comuna text, modality text, goal text, availability text, applied_at timestamptz, status text)`
  - `public.create_request(p_name text, p_whatsapp text, p_comuna text, p_modality text, p_goal text, p_availability text, p_trap text) returns uuid`
  - `public.apply_to_request(p_request_id uuid) returns text` (el WhatsApp)
  - `public.claim_request(p_request_id uuid) returns void`
  - `public.approve_coach(p_coach_id uuid, p_slug text) returns void`
  - `public.reject_coach(p_coach_id uuid) returns void`
  - vista `public.pending_coaches(id uuid, name text, email text, instagram text, created_at timestamptz)`

- [ ] **Step 1: Escribir la migración**

Crear `trainer-app/supabase_migration_v19.sql`:

```sql
-- v19 — Marketplace: bolsa de solicitudes de alumnos.
-- Diseño: docs/superpowers/specs/2026-08-20-marketplace-web-design.md
--
-- Regla que ordena todo este archivo: coach_requests guarda un teléfono de una
-- persona que no tiene cuenta y no aceptó ningún término más allá de publicar su
-- solicitud. RLS es por fila, así que la tabla NO tiene política de lectura: se
-- lee por la vista open_requests, que no incluye la columna, y el número sale
-- solo por apply_to_request() cuando ya hay postulación registrada.

-- ---------- Tablas ----------

create table if not exists public.coach_requests (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  whatsapp          text not null,
  comuna            text not null,
  modality          text not null check (modality in ('presencial','online','ambas')),
  goal              text not null,
  availability      text,
  status            text not null default 'open'
                    check (status in ('open','matched','closed','expired')),
  matched_coach_id  uuid references public.users(id),
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '21 days'
);

create index if not exists coach_requests_abiertas
  on public.coach_requests (status, created_at desc);
create index if not exists coach_requests_whatsapp
  on public.coach_requests (whatsapp);

create table if not exists public.request_applications (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.coach_requests(id) on delete cascade,
  coach_id    uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (request_id, coach_id)
);

alter table public.coach_requests     enable row level security;
alter table public.request_applications enable row level security;
-- A propósito sin políticas: ni select, ni insert, ni update para nadie con la
-- ANON_KEY. Todo entra por las funciones security definer de más abajo.

-- ---------- Columnas nuevas ----------

alter table public.users
  add column if not exists marketplace_status text
      check (marketplace_status in ('pending','approved','rejected')),
  add column if not exists is_platform_admin boolean not null default false,
  add column if not exists slug text unique,
  add column if not exists bio text,
  add column if not exists instagram text,
  add column if not exists specialties text[],
  add column if not exists comunas text[],
  add column if not exists modality text
      check (modality in ('presencial','online','ambas')),
  add column if not exists accepting_clients boolean not null default true;

-- marketplace_status nulo = coach que ya existía, que llegó pagando: aprobado.
-- Solo el registro gratis lo deja en 'pending'.

alter table public.gyms
  add column if not exists free_month_used    boolean not null default false,
  add column if not exists free_month_ends_at timestamptz;

-- ---------- Ayudantes ----------

create or replace function public.is_marketplace_coach(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where u.id = p_uid
      and u.role = 'coach'
      and (u.marketplace_status is null or u.marketplace_status = 'approved')
  );
$$;

create or replace function public.coach_sub_status(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select g.subscription_status
  from public.users u join public.gyms g on g.id = u.gym_id
  where u.id = p_uid;
$$;

-- ---------- Vistas ----------

-- Sin security_invoker: la vista necesita leer una tabla que no tiene política
-- de lectura para nadie. Eso significa que su WHERE *es* la autorización, no un
-- filtro de conveniencia — por eso comprueba acá mismo que el coach esté
-- aprobado, en vez de confiar en que quien la consulta ya lo estaba.
create or replace view public.open_requests
with (security_invoker = false) as
select
  r.id, r.comuna, r.modality, r.goal, r.availability, r.created_at,
  greatest(0, 3 - (select count(*) from public.request_applications a
                   where a.request_id = r.id))::int as slots_left,
  exists (select 1 from public.request_applications a
          where a.request_id = r.id and a.coach_id = auth.uid()) as already_applied
from public.coach_requests r
where r.status = 'open'
  and r.expires_at > now()
  and public.is_marketplace_coach(auth.uid())
  and (
    coalesce(public.coach_sub_status(auth.uid()), '') in ('active','trialing')
    or r.created_at <= now() - interval '12 hours'
  )
  and (
    (select count(*) from public.request_applications a where a.request_id = r.id) < 3
    or exists (select 1 from public.request_applications a
               where a.request_id = r.id and a.coach_id = auth.uid())
  );

grant select on public.open_requests to authenticated;

-- El coach necesita volver a ver el número después de postularse; guardarlo
-- duplicado en request_applications sería un segundo lugar donde vive un dato
-- personal. Se lee por join, acotado a sus propias postulaciones.
create or replace view public.my_applications
with (security_invoker = false) as
select
  r.id as request_id, r.name, r.whatsapp, r.comuna, r.modality, r.goal,
  r.availability, a.created_at as applied_at, r.status
from public.request_applications a
join public.coach_requests r on r.id = a.request_id
where a.coach_id = auth.uid();

grant select on public.my_applications to authenticated;

create or replace view public.pending_coaches
with (security_invoker = false) as
select u.id, u.name, u.email, u.instagram, u.created_at
from public.users u
where u.marketplace_status = 'pending'
  and exists (select 1 from public.users me
              where me.id = auth.uid() and me.is_platform_admin);

grant select on public.pending_coaches to authenticated;

-- ---------- Funciones ----------

create or replace function public.create_request(
  p_name text, p_whatsapp text, p_comuna text, p_modality text,
  p_goal text, p_availability text, p_trap text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_recientes int;
begin
  -- Honeypot: un campo que ningún humano ve. Si viene lleno, es un bot.
  if coalesce(p_trap, '') <> '' then
    raise exception 'solicitud inválida' using errcode = 'P0001';
  end if;

  -- El cliente ya normaliza, pero el cliente no es de fiar.
  if p_whatsapp !~ '^\+569[0-9]{8}$' then
    raise exception 'teléfono inválido' using errcode = 'P0001';
  end if;

  if length(trim(coalesce(p_name, ''))) < 2
     or length(trim(coalesce(p_comuna, ''))) < 2
     or length(trim(coalesce(p_goal, ''))) < 10 then
    raise exception 'solicitud incompleta' using errcode = 'P0001';
  end if;

  if length(p_goal) > 600 or length(coalesce(p_availability, '')) > 300 then
    raise exception 'texto demasiado largo' using errcode = 'P0001';
  end if;

  if p_modality not in ('presencial','online','ambas') then
    raise exception 'modalidad inválida' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.coach_requests r
             where r.whatsapp = p_whatsapp and r.status = 'open'
               and r.expires_at > now()) then
    raise exception 'ya tienes una solicitud abierta' using errcode = 'P0005';
  end if;

  select count(*) into v_recientes from public.coach_requests r
   where r.whatsapp = p_whatsapp and r.created_at > now() - interval '24 hours';
  if v_recientes >= 3 then
    raise exception 'demasiadas solicitudes' using errcode = 'P0006';
  end if;

  insert into public.coach_requests (name, whatsapp, comuna, modality, goal, availability)
  values (trim(p_name), p_whatsapp, trim(p_comuna), p_modality, trim(p_goal),
          nullif(trim(coalesce(p_availability, '')), ''))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_request(text,text,text,text,text,text,text)
  to anon, authenticated;

create or replace function public.apply_to_request(p_request_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_coach uuid := auth.uid();
  v_req   public.coach_requests%rowtype;
  v_count int;
begin
  if v_coach is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;

  if not public.is_marketplace_coach(v_coach) then
    raise exception 'coach no aprobado' using errcode = '42501';
  end if;

  -- for update serializa dos postulaciones simultáneas al mismo pedido: sin
  -- esto, dos coaches pueden contar 2 al mismo tiempo y quedar 4 postulados.
  select r.* into v_req from public.coach_requests r
   where r.id = p_request_id for update;

  if not found or v_req.status <> 'open' or v_req.expires_at <= now() then
    raise exception 'solicitud no disponible' using errcode = 'P0002';
  end if;

  if coalesce(public.coach_sub_status(v_coach), '') not in ('active','trialing')
     and v_req.created_at > now() - interval '12 hours' then
    raise exception 'solicitud no disponible' using errcode = 'P0003';
  end if;

  select count(*) into v_count from public.request_applications a
   where a.request_id = p_request_id;

  if v_count >= 3 and not exists (
       select 1 from public.request_applications a
        where a.request_id = p_request_id and a.coach_id = v_coach) then
    raise exception 'sin cupo' using errcode = 'P0004';
  end if;

  insert into public.request_applications (request_id, coach_id)
  values (p_request_id, v_coach)
  on conflict (request_id, coach_id) do nothing;

  return v_req.whatsapp;
end;
$$;

grant execute on function public.apply_to_request(uuid) to authenticated;

create or replace function public.claim_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_coach uuid := auth.uid();
  v_gym   uuid;
begin
  if not exists (select 1 from public.request_applications a
                 where a.request_id = p_request_id and a.coach_id = v_coach) then
    raise exception 'no te postulaste a esta solicitud' using errcode = '42501';
  end if;

  update public.coach_requests
     set status = 'matched', matched_coach_id = v_coach
   where id = p_request_id and status = 'open';

  if not found then
    raise exception 'solicitud no disponible' using errcode = 'P0002';
  end if;

  select u.gym_id into v_gym from public.users u where u.id = v_coach;

  -- El mes de regalo: una sola vez por gimnasio, no por alumno.
  update public.gyms
     set free_month_used = true,
         subscription_status = 'active',
         free_month_ends_at = now() + interval '1 month'
   where id = v_gym and free_month_used = false;
end;
$$;

grant execute on function public.claim_request(uuid) to authenticated;

create or replace function public.approve_coach(p_coach_id uuid, p_slug text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_slug text := p_slug;
  v_n int := 1;
begin
  if not exists (select 1 from public.users me
                 where me.id = auth.uid() and me.is_platform_admin) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;

  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug inválido' using errcode = 'P0001';
  end if;

  -- El unique de la columna es quien decide; esto solo busca el primer sufijo
  -- libre. Dos aprobaciones simultáneas con el mismo nombre: una falla y se
  -- reintenta, en vez de quedar las dos con el mismo slug.
  while exists (select 1 from public.users u
                where u.slug = v_slug and u.id <> p_coach_id) loop
    v_n := v_n + 1;
    v_slug := p_slug || '-' || v_n;
  end loop;

  update public.users
     set marketplace_status = 'approved', slug = v_slug
   where id = p_coach_id and role = 'coach';
end;
$$;

grant execute on function public.approve_coach(uuid, text) to authenticated;

create or replace function public.reject_coach(p_coach_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.users me
                 where me.id = auth.uid() and me.is_platform_admin) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;

  update public.users set marketplace_status = 'rejected' where id = p_coach_id;
end;
$$;

grant execute on function public.reject_coach(uuid) to authenticated;
```

- [ ] **Step 2: Aplicar la migración en Supabase**

Pegar el archivo completo en el SQL Editor del proyecto y ejecutarlo.
Expected: `Success. No rows returned`.

- [ ] **Step 3: Encender al administrador de la plataforma**

En el SQL Editor:

```sql
update public.users set is_platform_admin = true where email = 'hizocar@gmail.com';
select id, email, is_platform_admin from public.users where is_platform_admin;
```

Expected: una fila.

- [ ] **Step 4: Verificar los invariantes a mano (ningún test de Vitest cubre esto)**

En el SQL Editor, uno por uno. **Cada uno debe fallar como se indica**; si alguno
devuelve el teléfono, la tarea no está lista.

```sql
-- 4.1 Crear una solicitud de prueba.
select public.create_request('Prueba QA','+56911112222','Ñuñoa','ambas',
  'Quiero bajar de peso y ordenar mi entrenamiento','Tardes', '');

-- 4.2 El honeypot rechaza.
select public.create_request('Bot','+56911113333','Ñuñoa','online',
  'texto suficientemente largo para pasar','', 'soy-un-bot');
--    Esperado: ERROR "solicitud inválida"

-- 4.3 Teléfono inválido rechazado aunque el cliente lo haya "normalizado".
select public.create_request('Malo','912345678','Ñuñoa','online',
  'texto suficientemente largo para pasar','', '');
--    Esperado: ERROR "teléfono inválido"

-- 4.4 Segunda solicitud abierta del mismo número rechazada.
select public.create_request('Prueba QA','+56911112222','Ñuñoa','online',
  'otro texto suficientemente largo para pasar','', '');
--    Esperado: ERROR "ya tienes una solicitud abierta"

-- 4.5 Nadie lee la tabla directo (correr como rol anon en el editor):
--     set local role anon; select * from public.coach_requests;
--     Esperado: ERROR de permisos o cero filas — nunca el teléfono.
```

Después, autenticado como un coach en `/marketplace` (Task 5), comprobar:
la cuarta postulación devuelve "sin cupo" sin número; un coach recién registrado y
todavía `pending` no ve nada; una solicitud de hace 2 horas no aparece para un coach
en estado `marketplace` y sí para uno `active`.

- [ ] **Step 5: Commit**

```bash
git add trainer-app/supabase_migration_v19.sql
git commit -m "feat(marketplace): esquema, vistas y funciones security definer"
```

---

### Task 3: `requireCoach()` y el bloqueo del coach gratis

Hoy `dashboard`, `library`, `programs` y `subscription` repiten las mismas tres líneas
de guardia copiadas. Agregar la condición del coach gratis a mano en cada una es
exactamente cómo se cuela una página sin candado.

**Files:**
- Create: `web/src/lib/guard.ts`
- Modify: `web/src/app/dashboard/page.tsx`, `web/src/app/library/page.tsx`, `web/src/app/programs/page.tsx`, `web/src/app/subscription/page.tsx`

**Interfaces:**
- Consumes: `createClient()` de `web/src/lib/supabase-server.ts`; `panelLocked`, `GymState` de `web/src/lib/marketplace.ts`.
- Produces: `requireCoach(opts?: { allowLocked?: boolean }): Promise<CoachSession>`, `requireAdmin(): Promise<CoachSession>`, y el tipo `CoachSession`.

- [ ] **Step 1: Escribir `guard.ts`**

```ts
import { redirect } from 'next/navigation';
import { createClient } from './supabase-server';
import { panelLocked, type GymState } from './marketplace';

export type CoachSession = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  me: {
    id: string; name: string; email: string; role: string;
    is_owner: boolean; gym_id: string | null;
    marketplace_status: string | null; is_platform_admin: boolean;
    slug: string | null;
  };
  gym: GymState | null;
  locked: boolean;
};

/**
 * Única puerta del panel. `allowLocked` lo usa /marketplace, que es
 * justamente la página a la que se manda al coach bloqueado: sin esa salida,
 * el guard se redirige a sí mismo en un bucle.
 */
export async function requireCoach(
  opts: { allowLocked?: boolean } = {},
): Promise<CoachSession> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me, error } = await supabase
    .from('users')
    .select('id, name, email, role, is_owner, gym_id, marketplace_status, is_platform_admin, slug')
    .eq('id', user.id)
    .maybeSingle();

  // Un error tragado acá deja pasar a cualquiera: si no se pudo leer, no se entra.
  if (error) throw error;
  if (me?.role !== 'coach') redirect('/login');

  let gym: GymState | null = null;
  if (me.gym_id) {
    const { data, error: gymError } = await supabase
      .from('gyms')
      .select('subscription_status, free_month_ends_at')
      .eq('id', me.gym_id)
      .maybeSingle();
    if (gymError) throw gymError;
    gym = data;
  }

  const locked = panelLocked(gym);
  if (locked && !opts.allowLocked) redirect('/marketplace');

  return { supabase, userId: user.id, me, gym, locked };
}

export async function requireAdmin(): Promise<CoachSession> {
  const session = await requireCoach({ allowLocked: true });
  if (!session.me.is_platform_admin) redirect('/dashboard');
  return session;
}
```

- [ ] **Step 2: Reemplazar la guardia copiada en las cuatro páginas**

En cada una, borrar el bloque `const supabase = await createClient(); … role !== 'coach'`
y dejar en su lugar:

```tsx
const { supabase, userId, me } = await requireCoach();
```

En `subscription/page.tsx` se conserva la línea que ya existe después:
`if (!me.is_owner) redirect('/dashboard');`. En `dashboard/page.tsx`, `loadCoachDashboard(supabase, user.id)` pasa a `loadCoachDashboard(supabase, userId)`.

- [ ] **Step 3: Verificar que el panel sigue funcionando**

Run: `cd web && npm run build`
Expected: build sin errores de tipos.

Después, `npm run dev` y entrar con la cuenta de coach de prueba: `/dashboard`,
`/library`, `/programs` y `/subscription` cargan igual que antes.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/guard.ts web/src/app/dashboard/page.tsx web/src/app/library/page.tsx web/src/app/programs/page.tsx web/src/app/subscription/page.tsx
git commit -m "refactor(web): una sola guardia de sesión, con el bloqueo del coach gratis"
```

---

### Task 4: `/busco-coach` — el formulario público

**Files:**
- Create: `web/src/app/busco-coach/page.tsx`, `web/src/app/busco-coach/RequestForm.tsx`

**Interfaces:**
- Consumes: `normalizeWhatsapp` de `web/src/lib/marketplace.ts`; `createClient` de `web/src/lib/supabase-browser.ts`; la función SQL `create_request(p_name, p_whatsapp, p_comuna, p_modality, p_goal, p_availability, p_trap)`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Escribir `RequestForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { normalizeWhatsapp } from '@/lib/marketplace';

const MODALIDADES = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'online', label: 'Online' },
  { value: 'ambas', label: 'Me da igual' },
] as const;

export default function RequestForm() {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [comuna, setComuna] = useState('');
  const [modality, setModality] = useState<string>('ambas');
  const [goal, setGoal] = useState('');
  const [availability, setAvailability] = useState('');
  const [trap, setTrap] = useState('');           // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const phone = normalizeWhatsapp(whatsapp);
    if (!phone) { setError('Ese número no parece un móvil chileno. Ejemplo: 9 1234 5678.'); return; }
    if (name.trim().length < 2) { setError('Escribe tu nombre.'); return; }
    if (comuna.trim().length < 2) { setError('Escribe tu comuna.'); return; }
    if (goal.trim().length < 10) { setError('Cuéntanos un poco más de lo que buscas.'); return; }

    setLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('create_request', {
      p_name: name.trim(),
      p_whatsapp: phone,
      p_comuna: comuna.trim(),
      p_modality: modality,
      p_goal: goal.trim(),
      p_availability: availability.trim(),
      p_trap: trap,
    });

    if (rpcError) {
      // El mensaje de Postgres no se muestra crudo: dice más de lo que el
      // visitante necesita y en el caso del honeypot delata la trampa.
      setError(
        rpcError.message.includes('ya tienes una solicitud abierta')
          ? 'Ya tienes una solicitud abierta. Espera a que te escriban.'
          : 'No se pudo enviar. Revisa los datos e inténtalo de nuevo.',
      );
      setLoading(false);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <h1>Listo</h1>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
          En las próximas horas te va a escribir un entrenador por WhatsApp. Puede
          escribirte más de uno: responde al que más te acomode.
        </p>
      </div>
    );
  }

  return (
    <form className="auth-card" style={{ maxWidth: 460 }} onSubmit={handleSubmit}>
      <h1>Busco entrenador</h1>
      <p className="muted" style={{ fontSize: 14 }}>
        Cuéntanos qué buscas y te escriben por WhatsApp. No tienes que crear cuenta.
      </p>

      <label>Nombre
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
      </label>

      <label>WhatsApp
        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
               inputMode="tel" placeholder="9 1234 5678" required />
      </label>

      <label>Comuna
        <input value={comuna} onChange={(e) => setComuna(e.target.value)} maxLength={60} required />
      </label>

      <label>¿Presencial u online?
        <select value={modality} onChange={(e) => setModality(e.target.value)}>
          {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>

      <label>¿Qué buscas?
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)}
                  rows={4} maxLength={600} required
                  placeholder="Bajar de peso, ganar masa, volver a entrenar después de una lesión…" />
      </label>

      <label>¿Cuándo puedes entrenar? (opcional)
        <input value={availability} onChange={(e) => setAvailability(e.target.value)}
               maxLength={300} placeholder="Mañanas, o martes y jueves" />
      </label>

      {/* Honeypot: fuera de pantalla y fuera del recorrido del teclado. Un
          humano no lo ve; un bot que rellena todo lo llena y queda rechazado. */}
      <input value={trap} onChange={(e) => setTrap(e.target.value)}
             name="empresa" tabIndex={-1} autoComplete="off" aria-hidden="true"
             style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />

      {error && <p style={{ color: 'var(--warning)', fontSize: 13 }}>{error}</p>}

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? 'ENVIANDO…' : 'PUBLICAR MI SOLICITUD'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Escribir `page.tsx`**

```tsx
import type { Metadata } from 'next';
import RequestForm from './RequestForm';

export const metadata: Metadata = {
  title: 'Busco entrenador — EliteFitness',
  description:
    'Cuéntanos qué buscas y un entrenador te escribe por WhatsApp. Sin crear cuenta y sin costo para ti.',
};

export default function BuscoCoachPage() {
  return <div className="auth-wrap"><RequestForm /></div>;
}
```

- [ ] **Step 3: Verificar en el navegador**

Run: `cd web && npm run dev`, abrir `http://localhost:3000/busco-coach`.
Comprobar: enviar con `221234567` muestra el error del móvil; enviar bien muestra la
pantalla "Listo"; enviar de nuevo el mismo número muestra "Ya tienes una solicitud
abierta". Confirmar en el SQL Editor: `select id, name, whatsapp, status from public.coach_requests order by created_at desc limit 3;`

- [ ] **Step 4: Commit**

```bash
git add web/src/app/busco-coach
git commit -m "feat(marketplace): formulario público para pedir entrenador"
```

---

### Task 5: `/marketplace` — la bolsa y postularse

**Files:**
- Create: `web/src/app/marketplace/page.tsx`, `web/src/app/marketplace/RequestList.tsx`

**Interfaces:**
- Consumes: `requireCoach({ allowLocked: true })` de `web/src/lib/guard.ts`; `slotsLeft`, `MAX_APPLICATIONS` de `web/src/lib/marketplace.ts`; la vista `open_requests` y la función `apply_to_request(p_request_id)`.
- Produces: nada que consuman otras tareas. Task 6 agrega un componente hermano a esta misma página.

- [ ] **Step 1: Escribir `RequestList.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { MAX_APPLICATIONS } from '@/lib/marketplace';

export type OpenRequest = {
  id: string; comuna: string; modality: string; goal: string;
  availability: string | null; created_at: string;
  slots_left: number; already_applied: boolean;
};

const MODALIDAD: Record<string, string> = {
  presencial: 'Presencial', online: 'Online', ambas: 'Presencial u online',
};

function haceCuanto(iso: string): string {
  const horas = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (horas < 1) return 'recién';
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} día${dias === 1 ? '' : 's'}`;
}

export default function RequestList({ initial }: { initial: OpenRequest[] }) {
  const [requests, setRequests] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function apply(id: string) {
    setError(null);
    if (!confirm(`Al postularte verás su WhatsApp y podrás escribirle. Van ${MAX_APPLICATIONS} entrenadores por solicitud. ¿Postularte?`)) return;

    setBusy(id);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('apply_to_request', { p_request_id: id });
    setBusy(null);

    if (rpcError) {
      // "sin cupo" y "no disponible" se muestran igual a propósito: al coach no
      // le sirve saber si perdió por tiempo o por cupo, y decírselo expone
      // cuándo se publicó una solicitud que todavía no debería ver.
      setError('Esta solicitud ya no está disponible.');
      setRequests((rs) => rs.filter((r) => r.id !== id));
      return;
    }

    setPhones((p) => ({ ...p, [id]: data as string }));
    setRequests((rs) => rs.map((r) =>
      r.id === id ? { ...r, already_applied: true, slots_left: Math.max(0, r.slots_left - 1) } : r));
  }

  if (requests.length === 0) {
    return <p className="muted">No hay solicitudes disponibles por ahora.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {error && <p style={{ color: 'var(--warning)', fontSize: 13 }}>{error}</p>}

      {requests.map((r) => {
        const nueva = !r.already_applied && r.slots_left === MAX_APPLICATIONS;
        return (
          <article key={r.id} style={{
            border: `1px solid ${nueva ? 'var(--warning)' : 'var(--border)'}`,
            borderRadius: 12, padding: 16, background: 'var(--card)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span className="label">{r.comuna} · {MODALIDAD[r.modality] ?? r.modality}</span>
              <span className="muted" style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 12 }}>
                {haceCuanto(r.created_at)} · {r.slots_left} de {MAX_APPLICATIONS}
              </span>
            </div>

            <p style={{ marginTop: 8, lineHeight: 1.55 }}>{r.goal}</p>
            {r.availability && <p className="muted" style={{ fontSize: 13 }}>Disponibilidad: {r.availability}</p>}

            {phones[r.id] ? (
              <a className="btn btn-primary" style={{ marginTop: 12 }}
                 href={`https://wa.me/${phones[r.id].replace('+', '')}`}
                 target="_blank" rel="noopener noreferrer">
                ESCRIBIRLE A {phones[r.id]}
              </a>
            ) : r.already_applied ? (
              <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
                Ya te postulaste. El número está más abajo, en tus postulaciones.
              </p>
            ) : (
              <button className="btn btn-primary" style={{ marginTop: 12 }}
                      onClick={() => apply(r.id)} disabled={busy === r.id}>
                {busy === r.id ? 'POSTULANDO…' : 'POSTULARME'}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Escribir `page.tsx`**

```tsx
import { requireCoach } from '@/lib/guard';
import RequestList, { type OpenRequest } from './RequestList';

export const dynamic = 'force-dynamic';

export default async function MarketplacePage() {
  // allowLocked: esta es justamente la página a la que se manda al coach
  // bloqueado. Sin la salida, el guard se redirige a sí mismo.
  const { supabase, me, locked } = await requireCoach({ allowLocked: true });

  const { data, error } = await supabase
    .from('open_requests')
    .select('id, comuna, modality, goal, availability, created_at, slots_left, already_applied')
    .order('created_at', { ascending: false });

  // Un error tragado acá dibuja una bolsa vacía y le dice al coach "no hay
  // nadie buscando" cuando en realidad la consulta falló.
  if (error) throw error;

  const pendiente = me.marketplace_status === 'pending';

  return (
    <main className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <h1 className="display">SOLICITUDES</h1>

      {pendiente && (
        <p style={{ color: 'var(--warning)', fontSize: 14, marginTop: 8 }}>
          Tu cuenta está en revisión. Cuando la aprobemos vas a poder postularte.
        </p>
      )}

      {locked && !pendiente && (
        <p className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
          El resto del panel se abre cuando tomes a tu primer alumno: ahí te regalamos
          un mes.
        </p>
      )}

      <div style={{ marginTop: 24 }}>
        <RequestList initial={(data ?? []) as OpenRequest[]} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verificar en el navegador**

Run: `cd web && npm run dev`, entrar con el coach de prueba y abrir `/marketplace`.
Comprobar: aparece la solicitud creada en la Task 4; "Postularme" pide confirmación y
después muestra el enlace de WhatsApp; recargar la página mantiene el estado
"ya te postulaste"; en el SQL Editor `select count(*) from public.request_applications;`
devuelve 1 aunque se apriete dos veces.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/marketplace
git commit -m "feat(marketplace): bolsa de solicitudes con postulación"
```

---

### Task 6: "Lo tomé" y el mes de regalo

**Files:**
- Create: `web/src/app/marketplace/MyApplications.tsx`
- Modify: `web/src/app/marketplace/page.tsx`

**Interfaces:**
- Consumes: la vista `my_applications` y la función `claim_request(p_request_id)`.
- Produces: `MyApplications` como componente hermano de `RequestList` en la misma página.

- [ ] **Step 1: Escribir `MyApplications.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export type MyApplication = {
  request_id: string; name: string; whatsapp: string; comuna: string;
  modality: string; goal: string; availability: string | null;
  applied_at: string; status: string;
};

export default function MyApplications({ initial }: { initial: MyApplication[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim(id: string, name: string) {
    if (!confirm(`¿${name} es tu alumno? Se cierra la solicitud y se te abre el panel.`)) return;
    setBusy(id); setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('claim_request', { p_request_id: id });
    setBusy(null);

    if (rpcError) { setError('No se pudo cerrar la solicitud. Recarga e inténtalo de nuevo.'); return; }

    // El panel recién bloqueado se abre en el servidor: hay que revalidar, no
    // basta con cambiar el estado local.
    router.refresh();
  }

  if (initial.length === 0) return null;

  return (
    <section style={{ marginTop: 40 }}>
      <h2 className="display" style={{ fontSize: 20 }}>MIS POSTULACIONES</h2>
      {error && <p style={{ color: 'var(--warning)', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {initial.map((a) => (
          <article key={a.request_id} style={{
            border: '1px solid var(--border)', borderRadius: 12,
            padding: 16, background: 'var(--card)',
            opacity: a.status === 'open' ? 1 : 0.55,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong>{a.name}</strong>
              <span className="muted" style={{ fontSize: 12 }}>{a.comuna}</span>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{a.goal}</p>

            {a.status === 'open' ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <a className="btn btn-ghost"
                   href={`https://wa.me/${a.whatsapp.replace('+', '')}`}
                   target="_blank" rel="noopener noreferrer">WHATSAPP</a>
                <button className="btn btn-primary" disabled={busy === a.request_id}
                        onClick={() => claim(a.request_id, a.name)}>
                  {busy === a.request_id ? 'CERRANDO…' : 'LO TOMÉ'}
                </button>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
                Solicitud cerrada.
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Cargar las postulaciones en `page.tsx`**

Agregar después de la consulta de `open_requests`:

```tsx
  const { data: mias, error: miasError } = await supabase
    .from('my_applications')
    .select('request_id, name, whatsapp, comuna, modality, goal, availability, applied_at, status')
    .order('applied_at', { ascending: false });
  if (miasError) throw miasError;
```

Y debajo de `<RequestList …/>`:

```tsx
      <MyApplications initial={(mias ?? []) as MyApplication[]} />
```

con el import `import MyApplications, { type MyApplication } from './MyApplications';`.

- [ ] **Step 3: Verificar el mes de regalo**

Con el coach de prueba, apretar "LO TOMÉ". Después, en el SQL Editor:

```sql
select subscription_status, free_month_used, free_month_ends_at
  from public.gyms where id = (select gym_id from public.users where email = 'CORREO_DEL_COACH_DE_PRUEBA');
```

Expected: `active`, `true`, y una fecha a un mes. Repetir con una segunda solicitud:
`free_month_ends_at` **no** se mueve — el regalo es una sola vez por gimnasio.
Y `/dashboard` ya carga en vez de redirigir a `/marketplace`.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/marketplace
git commit -m "feat(marketplace): cerrar solicitud y activar el mes de regalo"
```

---

### Task 7: Perfil público del coach

La página pública se lee **sin sesión**, así que no puede consultar `public.users`:
esa tabla tiene RLS y contiene correos de alumnos. Necesita su propia vista, igual que
`coach_requests` necesitó la suya. Y el perfil no se edita con un `update` directo,
porque eso dejaría al coach cambiar su propio `slug`, su `marketplace_status` y su
`is_platform_admin`.

**Files:**
- Create: `trainer-app/supabase_migration_v20.sql`, `web/src/app/perfil/page.tsx`, `web/src/app/perfil/ProfileForm.tsx`, `web/src/app/coach/[slug]/page.tsx`

**Interfaces:**
- Consumes: `requireCoach({ allowLocked: true })`.
- Produces: vista `public.public_coaches(slug text, name text, avatar_url text, bio text, instagram text, specialties text[], comunas text[], modality text, accepting_clients boolean)` y `public.update_my_profile(p_bio text, p_instagram text, p_specialties text[], p_comunas text[], p_modality text, p_accepting boolean) returns void`.

- [ ] **Step 1: Escribir `trainer-app/supabase_migration_v20.sql`**

```sql
-- v20 — Perfil público del coach.

create or replace view public.public_coaches
with (security_invoker = false) as
select u.slug, u.name, u.avatar_url, u.bio, u.instagram,
       u.specialties, u.comunas, u.modality, u.accepting_clients
from public.users u
where u.role = 'coach'
  and u.marketplace_status = 'approved'
  and u.slug is not null;

-- anon también: la ficha se comparte por Instagram, se abre sin sesión.
grant select on public.public_coaches to anon, authenticated;

create or replace function public.update_my_profile(
  p_bio text, p_instagram text, p_specialties text[],
  p_comunas text[], p_modality text, p_accepting boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;

  if p_modality is not null and p_modality not in ('presencial','online','ambas') then
    raise exception 'modalidad inválida' using errcode = 'P0001';
  end if;

  if length(coalesce(p_bio, '')) > 800 then
    raise exception 'biografía demasiado larga' using errcode = 'P0001';
  end if;

  if coalesce(array_length(p_specialties, 1), 0) > 6
     or coalesce(array_length(p_comunas, 1), 0) > 10 then
    raise exception 'demasiadas etiquetas' using errcode = 'P0001';
  end if;

  -- La lista de columnas es la autorización: slug, marketplace_status,
  -- is_platform_admin, role y gym_id no están, y por eso el coach no puede
  -- aprobarse a sí mismo ni robarse la URL de otro.
  update public.users
     set bio = nullif(trim(coalesce(p_bio, '')), ''),
         instagram = nullif(trim(replace(coalesce(p_instagram, ''), '@', '')), ''),
         specialties = p_specialties,
         comunas = p_comunas,
         modality = p_modality,
         accepting_clients = coalesce(p_accepting, true)
   where id = auth.uid() and role = 'coach';
end;
$$;

grant execute on function public.update_my_profile(text,text,text[],text[],text,boolean)
  to authenticated;
```

Aplicarla en el SQL Editor. Expected: `Success. No rows returned`.

- [ ] **Step 2: Escribir `ProfileForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export type Profile = {
  slug: string | null; bio: string | null; instagram: string | null;
  specialties: string[] | null; comunas: string[] | null;
  modality: string | null; accepting_clients: boolean;
};

const lista = (s: string) =>
  s.split(',').map((x) => x.trim()).filter(Boolean);

export default function ProfileForm({ initial }: { initial: Profile }) {
  const [bio, setBio] = useState(initial.bio ?? '');
  const [instagram, setInstagram] = useState(initial.instagram ?? '');
  const [specialties, setSpecialties] = useState((initial.specialties ?? []).join(', '));
  const [comunas, setComunas] = useState((initial.comunas ?? []).join(', '));
  const [modality, setModality] = useState(initial.modality ?? 'ambas');
  const [accepting, setAccepting] = useState(initial.accepting_clients);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState('saving');
    const supabase = createClient();
    const { error } = await supabase.rpc('update_my_profile', {
      p_bio: bio, p_instagram: instagram,
      p_specialties: lista(specialties), p_comunas: lista(comunas),
      p_modality: modality, p_accepting: accepting,
    });
    setState(error ? 'error' : 'saved');
  }

  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
      <label>Sobre ti
        <textarea rows={5} maxLength={800} value={bio} onChange={(e) => setBio(e.target.value)}
                  placeholder="Cómo trabajas, con quién, desde cuándo." />
      </label>

      <label>Instagram
        <input value={instagram} onChange={(e) => setInstagram(e.target.value)}
               placeholder="tu_usuario" />
      </label>

      <label>Especialidades (separadas por coma)
        <input value={specialties} onChange={(e) => setSpecialties(e.target.value)}
               placeholder="Fuerza, Pérdida de grasa, Rehabilitación" />
      </label>

      <label>Comunas donde atiendes (separadas por coma)
        <input value={comunas} onChange={(e) => setComunas(e.target.value)}
               placeholder="Ñuñoa, Providencia" />
      </label>

      <label>Modalidad
        <select value={modality} onChange={(e) => setModality(e.target.value)}>
          <option value="presencial">Presencial</option>
          <option value="online">Online</option>
          <option value="ambas">Presencial y online</option>
        </select>
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={accepting}
               onChange={(e) => setAccepting(e.target.checked)} />
        Estoy recibiendo alumnos nuevos
      </label>

      <button className="btn btn-primary" disabled={state === 'saving'}>
        {state === 'saving' ? 'GUARDANDO…' : 'GUARDAR'}
      </button>

      {state === 'saved' && <p className="muted" style={{ fontSize: 13 }}>Guardado.</p>}
      {state === 'error' && <p style={{ color: 'var(--warning)', fontSize: 13 }}>No se pudo guardar.</p>}

      {initial.slug && (
        <p className="muted" style={{ fontSize: 13 }}>
          Tu página: <a href={`/coach/${initial.slug}`}>elitefitapp.com/coach/{initial.slug}</a>
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Escribir `perfil/page.tsx`**

```tsx
import { requireCoach } from '@/lib/guard';
import ProfileForm, { type Profile } from './ProfileForm';

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const { supabase, userId } = await requireCoach({ allowLocked: true });

  const { data, error } = await supabase
    .from('users')
    .select('slug, bio, instagram, specialties, comunas, modality, accepting_clients')
    .eq('id', userId)
    .single();
  if (error) throw error;

  return (
    <main className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <h1 className="display">MI PERFIL</h1>
      <p className="muted" style={{ fontSize: 14, marginBottom: 24 }}>
        Esto es lo que ve un alumno cuando le compartes tu página.
      </p>
      <ProfileForm initial={data as Profile} />
    </main>
  );
}
```

- [ ] **Step 4: Escribir `coach/[slug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';

export const revalidate = 300;

async function loadCoach(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_coaches')
    .select('slug, name, avatar_url, bio, instagram, specialties, comunas, modality, accepting_clients')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const coach = await loadCoach(slug);
  if (!coach) return { title: 'Entrenador no encontrado — EliteFitness' };
  return {
    title: `${coach.name} — Entrenador en EliteFitness`,
    description: coach.bio ?? `${coach.name} entrena en EliteFitness.`,
  };
}

export default async function CoachPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const coach = await loadCoach(slug);
  if (!coach) notFound();

  return (
    <main className="container" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 640 }}>
      {coach.avatar_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coach.avatar_url} alt={coach.name} width={96} height={96}
             style={{ borderRadius: '50%', objectFit: 'cover' }} />
      )}

      <h1 className="display" style={{ marginTop: 16 }}>{coach.name.toUpperCase()}</h1>

      <p className="label" style={{ marginTop: 4 }}>
        {(coach.comunas ?? []).join(' · ')}
        {coach.modality === 'online' ? ' Online' : coach.modality === 'ambas' ? ' · También online' : ''}
      </p>

      {coach.bio && <p style={{ marginTop: 20, lineHeight: 1.7 }}>{coach.bio}</p>}

      {(coach.specialties ?? []).length > 0 && (
        <ul style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20, listStyle: 'none', padding: 0 }}>
          {coach.specialties!.map((s: string) => (
            <li key={s} className="label" style={{
              border: '1px solid var(--border)', borderRadius: 99, padding: '5px 12px',
            }}>{s}</li>
          ))}
        </ul>
      )}

      {coach.instagram && (
        <p className="muted" style={{ marginTop: 20, fontSize: 14 }}>
          <a href={`https://instagram.com/${coach.instagram}`} target="_blank" rel="noopener noreferrer">
            @{coach.instagram}
          </a>
        </p>
      )}

      <a className="btn btn-primary" href="/busco-coach" style={{ marginTop: 32 }}>
        {coach.accepting_clients ? 'QUIERO ENTRENAR CON UN COACH' : 'BUSCAR OTRO ENTRENADOR'}
      </a>
    </main>
  );
}
```

- [ ] **Step 5: Verificar**

En el SQL Editor, darle slug al coach de prueba:
`select public.approve_coach('ID_DEL_COACH', 'coach-de-prueba');`
Abrir `/perfil`, llenar y guardar; abrir `/coach/coach-de-prueba` **en una ventana de
incógnito** (sin sesión) y comprobar que carga. Abrir `/coach/no-existe`: 404.

- [ ] **Step 6: Commit**

```bash
git add trainer-app/supabase_migration_v20.sql web/src/app/perfil web/src/app/coach
git commit -m "feat(marketplace): perfil público del coach y su edición"
```

---

### Task 8: `/admin/coaches` — la cola de aprobación

**Files:**
- Create: `web/src/app/admin/coaches/page.tsx`, `web/src/app/admin/coaches/ApprovalList.tsx`

**Interfaces:**
- Consumes: `requireAdmin()` de `web/src/lib/guard.ts`; `slugify` de `web/src/lib/marketplace.ts`; las vistas `pending_coaches` y `marketplace_stats`, y las funciones `approve_coach(p_coach_id, p_slug)` y `reject_coach(p_coach_id)`.
- Produces: vista `public.marketplace_stats(solicitudes bigint, postulaciones bigint, tomadas bigint)`, agregada a `trainer-app/supabase_migration_v20.sql`.

- [ ] **Step 1: Escribir `ApprovalList.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { slugify } from '@/lib/marketplace';

export type PendingCoach = {
  id: string; name: string; email: string;
  instagram: string | null; created_at: string;
};

export default function ApprovalList({ initial }: { initial: PendingCoach[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(coach: PendingCoach, approve: boolean) {
    setBusy(coach.id); setError(null);
    const supabase = createClient();
    const { error: rpcError } = approve
      ? await supabase.rpc('approve_coach', { p_coach_id: coach.id, p_slug: slugify(coach.name) })
      : await supabase.rpc('reject_coach', { p_coach_id: coach.id });
    setBusy(null);
    if (rpcError) { setError(rpcError.message); return; }
    router.refresh();
  }

  if (initial.length === 0) return <p className="muted">No hay coaches esperando.</p>;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {error && <p style={{ color: 'var(--warning)', fontSize: 13 }}>{error}</p>}

      {initial.map((c) => (
        <article key={c.id} style={{
          border: '1px solid var(--border)', borderRadius: 12,
          padding: 16, background: 'var(--card)',
        }}>
          <strong>{c.name}</strong>
          <p className="muted" style={{ fontSize: 13 }}>{c.email}</p>
          {c.instagram && (
            <p className="muted" style={{ fontSize: 13 }}>
              <a href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noopener noreferrer">
                @{c.instagram}
              </a>
            </p>
          )}
          <p className="muted" style={{ fontSize: 12 }}>
            Su página quedaría en /coach/{slugify(c.name)}
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" disabled={busy === c.id}
                    onClick={() => decide(c, true)}>APROBAR</button>
            <button className="btn btn-ghost" disabled={busy === c.id}
                    onClick={() => decide(c, false)}>RECHAZAR</button>
          </div>
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Escribir `page.tsx`**

```tsx
import { requireAdmin } from '@/lib/guard';
import ApprovalList, { type PendingCoach } from './ApprovalList';

export const dynamic = 'force-dynamic';

export default async function AdminCoachesPage() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from('pending_coaches')
    .select('id, name, email, instagram, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;

  const { data: stats, error: statsError } = await supabase
    .from('marketplace_stats')
    .select('solicitudes, postulaciones, tomadas')
    .maybeSingle();
  if (statsError) throw statsError;

  return (
    <main className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <h1 className="display">COACHES POR APROBAR</h1>

      <div className="hero-stats" style={{ marginTop: 24, marginBottom: 32 }}>
        <div><strong className="mono">{stats?.solicitudes ?? 0}</strong><span>SOLICITUDES</span></div>
        <div><strong className="mono">{stats?.postulaciones ?? 0}</strong><span>POSTULACIONES</span></div>
        <div><strong className="mono">{stats?.tomadas ?? 0}</strong><span>TOMADAS</span></div>
      </div>

      <ApprovalList initial={(data ?? []) as PendingCoach[]} />
    </main>
  );
}
```

**Antes del Step 2**, agregar a `trainer-app/supabase_migration_v20.sql` la vista de
las cifras y aplicarla. No se puede contar con `count: 'exact'` sobre `coach_requests`
ni `request_applications`: esas tablas **no tienen política de lectura para nadie**, que
es justamente lo que protege el teléfono. Un `count` devolvería cero, y un cero en un
tablero se lee como "el canal no funciona" en vez de "no tienes permiso" — el mismo
error tragado que ya llevó a producción meses de calendario vacíos.

```sql
create or replace view public.marketplace_stats
with (security_invoker = false) as
select
  (select count(*) from public.coach_requests)                        as solicitudes,
  (select count(*) from public.request_applications)                  as postulaciones,
  (select count(*) from public.coach_requests where status = 'matched') as tomadas
where exists (select 1 from public.users me
              where me.id = auth.uid() and me.is_platform_admin);

grant select on public.marketplace_stats to authenticated;
```

- [ ] **Step 3: Verificar**

Entrar con la cuenta de `hizocar@gmail.com` a `/admin/coaches`: se ve la cola y las
tres cifras (si salen en 0 teniendo datos, aplicar la nota del paso anterior).
Entrar con un coach cualquiera: redirige a `/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/admin trainer-app/supabase_migration_v20.sql
git commit -m "feat(marketplace): cola de aprobación de coaches y cifras del canal"
```

---

### Task 9: Registro gratis dentro de `/signup`

El registro **es uno solo**: el plan gratis es una opción más del selector que ya
existe, no una página aparte. La razón no es ahorrarse una URL, es que el coach compare
las dos puertas en la misma pantalla.

**Files:**
- Modify: `web/src/app/signup/page.tsx`
- Create (en Supabase, no en el repo): Edge Function `start-free-signup`

**Interfaces:**
- Consumes: la Edge Function `start-free-signup`.
- Produces: nada.

- [ ] **Step 1: Escribir y desplegar la Edge Function `start-free-signup`**

Las Edge Functions **no viven en este repositorio** —están en el proyecto de Supabase—
y el panel web solo tiene la `ANON_KEY`, así que crear cuentas exige el service role y
esto no puede ser una ruta de Next. Copiar `start-signup` desde el panel de Supabase y
adaptarla: mismo cuerpo de entrada (`name`, `email`, `gymName`), **sin** llamada a Flow.
Debe, con el service role:

1. `auth.admin.createUser({ email, email_confirm: true })` y mandar el correo de
   definir contraseña con `resetPasswordForEmail` apuntando a `/set-password`, que ya
   existe;
2. insertar el gimnasio: `{ name: gymName, plan_tier: 'solo', coach_limit: 1, subscription_status: 'marketplace', free_month_used: false }`;
3. insertar en `users`: `{ id, name, email, role: 'coach', is_owner: true, gym_id, marketplace_status: 'pending' }`;
4. devolver `{ ok: true }`.

- [ ] **Step 2: Agregar la opción al selector de `/signup`**

En `web/src/app/signup/page.tsx`, agregar al principio del arreglo `PLANS`:

```tsx
const PLANS = [
  { tier: 'free', name: 'Gratis · marketplace', seats: 'Solo solicitudes', monthly: 0, annual: 0 },
  { tier: 'solo', name: 'Solo', seats: '1 entrenador', monthly: 4990, annual: 49900 },
  { tier: 'starter', name: 'Starter', seats: '2–3 entrenadores', monthly: 9990, annual: 99900 },
  { tier: 'growth', name: 'Growth', seats: '4–8 entrenadores', monthly: 19990, annual: 199900 },
  { tier: 'pro', name: 'Pro', seats: '9–20 entrenadores', monthly: 39990, annual: 399900 },
] as const;
```

Y en `handleSubmit`, antes del `fetch` que ya existe:

```tsx
    if (tier === 'free') {
      const res = await fetch(
        `${firstToken(process.env.NEXT_PUBLIC_SUPABASE_URL)}/functions/v1/start-free-signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: firstToken(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            gymName: gymName.trim(),
          }),
        },
      );
      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? 'No se pudo crear la cuenta.');
        setLoading(false);
        return;
      }
      setFreeDone(true);
      setLoading(false);
      return;
    }
```

Agregar el estado `const [freeDone, setFreeDone] = useState(false);` y, al principio del
`return`, la pantalla de confirmación:

```tsx
  if (freeDone) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ maxWidth: 460 }}>
          <h1>Cuenta creada</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
            Te mandamos un correo para que definas tu contraseña. Revisamos tu cuenta a
            mano antes de que puedas postularte a solicitudes: te avisamos apenas esté
            lista.
          </p>
        </div>
      </div>
    );
  }
```

Y donde se muestra el precio, cambiar el bloque por:

```tsx
        {tier === 'free' ? (
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            Entras al marketplace sin tarjeta. Planes, alumnos y biblioteca se abren
            cuando tomes a tu primer alumno: ahí te regalamos un mes.
          </p>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>
            {clp(price)} {billing === 'monthly' ? 'al mes' : 'al año'}
          </p>
        )}
```

El selector de facturación mensual/anual se oculta cuando `tier === 'free'`.

- [ ] **Step 3: Verificar el recorrido completo**

Run: `cd web && npm run build && npm run dev`.
Registrarse en `/signup` eligiendo "Gratis · marketplace" con un correo de prueba.
Comprobar: llega el correo de contraseña; al entrar, `/dashboard` redirige a
`/marketplace`; ahí se ve el aviso "Tu cuenta está en revisión" y **ninguna solicitud**.
Aprobar la cuenta desde `/admin/coaches` y recargar: aparecen las solicitudes de más de
12 horas y no las recientes.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/signup/page.tsx
git commit -m "feat(marketplace): registro gratis como una opción más del signup"
```

---

---

### Task 10: Navegación — que las páginas nuevas no queden huérfanas

`/marketplace`, `/perfil` y `/admin/coaches` no tienen encabezado ni forma de volver, y
nada en el panel lleva a ellas. La navegación de este proyecto no está centralizada: cada
página repite su propio encabezado con `<Link href="/dashboard" className="brand">`, y el
concentrador es el encabezado de `/dashboard` (`app/dashboard/page.tsx:56-57`).

**Files:**
- Modify: `web/src/app/dashboard/page.tsx:56-57`, `web/src/app/marketplace/page.tsx`, `web/src/app/perfil/page.tsx`, `web/src/app/admin/coaches/page.tsx`

**Interfaces:**
- Consumes: `CoachSession` de `web/src/lib/guard.ts` (para `me.is_platform_admin`).
- Produces: nada.

- [ ] **Step 1: Agregar los enlaces en el encabezado del panel**

En `web/src/app/dashboard/page.tsx`, junto a los botones PROGRAMAS y BIBLIOTECA que ya
están en las líneas 56-57:

```tsx
            <Link href="/marketplace" className="btn btn-ghost" style={{ padding: '10px 18px' }}>SOLICITUDES</Link>
            <Link href="/perfil" className="btn btn-ghost" style={{ padding: '10px 18px' }}>MI PERFIL</Link>
            {me.is_platform_admin && (
              <Link href="/admin/coaches" className="btn btn-ghost" style={{ padding: '10px 18px' }}>ADMIN</Link>
            )}
```

- [ ] **Step 2: Poner encabezado en las tres páginas nuevas**

En `marketplace/page.tsx`, `perfil/page.tsx` y `admin/coaches/page.tsx`, dentro del
`<main>` y antes del `<h1>`, el mismo encabezado que usan `library` y `programs`:

```tsx
        <div className="nav-inner" style={{ marginBottom: 24 }}>
          <Link href="/dashboard" className="brand"><Logo /></Link>
          <Link href="/dashboard" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
            VOLVER
          </Link>
        </div>
```

con `import Link from 'next/link';` e `import Logo from '@/components/Logo';`.

**Excepción en `/marketplace`:** al coach bloqueado (`locked === true`) el botón VOLVER
lo mandaría a `/dashboard`, que lo devuelve acá de inmediato. En ese caso se muestra
`CERRAR SESIÓN` en su lugar, apuntando a la misma acción que usa el resto del panel.

- [ ] **Step 3: Verificar**

Run: `cd web && npm run dev`. Con un coach suscrito: desde `/dashboard` se llega a
SOLICITUDES y MI PERFIL, y desde ambas se vuelve. ADMIN solo aparece con
`hizocar@gmail.com`. Con un coach gratis: `/marketplace` muestra CERRAR SESIÓN y no hay
manera de quedar dando vueltas entre dos redirecciones.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/dashboard/page.tsx web/src/app/marketplace web/src/app/perfil web/src/app/admin
git commit -m "feat(marketplace): enlaces del panel a solicitudes, perfil y admin"
```

## Verificación final, antes de mezclar a `sandbox`

`sandbox` despliega solo a elitefitapp.com, donde hay coaches beta trabajando. Rama
aparte, preview de Vercel, y un solo merge al final.

- [ ] `cd web && npm test` — todos los tests pasan, incluidos los que ya existían.
- [ ] `cd web && npm run build` — sin errores.
- [ ] En el preview de Vercel, con la cuenta de un coach beta **suscrito**: el panel
      carga igual que antes y `/marketplace` muestra las solicitudes al instante.
- [ ] En incógnito: `/busco-coach` y `/coach/<slug>` cargan sin sesión.
- [ ] Con un coach gratis sin aprobar: no existe ninguna ruta del panel que cargue, y `/marketplace` no muestra solicitudes.
- [ ] En incógnito, en la consola del navegador:
      `await (await fetch('<SUPABASE_URL>/rest/v1/coach_requests?select=whatsapp', { headers: { apikey: '<ANON_KEY>' } })).text()`
      — debe devolver un error de permisos o una lista vacía, **nunca un teléfono**.
      Esta es la comprobación que importa: si falla, no se mezcla.
- [ ] Pendiente para el equipo de Supabase: cuando Flow confirme un pago real, la
      función que actualiza la suscripción debe poner `free_month_ends_at = null`. Si no,
      un coach que pagó después de su mes de regalo queda bloqueado por una fecha vieja.

## Deuda anotada, fuera de este plan

- `SubscriptionExpiredScreen` de la app le dice **"SUSCRIPCIÓN INACTIVA"** al coach
  gratis, que nunca tuvo una. Es engañoso pero inofensivo —la campaña dice "entra por la
  web"— y arreglarlo cuesta una compilación y otra revisión de Apple. Va en el próximo
  build, no acá.
