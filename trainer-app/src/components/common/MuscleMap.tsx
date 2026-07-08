import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { colors, typography, spacing } from '../../theme';

// Mapa muscular propio (asset original de la app, sin fuentes externas).
// highlights: intensidad 0..1 por grupo — 1 = lima pleno, 0 = no destacado.
interface Props {
  highlights: Record<string, number>;
  height?: number;
  showLabels?: boolean;
}

const BODY = colors.surface;
const LINE = colors.border;

function fillFor(intensity?: number) {
  if (!intensity || intensity <= 0) return { fill: 'transparent' };
  return { fill: colors.accent, fillOpacity: 0.2 + 0.7 * Math.min(intensity, 1) };
}

// silueta base compartida (viewBox 0 0 200 460)
function Silhouette() {
  return (
    <>
      <Circle cx={100} cy={32} r={22} fill={BODY} stroke={LINE} />
      <Rect x={90} y={52} width={20} height={14} fill={BODY} stroke={LINE} />
      {/* torso */}
      <Path
        d="M56 68 L144 68 Q150 70 149 84 L143 170 Q141 186 132 196 L132 214 L68 214 L68 196 Q59 186 57 170 L51 84 Q50 70 56 68 Z"
        fill={BODY} stroke={LINE}
      />
      {/* brazos */}
      <Path d="M56 70 Q40 78 40 100 L36 150 L30 200 L44 202 L52 152 L58 110 Z" fill={BODY} stroke={LINE} />
      <Path d="M144 70 Q160 78 160 100 L164 150 L170 200 L156 202 L148 152 L142 110 Z" fill={BODY} stroke={LINE} />
      {/* piernas */}
      <Path d="M68 214 L66 300 L70 380 L72 430 L88 430 L90 380 L94 300 L98 214 Z" fill={BODY} stroke={LINE} />
      <Path d="M132 214 L134 300 L130 380 L128 430 L112 430 L110 380 L106 300 L102 214 Z" fill={BODY} stroke={LINE} />
    </>
  );
}

function FrontView({ h }: { h: Record<string, number> }) {
  return (
    <Svg viewBox="0 0 200 460" width="100%" height="100%">
      <Silhouette />
      {/* Pecho */}
      <Ellipse cx={79} cy={96} rx={23} ry={17} {...fillFor(h['Pecho'])} />
      <Ellipse cx={121} cy={96} rx={23} ry={17} {...fillFor(h['Pecho'])} />
      {/* Hombro anterior */}
      <Circle cx={58} cy={80} r={11} {...fillFor(h['Hombro anterior'])} />
      <Circle cx={142} cy={80} r={11} {...fillFor(h['Hombro anterior'])} />
      {/* Hombro medial (cara externa) */}
      <Ellipse cx={45} cy={82} rx={8} ry={13} {...fillFor(h['Hombro medial'])} />
      <Ellipse cx={155} cy={82} rx={8} ry={13} {...fillFor(h['Hombro medial'])} />
      {/* Bíceps */}
      <Ellipse cx={48} cy={122} rx={10} ry={22} {...fillFor(h['Bíceps'])} />
      <Ellipse cx={152} cy={122} rx={10} ry={22} {...fillFor(h['Bíceps'])} />
      {/* Antebrazos */}
      <Ellipse cx={39} cy={175} rx={8} ry={24} {...fillFor(h['Antebrazos'])} />
      <Ellipse cx={161} cy={175} rx={8} ry={24} {...fillFor(h['Antebrazos'])} />
      {/* Core */}
      <Rect x={82} y={122} width={36} height={68} rx={12} {...fillFor(h['Core'])} />
      {/* Aductor (cara interna del muslo) */}
      <Ellipse cx={91} cy={250} rx={9} ry={28} {...fillFor(h['Aductor'])} />
      <Ellipse cx={109} cy={250} rx={9} ry={28} {...fillFor(h['Aductor'])} />
      {/* Cuádriceps */}
      <Ellipse cx={78} cy={268} rx={13} ry={42} {...fillFor(h['Cuádriceps'])} />
      <Ellipse cx={122} cy={268} rx={13} ry={42} {...fillFor(h['Cuádriceps'])} />
    </Svg>
  );
}

function BackView({ h }: { h: Record<string, number> }) {
  return (
    <Svg viewBox="0 0 200 460" width="100%" height="100%">
      <Silhouette />
      {/* Espalda alta (trapecio + dorsales) */}
      <Path
        d="M100 62 L138 74 L134 118 Q120 142 100 148 Q80 142 66 118 L62 74 Z"
        {...fillFor(h['Espalda alta'])}
      />
      {/* Espalda baja */}
      <Rect x={84} y={152} width={32} height={38} rx={10} {...fillFor(h['Espalda baja'])} />
      {/* Hombro posterior */}
      <Circle cx={58} cy={80} r={11} {...fillFor(h['Hombro posterior'])} />
      <Circle cx={142} cy={80} r={11} {...fillFor(h['Hombro posterior'])} />
      {/* Tríceps */}
      <Ellipse cx={48} cy={122} rx={10} ry={22} {...fillFor(h['Tríceps'])} />
      <Ellipse cx={152} cy={122} rx={10} ry={22} {...fillFor(h['Tríceps'])} />
      {/* Antebrazos */}
      <Ellipse cx={39} cy={175} rx={8} ry={24} {...fillFor(h['Antebrazos'])} />
      <Ellipse cx={161} cy={175} rx={8} ry={24} {...fillFor(h['Antebrazos'])} />
      {/* Glúteo medio (superior-lateral) */}
      <Ellipse cx={76} cy={200} rx={10} ry={9} {...fillFor(h['Glúteo medio'])} />
      <Ellipse cx={124} cy={200} rx={10} ry={9} {...fillFor(h['Glúteo medio'])} />
      {/* Glúteo menor (pequeño, bajo el medio) */}
      <Ellipse cx={71} cy={212} rx={6} ry={6} {...fillFor(h['Glúteo menor'])} />
      <Ellipse cx={129} cy={212} rx={6} ry={6} {...fillFor(h['Glúteo menor'])} />
      {/* Glúteo mayor */}
      <Ellipse cx={84} cy={218} rx={15} ry={17} {...fillFor(h['Glúteo mayor'])} />
      <Ellipse cx={116} cy={218} rx={15} ry={17} {...fillFor(h['Glúteo mayor'])} />
      {/* Isquiotibiales */}
      <Ellipse cx={79} cy={275} rx={13} ry={38} {...fillFor(h['Isquiotibiales'])} />
      <Ellipse cx={121} cy={275} rx={13} ry={38} {...fillFor(h['Isquiotibiales'])} />
      {/* Gastrocnemios */}
      <Ellipse cx={80} cy={355} rx={10} ry={28} {...fillFor(h['Gastrocnemios'])} />
      <Ellipse cx={120} cy={355} rx={10} ry={28} {...fillFor(h['Gastrocnemios'])} />
    </Svg>
  );
}

export default function MuscleMap({ highlights, height = 190, showLabels = true }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.figure, { height }]}>
        <FrontView h={highlights} />
        {showLabels && <Text style={styles.label}>FRONTAL</Text>}
      </View>
      <View style={[styles.figure, { height }]}>
        <BackView h={highlights} />
        {showLabels && <Text style={styles.label}>POSTERIOR</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  figure: { aspectRatio: 200 / 460, alignItems: 'center' },
  label: { ...typography.label, fontSize: 8, letterSpacing: 2, marginTop: 2 },
});
