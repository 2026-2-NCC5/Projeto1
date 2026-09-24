import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Sparkles,
  Search,
  Bell,
  BookOpen,
  FileText,
  Award,
  ChevronRight,
  Headphones,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Building2,
  Phone,
} from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../../theme';
import { QUICK_ACTIONS, Requirement, NoticeItem } from '../../../utils/constants';
import { QuickActionCard } from '../../../components/cards/QuickActionCard';
import { RequirementCard } from '../../../components/cards/RequirementCard';
import { BannerCarousel } from '../../../components/cards/BannerCarousel';
import { CustomButton } from '../../../components/common/CustomButton';
import { useAuth } from '../../../store/AuthContext';
import { useApp } from '../../../store/AppContext';
import { RequirementDetailModal } from '../RequirementDetailModal';

const { width } = Dimensions.get('window');

interface ProcedureGuide {
  id: string;
  title: string;
  category: string;
  sector: string;
  source: string;
  lastUpdated: string;
  steps: string[];
  authorizedChannels: string;
}

const PROCEDURES_GUIDE: ProcedureGuide[] = [
  {
    id: 'proc-1',
    title: 'Solicitação do Passe Escolar (SPTrans & EMTU)',
    category: 'Benefícios & Transporte',
    sector: 'Central de Atendimento ao Aluno (CAA)',
    source: 'Manual do Estudante FECAP 2026 - Art. 14',
    lastUpdated: '10/02/2026',
    steps: [
      'Emita a Declaração de Matrícula Ativa oficial na aba Arquivo/Documentos.',
      'O sistema ASA valida automaticamente seus dados com o DNE/SPTrans em até 24h.',
      'Acesse sptrans.com.br/estudante, pague a taxa da emissora e revalide seu cartão.',
    ],
    authorizedChannels: 'Portal do Aluno (portal.fecap.br) • CAA Presencial Bloco A',
  },
  {
    id: 'proc-2',
    title: 'Transferência Interna e Troca de Curso',
    category: 'Secretaria Acadêmica',
    sector: 'Coordenação de Curso & Secretaria Geral',
    source: 'Regulamento de Transferências e Matrículas FECAP',
    lastUpdated: '15/02/2026',
    steps: [
      'Abra o requerimento "Transferência Interna" no menu Requerimentos.',
      'Anexe o histórico escolar atualizado com ementas cursadas.',
      'Aguarde o parecer da coordenação sobre aproveitamento curricular (prazo: 5 dias úteis).',
      'Assine o aditivo de matrícula digitalmente após deferimento.',
    ],
    authorizedChannels: 'Secretaria Geral • E-mail: secretaria@fecap.br',
  },
  {
    id: 'proc-3',
    title: 'Inscrição em Dependência (DP) e Adaptação',
    category: 'Vida Acadêmica',
    sector: 'Coordenação Pedagógica',
    source: 'Normas de Graduação Presencial e Híbrida 2026',
    lastUpdated: '20/01/2026',
    steps: [
      'Consulte a Lista de Ofertas do semestre na aba Arquivo.',
      'Selecione as disciplinas respeitando o limite máximo de 2 DPs por semestre.',
      'Confirme os horários compatíveis no simulador ou pelo SISA.',
    ],
    authorizedChannels: 'Portal do Aluno • Guichê CAA',
  },
];

