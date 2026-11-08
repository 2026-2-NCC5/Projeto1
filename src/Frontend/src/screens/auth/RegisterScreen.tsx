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
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ChevronLeft,
  User,
  CreditCard,
  Mail,
  Lock,
  BookOpen,
  Briefcase,
  CheckCircle2,
  KeyRound,
  RefreshCw,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { CustomInput } from '../../components/common/CustomInput';
import { CustomButton } from '../../components/common/CustomButton';
import { useAuth } from '../../store/AuthContext';
import { UserRole } from '../../utils/constants';
import { isValidEmail, isValidPassword } from '../../utils/validators';

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const { signUp, verifyEmailOtp, resendConfirmationEmail, isLoading, selectedRole } = useAuth();

  const activeRole: UserRole =
    route.params?.role === 'Funcionário' || selectedRole === 'Funcionário'
      ? 'Funcionário'
      : 'Aluno';

  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [complementaryField, setComplementaryField] = useState(
    activeRole === 'Aluno' ? 'Ciência da Computação' : 'Atendimento e Permanência CAA'
  );
  const [error, setError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Estados de confirmação por código OTP e Reenvio
  const [otpToken, setOtpToken] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');

  const getRoleLabels = () => {
    if (activeRole === 'Funcionário') {
      return {
        idLabel: 'Chapa Funcional',
        idPlaceholder: 'Ex: FUNC-4421',
        compLabel: 'Setor de Lotação',
        compPlaceholder: 'Ex: Secretaria Geral / CAA',
      };
    }
    return {
      idLabel: 'Registro de Aluno (RA)',
      idPlaceholder: 'Ex: 24026851',
      compLabel: 'Curso de Graduação',
      compPlaceholder: 'Ex: Ciência da Computação',
    };
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
      const res = await signUp({
        name,
        ra: identifier,
        email,
        password,
        role: activeRole,
        course: complementaryField,
      });

      if (res.error) {
        setError(res.error);
        return;
      }

      if (res.needsEmailConfirmation) {
        setRegisteredEmail(email.trim());
        setRegistrationSuccess(true);
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }
    } catch (e: any) {
      setError(e.message || 'Falha ao cadastrar conta.');
    }
  };

  const handleVerifyOtp = async () => {
    const cleanToken = otpToken.trim();
    if (!cleanToken || cleanToken.length < 6) {
      setOtpError('Informe o código de 6 dígitos recebido por e-mail.');
      return;
    }
    setOtpError('');
    setVerifyingOtp(true);
    try {
      const res = await verifyEmailOtp(registeredEmail, cleanToken, password);
      if (res.error) {
        setOtpError(res.error);
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }
    } catch (e: any) {
      setOtpError(e.message || 'Erro ao validar código.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendSuccess('');
    setOtpError('');
    try {
      const res = await resendConfirmationEmail(registeredEmail);
      if (res.error) {
        setOtpError(res.error);
      } else {
        setResendSuccess('Novo link e código de confirmação enviados para seu e-mail!');
      }
    } catch (e: any) {
      setOtpError(e.message || 'Erro ao reenviar e-mail.');
    } finally {
      setResending(false);
    }
  };

  if (registrationSuccess) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ScrollView contentContainerStyle={styles.successScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.successContainer}>
            <View style={[styles.successIconWrapper, { backgroundColor: '#D1FAE5' }]}>
              <CheckCircle2 size={52} color="#059669" />
            </View>

            <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
              Confirmação de Cadastro
            </Text>

            <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
              Enviamos um link e um código de validação para o e-mail:
            </Text>

            <View style={[styles.emailBadge, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
              <Mail size={16} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.emailBadgeText, { color: colors.textPrimary }]}>
                {registeredEmail}
              </Text>
            </View>

            {otpError ? (
              <View style={[styles.errorBox, { backgroundColor: colors.errorLight, width: '100%' }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{otpError}</Text>
              </View>
            ) : null}

            {resendSuccess ? (
              <View style={[styles.successNoticeBox, { backgroundColor: '#D1FAE5', width: '100%' }]}>
                <Text style={{ color: '#059669', fontSize: 12, textAlign: 'center', fontWeight: '600' }}>
                  {resendSuccess}
                </Text>
              </View>
            ) : null}

            {/* Inserção de Token OTP de 6 Dígitos */}
            <View style={[styles.otpCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <KeyRound size={16} color={colors.primary} />
                <Text style={[styles.otpCardTitle, { color: colors.textPrimary }]}>
                  Validar Código de 6 Dígitos (OTP)
                </Text>
              </View>
              <Text style={[styles.otpCardDesc, { color: colors.textSecondary }]}>
                Caso o link direto tenha expirado ou sido bloqueado pelo antivírus, digite abaixo o código de 6 dígitos contido no e-mail recebido:
              </Text>

              <TextInput
                style={[
                  styles.otpInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="Ex: 849201"
                placeholderTextColor={colors.textMuted}
                value={otpToken}
                onChangeText={setOtpToken}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <CustomButton
                title={verifyingOtp ? 'Validando...' : 'Confirmar Código e Acessar'}
                onPress={handleVerifyOtp}
                loading={verifyingOtp}
                style={{ marginTop: 10 }}
              />
            </View>

            {/* Reenvio de E-mail */}
            <View style={styles.resendActionsRow}>
              <TouchableOpacity
                onPress={handleResend}
                disabled={resending}
                activeOpacity={0.7}
                style={[styles.resendBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                {resending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <RefreshCw size={13} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.resendBtnText, { color: colors.primary }]}>
                      Reenviar e-mail de confirmação
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Login', { role: activeRole })}
              style={[styles.loginRedirectBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.loginRedirectText, { color: colors.textSecondary }]}>
                Já confirmou pelo link no e-mail? <Text style={{ color: colors.primary, fontWeight: '700' }}>Fazer Login</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
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
              style={[styles.backButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
            >
              <ChevronLeft size={24} color={colors.secondary} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={[styles.roleTag, { backgroundColor: colors.secondaryLight }]}>
              <Text style={[styles.roleTagText, { color: colors.secondary }]}>{activeRole}</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Criar Conta: {activeRole}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Cadastre seus dados para acessar o ecossistema integrado ASA FECAP.
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
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
            leftIcon={activeRole === 'Funcionário' ? <Briefcase size={20} color={colors.textMuted} /> : <BookOpen size={20} color={colors.textMuted} />}
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
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  roleTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  successNoticeBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  registerButton: {
    marginTop: 16,
  },
  successScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  successContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  successIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  emailBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  otpCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  otpCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  otpCardDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  otpInput: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
    marginBottom: 8,
  },
  resendActionsRow: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  resendBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loginRedirectBtn: {
    paddingVertical: 8,
  },
  loginRedirectText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
