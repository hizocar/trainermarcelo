import { requireCoach } from '@/lib/guard';
import ProfileForm, { type Profile } from './ProfileForm';

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const { supabase, userId } = await requireCoach({ allowLocked: true });

  const { data, error } = await supabase
    .from('users')
    .select('slug, bio, instagram, specialties, comunas, modality, accepting_clients')
    .eq('id', userId)
    .single();
  if (error) throw error;

  return (
    <main className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <h1 className="display">MI PERFIL</h1>
      <p className="muted" style={{ fontSize: 14, marginBottom: 24 }}>
        Esto es lo que ve un alumno cuando le compartes tu página.
      </p>
      <ProfileForm initial={data as Profile} />
    </main>
  );
}
