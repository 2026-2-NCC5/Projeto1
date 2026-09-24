import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Mail, CheckCircle2 } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';
import { CustomInput } from '../../components/common/CustomInput';
import { CustomButton } from '../../components/common/CustomButton';
import { useAuth } from '../../store/AuthContext';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  visible,
  onClose,
}) => {
  const { resetPassword } = useAuth();
  const [emailOrRa, setEmailOrRa] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleSubmit = async () => {
    if (!emailOrRa.trim()) {
      setFeedback('Informe seu e-mail institucional ou RA');
      return;
    }

    setLoading(true);
    setFeedback('');
    try {
      const res = await resetPassword(emailOrRa);
      setSuccess(true);
      setFeedback(res.message);
    } catch (e: any) {
      setFeedback(e.message || 'Erro ao processar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setEmailOrRa('');
    setSuccess(false);
    setFeedback('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Recuperar Senha</Text>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {success ? (
            <View style={styles.successContainer}>
              <CheckCircle2 size={48} color={colors.primary} />
              <Text style={styles.successTitle}>Instruções Enviadas!</Text>
              <Text style={styles.successMessage}>{feedback}</Text>
              <CustomButton
                title="Voltar ao Login"
                onPress={handleDismiss}
                style={styles.doneButton}
              />
            </View>
          ) : (
            <View style={styles.body}>
              <Text style={styles.instruction}>
                Digite seu e-mail institucional FECAP ou RA para receber o link de redefinição de senha.
              </Text>

              <CustomInput
                placeholder="exemplo@alvarista.fecap.br ou RA"
                value={emailOrRa}
                onChangeText={setEmailOrRa}
                autoCapitalize="none"
                leftIcon={<Mail size={20} color={colors.textMuted} />}
                error={feedback && !success ? feedback : undefined}
              />

              <CustomButton
                title="Enviar Link de Acesso"
                onPress={handleSubmit}
                loading={loading}
                style={styles.submitButton}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.xxl,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xxl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  body: {
    width: '100%',
  },
  instruction: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  successTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  successMessage: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  doneButton: {
    width: '100%',
  },
});
