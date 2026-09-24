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
import {
  User,
  LogOut,
  Shield,
  BookOpen,
  Mail,
  CreditCard,
  RefreshCw,
  ChevronRight,
  Briefcase,
  HeartHandshake,
} from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import { ConfirmationModal } from '../../components/feedback/ConfirmationModal';
import { UserRole } from '../../utils/constants';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, selectedRole, signOut } = useAuth();
  const currentRole: UserRole = user?.role || selectedRole || 'Aluno';
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const handleConfirmLogout = async () => {
    setLogoutModalVisible(false);
    await signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  const getRoleFields = () => {
    switch (currentRole) {
      case 'Pais':
        return {
          sectionTitle: 'Dados do Responsável',
          idLabel: 'CPF:',
          compLabel: 'Dependente:',
          compValue: user?.semester || 'Lucas Alvarista (RA 24026851)',
        };
      case 'Professor':
        return {
          sectionTitle: 'Dados do Docente',
          idLabel: 'Matrícula:',
          compLabel: 'Depto:',
          compValue: user?.course || 'Tecnologia & Computação',
        };
      case 'Funcionário':
        return {
          sectionTitle: 'Dados Funcionais',
          idLabel: 'Chapa:',
          compLabel: 'Setor:',
          compValue: user?.course || 'Atendimento & Permanência CAA',
        };
      case 'Aluno':
      default:
        return {
          sectionTitle: 'Dados Acadêmicos',
          idLabel: 'RA:',
          compLabel: 'Curso:',
          compValue: user?.course || 'Ciência da Computação',
        };
    }
  };

  const fields = getRoleFields();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header do Perfil */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <User size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.userName}>{user?.name || 'Lucas Alvarista'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Perfil Ativo: {currentRole}</Text>
          </View>
        </View>

        {/* Informações Cadastrais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{fields.sectionTitle}</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <CreditCard size={18} color={colors.textMuted} />
              <Text style={styles.infoLabel}>{fields.idLabel}</Text>
              <Text style={styles.infoValue}>{user?.ra || '24026851'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Mail size={18} color={colors.textMuted} />
              <Text style={styles.infoLabel}>E-mail:</Text>
              <Text style={styles.infoValue}>{user?.email || 'aluno@fecap.br'}</Text>
            </View>

            <View style={styles.infoRow}>
              <BookOpen size={18} color={colors.textMuted} />
              <Text style={styles.infoLabel}>{fields.compLabel}</Text>
              <Text style={styles.infoValue}>{fields.compValue}</Text>
            </View>
          </View>
        </View>

        {/* Ações de Conta */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferências & Acesso</Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('RoleSelection')}
            style={styles.actionRow}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIconBox, { backgroundColor: colors.secondaryLight }]}>
                <RefreshCw size={20} color={colors.secondary} />
              </View>
              <View>
                <Text style={styles.actionTitle}>Alterar Perfil de Acesso</Text>
                <Text style={styles.actionDesc}>Mudar entre Aluno, Pais, Professor, Funcionário</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setLogoutModalVisible(true)}
            style={[styles.actionRow, styles.logoutRow]}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIconBox, { backgroundColor: colors.errorLight }]}>
                <LogOut size={20} color={colors.error} />
              </View>
              <Text style={styles.logoutTitle}>Sair da Conta</Text>
            </View>
            <ChevronRight size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de Confirmação de Logout */}
      <ConfirmationModal
        visible={logoutModalVisible}
        title="Deseja sair da conta?"
        description="Você retornará à tela de boas-vindas do aplicativo ASA FECAP."
        confirmText="Sair"
        cancelText="Permanecer"
        variant="danger"
        onConfirm={handleConfirmLogout}
        onCancel={() => setLogoutModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  userName: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  roleBadge: {
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  roleBadgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.secondary,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
    width: 90,
  },
  infoValue: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    color: colors.textPrimary,
    fontWeight: typography.fontWeights.medium,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  logoutRow: {
    borderColor: colors.errorLight,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  actionTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  actionDesc: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.error,
  },
});
