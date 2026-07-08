import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Modal, Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { ImagePickerAsset } from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { BodyMetric, User } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import StatCard from '../../components/common/StatCard';
import TrendChart from '../../components/common/TrendChart';
import { showAlert, showConfirm } from '../../lib/alert';
import { pickImage, uploadPrivatePhoto, signedPhotoUrl } from '../../lib/media';

type RouteParams = { client?: User };
type MetricKey = 'weight_kg' | 'body_fat_pct' | 'bmi';

const METRIC_TABS: { key: MetricKey; label: string; unit: string }[] = [
  { key: 'weight_kg', label: 'PESO', unit: 'kg' },
  { key: 'body_fat_pct', label: '% GRASA', unit: '%' },
  { key: 'bmi', label: 'IMC', unit: '' },
];

export default function BodyProgressScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { client } = (route.params ?? {}) as RouteParams;
  const { user } = useAuth();

  const targetId = client?.id ?? user?.id ?? '';
  const targetName = client?.name ?? user?.name ?? '';
  const readOnly = !!client; // el coach solo mira

  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [metricTab, setMetricTab] = useState<MetricKey>('weight_kg');

  // modal de registro
  const [showForm, setShowForm] = useState(false);
  const [fWeight, setFWeight] = useState('');
  const [fHeight, setFHeight] = useState('');
  const [fFat, setFFat] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [fPhoto, setFPhoto] = useState<ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (targetId) fetchMetrics(); }, [targetId]);

  async function fetchMetrics() {
    const { data, error } = await supabase
      .from('body_metrics')
      .select('*')
      .eq('user_id', targetId)
      .order('measured_at', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      setLoading(false);
      if (error.code === '42P01') {
        showAlert('Falta la migración v7', 'Ejecuta supabase_migration_v7.sql en el SQL Editor de Supabase.');
      }
      return;
    }

    const list = data ?? [];
    setMetrics(list);
    setLoading(false);

    // URLs firmadas para las fotos (bucket privado)
    const urls: Record<string, string> = {};
    await Promise.all(list.filter(m => m.photo_path).map(async m => {
      const url = await signedPhotoUrl(m.photo_path!);
      if (url) urls[m.id] = url;
    }));
    setPhotoUrls(urls);
  }

  function openForm() {
    const last = metrics[metrics.length - 1];
    setFWeight('');
    setFHeight(last?.height_cm?.toString() ?? '');
    setFFat('');
    setFNotes('');
    setFPhoto(null);
    setShowForm(true);
  }

  async function saveMetric() {
    const weight = parseFloat(fWeight.replace(',', '.'));
    const height = parseFloat(fHeight.replace(',', '.'));
    const fat = parseFloat(fFat.replace(',', '.'));

    if (isNaN(weight) && isNaN(fat) && !fPhoto) {
      showAlert('Datos incompletos', 'Ingresa al menos el peso, el % de grasa o una foto.');
      return;
    }

    setSaving(true);
    let photoPath: string | null = null;
    if (fPhoto) {
      try {
        photoPath = await uploadPrivatePhoto(`${user!.id}/progreso-${Date.now()}.jpg`, fPhoto);
      } catch (e: any) {
        setSaving(false);
        showAlert('Error al subir foto', e.message);
        return;
      }
    }

    const { error } = await supabase.from('body_metrics').insert({
      user_id: user!.id,
      weight_kg: isNaN(weight) ? null : weight,
      height_cm: isNaN(height) ? null : height,
      body_fat_pct: isNaN(fat) ? null : fat,
      notes: fNotes.trim() || null,
      photo_path: photoPath,
    });

    setSaving(false);
    if (error) {
      showAlert('Error al guardar', error.message);
    } else {
      setShowForm(false);
      fetchMetrics();
    }
  }

  function deleteMetric(m: BodyMetric) {
    showConfirm('Eliminar registro', `¿Eliminar la medición del ${formatDate(m.measured_at)}?`, async () => {
      if (m.photo_path) await supabase.storage.from('progress-photos').remove([m.photo_path]);
      await supabase.from('body_metrics').delete().eq('id', m.id);
      fetchMetrics();
    }, 'Eliminar');
  }

  // ── derivados ──────────────────────────────────────────────────────────────
  const lastHeight = useMemo(
    () => [...metrics].reverse().find(m => m.height_cm)?.height_cm,
    [metrics],
  );

  const valueOf = (m: BodyMetric, key: MetricKey): number | null => {
    if (key === 'bmi') {
      if (!m.weight_kg || !lastHeight) return null;
      const h = lastHeight / 100;
      return Math.round((m.weight_kg / (h * h)) * 10) / 10;
    }
    return m[key] ?? null;
  };

  const trendData = useMemo(() =>
    metrics
      .map(m => ({ label: formatDate(m.measured_at), value: valueOf(m, metricTab) }))
      .filter((d): d is { label: string; value: number } => d.value != null),
    [metrics, metricTab, lastHeight],
  );

  const stats = useMemo(() => {
    const weights = metrics.filter(m => m.weight_kg != null);
    const fats = metrics.filter(m => m.body_fat_pct != null);
    const lastW = weights[weights.length - 1]?.weight_kg;
    const firstW = weights[0]?.weight_kg;
    const lastF = fats[fats.length - 1]?.body_fat_pct;
    const firstF = fats[0]?.body_fat_pct;
    const bmi = lastW && lastHeight ? (lastW / ((lastHeight / 100) ** 2)) : null;
    return {
      weight: lastW,
      weightDelta: lastW != null && firstW != null ? lastW - firstW : null,
      fat: lastF,
      fatDelta: lastF != null && firstF != null ? lastF - firstF : null,
      bmi: bmi ? Math.round(bmi * 10) / 10 : null,
    };
  }, [metrics, lastHeight]);

  const photos = metrics.filter(m => m.photo_path && photoUrls[m.id]);

  const delta = (v: number | null) =>
    v == null ? undefined : `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10} desde el inicio`;

  return (
    <View style={styles.container}>
      {navigation.canGoBack() && (
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
            <Text style={styles.backText}>ATRÁS</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerLabel}>MI CUERPO</Text>
            <Text style={styles.headerName}>{targetName.toUpperCase()}</Text>
          </View>
          {!readOnly && (
            <TouchableOpacity style={styles.addBtn} onPress={openForm} activeOpacity={0.8}>
              <Ionicons name="add" size={18} color={colors.background} />
              <Text style={styles.addBtnText}>REGISTRAR</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : metrics.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="body-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>SIN MEDICIONES</Text>
            <Text style={styles.emptyText}>
              {readOnly
                ? 'Este cliente aún no registra mediciones corporales.'
                : 'Registra tu peso, % de grasa y fotos para seguir tu evolución física.'}
            </Text>
          </Card>
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard
                accent
                label="PESO"
                value={stats.weight != null ? `${stats.weight} kg` : '—'}
                sublabel={delta(stats.weightDelta)}
              />
              <StatCard
                label="% GRASA"
                value={stats.fat != null ? `${stats.fat}%` : '—'}
                sublabel={delta(stats.fatDelta)}
              />
              <StatCard
                label="IMC"
                value={stats.bmi != null ? `${stats.bmi}` : '—'}
                sublabel={lastHeight ? `${lastHeight} cm` : undefined}
              />
            </View>

            {trendData.length >= 2 && (
              <Card style={styles.chartCard}>
                <Text style={styles.chartTitle}>EVOLUCIÓN</Text>
                <View style={styles.metricTabs}>
                  {METRIC_TABS.map(t => (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.metricTab, metricTab === t.key && styles.metricTabActive]}
                      onPress={() => setMetricTab(t.key)}
                    >
                      <Text style={[styles.metricTabText, metricTab === t.key && styles.metricTabTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TrendChart data={trendData} unit={METRIC_TABS.find(t => t.key === metricTab)?.unit} />
              </Card>
            )}

            {photos.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>FOTOS DE PROGRESO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                  {photos.map(m => (
                    <View key={m.id} style={styles.photoItem}>
                      <Image source={{ uri: photoUrls[m.id] }} style={styles.photo} />
                      <Text style={styles.photoDate}>{formatDate(m.measured_at)}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.sectionLabel}>HISTORIAL</Text>
            {[...metrics].reverse().map(m => (
              <Card key={m.id} style={styles.histRow}>
                <View style={styles.histInfo}>
                  <Text style={styles.histDate}>{formatDate(m.measured_at)}</Text>
                  <Text style={styles.histValues}>
                    {[
                      m.weight_kg != null ? `${m.weight_kg} kg` : null,
                      m.body_fat_pct != null ? `${m.body_fat_pct}% grasa` : null,
                      m.photo_path ? '📷' : null,
                    ].filter(Boolean).join(' · ') || 'Solo notas'}
                  </Text>
                  {m.notes ? <Text style={styles.histNotes}>{m.notes}</Text> : null}
                </View>
                {!readOnly && (
                  <TouchableOpacity onPress={() => deleteMetric(m)} style={styles.histDelete}>
                    <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {/* Modal registro */}
      <Modal visible={showForm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalBox}>
            <Text style={styles.modalTitle}>NUEVA MEDICIÓN</Text>

            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>PESO (kg)</Text>
                <TextInput
                  style={styles.input} value={fWeight} onChangeText={setFWeight}
                  keyboardType="decimal-pad" placeholder="72.5" placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>ESTATURA (cm)</Text>
                <TextInput
                  style={styles.input} value={fHeight} onChangeText={setFHeight}
                  keyboardType="decimal-pad" placeholder="175" placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>% DE GRASA CORPORAL (opcional)</Text>
            <TextInput
              style={styles.input} value={fFat} onChangeText={setFFat}
              keyboardType="decimal-pad" placeholder="18.5" placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>FOTO DE PROGRESO (opcional, privada)</Text>
            <TouchableOpacity
              style={styles.photoPicker}
              onPress={async () => { const a = await pickImage(); if (a) setFPhoto(a); }}
              activeOpacity={0.8}
            >
              {fPhoto ? (
                <Image source={{ uri: fPhoto.uri }} style={styles.photoPreview} resizeMode="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={26} color={colors.textMuted} />
                  <Text style={styles.photoPlaceholderText}>Solo la ven tú y tu coach</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.inputLabel}>NOTAS (opcional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]} value={fNotes} onChangeText={setFNotes}
              placeholder="ej: en ayunas, después de vacaciones..." placeholderTextColor={colors.textMuted}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={saveMetric} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={colors.background} size="small" />
                  : <Text style={styles.confirmBtnText}>GUARDAR</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  navHeader: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  backBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLabel: { ...typography.label, letterSpacing: 3, color: colors.textMuted },
  headerName: { ...typography.display, fontSize: 30 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  addBtnText: { color: colors.background, fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  chartCard: { gap: spacing.sm },
  chartTitle: { ...typography.h3 },
  metricTabs: { flexDirection: 'row', gap: spacing.sm },
  metricTab: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  metricTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  metricTabText: { ...typography.caption, fontWeight: '700', color: colors.textMuted },
  metricTabTextActive: { color: colors.background },

  sectionLabel: { ...typography.label, letterSpacing: 3, marginTop: spacing.sm },
  photoStrip: { gap: spacing.sm },
  photoItem: { alignItems: 'center', gap: 4 },
  photo: { width: 120, height: 160, borderRadius: radius.md, backgroundColor: colors.surface },
  photoDate: { ...typography.caption, fontSize: 10 },

  histRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  histInfo: { flex: 1, gap: 2 },
  histDate: { ...typography.caption, letterSpacing: 1 },
  histValues: { ...typography.h3, fontSize: 15 },
  histNotes: { ...typography.caption, fontStyle: 'italic' },
  histDelete: { padding: spacing.sm },

  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalScroll: { maxHeight: '90%', flexGrow: 0 },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg * 2, borderTopRightRadius: radius.lg * 2,
    padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl,
  },
  modalTitle: { ...typography.h2, marginBottom: spacing.sm },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  formField: { flex: 1, gap: spacing.xs },
  inputLabel: { ...typography.label, letterSpacing: 2 },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.textPrimary, fontSize: 15,
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  photoPicker: {
    borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  photoPreview: { width: '100%', height: 180 },
  photoPlaceholder: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  photoPlaceholderText: { ...typography.caption },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: {
    flex: 1, paddingVertical: spacing.md, alignItems: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  cancelBtnText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  confirmBtn: {
    flex: 1, paddingVertical: spacing.md, alignItems: 'center',
    borderRadius: radius.md, backgroundColor: colors.accent,
  },
  confirmBtnText: { color: colors.background, fontWeight: '900', fontSize: 13, letterSpacing: 2 },
});
