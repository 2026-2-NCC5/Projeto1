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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, CreditCard, KeyRound, RefreshCw, X, Link, CheckCircle2, ShieldAlert, Info } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { CustomInput } from '../../components/common/CustomInput';
import { CustomButton } from '../../components/common/CustomButton';
import { Checkbox } from '../../components/common/Checkbox';
import { SocialAuthButtons } from '../../components/common/SocialAuthButtons';
import { useAuth } from '../../store/AuthContext';
import { UserRole } from '../../utils/constants';
import { ForgotPasswordModal } from './ForgotPasswordModal';

const ROLE_CONFIGS: Record<UserRole, { identifierLabel: string; placeholder: string; subtitle: string }> = {
  Aluno: {
    identifierLabel: 'Registro de Aluno (RA)',
    placeholder: 'Ex: 24026851',
    subtitle: 'Acesse o portal do estudante FECAP com seu RA',
  },
  'Funcionário': {
    identifierLabel: 'Chapa Funcional ou E-mail',
    placeholder: 'Ex: FUNC-4421',
    subtitle: 'Painel de atendimento, permanência e triagem de requerimentos',
  },
};

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const { signIn, signInWithSocial, isLoading, selectedRole, setSelectedRole } = useAuth();

  const activeRole: UserRole = (route.params?.role === 'Funcionário' || selectedRole === 'Funcionário') ? 'Funcionário' : 'Aluno';
  const roleConfig = ROLE_CONFIGS[activeRole] || ROLE_CONFIGS.Aluno;

  const [identifier, setIdentifier] = useState(route.params?.identifier || '');
  const [password, setPassword] = useState(route.params?.password || '');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [forgotModalVisible, setForgotModalVisible] = useState(false);

  // Estado para Modal de Vinculação de Conta Social ao RA
  const [socialNoticeVisible, setSocialNoticeVisible] = useState(false);
  const [socialProviderName, setSocialProviderName] = useState('Google');

  useEffect(() => {
    if (route.params?.identifier) {
      setIdentifier(route.params.identifier);
      setPassword(route.params?.password || '');
    }
    setSelectedRole(activeRole);
  }, [activeRole, route.params?.identifier]);

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
      setErrorMessage(result.error || 'Credenciais inválidas. Verifique seu RA e senha.');
    }
  };

  const handleSocialAuth = async (provider: 'google' | 'apple') => {
    setErrorMessage('');
    const res = await signInWithSocial(provider);
    if (res.success) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } else {
      setSocialProviderName(provider === 'google' ? 'Google' : 'Apple');
      setSocialNoticeVisible(true);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Barra Superior */}
          <View style={styles.topBar}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('RoleSelection')}
              style={[styles.backButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
            >
              <ChevronLeft size={24} color={colors.secondary} strokeWidth={2.5} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('RoleSelection')}
              style={[styles.roleBadge, { backgroundColor: colors.secondaryLight, borderColor: colors.secondaryMuted }]}
            >
              <Text style={[styles.roleBadgeText, { color: colors.secondary }]}>Perfil: {activeRole}</Text>
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
            <Text style={[styles.roleSubtitle, { color: colors.textSecondary }]}>{roleConfig.subtitle}</Text>
          </View>

          {/* Formulário de Login */}
          <View style={styles.formContainer}>
            {errorMessage ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.errorLight }]}>
                <Text style={[styles.errorBannerText, { color: colors.error }]}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Input Identificador */}
            <CustomInput
              label={roleConfig.identifierLabel}
              placeholder={roleConfig.placeholder}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              leftIcon={<CreditCard size={20} color={colors.textMuted} />}
            />

            {/* Input Senha */}
            <CustomInput
              label="Senha de Acesso"
              placeholder="Digite sua senha"
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
                <Text style={[styles.forgotPasswordText, { color: colors.secondary }]}>Esqueci a senha</Text>
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
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textSecondary }]}>Ou continue com</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Botões Sociais (Google e Apple atrelados a RA) */}
            <SocialAuthButtons
              onPressGoogle={() => handleSocialAuth('google')}
              onPressApple={() => handleSocialAuth('apple')}
            />

            {/* Link de Cadastro */}
            <View style={styles.registerRow}>
              <Text style={[styles.registerText, { color: colors.textSecondary }]}>Não tem uma conta? </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Register', { role: activeRole })}
              >
                <Text style={[styles.registerLink, { color: colors.secondary }]}>Cadastre-se aqui</Text>
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

      {/* Modal de Orientação para Conta Social Não Vinculada (T3 & Item 14) */}
      <Modal
        visible={socialNoticeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSocialNoticeVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.linkModalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.linkIconBox, { backgroundColor: colors.primaryLight }]}>
                <ShieldAlert size={24} color={colors.primary} />
              </View>
              <TouchableOpacity onPress={() => setSocialNoticeVisible(false)} style={styles.closeModalBtn}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Conta Institucional Não Vinculada
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Por diretrizes de segurança institucional, o login com {socialProviderName} só é permitido para contas previamente integradas pela Secretaria CAA.

Para acessar o aplicativo, entre diretamente com suas credenciais institucionais ou crie sua conta de estudante com seu RA.
            </Text>

            <CustomButton
              title="Cadastrar com RA de Aluno"
              onPress={() => {
                setSocialNoticeVisible(false);
                navigation.navigate('Register', { role: 'Aluno' });
              }}
              style={{ marginTop: 20 }}
            />

            <TouchableOpacity
              onPress={() => setSocialNoticeVisible(false)}
              style={{ marginTop: 12, paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                Voltar para o Login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  logo: {
    width: 170,
    height: 60,
  },
  roleSubtitle: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  errorBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '500',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  registerText: {
    fontSize: 14,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  linkModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  linkIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtn: {
    padding: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
});
