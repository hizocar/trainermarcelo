import Link from 'next/link';

// Pestañas contextuales del cliente: viven en el cuerpo de la página desde
// que el riel dejó obsoletos los headers. La activa se marca con relleno.

const TABS = [
  { key: 'plan', label: 'PLAN', ruta: '' },
  { key: 'semana', label: 'ESTA SEMANA', ruta: '/week' },
  { key: 'calendario', label: 'CALENDARIO', ruta: '/calendar' },
  { key: 'ejercicio', label: 'POR EJERCICIO', ruta: '/progress' },
] as const;

export type ClientTabKey = typeof TABS[number]['key'];

export default function ClientTabs({ clientId, actual }: { clientId: string; actual?: ClientTabKey }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
      {TABS.map((t) => {
        const activa = t.key === actual;
        return (
          <Link
            key={t.key}
            href={`/clients/${clientId}${t.ruta}`}
            className="btn btn-ghost"
            aria-current={activa ? 'page' : undefined}
            style={{
              padding: '8px 14px',
              ...(activa ? {
                background: 'var(--accent)',
                color: 'var(--bg)',
                borderColor: 'var(--accent)',
              } : {}),
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
