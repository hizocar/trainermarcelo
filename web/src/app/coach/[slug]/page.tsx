import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';

export const revalidate = 300;

async function loadCoach(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_coaches')
    .select('slug, name, avatar_url, bio, instagram, specialties, comunas, modality, accepting_clients')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const coach = await loadCoach(slug);
  if (!coach) return { title: 'Entrenador no encontrado — EliteFitness' };
  return {
    title: `${coach.name} — Entrenador en EliteFitness`,
    description: coach.bio ?? `${coach.name} entrena en EliteFitness.`,
  };
}

export default async function CoachPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const coach = await loadCoach(slug);
  if (!coach) notFound();

  return (
    <main className="container" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 640 }}>
      {coach.avatar_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coach.avatar_url} alt={coach.name} width={96} height={96}
             style={{ borderRadius: '50%', objectFit: 'cover' }} />
      )}

      <h1 className="display" style={{ marginTop: 16 }}>{coach.name.toUpperCase()}</h1>

      <p className="label" style={{ marginTop: 4 }}>
        {(coach.comunas ?? []).join(' · ')}
        {coach.modality === 'online' ? ' Online' : coach.modality === 'ambas' ? ' · También online' : ''}
      </p>

      {coach.bio && <p style={{ marginTop: 20, lineHeight: 1.7 }}>{coach.bio}</p>}

      {(coach.specialties ?? []).length > 0 && (
        <ul style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20, listStyle: 'none', padding: 0 }}>
          {coach.specialties!.map((s: string) => (
            <li key={s} className="label" style={{
              border: '1px solid var(--border)', borderRadius: 99, padding: '5px 12px',
            }}>{s}</li>
          ))}
        </ul>
      )}

      {coach.instagram && (
        <p className="muted" style={{ marginTop: 20, fontSize: 14 }}>
          <a href={`https://instagram.com/${coach.instagram}`} target="_blank" rel="noopener noreferrer">
            @{coach.instagram}
          </a>
        </p>
      )}

      <a className="btn btn-primary" href="/busco-coach" style={{ marginTop: 32 }}>
        {coach.accepting_clients ? 'QUIERO ENTRENAR CON UN COACH' : 'BUSCAR OTRO ENTRENADOR'}
      </a>
    </main>
  );
}
