import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { borderRadius, typography, spacing } from '../../theme';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'white' | 'secondary' | 'outline' | 'dashed';
  loading?: boolean;
  disabled?: boolean;
  showArrow?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  showArrow = true,
  style,
  textStyle,
  icon,
}) => {
  const { colors, isDark } = useTheme();

  const getContainerStyle = () => {
    switch (variant) {
      case 'white':
        return [
          styles.whiteContainer,
          {
            backgroundColor: isDark ? colors.card : '#FFFFFF',
            borderColor: isDark ? colors.border : 'transparent',
            borderWidth: isDark ? 1 : 0,
          },
        ];
      case 'secondary':
        return [styles.secondaryContainer, { backgroundColor: colors.secondary }];
      case 'outline':
        return [styles.outlineContainer, { borderColor: colors.primary }];
      case 'dashed':
        return [styles.dashedContainer, { borderColor: colors.borderDashed }];
      case 'primary':
      default:
        return [
          styles.primaryContainer,
          {
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
          },
        ];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'white':
        return [styles.whiteText, { color: isDark ? colors.textPrimary : colors.primary }];
      case 'secondary':
        return [styles.secondaryText, { color: colors.textLight }];
      case 'outline':
        return [styles.outlineText, { color: colors.primary }];
      case 'dashed':
        return [styles.dashedText, { color: colors.textSecondary }];
      case 'primary':
      default:
        return [styles.primaryText, { color: colors.textLight }];
    }
  };

  const getArrowColor = () => {
    switch (variant) {
      case 'white':
        return isDark ? colors.textPrimary : colors.primary;
      case 'secondary':
        return colors.textLight;
      case 'outline':
        return colors.primary;
      case 'dashed':
        return colors.textSecondary;
      case 'primary':
      default:
        return colors.textLight;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.baseContainer,
        getContainerStyle(),
        disabled && styles.disabledContainer,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'white' ? (isDark ? colors.textPrimary : colors.primary) : colors.textLight}
          size="small"
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <Text style={[styles.baseText, getTextStyle(), textStyle]}>{title}</Text>
          {showArrow && (
            <View style={styles.arrowWrapper}>
              <ArrowRight size={20} color={getArrowColor()} strokeWidth={2.5} />
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    height: 56,
    borderRadius: borderRadius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginRight: spacing.sm,
  },
  arrowWrapper: {
    marginLeft: spacing.sm,
  },
  baseText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    textAlign: 'center',
  },
  primaryContainer: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryText: {},
  whiteContainer: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  whiteText: {},
  secondaryContainer: {},
  secondaryText: {},
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  outlineText: {},
  dashedContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: borderRadius.pill,
    height: 52,
  },
  dashedText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
  },
  disabledContainer: {
    opacity: 0.5,
  },
});
