import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase-server';
import { SERVICIO_LABEL } from '@/lib/marketplace';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Entrenadores disponibles — EliteFitness',
  description:
    'Mira los entrenadores del directorio y pide que te contacte el que más te acomode. Todos revisados a mano.',
};

// El directorio público. La tarjeta es un retrato — en un marketplace de
// entrenadores el producto es la persona, no una fila de metadatos. La foto
// va en blanco y negro (el monocromo del sitio aplicado a la fotografía) y
// recupera el color al pasar el cursor. Sin ámbar: es página de cliente, y el
// ámbar del sistema significa "el coach tiene que hacer algo".
//
// Lee public_coaches, que anon puede leer y solo expone lo publicable — sin
// teléfonos ni correos. Sin filtros a propósito: se agregan cuando haya
// volumen que filtrar.
export default async function CoachesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_coaches')
    .select('slug, name, avatar_url, bio, specialties, comunas, services, accepting_clients')
    .order('name');
  // Un error tragado acá dibuja "no hay coaches" cuando la consulta falló.
  if (error) throw error;

  const coaches = (data ?? []).filter((c) => c.accepting_clients);

  // La línea de especificación bajo el nombre: comuna y servicios como ficha
  // técnica, en mono. "ÑUÑOA · GIMNASIO · ONLINE".
  const spec = (c: { comunas: string[] | null; services: string[] | null }) =>
    [
      ...(c.comunas ?? []).slice(0, 2),
      ...(c.services ?? []).map((v) => SERVICIO_LABEL[v] ?? v),
    ].join(' · ');

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

      <main className="container" style={{ paddingTop: 56, paddingBottom: 72 }}>
        <div className="dir-head">
          <div>
            <span className="label">Directorio</span>
            <h1 className="display" style={{ marginTop: 6 }}>
              Entrenadores<br />disponibles
            </h1>
          </div>
          <p className="dir-alt">
            ¿No sabes cuál elegir? <Link href="/busco-coach">Cuéntanos qué buscas</Link>
          </p>
        </div>
        <p className="sub" style={{ maxWidth: 480, marginTop: 14 }}>
          Todos revisados a mano. Elige uno, mira su perfil y pide que te
          contacte por WhatsApp — sin crear cuenta y sin costo para ti.
        </p>

        {coaches.length === 0 ? (
          <div style={{ marginTop: 48, maxWidth: 460 }}>
            <p className="muted">
              El directorio está recién abriendo y los primeros entrenadores están
              en revisión. Mientras tanto, <Link href="/busco-coach" className="accent">
              cuéntanos qué buscas</Link> y te escribe uno por WhatsApp.
            </p>
          </div>
        ) : (
          <div className="coach-grid">
            {coaches.map((c) => (
              <Link key={c.slug} href={`/coach/${c.slug}`} className="coach-card">
                <div className="coach-photo">
                  {c.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar_url} alt={`${c.name}, entrenador`} loading="lazy" />
                  ) : (
                    <span className="coach-monogram" aria-hidden>{c.name.slice(0, 1)}</span>
                  )}
                  <div className="coach-scrim">
                    <p className="coach-name">{c.name}</p>
                    {spec(c) && <p className="coach-spec">{spec(c)}</p>}
                  </div>
                </div>

                {(c.bio || (c.specialties ?? []).length > 0) && (
                  <div className="coach-body">
                    {c.bio && <p className="coach-bio">{c.bio}</p>}
                    {(c.specialties ?? []).length > 0 && (
                      <p className="coach-tags">{c.specialties!.slice(0, 3).join(' · ')}</p>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        <div className="dir-band">
          <div>
            <h2>¿Prefieres que te elijan a ti?</h2>
            <p>Cuéntanos qué buscas y deja que los entrenadores se postulen.</p>
          </div>
          <Link href="/busco-coach" className="btn btn-primary">Publicar lo que busco</Link>
        </div>

        <p className="muted" style={{ marginTop: 28, fontSize: 13 }}>
          ¿Eres entrenador? <Link href="/unete" className="accent">Aparece acá</Link> — es gratis.
        </p>
      </main>
    </>
  );
}
