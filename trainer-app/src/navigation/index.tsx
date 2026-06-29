import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
import TodayScreen from '../screens/client/TodayScreen';
import WorkoutLogScreen from '../screens/client/WorkoutLogScreen';
import ProgressScreen from '../screens/client/ProgressScreen';
import CoachProfileScreen from '../screens/client/CoachProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.35 }}>{emoji}</Text>;
}

// ── Coach ────────────────────────────────────────────────────────────────────

function CoachTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: tabStyles.bar, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: tabStyles.label }}>
      <Tab.Screen
        name="Clients"
        component={ClientListScreen}
        options={{ tabBarLabel: 'CLIENTES', tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} /> }}
      />
      <Tab.Screen
        name="CoachProgress"
        component={CoachProgressScreen}
        options={{ tabBarLabel: 'PROGRESO', tabBarIcon: ({ focused }) => <TabIcon emoji="📈" focused={focused} /> }}
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
        name="Today"
        component={TodayScreen}
        options={{ tabBarLabel: 'HOY', tabBarIcon: ({ focused }) => <TabIcon emoji="🏋️" focused={focused} /> }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ tabBarLabel: 'PROGRESO', tabBarIcon: ({ focused }) => <TabIcon emoji="📈" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={CoachProfileScreen}
        options={{ tabBarLabel: 'PERFIL', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }}
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
            <Stack.Screen name="PlanEditor" component={PlanEditorScreen} />
            <Stack.Screen name="InviteClient" component={InviteClientScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="ClientHome" component={ClientTabs} />
            <Stack.Screen name="WorkoutLog" component={WorkoutLogScreen} />
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
