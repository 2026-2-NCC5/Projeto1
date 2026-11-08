import React from 'react';
import {
  TouchableOpacity,
  Text,
  Image,
  StyleSheet,
  View,
  ImageSourcePropType,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { borderRadius, typography, spacing } from '../../theme';
import { UserRole } from '../../utils/constants';

interface RoleCardProps {
  role: UserRole;
  label: string;
  imageSource: ImageSourcePropType;
  selected: boolean;
  onSelect: (role: UserRole) => void;
}

export const RoleCard: React.FC<RoleCardProps> = ({
  role,
  label,
  imageSource,
  selected,
  onSelect,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onSelect(role)}
      style={[
        styles.card,
        {
          backgroundColor: selected
            ? (isDark ? 'rgba(0,135,90,0.2)' : colors.primaryLight)
            : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={imageSource}
          style={styles.illustration}
          resizeMode="contain"
        />
      </View>
      <Text
        style={[
          styles.label,
          { color: selected ? colors.primary : colors.textPrimary },
          selected && { fontWeight: typography.fontWeights.bold },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '48%',
    aspectRatio: 0.95,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: spacing.lg,
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustration: {
    width: '90%',
    height: '90%',
  },
  label: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    textAlign: 'center',
  },
});
