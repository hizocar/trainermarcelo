import { requireCoach } from '@/lib/guard';
import ProfileForm, { type Profile } from './ProfileForm';

// En qué punto está la vitrina: sin esto, un perfil guardado que no aparecía
// en /coaches era un misterio (le pasó a Yharel).
function EstadoVitrina({ status }: { status: string | null }) {
  const [titulo, texto] =
    status === 'approved' ? ['Visible en el directorio', 'Tu página aparece en elitefitapp.com/coaches.']
    : status === 'pending' ? ['En revisión', 'Tu perfil está en la cola de aprobación. Aparecerá en el directorio apenas se apruebe.']
    : status === 'rejected' ? ['No publicado', 'Tu perfil no fue aprobado para el directorio. Escríbenos si quieres revisarlo.']
    : ['Aún no publicado', 'Completa tu nombre y guarda: tu perfil entra a revisión para aparecer en el directorio.'];
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px',
      background: 'var(--card)', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap',
    }}>
      <span className="label" style={{ color: status === 'approved' ? 'var(--accent)' : 'var(--text-secondary)', letterSpacing: 2 }}>{titulo}</span>
      <span className="muted" style={{ fontSize: 13 }}>{texto}</span>
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const { supabase, userId } = await requireCoach({ allowLocked: true });

  const { data, error } = await supabase
    .from('users')
    .select('name, marketplace_status, slug, bio, instagram, specialties, comunas, services, accepting_clients')
    .eq('id', userId)
    .single();
  if (error) throw error;

  return (
    <>

      <main className="container" style={{ paddingTop: 32, paddingBottom: 64, maxWidth: 720 }}>
        <span className="label accent">Tu vitrina en el marketplace</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <h1 className="display" style={{ fontSize: 40 }}>Mi perfil</h1>
          {(data as Profile).slug && (
            <a
              className="btn btn-ghost"
              style={{ padding: '10px 18px' }}
              href={`/coach/${(data as Profile).slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              VER MI PÁGINA →
            </a>
          )}
        </div>
        <p className="muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 16 }}>
          Esto es lo que ve un alumno cuando le compartes tu página — y donde se venden tus rutinas.
        </p>
        <EstadoVitrina status={(data as Profile).marketplace_status} />
        <ProfileForm initial={data as Profile} />
      </main>
    </>
  );
}
