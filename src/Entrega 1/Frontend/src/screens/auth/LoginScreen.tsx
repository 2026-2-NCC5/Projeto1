import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, CreditCard, KeyRound, User, Briefcase, RefreshCw } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { CustomInput } from '../../components/common/CustomInput';
import { CustomButton } from '../../components/common/CustomButton';
import { Checkbox } from '../../components/common/Checkbox';
import { SocialAuthButtons } from '../../components/common/SocialAuthButtons';
import { useAuth } from '../../store/AuthContext';
import { UserRole } from '../../utils/constants';
import { ForgotPasswordModal } from './ForgotPasswordModal';

const { width } = Dimensions.get('window');

const ROLE_CONFIGS: Record<UserRole, { identifierLabel: string; placeholder: string; defaultId: string; defaultPass: string; subtitle: string }> = {
  Aluno: {
    identifierLabel: 'Registro de Aluno (RA)',
    placeholder: 'Ex: 24026851',
    defaultId: '24026851',
    defaultPass: 'alvarista2026',
    subtitle: 'Acesse o portal do estudante FECAP com seu RA',
  },
  Pais: {
    identifierLabel: 'CPF ou E-mail do Responsável',
    placeholder: 'Ex: 382.190.442-10',
    defaultId: '382.190.442-10',
    defaultPass: 'pais2026',
    subtitle: 'Acompanhe a vida acadêmica e financeira do seu dependente',
  },
  Professor: {
    identifierLabel: 'Matrícula Docente ou E-mail FECAP',
    placeholder: 'Ex: PROF-1082',
    defaultId: 'PROF-1082',
    defaultPass: 'docente2026',
    subtitle: 'Gestão de turmas, chamadas e avaliações do corpo docente',
  },
  'Funcionário': {
    identifierLabel: 'Chapa Funcional ou E-mail',
    placeholder: 'Ex: FUNC-4421',
    defaultId: 'FUNC-4421',
    defaultPass: 'colab2026',
    subtitle: 'Painel de atendimento, permanência e triagem de requerimentos',
  },
};

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { signIn, isLoading, selectedRole, setSelectedRole } = useAuth();

  const activeRole: UserRole = route.params?.role || selectedRole || 'Aluno';
  const roleConfig = ROLE_CONFIGS[activeRole] || ROLE_CONFIGS.Aluno;

  const [identifier, setIdentifier] = useState(roleConfig.defaultId);
  const [password, setPassword] = useState(roleConfig.defaultPass);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [forgotModalVisible, setForgotModalVisible] = useState(false);

  useEffect(() => {
    setIdentifier(roleConfig.defaultId);
    setPassword(roleConfig.defaultPass);
    setSelectedRole(activeRole);
  }, [activeRole]);

  const handleLogin = async () => {
    if (!identifier.trim()) {
      setErrorMessage(`Por favor, informe seu ${roleConfig.identifierLabel}.`);
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Por favor, informe sua senha.');
      return;
    }

    setErrorMessage('');
    const result = await signIn(identifier, password, activeRole, rememberMe);
    if (result.success) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } else {
      setErrorMessage(result.error || 'Falha ao autenticar.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Botão Voltar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('RoleSelection')}
              style={styles.backButton}
            >
              <ChevronLeft size={24} color={colors.secondary} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Badge do Perfil Selecionado */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('RoleSelection')}
              style={styles.roleBadge}
            >
              <Text style={styles.roleBadgeText}>Perfil: {activeRole}</Text>
              <RefreshCw size={12} color={colors.secondary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          {/* Logo ASA Colorida */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logos/logo_asa_color.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.roleSubtitle}>{roleConfig.subtitle}</Text>
          </View>

          {/* Formulário de Login */}
          <View style={styles.formContainer}>
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Input Identificador contextualizado */}
            <CustomInput
              label={roleConfig.identifierLabel}
              placeholder={roleConfig.placeholder}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              leftIcon={
                activeRole === 'Aluno' || activeRole === 'Funcionário' ? (
                  <CreditCard size={20} color={colors.textMuted} />
                ) : (
                  <User size={20} color={colors.textMuted} />
                )
              }
            />

            {/* Input Senha */}
            <CustomInput
              label="Senha de Acesso"
              placeholder="Sua senha"
              value={password}
              onChangeText={setPassword}
              isPassword
              leftIcon={<KeyRound size={20} color={colors.textMuted} />}
            />

            {/* Linha Lembrar de mim & Esqueci a senha */}
            <View style={styles.optionsRow}>
              <Checkbox
                checked={rememberMe}
                onToggle={setRememberMe}
                label="Lembrar de mim"
              />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setForgotModalVisible(true)}
              >
                <Text style={styles.forgotPasswordText}>Esqueci a senha</Text>
              </TouchableOpacity>
            </View>

            {/* Botão Entrar */}
            <CustomButton
              title={`Entrar como ${activeRole}`}
              onPress={handleLogin}
              loading={isLoading}
              style={styles.loginButton}
            />

            {/* Divisor "Ou continue com" */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Ou continue com</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Botões Sociais */}
            <SocialAuthButtons
              onPressGoogle={() => handleLogin()}
              onPressApple={() => handleLogin()}
              onPressFacebook={() => handleLogin()}
            />

            {/* Link de Cadastro */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Não tem uma conta? </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Register', { role: activeRole })}
              >
                <Text style={styles.registerLink}>Cadastre-se aqui</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Esqueci a Senha */}
      <ForgotPasswordModal
        visible={forgotModalVisible}
        onClose={() => setForgotModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
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
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  roleBadgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.secondary,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  logo: {
    width: width * 0.65,
    height: 95,
    marginBottom: spacing.xs,
  },
  roleSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  formContainer: {
    width: '100%',
  },
  errorBanner: {
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: typography.fontSizes.sm,
    textAlign: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  forgotPasswordText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.secondary,
  },
  loginButton: {
    marginBottom: spacing.xl,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  registerText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  registerLink: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.secondary,
  },
});
