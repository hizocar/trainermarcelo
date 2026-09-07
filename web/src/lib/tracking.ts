// Resumen de tracking del alumno para la ficha del coach.
//
// La parte del ánimo es ESPEJO de trainer-app/src/lib/mood.ts (decisión de
// arquitectura: lógica pura duplicada entre proyectos, valores idénticos,
// tests con los mismos casos en ambos lados). La base guarda mood como texto
// 1-10; las caras son cinco y el empate de los impares cae HACIA ABAJO — un 7
// es "Normal", no "Con energía": redondear hacia arriba minimizaría lo que el
// alumno sintió.

export const ETIQUETAS_ANIMO: Record<number, string> = {
  1: 'Muy cansado',
  2: 'Cansado',
  3: 'Normal',
  4: 'Con energía',
  5: 'Con mucha energía',
};

/** Valor 1-10 (o promedio) → etiqueta de la cara más cercana; null si no es número. */
export function etiquetaAnimo(valor: number): string | null {
  if (!Number.isFinite(valor)) return null;
  const recortado = Math.min(10, Math.max(1, valor));
  const cara = Math.min(5, Math.max(1, Math.ceil(recortado / 2 - 0.5)));
  return ETIQUETAS_ANIMO[cara];
}

/** Promedio de textos "1".."10" de la base; ignora ilegibles; null si no queda nada. */
export function animoPromedio(moods: string[]): number | null {
  const valores = moods.map(m => parseInt(m, 10)).filter(v => Number.isFinite(v));
  if (valores.length === 0) return null;
  return valores.reduce((a, v) => a + v, 0) / valores.length;
}

/** Segundos → "52 min" / "1 h 05" (para el tiempo medio de sesión). */
export function formatoDuracion(segundos: number): string {
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * % de adherencia: días con al menos una serie registrada vs días
 * planificados por semana × semanas del período. Se recorta a 100 (entrenar
 * días extra no da "más que todo") y devuelve null sin días planificados —
 * mejor no mostrar nada que inventar un porcentaje.
 */
export function adherencia(diasEntrenados: number, planificadosPorSemana: number, semanas: number): number | null {
  const esperados = planificadosPorSemana * semanas;
  if (esperados <= 0) return null;
  return Math.min(100, Math.round((diasEntrenados / esperados) * 100));
}
