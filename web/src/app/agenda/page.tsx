import Link from 'next/link';
import { requireCoach } from '@/lib/guard';
import AgendaForm from './AgendaForm';
import CancelarCita from './CancelarCita';

export const dynamic = 'force-dynamic';

// La agenda del coach: sus sesiones con sus alumnos, las próximas primero.
// v1 deliberadamente lista, no grilla de calendario: con los volúmenes de un
// coach personal, una lista por día se lee más rápido que un mes de celdas.
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function etiquetaDia(iso: string): string {
  const d = new Date(iso);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}
function hora(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default async function AgendaPage() {
  const { supabase, userId } = await requireCoach();

  const [{ data: clients }, { data: citas, error }] = await Promise.all([
    supabase.from('users').select('id, name')
      .eq('role', 'client').eq('coach_id', userId).order('name'),
    supabase.from('appointments')
      .select('id, client_id, starts_at, duration_min, modality, status, note')
      .eq('coach_id', userId)
      .gte('starts_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order('starts_at'),
  ]);
  // Un error tragado acá dibuja una agenda vacía — que es mentira, no dato.
  if (error) throw error;

  const nombre = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const agendadas = (citas ?? []).filter((c) => c.status === 'agendada');
  const porDia = new Map<string, typeof agendadas>();
  for (const c of agendadas) {
    const k = etiquetaDia(c.starts_at);
    porDia.set(k, [...(porDia.get(k) ?? []), c]);
  }
  const canceladas = (citas ?? []).filter((c) => c.status !== 'agendada');

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand" style={{ fontWeight: 900, letterSpacing: 2 }}>
            ELITEFITNESS
          </Link>
          <Link href="/dashboard" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
            VOLVER
          </Link>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 40, paddingBottom: 64, maxWidth: 860 }}>
        <span className="label">Agenda</span>
        <h1 className="display" style={{ marginTop: 4 }}>Tus sesiones</h1>
        <p className="sub" style={{ maxWidth: 520, marginTop: 8 }}>
          Tu alumno ve cada sesión en su app y puede cancelarla hasta 2 horas
          antes — después de eso, solo contigo.
        </p>

        <div style={{ marginTop: 28 }}>
          <AgendaForm clients={(clients ?? []) as { id: string; name: string }[]} />
        </div>

        <section style={{ marginTop: 36 }}>
          {porDia.size === 0 && (
            <p className="muted">No tienes sesiones agendadas. Crea la primera arriba.</p>
          )}
          {Array.from(porDia.entries()).map(([dia, lista]) => (
            <div key={dia} style={{ marginBottom: 20 }}>
              <p className="label" style={{ marginBottom: 8 }}>{dia.toUpperCase()}</p>
              {lista.map((c) => (
                <article key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  border: '1px solid var(--border)', borderRadius: 12,
                  padding: '12px 16px', background: 'var(--card)', marginBottom: 8,
                }}>
                  <strong className="mono" style={{ fontSize: 15 }}>{hora(c.starts_at)}</strong>
                  <div style={{ flex: 1 }}>
                    <strong>{nombre.get(c.client_id) ?? 'Alumno'}</strong>
                    <p className="muted" style={{ fontSize: 12 }}>
                      {c.duration_min} min · {c.modality === 'online' ? 'Online' : 'Presencial'}
                      {c.note ? ` · ${c.note}` : ''}
                    </p>
                  </div>
                  <CancelarCita citaId={c.id} />
                </article>
              ))}
            </div>
          ))}
        </section>

        {canceladas.length > 0 && (
          <details style={{ marginTop: 24 }}>
            <summary className="label" style={{ cursor: 'pointer' }}>
              CANCELADAS RECIENTES ({canceladas.length})
            </summary>
            {canceladas.map((c) => (
              <p key={c.id} className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                {etiquetaDia(c.starts_at)} {hora(c.starts_at)} · {nombre.get(c.client_id) ?? 'Alumno'} ·{' '}
                {c.status === 'cancelada_cliente' ? 'canceló tu alumno' : 'cancelaste tú'}
              </p>
            ))}
          </details>
        )}
      </main>
    </>
  );
}
