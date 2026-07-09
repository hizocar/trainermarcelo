import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { colors } from '../../theme';

// Figura animada de movimiento (asset original, sin fuentes externas).
// Clasifica el ejercicio en un patrón de movimiento y lo anima en loop.

type XY = { x: number; y: number };
interface Pose {
  pelvis: XY; chest: XY; head: XY;
  elbow: XY; wrist: XY;
  knee: XY; ankle: XY;
  knee2?: XY; ankle2?: XY;       // segunda pierna (opcional)
  elbow2?: XY; wrist2?: XY;      // segundo brazo (opcional, vista frontal)
}
interface PatternDef {
  a: Pose;
  b: Pose;
  prop?: 'bar' | 'dumbbell' | 'cable-high' | 'cable-low' | 'bar-fixed';
  bench?: { x: number; y: number; w: number; h: number; angle?: number };
  anchor?: XY;                    // origen del cable
  duration?: number;
}

const P = (x: number, y: number): XY => ({ x, y });

const PATTERNS: Record<string, PatternDef> = {
  squat: {
    a: { pelvis: P(100, 98), chest: P(97, 56), head: P(96, 40), elbow: P(88, 72), wrist: P(95, 58), knee: P(104, 134), ankle: P(106, 168) },
    b: { pelvis: P(88, 124), chest: P(97, 80), head: P(100, 64), elbow: P(87, 94), wrist: P(96, 80), knee: P(121, 140), ankle: P(106, 168) },
    prop: 'bar',
  },
  hinge: {
    a: { pelvis: P(98, 100), chest: P(96, 56), head: P(95, 40), elbow: P(99, 80), wrist: P(100, 102), knee: P(101, 136), ankle: P(103, 168) },
    b: { pelvis: P(90, 106), chest: P(128, 88), head: P(142, 84), elbow: P(128, 108), wrist: P(126, 130), knee: P(103, 140), ankle: P(103, 168) },
    prop: 'bar',
  },
  bench: {
    a: { pelvis: P(88, 112), chest: P(122, 110), head: P(142, 108), elbow: P(112, 96), wrist: P(122, 92), knee: P(72, 136), ankle: P(74, 166) },
    b: { pelvis: P(88, 112), chest: P(122, 110), head: P(142, 108), elbow: P(120, 84), wrist: P(122, 64), knee: P(72, 136), ankle: P(74, 166) },
    prop: 'bar', bench: { x: 62, y: 116, w: 96, h: 8 },
  },
  incline: {
    a: { pelvis: P(84, 122), chest: P(114, 96), head: P(130, 86), elbow: P(112, 82), wrist: P(118, 76), knee: P(70, 142), ankle: P(72, 168) },
    b: { pelvis: P(84, 122), chest: P(114, 96), head: P(130, 86), elbow: P(118, 72), wrist: P(117, 50), knee: P(70, 142), ankle: P(72, 168) },
    prop: 'bar', bench: { x: 66, y: 116, w: 84, h: 8, angle: -18 },
  },
  ohp: {
    a: { pelvis: P(100, 104), chest: P(99, 58), head: P(98, 42), elbow: P(112, 72), wrist: P(111, 56), knee: P(101, 138), ankle: P(102, 170) },
    b: { pelvis: P(100, 104), chest: P(99, 58), head: P(98, 42), elbow: P(106, 40), wrist: P(105, 20), knee: P(101, 138), ankle: P(102, 170) },
    prop: 'dumbbell',
  },
  pulldown: {
    a: { pelvis: P(96, 118), chest: P(94, 72), head: P(93, 56), elbow: P(106, 48), wrist: P(112, 28), knee: P(122, 128), ankle: P(120, 164) },
    b: { pelvis: P(96, 118), chest: P(96, 74), head: P(96, 58), elbow: P(106, 84), wrist: P(112, 66), knee: P(122, 128), ankle: P(120, 164) },
    prop: 'cable-high', anchor: P(113, 6),
  },
  pullup: {
    a: { pelvis: P(102, 122), chest: P(100, 78), head: P(100, 62), elbow: P(105, 50), wrist: P(108, 30), knee: P(96, 152), ankle: P(102, 178) },
    b: { pelvis: P(103, 98), chest: P(102, 56), head: P(103, 40), elbow: P(96, 44), wrist: P(108, 30), knee: P(94, 130), ankle: P(102, 156) },
    prop: 'bar-fixed',
  },
  row: {
    a: { pelvis: P(88, 116), chest: P(84, 70), head: P(83, 54), elbow: P(104, 80), wrist: P(128, 84), knee: P(120, 122), ankle: P(142, 142) },
    b: { pelvis: P(88, 116), chest: P(82, 70), head: P(81, 54), elbow: P(76, 92), wrist: P(98, 88), knee: P(120, 122), ankle: P(142, 142) },
    prop: 'cable-low', anchor: P(158, 86),
  },
  curl: {
    a: { pelvis: P(100, 104), chest: P(98, 58), head: P(97, 42), elbow: P(106, 86), wrist: P(108, 112), knee: P(101, 138), ankle: P(102, 170) },
    b: { pelvis: P(100, 104), chest: P(98, 58), head: P(97, 42), elbow: P(106, 86), wrist: P(120, 66), knee: P(101, 138), ankle: P(102, 170) },
    prop: 'dumbbell',
  },
  triceps: {
    a: { pelvis: P(100, 104), chest: P(98, 58), head: P(97, 42), elbow: P(108, 84), wrist: P(118, 62), knee: P(101, 138), ankle: P(102, 170) },
    b: { pelvis: P(100, 104), chest: P(98, 58), head: P(97, 42), elbow: P(108, 84), wrist: P(114, 112), knee: P(101, 138), ankle: P(102, 170) },
    prop: 'cable-high', anchor: P(120, 6),
  },
  lateral_raise: {
    a: {
      pelvis: P(100, 106), chest: P(100, 60), head: P(100, 40),
      elbow: P(84, 82), wrist: P(80, 106), elbow2: P(116, 82), wrist2: P(120, 106),
      knee: P(93, 140), ankle: P(93, 172), knee2: P(107, 140), ankle2: P(107, 172),
    },
    b: {
      pelvis: P(100, 106), chest: P(100, 60), head: P(100, 40),
      elbow: P(74, 66), wrist: P(50, 62), elbow2: P(126, 66), wrist2: P(150, 62),
      knee: P(93, 140), ankle: P(93, 172), knee2: P(107, 140), ankle2: P(107, 172),
    },
    prop: 'dumbbell',
  },
  leg_extension: {
    a: { pelvis: P(92, 110), chest: P(94, 64), head: P(93, 48), elbow: P(96, 90), wrist: P(94, 110), knee: P(122, 116), ankle: P(118, 150) },
    b: { pelvis: P(92, 110), chest: P(94, 64), head: P(93, 48), elbow: P(96, 90), wrist: P(94, 110), knee: P(122, 116), ankle: P(156, 112) },
  },
  leg_curl: {
    a: { pelvis: P(92, 110), chest: P(94, 64), head: P(93, 48), elbow: P(96, 90), wrist: P(94, 110), knee: P(122, 116), ankle: P(152, 120) },
    b: { pelvis: P(92, 110), chest: P(94, 64), head: P(93, 48), elbow: P(96, 90), wrist: P(94, 110), knee: P(122, 116), ankle: P(124, 152) },
  },
  crunch: {
    a: { pelvis: P(94, 142), chest: P(56, 142), head: P(42, 140), elbow: P(62, 130), wrist: P(52, 128), knee: P(118, 118), ankle: P(134, 142) },
    b: { pelvis: P(94, 142), chest: P(66, 122), head: P(58, 106), elbow: P(70, 112), wrist: P(62, 106), knee: P(118, 118), ankle: P(134, 142) },
  },
  adduction: {
    a: {
      pelvis: P(100, 104), chest: P(100, 60), head: P(100, 40),
      elbow: P(86, 84), wrist: P(84, 104), elbow2: P(114, 84), wrist2: P(116, 104),
      knee: P(84, 138), ankle: P(78, 172), knee2: P(116, 138), ankle2: P(122, 172),
    },
    b: {
      pelvis: P(100, 104), chest: P(100, 60), head: P(100, 40),
      elbow: P(86, 84), wrist: P(84, 104), elbow2: P(114, 84), wrist2: P(116, 104),
      knee: P(94, 138), ankle: P(93, 172), knee2: P(106, 138), ankle2: P(107, 172),
    },
  },
  calf_raise: {
    a: { pelvis: P(100, 104), chest: P(99, 58), head: P(98, 42), elbow: P(90, 80), wrist: P(88, 104), knee: P(101, 138), ankle: P(102, 170) },
    b: { pelvis: P(100, 96), chest: P(99, 50), head: P(98, 34), elbow: P(90, 72), wrist: P(88, 96), knee: P(101, 130), ankle: P(102, 162) },
    prop: 'dumbbell',
  },
};

