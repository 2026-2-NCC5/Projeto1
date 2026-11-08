import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { lightColors, darkColors, typography, spacing, borderRadius } from './index';
import { safeStorage } from '../utils/safeStorage';
import {
  initGlobalFontScaling,
  setGlobalFontScale,
  SCALE_MAP,
  FontScaleLevel,
} from './fontScaler';

export type { FontScaleLevel } from './fontScaler';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextData {
  isDark: boolean;
  themeMode: ThemeMode;
  colors: typeof lightColors;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  fontScale: number;
  fontScaleLevel: FontScaleLevel;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  setFontScaleLevel: (level: FontScaleLevel) => Promise<void>;
}

const THEME_STORAGE_KEY = '@asa_theme_mode';
const FONT_SCALE_STORAGE_KEY = '@asa_font_scale_level_v1';

// Inicializa o patch global de fontes assim que o módulo é importado
initGlobalFontScaling();

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [fontScaleLevel, setFontScaleLevelState] = useState<FontScaleLevel>('normal');

  useEffect(() => {
    async function loadStoredSettings() {
      try {
        const storedTheme = await safeStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme === 'dark' || storedTheme === 'light' || storedTheme === 'system') {
          setThemeModeState(storedTheme);
        }

        const storedFont = await safeStorage.getItem(FONT_SCALE_STORAGE_KEY);
        if (storedFont === 'small' || storedFont === 'normal' || storedFont === 'large' || storedFont === 'extraLarge') {
          setFontScaleLevelState(storedFont);
          setGlobalFontScale(SCALE_MAP[storedFont] || 1.0);
        }
      } catch (e) {
        console.warn('Erro ao carregar preferências de tema/fonte:', e);
      }
    }
    loadStoredSettings();
  }, []);

  const isDark = themeMode === 'dark';
  const activeColors = isDark ? darkColors : lightColors;
  const fontScale = SCALE_MAP[fontScaleLevel] || 1.0;

  const dynamicTypography = useMemo(() => {
    return {
      fontSizes: {
        xs: Math.round(11 * fontScale),
        sm: Math.round(13 * fontScale),
        md: Math.round(15 * fontScale),
        lg: Math.round(18 * fontScale),
        xl: Math.round(22 * fontScale),
        xxl: Math.round(26 * fontScale),
        hero: Math.round(32 * fontScale),
      },
      fontWeights: typography.fontWeights,
    };
  }, [fontScale]);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await safeStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Erro ao salvar tema:', e);
    }
  };

  const toggleTheme = async () => {
    const nextMode: ThemeMode = isDark ? 'light' : 'dark';
    await setThemeMode(nextMode);
  };

  const setFontScaleLevel = async (level: FontScaleLevel) => {
    setFontScaleLevelState(level);
    setGlobalFontScale(SCALE_MAP[level] || 1.0);
    try {
      await safeStorage.setItem(FONT_SCALE_STORAGE_KEY, level);
    } catch (e) {
      console.warn('Erro ao salvar escala de fonte:', e);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        themeMode,
        colors: activeColors,
        typography: dynamicTypography,
        spacing,
        borderRadius,
        fontScale,
        fontScaleLevel,
        setThemeMode,
        toggleTheme,
        setFontScaleLevel,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      isDark: false,
      themeMode: 'light' as ThemeMode,
      colors: lightColors,
      typography,
      spacing,
      borderRadius,
      fontScale: 1.0,
      fontScaleLevel: 'normal' as FontScaleLevel,
      setThemeMode: async () => {},
      toggleTheme: async () => {},
      setFontScaleLevel: async () => {},
    };
  }
  return context;
};
