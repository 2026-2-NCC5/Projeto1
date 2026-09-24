import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CheckCircle2, Clock, AlertCircle, FileText, ChevronRight } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';
import { Requirement } from '../../utils/constants';

interface RequirementDetailModalProps {
  visible: boolean;
  requirement: Requirement | null;
  onClose: () => void;
}

export const RequirementDetailModal: React.FC<RequirementDetailModalProps> = ({
  visible,
  requirement,
  onClose,
}) => {
  if (!requirement) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.protocolText}>{requirement.protocol}</Text>
            <Text style={styles.titleText}>{requirement.title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Status Badge */}
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Status da Solicitação</Text>
            <View style={styles.badgeContainer}>
              <Text style={styles.stageTag}>{requirement.currentStage}</Text>
              <Text style={styles.dateText}>Última atualização: {requirement.updatedAt}</Text>
            </View>
          </View>

          {/* Descrição */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Descrição do Pedido</Text>
            <Text style={styles.descriptionText}>{requirement.description}</Text>
          </View>

          {/* Timeline de Etapas */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Linha do Tempo do Processo</Text>
            <View style={styles.timeline}>
              {requirement.steps.map((step, index) => {
                const isLast = index === requirement.steps.length - 1;
                return (
                  <View key={index} style={styles.stepItem}>
                    <View style={styles.indicatorCol}>
                      {step.completed ? (
                        <View style={[styles.dot, styles.dotCompleted]}>
                          <CheckCircle2 size={16} color="#FFFFFF" />
                        </View>
                      ) : step.active ? (
                        <View style={[styles.dot, styles.dotActive]}>
                          <Clock size={16} color="#FFFFFF" />
                        </View>
                      ) : (
                        <View style={[styles.dot, styles.dotPending]} />
                      )}
                      {!isLast && (
                        <View
                          style={[
                            styles.line,
                            step.completed ? styles.lineCompleted : styles.linePending,
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={[styles.stepTitle, step.active && styles.stepTitleActive]}>
                        {step.title}
                      </Text>
                      <Text style={styles.stepDesc}>{step.description}</Text>
                      {step.date && <Text style={styles.stepDate}>{step.date}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  protocolText: {
    fontSize: typography.fontSizes.xs,
    color: colors.primary,
    fontWeight: typography.fontWeights.bold,
  },
  titleText: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    padding: spacing.xxl,
  },
  statusSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundAlt,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stageTag: {
    backgroundColor: colors.warningYellow,
    color: '#FFFFFF',
    fontWeight: typography.fontWeights.bold,
    fontSize: typography.fontSizes.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  dateText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  descriptionText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  timeline: {
    marginTop: spacing.sm,
  },
  stepItem: {
    flexDirection: 'row',
    minHeight: 65,
  },
  indicatorCol: {
    alignItems: 'center',
    width: 28,
    marginRight: spacing.md,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotCompleted: {
    backgroundColor: colors.primary,
  },
  dotActive: {
    backgroundColor: colors.warningYellow,
  },
  dotPending: {
    backgroundColor: colors.border,
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  lineCompleted: {
    backgroundColor: colors.primary,
  },
  linePending: {
    backgroundColor: colors.border,
  },
  stepContent: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  stepTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textPrimary,
  },
  stepTitleActive: {
    color: colors.warning,
  },
  stepDesc: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stepDate: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
});
