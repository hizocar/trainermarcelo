import type { Metadata, Viewport } from 'next';
import { Anton, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-mono' });

export const metadata: Metadata = {
  metadataBase: new URL('https://elitefitapp.com'),
  title: {
    default: 'EliteFitness · Software para entrenadores',
    template: '%s · EliteFitness',
  },
  // Le habla al coach, igual que la portada: es él quien decide y paga.
  description:
    'Arma los planes de tus alumnos desde el computador y mira quién entrenó y quién no, sin preguntar. Clientes ilimitados desde $4.990 al mes.',
  applicationName: 'EliteFitness',
  keywords: ['software para entrenadores', 'app para personal trainer', 'planes de entrenamiento', 'gestión de clientes', 'coach', 'gimnasio'],
  openGraph: {
    title: 'Deja la planilla. No a tus alumnos.',
    description:
      'Arma los planes desde el computador, mira quién entrenó sin preguntar y deja que tus alumnos registren cada serie en el teléfono.',
    type: 'website',
    locale: 'es_CL',
    siteName: 'EliteFitness',
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
      <body className={`${anton.variable} ${inter.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
