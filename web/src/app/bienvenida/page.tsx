import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { nombreEsCorreo } from '@/lib/registro';
import BienvenidaForm from './BienvenidaForm';

export const metadata = { title: 'Bienvenida' };
export const dynamic = 'force-dynamic';

// Cuenta nueva que todavía no fija rol y nombre (llega aquí, por ejemplo,
// quien entra con Google). La web es solo para coaches: completar aquí la deja
// como coach; quien quiera entrenar lo completa en la app.
export default async function BienvenidaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me, error } = await supabase
    .from('users').select('name, registro_completo').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (me?.registro_completo) redirect('/dashboard');

  const sugerido = me?.name && !nombreEsCorreo(me.name) ? me.name : '';
  return <BienvenidaForm nombreSugerido={sugerido} />;
}
