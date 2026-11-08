import React, { createContext, useContext, useState, useEffect } from 'react';
import { safeStorage } from '../utils/safeStorage';

export interface ThemeColors {
  mode: 'light' | 'dark';
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryMuted: string;
  secondary: string;
  secondaryLight: string;
  secondaryMuted: string;
  warning: string;
  warningYellow: string;
  warningLight: string;
  warningTag: string;
  background: string;
  backgroundAlt: string;
  backgroundGray: string;
  card: string;
  cardSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textLight: string;
  border: string;
  borderLight: string;
  borderActive: string;
  borderDashed: string;
  error: string;
  errorLight: string;
  success: string;
  socialGoogle: string;
  socialApple: string;
  socialFacebook: string;
  userBubble: string;
  userBubbleText: string;
  assistantBubble: string;
  assistantBubbleText: string;
  chatCodeBg: string;
  chatQuoteBg: string;
  chatQuoteBorder: string;
}

export const lightColors: ThemeColors = {
  mode: 'light',
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
  cardSecondary: '#F8FAFC',
  
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

  // Chat bubbles
  userBubble: '#00B074',
  userBubbleText: '#FFFFFF',
  assistantBubble: '#F3F4F6',
  assistantBubbleText: '#111827',
  chatCodeBg: '#E2E8F0',
  chatQuoteBg: '#EEF2F6',
  chatQuoteBorder: '#00B074',
};

export const darkColors: ThemeColors = {
  mode: 'dark',
  primary: '#00C988',
  primaryDark: '#00A36C',
  primaryLight: 'rgba(0, 201, 136, 0.15)',
  primaryMuted: 'rgba(0, 201, 136, 0.2)',
  
  secondary: '#8B5CF6',
  secondaryLight: 'rgba(139, 92, 246, 0.18)',
  secondaryMuted: 'rgba(139, 92, 246, 0.15)',
  
  warning: '#FBBF24',
  warningYellow: '#F59E0B',
  warningLight: 'rgba(251, 191, 36, 0.15)',
  warningTag: '#FBBF24',
  
  background: '#0F172A',
  backgroundAlt: '#1E293B',
  backgroundGray: '#1E293B',
  card: '#1E293B',
  cardSecondary: '#0F172A',
  
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textLight: '#FFFFFF',
  
  border: '#334155',
  borderLight: '#1E293B',
  borderActive: '#8B5CF6',
  borderDashed: '#475569',
  
  error: '#F87171',
  errorLight: 'rgba(239, 68, 68, 0.15)',
  success: '#34D399',
  
  socialGoogle: '#EA4335',
  socialApple: '#FFFFFF',
  socialFacebook: '#3B82F6',

  // Chat bubbles
  userBubble: '#00B074',
  userBubbleText: '#FFFFFF',
  assistantBubble: '#1E293B',
  assistantBubbleText: '#F8FAFC',
  chatCodeBg: '#0F172A',
  chatQuoteBg: 'rgba(0, 201, 136, 0.08)',
  chatQuoteBorder: '#00C988',
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

export const colors = lightColors;

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
};

export default theme;
