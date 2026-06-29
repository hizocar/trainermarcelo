import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import ClientListScreen from '../screens/coach/ClientListScreen';
import ClientDetailScreen from '../screens/coach/ClientDetailScreen';
import DayExercisesScreen from '../screens/coach/DayExercisesScreen';
import TodayScreen from '../screens/client/TodayScreen';
import WorkoutLogScreen from '../screens/client/WorkoutLogScreen';
import ProgressScreen from '../screens/client/ProgressScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={tabStyles.iconContainer}>
      <Text style={[tabStyles.iconText, focused && tabStyles.iconTextActive]}>{label}</Text>
    </View>
  );
}

function CoachTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: tabStyles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Clients"
        component={ClientListScreen}
        options={{
          tabBarLabel: 'CLIENTES',
          tabBarIcon: ({ focused }) => <TabIcon label="👥" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CoachProgress"
        component={CoachProgressWrapper}
        options={{
          tabBarLabel: 'PROGRESO',
          tabBarIcon: ({ focused }) => <TabIcon label="📈" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

function CoachProgressWrapper() {
  const { user } = useAuth();
  return <ProgressScreen />;
}

function ClientTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: tabStyles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          tabBarLabel: 'HOY',
          tabBarIcon: ({ focused }) => <TabIcon label="🏋️" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarLabel: 'PROGRESO',
          tabBarIcon: ({ focused }) => <TabIcon label="📈" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

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
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 16,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  iconContainer: { alignItems: 'center' },
  iconText: { fontSize: 20, opacity: 0.4 },
  iconTextActive: { opacity: 1 },
});
