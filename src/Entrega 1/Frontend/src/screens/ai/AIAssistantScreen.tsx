import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Sparkles, MessageSquarePlus } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';

import { groqClient } from '../../services/ai-agent/groqClient';

const { width } = Dimensions.get('window');

const SUGGESTIONS = groqClient.getSugestoes().slice(0, 4);

export const AIAssistantScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const handleStartChat = (initialPrompt?: string) => {
    navigation.navigate('AIChat', { initialPrompt });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        {/* Orbe Central com Animação Pulsante */}
        <View style={styles.orbSection}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleStartChat()}
            style={styles.orbTouchable}
          >
            <Animated.View
              style={[
                styles.orbGlowWrapper,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Image
                source={require('../../assets/illustrations/ai_orb.svg')}
                style={styles.orbImage}
                resizeMode="contain"
              />
            </Animated.View>
          </TouchableOpacity>

          {/* Título Oficial da Tela */}
          <Text style={styles.title}>Como posso te{'\n'}ajudar hoje?</Text>
        </View>

        {/* Sugestões Rápidas de Prompt */}
        <View style={styles.suggestionsSection}>
          <Text style={styles.suggestionsLabel}>Sugestões rápidas:</Text>
          <View style={styles.chipsContainer}>
            {SUGGESTIONS.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                onPress={() => handleStartChat(item)}
                style={styles.chip}
              >
                <Sparkles size={14} color={colors.secondary} style={{ marginRight: 6 }} />
                <Text style={styles.chipText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Botão de Iniciar Chat */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleStartChat()}
            style={styles.chatButton}
          >
            <MessageSquarePlus size={20} color="#FFFFFF" style={{ marginRight: spacing.sm }} />
            <Text style={styles.chatButtonText}>Abrir Chat Conversacional</Text>
          </TouchableOpacity>
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
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  orbSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  orbGlowWrapper: {
    width: width * 0.72,
    height: width * 0.72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: typography.fontSizes.hero,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 38,
  },
  suggestionsSection: {
    width: '100%',
    paddingBottom: spacing.lg,
  },
  suggestionsLabel: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  chipText: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    fontWeight: typography.fontWeights.semiBold,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: borderRadius.pill,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
  },
});
