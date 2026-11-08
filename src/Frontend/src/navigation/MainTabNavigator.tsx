import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CustomTabBar } from '../components/navigation/CustomTabBar';
import { HomeScreen } from '../screens/home/HomeScreen';
import { DocumentsScreen } from '../screens/documents/DocumentsScreen';
import { AIAssistantScreen } from '../screens/ai/AIAssistantScreen';
import { AIChatScreen } from '../screens/ai/AIChatScreen';
import { EducationScreen } from '../screens/education/EducationScreen';
import { CAAManagementScreen } from '../screens/staff/CAAManagementScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { useAuth } from '../store/AuthContext';

const Tab = createBottomTabNavigator();
const AIStack = createNativeStackNavigator();

function AINavigator() {
  return (
    <AIStack.Navigator screenOptions={{ headerShown: false }}>
      <AIStack.Screen name="AIAssistantHome" component={AIAssistantScreen} />
      <AIStack.Screen name="AIChat" component={AIChatScreen} />
    </AIStack.Navigator>
  );
}

function FourthTabScreen() {
  const { user, selectedRole } = useAuth();
  const currentRole = user?.role || selectedRole || 'Aluno';
  return currentRole === 'Funcionário' ? <CAAManagementScreen /> : <EducationScreen />;
}

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Arquivo" component={DocumentsScreen} />
      <Tab.Screen name="IA" component={AINavigator} />
      <Tab.Screen name="Educacional" component={FourthTabScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
};
