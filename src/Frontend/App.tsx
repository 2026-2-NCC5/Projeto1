import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider } from './src/store/AuthContext';
import { AppProvider } from './src/store/AppContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { otaUpdateService } from './src/services/updates/otaUpdateService';

function AppContent() {
  const { fontScaleLevel } = useTheme();
  return (
    <View key={`app-font-level-${fontScaleLevel}`} style={{ flex: 1 }}>
      <AuthProvider>
        <AppProvider>
          <AppNavigator />
        </AppProvider>
      </AuthProvider>
    </View>
  );
}

export default function App() {
  useEffect(() => {
    otaUpdateService.checkOnAppLaunch().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
