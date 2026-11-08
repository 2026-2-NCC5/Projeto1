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
import { useTheme } from '../../theme/ThemeContext';
import { CustomButton } from '../../components/common/CustomButton';
import { UserRole } from '../../utils/constants';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { ChevronLeft, GraduationCap, Briefcase } from 'lucide-react-native';

export const RoleSelectionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const { selectedRole, setSelectedRole, updateRole, isAuthenticated } = useAuth();
  const { showToast } = useApp();
  const [currentRole, setCurrentRole] = useState<UserRole>(
    selectedRole === 'Funcionário' ? 'Funcionário' : 'Aluno'
  );
  const [loading, setLoading] = useState(false);

  const handleContinue = () => {
    setSelectedRole(currentRole);
    navigation.navigate('Login', { role: currentRole });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
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
            <Text style={[styles.title, { color: colors.textPrimary }]}>Conte-nos mais sobre você</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Escolha seu perfil de acesso para autenticar e personalizar sua experiência no ASA
            </Text>
          </View>

          {/* Cards Selecionáveis para Aluno e Funcionário */}
          <View style={styles.rolesContainer}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setCurrentRole('Aluno')}
              style={[
                styles.customRoleCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                currentRole === 'Aluno' && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
              ]}
            >
              <View style={[styles.roleIconWrap, { backgroundColor: currentRole === 'Aluno' ? colors.primary : colors.secondaryLight }]}>
                <GraduationCap size={32} color={currentRole === 'Aluno' ? '#FFFFFF' : colors.secondary} />
              </View>
              <View style={styles.roleInfoWrap}>
                <Text style={[styles.roleLabel, { color: colors.textPrimary }]}>Aluno Alvarista</Text>
                <Text style={[styles.roleDesc, { color: colors.textSecondary }]}>
                  Acesso a horários de aulas, salas, requerimentos acadêmicos, emissão de declarações e SISA IA.
                </Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: colors.border },
                  currentRole === 'Aluno' && { borderColor: colors.primary },
                ]}
              >
                {currentRole === 'Aluno' && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setCurrentRole('Funcionário')}
              style={[
                styles.customRoleCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                currentRole === 'Funcionário' && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
              ]}
            >
              <View style={[styles.roleIconWrap, { backgroundColor: currentRole === 'Funcionário' ? colors.primary : colors.secondaryLight }]}>
                <Briefcase size={32} color={currentRole === 'Funcionário' ? '#FFFFFF' : colors.secondary} />
              </View>
              <View style={styles.roleInfoWrap}>
                <Text style={[styles.roleLabel, { color: colors.textPrimary }]}>Funcionário / CAA & Permanência</Text>
                <Text style={[styles.roleDesc, { color: colors.textSecondary }]}>
                  Painel de retenção estudantil, métricas e análise de scores de risco de alunos com IA analítica.
                </Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: colors.border },
                  currentRole === 'Funcionário' && { borderColor: colors.primary },
                ]}
              >
                {currentRole === 'Funcionário' && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Botão Inferior Continuar para o Login */}
        <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <CustomButton
            title="Continuar para o Login"
            onPress={handleContinue}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'flex-start',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  rolesContainer: {
    gap: 16,
  },
  customRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  roleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  roleInfoWrap: {
    flex: 1,
    marginRight: 10,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  roleDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
