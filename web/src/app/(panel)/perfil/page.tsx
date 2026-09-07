import { requireCoach } from '@/lib/guard';
import ProfileForm, { type Profile } from './ProfileForm';

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const { supabase, userId } = await requireCoach({ allowLocked: true });

  const { data, error } = await supabase
    .from('users')
    .select('slug, bio, instagram, specialties, comunas, services, accepting_clients')
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
        <p className="muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 24 }}>
          Esto es lo que ve un alumno cuando le compartes tu página — y donde se venden tus rutinas.
        </p>
        <ProfileForm initial={data as Profile} />
      </main>
    </>
  );
}
