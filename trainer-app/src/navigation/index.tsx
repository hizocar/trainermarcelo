import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';

// Coach
import ClientListScreen from '../screens/coach/ClientListScreen';
import ClientDetailScreen from '../screens/coach/ClientDetailScreen';
import DayExercisesScreen from '../screens/coach/DayExercisesScreen';
import PlanEditorScreen from '../screens/coach/PlanEditorScreen';
import InviteClientScreen from '../screens/coach/InviteClientScreen';

// Client
import HomeScreen from '../screens/client/HomeScreen';
import TodayScreen from '../screens/client/TodayScreen';
import WorkoutLogScreen from '../screens/client/WorkoutLogScreen';
import HistoryScreen from '../screens/client/HistoryScreen';
import ProgressScreen from '../screens/client/ProgressScreen';
import BodyProgressScreen from '../screens/client/BodyProgressScreen';
import CoachProfileScreen from '../screens/client/CoachProfileScreen';
import CalculatorsScreen from '../screens/shared/CalculatorsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function tabIcon(name: keyof typeof Ionicons.glyphMap, outline: keyof typeof Ionicons.glyphMap) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <Ionicons name={focused ? name : outline} size={22} color={color} />
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
        name="History"
        component={HistoryScreen}
        options={{ tabBarLabel: 'HISTORIAL', tabBarIcon: tabIcon('time', 'time-outline') }}
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
  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user?.role === 'coach' ? (
          <>
            <Stack.Screen name="CoachHome" component={CoachTabs} />
            <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
            <Stack.Screen name="DayExercises" component={DayExercisesScreen} />
            <Stack.Screen name="ClientProgress" component={ProgressScreen} />
            <Stack.Screen name="ClientBody" component={BodyProgressScreen} />
            <Stack.Screen name="PlanEditor" component={PlanEditorScreen} />
            <Stack.Screen name="InviteClient" component={InviteClientScreen} />
            <Stack.Screen name="Calculators" component={CalculatorsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="ClientHome" component={ClientTabs} />
            <Stack.Screen name="WorkoutLog" component={WorkoutLogScreen} />
            <Stack.Screen name="Body" component={BodyProgressScreen} />
            <Stack.Screen name="Calculators" component={CalculatorsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 16,
    paddingTop: 8,
  },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});
