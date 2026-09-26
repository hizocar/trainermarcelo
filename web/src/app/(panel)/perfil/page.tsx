import { requireCoach } from '@/lib/guard';
import { faltantesPerfil } from '@/lib/registro';
import ProfileForm, { type Profile } from './ProfileForm';

// En qué punto está la vitrina: sin esto, un perfil guardado que no aparecía
// en /coaches era un misterio (le pasó a Yharel). Desde v49 son dos datos: el
// interruptor del coach (en_buscador) y la aprobación (marketplace_status).
function EstadoVitrina({ status, enBuscador }: { status: string | null; enBuscador: boolean }) {
  const [titulo, texto] =
    !enBuscador ? ['Oculto del buscador', 'Solo te ven tus alumnos. Enciende "Aparecer en el buscador" cuando quieras recibir alumnos nuevos.']
    : status === 'approved' ? ['Visible en el buscador', 'Tu página aparece en elitefitapp.com/coaches y en la app.']
    : status === 'rejected' ? ['No publicado', 'Tu perfil no fue aprobado para el buscador. Escríbenos si quieres revisarlo.']
    : ['En revisión', 'Revisamos tu perfil antes de mostrarlo en el buscador. Mientras, ya puedes trabajar con tus alumnos.'];
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px',
      background: 'var(--card)', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap',
    }}>
      <span className="label" style={{ color: enBuscador && status === 'approved' ? 'var(--accent)' : 'var(--text-secondary)', letterSpacing: 2 }}>{titulo}</span>
      <span className="muted" style={{ fontSize: 13 }}>{texto}</span>
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default async function PerfilPage({
  searchParams,
}: { searchParams: Promise<{ completar?: string }> }) {
  const { supabase, userId } = await requireCoach({ allowLocked: true, permitirPerfilIncompleto: true });
  const { completar } = await searchParams;

  const { data, error } = await supabase
    .from('users')
    .select('name, marketplace_status, slug, bio, instagram, specialties, comunas, services, accepting_clients, avatar_url, en_buscador, perfil_coach_completo')
    .eq('id', userId)
    .single();
  if (error) throw error;
  const perfil = data as Profile & { perfil_coach_completo: boolean };

  // el guardia manda acá con ?completar=1; también si entra solo y le falta algo
  const modoCompletar = completar === '1' || !perfil.perfil_coach_completo || (perfil.name ?? '').includes('@');
  const falta = faltantesPerfil(perfil);

  return (
    <main className="container" style={{ paddingTop: 32, paddingBottom: 64, maxWidth: 720 }}>
      <span className="label accent">{modoCompletar ? 'Un paso más' : 'Tu vitrina en el marketplace'}</span>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1 className="display" style={{ fontSize: 40 }}>{modoCompletar ? 'Completa tu perfil' : 'Mi perfil'}</h1>
        {perfil.slug && !modoCompletar && (
          <a
            className="btn btn-ghost"
            style={{ padding: '10px 18px' }}
            href={`/coach/${perfil.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            VER MI PÁGINA →
          </a>
        )}
      </div>
      <p className="muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 16 }}>
        {modoCompletar
          ? `Es lo que ven tus alumnos al abrir tu perfil en la app.${falta.length ? ` Falta: ${falta.join(', ')}.` : ''}`
          : 'Esto es lo que ve un alumno cuando le compartes tu página — y donde se venden tus rutinas.'}
      </p>
      {!modoCompletar && <EstadoVitrina status={perfil.marketplace_status} enBuscador={perfil.en_buscador} />}
      <ProfileForm initial={perfil} userId={userId} completar={modoCompletar} />
    </main>
  );
}
