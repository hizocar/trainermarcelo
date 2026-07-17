import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, spacing, typography } from '../../theme';

// Calendario de entrenamientos estilo Apple Fitness: un anillo por día.
// El anillo se llena según cuántos ejercicios de esa sesión se completaron.

export interface DayRing {
  date: string;          // YYYY-MM-DD
  ratio: number;         // 0..1 (ejercicios completados / total de la sesión)
}

interface Props {
  rings: DayRing[];                       // días con entrenamiento
  onSelectDate: (date: string) => void;
  selectedDate?: string | null;
}

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function Ring({ ratio, today, selected }: { ratio: number; today: boolean; selected: boolean }) {
  const size = 34, stroke = 3.5, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const has = ratio > 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={has ? colors.accent + '33' : colors.border} strokeWidth={stroke} fill="none" />
      {has && (
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={colors.accent} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(ratio, 0.12))}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      {selected && <Circle cx={size / 2} cy={size / 2} r={r + stroke} stroke={colors.textPrimary} strokeWidth={1.5} fill="none" />}
    </Svg>
  );
}

export default function WorkoutCalendar({ rings, onSelectDate, selectedDate }: Props) {
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const ringMap = useMemo(() => {
    const m: Record<string, number> = {};
    rings.forEach(r => { m[r.date] = r.ratio; });
    return m;
  }, [rings]);

  // rango de meses: del primer entrenamiento (o 2 meses atrás) hasta el mes actual
  const months = useMemo(() => {
    const dates = rings.map(r => r.date).sort();
    const first = dates[0] ? new Date(dates[0]) : new Date();
    const now = new Date();
    const start = new Date(first.getFullYear(), first.getMonth(), 1);
    const out: { year: number; month: number }[] = [];
    const cur = new Date(start);
    while (cur <= now) {
      out.push({ year: cur.getFullYear(), month: cur.getMonth() });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }, [rings]);

  return (
    <View style={styles.container}>
      <View style={styles.weekHeader}>
        {WEEK.map((d, i) => <Text key={i} style={styles.weekLabel}>{d}</Text>)}
      </View>

      {months.map(({ year, month }) => {
        const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Lunes
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
        while (cells.length % 7 !== 0) cells.push(null);

        return (
          <View key={`${year}-${month}`} style={styles.monthBlock}>
            <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day == null) return <View key={i} style={styles.cell} />;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const ratio = ringMap[dateStr] ?? 0;
                const isToday = dateStr === todayStr;
                const selected = dateStr === selectedDate;
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.cell}
                    onPress={() => ratio > 0 && onSelectDate(dateStr)}
                    activeOpacity={ratio > 0 ? 0.6 : 1}
                  >
                    <View style={styles.ringWrap}>
                      <Ring ratio={ratio} today={isToday} selected={selected} />
                      <Text style={[styles.dayNum, isToday && styles.dayNumToday, ratio > 0 && styles.dayNumActive]}>
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  weekHeader: { flexDirection: 'row', paddingBottom: spacing.xs },
  weekLabel: { flex: 1, textAlign: 'center', ...typography.label, fontSize: 9, color: colors.textMuted },
  monthBlock: { gap: spacing.sm },
  monthLabel: { ...typography.h3, fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  dayNum: { position: 'absolute', fontSize: 11, fontWeight: '700', color: colors.textMuted },
  dayNumActive: { color: colors.textPrimary },
  dayNumToday: { color: colors.accent, fontWeight: '900' },
});