export const StudentDashboard: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { user } = useAuth();
  const { requirements, notices, showToast } = useApp();

  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedProc, setExpandedProc] = useState<string | null>('proc-1');

  const handleQuickAction = (action: any) => {
    switch (action.iconName) {
      case 'sparkles':
        navigation.navigate('IA');
        break;
      case 'book':
        navigation.navigate('Arquivo');
        break;
      case 'message':
        if (requirements.length > 0) {
          setSelectedReq(requirements[0]);
          setModalVisible(true);
        }
        break;
      case 'award':
        navigation.navigate('Educacional');
        break;
      default:
        break;
    }
  };

  const handleHumanSupport = () => {
    showToast('Transferindo para CAA Humano: WhatsApp (11) 3272-2222', 'info');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Curvado Verde */}
        <View style={[styles.headerContainer, { paddingTop: topPadding + spacing.sm }]}>
          <View style={styles.headerTop}>
            <View style={styles.greetingCol}>
              <Text style={styles.greetingTitle}>Olá, {user?.name || 'Lucas Alvarista'}</Text>
              <Text style={styles.greetingSubtitle}>
                {user?.course || 'Ciência da Computação'} • {user?.semester || '5º Semestre'}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => showToast('Você tem 1 novo requerimento atualizado!', 'info')}
              style={styles.notificationButton}
            >
              <Bell size={22} color="#FFFFFF" />
              <View style={styles.bellBadge} />
            </TouchableOpacity>
          </View>

          {/* Barra de Busca / Prompt IA com Citação Oficial */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('IA', { screen: 'AIChat' })}
            style={styles.searchBar}
          >
            <Sparkles size={20} color="rgba(255, 255, 255, 0.9)" />
            <View style={styles.searchPromptCol}>
              <Text style={styles.searchPromptTitle}>Pergunte a IA Oficial do ASA...</Text>
              <Text style={styles.searchPromptSubtitle}>
                Horários, salas, requerimentos e normas FECAP
              </Text>
            </View>
            <Search size={22} color="rgba(255, 255, 255, 0.9)" />
          </TouchableOpacity>
        </View>

        {/* Corpo Principal */}
        <View style={styles.body}>
          {/* Card de Transferência para Atendimento Humano CAA */}
          <View style={styles.humanSupportCard}>
            <View style={styles.humanSupportIconBox}>
              <Headphones size={24} color={colors.secondary} />
            </View>
            <View style={styles.humanSupportContent}>
              <Text style={styles.humanSupportTitle}>Precisa de Atendimento Humano?</Text>
              <Text style={styles.humanSupportDesc}>
                Fale diretamente com os atendentes da Central de Atendimento ao Aluno (CAA)
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleHumanSupport}
              style={styles.humanSupportBtn}
            >
              <Text style={styles.humanSupportBtnText}>Falar na CAA</Text>
            </TouchableOpacity>
          </View>

          {/* Seção: Ações Rápidas */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Ações Rápidas</Text>
            <View style={styles.quickActionsRow}>
              {QUICK_ACTIONS.map((action) => (
                <QuickActionCard
                  key={action.id}
                  action={action}
                  onPress={handleQuickAction}
                />
              ))}
            </View>
          </View>

          {/* Seção: Requerimentos em andamento */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Meus Requerimentos em Andamento</Text>
            {requirements.slice(0, 1).map((req) => (
              <RequirementCard
                key={req.id}
                requirement={req}
                onPress={(item) => {
                  setSelectedReq(item);
                  setModalVisible(true);
                }}
              />
            ))}
          </View>

          {/* Seção: Guia de Procedimentos & Base de Conhecimento Oficial */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Guia Oficial de Serviços & Procedimentos</Text>
              <View style={styles.officialBadge}>
                <ShieldCheck size={12} color={colors.primaryDark} style={{ marginRight: 3 }} />
                <Text style={styles.officialBadgeText}>Normas 2026</Text>
              </View>
            </View>

            {PROCEDURES_GUIDE.map((proc) => {
              const isExpanded = expandedProc === proc.id;
              return (
                <View key={proc.id} style={styles.procCard}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setExpandedProc(isExpanded ? null : proc.id)}
                    style={styles.procHeader}
                  >
                    <View style={styles.procHeaderLeft}>
                      <View style={styles.procCategoryBadge}>
                        <Text style={styles.procCategoryText}>{proc.category}</Text>
                      </View>
                      <Text style={styles.procTitle}>{proc.title}</Text>
                      <Text style={styles.procSector}>
                        <Building2 size={12} color={colors.textMuted} /> {proc.sector}
                      </Text>
                    </View>
                    <ChevronRight
                      size={20}
                      color={colors.textMuted}
                      style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.procBody}>
                      <Text style={styles.procStepsTitle}>Etapas do Procedimento:</Text>
                      {proc.steps.map((step, idx) => (
                        <View key={idx} style={styles.stepItem}>
                          <View style={styles.stepNumberBadge}>
                            <Text style={styles.stepNumberText}>{idx + 1}</Text>
                          </View>
                          <Text style={styles.stepText}>{step}</Text>
                        </View>
                      ))}

                      {/* Metadados Oficiais e Fonte */}
                      <View style={styles.procMetadataBox}>
                        <Text style={styles.procMetaSource}>📌 {proc.source}</Text>
                        <Text style={styles.procMetaDate}>Atualizado em: {proc.lastUpdated}</Text>
                        <Text style={styles.procMetaChannels}>
                          Canais autorizados: {proc.authorizedChannels}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Seção: Avisos Institucionais */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Avisos & Comunicados</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Materials')}
                activeOpacity={0.7}
              >
                <Text style={styles.verTodosLink}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            <BannerCarousel
              notices={notices}
              onPressBanner={(n) => showToast(`Aviso: ${n.title}`, 'info')}
            />
          </View>
        </View>
      </ScrollView>

      <RequirementDetailModal
        visible={modalVisible}
        requirement={selectedReq}
        onClose={() => setModalVisible(false)}
      />
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greetingCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  greetingTitle: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  greetingSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  searchPromptCol: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  searchPromptTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
  searchPromptSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: typography.fontSizes.xs,
  },
  body: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
  humanSupportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  humanSupportIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  humanSupportContent: {
    flex: 1,
  },
  humanSupportTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.secondary,
    marginBottom: 2,
  },
  humanSupportDesc: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  humanSupportBtn: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.pill,
  },
  humanSupportBtnText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionHeader: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  officialBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.primaryDark,
  },
  verTodosLink: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.primary,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  procCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  procHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  procHeaderLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  procCategoryBadge: {
    backgroundColor: colors.backgroundGray,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    marginBottom: 4,
  },
  procCategoryText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textSecondary,
  },
  procTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  procSector: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
  },
  procBody: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  procStepsTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  stepNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
    color: colors.primaryDark,
  },
  stepText: {
    flex: 1,
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  procMetadataBox: {
    backgroundColor: colors.backgroundAlt,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  procMetaSource: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.primaryDark,
    marginBottom: 2,
  },
  procMetaDate: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  procMetaChannels: {
    fontSize: 10,
    color: colors.textSecondary,
  },
});
