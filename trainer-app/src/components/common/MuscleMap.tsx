import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Ellipse, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors, typography, spacing } from '../../theme';

// Mapa muscular anatómico (asset original). Cada grupo es una región con forma
// realista; el grupo activo se resalta en lima con halo, el resto queda apagado.
interface Props {
  highlights: Record<string, number>;   // intensidad 0..1 por grupo
  height?: number;
  showLabels?: boolean;
}

const SKIN = '#2A2E33';        // relleno base del cuerpo
const SKIN_LINE = '#3A3F45';   // contorno
const MUSCLE_OFF = '#33383E';  // músculo no resaltado
const MUSCLE_LINE = '#42474E';

function muscleProps(intensity?: number) {
  if (!intensity || intensity <= 0) {
    return { fill: MUSCLE_OFF, stroke: MUSCLE_LINE, strokeWidth: 0.6 };
  }
  const op = 0.45 + 0.55 * Math.min(intensity, 1);
  return { fill: colors.accent, fillOpacity: op, stroke: colors.accent, strokeWidth: 0.8 };
}

// ── Vista frontal ────────────────────────────────────────────────────────────
function Front({ h }: { h: Record<string, number> }) {
  return (
    <Svg viewBox="0 0 200 400" width="100%" height="100%">
      {/* silueta base */}
      <G fill={SKIN} stroke={SKIN_LINE} strokeWidth={1}>
        {/* cabeza y cuello */}
        <Circle cx={100} cy={26} r={17} />
        <Path d="M91 40 h18 v10 q-9 5 -18 0 Z" />
        {/* torso */}
        <Path d="M62 52 q38 -9 76 0 q7 3 6 16 l-5 74 q-2 20 -12 30 l1 22 h-56 l1 -22 q-10 -10 -12 -30 l-5 -74 q-1 -13 6 -16 Z" />
        {/* brazos */}
        <Path d="M62 54 q-16 6 -19 26 l-8 60 q-2 12 2 22 l10 -2 l6 -22 l10 -54 l2 -40 Z" />
        <Path d="M138 54 q16 6 19 26 l8 60 q2 12 -2 22 l-10 -2 l-6 -22 l-10 -54 l-2 -40 Z" />
        {/* antebrazos + manos */}
        <Path d="M35 158 l-7 46 q-1 10 3 20 l9 -1 l4 -22 l4 -42 Z" />
        <Path d="M165 158 l7 46 q1 10 -3 20 l-9 -1 l-4 -22 l-4 -42 Z" />
        {/* piernas */}
        <Path d="M70 214 q-4 4 -4 14 l-3 74 l-4 62 l1 20 h16 l3 -22 l6 -70 l3 -66 Z" />
        <Path d="M130 214 q4 4 4 14 l3 74 l4 62 l-1 20 h-16 l-3 -22 l-6 -70 l-3 -66 Z" />
      </G>

      {/* músculos frontales */}
      {/* hombro anterior */}
      <Path d="M60 58 q-15 3 -18 22 q10 6 22 3 q3 -15 -4 -25 Z" {...muscleProps(h['Hombro anterior'])} />
      <Path d="M140 58 q15 3 18 22 q-10 6 -22 3 q-3 -15 4 -25 Z" {...muscleProps(h['Hombro anterior'])} />
      {/* hombro medial (cara externa, se ve un poco de frente) */}
      <Path d="M42 78 q-6 2 -7 18 q7 3 12 -2 q1 -10 -5 -16 Z" {...muscleProps(h['Hombro medial'])} />
      <Path d="M158 78 q6 2 7 18 q-7 3 -12 -2 q-1 -10 5 -16 Z" {...muscleProps(h['Hombro medial'])} />
      {/* pecho */}
      <Path d="M66 62 q16 -5 31 0 q3 20 -2 30 q-16 7 -29 -2 q-4 -16 0 -28 Z" {...muscleProps(h['Pecho'])} />
      <Path d="M134 62 q-16 -5 -31 0 q-3 20 2 30 q16 7 29 -2 q4 -16 0 -28 Z" {...muscleProps(h['Pecho'])} />
      {/* bíceps */}
      <Path d="M46 92 q-6 4 -6 26 q8 5 14 0 q3 -18 -8 -26 Z" {...muscleProps(h['Bíceps'])} />
      <Path d="M154 92 q6 4 6 26 q-8 5 -14 0 q-3 -18 8 -26 Z" {...muscleProps(h['Bíceps'])} />
      {/* antebrazos */}
      <Path d="M37 130 q-6 6 -8 42 q6 3 11 -1 q4 -24 -3 -41 Z" {...muscleProps(h['Antebrazos'])} />
      <Path d="M163 130 q6 6 8 42 q-6 3 -11 -1 q-4 -24 3 -41 Z" {...muscleProps(h['Antebrazos'])} />
      {/* core (recto abdominal + oblicuos) */}
      <Path d="M84 96 h32 q3 30 -1 60 q-15 8 -30 0 q-4 -30 -1 -60 Z" {...muscleProps(h['Core'])} />
      {/* aductor (cara interna del muslo) */}
      <Path d="M86 220 q-9 3 -11 40 q8 4 14 -2 q4 -22 -3 -38 Z" {...muscleProps(h['Aductor'])} />
      <Path d="M114 220 q9 3 11 40 q-8 4 -14 -2 q-4 -22 3 -38 Z" {...muscleProps(h['Aductor'])} />
      {/* cuádriceps */}
      <Path d="M70 222 q-6 4 -6 20 l-2 44 q10 6 20 1 l3 -46 q1 -16 -15 -19 Z" {...muscleProps(h['Cuádriceps'])} />
      <Path d="M130 222 q6 4 6 20 l2 44 q-10 6 -20 1 l-3 -46 q-1 -16 15 -19 Z" {...muscleProps(h['Cuádriceps'])} />
      {/* gastrocnemios (parte frontal-lateral visible: tibial) */}
      <Path d="M64 300 q-4 4 -5 40 q7 4 12 -1 l1 -38 Z" {...muscleProps(h['Gastrocnemios'])} />
      <Path d="M136 300 q4 4 5 40 q-7 4 -12 -1 l-1 -38 Z" {...muscleProps(h['Gastrocnemios'])} />
    </Svg>
  );
}

