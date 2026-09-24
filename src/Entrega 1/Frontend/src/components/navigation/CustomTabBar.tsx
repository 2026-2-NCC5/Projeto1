import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Home,
  BookOpen,
  Sparkles,
  GraduationCap,
  User,
} from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';

export const CustomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { selectedRole, user } = useAuth();
  const currentRole = user?.role || selectedRole || 'Aluno';

  const getTabInfo = (routeName: string, isFocused: boolean) => {
    const activeColor = colors.primary;
    const inactiveColor = colors.textMuted;
    const size = 24;

    switch (routeName) {
      case 'Home':
        return {
          label: 'Home',
          icon: <Home size={size} color={isFocused ? activeColor : inactiveColor} strokeWidth={1.75} />,
        };
      case 'Arquivo':
        return {
          label: 'Arquivo',
          icon: <BookOpen size={size} color={isFocused ? activeColor : inactiveColor} strokeWidth={1.75} />,
        };
      case 'IA':
        return {
          label: 'IA SISA',
          icon: <Sparkles size={28} color="#FFFFFF" strokeWidth={2} />,
          isCenter: true,
        };
      case 'Educacional': {
        const roleLabel =
          currentRole === 'Professor'
            ? 'Aulas'
            : currentRole === 'Funcionário'
            ? 'Gestão'
            : currentRole === 'Pais'
            ? 'Boletim'
            : 'Educacional';
        return {
          label: roleLabel,
          icon: <GraduationCap size={size} color={isFocused ? activeColor : inactiveColor} strokeWidth={1.75} />,
        };
      }
      case 'Perfil':
        return {
          label: 'Perfil',
          icon: <User size={size} color={isFocused ? activeColor : inactiveColor} strokeWidth={1.75} />,
        };
      default:
        return {
          label: routeName,
          icon: <Home size={size} color={isFocused ? activeColor : inactiveColor} />,
        };
    }
  };

  return (
    <View style={styles.tabBarContainer}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const tabInfo = getTabInfo(route.name, isFocused);

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (tabInfo.isCenter) {
          return (
            <View key={route.key} style={styles.centerTabWrapper}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onPress}
                style={styles.centerButton}
              >
                {tabInfo.icon}
              </TouchableOpacity>
              <Text style={[styles.tabLabel, isFocused && styles.activeTabLabel]}>
                {tabInfo.label}
              </Text>
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={(options as any).tabBarTestID}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            {tabInfo.icon}
            <Text style={[styles.tabLabel, isFocused && styles.activeTabLabel]}>
              {tabInfo.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    height: Platform.OS === 'ios' ? 88 : 72,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -12,
  },
  centerButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    fontWeight: typography.fontWeights.medium,
    marginTop: 3,
  },
  activeTabLabel: {
    color: colors.primary,
    fontWeight: typography.fontWeights.bold,
  },
});
