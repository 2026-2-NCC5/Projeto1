import { Text, TextInput, StyleSheet } from 'react-native';

export type FontScaleLevel = 'small' | 'normal' | 'large' | 'extraLarge';

export const SCALE_MAP: Record<FontScaleLevel, number> = {
  small: 0.9,
  normal: 1.0,
  large: 1.15,
  extraLarge: 1.3,
};

let currentGlobalFontScale = 1.0;
let isPatched = false;

export function getGlobalFontScale(): number {
  return currentGlobalFontScale;
}

export function setGlobalFontScale(scale: number): void {
  currentGlobalFontScale = scale;
}

/**
 * Aplica escalonamento dinâmico global a todos os componentes <Text> e <TextInput> do React Native,
 * garantindo que a preferência de tamanho de fonte funcione no aplicativo inteiro de forma imediata e segura.
 */
export function initGlobalFontScaling(initialScale: number = 1.0): void {
  currentGlobalFontScale = initialScale;
  if (isPatched) return;
  isPatched = true;

  try {
    // 1. Patch seguro no componente Text
    const originalTextRender = (Text as any).render;
    if (typeof originalTextRender === 'function') {
      (Text as any).render = function (props: any, ref: any) {
        if (!props || !props.style) {
          return originalTextRender.call(this, props, ref);
        }
        const scale = getGlobalFontScale();
        if (scale === 1.0) {
          return originalTextRender.call(this, props, ref);
        }

        try {
          const flatStyle = StyleSheet.flatten(props.style);
          if (!flatStyle || typeof flatStyle !== 'object' || typeof flatStyle.fontSize !== 'number') {
            return originalTextRender.call(this, props, ref);
          }

          const scaledStyle: any = {
            ...flatStyle,
            fontSize: Math.round(flatStyle.fontSize * scale),
          };
          if (typeof flatStyle.lineHeight === 'number') {
            scaledStyle.lineHeight = Math.round(flatStyle.lineHeight * scale);
          }

          return originalTextRender.call(this, { ...props, style: scaledStyle }, ref);
        } catch {
          return originalTextRender.call(this, props, ref);
        }
      };
    }

    // 2. Patch seguro no componente TextInput
    const originalTextInputRender = (TextInput as any).render;
    if (typeof originalTextInputRender === 'function') {
      (TextInput as any).render = function (props: any, ref: any) {
        if (!props || !props.style) {
          return originalTextInputRender.call(this, props, ref);
        }
        const scale = getGlobalFontScale();
        if (scale === 1.0) {
          return originalTextInputRender.call(this, props, ref);
        }

        try {
          const flatStyle = StyleSheet.flatten(props.style);
          if (!flatStyle || typeof flatStyle !== 'object' || typeof flatStyle.fontSize !== 'number') {
            return originalTextInputRender.call(this, props, ref);
          }

          const scaledStyle: any = {
            ...flatStyle,
            fontSize: Math.round(flatStyle.fontSize * scale),
          };
          if (typeof flatStyle.lineHeight === 'number') {
            scaledStyle.lineHeight = Math.round(flatStyle.lineHeight * scale);
          }

          return originalTextInputRender.call(this, { ...props, style: scaledStyle }, ref);
        } catch {
          return originalTextInputRender.call(this, props, ref);
        }
      };
    }
  } catch (err) {
    console.warn('[FontScaler] Falha ao inicializar patch de fontes:', err);
  }
}
