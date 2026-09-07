-- v37 — el tema elegido viaja con la cuenta (pedido de Yharel/Sebastián):
-- coach o cliente eligen apariencia una vez y los demás dispositivos la
-- siguen. NULL = Carbón, el de siempre. users_self_update ya permite
-- escribirlo; no hay RLS nueva.

alter table public.users
  add column if not exists theme text
    check (theme in ('carbon', 'marfil', 'electrico', 'neon'));
