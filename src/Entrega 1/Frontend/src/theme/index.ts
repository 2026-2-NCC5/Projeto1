export const colors = {
  primary: '#00B074',
  primaryDark: '#00875A',
  primaryLight: '#E6F8F1',
  primaryMuted: 'rgba(0, 176, 116, 0.15)',
  
  secondary: '#7C3AED',
  secondaryLight: '#F3E8FF',
  secondaryMuted: 'rgba(124, 58, 237, 0.1)',
  
  warning: '#F59E0B',
  warningYellow: '#FBBF24',
  warningLight: '#FEF3C7',
  warningTag: '#F5B700',
  
  background: '#FFFFFF',
  backgroundAlt: '#F9FAFB',
  backgroundGray: '#F3F4F6',
  card: '#FFFFFF',
  
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  textLight: '#FFFFFF',
  
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderActive: '#7C3AED',
  borderDashed: '#6B7280',
  
  error: '#EF4444',
  errorLight: '#FEE2E2',
  success: '#10B981',
  
  socialGoogle: '#EA4335',
  socialApple: '#000000',
  socialFacebook: '#1877F2',
};

export const typography = {
  fontSizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 26,
    hero: 32,
  },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const borderRadius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
};

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
};

export default theme;
