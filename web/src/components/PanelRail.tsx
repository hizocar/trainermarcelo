'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dumbbell } from '@/components/Logo';

// El riel del panel del coach: navegación persistente de íconos, monocroma.
// En desktop es una columna fija a la izquierda; en pantallas angostas baja
// a barra inferior (misma gramática que la tab bar de la app). El activo se
// marca con brillo, no con color — la jerarquía de la casa.

const ICON = {
  clientes: <path d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 .5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5v1H2v-1Zm14-.9V20h6v-1.4c0-2.6-2-4.3-4.6-4.3-.9 0-1.8.2-2.5.6 0 .1 1.1 1.5 1.1 3.2Z" />,
  programas: <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 5h8v2H8V8Zm0 4h8v2H8v-2Zm0 4h5v2H8v-2Z" />,
  biblioteca: <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17ZM6.5 4a.5.5 0 0 0-.5.5V17c.16-.03 1.5 0 1.5 0H18V4H6.5ZM6 19a1 1 0 0 0 0 2h14v-2H6Z" />,
  agenda: <path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7Zm12 7v10H5V9h14ZM7 12h4v4H7v-4Z" />,
  marketplace: <path d="M4 4h16l1 5a3 3 0 0 1-2 2.83V20a1 1 0 0 1-1 1h-4v-6H10v6H6a1 1 0 0 1-1-1v-8.17A3 3 0 0 1 3 9l1-5Zm2 2-.6 3.1A1.4 1.4 0 0 0 6.8 10c.7 0 1.2-.5 1.3-1.1L8.5 6H6Zm4.5 0-.4 2.9c-.1.6.4 1.1 1 1.1h1.8c.6 0 1.1-.5 1-1.1L13.5 6h-3Zm5 0 .4 2.9c.1.6.6 1.1 1.3 1.1a1.4 1.4 0 0 0 1.4-1.9L18 6h-2.5Z" />,
  perfil: <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.1 0-7.5 2.7-7.5 6v1h15v-1c0-3.3-3.4-6-7.5-6Z" />,
  suscripcion: <path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm2 2v2h14V8H5Zm0 5v5h14v-5H5Zm2 2h5v1.6H7V15Z" />,
} as const;

const ITEMS: { href: string; label: string; icon: keyof typeof ICON; activos: string[] }[] = [
  { href: '/dashboard', label: 'CLIENTES', icon: 'clientes', activos: ['/dashboard', '/clients'] },
  { href: '/programs', label: 'PROGRAMAS', icon: 'programas', activos: ['/programs'] },
  { href: '/library', label: 'BIBLIOTECA', icon: 'biblioteca', activos: ['/library'] },
  { href: '/agenda', label: 'AGENDA', icon: 'agenda', activos: ['/agenda'] },
  { href: '/marketplace', label: 'MARKET', icon: 'marketplace', activos: ['/marketplace'] },
  { href: '/perfil', label: 'PERFIL', icon: 'perfil', activos: ['/perfil'] },
  { href: '/subscription', label: 'PLAN', icon: 'suscripcion', activos: ['/subscription'] },
];

export default function PanelRail() {
  const pathname = usePathname();

  return (
    <nav className="panel-rail" aria-label="Panel del coach">
      <Link href="/dashboard" className="panel-rail-brand" title="EliteFitness">
        <Dumbbell size={26} />
      </Link>
      <div className="panel-rail-items">
        {ITEMS.map((item) => {
          const activo = item.activos.some(a => pathname === a || pathname.startsWith(a + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`panel-rail-item${activo ? ' activo' : ''}`}
              aria-current={activo ? 'page' : undefined}
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                {ICON[item.icon]}
              </svg>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
