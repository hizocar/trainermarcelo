import type { Metadata } from 'next';
import RequestForm from './RequestForm';

export const metadata: Metadata = {
  title: 'Busco entrenador — EliteFitness',
  description:
    'Cuéntanos qué buscas y un entrenador te escribe por WhatsApp. Sin crear cuenta y sin costo para ti.',
};

export default function BuscoCoachPage() {
  return <div className="auth-wrap"><RequestForm /></div>;
}
