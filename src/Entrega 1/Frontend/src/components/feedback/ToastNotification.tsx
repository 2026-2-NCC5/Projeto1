import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';
import { useApp } from '../../store/AppContext';

export const ToastNotification: React.FC = () => {
  const { activeToast, hideToast } = useApp();

  if (!activeToast) return null;

  const getBackgroundColor = () => {
    switch (activeToast.type) {
      case 'error':
        return colors.error;
      case 'info':
        return colors.secondary;
      case 'success':
      default:
        return colors.primary;
    }
  };

  const renderIcon = () => {
    switch (activeToast.type) {
      case 'error':
        return <AlertCircle size={20} color="#FFFFFF" />;
      case 'info':
        return <Info size={20} color="#FFFFFF" />;
      case 'success':
      default:
        return <CheckCircle size={20} color="#FFFFFF" />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      <View style={styles.iconWrapper}>{renderIcon()}</View>
      <Text style={styles.message}>{activeToast.message}</Text>
      <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
        <X size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  iconWrapper: {
    marginRight: spacing.sm,
  },
  message: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
  },
  closeButton: {
    padding: spacing.xs,
  },
});
