import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import { showAlert, showConfirm } from '../../lib/alert';

// "Programas": splits reutilizables sin cliente asignado todavía — se arman
// una vez y después se asignan (copian) a uno o varios clientes desde el
// editor. Antes esto solo existía en la web; acá es el mismo modelo
// (program_templates / program_template_days / _exercises / _series).

interface TemplateRow { id: string; name: string; duration_weeks: number | null; dayCount: number }

export default function ProgramsListScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => { fetchTemplates(); }, []));

  async function fetchTemplates() {
    const { data } = await supabase
      .from('program_templates')
      .select('id, name, duration_weeks, program_template_days(id)')
      .order('created_at', { ascending: false });
    setTemplates((data ?? []).map((t: any) => ({
      id: t.id, name: t.name, duration_weeks: t.duration_weeks,
      dayCount: t.program_template_days?.length ?? 0,
    })));
    setLoading(false);
  }

  async function createTemplate() {
    const trimmed = newName.trim();
    if (!trimmed) { showAlert('Falta el nombre', 'Ponle un nombre al programa.'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('program_templates')
      .insert({ coach_id: user!.id, name: trimmed })
      .select('id')
      .single();
    setSaving(false);
    if (error || !data) { showAlert('Error', error?.message ?? 'No se pudo crear el programa.'); return; }
    setShowNewModal(false);
    setNewName('');
    navigation.navigate('ProgramEditor', { templateId: data.id, name: trimmed });
  }

  function deleteTemplate(t: TemplateRow) {
    showConfirm(
      'Borrar programa',
      `¿Borrar "${t.name}"? Esto no afecta a los clientes a los que ya se les asignó.`,
      async () => {
        await supabase.from('program_templates').delete().eq('id', t.id);
        setTemplates(prev => prev.filter(x => x.id !== t.id));
      },
      'Borrar',
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← ATRÁS</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PROGRAMAS</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowNewModal(true)}>
          <Text style={styles.addBtnText}>+ NUEVO</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Arma un split completo sin necesidad de tener un cliente todavía — después lo asignas a uno o varios.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {templates.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>SIN PROGRAMAS AÚN</Text>
              <Text style={styles.emptyText}>Toca "+ NUEVO" para crear el primero.</Text>
            </Card>
          ) : (
            templates.map(t => (
              <TouchableOpacity
                key={t.id}
                onPress={() => navigation.navigate('ProgramEditor', { templateId: t.id, name: t.name })}
                activeOpacity={0.8}
              >
                <Card style={styles.row}>
                  <View style={styles.rowIcon}>
                    <Ionicons name="clipboard-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{t.name}</Text>
                    <Text style={styles.rowMeta}>
                      {t.dayCount} día{t.dayCount === 1 ? '' : 's'}
                      {t.duration_weeks ? ` · ${t.duration_weeks} semanas` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteTemplate(t)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={showNewModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>NUEVO PROGRAMA</Text>
            <Text style={styles.inputLabel}>NOMBRE</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="ej: Full body / 3 días"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowNewModal(false); setNewName(''); }}>
                <Text style={styles.cancelBtnText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={createTemplate} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.background} size="small" />
                  : <Text style={styles.confirmBtnText}>CREAR</Text>}
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, marginBottom: spacing.xs,
  },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  headerTitle: { ...typography.label, letterSpacing: 2 },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addBtnText: { color: colors.background, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  subtitle: { ...typography.caption, paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowIcon: {
    width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowName: { ...typography.h3 },
  rowMeta: { ...typography.caption, marginTop: 2 },
  deleteBtn: {
    width: 30, height: 30, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.lg * 2, borderTopRightRadius: radius.lg * 2,
    padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl,
  },
  modalTitle: { ...typography.h2, marginBottom: spacing.sm },
  inputLabel: { ...typography.label, letterSpacing: 2, marginBottom: -spacing.sm },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.textPrimary, fontSize: 15,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  confirmBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.accent },
  confirmBtnText: { color: colors.background, fontWeight: '900', fontSize: 13, letterSpacing: 2 },
});
