import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, User, CreditCard, Mail, Lock, BookOpen, Briefcase, HeartHandshake } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { CustomInput } from '../../components/common/CustomInput';
import { CustomButton } from '../../components/common/CustomButton';
import { useAuth } from '../../store/AuthContext';
import { UserRole } from '../../utils/constants';
import { isValidEmail, isValidPassword } from '../../utils/validators';

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { signUp, isLoading, selectedRole } = useAuth();

  const activeRole: UserRole = route.params?.role || selectedRole || 'Aluno';

  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [complementaryField, setComplementaryField] = useState(
    activeRole === 'Aluno'
      ? 'Ciência da Computação'
      : activeRole === 'Professor'
      ? 'Departamento de Tecnologia'
      : activeRole === 'Pais'
      ? 'Lucas Alvarista (CCOMP - 5º Sem.)'
      : 'Atendimento e Permanência CAA'
  );
  const [error, setError] = useState('');

  const getRoleLabels = () => {
    switch (activeRole) {
      case 'Pais':
        return {
          idLabel: 'CPF do Responsável',
          idPlaceholder: 'Ex: 382.190.442-10',
          compLabel: 'Nome e RA do Aluno Dependente',
          compPlaceholder: 'Ex: Lucas Alvarista (RA 24026851)',
        };
      case 'Professor':
        return {
          idLabel: 'Matrícula Docente',
          idPlaceholder: 'Ex: PROF-1082',
          compLabel: 'Departamento / Área Acadêmica',
          compPlaceholder: 'Ex: Tecnologia & Computação',
        };
      case 'Funcionário':
        return {
          idLabel: 'Chapa Funcional',
          idPlaceholder: 'Ex: FUNC-4421',
          compLabel: 'Setor de Lotação',
          compPlaceholder: 'Ex: Secretaria Geral / CAA',
        };
      case 'Aluno':
      default:
        return {
          idLabel: 'Registro de Aluno (RA)',
          idPlaceholder: 'Ex: 24026851',
          compLabel: 'Curso de Graduação',
          compPlaceholder: 'Ex: Ciência da Computação',
        };
    }
  };

  const labels = getRoleLabels();

  const handleRegister = async () => {
    if (!name.trim()) {
      setError('Informe seu nome completo.');
      return;
    }
    if (!identifier.trim()) {
      setError(`Informe seu ${labels.idLabel}.`);
      return;
    }
    if (!email.trim() || !isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (!isValidPassword(password)) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setError('');
    try {
      await signUp({
        name,
        ra: identifier,
        email,
        password,
        role: activeRole,
        course: complementaryField,
      });
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (e: any) {
      setError(e.message || 'Falha ao cadastrar conta.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <ChevronLeft size={24} color={colors.secondary} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>{activeRole}</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <Text style={styles.headerTitle}>Criar Conta: {activeRole}</Text>
          <Text style={styles.subtitle}>
            Cadastre seus dados para acessar o ecossistema integrado ASA FECAP.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <CustomInput
            label="Nome Completo"
            placeholder="Ex: Seu Nome Completo"
            value={name}
            onChangeText={setName}
            leftIcon={<User size={20} color={colors.textMuted} />}
          />

          <CustomInput
            label={labels.idLabel}
            placeholder={labels.idPlaceholder}
            value={identifier}
            onChangeText={setIdentifier}
            leftIcon={<CreditCard size={20} color={colors.textMuted} />}
          />

          <CustomInput
            label="E-mail de Acesso"
            placeholder={activeRole === 'Aluno' ? 'aluno@alvarista.fecap.br' : 'seu.email@fecap.br'}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Mail size={20} color={colors.textMuted} />}
          />

          <CustomInput
            label={labels.compLabel}
            placeholder={labels.compPlaceholder}
            value={complementaryField}
            onChangeText={setComplementaryField}
            leftIcon={
              activeRole === 'Pais' ? (
                <HeartHandshake size={20} color={colors.textMuted} />
              ) : activeRole === 'Funcionário' ? (
                <Briefcase size={20} color={colors.textMuted} />
              ) : (
                <BookOpen size={20} color={colors.textMuted} />
              )
            }
          />

          <CustomInput
            label="Senha de Acesso"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChangeText={setPassword}
            isPassword
            leftIcon={<Lock size={20} color={colors.textMuted} />}
          />

          <CustomButton
            title="Concluir Cadastro e Acessar"
            onPress={handleRegister}
            loading={isLoading}
            style={styles.registerButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
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
  },
  roleTag: {
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  roleTagText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.secondary,
  },
  headerTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSizes.sm,
    textAlign: 'center',
  },
  registerButton: {
    marginTop: spacing.lg,
  },
});
