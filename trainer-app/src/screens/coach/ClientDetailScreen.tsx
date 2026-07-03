import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { User, TrainingDay, WorkoutPlan } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';

type RouteParams = { client: User };

export default function ClientDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { client } = route.params as RouteParams;

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [days, setDays] = useState<TrainingDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlan();
  }, []);

  async function fetchPlan() {
    const { data: planData } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('client_id', client.id)
      .single();

    if (planData) {
      setPlan(planData);
      const { data: daysData } = await supabase
        .from('training_days')
        .select('*')
        .eq('plan_id', planData.id)
        .order('day_number');
      setDays(daysData ?? []);
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← ATRÁS</Text>
        </TouchableOpacity>
        <Text style={styles.clientName}>{client.name.toUpperCase()}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('PlanEditor', { client })}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>✏ EDITAR PLAN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => navigation.navigate('ClientProgress', { client })}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>📈 VER PROGRESO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => navigation.navigate('ClientBody', { client })}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>🧍 MEDIDAS Y FOTOS</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>DÍAS DE ENTRENAMIENTO</Text>

          {days.map(day => (
            <TouchableOpacity
              key={day.id}
              onPress={() => navigation.navigate('DayExercises', { day, client })}
              activeOpacity={0.7}
            >
              <Card style={styles.dayCard}>
                <View style={styles.dayNumber}>
                  <Text style={styles.dayNumberText}>{day.day_number}</Text>
                </View>
                <View>
                  <Text style={styles.dayName}>DÍA {day.day_number}</Text>
                  <Text style={styles.daySubname}>{day.name.toUpperCase()}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))}

          {days.length === 0 && (
            <Text style={styles.emptyText}>Sin días de entrenamiento aún</Text>
          )}
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
    gap: spacing.sm,
  },
  backBtn: {
    alignSelf: 'flex-start',
  },
  backText: {
    ...typography.label,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  clientName: { ...typography.display },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  actions: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  actionBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: {
    color: colors.background,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 2,
  },
  actionBtnTextSecondary: {
    color: colors.textPrimary,
  },
  sectionLabel: {
    ...typography.label,
    letterSpacing: 3,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dayNumber: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberText: {
    color: colors.accent,
    fontWeight: '900',
    fontSize: 18,
  },
  dayName: {
    ...typography.caption,
    letterSpacing: 2,
  },
  daySubname: {
    ...typography.h3,
    marginTop: 2,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
