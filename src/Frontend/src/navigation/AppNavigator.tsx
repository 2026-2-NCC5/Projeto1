import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar, Platform } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { RoleSelectionScreen } from '../screens/onboarding/RoleSelectionScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { MaterialsScreen } from '../screens/home/MaterialsScreen';
import { AIChatScreen } from '../screens/ai/AIChatScreen';
import { StudentRiskScreen } from '../screens/staff/StudentRiskScreen';
import { StudentRiskDetailScreen } from '../screens/staff/StudentRiskDetailScreen';
import { StudentSearchScreen } from '../screens/staff/StudentSearchScreen';
import { StudentFullProfileScreen } from '../screens/staff/StudentFullProfileScreen';
import { CAAManagementScreen } from '../screens/staff/CAAManagementScreen';
import { RequirementDetailScreen } from '../screens/staff/RequirementDetailScreen';
import { StudentRequirementsScreen } from '../screens/student/StudentRequirementsScreen';
import { PersonalDataScreen } from '../screens/profile/PersonalDataScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { ToastNotification } from '../components/feedback/ToastNotification';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isRestoringSession } = useAuth();
  const { colors, isDark } = useTheme();
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    function handleNotificationNavigation(data: Record<string, any>) {
      if (!navigationRef.isReady()) {
        setTimeout(() => handleNotificationNavigation(data), 500);
        return;
      }

      const screen = data.screen || data.route;
      const category = data.category;
      const type = data.type || '';

      if (screen) {
        (navigationRef as any).navigate(screen, data.params || {});
      } else if (category === 'requirement' || type.includes('requirement') || data.requirementId || data.protocol) {
        (navigationRef as any).navigate('StudentRequirements');
      } else if (category === 'news' || type === 'new_notice' || data.noticeId) {
        (navigationRef as any).navigate('Materials');
      } else if (category === 'chat' || type.includes('live_') || data.sessionId) {
        (navigationRef as any).navigate('AIChat', data.params || {});
      } else if (category === 'ticket' || type.includes('ticket')) {
        (navigationRef as any).navigate('MainTabs');
      }
    }

    if (Platform.OS === 'web') return;

    // 1. Escuta toques em notificações push (quando app está aberto ou em background)
    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response?.notification?.request?.content?.data || {};
      handleNotificationNavigation(data);
    });

    // 2. Trata notificação que abriu o app do zero (cold start)
    Notifications.getLastNotificationResponseAsync()
      .then((response: any) => {
        if (response) {
          const data = response?.notification?.request?.content?.data || {};
          handleNotificationNavigation(data);
        }
      })
      .catch((err: any) => {
        console.log('Sem notificação inicial pendente:', err);
      });

    return () => {
      subscription.remove();
    };
  }, []);

  // Tela de carregamento/splash enquanto a sessão persistida é restaurada
  if (isRestoringSession) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.rootContainer}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent={false}
      />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          {isAuthenticated ? (
            /* Telas Autenticadas (Sessão Ativa e Persistente) */
            <Stack.Group>
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              <Stack.Screen name="Materials" component={MaterialsScreen} />
              <Stack.Screen name="AIChat" component={AIChatScreen} />
              <Stack.Screen name="StudentRisk" component={StudentRiskScreen} />
              <Stack.Screen name="StudentRiskDetail" component={StudentRiskDetailScreen} />
              <Stack.Screen name="StudentSearch" component={StudentSearchScreen} />
              <Stack.Screen name="StudentFullProfile" component={StudentFullProfileScreen} />
              <Stack.Screen name="CAAManagement" component={CAAManagementScreen} />
              <Stack.Screen name="RequirementDetail" component={RequirementDetailScreen} />
              <Stack.Screen name="StudentRequirements" component={StudentRequirementsScreen} />
              <Stack.Screen name="PersonalData" component={PersonalDataScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </Stack.Group>
          ) : (
            /* Telas Públicas de Boas-Vindas e Autenticação */
            <Stack.Group>
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </Stack.Group>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <ToastNotification />
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
