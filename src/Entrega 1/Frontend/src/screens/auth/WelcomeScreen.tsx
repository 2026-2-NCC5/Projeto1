import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing } from '../../theme';
import { CustomButton } from '../../components/common/CustomButton';

const { width } = Dimensions.get('window');

export const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Círculos translúcidos de fundo */}
      <View style={[styles.circleWatermark, styles.circleTopRight]} />
      <View style={[styles.circleWatermark, styles.circleBottomLeft]} />
      <View style={[styles.circleWatermark, styles.circleCenterLeft]} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.contentContainer}>
          {/* Logo Central */}
          <View style={styles.logoSection}>
            <Image
              source={require('../../assets/logos/logo_asa.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Seção Inferior: Botão e Créditos */}
          <View style={styles.bottomSection}>
            <CustomButton
              title="Começar"
              variant="white"
              onPress={() => navigation.navigate('Onboarding')}
              style={styles.startButton}
            />

            <Text style={styles.footerText}>
              Desenvolvido pelos alunos do 5º semestre de CComp
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    position: 'relative',
  },
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    width: width * 0.75,
    height: 140,
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  startButton: {
    marginBottom: spacing.xl,
  },
  footerText: {
    fontSize: typography.fontSizes.xs,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    fontWeight: typography.fontWeights.medium,
  },
  circleWatermark: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  circleTopRight: {
    width: 320,
    height: 320,
    top: -60,
    right: -80,
  },
  circleBottomLeft: {
    width: 400,
    height: 400,
    bottom: 80,
    left: -120,
  },
  circleCenterLeft: {
    width: 250,
    height: 250,
    top: '30%',
    left: -80,
  },
});
