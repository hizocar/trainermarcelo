import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import { showConfirm, showAlert } from '../../lib/alert';

// Panel del dueño: aprobar o rechazar entrenadores que se registraron.
export default function ApproveCoachesScreen() {
  const navigation = useNavigation<any>();
  const [pending, setPending] = useState<User[]>([]);
  const [coaches, setCoaches] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  async function fetchAll() {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role, avatar_url, is_owner')
      .in('role', ['coach_pending', 'coach'])
      .order('role');
    setPending((data ?? []).filter(u => u.role === 'coach_pending'));
    setCoaches((data ?? []).filter(u => u.role === 'coach'));
    setLoading(false);
  }

  async function approve(u: User) {
    const { error } = await supabase.from('users').update({ role: 'coach' }).eq('id', u.id);
    if (error) showAlert('Error', error.message);
    else fetchAll();
  }

  function reject(u: User) {
    showConfirm(
      'Rechazar entrenador',
      `¿Rechazar a ${u.name}? Volverá a ser una cuenta de cliente sin acceso de coach.`,
      async () => {
        await supabase.from('users').update({ role: 'client' }).eq('id', u.id);
        fetchAll();
      },
      'Rechazar',
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>ENTRENADORES</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <Text style={styles.sectionLabel}>
                POR APROBAR {pending.length > 0 ? `· ${pending.length}` : ''}
              </Text>
              {pending.length === 0 ? (
                <Text style={styles.empty}>No hay solicitudes pendientes.</Text>
              ) : (
                pending.map(u => (
                  <Card key={u.id} highlight style={styles.row}>
                    <Avatar name={u.name} imageUrl={u.avatar_url} size={44} />
                    <View style={styles.info}>
                      <Text style={styles.name}>{u.name}</Text>
                      <Text style={styles.email}>{u.email}</Text>
                    </View>
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(u)}>
                        <Ionicons name="close" size={18} color={colors.danger} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => approve(u)}>
                        <Ionicons name="checkmark" size={18} color={colors.background} />
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))
              )}

              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
                ACTIVOS · {coaches.length}
              </Text>
              {coaches.map(u => (
                <Card key={u.id} style={styles.row}>
                  <Avatar name={u.name} imageUrl={u.avatar_url} size={44} accent />
                  <View style={styles.info}>
                    <Text style={styles.name}>{u.name}</Text>
                    <Text style={styles.email}>{u.email}</Text>
                  </View>
                  {u.is_owner ? (
                    <View style={styles.ownerBadge}>
                      <Text style={styles.ownerText}>DUEÑO</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(u)}>
                      <Ionicons name="remove-circle-outline" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </Card>
              ))}
            </>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  title: { ...typography.display, fontSize: 26 },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  sectionLabel: { ...typography.label, letterSpacing: 3, marginBottom: spacing.sm },
  empty: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  info: { flex: 1 },
  name: { ...typography.h3, fontSize: 15 },
  email: { ...typography.caption, marginTop: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  rejectBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  approveBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  ownerBadge: {
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentSoft,
  },
  ownerText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: colors.accent },
});
