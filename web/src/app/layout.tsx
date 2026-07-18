import type { Metadata } from 'next';
import { Anton, Inter } from 'next/font/google';
import './globals.css';

const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const inter = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Marcelo Herrera · Entrenamiento personalizado',
  description:
    'App de entrenamiento personalizado con seguimiento de progreso, planes por objetivos y acompañamiento de tu coach.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${anton.variable} ${inter.variable}`}>{children}</body>
    </html>
  );
}
