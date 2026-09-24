import React from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { useAuth } from '../../store/AuthContext';
import { colors } from '../../theme';
import { StudentDashboard } from './roles/StudentDashboard';
import { StaffDashboard } from './roles/StaffDashboard';
import { ParentDashboard } from './roles/ParentDashboard';
import { TeacherDashboard } from './roles/TeacherDashboard';

export const HomeScreen: React.FC = () => {
  const { user, selectedRole } = useAuth();
  const currentRole = user?.role || selectedRole || 'Aluno';

  const renderDashboard = () => {
    switch (currentRole) {
      case 'Funcionário':
        return <StaffDashboard />;
      case 'Pais':
        return <ParentDashboard />;
      case 'Professor':
        return <TeacherDashboard />;
      case 'Aluno':
      default:
        return <StudentDashboard />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={currentRole === 'Funcionário' ? 'dark-content' : 'light-content'}
        backgroundColor={currentRole === 'Funcionário' ? '#FFFFFF' : colors.primary}
      />
      {renderDashboard()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
