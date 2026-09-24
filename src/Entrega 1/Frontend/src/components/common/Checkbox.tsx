import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';

interface CheckboxProps {
  checked: boolean;
  onToggle: (checked: boolean) => void;
  label?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onToggle, label }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onToggle(!checked)}
      style={styles.container}
    >
      <View style={[styles.box, checked && styles.checkedBox]}>
        {checked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </View>
      {label && <Text style={styles.label}>{label}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkedBox: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
});
