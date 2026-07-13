import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
  ImageBackground, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const COACH_INSTAGRAM = 'https://www.instagram.com/marcetherapistt/';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { colors, spacing, radius, typography } from '../../theme';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import { pickImage, uploadImage } from '../../lib/media';
import { showAlert, showConfirm } from '../../lib/alert';
import { scheduleReminders, cancelReminders, notificationsEnabled } from '../../lib/notifications';
import { Switch, Platform } from 'react-native';

export default function CoachProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const [coach, setCoach] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notifOn, setNotifOn] = useState(false);

  useEffect(() => { fetchCoach(); notificationsEnabled().then(setNotifOn); }, []);
  useEffect(() => { setAvatarUrl(user?.avatar_url ?? null); }, [user?.avatar_url]);

  async function fetchCoach() {
    if (!user?.coach_id) { setLoading(false); return; }
    const { data } = await supabase
      .from('users').select('*').eq('id', user.coach_id).single();
    setCoach(data);
    setLoading(false);
  }

  async function changeAvatar() {
    if (!user) return;
    const asset = await pickImage();
    if (!asset) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadImage('avatars', `${user.id}/avatar.jpg`, asset);
      const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
      if (error) throw new Error(error.message);
      setAvatarUrl(url);
    } catch (e: any) {
      showAlert('Error al subir foto', e.message ?? 'Revisa que la migración v6 esté aplicada en Supabase.');
    }
    setUploadingAvatar(false);
  }

  async function toggleNotifications(value: boolean) {
    if (!value) {
      await cancelReminders();
      setNotifOn(false);
      return;
    }
    const { data: plan } = await supabase
      .from('workout_plans').select('id').eq('client_id', user!.id).maybeSingle();
    const { data: days } = plan
      ? await supabase.from('training_days').select('day_number, name, week_day').eq('plan_id', plan.id)
      : { data: [] };
    const ok = await scheduleReminders(days ?? []);
    if (ok) {
      setNotifOn(true);
      showAlert('Recordatorios activados', 'Te avisaremos tus días de entrenamiento y la encuesta diaria de energía.');
    } else {
      showAlert('Permiso denegado', 'Activa las notificaciones para la app en los Ajustes de tu iPhone.');
    }
  }

  function handleSignOut() {
    showConfirm('Cerrar sesión', '¿Seguro que quieres salir?', signOut, 'Salir');
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.mySection}>
          <Text style={styles.sectionLabel}>MI PERFIL</Text>
          <Card style={styles.profileCard}>
            <View style={styles.avatarRow}>
              <TouchableOpacity onPress={changeAvatar} activeOpacity={0.7}>
                {uploadingAvatar ? (
                  <View style={styles.avatarLoading}>
                    <ActivityIndicator color={colors.accent} />
                  </View>
                ) : (
                  <View>
                    <Avatar name={user?.name ?? 'U'} imageUrl={avatarUrl} size={60} />
                    <View style={styles.cameraBadge}>
                      <Ionicons name="camera" size={11} color={colors.background} />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
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
            <ImageBackground
              source={require('../../../assets/hero-marcelo.jpg')}
              style={styles.coachBanner}
              imageStyle={styles.coachBannerImg}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['rgba(26,26,26,0)', 'rgba(26,26,26,0.35)', '#1A1A1A']}
                locations={[0, 0.6, 1]}
                style={StyleSheet.absoluteFill}
              />
            </ImageBackground>

            <View style={styles.coachBody}>
              <View style={styles.avatarRow}>
                <Avatar name={coach.name} imageUrl={coach.avatar_url} size={60} accent />
                <View style={styles.coachInfo}>
                  <Text style={styles.coachName}>{coach.name.toUpperCase()}</Text>
                  <View style={styles.coachRoleBadge}>
                    <Text style={styles.coachRoleText}>COACH · THERAPIST</Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.coachContact}>
                <Text style={styles.contactLabel}>CONTACTO</Text>
                <Text style={styles.contactValue}>{coach.email}</Text>
              </View>

              <TouchableOpacity
                style={styles.igBtn}
                onPress={() => Linking.openURL(COACH_INSTAGRAM)}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-instagram" size={18} color={colors.accent} />
                <Text style={styles.igBtnText}>@marcetherapistt</Text>
                <Ionicons name="open-outline" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          <Card style={styles.noCoachCard}>
            <Text style={styles.noCoachText}>No tienes entrenador asignado aún.</Text>
          </Card>
        )}

        {Platform.OS !== 'web' && (
          <Card style={styles.notifCard}>
            <View style={styles.notifRow}>
              <Ionicons name="notifications-outline" size={18} color={colors.accent} />
              <View style={styles.notifInfo}>
                <Text style={styles.notifTitle}>RECORDATORIOS</Text>
                <Text style={styles.notifSub}>Tus días de entrenamiento y la encuesta diaria</Text>
              </View>
              <Switch
                value={notifOn}
                onValueChange={toggleNotifications}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.textPrimary}
              />
            </View>
          </Card>
        )}

        <TouchableOpacity
          style={styles.calcBtn}
          onPress={() => navigation.navigate('Calculators')}
          activeOpacity={0.8}
        >
          <Ionicons name="calculator-outline" size={18} color={colors.accent} />
          <Text style={styles.calcBtnText}>CALCULADORAS · 1RM Y DISCOS</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.logoutSection}>
          <TouchableOpacity onPress={handleSignOut}>
            <Text style={styles.logoutBtn}>CERRAR SESIÓN</Text>
          </TouchableOpacity>
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
  avatarLoading: {
    width: 60, height: 60, borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  profileName: { ...typography.h3 },
  profileEmail: { ...typography.caption, marginTop: 2 },
  roleBadge: {
    marginTop: spacing.xs, alignSelf: 'flex-start',
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  roleBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: colors.textMuted },

  coachCard: { padding: 0, overflow: 'hidden' },
  coachBanner: { height: 130 },
  coachBannerImg: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  coachBody: { padding: spacing.md, gap: spacing.md, marginTop: -spacing.lg },
  igBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  igBtnText: { ...typography.label, color: colors.textPrimary, letterSpacing: 1 },
  coachInfo: { flex: 1 },
  coachName: { ...typography.displaySm },
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

  notifCard: {},
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notifInfo: { flex: 1 },
  notifTitle: { ...typography.label, color: colors.textPrimary, letterSpacing: 1.5 },
  notifSub: { ...typography.caption, fontSize: 10, marginTop: 1 },
  calcBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  calcBtnText: { ...typography.label, color: colors.textPrimary, letterSpacing: 1, flex: 1 },
  logoutSection: { marginTop: spacing.lg, alignItems: 'center' },
  logoutBtn: { ...typography.label, color: colors.danger, letterSpacing: 3, padding: spacing.md },
});
