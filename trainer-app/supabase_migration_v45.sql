-- v45: objetivos POR SET (pedido de Yharel/Marcelo, modelo tipo Traineeks).
--
-- Un ejercicio se completa como una tabla de sets: cada fila con su volumen,
-- descanso, tempo e intensidad. Regla de herencia: un campo NULL en el set =
-- "igual que el ejercicio". El editor web guarda en el ejercicio los valores
-- del set 1 y en cada set solo lo que difiere. Así:
--   · la app 1.0.1 publicada (que lee el ejercicio) sigue mostrando algo correcto;
--   · editar el ejercicio desde la app del coach aplica a todos los sets que
--     no tengan un valor propio;
--   · los planes existentes no necesitan migrar datos.
--
-- Escalas por ejercicio: volume_type (reps | tiempo) e intensity_types (1 o 2
-- de rir | rpe | pct_1rm | kg). "RIR 2 - 80/85%" = ['rir','pct_1rm'].

begin;

-- ── columnas por set, idénticas en planes y programas ──
alter table public.exercise_series
  add column if not exists reps_objective text check (reps_objective is null or char_length(reps_objective) <= 20),
  add column if not exists rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 3600),
  add column if not exists tempo text check (tempo is null or char_length(tempo) <= 20),
  add column if not exists target_rir text check (target_rir is null or char_length(target_rir) <= 20),
  add column if not exists target_rpe text check (target_rpe is null or char_length(target_rpe) <= 20),
  add column if not exists target_pct_1rm text check (target_pct_1rm is null or char_length(target_pct_1rm) <= 20),
  add column if not exists ref_weight numeric check (ref_weight is null or (ref_weight >= 0 and ref_weight < 10000)),
  add column if not exists set_type text check (set_type is null or set_type in ('calentamiento', 'efectiva', 'drop', 'fallo'));

alter table public.program_template_series
  add column if not exists reps_objective text check (reps_objective is null or char_length(reps_objective) <= 20),
  add column if not exists rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 3600),
  add column if not exists tempo text check (tempo is null or char_length(tempo) <= 20),
  add column if not exists target_rir text check (target_rir is null or char_length(target_rir) <= 20),
  add column if not exists target_rpe text check (target_rpe is null or char_length(target_rpe) <= 20),
  add column if not exists target_pct_1rm text check (target_pct_1rm is null or char_length(target_pct_1rm) <= 20),
  add column if not exists ref_weight numeric check (ref_weight is null or (ref_weight >= 0 and ref_weight < 10000)),
  add column if not exists set_type text check (set_type is null or set_type in ('calentamiento', 'efectiva', 'drop', 'fallo'));

-- ── escalas por ejercicio ──
alter table public.exercises
  add column if not exists volume_type text not null default 'reps' check (volume_type in ('reps', 'tiempo')),
  add column if not exists intensity_types text[] not null default '{rir}'
    check (cardinality(intensity_types) between 1 and 2
           and intensity_types <@ array['rir', 'rpe', 'pct_1rm', 'kg']::text[]);

alter table public.program_template_exercises
  add column if not exists volume_type text not null default 'reps' check (volume_type in ('reps', 'tiempo')),
  add column if not exists intensity_types text[] not null default '{rir}'
    check (cardinality(intensity_types) between 1 and 2
           and intensity_types <@ array['rir', 'rpe', 'pct_1rm', 'kg']::text[]);

-- Escalas iniciales según lo que cada ejercicio YA tiene: nadie pierde de
-- vista el peso de referencia que puso (210 ejercicios lo usan).
update public.exercises set intensity_types = case
    when ref_weight is not null and target_rir is null then array['kg']
    when ref_weight is not null then array['rir', 'kg']
    else array['rir'] end;
update public.program_template_exercises set intensity_types = case
    when ref_weight is not null and target_rir is null then array['kg']
    when ref_weight is not null then array['rir', 'kg']
    else array['rir'] end;

commit;
