import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { User, TrainingDay, SessionNote } from '../../types';
import { getCurrentWeek, formatShortDate } from '../../lib/weeks';
import { unreadCount } from '../../lib/chat';
import { fetchFullPlan, PlanDay } from '../../lib/plan';
import { colors, spacing, radius, typography, fonts } from '../../theme';
import Card from '../../components/common/Card';
import MuscleMap from '../../components/common/MuscleMap';

type RouteParams = { client: User };

const WEEKDAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

export default function ClientDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { user } = useAuth();
  const { client } = route.params as RouteParams;

  const [days, setDays] = useState<TrainingDay[]>([]);
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [groupSets, setGroupSets] = useState<{ group: string; sets: number }[]>([]);
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
    const plan = await fetchFullPlan(client.id);
    if (plan) {
      const active = plan.days.filter(d => !d.name.toLowerCase().includes('libre'));
      setDays(active);
      setPlanDays(active);

      // series del split semanal por grupo muscular (para ver solapes/repetición)
      const counts: Record<string, number> = {};
      plan.days.forEach(d => d.exercises.forEach(e => {
        const g = e.muscle_group?.trim() || 'Sin grupo';
        counts[g] = (counts[g] ?? 0) + e.exercise_series.length;
      }));
      const rows = Object.entries(counts)
        .map(([group, sets]) => ({ group, sets }))
        .sort((a, b) => b.sets - a.sets);
      setGroupSets([...rows.filter(r => r.group !== 'Sin grupo'), ...rows.filter(r => r.group === 'Sin grupo')]);

      // últimas notas del cliente
      const { data: notesData } = await supabase
        .from('session_notes').select('*')
        .eq('user_id', client.id)
        .order('created_at', { ascending: false })
        .limit(5);
      const dayName = Object.fromEntries(plan.days.map(d => [d.id, `Día ${d.day_number} · ${d.name}`]));
      setNotes((notesData ?? []).map(n => ({ ...n, dayName: dayName[n.day_id] })));
    }
    setLoading(false);
  }

  const maxSets = Math.max(...groupSets.map(r => r.sets), 1);
  const totalSets = groupSets.reduce((a, r) => a + r.sets, 0);

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

          {planDays.length > 0 && (
            <Card style={styles.weekCard}>
              <Text style={styles.volumeTitle}>SEMANA PLANIFICADA</Text>
              <Text style={styles.volumeSub}>
                Cada columna es un día · desliza para ver todos los ejercicios de la semana
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.weekScroll}
              >
                {planDays.map(day => {
                  const totalDaySets = day.exercises.reduce((a, e) => a + e.exercise_series.length, 0);
                  return (
                    <TouchableOpacity
                      key={day.id}
                      style={styles.dayColumn}
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate('DayExercises', { day, client })}
                    >
                      <View style={styles.dayColHeader}>
                        {day.week_day != null && (
                          <Text style={styles.dayColWeekday}>{WEEKDAYS[day.week_day] ?? ''}</Text>
                        )}
                        <Text style={styles.dayColName} numberOfLines={2}>{day.name.toUpperCase()}</Text>
                        <Text style={styles.dayColMeta}>{day.exercises.length} ej · {totalDaySets} series</Text>
                      </View>
                      {day.exercises.map(e => (
                        <View key={e.id} style={styles.exItem}>
                          <View style={styles.exSetsBadge}>
                            <Text style={styles.exSetsBadgeText}>{e.exercise_series.length}</Text>
                          </View>
                          <View style={styles.exItemBody}>
                            <Text style={styles.exItemName} numberOfLines={2}>{e.name}</Text>
                            {!!e.muscle_group && (
                              <Text style={styles.exItemGroup} numberOfLines={1}>{e.muscle_group}</Text>
                            )}
                          </View>
                        </View>
                      ))}
                      {day.exercises.length === 0 && (
                        <Text style={styles.exItemGroup}>Sin ejercicios</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Card>
          )}

          {totalSets > 0 && (
            <Card style={styles.volumeCard}>
              <Text style={styles.volumeTitle}>VOLUMEN SEMANAL POR GRUPO</Text>
              <Text style={styles.volumeSub}>
                {days.length} días · {totalSets} series planificadas — revisa solapes entre grupos
              </Text>
              <MuscleMap
                height={175}
                highlights={Object.fromEntries(groupSets.map(r => [r.group, r.sets / maxSets]))}
              />
              {groupSets.map(r => (
                <View key={r.group} style={styles.volRow}>
                  <Text style={styles.volName} numberOfLines={1}>{r.group.toUpperCase()}</Text>
                  <View style={styles.volBarTrack}>
                    <View style={[styles.volBarFill, { width: `${(r.sets / maxSets) * 100}%` }]} />
                  </View>
                  <Text style={styles.volCount}>{r.sets}</Text>
                </View>
              ))}
            </Card>
          )}

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
  volumeCard: { gap: spacing.sm, marginBottom: spacing.sm },
  volumeTitle: { ...typography.h3, fontSize: 15 },
  volumeSub: { ...typography.caption },

  weekCard: { gap: spacing.sm, marginBottom: spacing.sm },
  weekScroll: { gap: spacing.sm, paddingTop: spacing.xs },
  dayColumn: {
    width: 150,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  dayColHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
    marginBottom: 2,
  },
  dayColWeekday: { ...typography.label, fontSize: 9, letterSpacing: 2, color: colors.accent },
  dayColName: { ...typography.h3, fontSize: 13, marginTop: 1 },
  dayColMeta: { ...typography.monoSm, fontSize: 9.5, marginTop: 2 },
  exItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, paddingVertical: 3 },
  exSetsBadge: {
    minWidth: 18, height: 18, borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  exSetsBadgeText: { fontFamily: fonts.mono, fontSize: 10, color: colors.accent },
  exItemBody: { flex: 1 },
  exItemName: { ...typography.caption, fontSize: 11, color: colors.textPrimary, fontWeight: '600' },
  exItemGroup: { ...typography.caption, fontSize: 9, color: colors.textMuted },
  volRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  volName: { ...typography.caption, fontWeight: '800', fontSize: 10, width: 100 },
  volBarTrack: { flex: 1, height: 8, borderRadius: radius.full, backgroundColor: colors.surface, overflow: 'hidden' },
  volBarFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.accent },
  volCount: { fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary, width: 26, textAlign: 'right' },
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
