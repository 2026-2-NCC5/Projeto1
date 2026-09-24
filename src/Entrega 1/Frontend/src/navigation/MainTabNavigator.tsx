import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CustomTabBar } from '../components/navigation/CustomTabBar';
import { HomeScreen } from '../screens/home/HomeScreen';
import { DocumentsScreen } from '../screens/documents/DocumentsScreen';
import { AIAssistantScreen } from '../screens/ai/AIAssistantScreen';
import { AIChatScreen } from '../screens/ai/AIChatScreen';
import { EducationScreen } from '../screens/education/EducationScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

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
      <Tab.Screen name="Educacional" component={EducationScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
};
