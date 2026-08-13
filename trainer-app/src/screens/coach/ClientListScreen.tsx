import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import { showConfirm } from '../../lib/alert';
import { loadCoachDashboard, CoachDashboardRow } from '../../lib/coachDashboard';

export default function ClientListScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const [clients, setClients] = useState<CoachDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchClients();
  }, [user?.id]);

  async function fetchClients() {
    const data = await loadCoachDashboard(user!.id);
    setClients(data);
    setLoading(false);
  }

  function handleSignOut() {
    showConfirm('Cerrar sesión', '¿Seguro que quieres salir?', signOut, 'Salir');
  }

  const hoy = new Date();
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hoyKey = dayKey(hoy);
  const ayerKey = dayKey(new Date(hoy.getTime() - 86400000));

  function ultimaVez(row: CoachDashboardRow) {
    if (!row.lastTrainedKey) return 'sin registros en 2 semanas';
    if (row.lastTrainedKey === hoyKey) return 'entrenó hoy';
    if (row.lastTrainedKey === ayerKey) return 'entrenó ayer';
    const dias = Math.round(
      (new Date(hoyKey).getTime() - new Date(row.lastTrainedKey).getTime()) / 86400000,
    );
    return `hace ${dias} días`;
  }

  function detalle(row: CoachDashboardRow) {
    if (row.status.total === 0) return 'sin plan asignado';
    return `${row.status.done} de ${row.status.total} días · ${ultimaVez(row)}`;
  }

  const atencion = clients.filter(c => c.status.needsAttention);
  const alDia = clients.filter(c => !c.status.needsAttention);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.nameRow}>
          <Avatar name={user?.name ?? 'C'} imageUrl={user?.avatar_url} size={46} accent />
          <View style={styles.nameBlock}>
            <Text style={styles.greeting}>HOLA,</Text>
            <Text style={styles.coachName} numberOfLines={1} adjustsFontSizeToFit>
              {user?.name?.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('InviteClient')}
            style={styles.inviteBtn}
          >
            <Ionicons name="person-add" size={14} color={colors.background} />
            <Text style={styles.inviteBtnText}>CLIENTE</Text>
          </TouchableOpacity>
          <View style={styles.headerIcons}>
            {user?.is_owner && (
              <TouchableOpacity onPress={() => navigation.navigate('Gym')} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="business-outline" size={18} color={colors.accent} />
                <Text style={styles.iconLabel}>GIMNASIO</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Programs')} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="clipboard-outline" size={18} color={colors.textMuted} />
              <Text style={styles.iconLabel}>PROGRAMAS</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Calculators')} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="calculator-outline" size={18} color={colors.textMuted} />
              <Text style={styles.iconLabel}>CALCULAR</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="settings-outline" size={18} color={colors.textMuted} />
              <Text style={styles.iconLabel}>AJUSTES</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSignOut} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="log-out-outline" size={19} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {clients.length === 0 && (
            <Text style={styles.emptyText}>No hay clientes aún</Text>
          )}

          {atencion.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.warning }]}>NECESITAN ATENCIÓN</Text>
              {atencion.map(item => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigation.navigate('ClientDetail', { client: item })}
                  activeOpacity={0.7}
                >
                  <Card style={{ ...styles.clientCard, borderColor: colors.warning }}>
                    <Avatar name={item.name} imageUrl={item.avatar_url} size={52} accent />
                    <View style={styles.clientInfo}>
                      <Text style={styles.clientName}>{item.name}</Text>
                      <Text style={[styles.clientSub, { color: colors.warning }]}>{detalle(item)}</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </>
          )}

          {alDia.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>{atencion.length > 0 ? 'AL DÍA' : 'CLIENTES'}</Text>
              {alDia.map(item => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigation.navigate('ClientDetail', { client: item })}
                  activeOpacity={0.7}
                >
                  <Card style={styles.clientCard}>
                    <Avatar name={item.name} imageUrl={item.avatar_url} size={52} accent />
                    <View style={styles.clientInfo}>
                      <Text style={styles.clientName}>{item.name}</Text>
                      <Text style={styles.clientSub}>{detalle(item)}</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </>
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
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  nameBlock: { flex: 1 },
  greeting: {
    ...typography.caption,
    letterSpacing: 3,
    color: colors.textMuted,
  },
  coachName: { ...typography.display, fontSize: 30, color: colors.accent },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inviteBtnText: {
    color: colors.background,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: { fontSize: 7.5, fontWeight: '800', letterSpacing: 0.5, color: colors.textMuted, marginTop: 2 },
  sectionLabel: {
    ...typography.label,
    letterSpacing: 3,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    ...typography.h3,
  },
  clientSub: {
    ...typography.caption,
    marginTop: 2,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
