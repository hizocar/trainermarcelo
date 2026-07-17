import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { User, TrainingDay, WorkoutPlan, SessionNote } from '../../types';
import { getCurrentWeek, formatShortDate } from '../../lib/weeks';
import { unreadCount } from '../../lib/chat';

const PHASES = [
  { value: 'acumulacion', label: 'ACUMULACIÓN', color: colors.accent },
  { value: 'intensificacion', label: 'INTENSIFICACIÓN', color: '#FF9F1C' },
  { value: 'descarga', label: 'DESCARGA', color: '#4CC9F0' },
];
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';

type RouteParams = { client: User };

export default function ClientDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { user } = useAuth();
  const { client } = route.params as RouteParams;

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [days, setDays] = useState<TrainingDay[]>([]);
  const [phase, setPhase] = useState<string | null>(null);
  const [notes, setNotes] = useState<(SessionNote & { dayName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const currentWeek = getCurrentWeek();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetchPlan();
  }, []);

  useFocusEffect(React.useCallback(() => {
    if (user) unreadCount(user.id, client.id, user.id).then(setUnread);
  }, [user?.id, client.id]));

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
      const dayList = daysData ?? [];
      setDays(dayList);

      // fase de la semana actual
      const { data: ph } = await supabase
        .from('week_phases').select('phase')
        .eq('plan_id', planData.id).eq('week_number', currentWeek).maybeSingle();
      setPhase(ph?.phase ?? null);

      // últimas notas del cliente
      const { data: notesData } = await supabase
        .from('session_notes').select('*')
        .eq('user_id', client.id)
        .order('created_at', { ascending: false })
        .limit(5);
      const dayName = Object.fromEntries(dayList.map(d => [d.id, `Día ${d.day_number} · ${d.name}`]));
      setNotes((notesData ?? []).map(n => ({ ...n, dayName: dayName[n.day_id] })));
    }
    setLoading(false);
  }

  async function setWeekPhase(value: string) {
    if (!plan) return;
    if (phase === value) {
      await supabase.from('week_phases').delete().eq('plan_id', plan.id).eq('week_number', currentWeek);
      setPhase(null);
    } else {
      const { error } = await supabase.from('week_phases').upsert(
        { plan_id: plan.id, week_number: currentWeek, phase: value },
        { onConflict: 'plan_id,week_number' },
      );
      if (!error) setPhase(value);
    }
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
              style={styles.actionBtn}
              onPress={() => navigation.navigate('Chat', {
                peerId: client.id, peerName: client.name, peerAvatar: client.avatar_url,
                coachId: user!.id, clientId: client.id,
              })}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>💬 CHATEAR{unread > 0 ? `  ·  ${unread}` : ''}</Text>
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

          <Text style={styles.sectionLabel}>FASE DE LA SEMANA (SEMANA {currentWeek})</Text>
          <View style={styles.phaseRow}>
            {PHASES.map(p => (
              <TouchableOpacity
                key={p.value}
                style={[styles.phaseChip, phase === p.value && { backgroundColor: p.color, borderColor: p.color }]}
                onPress={() => setWeekPhase(p.value)}
              >
                <Text style={[styles.phaseChipText, phase === p.value && { color: colors.background }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {notes.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>NOTAS DEL CLIENTE</Text>
              {notes.map(n => (
                <Card key={n.id} style={styles.noteCard}>
                  <View style={styles.noteHeader}>
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.accent} />
                    <Text style={styles.noteMeta}>
                      {n.dayName ?? 'Día'} · S{n.week_number} · {formatShortDate(n.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.noteText}>{n.note}</Text>
                </Card>
              ))}
            </>
          )}

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
  phaseRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  phaseChip: {
    flex: 1, alignItems: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingVertical: spacing.sm,
  },
  phaseChipText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: colors.textMuted },
  noteCard: { gap: spacing.xs },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noteMeta: { ...typography.caption, fontSize: 10, letterSpacing: 0.5 },
  noteText: { ...typography.body, fontSize: 14 },
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
