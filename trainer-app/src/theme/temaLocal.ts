import { Platform, Settings } from 'react-native';
import { esNombreTema, type NombreTema } from './paletas';

// Dónde vive la apariencia elegida, EN EL APARATO y de lectura SÍNCRONA.
//
// Tiene que ser síncrona porque theme/index.ts decide los colores al
// evaluarse, antes de que cualquier pantalla congele sus StyleSheet. Por eso
// no sirve AsyncStorage.
//   · iOS: Settings (NSUserDefaults), que es síncrono.
//   · Android: Settings NO EXISTE (es solo de iOS), así que el tema se
//     perdía en cada arranque — el coach elegía Marfil y volvía a Carbón.
//     Se usa un archivo diminuto leído con textSync() (expo-file-system 19).
// La elección también viaja en users.theme (v37); esto es solo la copia local.

const ARCHIVO = 'tema.txt';

function archivo() {
  // el import va acá adentro: en jest el módulo nativo no existe y este
  // módulo lo importa TODA la app
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { File, Paths } = require('expo-file-system');
  return new File(Paths.document, ARCHIVO);
}

export function leerTemaLocal(): NombreTema | null {
  try {
    if (Platform.OS === 'ios') {
      const t = Settings.get('tema');
      return esNombreTema(t) ? t : null;
    }
    const f = archivo();
    if (!f.exists) return null;
    const t = f.textSync().trim();
    return esNombreTema(t) ? t : null;
  } catch {
    return null; // sin almacenamiento disponible: Carbón
  }
}

export function guardarTemaLocal(tema: NombreTema): void {
  try {
    if (Platform.OS === 'ios') {
      Settings.set({ tema });
      return;
    }
    const f = archivo();
    if (!f.exists) f.create({ intermediates: true, overwrite: true });
    f.write(tema);
  } catch { /* si no se puede guardar, la cuenta (users.theme) sigue mandando */ }
}
