import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  HeartHandshake,
  DollarSign,
  GraduationCap,
  Calendar,
  AlertCircle,
  Copy,
  FileText,
  Phone,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  MessageCircle,
} from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../../theme';
import { useAuth } from '../../../store/AuthContext';
import { useApp } from '../../../store/AppContext';

const { width } = Dimensions.get('window');

export const ParentDashboard: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { user } = useAuth();
  const { showToast } = useApp();

  const handleCopyPix = () => {
    showToast('Código Pix Copia e Cola copiado com sucesso!', 'success');
  };

  const handleDownloadBoleto = () => {
    showToast('Boleto bancário em PDF baixado no seu dispositivo!', 'info');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header dos Pais */}
        <View style={[styles.headerContainer, { paddingTop: topPadding + spacing.md }]}>
          <View style={styles.badge}>
            <HeartHandshake size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.badgeText}>PORTAL DA FAMÍLIA ALVARISTA</Text>
          </View>
          <Text style={styles.headerTitle}>Olá, {user?.name || 'Roberto Alvarista'}</Text>
          <Text style={styles.headerSubtitle}>
            Acompanhe o desempenho acadêmico e a situação financeira do seu dependente
          </Text>

          {/* Card do Estudante Vinculado */}
          <View style={styles.dependentCard}>
            <View style={styles.dependentAvatar}>
              <GraduationCap size={24} color={colors.primaryDark} />
            </View>
            <View style={styles.dependentInfo}>
              <Text style={styles.dependentLabel}>Estudante Vinculado:</Text>
              <Text style={styles.dependentName}>Lucas Alvarista</Text>
              <Text style={styles.dependentDetails}>
                RA: 24026851 • Ciência da Computação (5º Semestre)
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Seção Financeira: Mensalidade Vigente */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Situação Financeira & Mensalidades</Text>
            <View style={styles.invoiceCard}>
              <View style={styles.invoiceHeader}>
                <View>
                  <Text style={styles.invoicePeriod}>Mensalidade: Setembro/2026</Text>
                  <Text style={styles.invoiceDueDate}>Vencimento: 10/09/2026</Text>
                </View>
                <View style={styles.statusBadgePending}>
                  <Clock size={12} color="#D97706" style={{ marginRight: 4 }} />
                  <Text style={styles.statusBadgePendingText}>A Vencer</Text>
                </View>
              </View>

              <View style={styles.invoiceValueRow}>
                <Text style={styles.currencySymbol}>R$</Text>
                <Text style={styles.invoiceValue}>1.840,00</Text>
                <Text style={styles.discountBadge}>Desconto pontualidade aplicado</Text>
              </View>

              <View style={styles.invoiceActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleCopyPix}
                  style={styles.pixButton}
                >
                  <Copy size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.pixButtonText}>Pagar via Pix</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleDownloadBoleto}
                  style={styles.boletoButton}
                >
                  <FileText size={16} color={colors.primaryDark} style={{ marginRight: 6 }} />
                  <Text style={styles.boletoButtonText}>2ª Via Boleto</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Seção: Desempenho e Frequência do Filho */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Desempenho Acadêmico do Dependente</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <CheckCircle2 size={22} color={colors.primary} />
                <Text style={styles.statValue}>94%</Text>
                <Text style={styles.statLabel}>Frequência Geral</Text>
                <Text style={styles.statSub}>Sem risco de falta</Text>
              </View>

              <View style={styles.statCard}>
                <GraduationCap size={22} color={colors.secondary} />
                <Text style={styles.statValue}>8.9</Text>
                <Text style={styles.statLabel}>Média Semestral</Text>
                <Text style={styles.statSub}>Rendimento Ótimo</Text>
              </View>
            </View>

            {/* Alerta Institucional para Pais */}
            <View style={styles.academicAlertBox}>
              <AlertCircle size={18} color="#2563EB" />
              <View style={{ flex: 1 }}>
                <Text style={styles.academicAlertTitle}>Período de Provas Regimentais (P1)</Text>
                <Text style={styles.academicAlertText}>
                  As avaliações do 5º semestre ocorrem entre 22 e 26 de Setembro. O calendário
                  detalhado está disponível no portal.
                </Text>
              </View>
            </View>
          </View>

          {/* Seção: Atendimento e Suporte à Família */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Canais de Atendimento aos Pais</Text>
            
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => showToast('Iniciando contato com Atendimento aos Pais...', 'info')}
              style={styles.channelRow}
            >
              <View style={[styles.channelIconBox, { backgroundColor: colors.primaryLight }]}>
                <MessageCircle size={20} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.channelTitle}>WhatsApp Oficial da Família</Text>
                <Text style={styles.channelDesc}>Atendimento rápido de Segunda a Sexta, 8h às 19h</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => showToast('Agendamento de reunião solicitado!', 'info')}
              style={styles.channelRow}
            >
              <View style={[styles.channelIconBox, { backgroundColor: colors.secondaryLight }]}>
                <Calendar size={20} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.channelTitle}>Agendar Reunião com Coordenação</Text>
                <Text style={styles.channelDesc}>Converse com o Prof. Coordenador do Curso</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  headerContainer: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  dependentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dependentAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  dependentInfo: {
    flex: 1,
  },
  dependentLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.fontWeights.medium,
  },
  dependentName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  dependentDetails: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  body: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  invoicePeriod: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  invoiceDueDate: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  statusBadgePendingText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: '#D97706',
  },
  invoiceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  currencySymbol: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  invoiceValue: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  discountBadge: {
    fontSize: 10,
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    fontWeight: typography.fontWeights.semiBold,
  },
  invoiceActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pixButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
  },
  pixButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  boletoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(0, 176, 116, 0.3)',
  },
  boletoButtonText: {
    color: colors.primaryDark,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statValue: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  statSub: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: typography.fontWeights.semiBold,
    marginTop: 2,
  },
  academicAlertBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  academicAlertTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: '#1E40AF',
    marginBottom: 2,
  },
  academicAlertText: {
    fontSize: 11,
    color: '#1E3A8A',
    lineHeight: 16,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  channelIconBox: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  channelDesc: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