// clasificador: nombre (es/en) + grupo → patrón
export function patternFor(name: string, nameEn?: string | null, muscleGroup?: string | null): string | null {
  const n = `${name} ${nameEn ?? ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tests: [RegExp, string][] = [
    [/pull ?up|dominada|chin ?up/, 'pullup'],
    [/pulldown|jalon/, 'pulldown'],
    [/remo|row/, 'row'],
    [/press (incli|decli)|incline|decline/, 'incline'],
    [/press banca|press de banca|bench|chest press|press de pecho|fly|apertura|pec deck|pullover/, 'bench'],
    [/shoulder press|press militar|press de hombro|overhead|arnold/, 'ohp'],
    [/curl.*(isquio|femoral)|leg curl|femoral/, 'leg_curl'],
    [/pushdown|triceps|katana|patada de tric|extension de tric|frances|copa/, 'triceps'],
    [/curl|biceps/, 'curl'],
    [/elevacion|lateral raise|vuelo|face pull|pajaro|rear delt/, 'lateral_raise'],
    [/extension de (pierna|cuadriceps)|leg extension/, 'leg_extension'],
    [/gemelo|pantorrilla|calf|gastro|soleo/, 'calf_raise'],
    [/sentadilla|squat|prensa|leg press|zancada|lunge|bulgara|step/, 'squat'],
    [/peso muerto|rumano|deadlift|hip thrust|puente|hiperextension|buenos dias|good morning/, 'hinge'],
    [/crunch|abdominal|plancha|plank|elevacion de piernas|rueda/, 'crunch'],
    [/aducc|adduc/, 'adduction'],
  ];
  for (const [re, p] of tests) if (re.test(n)) return p;

  const byGroup: Record<string, string> = {
    'Pecho': 'bench', 'Espalda alta': 'row', 'Espalda baja': 'hinge',
    'Hombro anterior': 'ohp', 'Hombro medial': 'lateral_raise', 'Hombro posterior': 'lateral_raise',
    'Bíceps': 'curl', 'Tríceps': 'triceps', 'Antebrazos': 'curl',
    'Cuádriceps': 'squat', 'Isquiotibiales': 'hinge', 'Aductor': 'adduction',
    'Glúteo mayor': 'hinge', 'Glúteo medio': 'lateral_raise', 'Glúteo menor': 'lateral_raise',
    'Gastrocnemios': 'calf_raise', 'Core': 'crunch',
  };
  return (muscleGroup && byGroup[muscleGroup]) || null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpXY = (a: XY, b: XY, t: number): XY => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

const BODY = '#C9CDD2';
const BODY_BACK = '#70747A';

function Limb({ from, to, color = BODY, w = 7 }: { from: XY; to: XY; color?: string; w?: number }) {
  return <Line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={w} strokeLinecap="round" />;
}

export default function ExerciseMotion({ pattern, height = 170 }: { pattern: string; height?: number }) {
  const def = PATTERNS[pattern];
  const [t, setT] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = Date.now();
    const cycle = def?.duration ?? 1700;
    const tick = () => {
      const phase = ((Date.now() - start) % (cycle * 2)) / cycle; // 0..2
      const p = phase < 1 ? phase : 2 - phase;                    // ping-pong 0..1..0
      setT((1 - Math.cos(Math.PI * p)) / 2);                      // ease in-out
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current != null) cancelAnimationFrame(raf.current); };
  }, [pattern]);

  if (!def) return null;

  const { a, b } = def;
  const pelvis = lerpXY(a.pelvis, b.pelvis, t);
  const chest = lerpXY(a.chest, b.chest, t);
  const head = lerpXY(a.head, b.head, t);
  const elbow = lerpXY(a.elbow, b.elbow, t);
  const wrist = lerpXY(a.wrist, b.wrist, t);
  const knee = lerpXY(a.knee, b.knee, t);
  const ankle = lerpXY(a.ankle, b.ankle, t);
  const elbow2 = a.elbow2 && b.elbow2 ? lerpXY(a.elbow2, b.elbow2, t) : null;
  const wrist2 = a.wrist2 && b.wrist2 ? lerpXY(a.wrist2, b.wrist2, t) : null;
  const knee2 = a.knee2 && b.knee2 ? lerpXY(a.knee2, b.knee2, t) : null;
  const ankle2 = a.ankle2 && b.ankle2 ? lerpXY(a.ankle2, b.ankle2, t) : null;

  return (
    <View style={[styles.box, { height }]}>
      <Svg viewBox="0 0 200 190" width="100%" height="100%">
        {/* piso */}
        <Line x1={20} y1={178} x2={180} y2={178} stroke={colors.border} strokeWidth={2} strokeLinecap="round" />

        {/* banco */}
        {def.bench && (
          <Rect
            x={def.bench.x} y={def.bench.y} width={def.bench.w} height={def.bench.h}
            rx={3} fill={colors.border}
            transform={def.bench.angle ? `rotate(${def.bench.angle} ${def.bench.x + def.bench.w / 2} ${def.bench.y})` : undefined}
          />
        )}

        {/* cable */}
        {(def.prop === 'cable-high' || def.prop === 'cable-low') && def.anchor && (
          <>
            <Line x1={def.anchor.x} y1={def.anchor.y} x2={wrist.x} y2={wrist.y} stroke={colors.textMuted} strokeWidth={1.5} strokeDasharray="3 3" />
            <Circle cx={def.anchor.x} cy={def.anchor.y} r={4} fill={colors.border} />
          </>
        )}

        {/* barra fija (dominadas) */}
        {def.prop === 'bar-fixed' && (
          <Line x1={70} y1={a.wrist.y} x2={150} y2={a.wrist.y} stroke={colors.border} strokeWidth={4} strokeLinecap="round" />
        )}

        {/* extremidades traseras (profundidad) */}
        {!knee2 && <Limb from={{ x: pelvis.x + 4, y: pelvis.y }} to={{ x: knee.x + 4, y: knee.y }} color={BODY_BACK} />}
        {!knee2 && <Limb from={{ x: knee.x + 4, y: knee.y }} to={{ x: ankle.x + 4, y: ankle.y }} color={BODY_BACK} />}
        {!elbow2 && <Limb from={{ x: chest.x + 4, y: chest.y + 2 }} to={{ x: elbow.x + 4, y: elbow.y }} color={BODY_BACK} w={6} />}
        {!elbow2 && <Limb from={{ x: elbow.x + 4, y: elbow.y }} to={{ x: wrist.x + 4, y: wrist.y }} color={BODY_BACK} w={6} />}

        {/* piernas */}
        <Limb from={pelvis} to={knee} />
        <Limb from={knee} to={ankle} />
        {knee2 && ankle2 && (
          <>
            <Limb from={pelvis} to={knee2} />
            <Limb from={knee2} to={ankle2} />
          </>
        )}

        {/* torso + cabeza */}
        <Limb from={pelvis} to={chest} w={9} />
        <Circle cx={head.x} cy={head.y} r={9} fill={BODY} />

        {/* brazos */}
        <Limb from={chest} to={elbow} w={6} />
        <Limb from={elbow} to={wrist} w={6} />
        {elbow2 && wrist2 && (
          <>
            <Limb from={chest} to={elbow2} w={6} />
            <Limb from={elbow2} to={wrist2} w={6} />
          </>
        )}

        {/* implemento */}
        {def.prop === 'bar' && (
          <>
            <Line x1={wrist.x - 16} y1={wrist.y} x2={wrist.x + 16} y2={wrist.y} stroke={colors.accent} strokeWidth={3.5} strokeLinecap="round" />
            <Circle cx={wrist.x - 16} cy={wrist.y} r={5} fill={colors.accent} />
            <Circle cx={wrist.x + 16} cy={wrist.y} r={5} fill={colors.accent} />
          </>
        )}
        {def.prop === 'dumbbell' && (
          <>
            <Circle cx={wrist.x} cy={wrist.y} r={5} fill={colors.accent} />
            {wrist2 && <Circle cx={wrist2.x} cy={wrist2.y} r={5} fill={colors.accent} />}
          </>
        )}
        {(def.prop === 'cable-high' || def.prop === 'cable-low') && (
          <Line x1={wrist.x - 8} y1={wrist.y} x2={wrist.x + 8} y2={wrist.y} stroke={colors.accent} strokeWidth={3.5} strokeLinecap="round" />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', alignItems: 'center' },
});
