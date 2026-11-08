import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { X, Award } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { SatisfactionRatingCard } from './SatisfactionRatingCard';
import { FeedbackChannel, StudentFeedbackPayload } from '../../services/supabase/feedbackService';

interface SatisfactionFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  channel?: FeedbackChannel;
  staffName?: string;
  title?: string;
  onSubmitted?: (payload: StudentFeedbackPayload) => void;
}

export const SatisfactionFeedbackModal: React.FC<SatisfactionFeedbackModalProps> = ({
  visible,
  onClose,
  sessionId,
  channel = 'Chat IA (SISA)',
  staffName,
  title = 'Avaliação de Atendimento',
  onSubmitted,
}) => {
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Top Modal Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
                    <Award size={18} color={colors.primary} />
                  </View>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeButton, { backgroundColor: colors.backgroundAlt }]}
                  activeOpacity={0.7}
                >
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Componente Integrado de Avaliação */}
              <SatisfactionRatingCard
                sessionId={sessionId}
                channel={channel}
                staffName={staffName}
                onFeedbackSubmitted={(fb) => {
                  if (onSubmitted) onSubmitted(fb);
                }}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
