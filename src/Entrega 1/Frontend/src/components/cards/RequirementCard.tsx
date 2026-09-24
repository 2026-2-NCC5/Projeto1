import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';
import { Requirement } from '../../utils/constants';

interface RequirementCardProps {
  requirement: Requirement;
  onPress: (requirement: Requirement) => void;
}

export const RequirementCard: React.FC<RequirementCardProps> = ({
  requirement,
  onPress,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(requirement)}
      style={styles.card}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{requirement.title}</Text>
        <View style={styles.stageRow}>
          <Text style={styles.stageLabel}>Etapa atual: </Text>
          <View style={styles.stageBadge}>
            <Text style={styles.stageBadgeText}>{requirement.currentStage}</Text>
          </View>
        </View>
      </View>
      <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  content: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  stageLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.regular,
  },
  stageBadge: {
    backgroundColor: colors.warningYellow,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  stageBadgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semiBold,
    color: '#FFFFFF',
  },
});
