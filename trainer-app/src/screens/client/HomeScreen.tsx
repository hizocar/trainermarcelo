import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { MoodLog } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import MuscleMap from '../../components/common/MuscleMap';
import { showAlert } from '../../lib/alert';
import { getCurrentWeek, formatShortDate } from '../../lib/weeks';

// escala de energía 1-10 (1 = muy cansado, 10 = con mucha energía)
const ENERGY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function energyColor(n: number): string {
  if (n <= 3) return colors.danger;
  if (n <= 6) return colors.textSecondary;
  return colors.accent;
}

// fecha local YYYY-MM-DD (no UTC: a las 21:00 de Chile ya sería "mañana" en UTC)
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [moods, setMoods] = useState<MoodLog[]>([]);
  const [savingMood, setSavingMood] = useState(false);
  const [groupSets, setGroupSets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const currentWeek = getCurrentWeek();
  const today = todayLocal();
  const todayRaw = moods.find(m => m.logged_date === today)?.mood ?? null;
  const todayEnergy = todayRaw != null ? parseInt(todayRaw, 10) || null : null;

  useFocusEffect(useCallback(() => { if (user?.id) fetchAll(); }, [user?.id]));

  async function fetchAll() {
    // ánimo: últimos 7 días
    const { data: moodData } = await supabase
      .from('mood_logs')
      .select('*')
      .eq('user_id', user!.id)
      .order('logged_date', { ascending: false })
      .limit(7);
    setMoods(moodData ?? []);

    // series por grupo muscular de la semana en curso
    const { data: plan } = await supabase
      .from('workout_plans').select('id')
      .eq('client_id', user!.id).maybeSingle();
    if (!plan) { setLoading(false); return; }

    const { data: days } = await supabase
      .from('training_days').select('id').eq('plan_id', plan.id);
    const { data: exs } = await supabase
      .from('exercises').select('id, muscle_group')
      .in('day_id', (days ?? []).map(d => d.id));
    const { data: series } = await supabase
      .from('exercise_series').select('id, exercise_id')
      .in('exercise_id', (exs ?? []).map(e => e.id));

    // total de series del SPLIT semanal por grupo (lo planificado, no lo completado)
    const exGroup: Record<string, string> = {};
    (exs ?? []).forEach(e => { exGroup[e.id] = e.muscle_group?.trim() || 'Sin grupo'; });
    const counts: Record<string, number> = {};
    (series ?? []).forEach(s => {
      const g = exGroup[s.exercise_id] ?? 'Sin grupo';
      counts[g] = (counts[g] ?? 0) + 1;
    });
    setGroupSets(counts);
    setLoading(false);
  }

  async function saveMood(level: number) {
    const mood = String(level);
    if (!user) return;
    setSavingMood(true);
    const { error } = await supabase.from('mood_logs').upsert(
      { user_id: user.id, mood, logged_date: today },
      { onConflict: 'user_id,logged_date' },
    );
    setSavingMood(false);
    if (error) {
      showAlert('No se pudo guardar', error.code === '42P01'
        ? 'Falta ejecutar la migración v8 en Supabase.'
        : error.message);
    } else {
      setMoods(prev => [
        { id: 'local', user_id: user.id, mood, logged_date: today, created_at: new Date().toISOString() },
        ...prev.filter(m => m.logged_date !== today),
      ]);
    }
  }

  const groupRows = useMemo(() => {
    const rows = Object.entries(groupSets)
      .map(([group, sets]) => ({ group, sets }))
      .sort((a, b) => b.sets - a.sets);
    // "Sin grupo" siempre al final
    return [...rows.filter(r => r.group !== 'Sin grupo'), ...rows.filter(r => r.group === 'Sin grupo')];
  }, [groupSets]);
  const maxSets = Math.max(...groupRows.map(r => r.sets), 1);
  const totalSets = groupRows.reduce((a, r) => a + r.sets, 0);

  const weekHistory = useMemo(
    () => moods.filter(m => m.logged_date !== today).slice(0, 6).reverse(),
    [moods, today],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.greeting}>{formatShortDate(new Date().toISOString()).toUpperCase()}</Text>
          <Text style={styles.userName}>HOLA, {user?.name?.split(' ')[0].toUpperCase()}</Text>
        </View>

        {/* Encuesta diaria de energía */}
        <Card style={styles.moodCard}>
          <Text style={styles.moodTitle}>¿CÓMO TE SIENTES HOY?</Text>
          <View style={styles.energyRow}>
            {ENERGY_LEVELS.map(n => {
              const active = todayEnergy === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[styles.energyBtn, active && { backgroundColor: energyColor(n), borderColor: energyColor(n) }]}
                  onPress={() => saveMood(n)}
                  disabled={savingMood}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.energyBtnText, active && styles.energyBtnTextActive]}>{n}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.energyLegend}>
            <Text style={styles.energyLegendText}>1 · MUY CANSADO</Text>
            {todayEnergy != null && (
              <Text style={[styles.energyToday, { color: energyColor(todayEnergy) }]}>HOY: {todayEnergy}/10</Text>
            )}
            <Text style={styles.energyLegendText}>10 · MUCHA ENERGÍA</Text>
          </View>
          {weekHistory.length > 0 && (
            <View style={styles.moodHistory}>
              <Text style={styles.moodHistoryLabel}>DÍAS ANTERIORES</Text>
              <View style={styles.moodHistoryRow}>
                {weekHistory.map(m => {
                  const n = parseInt(m.mood, 10) || 0;
                  return (
                    <View key={m.logged_date} style={styles.moodHistoryItem}>
                      <Text style={[styles.moodHistoryEnergy, { color: energyColor(n) }]}>{n}</Text>
                      <Text style={styles.moodHistoryDate}>{m.logged_date.slice(8, 10)}/{m.logged_date.slice(5, 7)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </Card>

        {/* Series por grupo muscular (semana en curso) */}
        <Card style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>SERIES POR GRUPO MUSCULAR</Text>
            <Text style={styles.groupWeek}>SPLIT SEMANAL</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : totalSets === 0 ? (
            <Text style={styles.groupEmpty}>Tu coach aún no configura ejercicios en el plan.</Text>
          ) : (
            <>
              <MuscleMap
                height={185}
                highlights={Object.fromEntries(groupRows.map(r => [r.group, r.sets / maxSets]))}
              />
              {groupRows.map(r => (
                <View key={r.group} style={styles.groupRow}>
                  <Text style={styles.groupName} numberOfLines={1}>{r.group.toUpperCase()}</Text>
                  <View style={styles.groupBarTrack}>
                    <View style={[styles.groupBarFill, { width: `${(r.sets / maxSets) * 100}%` }]} />
                  </View>
                  <Text style={styles.groupCount}>{r.sets}</Text>
                </View>
              ))}
              <Text style={styles.groupTotal}>{totalSets} series planificadas por semana</Text>
            </>
          )}
        </Card>

        {/* Accesos rápidos */}
        <TouchableOpacity
          style={styles.ctaTrain}
          onPress={() => navigation.navigate('Today')}
          activeOpacity={0.85}
        >
          <Ionicons name="barbell" size={20} color={colors.background} />
          <Text style={styles.ctaTrainText}>ENTRENAR HOY</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.background} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ctaBody}
          onPress={() => navigation.navigate('Body')}
          activeOpacity={0.8}
        >
          <Ionicons name="body-outline" size={18} color={colors.accent} />
          <Text style={styles.ctaBodyText}>MI CUERPO · PESO, % GRASA Y FOTOS</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  greeting: { ...typography.label, letterSpacing: 3, color: colors.accent },
  userName: { ...typography.display, fontSize: 30, marginTop: 2 },

  moodCard: { gap: spacing.md },
  moodTitle: { ...typography.h3, fontSize: 15 },
  energyRow: { flexDirection: 'row', gap: 5 },
  energyBtn: {
    flex: 1, aspectRatio: 0.8, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  energyBtnText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  energyBtnTextActive: { color: colors.background },
  energyLegend: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  energyLegendText: { ...typography.caption, fontSize: 9, letterSpacing: 1 },
  energyToday: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  moodHistory: { gap: spacing.xs },
  moodHistoryLabel: { ...typography.label, fontSize: 9, letterSpacing: 2 },
  moodHistoryRow: { flexDirection: 'row', gap: spacing.md },
  moodHistoryItem: { alignItems: 'center', gap: 2 },
  moodHistoryEnergy: { fontSize: 16, fontWeight: '900' },
  moodHistoryDate: { ...typography.caption, fontSize: 9 },

  groupCard: { gap: spacing.sm },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { ...typography.h3, fontSize: 15 },
  groupWeek: { ...typography.label, fontSize: 9, letterSpacing: 1.5, color: colors.accent },
  groupEmpty: { ...typography.caption, textAlign: 'center', paddingVertical: spacing.md },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groupName: { ...typography.caption, fontWeight: '800', letterSpacing: 0.5, width: 96 },
  groupBarTrack: {
    flex: 1, height: 8, borderRadius: radius.full,
    backgroundColor: colors.surface, overflow: 'hidden',
  },
  groupBarFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.accent },
  groupCount: { fontSize: 13, fontWeight: '900', color: colors.textPrimary, width: 26, textAlign: 'right' },
  groupTotal: { ...typography.caption, fontSize: 10, textAlign: 'center', marginTop: spacing.xs },

  ctaTrain: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
  },
  ctaTrainText: { color: colors.background, fontWeight: '900', fontSize: 14, letterSpacing: 2 },
  ctaBody: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  ctaBodyText: { ...typography.label, color: colors.textPrimary, letterSpacing: 1, flex: 1 },
});
