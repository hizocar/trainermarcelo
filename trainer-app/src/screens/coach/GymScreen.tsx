import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Gym, User } from '../../types';
import { colors, spacing, radius, typography, fonts } from '../../theme';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import { showAlert } from '../../lib/alert';

// Panel del dueño del gimnasio: invita y gestiona a sus entrenadores dentro
// del cupo de su plan. Espejo de InviteClientScreen, un nivel más arriba.
export default function GymScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [gym, setGym] = useState<Gym | null>(null);
  const [coaches, setCoaches] = useState<User[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    if (!user?.gym_id) { setLoadingList(false); return; }
    const [{ data: gymData }, { data: coachData }] = await Promise.all([
      supabase.from('gyms').select('*').eq('id', user.gym_id).single(),
      supabase.from('users').select('id, name, email, role, avatar_url, is_owner')
        .eq('gym_id', user.gym_id).eq('role', 'coach').order('name'),
    ]);
    setGym(gymData ?? null);
    setCoaches(coachData ?? []);
    setLoadingList(false);
  }

  async function inviteCoach() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      showAlert('Campos incompletos', 'Completa nombre, email y contraseña temporal.');
      return;
    }
    if (password.length < 8) {
      showAlert('Contraseña muy corta', 'Mínimo 8 caracteres.');
      return;
    }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); showAlert('Sesión expirada', 'Vuelve a iniciar sesión.'); return; }

    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/invite-coach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
          },
          body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
        },
      );
      const result = await res.json();

      if (!res.ok || result.error) {
        showAlert('No se pudo invitar', result.error ?? `Error ${res.status}`);
      } else {
        showAlert(
          '¡Entrenador agregado!',
          `${name} ya puede entrar con:\n\nEmail: ${email}\nContraseña: ${password}\n\nPídele que la cambie al entrar.`,
        );
        setName(''); setEmail(''); setPassword('');
        fetchAll();
      }
    } catch (e: any) {
      showAlert('Error de conexión', e.message ?? 'Revisa tu señal e intenta de nuevo.');
    }
    setLoading(false);
  }

  const used = coaches.length;
  const limit = gym?.coach_limit ?? 0;
  const atLimit = limit > 0 && used >= limit;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← ATRÁS</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{gym?.name.toUpperCase() ?? 'MI GIMNASIO'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.seatCard}>
          <View style={styles.seatRow}>
            <Text style={styles.seatLabel}>ENTRENADORES</Text>
            <Text style={styles.seatCount}>{used}/{limit}</Text>
          </View>
          <View style={styles.seatTrack}>
            <View style={[styles.seatFill, { width: `${limit ? Math.min(100, (used / limit) * 100) : 0}%` }]} />
          </View>
          <Text style={styles.seatSub}>
            {atLimit
              ? 'Alcanzaste el cupo de tu plan. Amplíalo para invitar más entrenadores.'
              : `Plan ${gym?.plan_tier?.toUpperCase() ?? ''} · quedan ${limit - used} cupo${limit - used === 1 ? '' : 's'}`}
          </Text>
        </Card>

        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>NUEVO ENTRENADOR</Text>

          <View style={styles.field}>
            <Text style={styles.label}>NOMBRE COMPLETO</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="ej: Camila Rojas"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              editable={!atLimit}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="camila@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!atLimit}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>CONTRASEÑA TEMPORAL</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              editable={!atLimit}
            />
          </View>

          <TouchableOpacity
            style={[styles.inviteBtn, (loading || atLimit) && styles.inviteBtnDisabled]}
            onPress={inviteCoach}
            disabled={loading || atLimit}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={colors.background} />
              : <Text style={styles.inviteBtnText}>{atLimit ? 'CUPO LLENO' : 'AGREGAR ENTRENADOR'}</Text>
            }
          </TouchableOpacity>
        </Card>

        <Text style={styles.sectionLabel}>TU EQUIPO</Text>

        {loadingList ? (
          <ActivityIndicator color={colors.accent} />
        ) : coaches.length === 0 ? (
          <Text style={styles.emptyText}>Todavía no invitas a ningún entrenador.</Text>
        ) : (
          coaches.map(c => (
            <Card key={c.id} style={styles.coachCard}>
              <View style={styles.coachRow}>
                <Avatar name={c.name} imageUrl={c.avatar_url} size={44} />
                <View style={styles.coachInfo}>
                  <Text style={styles.coachName}>{c.name}</Text>
                  <Text style={styles.coachEmail}>{c.email}</Text>
                </View>
                {c.is_owner && (
                  <View style={styles.ownerBadge}>
                    <Text style={styles.ownerBadgeText}>DUEÑO</Text>
                  </View>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg, gap: spacing.sm },
  backText: { ...typography.label, color: colors.textMuted, letterSpacing: 2 },
  title: { ...typography.display, fontSize: 26 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },

  seatCard: { gap: spacing.sm },
  seatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seatLabel: { ...typography.label, letterSpacing: 2 },
  seatCount: { fontFamily: fonts.mono, fontSize: 18, color: colors.textPrimary },
  seatTrack: { height: 6, borderRadius: radius.full, backgroundColor: colors.surface, overflow: 'hidden' },
  seatFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.accent },
  seatSub: { ...typography.caption, fontSize: 11 },

  formCard: { gap: spacing.md },
  formTitle: { ...typography.h3, color: colors.accent, letterSpacing: 1 },
  field: { gap: spacing.xs },
  label: { ...typography.label, letterSpacing: 2 },
  input: {
    backgroundColor: colors.background, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.textPrimary, fontSize: 15,
  },
  inviteBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing.md + 2, alignItems: 'center', marginTop: spacing.sm,
  },
  inviteBtnDisabled: { opacity: 0.6 },
  inviteBtnText: { color: colors.background, fontWeight: '900', fontSize: 13, letterSpacing: 2 },

  sectionLabel: { ...typography.label, letterSpacing: 3 },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  coachCard: {},
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  coachInfo: { flex: 1 },
  coachName: { ...typography.h3 },
  coachEmail: { ...typography.caption, marginTop: 2 },
  ownerBadge: {
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.accent,
  },
  ownerBadgeText: { ...typography.label, fontSize: 9, color: colors.accent, letterSpacing: 1 },
});
