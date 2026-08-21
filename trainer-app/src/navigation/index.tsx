import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useBiometricLock } from '../hooks/useBiometricLock';
import { colors } from '../theme';

export const navigationRef = createNavigationContainerRef<any>();

// iOS puede matar la app en segundo plano (poca RAM / poca señal en el
// gimnasio) sin avisar. Sin esto, al volver React Navigation arranca de
// cero y el usuario "pierde" el ejercicio que tenía abierto. Guardamos el
// árbol de navegación en cada cambio y lo restauramos al abrir de nuevo —
// pero SOLO si sigue siendo el mismo usuario logueado, para no aterrizar
// en una pantalla de coach estando logueado como cliente (o viceversa).
const NAV_STATE_KEY = 'nav-state-v1';

// Abre el chat correspondiente cuando el usuario toca una notificación de mensaje.
function openChatFromNotification(data: any) {
  if (!data || data.type !== 'chat' || !navigationRef.isReady()) return;
  navigationRef.navigate('Chat', {
    peerId: data.peerId,
    peerName: data.peerName ?? 'Chat',
    peerAvatar: null,
    coachId: data.coachId,
    clientId: data.clientId,
  });
}

// Auth
import LoginScreen from '../screens/auth/LoginScreen';

// Coach
import ClientListScreen from '../screens/coach/ClientListScreen';
import ClientDetailScreen from '../screens/coach/ClientDetailScreen';
import DayExercisesScreen from '../screens/coach/DayExercisesScreen';
import PlanEditorScreen from '../screens/coach/PlanEditorScreen';
import WeekManagerScreen from '../screens/coach/WeekManagerScreen';
import ClientWeekScreen from '../screens/coach/ClientWeekScreen';
import ClientCalendarScreen from '../screens/coach/ClientCalendarScreen';
import ProgramsListScreen from '../screens/coach/ProgramsListScreen';
import ProgramEditorScreen from '../screens/coach/ProgramEditorScreen';
import InviteClientScreen from '../screens/coach/InviteClientScreen';
import CoachPendingScreen from '../screens/coach/CoachPendingScreen';
import SubscriptionExpiredScreen from '../screens/coach/SubscriptionExpiredScreen';
import GymScreen from '../screens/coach/GymScreen';
import AppLockScreen from '../screens/shared/AppLockScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';

// Client
import HomeScreen from '../screens/client/HomeScreen';
import TodayScreen from '../screens/client/TodayScreen';
import WorkoutLogScreen from '../screens/client/WorkoutLogScreen';
import ProgressScreen from '../screens/client/ProgressScreen';
import BodyProgressScreen from '../screens/client/BodyProgressScreen';
import CoachProfileScreen from '../screens/client/CoachProfileScreen';
import SessionDetailScreen from '../screens/client/SessionDetailScreen';
import CalculatorsScreen from '../screens/shared/CalculatorsScreen';
import ChatScreen from '../screens/shared/ChatScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function tabIcon(name: keyof typeof Ionicons.glyphMap, outline: keyof typeof Ionicons.glyphMap) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
      <Ionicons name={focused ? name : outline} size={20} color={color} />
    </View>
  );
}

// ── Coach ────────────────────────────────────────────────────────────────────

function CoachTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: tabStyles.bar, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: tabStyles.label }}>
      <Tab.Screen
        name="Clients"
        component={ClientListScreen}
        options={{ tabBarLabel: 'CLIENTES', tabBarIcon: tabIcon('people', 'people-outline') }}
      />
      <Tab.Screen
        name="CoachProgress"
        component={CoachProgressScreen}
        options={{ tabBarLabel: 'PROGRESO', tabBarIcon: tabIcon('stats-chart', 'stats-chart-outline') }}
      />
    </Tab.Navigator>
  );
}

function CoachProgressScreen() {
  return <ProgressScreen />;
}

// ── Client ───────────────────────────────────────────────────────────────────

function ClientTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: tabStyles.bar, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: tabStyles.label }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'INICIO', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ tabBarLabel: 'HOY', tabBarIcon: tabIcon('barbell', 'barbell-outline') }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ tabBarLabel: 'PROGRESO', tabBarIcon: tabIcon('stats-chart', 'stats-chart-outline') }}
      />
      <Tab.Screen
        name="Profile"
        component={CoachProfileScreen}
        options={{ tabBarLabel: 'PERFIL', tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tab.Navigator>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function AppNavigator() {
  const { session, user, loading } = useAuth();
  const { locked, ready: lockReady, tryUnlock } = useBiometricLock(user?.id);
  const [navReady, setNavReady] = React.useState(false);
  const [initialState, setInitialState] = React.useState<any>(undefined);

  React.useEffect(() => {
    // app abierta desde una notificación tocada
    const sub = Notifications.addNotificationResponseReceivedListener(res => {
      openChatFromNotification(res.notification.request.content.data);
    });
    // app lanzada desde cero al tocar una notificación
    Notifications.getLastNotificationResponseAsync().then(res => {
      if (res) setTimeout(() => openChatFromNotification(res.notification.request.content.data), 600);
    });
    return () => sub.remove();
  }, [session]);

  React.useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(NAV_STATE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.userId && saved.userId === user?.id) setInitialState(saved.state);
        }
      } catch {
        // estado corrupto o no legible: se ignora y arranca de cero, no es fatal
      } finally {
        setNavReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function persistNavState(state: any) {
    if (!user?.id) return;
    AsyncStorage.setItem(NAV_STATE_KEY, JSON.stringify({ userId: user.id, state })).catch(() => {});
  }

  React.useEffect(() => {
    // logout: no dejar el árbol de navegación de la sesión anterior guardado
    if (!loading && !session) AsyncStorage.removeItem(NAV_STATE_KEY).catch(() => {});
  }, [loading, session]);

  if (loading || !navReady || (session && !lockReady)) return null;

  // Face ID activado por el usuario: bloquea toda la app hasta verificar.
  // Los datos no se tocan — solo se pausa la vista hasta desbloquear.
  if (session && locked) return <AppLockScreen onUnlock={tryUnlock} />;

  // el gimnasio no está al día: se pausa el panel de coach (los datos no se tocan)
  const subscriptionBlocked = user?.role === 'coach' && !!user.gymStatus && !['active', 'trialing', 'free_month'].includes(user.gymStatus);

  return (
    <NavigationContainer
      ref={navigationRef}
      initialState={session ? initialState : undefined}
      onStateChange={persistNavState}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user?.role === 'coach_pending' ? (
          <Stack.Screen name="CoachPending" component={CoachPendingScreen} />
        ) : subscriptionBlocked ? (
          <Stack.Screen name="SubscriptionExpired" component={SubscriptionExpiredScreen} />
        ) : user?.role === 'coach' ? (
          <>
            <Stack.Screen name="CoachHome" component={CoachTabs} />
            <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
            <Stack.Screen name="DayExercises" component={DayExercisesScreen} />
            <Stack.Screen name="ClientProgress" component={ProgressScreen} />
            <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
            <Stack.Screen name="ClientBody" component={BodyProgressScreen} />
            <Stack.Screen name="PlanEditor" component={PlanEditorScreen} />
            <Stack.Screen name="WeekManager" component={WeekManagerScreen} />
            <Stack.Screen name="ClientWeek" component={ClientWeekScreen} />
            <Stack.Screen name="WorkoutLog" component={WorkoutLogScreen} />
            <Stack.Screen name="ClientCalendar" component={ClientCalendarScreen} />
            <Stack.Screen name="Programs" component={ProgramsListScreen} />
            <Stack.Screen name="ProgramEditor" component={ProgramEditorScreen} />
            <Stack.Screen name="InviteClient" component={InviteClientScreen} />
            <Stack.Screen name="Calculators" component={CalculatorsScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Gym" component={GymScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="ClientHome" component={ClientTabs} />
            <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
            <Stack.Screen name="WorkoutLog" component={WorkoutLogScreen} />
            <Stack.Screen name="Body" component={BodyProgressScreen} />
            <Stack.Screen name="Calculators" component={CalculatorsScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    backgroundColor: colors.backgroundElevated,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 84,
    paddingBottom: 18,
    paddingTop: 10,
  },
  label: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },
  iconWrap: {
    width: 42, height: 30, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.accentSoft },
});
