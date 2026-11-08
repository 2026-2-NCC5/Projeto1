import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Sparkles, ShieldCheck, Users } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, typography, borderRadius } from '../../theme';
import { CustomButton } from '../../components/common/CustomButton';
import { FadeInView } from '../../components/common/AnimatedComponents';

// Ilustrações Vetoriais SVG nativas e dinâmicas (100% nítidas e adaptadas ao modo claro/escuro)
import {
  StudentIllustration,
  AIIllustration,
  PermanenceIllustration,
} from '../../components/illustrations/OnboardingIllustrations';

const { width } = Dimensions.get('window');

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: any;
  color: string;
  Illustration: React.FC<{ width?: number; height?: number; isDark?: boolean }>;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    badge: 'ECOSSISTEMA ACADÊMICO FECAP',
    title: 'Tudo da FECAP no seu bolso',
    subtitle:
      'Acesse grade de horários, salas de aula, todos os 82 requerimentos oficiais e comunicados em uma experiência unificada e moderna.',
    icon: ShieldCheck,
    color: '#00B074',
    Illustration: StudentIllustration,
  },
  {
    id: '2',
    badge: 'INTELIGÊNCIA ARTIFICIAL SISA',
    title: 'Atendimento instantâneo com IA',
    subtitle:
      'Tire dúvidas em segundos sobre normas acadêmicas, datas limites, ementas e orientações oficiais com nosso agente inteligente.',
    icon: Sparkles,
    color: '#7C3AED',
    Illustration: AIIllustration,
  },
  {
    id: '3',
    badge: 'CENTRAL CAA & MULTIPERFIL',
    title: 'Apoio à Permanência Estudantil',
    subtitle:
      'Painéis dedicados para Alunos e Funcionários, fila presencial de atendimento no campus e integração total com o ecossistema alvarista.',
    icon: Users,
    color: '#0284C7',
    Illustration: PermanenceIllustration,
  },
];

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Rastreamento de gestos de deslize (swipe)
  const touchStartX = useRef<number>(0);

  const handleTouchStart = (e: GestureResponderEvent) => {
    touchStartX.current = e.nativeEvent.pageX;
  };

  const handleTouchEnd = (e: GestureResponderEvent) => {
    const touchEndX = e.nativeEvent.pageX;
    const diff = touchStartX.current - touchEndX;

    // Deslize para a esquerda -> próximo slide
    if (diff > 45) {
      handleNext();
    }
    // Deslize para a direita -> slide anterior
    else if (diff < -45 && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    navigation.navigate('RoleSelection');
  };

  const currentSlide = SLIDES[currentIndex];
  const Icon = currentSlide.icon;
  const SlideIllustration = currentSlide.Illustration;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Top Header com Logo e Botão Pular */}
      <View style={styles.topBar}>
        <View style={[styles.logoBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.logoBadgeText, { color: colors.primaryDark }]}>ASA FECAP</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={handleComplete} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: colors.textMuted }]}>Pular</Text>
        </TouchableOpacity>
      </View>

      {/* Área Central Interativa com Renderização Direta do Slide Atual e Suporte a Swipe */}
      <View
        style={styles.carouselContainer}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <FadeInView key={`slide-${currentSlide.id}`} duration={260} style={styles.slide}>
          {/* Ilustração Vetorial SVG Central */}
          <View style={styles.imageWrapper}>
            <View
              style={[
                styles.glowCircle,
                { backgroundColor: `${currentSlide.color}14` },
              ]}
            />
            <SlideIllustration
              width={Math.min(width * 0.85, 320)}
              height={230}
              isDark={isDark}
            />
          </View>

          {/* Textos e Badges do Slide */}
          <View style={styles.textContainer}>
            <View style={[styles.badge, { backgroundColor: `${currentSlide.color}18` }]}>
              <Icon size={14} color={currentSlide.color} style={{ marginRight: 6 }} />
              <Text style={[styles.badgeText, { color: currentSlide.color }]}>
                {currentSlide.badge}
              </Text>
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {currentSlide.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {currentSlide.subtitle}
            </Text>
          </View>
        </FadeInView>
      </View>

      {/* Footer com Indicadores Clicáveis e Botão Continuar */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        {/* Paginação Interativa (permite clicar diretamente no ponto desejado) */}
        <View style={styles.paginationRow}>
          {SLIDES.map((item, idx) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => setCurrentIndex(idx)}
              style={styles.dotTouchTarget}
            >
              <View
                style={[
                  styles.dot,
                  currentIndex === idx
                    ? [styles.activeDot, { backgroundColor: colors.primary }]
                    : [styles.inactiveDot, { backgroundColor: colors.border }],
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Botão de Avançar */}
        <View style={styles.buttonWrapper}>
          <CustomButton
            title={currentIndex === SLIDES.length - 1 ? 'Selecionar Meu Perfil' : 'Continuar'}
            onPress={handleNext}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  logoBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  logoBadgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    letterSpacing: 0.5,
  },
  skipButton: {
    padding: spacing.xs,
  },
  skipText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    width: '100%',
    paddingHorizontal: spacing.xxl,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  imageWrapper: {
    width: '100%',
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: spacing.sm,
  },
  glowCircle: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    marginBottom: spacing.md,
  },
  badgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 24,
    fontWeight: typography.fontWeights.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xs,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: 8,
  },
  dotTouchTarget: {
    padding: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 28,
  },
  inactiveDot: {
    width: 8,
  },
  buttonWrapper: {
    width: '100%',
  },
});
