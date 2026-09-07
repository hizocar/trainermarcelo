-- v34 — el catálogo de programas (camino Traineeks, paso 3): nivel, enfoque
-- y descripción en program_templates, para que la biblioteca del coach se
-- filtre como catálogo y quede lista para el store de rutinas (paso 4).
-- Sin cambios de RLS: las políticas del coach sobre sus templates ya existen
-- y las columnas nuevas viajan con ellas.

alter table public.program_templates
  add column if not exists level text
    check (level in ('principiante', 'intermedio', 'avanzado')),
  add column if not exists focus text
    check (focus is null or char_length(focus) <= 40),
  add column if not exists description text
    check (description is null or char_length(description) <= 1000);
