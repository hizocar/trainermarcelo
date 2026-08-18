import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Body, { type Slug, type ExtendedBodyPart } from 'react-native-body-highlighter';
import { SLUG_POR_GRUPO, type MuscleGroup } from '../../lib/muscles';
import { colors, spacing } from '../../theme';

// Mapa muscular anatómico. El dibujo viene de `react-native-body-highlighter`
// (MIT): son trazos anatómicos reales, en vez del muñeco de bloques que había
// antes. Lo que sí es nuestro es el monocromo: la librería trae azules por
// omisión y acá la intensidad se comunica con BRILLO, como el resto de la app.
interface Props {
  /** intensidad 0..1 por grupo muscular, en español */
  highlights: Record<string, number>;
  height?: number;
  showLabels?: boolean;
}

// Cuatro escalones de brillo: el músculo más trabajado llega al gris claro del
// sistema. No hay color porque no lo hay en ninguna parte de la app. Los tres
// grises intermedios (`#3A4048`, `#5B636D`, `#8A929B`) no están en `colors.*`
// a propósito: son escalones de una rampa de intensidad construida para esta
// escala de 4 pasos, no tokens semánticos reutilizables en el resto de la app.
export const ESCALA = ['#3A4048', '#5B636D', '#8A929B', colors.accent] as const;

/** 0..1 → índice 1..4 de la escala. 0, negativo o NaN = sin resaltar. */
export function nivel(intensidad: number): number {
  if (!(intensidad > 0)) return 0; // cubre <= 0 y NaN (NaN > 0 es false)
  return Math.min(ESCALA.length, Math.max(1, Math.ceil(intensidad * ESCALA.length)));
}

/** Traduce nuestros grupos a las zonas de la librería, quedándose con el nivel más alto. */
export function aPartesDelCuerpo(highlights: Record<string, number>): ExtendedBodyPart[] {
  const porSlug: Record<string, number> = {};
  Object.entries(highlights).forEach(([grupo, intensidad]) => {
    const slug = SLUG_POR_GRUPO[grupo as MuscleGroup];
    if (!slug) return; // grupo que la librería no dibuja: se ignora en el muñeco
    const n = nivel(intensidad);
    if (n === 0) return;
    // tres cabezas de hombro caen en `deltoids`: manda la más trabajada
    porSlug[slug] = Math.max(porSlug[slug] ?? 0, n);
  });
  return Object.entries(porSlug).map(([slug, intensity]) => ({
    slug: slug as Slug,
    intensity,
  }));
}

export default function MuscleMap({ highlights, height = 180, showLabels = true }: Props) {
  // la librería dibuja a 400×200 por unidad de escala
  const scale = height / 400;
  // sin useMemo: los llamadores pasan `highlights` inline en el JSX, así que
  // la identidad cambia en cada render y la memoización nunca acertaría.
  const data = aPartesDelCuerpo(highlights);

  return (
    <View style={styles.cuerpos}>
      <View style={styles.cuerpo}>
        <Body
          data={data}
          side="front"
          gender="male"
          scale={scale}
          colors={[...ESCALA]}
          border={colors.borderLight}
          defaultFill={colors.surface}
        />
        {showLabels ? <Text style={styles.etiqueta}>FRONTAL</Text> : null}
      </View>
      <View style={styles.cuerpo}>
        <Body
          data={data}
          side="back"
          gender="male"
          scale={scale}
          colors={[...ESCALA]}
          border={colors.borderLight}
          defaultFill={colors.surface}
        />
        {showLabels ? <Text style={styles.etiqueta}>POSTERIOR</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cuerpos: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  cuerpo: { alignItems: 'center' },
  etiqueta: {
    fontSize: 8, fontWeight: '800', letterSpacing: 2,
    color: colors.textMuted, marginTop: spacing.xs,
  },
});
