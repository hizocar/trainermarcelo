# Marcelo Herrera · Web

Sitio web con dos objetivos:

1. **Landing** (`/`) — promociona la app de entrenamiento.
2. **Panel de coach** (`/login` → `/dashboard` → `/clients/[id]`) — el coach inicia
   sesión y edita los planes de sus clientes desde el computador. Usa la **misma**
   base de datos Supabase que la app móvil, así que los cambios se ven al instante.

Stack: Next.js 15 (App Router) + `@supabase/ssr`. Sin dependencias de UI externas.

## Desarrollo

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Variables de entorno (`web/.env.local`, ya incluidas para desarrollo):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Son las mismas claves públicas (`EXPO_PUBLIC_*`) de la app. La seguridad la da el
RLS de Supabase: cada coach solo ve y edita los planes de **sus** clientes.

## Despliegue en Vercel

1. Importar el repo en Vercel y fijar **Root Directory = `web`**.
2. Añadir las dos variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy. (Build: `next build`, sin configuración extra.)

## Notas

- Solo usuarios con `role = 'coach'` pueden entrar al panel; el resto es rechazado en el login.
- El editor permite: renombrar días y asignar día de la semana, agregar/eliminar días,
  agregar/eliminar ejercicios, ajustar nº de series y editar objetivo de reps, peso de
  referencia, unidad, descanso y RIR. Guarda todo en una sola acción.
