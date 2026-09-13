-- v42 — búsqueda flexible en la biblioteca (feedback de Yharel): ilike
-- ignora mayúsculas pero NO tildes, así que "maquina" nunca encontraba
-- "Máquina Femoral" — la fila ni llegaba del servidor y el ranking del
-- cliente no podía hacer nada. Columnas normalizadas (sin tildes, en
-- minúsculas) generadas en la base; los buscadores consultan contra ellas
-- con el término normalizado igual en el cliente.

create extension if not exists unaccent with schema extensions;

-- unaccent es STABLE; para una columna generada se necesita IMMUTABLE.
-- Con el diccionario por defecto (que no cambia) el envoltorio inmutable
-- es el patrón estándar y seguro.
create or replace function public.sin_tildes(t text)
returns text language sql immutable parallel safe as
$$ select lower(extensions.unaccent(coalesce(t, ''))) $$;

alter table public.exercise_library
  add column if not exists name_norm text
    generated always as (public.sin_tildes(name)) stored,
  add column if not exists name_en_norm text
    generated always as (public.sin_tildes(name_en)) stored;
