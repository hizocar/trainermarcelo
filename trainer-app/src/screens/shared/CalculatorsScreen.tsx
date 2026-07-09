import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';

const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]; // kg por lado
const PERCENTS = [95, 90, 85, 80, 75, 70, 65, 60];

const toNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
};

export default function CalculatorsScreen() {
  const navigation = useNavigation<any>();

  // 1RM
  const [w, setW] = useState('');
  const [r, setR] = useState('');
  const oneRm = useMemo(() => {
    const weight = toNum(w);
    const reps = toNum(r);
    if (!weight || !reps || reps < 1) return null;
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30) * 10) / 10; // Epley
  }, [w, r]);

  // discos
  const [target, setTarget] = useState('');
  const [barWeight, setBarWeight] = useState(20);
  const plates = useMemo(() => {
    const t = toNum(target);
    if (!t || t <= barWeight) return null;
    let perSide = (t - barWeight) / 2;
    const out: number[] = [];
    for (const p of PLATES) {
      while (perSide >= p - 0.001) { out.push(p); perSide -= p; }
    }
    return { plates: out, remainder: Math.round(perSide * 2 * 100) / 100 };
  }, [target, barWeight]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>ATRÁS</Text>
        </TouchableOpacity>
        <Text style={styles.title}>CALCULADORAS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 1RM */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>1RM ESTIMADO</Text>
          <Text style={styles.cardSub}>Tu máximo teórico para una repetición (fórmula de Epley)</Text>
          <View style={styles.inputRow}>
            <View style={styles.field}>
              <Text style={styles.label}>PESO (kg)</Text>
              <TextInput
                style={styles.input} value={w} onChangeText={setW}
                keyboardType="decimal-pad" placeholder="80" placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>REPS</Text>
              <TextInput
                style={styles.input} value={r} onChangeText={setR}
                keyboardType="number-pad" placeholder="8" placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {oneRm != null && (
            <>
              <View style={styles.resultBox}>
                <Text style={styles.resultValue}>{oneRm} kg</Text>
                <Text style={styles.resultLabel}>1RM ESTIMADO</Text>
              </View>
              <View style={styles.pctGrid}>
                {PERCENTS.map(p => (
                  <View key={p} style={styles.pctCell}>
                    <Text style={styles.pctLabel}>{p}%</Text>
                    <Text style={styles.pctValue}>{Math.round(oneRm * p / 100 * 2) / 2}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </Card>

        {/* Discos */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>DISCOS EN LA BARRA</Text>
          <Text style={styles.cardSub}>Qué discos poner por lado para llegar al peso</Text>
          <View style={styles.inputRow}>
            <View style={styles.field}>
              <Text style={styles.label}>PESO OBJETIVO (kg)</Text>
              <TextInput
                style={styles.input} value={target} onChangeText={setTarget}
                keyboardType="decimal-pad" placeholder="100" placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>BARRA</Text>
              <View style={styles.barRow}>
                {[20, 15, 10].map(b => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.barChip, barWeight === b && styles.barChipActive]}
                    onPress={() => setBarWeight(b)}
                  >
                    <Text style={[styles.barChipText, barWeight === b && styles.barChipTextActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {plates && (
            <View style={styles.platesBox}>
              <Text style={styles.platesLabel}>POR LADO:</Text>
              <View style={styles.platesRow}>
                {plates.plates.length === 0
                  ? <Text style={styles.cardSub}>solo la barra</Text>
                  : plates.plates.map((p, i) => (
                    <View key={i} style={[styles.plate, { height: 22 + Math.min(p, 25) }]}>
                      <Text style={styles.plateText}>{p}</Text>
                    </View>
                  ))}
              </View>
              {plates.remainder > 0.01 && (
                <Text style={styles.remainderText}>faltan {plates.remainder} kg (no hay discos tan chicos)</Text>
              )}
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg, gap: spacing.xs },
  backBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  title: { ...typography.display, fontSize: 30 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },

  card: { gap: spacing.md },
  cardTitle: { ...typography.h3 },
  cardSub: { ...typography.caption },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1, gap: spacing.xs },
  label: { ...typography.label, letterSpacing: 1.5, fontSize: 9 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center',
  },
  resultBox: {
    alignItems: 'center', gap: 2,
    backgroundColor: colors.accentSoft, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.accent + '55',
    paddingVertical: spacing.md,
  },
  resultValue: { fontSize: 32, fontWeight: '900', color: colors.accent },
  resultLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: colors.textMuted },
  pctGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pctCell: {
    flexBasis: '22%', flexGrow: 1, alignItems: 'center', gap: 1,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm,
  },
  pctLabel: { fontSize: 9, fontWeight: '800', color: colors.textMuted },
  pctValue: { fontSize: 15, fontWeight: '900', color: colors.textPrimary },

  barRow: { flexDirection: 'row', gap: spacing.xs },
  barChip: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  barChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  barChipText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  barChipTextActive: { color: colors.background },
  platesBox: { gap: spacing.sm },
  platesLabel: { ...typography.label, letterSpacing: 1.5, fontSize: 9 },
  platesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 52 },
  plate: {
    width: 26, borderRadius: 4,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  plateText: { fontSize: 9, fontWeight: '900', color: colors.background },
  remainderText: { ...typography.caption, fontSize: 10, fontStyle: 'italic' },
});
