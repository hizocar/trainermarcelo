import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';

export default function CoachProfileScreen() {
  const { user, signOut } = useAuth();
  const [coach, setCoach] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCoach(); }, []);

  async function fetchCoach() {
    if (!user?.coach_id) { setLoading(false); return; }
    const { data } = await supabase
      .from('users').select('*').eq('id', user.coach_id).single();
    setCoach(data);
    setLoading(false);
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.mySection}>
          <Text style={styles.sectionLabel}>MI PERFIL</Text>
          <Card style={styles.profileCard}>
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user?.name ?? 'U')}</Text>
              </View>
              <View>
                <Text style={styles.profileName}>{user?.name}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>CLIENTE</Text>
                </View>
              </View>
            </View>
          </Card>
        </View>

        <Text style={styles.sectionLabel}>MI ENTRENADOR</Text>

        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : coach ? (
          <Card style={styles.coachCard}>
            <View style={styles.avatarRow}>
              <View style={[styles.avatar, styles.avatarCoach]}>
                <Text style={[styles.avatarText, styles.avatarTextCoach]}>
                  {getInitials(coach.name)}
                </Text>
              </View>
              <View style={styles.coachInfo}>
                <Text style={styles.coachName}>{coach.name}</Text>
                <View style={styles.coachRoleBadge}>
                  <Text style={styles.coachRoleText}>ENTRENADOR</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.coachContact}>
              <Text style={styles.contactLabel}>CONTACTO</Text>
              <Text style={styles.contactValue}>{coach.email}</Text>
            </View>
          </Card>
        ) : (
          <Card style={styles.noCoachCard}>
            <Text style={styles.noCoachText}>No tienes entrenador asignado aún.</Text>
          </Card>
        )}

        <View style={styles.logoutSection}>
          <Text
            style={styles.logoutBtn}
            onPress={signOut}
          >
            CERRAR SESIÓN
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },

  mySection: { gap: spacing.sm },
  sectionLabel: { ...typography.label, letterSpacing: 3, marginBottom: -spacing.xs },

  profileCard: { gap: spacing.md },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 60, height: 60, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCoach: { backgroundColor: colors.accent, borderColor: colors.accent },
  avatarText: { color: colors.accent, fontWeight: '900', fontSize: 20 },
  avatarTextCoach: { color: colors.background },
  profileName: { ...typography.h3 },
  profileEmail: { ...typography.caption, marginTop: 2 },
  roleBadge: {
    marginTop: spacing.xs, alignSelf: 'flex-start',
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  roleBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: colors.textMuted },

  coachCard: { gap: spacing.md },
  coachInfo: { flex: 1 },
  coachName: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  coachRoleBadge: {
    marginTop: spacing.xs, alignSelf: 'flex-start',
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accent + '22',
  },
  coachRoleText: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: colors.accent },
  divider: { height: 1, backgroundColor: colors.border },
  coachContact: { gap: spacing.xs },
  contactLabel: { ...typography.label, letterSpacing: 2 },
  contactValue: { ...typography.body, color: colors.textPrimary },

  noCoachCard: { alignItems: 'center', paddingVertical: spacing.xl },
  noCoachText: { ...typography.body, color: colors.textMuted },

  logoutSection: { marginTop: spacing.lg, alignItems: 'center' },
  logoutBtn: { ...typography.label, color: colors.danger, letterSpacing: 3, padding: spacing.md },
});
