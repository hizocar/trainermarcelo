import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase-server';
import { SERVICIO_LABEL } from '@/lib/marketplace';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Entrenadores disponibles — EliteFitness',
  description:
    'Mira los entrenadores del directorio, por comuna y modalidad, y pide que te contacte el que más te acomode.',
};

// El directorio público. Lee public_coaches, que anon puede leer y que solo
// expone lo publicable — sin teléfonos ni correos. Sin filtros a propósito:
// con los coaches del arranque una grilla limpia basta, y un filtro sobre
// seis tarjetas es un formulario que estorba. Se agregan cuando haya volumen.
export default async function CoachesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_coaches')
    .select('slug, name, avatar_url, bio, specialties, comunas, services, accepting_clients')
    .order('name');
  // Un error tragado acá dibuja "no hay coaches" cuando la consulta falló.
  if (error) throw error;

  const coaches = (data ?? []).filter((c) => c.accepting_clients);

  return (
    <>
      <nav className="nav">
        <div className="container nav-inner">
          <Link href="/" className="brand"><Logo /></Link>
          <Link href="/busco-coach" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
            Busco entrenador
          </Link>
        </div>
      </nav>

      <main className="container" style={{ paddingTop: 48, paddingBottom: 64 }}>
        <span className="label">Directorio</span>
        <h1 className="display" style={{ marginTop: 4 }}>ENTRENADORES DISPONIBLES</h1>
        <p className="sub" style={{ maxWidth: 520, marginTop: 8 }}>
          Todos revisados a mano. Elige uno y pide que te contacte — o{' '}
          <Link href="/busco-coach" className="accent">cuéntanos qué buscas</Link> y
          deja que te escriban ellos.
        </p>

        {coaches.length === 0 ? (
          <div style={{ marginTop: 40, maxWidth: 460 }}>
            <p className="muted">
              El directorio está recién abriendo y los primeros entrenadores están
              en revisión. Mientras tanto, <Link href="/busco-coach" className="accent">
              cuéntanos qué buscas</Link> y te escribe uno por WhatsApp.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid', gap: 16, marginTop: 32,
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          }}>
            {coaches.map((c) => (
              <Link key={c.slug} href={`/coach/${c.slug}`} style={{
                border: '1px solid var(--border)', borderRadius: 12,
                padding: 20, background: 'var(--card)', display: 'block',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {c.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar_url} alt="" width={48} height={48}
                         style={{ borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <span aria-hidden style={{
                      width: 48, height: 48, borderRadius: '50%',
                      border: '1px solid var(--border)', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                    }}>{c.name.slice(0, 1)}</span>
                  )}
                  <div>
                    <strong>{c.name}</strong>
                    <p className="label" style={{ marginTop: 2 }}>
                      {[
                        ...(c.comunas ?? []).slice(0, 2),
                        ...(c.services ?? []).map((v: string) => SERVICIO_LABEL[v] ?? v),
                      ].join(' · ') || 'Coach'}
                    </p>
                  </div>
                </div>

                {c.bio && (
                  <p className="muted" style={{
                    fontSize: 13, lineHeight: 1.5, marginTop: 12,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{c.bio}</p>
                )}

                {(c.specialties ?? []).length > 0 && (
                  <p className="label" style={{ marginTop: 12, opacity: 0.7 }}>
                    {c.specialties!.slice(0, 3).join(' · ')}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}

        <p className="muted" style={{ marginTop: 48, fontSize: 13 }}>
          ¿Eres entrenador? <Link href="/unete" className="accent">Aparece acá</Link> — es gratis.
        </p>
      </main>
    </>
  );
}
