import { Platform, Settings } from 'react-native';
import { supabase } from './supabase';
import { track } from './analytics';
import { esNombreTema, type NombreTema } from '../theme/paletas';

// La apariencia elegida vive en dos lugares: Settings (NSUserDefaults, que
// theme/index.ts lee síncrono al arranque) y users.theme en la base (v37),
// para que la elección viaje con la cuenta a la web y a otros dispositivos.
// Los estilos de toda la app se congelan al cargar el bundle, así que un
// cambio de tema se aplica al REABRIR la app — igual que cambiar el idioma
// del teléfono.

export function temaActivo(): NombreTema {
  try {
    if (Platform.OS === 'ios') {
      const t = Settings.get('tema');
      if (esNombreTema(t)) return t;
    }
  } catch { /* sin Settings: Carbón */ }
  return 'carbon';
}

/** Guarda la elección local y en la cuenta. Lanza si la base falla. */
export async function elegirTema(tema: NombreTema, userId: string): Promise<void> {
  if (Platform.OS === 'ios') Settings.set({ tema });
  const { error } = await supabase.from('users').update({ theme: tema }).eq('id', userId);
  if (error) throw new Error(error.message);
  track('tema_elegido', { tema });
}

/**
 * Al iniciar sesión: si la cuenta trae un tema elegido en otro dispositivo
 * (o en el panel web), se copia al Settings local — se verá en la próxima
 * apertura de la app.
 */
export function sincronizarTemaLocal(temaDeLaCuenta: string | null | undefined): void {
  try {
    if (Platform.OS !== 'ios' || !esNombreTema(temaDeLaCuenta)) return;
    if (Settings.get('tema') !== temaDeLaCuenta) Settings.set({ tema: temaDeLaCuenta });
  } catch { /* sin Settings: nada que sincronizar */ }
}
