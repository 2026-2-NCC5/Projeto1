import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography, spacing } from '../../theme';

interface CheckboxProps {
  checked: boolean;
  onToggle: (checked: boolean) => void;
  label?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onToggle, label }) => {
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onToggle(!checked)}
      style={styles.container}
    >
      <View
        style={[
          styles.box,
          {
            backgroundColor: checked
              ? colors.primary
              : isDark
              ? colors.card
              : '#FFFFFF',
            borderColor: checked ? colors.primary : colors.border,
          },
        ]}
      >
        {checked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </View>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSizes.sm,
  },
});
