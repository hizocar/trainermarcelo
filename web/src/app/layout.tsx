import type { Metadata, Viewport } from 'next';
import { Anton, Inter } from 'next/font/google';
import './globals.css';

const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const inter = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: {
    default: 'EliteFit · Entrenamiento personalizado',
    template: '%s · EliteFit',
  },
  description:
    'Entrena con un plan diseñado por tu coach, registra cada serie y mira tu progreso semana a semana. App de entrenamiento personalizado con seguimiento real.',
  applicationName: 'EliteFit',
  keywords: ['entrenamiento personalizado', 'coach', 'gimnasio', 'progreso', 'plan de entrenamiento', 'fitness'],
  openGraph: {
    title: 'EliteFit · Entrenamiento personalizado',
    description:
      'Tu plan. Tu progreso. En serio. Registra cada serie y entrena con un plan hecho para ti por tu coach.',
    type: 'website',
    locale: 'es_CL',
    siteName: 'EliteFit',
  },
};

export const viewport: Viewport = {
  themeColor: '#08090A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${anton.variable} ${inter.variable}`}>{children}</body>
    </html>
  );
}
