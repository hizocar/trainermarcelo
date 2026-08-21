import { notFound } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import { SERVICIO_LABEL } from '@/lib/marketplace';

export const revalidate = 300;

async function loadCoach(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_coaches')
    .select('slug, name, avatar_url, bio, instagram, specialties, comunas, services, accepting_clients')
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
    <>
    {/* Esta URL se comparte suelta (Instagram, WhatsApp): quien llega no vino
        navegando desde el sitio, así que el header es su único marco. */}
    <nav className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand"><Logo /></Link>
        <Link href="/coaches" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
          Ver entrenadores
        </Link>
      </div>
    </nav>

    <main className="container" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 640 }}>
      {coach.avatar_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coach.avatar_url} alt={coach.name} width={96} height={96}
             style={{ borderRadius: '50%', objectFit: 'cover' }} />
      )}

      <h1 className="display" style={{ marginTop: 16 }}>{coach.name.toUpperCase()}</h1>

      <p className="label" style={{ marginTop: 4 }}>
        {[
          ...(coach.comunas ?? []),
          ...(coach.services ?? []).map((v: string) => SERVICIO_LABEL[v] ?? v),
        ].join(' · ')}
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

      {/* Con cupo, la solicitud sale pre-marcada para ESTE coach (?coach=slug):
          la ve destacada y postula sin esperar las 12 horas. Sin cupo, el
          formulario genérico de siempre. */}
      <a className="btn btn-primary"
         href={coach.accepting_clients ? `/busco-coach?coach=${coach.slug}` : '/busco-coach'}
         style={{ marginTop: 32 }}>
        {coach.accepting_clients ? 'ME INTERESA — QUE ME CONTACTE' : 'BUSCAR OTRO ENTRENADOR'}
      </a>

      <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
        <a href="/coaches">← Ver todos los entrenadores</a>
      </p>
    </main>
    </>
  );
}
