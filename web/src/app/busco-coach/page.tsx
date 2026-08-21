import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import RequestForm from './RequestForm';

export const metadata: Metadata = {
  title: 'Busco entrenador — EliteFitness',
  description:
    'Cuéntanos qué buscas y un entrenador te escribe por WhatsApp. Sin crear cuenta y sin costo para ti.',
};

export default async function BuscoCoachPage({
  searchParams,
}: { searchParams: Promise<{ coach?: string }> }) {
  const { coach: slug } = await searchParams;

  // El "Me interesa" del directorio llega con ?coach=slug. Se resuelve acá,
  // en el servidor y contra public_coaches, para que el formulario muestre el
  // nombre real — y un slug inventado en la URL simplemente no marca a nadie.
  let preferred: { slug: string; name: string } | null = null;
  if (slug) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('public_coaches')
      .select('slug, name, accepting_clients')
      .eq('slug', slug)
      .maybeSingle();
    if (data?.accepting_clients) preferred = { slug: data.slug, name: data.name };
  }

  return (
    <div className="auth-wrap">
      <RequestForm preferred={preferred} />
    </div>
  );
}
