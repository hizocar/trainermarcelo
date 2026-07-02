import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';

export default function ClientListScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const [clients, setClients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchClients();
  }, [user?.id]);

  async function fetchClients() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'client')
      .eq('coach_id', user?.id);
    console.log('[ClientList] data:', JSON.stringify(data), 'error:', error?.message);
    setClients(data ?? []);
    setLoading(false);
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>HOLA,</Text>
          <Text style={styles.coachName}>{user?.name?.toUpperCase()}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('InviteClient')}
            style={styles.inviteBtn}
          >
            <Text style={styles.inviteBtnText}>+ CLIENTE</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>SALIR</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionLabel}>CLIENTES</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={clients}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay clientes aún</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('ClientDetail', { client: item })}
              activeOpacity={0.7}
            >
              <Card style={styles.clientCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                </View>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{item.name}</Text>
                  <Text style={styles.clientSub}>Ver plan de entrenamiento →</Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  greeting: {
    ...typography.caption,
    letterSpacing: 3,
    color: colors.textMuted,
  },
  coachName: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: -1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inviteBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  inviteBtnText: {
    color: colors.background,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
  },
  logoutBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  logoutText: {
    ...typography.label,
    color: colors.textMuted,
    letterSpacing: 2,
  },
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
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.background,
    fontWeight: '900',
    fontSize: 18,
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
