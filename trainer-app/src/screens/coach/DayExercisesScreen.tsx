import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { TrainingDay, Exercise, User } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';

type RouteParams = { day: TrainingDay; client: User };

export default function DayExercisesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { day, client } = route.params as RouteParams;

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExercises();
  }, []);

  async function fetchExercises() {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('day_id', day.id)
      .eq('archived', false)
      .order('order_index');
    setExercises(data ?? []);
    setLoading(false);
  }

  const groupedBySuperseries = exercises.reduce<Record<string, Exercise[]>>((acc, ex) => {
    const key = ex.superseries_group ?? '__solo__' + ex.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ex);
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← ATRÁS</Text>
        </TouchableOpacity>
        <Text style={styles.title}>DÍA {day.day_number}</Text>
        <Text style={styles.subtitle}>{day.name.toUpperCase()}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {Object.entries(groupedBySuperseries).map(([groupKey, exList]) => (
            <View key={groupKey}>
              {!groupKey.startsWith('__solo__') && (
                <View style={styles.superseriesLabel}>
                  <Text style={styles.superseriesText}>🔗 {groupKey.toUpperCase()}</Text>
                </View>
              )}
              {exList.map(ex => (
                <Card key={ex.id} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeader}>
                    {ex.image_url ? (
                      <Image source={{ uri: ex.image_url }} style={styles.exThumb} />
                    ) : null}
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{ex.unit}</Text>
                    </View>
                  </View>
                  <View style={styles.exerciseMeta}>
                    <Text style={styles.metaText}>Reps: {ex.reps_objective}</Text>
                    {ex.ref_weight ? (
                      <Text style={styles.metaText}>Ref: {ex.ref_weight} {ex.unit}</Text>
                    ) : null}
                  </View>
                  {ex.notes ? <Text style={styles.notesText}>{ex.notes}</Text> : null}
                </Card>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  backBtn: { alignSelf: 'flex-start' },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  title: { ...typography.display, fontSize: 36 },
  subtitle: { ...typography.h3, color: colors.accent },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  superseriesLabel: {
    paddingVertical: spacing.sm,
  },
  superseriesText: {
    ...typography.label,
    color: colors.accent,
    letterSpacing: 2,
  },
  exerciseCard: { gap: spacing.sm },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exThumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surface },
  exerciseName: { ...typography.h3, flex: 1 },
  notesText: { ...typography.caption, lineHeight: 18 },
  badge: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: { ...typography.caption, letterSpacing: 1 },
  exerciseMeta: { flexDirection: 'row', gap: spacing.md },
  metaText: { ...typography.caption },
});
