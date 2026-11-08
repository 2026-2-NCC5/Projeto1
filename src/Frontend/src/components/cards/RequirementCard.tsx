import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { ChevronRight, MessageSquare } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { borderRadius, typography, spacing } from '../../theme';
import { Requirement } from '../../utils/constants';

interface RequirementCardProps {
  requirement: Requirement;
  onPress: (requirement: Requirement) => void;
}

export const RequirementCard: React.FC<RequirementCardProps> = ({
  requirement,
  onPress,
}) => {
  const { colors, isDark } = useTheme();

  const getBadgeConfig = (status: Requirement['status']) => {
    switch (status) {
      case 'approved':
        return { bg: '#059669', label: 'Deferido' };
      case 'rejected':
        return { bg: '#DC2626', label: 'Indeferido' };
      case 'in_progress':
        return { bg: '#2563EB', label: 'Em Andamento' };
      default:
        return { bg: colors.warningYellow || '#D97706', label: 'Pendente' };
    }
  };

  const badge = getBadgeConfig(requirement.status);
  const commentsCount = requirement.comments?.length || 0;
  const lastComment = commentsCount > 0 ? requirement.comments![commentsCount - 1] : null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(requirement)}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.headerMetaRow}>
          <Text style={[styles.protocolText, { color: colors.primary }]}>
            {requirement.protocol}
          </Text>
          {commentsCount > 0 && (
            <View
              style={[
                styles.commentsBadge,
                { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF' },
              ]}
            >
              <MessageSquare size={11} color="#2563EB" />
              <Text style={styles.commentsBadgeText}>{commentsCount}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>{requirement.title}</Text>

        <View style={styles.stageRow}>
          <Text style={[styles.stageLabel, { color: colors.textSecondary }]}>Etapa atual: </Text>
          <View style={[styles.stageBadge, { backgroundColor: badge.bg }]}>
            <Text style={styles.stageBadgeText}>
              {requirement.currentStage || badge.label}
            </Text>
          </View>
        </View>

        {lastComment && (
          <Text
            style={[styles.lastCommentPreview, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {lastComment.author}: &ldquo;{lastComment.text}&rdquo;
          </Text>
        )}
      </View>
      <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
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
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  protocolText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  commentsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  commentsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    marginBottom: spacing.xs,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  stageLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.regular,
  },
  stageBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  stageBadgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semiBold,
    color: '#FFFFFF',
  },
  lastCommentPreview: {
    fontSize: typography.fontSizes.xs,
    marginTop: 6,
    fontStyle: 'italic',
  },
});
