/**
 * Los campos que se reescriben cuando una serie ya tenía registro.
 *
 * `logged_by` va incluido a propósito: desde que el coach puede registrar por
 * su alumno, esa columna significa "quién tecleó esto", y al reemplazar el que
 * tecleó es el nuevo. Sin esto el historial atribuye el número a quien ya no fue.
 * `series_id` y `week_number` identifican la fila y por eso no se actualizan.
 */
export type LogEscribible = {
  weight: number;
  reps: number;
  rir: number | null;
  logged_at: string;
  logged_by: string;
};

export function buildLogUpdate(log: LogEscribible): LogEscribible {
  return {
    weight: log.weight,
    reps: log.reps,
    rir: log.rir,
    logged_at: log.logged_at,
    logged_by: log.logged_by,
  };
}