// ── Vista posterior ──────────────────────────────────────────────────────────
function Back({ h }: { h: Record<string, number> }) {
  return (
    <Svg viewBox="0 0 200 400" width="100%" height="100%">
      <G fill={SKIN} stroke={SKIN_LINE} strokeWidth={1}>
        <Circle cx={100} cy={26} r={17} />
        <Path d="M91 40 h18 v10 q-9 5 -18 0 Z" />
        <Path d="M62 52 q38 -9 76 0 q7 3 6 16 l-5 74 q-2 20 -12 30 l1 22 h-56 l1 -22 q-10 -10 -12 -30 l-5 -74 q-1 -13 6 -16 Z" />
        <Path d="M62 54 q-16 6 -19 26 l-8 60 q-2 12 2 22 l10 -2 l6 -22 l10 -54 l2 -40 Z" />
        <Path d="M138 54 q16 6 19 26 l8 60 q2 12 -2 22 l-10 -2 l-6 -22 l-10 -54 l-2 -40 Z" />
        <Path d="M35 158 l-7 46 q-1 10 3 20 l9 -1 l4 -22 l4 -42 Z" />
        <Path d="M165 158 l7 46 q1 10 -3 20 l-9 -1 l-4 -22 l-4 -42 Z" />
        <Path d="M70 214 q-4 4 -4 14 l-3 74 l-4 62 l1 20 h16 l3 -22 l6 -70 l3 -66 Z" />
        <Path d="M130 214 q4 4 4 14 l3 74 l4 62 l-1 20 h-16 l-3 -22 l-6 -70 l-3 -66 Z" />
      </G>

      {/* trapecio (parte de espalda alta) */}
      <Path d="M100 50 l30 8 q-2 14 -8 20 q-22 8 -44 0 q-6 -6 -8 -20 Z" {...muscleProps(h['Espalda alta'])} />
      {/* dorsales (lats, parte de espalda alta) */}
      <Path d="M70 78 q-6 30 4 54 q14 8 24 4 l0 -58 q-16 -6 -28 0 Z" {...muscleProps(h['Espalda alta'])} />
      <Path d="M130 78 q6 30 -4 54 q-14 8 -24 4 l0 -58 q16 -6 28 0 Z" {...muscleProps(h['Espalda alta'])} />
      {/* espalda baja (erectores) */}
      <Path d="M86 134 h28 q2 18 -2 30 q-12 6 -24 0 q-4 -12 -2 -30 Z" {...muscleProps(h['Espalda baja'])} />
      {/* hombro posterior */}
      <Path d="M60 58 q-15 3 -18 22 q10 6 22 3 q3 -15 -4 -25 Z" {...muscleProps(h['Hombro posterior'])} />
      <Path d="M140 58 q15 3 18 22 q-10 6 -22 3 q-3 -15 4 -25 Z" {...muscleProps(h['Hombro posterior'])} />
      {/* tríceps */}
      <Path d="M46 92 q-6 4 -6 28 q8 5 14 0 q3 -20 -8 -28 Z" {...muscleProps(h['Tríceps'])} />
      <Path d="M154 92 q6 4 6 28 q-8 5 -14 0 q-3 -20 8 -28 Z" {...muscleProps(h['Tríceps'])} />
      {/* antebrazos */}
      <Path d="M37 130 q-6 6 -8 42 q6 3 11 -1 q4 -24 -3 -41 Z" {...muscleProps(h['Antebrazos'])} />
      <Path d="M163 130 q6 6 8 42 q-6 3 -11 -1 q-4 -24 3 -41 Z" {...muscleProps(h['Antebrazos'])} />
      {/* glúteo medio (superior-lateral) */}
      <Path d="M73 168 q-6 3 -6 15 q7 4 13 0 q1 -10 -7 -15 Z" {...muscleProps(h['Glúteo medio'])} />
      <Path d="M127 168 q6 3 6 15 q-7 4 -13 0 q-1 -10 7 -15 Z" {...muscleProps(h['Glúteo medio'])} />
      {/* glúteo menor (pequeño, bajo el medio) */}
      <Ellipse cx={78} cy={188} rx={7} ry={7} {...muscleProps(h['Glúteo menor'])} />
      <Ellipse cx={122} cy={188} rx={7} ry={7} {...muscleProps(h['Glúteo menor'])} />
      {/* glúteo mayor */}
      <Path d="M72 182 q-8 4 -8 20 q4 12 18 12 q4 -16 2 -30 q-6 -4 -12 -2 Z" {...muscleProps(h['Glúteo mayor'])} />
      <Path d="M128 182 q8 4 8 20 q-4 12 -18 12 q-4 -16 -2 -30 q6 -4 12 -2 Z" {...muscleProps(h['Glúteo mayor'])} />
      {/* isquiotibiales */}
      <Path d="M70 220 q-6 4 -6 20 l-2 42 q10 6 20 1 l3 -44 q1 -16 -15 -19 Z" {...muscleProps(h['Isquiotibiales'])} />
      <Path d="M130 220 q6 4 6 20 l2 42 q-10 6 -20 1 l-3 -44 q-1 -16 15 -19 Z" {...muscleProps(h['Isquiotibiales'])} />
      {/* gastrocnemios (pantorrilla, muy visible por detrás) */}
      <Path d="M66 300 q-6 5 -6 30 q8 5 14 0 q3 -22 -8 -30 Z" {...muscleProps(h['Gastrocnemios'])} />
      <Path d="M134 300 q6 5 6 30 q-8 5 -14 0 q-3 -22 8 -30 Z" {...muscleProps(h['Gastrocnemios'])} />
    </Svg>
  );
}

export default function MuscleMap({ highlights, height = 220, showLabels = true }: Props) {
  // etiqueta del grupo activo principal
  const active = Object.entries(highlights)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.figure, { height }]}>
          <Front h={highlights} />
          {showLabels && <Text style={styles.viewLabel}>FRONTAL</Text>}
        </View>
        <View style={[styles.figure, { height }]}>
          <Back h={highlights} />
          {showLabels && <Text style={styles.viewLabel}>POSTERIOR</Text>}
        </View>
      </View>
      {showLabels && active && (
        <View style={styles.activePill}>
          <View style={styles.activeDot} />
          <Text style={styles.activeText}>{active.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  figure: { aspectRatio: 200 / 400, alignItems: 'center' },
  viewLabel: { ...typography.label, fontSize: 8, letterSpacing: 2, marginTop: 2, color: colors.textMuted },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accentSoft, borderRadius: 999,
    borderWidth: 1, borderColor: colors.accent + '55',
    paddingHorizontal: 12, paddingVertical: 4,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  activeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: colors.accent },
});
