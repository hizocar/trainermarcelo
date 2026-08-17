// El objetivo de repeticiones se guarda como texto ("8-12") desde antes de que
// existiera este módulo, y `repTopOf` en progress.ts lee de ahí el tope del
// rango para sugerir subidas de peso. Por eso el coach escribe dos números y
// nosotros armamos el mismo formato de siempre: sin migración, y la
// autoprogresión sigue funcionando.

/** Lo que usa la base cuando el coach no especifica nada. */
export const DEFAULT_REPS = '8-12';

/** Separa "8-12" en los dos campos del formulario. */
export function parseRepsRange(value?: string | null): { from: string; to: string } {
  if (!value) return { from: '', to: '' };
  const rango = value.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (rango) return { from: rango[1], to: rango[2] };
  // un número solo, o un texto viejo escrito a mano: se muestra tal cual en
  // "desde" para no perderlo al editar
  return { from: value.trim(), to: '' };
}

/** Arma el string que se guarda, desde los dos campos. */
export function formatRepsRange(from: string, to: string): string {
  const desde = from.trim();
  const hasta = to.trim();
  if (desde && hasta) return `${desde}-${hasta}`;
  if (desde) return desde;
  if (hasta) return hasta;
  return DEFAULT_REPS;
}
