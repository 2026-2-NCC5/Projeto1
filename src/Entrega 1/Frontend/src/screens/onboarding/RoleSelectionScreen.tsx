import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing } from '../../theme';
import { RoleCard } from '../../components/cards/RoleCard';
import { CustomButton } from '../../components/common/CustomButton';
import { UserRole } from '../../utils/constants';
import { useAuth } from '../../store/AuthContext';
import { ChevronLeft } from 'lucide-react-native';

export const RoleSelectionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { selectedRole, updateRole, setSelectedRole, isAuthenticated } = useAuth();
  const [currentRole, setCurrentRole] = useState<UserRole>(selectedRole || 'Aluno');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    try {
      if (isAuthenticated) {
        await updateRole(currentRole);
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      } else {
        setSelectedRole(currentRole);
        navigation.navigate('Login', { role: currentRole });
      }
    } catch (e) {
      console.warn('Erro ao atualizar papel:', e);
      if (isAuthenticated) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      } else {
        navigation.navigate('Login', { role: currentRole });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ChevronLeft size={24} color={colors.secondary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Conte-nos mais sobre você</Text>
            <Text style={styles.subtitle}>
              Escolha seu perfil de acesso para personalizar sua experiência no ASA
            </Text>
          </View>

          {/* Grid 2x2 de Perfis */}
          <View style={styles.grid}>
            <RoleCard
              role="Aluno"
              label="Aluno"
              imageSource={require('../../assets/illustrations/role_aluno.svg')}
              selected={currentRole === 'Aluno'}
              onSelect={setCurrentRole}
            />
            <RoleCard
              role="Pais"
              label="Pais"
              imageSource={require('../../assets/illustrations/role_pais.svg')}
              selected={currentRole === 'Pais'}
              onSelect={setCurrentRole}
            />
            <RoleCard
              role="Professor"
              label="Professor"
              imageSource={require('../../assets/illustrations/role_professor.svg')}
              selected={currentRole === 'Professor'}
              onSelect={setCurrentRole}
            />
            <RoleCard
              role="Funcionário"
              label="Funcionário"
              imageSource={require('../../assets/illustrations/role_funcionario.svg')}
              selected={currentRole === 'Funcionário'}
              onSelect={setCurrentRole}
            />
          </View>
        </ScrollView>

        {/* Botão Inferior Continuar */}
        <View style={styles.bottomBar}>
          <CustomButton
            title="Continuar"
            onPress={handleContinue}
            loading={loading}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    alignItems: 'flex-start',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  bottomBar: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: '#FFFFFF',
  },
});
