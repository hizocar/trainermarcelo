import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { fetchPlanWeeks, PlanWeek } from '../../lib/plan';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import { showAlert, showConfirm } from '../../lib/alert';

// "Gestión de semanas": cada semana del plan de un cliente es un split 100%
// independiente (sus propios días/ejercicios/series). Antes había un solo
// split que se repetía para siempre sin poder cerrarse ni duplicarse — ver
// supabase_migration_v17.sql para el porqué del cambio.

type RouteParams = { client: User };

export default function WeekManagerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { client } = route.params as RouteParams;
  const { user } = useAuth();

  const [planId, setPlanId] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<PlanWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    let { data: plan } = await supabase.from('workout_plans').select('id').eq('client_id', client.id).maybeSingle();
    if (!plan) {
      const { data: created } = await supabase
        .from('workout_plans')
        .insert({ client_id: client.id, name: `Plan ${client.name}`, created_by: user!.id })
        .select('id').single();
      plan = created;
    }
    if (!plan) { setLoading(false); return; }
    setPlanId(plan.id);
    const list = await fetchPlanWeeks(plan.id);
    if (list.length === 0) {
      const { data: firstWeek } = await supabase
        .from('plan_weeks')
        .insert({ plan_id: plan.id, week_number: 1, name: 'Semana 1', repeat_forever: true })
        .select('*').single();
      setWeeks(firstWeek ? [firstWeek as PlanWeek] : []);
    } else {
      setWeeks(list);
    }
    setLoading(false);
  }

  function openWeek(week: PlanWeek) {
    navigation.navigate('PlanEditor', { client, planWeekId: week.id, weekLabel: `S${week.week_number} · ${week.name}` });
  }

  async function createWeek() {
    if (!planId) return;
    const trimmed = newName.trim() || `Semana ${weeks.length + 1}`;
    setBusy(true);
    const nextNumber = weeks.length > 0 ? Math.max(...weeks.map(w => w.week_number)) + 1 : 1;
    const { data, error } = await supabase
      .from('plan_weeks')
      .insert({ plan_id: planId, week_number: nextNumber, name: trimmed })
      .select('*').single();
    setBusy(false);
    setShowNewModal(false);
    setNewName('');
    if (error || !data) { showAlert('Error', error?.message ?? 'No se pudo crear la semana.'); return; }
    setWeeks(prev => [...prev, data as PlanWeek]);
    openWeek(data as PlanWeek);
  }

  async function duplicateWeek(source: PlanWeek) {
    if (!planId) return;
    setBusy(true);
    try {
      const nextNumber = Math.max(...weeks.map(w => w.week_number)) + 1;
      const { data: newWeek, error: weekErr } = await supabase
        .from('plan_weeks')
        .insert({ plan_id: planId, week_number: nextNumber, name: `${source.name} (copia)`, is_deload: source.is_deload })
        .select('*').single();
      if (weekErr || !newWeek) throw weekErr ?? new Error('No se pudo crear la semana.');

      const { data: sourceDays, error: daysErr } = await supabase
        .from('training_days')
        .select(`
          day_number, name, week_day,
          exercises ( name, name_en, library_id, muscle_group, superseries_group,
            reps_objective, unit, ref_weight, order_index, rest_seconds, target_rir, tempo, notes,
            image_url, video_url,
            exercise_series ( series_number ) )
        `)
        .eq('plan_week_id', source.id).eq('archived', false);
      if (daysErr) throw daysErr;

      for (const day of (sourceDays ?? [])) {
        const { exercises, ...dayFields } = day as any;
        const { data: newDay, error: dayErr } = await supabase
          .from('training_days')
          .insert({ ...dayFields, plan_id: planId, plan_week_id: newWeek.id })
          .select('id').single();
        if (dayErr || !newDay) throw dayErr ?? new Error('No se pudo copiar un día.');

        for (const ex of (exercises ?? [])) {
          const { exercise_series, ...exFields } = ex;
          const { data: newEx, error: exErr } = await supabase
            .from('exercises').insert({ ...exFields, day_id: newDay.id }).select('id').single();
          if (exErr || !newEx) throw exErr ?? new Error('No se pudo copiar un ejercicio.');
          if ((exercise_series ?? []).length > 0) {
            await supabase.from('exercise_series').insert(
              exercise_series.map((s: any) => ({ exercise_id: newEx.id, series_number: s.series_number })),
            );
          }
        }
      }

      setWeeks(prev => [...prev, newWeek as PlanWeek]);
      openWeek(newWeek as PlanWeek);
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'No se pudo duplicar la semana.');
    } finally {
      setBusy(false);
    }
  }

  function deleteWeek(week: PlanWeek) {
    if (weeks.length <= 1) {
      showAlert('No se puede borrar', 'Es la única semana del plan — crea o duplica otra primero.');
      return;
    }
    showConfirm('Eliminar semana', `"${week.name}" se quitará. El historial ya registrado del cliente se conserva.`, async () => {
      setBusy(true);
      await supabase.from('plan_weeks').update({ archived: true }).eq('id', week.id);
      setBusy(false);
      setWeeks(prev => prev.filter(w => w.id !== week.id));
    }, 'Eliminar');
  }

  async function move(week: PlanWeek, dir: -1 | 1) {
    const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number);
    const idx = sorted.findIndex(w => w.id === week.id);
    const j = idx + dir;
    if (j < 0 || j >= sorted.length) return;
    const other = sorted[j];
    setBusy(true);
    await supabase.from('plan_weeks').update({ week_number: -1 }).eq('id', week.id);
    await supabase.from('plan_weeks').update({ week_number: week.week_number }).eq('id', other.id);
    await supabase.from('plan_weeks').update({ week_number: other.week_number }).eq('id', week.id);
    setBusy(false);
    setWeeks(prev => prev.map(w => {
      if (w.id === week.id) return { ...w, week_number: other.week_number };
      if (w.id === other.id) return { ...w, week_number: week.week_number };
      return w;
    }));
  }

  async function toggleDeload(week: PlanWeek) {
    setBusy(true);
    await supabase.from('plan_weeks').update({ is_deload: !week.is_deload }).eq('id', week.id);
    setBusy(false);
    setWeeks(prev => prev.map(w => w.id === week.id ? { ...w, is_deload: !w.is_deload } : w));
  }

  async function toggleRepeat(week: PlanWeek) {
    setBusy(true);
    await supabase.from('plan_weeks').update({ repeat_forever: !week.repeat_forever }).eq('id', week.id);
    setBusy(false);
    setWeeks(prev => prev.map(w => w.id === week.id ? { ...w, repeat_forever: !w.repeat_forever } : w));
  }

  async function commitRename(week: PlanWeek) {
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (!trimmed || trimmed === week.name) return;
    await supabase.from('plan_weeks').update({ name: trimmed }).eq('id', week.id);
    setWeeks(prev => prev.map(w => w.id === week.id ? { ...w, name: trimmed } : w));
  }

  const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number);

  if (loading) return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 100 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← ATRÁS</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerLabel}>SEMANAS DE</Text>
          <Text style={styles.headerName}>{client.name.toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowNewModal(true)} disabled={busy}>
          <Text style={styles.addBtnText}>+ NUEVA</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Cada semana es un split independiente. Si no planificas la siguiente, el cliente ve &quot;sin plan&quot; en vez de repetir la anterior sola — salvo que actives 🔁.
      </Text>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {sorted.map((w, i) => (
          <Card key={w.id} style={styles.weekCard}>
            <TouchableOpacity onPress={() => openWeek(w)} activeOpacity={0.8} style={styles.weekMain}>
              {renamingId === w.id ? (
                <TextInput
                  style={styles.renameInput}
                  value={renameValue}
                  onChangeText={setRenameValue}
                  onBlur={() => commitRename(w)}
                  autoFocus
                />
              ) : (
                <Text style={styles.weekTitle}>
                  S{w.week_number} · {w.name}
                  {w.is_deload ? '  🟡 DELOAD' : ''}
                  {w.repeat_forever ? '  🔁' : ''}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            <View style={styles.weekActions}>
              <TouchableOpacity style={styles.actBtn} onPress={() => move(w, -1)} disabled={busy || i === 0}>
                <Ionicons name="arrow-up" size={13} color={i === 0 ? colors.border : colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actBtn} onPress={() => move(w, 1)} disabled={busy || i === sorted.length - 1}>
                <Ionicons name="arrow-down" size={13} color={i === sorted.length - 1 ? colors.border : colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actBtn} onPress={() => { setRenamingId(w.id); setRenameValue(w.name); }} disabled={busy}>
                <Ionicons name="pencil" size={13} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actBtn} onPress={() => duplicateWeek(w)} disabled={busy}>
                <Ionicons name="copy-outline" size={13} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actBtn} onPress={() => toggleDeload(w)} disabled={busy}>
                <Text style={{ fontSize: 12 }}>{w.is_deload ? '🟡' : '⚪️'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actBtn} onPress={() => toggleRepeat(w)} disabled={busy}>
                <Text style={{ fontSize: 12, opacity: w.repeat_forever ? 1 : 0.35 }}>🔁</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actBtnDanger} onPress={() => deleteWeek(w)} disabled={busy}>
                <Ionicons name="close" size={13} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </ScrollView>

      <Modal visible={showNewModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>NUEVA SEMANA</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder={`Semana ${weeks.length + 1}`}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowNewModal(false); setNewName(''); }}>
                <Text style={styles.cancelBtnText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={createWeek} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={styles.confirmBtnText}>CREAR</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  headerLabel: { ...typography.caption, letterSpacing: 3, color: colors.textMuted },
  headerName: { ...typography.displaySm },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addBtnText: { color: colors.background, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  subtitle: { ...typography.caption, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  weekCard: { gap: spacing.sm },
  weekMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekTitle: { ...typography.h3, fontSize: 15, flex: 1 },
  renameInput: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent,
    paddingHorizontal: spacing.sm, paddingVertical: 6, color: colors.textPrimary, fontSize: 14,
  },
  weekActions: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  actBtn: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  actBtnDanger: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg * 2, borderTopRightRadius: radius.lg * 2, padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl },
  modalTitle: { ...typography.h2, marginBottom: spacing.sm },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.textPrimary, fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  confirmBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.accent },
  confirmBtnText: { color: colors.background, fontWeight: '900', fontSize: 13, letterSpacing: 2 },
});
