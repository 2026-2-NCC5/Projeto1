import React from 'react';
import {
  TouchableOpacity,
  Text,
  Image,
  StyleSheet,
  View,
  ImageSourcePropType,
} from 'react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';
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
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onSelect(role)}
      style={[
        styles.card,
        selected && styles.selectedCard,
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={imageSource}
          style={styles.illustration}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '48%',
    aspectRatio: 0.95,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: spacing.lg,
  },
  selectedCard: {
    borderColor: colors.borderActive,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
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
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  selectedLabel: {
    color: colors.textPrimary,
  },
});
