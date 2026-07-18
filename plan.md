# Plan — App Trainer Marcelo (iPhone)

## Stack tecnológico
- **Frontend**: React Native + Expo (SDK 51+), TypeScript
- **Backend/Auth/DB**: Supabase (PostgreSQL + Row Level Security + Auth)
- **Navegación**: React Navigation v6 (Stack + Bottom Tabs)
- **Gráficos**: react-native-gifted-charts
- **Estilo**: StyleSheet propio — dark (#0A0A0A) + lime green (#C8FF00), tipografía bold estilo Nike
- **Repo**: git@github.com:hizocar/trainermarcelo.git — ramas: sandbox / dev / prod

---

## Modelo de datos (Supabase)

```sql
-- Usuarios (coach y clientes)
users
  id uuid PK (auth.users)
  name text
  role  enum('coach','client')
  coach_id uuid FK→users (null si es coach)

-- Planes de entrenamiento (uno por cliente)
workout_plans
  id uuid PK
  client_id uuid FK→users
  name text
  created_by uuid FK→users

-- Días de entrenamiento (ej: Día 1 Torso, Día 2 Pierna)
training_days
  id uuid PK
  plan_id uuid FK→workout_plans
  day_number int
  name text  (ej: "Torso", "Pierna", "Pierna + torso")

-- Ejercicios por día
exercises
  id uuid PK
  day_id uuid FK→training_days
  name text
  superseries_group text nullable  (ej: "Superserie 1")
  reps_objective text  (ej: "8-12", "10-12")
  unit enum('kg','lb')
  ref_weight float nullable
  order_index int

-- Series por ejercicio (S1, S2, S3)
exercise_series
  id uuid PK
  exercise_id uuid FK→exercises
  series_number int  (1, 2, 3)

-- Registros semanales (lo que loguea el cliente cada semana)
workout_logs
  id uuid PK
  series_id uuid FK→exercise_series
  week_number int
  weight float
  reps int
  logged_at timestamptz
  logged_by uuid FK→users
```

---

## Pantallas y flujo

### Auth
- **LoginScreen** — email + password, Supabase auth
- Redirección automática según rol: coach → CoachNavigator, client → ClientNavigator

### Coach (Bottom Tabs: Clientes | Progreso | Perfil)
- **ClientListScreen** — lista de clientes con avatar, último registro
- **ClientDetailScreen** — días de entrenamiento del cliente, progreso resumido
- **ClientProgressScreen** — gráfico volumen semanal + por ejercicio
- **PlanEditorScreen** — editar/crear plan: días → ejercicios → series

### Cliente (Bottom Tabs: Hoy | Historial | Progreso | Perfil)
- **TodayScreen** — el día de entrenamiento actual con sus ejercicios
- **WorkoutLogScreen** — loguear peso y reps por serie (S1, S2, S3), semana actual
- **HistoryScreen** — historial por semana
- **ProgressScreen** — gráfico de volumen semanal + progreso por ejercicio

---

## Paleta de colores (inspirada en Nike)
```
Background:   #0A0A0A
Surface:      #161616
Card:         #1E1E1E
Accent:       #C8FF00  ← lime green
Text primary: #FFFFFF
Text muted:   #888888
Border:       #2A2A2A
Danger:       #FF4444
```

---

## Pasos de ejecución

### Fase 1 — Setup base
1. `npx create-expo-app trainer-app --template blank-typescript`
2. Instalar dependencias: react-navigation, supabase-js, gifted-charts, etc.
3. Configurar git remote, crear ramas sandbox / dev / prod
4. Crear estructura de carpetas

### Fase 2 — Backend Supabase
5. Crear proyecto en Supabase
6. Ejecutar SQL del schema
7. Configurar Row Level Security (coach ve todo, cliente solo ve lo suyo)
8. Crear usuarios iniciales: Marcelo (coach), Sebastián (client)

### Fase 3 — Navegación + Auth
9. AuthContext con Supabase session
10. Navigator condicional por rol
11. LoginScreen con estilos Nike

### Fase 4 — Pantallas core
12. ClientListScreen (coach)
13. TodayScreen + WorkoutLogScreen (cliente)
14. ProgressScreen con gráficos (ambos roles)

### Fase 5 — Polish
15. Importar datos del Excel (script Node.js → Supabase)
16. Animaciones y microinteracciones
17. Build para iOS (Expo Go / EAS Build)

---

## Datos iniciales (del Excel)
- **Sebastián**: 5 días, 4 días activos + 1 libre
  - Día 1: Torso — 3 superseries (Press banca inclinado, Lat pulldown, Press machine, Seated row, Vuelos laterales, Biceps curl, Triceps cruzado)
  - Día 2: Pierna — Peso muerto rumano, Smith squat, Leg extension, Seated leg curl
  - Día 3: Torso — Press banca plano, High row, Shoulder press, Remo unilateral, Chest fly, Biceps sentado, Triceps pushdown
  - Día 4: Pierna + Torso — Leg press, Curl isquios, Chest press decline, Remo máquina, Curl biceps machine, Seated leg curl
  - 8 semanas de tracking (Semana 1–8)
  
- **Marcelo**: misma estructura (coach también entrena como cliente)
