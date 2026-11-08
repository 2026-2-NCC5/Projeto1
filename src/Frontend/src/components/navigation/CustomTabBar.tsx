import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Home,
  BookOpen,
  Sparkles,
  GraduationCap,
  User,
  Headphones,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../store/AuthContext';

export const CustomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, typography, isDark } = useTheme();
  const { selectedRole, user } = useAuth();
  const currentRole = user?.role || selectedRole || 'Aluno';

  // Garante margem de segurança contra a barra de navegação virtual do sistema (Android e iOS)
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12);
  const totalBarHeight = (Platform.OS === 'ios' ? 62 : 56) + bottomInset;

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
        const isStaff = currentRole === 'Funcionário';
        return {
          label: isStaff ? 'Central CAA' : 'Educacional',
          icon: isStaff ? (
            <Headphones size={size} color={isFocused ? activeColor : inactiveColor} strokeWidth={1.75} />
          ) : (
            <GraduationCap size={size} color={isFocused ? activeColor : inactiveColor} strokeWidth={1.75} />
          ),
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
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: isDark ? colors.card : '#FFFFFF',
          borderTopColor: colors.border,
          height: totalBarHeight,
          paddingBottom: bottomInset,
        },
      ]}
    >
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
                style={[styles.centerButton, { backgroundColor: colors.primary }]}
              >
                {tabInfo.icon}
              </TouchableOpacity>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? colors.primary : colors.textMuted },
                  isFocused && styles.activeTabLabel,
                ]}
              >
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
            <Text
              style={[
                styles.tabLabel,
                { color: isFocused ? colors.primary : colors.textMuted },
                isFocused && styles.activeTabLabel,
              ]}
            >
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
    borderTopWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 3,
  },
  activeTabLabel: {
    fontWeight: '700',
  },
});
