-- v46: la intensidad es UNA escala, y se suma % FCMAX.
--
-- Pedido de Sebastián con la referencia a la vista: el desplegable de
-- Intensidad ofrece exactamente RIR · RPE · % RM · CARGA · % FCMAX, una sola
-- a la vez ("cada variable por separada"). Se acaban las combinaciones que
-- v45 permitía (cardinalidad 1-2).
--
-- % FCMAX (porcentaje de la frecuencia cardíaca máxima) necesita su propia
-- columna, igual que las otras escalas: en el ejercicio como valor base y en
-- cada set para poder diferenciar (misma herencia: NULL = igual que el
-- ejercicio).
--
-- Los 188 ejercicios que v45 dejó en {rir,kg} se quedan con la PRIMERA
-- escala (rir). El peso no se borra: sigue en ref_weight y vuelve a verse en
-- cuanto el coach elija CARGA en ese ejercicio.

begin;

alter table public.exercises
  add column if not exists target_pct_fcmax text
    check (target_pct_fcmax is null or char_length(target_pct_fcmax) <= 20);
alter table public.program_template_exercises
  add column if not exists target_pct_fcmax text
    check (target_pct_fcmax is null or char_length(target_pct_fcmax) <= 20);
alter table public.exercise_series
  add column if not exists target_pct_fcmax text
    check (target_pct_fcmax is null or char_length(target_pct_fcmax) <= 20);
alter table public.program_template_series
  add column if not exists target_pct_fcmax text
    check (target_pct_fcmax is null or char_length(target_pct_fcmax) <= 20);

-- una sola escala por ejercicio, antes de apretar la restricción
update public.exercises set intensity_types = array[intensity_types[1]]
 where cardinality(intensity_types) > 1;
update public.program_template_exercises set intensity_types = array[intensity_types[1]]
 where cardinality(intensity_types) > 1;

alter table public.exercises drop constraint if exists exercises_intensity_types_check;
alter table public.exercises add constraint exercises_intensity_types_check
  check (cardinality(intensity_types) = 1
         and intensity_types <@ array['rir', 'rpe', 'pct_1rm', 'kg', 'pct_fcmax']::text[]);

alter table public.program_template_exercises drop constraint if exists program_template_exercises_intensity_types_check;
alter table public.program_template_exercises add constraint program_template_exercises_intensity_types_check
  check (cardinality(intensity_types) = 1
         and intensity_types <@ array['rir', 'rpe', 'pct_1rm', 'kg', 'pct_fcmax']::text[]);

commit;
