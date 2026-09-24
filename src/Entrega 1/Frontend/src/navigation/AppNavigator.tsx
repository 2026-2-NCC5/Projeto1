import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { RoleSelectionScreen } from '../screens/onboarding/RoleSelectionScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { MaterialsScreen } from '../screens/home/MaterialsScreen';
import { AIChatScreen } from '../screens/ai/AIChatScreen';
import { useAuth } from '../store/AuthContext';
import { ToastNotification } from '../components/feedback/ToastNotification';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <NavigationContainer>
      <ToastNotification />
      <Stack.Navigator
        initialRouteName={isAuthenticated ? 'MainTabs' : 'Welcome'}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {/* Jornada Inicial: Recepção -> Onboarding -> Seleção de Perfil -> Login/Cadastro */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />

        {/* Fluxo Principal Autenticado */}
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="Materials" component={MaterialsScreen} />
        <Stack.Screen name="AIChat" component={AIChatScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
