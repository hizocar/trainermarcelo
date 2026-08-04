import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Exercise } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';

interface SessionData {
  dayNumber: number;
  dayName: string;
  week: number;
  date: string;
  exercises: { exercise: Exercise; sets: { seriesNum: number; weight: number; reps: number }[] }[];
}

type RouteParams = { sessions: SessionData[]; dateLabel: string };

export default function SessionDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { sessions, dateLabel } = route.params as RouteParams;

  const primary = sessions[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>CALENDARIO</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.dateLabel}>{dateLabel.toUpperCase()}</Text>
            <Text style={styles.title} numberOfLines={2}>
              {primary ? primary.dayName.toUpperCase() : ''}
            </Text>
          </View>
          {primary && (
            <View style={styles.dayBadge}>
              <Text style={styles.dayBadgeText}>D{primary.dayNumber}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {sessions.map((session, si) => (
          <View key={si} style={styles.sessionBlock}>
            {sessions.length > 1 && (
              <Text style={styles.sessionTag}>DÍA {session.dayNumber} · {session.dayName.toUpperCase()} · S{session.week}</Text>
            )}
            {session.exercises.map(({ exercise, sets }) => (
              <TouchableOpacity
                key={exercise.id}
                onPress={() => navigation.navigate('WorkoutLog', { exercise, week: session.week, date: session.date })}
                activeOpacity={0.7}
              >
                <Card style={styles.exCard}>
                  <View style={styles.exRow}>
                    {exercise.image_url ? (
                      <Image source={{ uri: exercise.image_url }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <Ionicons name="barbell-outline" size={22} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.exInfo}>
                      <Text style={styles.exName}>{exercise.name}</Text>
                      <Text style={styles.exMeta}>
                        {exercise.muscle_group ? `${exercise.muscle_group} · ` : ''}
                        {sets.length} series
                        {exercise.reps_objective ? ` · ${exercise.reps_objective} reps` : ''}
                      </Text>
                    </View>
                    <View style={styles.check}>
                      <Ionicons name="checkmark" size={20} color={colors.background} />
                    </View>
                  </View>
                  <View style={styles.setsRow}>
                    {sets.map(s => (
                      <View key={s.seriesNum} style={styles.setPill}>
                        <Text style={styles.setPillLabel}>S{s.seriesNum}</Text>
                        <Text style={styles.setPillValue}>{s.weight}{exercise.unit} × {s.reps}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <Text style={styles.hint}>Toca un ejercicio para revisar o corregir lo registrado.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg, gap: spacing.sm },
  backBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerInfo: { flex: 1 },
  dateLabel: { ...typography.label, letterSpacing: 2, color: colors.accent },
  title: { ...typography.display, fontSize: 30, marginTop: 2 },
  dayBadge: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm,
  },
  dayBadgeText: { color: colors.background, fontWeight: '900', fontSize: 16 },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  sessionBlock: { gap: spacing.sm },
  sessionTag: { ...typography.label, letterSpacing: 2, fontSize: 10, marginTop: spacing.sm },

  exCard: { gap: spacing.sm },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  exInfo: { flex: 1 },
  exName: { ...typography.h3 },
  exMeta: { ...typography.caption, marginTop: 2 },
  check: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center',
  },
  setsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  setPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  setPillLabel: { fontSize: 10, fontWeight: '900', color: colors.accent },
  setPillValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  hint: { ...typography.caption, textAlign: 'center', fontStyle: 'italic', marginTop: spacing.sm },
});
