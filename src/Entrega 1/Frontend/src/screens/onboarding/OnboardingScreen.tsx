import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, Sparkles, ShieldCheck, Users, ArrowRight } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { CustomButton } from '../../components/common/CustomButton';

const { width, height } = Dimensions.get('window');

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: any;
  color: string;
  illustration: any;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    badge: 'ECOSSISTEMA ACADÊMICO',
    title: 'Tudo da FECAP no seu bolso',
    subtitle:
      'Acesse grade de horários, salas de aula, requerimentos e comunicados oficiais em uma experiência unificada e moderna.',
    icon: ShieldCheck,
    color: colors.primary,
    illustration: require('../../assets/illustrations/role_aluno.svg'),
  },
  {
    id: '2',
    badge: 'INTELIGÊNCIA ARTIFICIAL SISA',
    title: 'Atendimento instantâneo com IA',
    subtitle:
      'Tire dúvidas em segundos sobre normas acadêmicas, datas limites, ementas e orientações oficiais com nosso agente inteligente.',
    icon: Sparkles,
    color: colors.secondary,
    illustration: require('../../assets/illustrations/ai_orb.svg'),
  },
  {
    id: '3',
    badge: 'EXPERIÊNCIA MULTIPERFIL',
    title: 'Feito para toda a comunidade',
    subtitle:
      'Painéis exclusivos para Alunos, Pais & Família, Professores e Funcionários, apoiando a permanência e o sucesso acadêmico.',
    icon: Users,
    color: colors.primary,
    illustration: require('../../assets/illustrations/role_funcionario.png'),
  },
];

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    navigation.navigate('RoleSelection');
  };

  const renderSlide = ({ item }: { item: Slide }) => {
    const Icon = item.icon;
    return (
      <View style={styles.slide}>
        <View style={styles.imageWrapper}>
          <View style={[styles.glowCircle, { backgroundColor: `${item.color}15` }]} />
          <Image source={item.illustration} style={styles.image} resizeMode="contain" />
        </View>

        <View style={styles.textContainer}>
          <View style={[styles.badge, { backgroundColor: `${item.color}15` }]}>
            <Icon size={14} color={item.color} style={{ marginRight: 6 }} />
            <Text style={[styles.badgeText, { color: item.color }]}>{item.badge}</Text>
          </View>

          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header com Pular */}
      <View style={styles.topBar}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>ASA FECAP</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={handleComplete} style={styles.skipButton}>
          <Text style={styles.skipText}>Pular</Text>
        </TouchableOpacity>
      </View>

      {/* Slides Carrossel */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        keyExtractor={(item) => item.id}
        style={styles.carousel}
      />

      {/* Footer com Indicadores de Página e Botão */}
      <View style={styles.footer}>
        {/* Paginação */}
        <View style={styles.paginationRow}>
          {SLIDES.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                currentIndex === idx ? styles.activeDot : styles.inactiveDot,
              ]}
            />
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
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  logoBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  logoBadgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  skipButton: {
    padding: spacing.xs,
  },
  skipText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textMuted,
  },
  carousel: {
    flex: 1,
  },
  slide: {
    width: width,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  imageWrapper: {
    width: width * 0.75,
    height: height * 0.38,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginTop: spacing.md,
  },
  glowCircle: {
    position: 'absolute',
    width: width * 0.65,
    height: width * 0.65,
    borderRadius: (width * 0.65) / 2,
  },
  image: {
    width: '85%',
    height: '85%',
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    marginBottom: spacing.md,
  },
  badgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    letterSpacing: 0.6,
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
    backgroundColor: '#FFFFFF',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 28,
    backgroundColor: colors.primary,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: colors.border,
  },
  buttonWrapper: {
    width: '100%',
  },
});
