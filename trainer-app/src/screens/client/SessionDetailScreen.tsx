import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Exercise } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import { formatShortDate } from '../../lib/weeks';

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>CALENDARIO</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{dateLabel.toUpperCase()}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {sessions.map((session, si) => (
          <Card key={si} style={styles.sessionCard}>
            <View style={styles.sessionHeader}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>DÍA {session.dayNumber}</Text>
              </View>
              <Text style={styles.sessionName}>{session.dayName.toUpperCase()}</Text>
              <Text style={styles.sessionDate}>{formatShortDate(session.date)}</Text>
            </View>
            {session.exercises.map(({ exercise, sets }) => (
              <TouchableOpacity
                key={exercise.id}
                style={styles.exBlock}
                onPress={() => navigation.navigate('WorkoutLog', { exercise, week: session.week })}
                activeOpacity={0.7}
              >
                <View style={styles.exHeader}>
                  <Text style={styles.exName} numberOfLines={1}>{exercise.name}</Text>
                  <View style={styles.editHint}>
                    <Ionicons name="pencil" size={11} color={colors.accent} />
                    <Text style={styles.editHintText}>EDITAR</Text>
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
              </TouchableOpacity>
            ))}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg, gap: spacing.xs },
  backBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  title: { ...typography.display, fontSize: 26 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },

  sessionCard: { gap: spacing.md },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayBadge: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  dayBadgeText: { color: colors.background, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  sessionName: { ...typography.h3, fontSize: 14, flex: 1 },
  sessionDate: { ...typography.caption, fontSize: 11 },

  exBlock: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  exHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exName: { ...typography.h3, fontSize: 14, flex: 1 },
  editHint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  editHintText: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.accent },
  setsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  setPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  setPillLabel: { fontSize: 10, fontWeight: '900', color: colors.accent },
  setPillValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
});
