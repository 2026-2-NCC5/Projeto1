import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { StudentDashboard } from './roles/StudentDashboard';
import { StaffDashboard } from './roles/StaffDashboard';

export const HomeScreen: React.FC = () => {
  const { user, selectedRole } = useAuth();
  const { colors, isDark } = useTheme();
  const currentRole = user?.role || selectedRole || 'Aluno';

  const renderDashboard = () => {
    switch (currentRole) {
      case 'Funcionário':
        return <StaffDashboard />;
      case 'Aluno':
      default:
        return <StudentDashboard />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : (currentRole === 'Funcionário' ? 'dark-content' : 'light-content')}
        backgroundColor={isDark ? colors.background : (currentRole === 'Funcionário' ? colors.background : colors.primary)}
      />
      {renderDashboard()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
