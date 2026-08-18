// Qué día del selector de TodayScreen queda seleccionado tras cargar/recalcular
// la semana. Extraído aparte porque la regla tiene una vuelta: la selección
// manual del alumno gana SOLO mientras ese día siga incompleto. Si el alumno
// completa el día que estaba mirando y vuelve a la pantalla, no debe quedar
// parado frente a un día con todos los anillos llenos — hay que empujarlo al
// siguiente incompleto.
//
// Pero avanzar tiene que disparar solo en la TRANSICIÓN de incompleto a
// completo, no cada vez que el día seleccionado resulta estar completo. Si
// el alumno elige a propósito revisar un día viejo ya completo (para ver qué
// peso usó, por ejemplo), y la pantalla vuelve a tomar foco, `applyWeek` se
// reejecuta con la misma selección: sin esta distinción, cada visita lo
// expulsaría al siguiente día incompleto en vez de dejarlo revisar.

export interface SelectableDay {
  id: string;
  week_day?: number | null;
}

/**
 * @param days lista de días de la semana ya cargada, en orden de plan
 * @param completedIds ids de los días que están 100% registrados (mismo
 *   criterio que el resto de la pantalla: total > 0 && done >= total)
 * @param previousSelectedId el día que venía seleccionado antes de este
 *   recálculo (o null si no había ninguno)
 * @param todayWeekDay día de la semana de hoy (0=domingo, numeración JS)
 * @param previousSelectionWasComplete si el día que venía seleccionado YA
 *   estaba completo antes de este recálculo (la vuelta anterior). Distingue
 *   "se acaba de completar" (avanza) de "se eligió para revisarlo, ya
 *   estaba completo" (se respeta).
 * @returns el id del día que corresponde seleccionar, o null si `days` está vacío
 */
export function pickSelectedDayId(
  days: SelectableDay[],
  completedIds: Set<string>,
  previousSelectedId: string | null,
  todayWeekDay: number,
  previousSelectionWasComplete: boolean,
): string | null {
  if (days.length === 0) return null;

  const prevIndex = previousSelectedId ? days.findIndex(d => d.id === previousSelectedId) : -1;

  // Sin selección previa, o el id ya no existe en esta lista (p.ej. el coach
  // reordenó el plan): mismo fallback de siempre — primer incompleto, si no
  // el de hoy, si no el primero.
  if (prevIndex === -1) {
    const firstIncomplete = days.find(d => !completedIds.has(d.id));
    if (firstIncomplete) return firstIncomplete.id;
    const todaysDay = days.find(d => d.week_day === todayWeekDay);
    return (todaysDay ?? days[0]).id;
  }

  const prev = days[prevIndex];
  if (!completedIds.has(prev.id)) return prev.id; // selección previa incompleta: se respeta

  // La selección previa ya está completa ahora. Si YA estaba completa antes
  // (se eligió para revisarla), se respeta y no se mueve.
  if (previousSelectionWasComplete) return prev.id;

  // Recién se completó (transición incompleto → completo): saltar al
  // siguiente incompleto, empezando justo después y dando la vuelta al
  // final de la lista.
  for (let offset = 1; offset <= days.length; offset++) {
    const candidate = days[(prevIndex + offset) % days.length];
    if (!completedIds.has(candidate.id)) return candidate.id;
  }

  // Todos completos: no hay a dónde saltar, se queda donde estaba (la
  // tarjeta de "semana completa" ya cubre este caso en la UI).
  return prev.id;
}
