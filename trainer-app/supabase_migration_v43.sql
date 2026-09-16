-- v43: intensidad avanzada por ejercicio — %1RM y RPE objetivo.
--
-- Pedido del equipo (Yharel): más variables de intensidad, pero OPCIONALES:
-- en el editor viven en una sección desplegable junto al tempo, para no
-- cargar la tarjeta de quien no las usa. Texto como target_rir, porque se
-- programa con rangos ("75-80", "8-9"). Nulo = no aplica.

alter table public.exercises
  add column if not exists target_pct_1rm text
    check (target_pct_1rm is null or char_length(target_pct_1rm) <= 20),
  add column if not exists target_rpe text
    check (target_rpe is null or char_length(target_rpe) <= 20);

alter table public.program_template_exercises
  add column if not exists target_pct_1rm text
    check (target_pct_1rm is null or char_length(target_pct_1rm) <= 20),
  add column if not exists target_rpe text
    check (target_rpe is null or char_length(target_rpe) <= 20);
