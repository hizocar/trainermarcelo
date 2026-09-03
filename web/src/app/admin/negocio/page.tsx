import Link from 'next/link';
import { requireAdmin } from '@/lib/guard';
import { PLANS, clp, mrrClp } from '@/lib/plans';
import RegalarPanel from './RegalarPanel';

export const dynamic = 'force-dynamic';

// Las cifras del negocio, en una pantalla. El embudo completo del marketplace
// y el MRR real — solo lo que se cobra por Flow, nada puesto a mano cuenta
// como renta. El ámbar marca lo único que pide acción del admin: coaches
// esperando aprobación y regalos vencidos sin convertir.
export default async function NegocioPage() {
  const { supabase } = await requireAdmin();

  const [{ data: funnelRows, error: funnelError }, { data: pagando, error: pagandoError }] =
    await Promise.all([
      supabase.from('admin_funnel').select('*'),
      supabase.from('admin_pagando').select('plan_tier, gimnasios'),
    ]);
  // Un error tragado acá pinta el negocio en cero — que es mentira, no dato.
  if (funnelError) throw funnelError;
  if (pagandoError) throw pagandoError;

  const f = (funnelRows ?? [])[0];
  if (!f) throw new Error('El embudo no devolvió datos para esta cuenta.');

  const mrr = mrrClp(pagando ?? []);
  const stat = (v: number, alerta = false) => (
    <strong className="mono" style={{
      fontSize: 26, display: 'block',
      color: alerta && v > 0 ? 'var(--warning)' : 'var(--text)',
    }}>{v}</strong>
  );

  const bloque: React.CSSProperties = {
    border: '1px solid var(--border)', borderRadius: 12,
    padding: '16px 18px', background: 'var(--card)',
  };
  const grilla: React.CSSProperties = {
    display: 'grid', gap: 12, marginTop: 14,
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  };

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand" style={{ fontWeight: 900, letterSpacing: 2 }}>
            ELITEFITNESS
          </Link>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/admin/coaches" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              COACHES POR APROBAR
            </Link>
            <Link href="/dashboard" className="btn btn-ghost" style={{ padding: '10px 18px' }}>
              VOLVER
            </Link>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 40, paddingBottom: 64, maxWidth: 860 }}>
        <span className="label">Negocio</span>
        <h1 className="display" style={{ marginTop: 4 }}>La renta, sin maquillaje</h1>

        {/* La cifra que importa, primero y sola */}
        <section style={{ ...bloque, marginTop: 28, borderColor: 'var(--border-light)' }}>
          <span className="label">MRR — lo que Flow cobra cada mes</span>
          <strong className="mono" style={{ fontSize: 44, display: 'block', marginTop: 4 }}>
            {clp(mrr)}
          </strong>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {(pagando ?? []).length === 0
              ? 'Nadie paga por Flow todavía. Los gimnasios en "active" sin suscripción de Flow no cuentan: eso no es renta.'
              : (pagando ?? []).map((p) => {
                  const plan = PLANS.find((x) => x.tier === p.plan_tier);
                  return `${p.gimnasios} × ${plan?.name ?? p.plan_tier} (${clp(plan?.monthly ?? 0)})`;
                }).join(' + ')}
          </p>
        </section>

        <section style={{ marginTop: 28 }}>
          <span className="label">El embudo — de visita a renta</span>
          <div style={grilla}>
            <div style={bloque}>{stat(f.solicitudes_abiertas)}<span className="label">Solicitudes abiertas</span></div>
            <div style={bloque}>{stat(f.postulaciones)}<span className="label">Postulaciones</span></div>
            <div style={bloque}>{stat(f.solicitudes_tomadas)}<span className="label">Tomadas</span></div>
            <div style={bloque}>{stat(f.regalos_corriendo)}<span className="label">Regalos corriendo</span></div>
            <div style={bloque}>{stat(f.regalos_vencidos, true)}<span className="label">Regalos vencidos sin convertir</span></div>
          </div>
          {f.solicitudes_vencidas > 0 && (
            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
              {f.solicitudes_vencidas} solicitud{f.solicitudes_vencidas === 1 ? '' : 'es'} vencieron sin
              que nadie las tomara — demanda que se perdió por falta de oferta.
            </p>
          )}
        </section>

        <section style={{ marginTop: 28 }}>
          <RegalarPanel />
        </section>

        <section style={{ marginTop: 28 }}>
          <span className="label">La oferta — el directorio</span>
          <div style={grilla}>
            <div style={bloque}>{stat(f.coaches_pendientes, true)}<span className="label">Esperando aprobación</span></div>
            <div style={bloque}>{stat(f.en_directorio)}<span className="label">En el directorio</span></div>
            <div style={bloque}>{stat(f.con_coach_elegido)}<span className="label">Pedidos por nombre</span></div>
            <div style={bloque}>{stat(f.comentarios)}<span className="label">Comentarios de alumnos</span></div>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
            "Pedidos por nombre" mide qué fichas convierten: cada uno nació en el
            perfil de un coach.
          </p>
        </section>
      </main>
    </>
  );
}
