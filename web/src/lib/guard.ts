import { redirect } from 'next/navigation';
import { createClient } from './supabase-server';
import { panelLocked, type GymState } from './marketplace';
import { destino } from './registro';

export type CoachSession = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  me: {
    id: string; name: string; email: string; role: string;
    is_owner: boolean; gym_id: string | null;
    marketplace_status: string | null; is_platform_admin: boolean;
    slug: string | null;
    registro_completo: boolean; perfil_coach_completo: boolean; en_buscador: boolean;
  };
  gym: GymState | null;
  locked: boolean;
};

/**
 * Única puerta del panel. `allowLocked` lo usa /marketplace, que es
 * justamente la página a la que se manda al coach bloqueado: sin esa salida,
 * el guard se redirige a sí mismo en un bucle. `permitirPerfilIncompleto` lo
 * usa /perfil por la misma razón: es adonde se manda al coach cuyo perfil falta.
 *
 * Registro propio (v49): cuenta sin completar → /bienvenida; alumno →
 * /solo-coaches (la web es solo para coaches); coach sin perfil completo →
 * /perfil?completar=1.
 */
export async function requireCoach(
  opts: { allowLocked?: boolean; permitirPerfilIncompleto?: boolean } = {},
): Promise<CoachSession> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me, error } = await supabase
    .from('users')
    .select('id, name, email, role, is_owner, gym_id, marketplace_status, is_platform_admin, slug, registro_completo, perfil_coach_completo, en_buscador')
    .eq('id', user.id)
    .maybeSingle();

  // Un error tragado acá deja pasar a cualquiera: si no se pudo leer, no se entra.
  if (error) throw error;
  if (!me) redirect('/login');

  const d = destino({
    registroCompleto: me.registro_completo,
    role: me.role,
    perfilCoachCompleto: me.perfil_coach_completo,
    nombre: me.name,
  });
  if (d === 'onboarding') redirect('/bienvenida');
  if (d === 'alumno' || d === 'nombre') redirect('/solo-coaches');
  if (d === 'coach-pendiente') redirect('/login');
  if (d === 'perfil-coach' && !opts.permitirPerfilIncompleto) redirect('/perfil?completar=1');

  let gym: GymState | null = null;
  if (me.gym_id) {
    const { data, error: gymError } = await supabase
      .from('gyms')
      .select('subscription_status, free_month_ends_at')
      .eq('id', me.gym_id)
      .maybeSingle();
    if (gymError) throw gymError;
    gym = data;
  }

  const locked = panelLocked(gym);
  if (locked && !opts.allowLocked) redirect('/marketplace');

  return { supabase, userId: user.id, me, gym, locked };
}

export async function requireAdmin(): Promise<CoachSession> {
  // el panel de admin no se bloquea por el perfil de coach de Sebastián
  const session = await requireCoach({ allowLocked: true, permitirPerfilIncompleto: true });
  if (!session.me.is_platform_admin) redirect('/dashboard');
  return session;
}
