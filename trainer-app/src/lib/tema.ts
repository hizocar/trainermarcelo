import { supabase } from './supabase';
import { track } from './analytics';
import { esNombreTema, type NombreTema } from '../theme/paletas';
import { leerTemaLocal, guardarTemaLocal } from '../theme/temaLocal';

// La apariencia elegida vive en dos lugares: el aparato (theme/temaLocal.ts,
// que theme/index.ts lee síncrono al arranque) y users.theme en la base (v37),
// para que la elección viaje con la cuenta a la web y a otros dispositivos.
// Los estilos de toda la app se congelan al cargar el bundle, así que un
// cambio de tema se aplica al REABRIR la app — igual que cambiar el idioma
// del teléfono.

export function temaActivo(): NombreTema {
  return leerTemaLocal() ?? 'carbon';
}

/** Guarda la elección local y en la cuenta. Lanza si la base falla. */
export async function elegirTema(tema: NombreTema, userId: string): Promise<void> {
  guardarTemaLocal(tema);
  const { error } = await supabase.from('users').update({ theme: tema }).eq('id', userId);
  if (error) throw new Error(error.message);
  track('tema_elegido', { tema });
}

/**
 * Al iniciar sesión: si la cuenta trae un tema elegido en otro dispositivo
 * (o en el panel web), se copia al aparato — se verá en la próxima apertura
 * de la app. Funciona en iOS y en Android (ver theme/temaLocal.ts).
 */
export function sincronizarTemaLocal(temaDeLaCuenta: string | null | undefined): void {
  if (!esNombreTema(temaDeLaCuenta)) return;
  if (leerTemaLocal() !== temaDeLaCuenta) guardarTemaLocal(temaDeLaCuenta);
}
