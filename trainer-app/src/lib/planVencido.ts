// Lógica pura de la fecha límite del plan (v36) — separada de plan.ts para
// que jest pueda importarla sin arrastrar el cliente de Supabase (nativo).

/**
 * ¿El plan ya pasó su fecha límite? Compara solo fechas (YYYY-MM-DD) en la
 * zona del dispositivo — el alumno vive donde vive su teléfono. El día del
 * límite todavía se entrena; vencido es desde el día siguiente.
 */
export function planVencido(endsAt: string | null | undefined, hoy: Date = new Date()): boolean {
  if (!endsAt) return false;
  const key = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return key > endsAt;
}
