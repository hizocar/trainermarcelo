import Link from 'next/link';
import { loadCoachDashboard, detalleTexto, type CoachDashboardRow } from '@/lib/coachDashboard';
import { santiagoDayKey } from '@/lib/weeks';
import { sumarDias, etiquetaFecha } from '@/lib/semanaUTC';
import { requireCoach } from '@/lib/guard';

export const dynamic = 'force-dynamic';

// INICIO del panel: responde "¿qué tengo que hacer HOY?" — sesiones del día,
// quién ya entrenó, y lo que requiere acción (alumnos sin avance, programas
// que terminan, solicitudes de compra). La foto completa de los alumnos vive
// en /clients; acá solo lo accionable. El ámbar es EL color de "haz algo".

interface Cita {
  id: string;
  client_id: string;
  starts_at: string;
  duration_min: number;
  modality: string;
}

interface Pendiente {
  href: string;
  titulo: string;
  detalle: string;
}

export default async function InicioPage() {
  const { supabase, userId, me } = await requireCoach();

  const list: CoachDashboardRow[] = await loadCoachDashboard(supabase, userId);
  const nombreDe = new Map(list.map((c) => [c.id, c.name]));
  const hoyKey = santiagoDayKey(new Date());

  const clientIds = list.map((c) => c.id);
  const ahora = new Date();

  // Consultas del día, EN BLOQUE y con errores que se propagan — un error
  // tragado acá dibujaría un día tranquilo que es mentira, no dato.
  const [citasRes, planesRes, solicitudesRes, programasRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, client_id, starts_at, duration_min, modality')
      .eq('coach_id', userId)
      .eq('status', 'agendada')
      .gte('starts_at', new Date(ahora.getTime() - 6 * 3600000).toISOString())
      .lte('starts_at', new Date(ahora.getTime() + 36 * 3600000).toISOString())
      .order('starts_at'),
    clientIds.length
      ? supabase
          .from('workout_plans')
          .select('id, client_id, ends_at')
          .in('client_id', clientIds)
          .not('ends_at', 'is', null)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('program_requests')
      .select('id, name, created_at, program_templates ( name )')
      .eq('status', 'nueva')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('program_templates')
      .select('id, name')
      .eq('coach_id', userId)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(3),
  ]);
  for (const r of [citasRes, planesRes, solicitudesRes, programasRes]) {
    if (r.error) throw r.error;
  }

  // sesiones cuyo día EN CHILE es hoy (el rango de la consulta es más ancho a propósito)
  const citasHoy: Cita[] = ((citasRes.data ?? []) as Cita[])
    .filter((c) => santiagoDayKey(new Date(c.starts_at)) === hoyKey);
  const horaStgoDe = (iso: string) => new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));

  const entrenaronHoy = list.filter((c) => c.lastTrainedKey === hoyKey);
  const atencion = list.filter((c) => c.status.needsAttention);

  // programas que terminan en ±7 días: la fecha límite convertida en recordatorio
  const ventanaDesde = sumarDias(hoyKey, -7);
  const ventanaHasta = sumarDias(hoyKey, 7);
  const planesPorTerminar = ((planesRes.data ?? []) as { id: string; client_id: string; ends_at: string }[])
    .map((p) => ({ ...p, finKey: p.ends_at.slice(0, 10) }))
    .filter((p) => p.finKey >= ventanaDesde && p.finKey <= ventanaHasta)
    .sort((a, b) => a.finKey.localeCompare(b.finKey));

  const solicitudes = ((solicitudesRes.data ?? []) as any[]).map((s) => ({
    id: s.id,
    nombre: s.name as string,
    programa: (s.program_templates?.name as string) ?? '(programa borrado)',
  }));
  const programasRecientes = (programasRes.data ?? []) as { id: string; name: string }[];

  // todo lo accionable, una lista: alumno estancado, programa que termina, solicitud
  const pendientes: Pendiente[] = [
    ...atencion.map((c) => ({
      href: `/clients/${c.id}`,
      titulo: c.name,
      detalle: detalleTexto(c, hoyKey),
    })),
    ...planesPorTerminar.map((p) => ({
      href: `/clients/${p.client_id}`,
      titulo: nombreDe.get(p.client_id) ?? 'Alumno',
      detalle: p.finKey < hoyKey
        ? `su programa terminó el ${etiquetaFecha(new Date(`${p.finKey}T00:00:00`))} — asígnale el siguiente`
        : p.finKey === hoyKey
          ? 'su programa termina HOY — deja listo el siguiente'
          : `su programa termina el ${etiquetaFecha(new Date(`${p.finKey}T00:00:00`))}`,
    })),
    ...solicitudes.map((s) => ({
      href: '/programs',
      titulo: s.nombre,
      detalle: `quiere comprar «${s.programa}» — respóndele desde Programas`,
    })),
  ];

  // saludo con hora y fecha de Chile — el panel te habla a ti, no "al coach"
  const horaStgo = parseInt(new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', hour: 'numeric', hour12: false,
  }).format(ahora), 10);
  const saludo = horaStgo < 6 ? 'Buenas noches' : horaStgo < 12 ? 'Buenos días' : horaStgo < 20 ? 'Buenas tardes' : 'Buenas noches';
  const fechaStgo = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', weekday: 'long', day: 'numeric', month: 'long',
  }).format(ahora);
  const primerNombre = (me?.name ?? '').split(' ')[0];

  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <span className="label accent" style={{ textTransform: 'capitalize' }}>{fechaStgo}</span>
        {me?.is_platform_admin && (
          <Link href="/admin/coaches" className="label" style={{ letterSpacing: 2 }}>ADMIN →</Link>
        )}
      </div>
      <h1 className="display" style={{ fontSize: 40 }}>
        {saludo}{primerNombre ? `, ${primerNombre}` : ''}
      </h1>

      <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
        {[
          { v: String(list.length), l: list.length === 1 ? 'ALUMNO' : 'ALUMNOS', alerta: false },
          { v: String(entrenaronHoy.length), l: 'ENTRENARON HOY', alerta: false },
          { v: String(citasHoy.length), l: citasHoy.length === 1 ? 'SESIÓN HOY' : 'SESIONES HOY', alerta: false },
          { v: String(pendientes.length), l: pendientes.length === 1 ? 'PENDIENTE' : 'PENDIENTES', alerta: pendientes.length > 0 },
        ].map((s) => (
          <div key={s.l} className="editor-day" style={{
            flex: 1, minWidth: 140, textAlign: 'center', padding: 16,
            ...(s.alerta ? { borderColor: 'var(--warning)' } : {}),
          }}>
            <div className="display" style={{ fontSize: 26, color: s.alerta ? 'var(--warning)' : 'var(--accent)' }}>
              {s.v}
            </div>
            <div className="label muted" style={{ fontSize: 9, letterSpacing: 1 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="muted" style={{ marginTop: 30 }}>
          Todavía no tienes alumnos. Invita al primero con “+ Cliente” desde la app,
          o deja listo un <Link href="/programs" className="accent">programa</Link> para cuando llegue.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 28 }}>
          {/* HOY: lo operativo del día */}
          <section>
            <span className="label muted" style={{ letterSpacing: 2 }}>Sesiones de hoy</span>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {citasHoy.length === 0 && (
                <p className="muted" style={{ fontSize: 13 }}>
                  Sin sesiones agendadas para hoy. <Link href="/agenda" className="accent">Agendar una →</Link>
                </p>
              )}
              {citasHoy.map((c) => (
                <Link key={c.id} href={`/clients/${c.client_id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  border: '1px solid var(--border)', borderRadius: 12,
                  padding: '10px 14px', background: 'var(--card)',
                }}>
                  <strong className="mono" style={{ fontSize: 15 }}>{horaStgoDe(c.starts_at)}</strong>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{nombreDe.get(c.client_id) ?? 'Alumno'}</strong>
                    <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                      {c.duration_min} min · {c.modality === 'online' ? 'Online' : 'Presencial'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <span className="label muted" style={{ letterSpacing: 2, display: 'block', marginTop: 22 }}>Ya entrenaron hoy</span>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {entrenaronHoy.length === 0 && (
                <p className="muted" style={{ fontSize: 13 }}>Todavía nadie registra entrenamiento hoy.</p>
              )}
              {entrenaronHoy.map((c) => (
                <Link key={c.id} href={`/clients/${c.id}`} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 2px' }}>
                  <span aria-hidden="true" style={{ color: 'var(--accent)' }}>✓</span>
                  <strong style={{ fontSize: 14 }}>{c.name}</strong>
                  <small className="muted">{c.status.done} de {c.status.total} días esta semana</small>
                </Link>
              ))}
            </div>
          </section>

          {/* REQUIERE ACCIÓN: la sección ámbar */}
          <section>
            <span className="label" style={{ letterSpacing: 2, color: pendientes.length > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
              Requiere acción
            </span>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendientes.length === 0 && (
                <p className="muted" style={{ fontSize: 13 }}>Nada pendiente por hoy ✓</p>
              )}
              {pendientes.map((p, i) => (
                <Link key={`${p.href}-${i}`} href={p.href} style={{
                  display: 'block', borderLeft: '3px solid var(--warning)',
                  border: '1px solid var(--border)', borderLeftColor: 'var(--warning)',
                  borderLeftWidth: 3, borderRadius: 12, padding: '10px 14px', background: 'var(--card)',
                }}>
                  <strong style={{ fontSize: 14 }}>{p.titulo}</strong>
                  <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>{p.detalle}</p>
                </Link>
              ))}
              <Link href="/clients" className="label muted" style={{ letterSpacing: 2, marginTop: 6 }}>
                VER TODOS LOS ALUMNOS →
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* accesos rápidos: seguir trabajando donde quedaste */}
      <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="label muted" style={{ letterSpacing: 2 }}>Programas</span>
        {programasRecientes.map((t) => (
          <Link key={t.id} href={`/programs/${t.id}`} className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }}>
            {t.name}
          </Link>
        ))}
        <Link href="/programs" className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }}>
          {programasRecientes.length > 0 ? 'VER TODOS →' : '+ CREAR EL PRIMERO'}
        </Link>
      </div>
    </main>
  );
}
