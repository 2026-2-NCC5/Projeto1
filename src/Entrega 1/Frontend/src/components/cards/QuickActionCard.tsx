import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Sparkles, BookOpen, MessageSquare, Award } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';
import { QuickAction } from '../../utils/constants';

interface QuickActionCardProps {
  action: QuickAction;
  onPress: (action: QuickAction) => void;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({ action, onPress }) => {
  const renderIcon = () => {
    const iconColor = colors.secondary;
    const iconSize = 26;

    switch (action.iconName) {
      case 'sparkles':
        return <Sparkles size={iconSize} color={iconColor} strokeWidth={1.75} />;
      case 'book':
        return <BookOpen size={iconSize} color={iconColor} strokeWidth={1.75} />;
      case 'message':
        return <MessageSquare size={iconSize} color={iconColor} strokeWidth={1.75} />;
      case 'award':
        return <Award size={iconSize} color={iconColor} strokeWidth={1.75} />;
      default:
        return <Sparkles size={iconSize} color={iconColor} strokeWidth={1.75} />;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(action)}
      style={styles.card}
    >
      <View style={styles.iconContainer}>
        {renderIcon()}
        {action.hasNotification && <View style={styles.notificationDot} />}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {action.label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    width: 76,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warningYellow,
  },
  label: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
