import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  GraduationCap,
  Users,
  MapPin,
  Search,
  Filter,
  ShieldAlert,
  ChevronRight,
  UserCheck,
  Send,
  Calendar,
  Sparkles,
} from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../../theme';
import { useAuth } from '../../../store/AuthContext';
import { useApp } from '../../../store/AppContext';

const { width } = Dimensions.get('window');

type RiskCategory = 'Vermelho' | 'Amarelo' | 'Verde';

interface DimensionDetail {
  score: number;
  status: string;
  detail: string;
}

interface StudentRiskProfile {
  id: string;
  name: string;
  ra: string;
  course: string;
  semester: string;
  category: RiskCategory;
  overallRiskScore: number;
  temporalTrend: 'Piorando' | 'Estavel' | 'Melhorando';
  trendVariation: string;
  historyScores: { month: string; score: number }[];
  dimensions: {
    financeira: DimensionDetail;
    academica: DimensionDetail;
    relacionamento: DimensionDetail;
    geografica: DimensionDetail;
  };
  explanation: string;
  recommendation: string;
}

const MOCK_RISK_STUDENTS: StudentRiskProfile[] = [
  {
    id: 'risk-01',
    name: 'Gabriel Martins Ribeiro',
    ra: '24018932',
    course: 'Ciência da Computação',
    semester: '3º Semestre',
    category: 'Vermelho',
    overallRiskScore: 88,
    temporalTrend: 'Piorando',
    trendVariation: '+24% nos últimos 30 dias',
    historyScores: [
      { month: 'Jun', score: 48 },
      { month: 'Jul', score: 64 },
      { month: 'Ago', score: 88 },
    ],
    dimensions: {
      financeira: {
        score: 90,
        status: 'Crítico',
        detail: '2 mensalidades em atraso, perda do desconto de pontualidade e solicitação de prorrogação negada.',
      },
      academica: {
        score: 85,
        status: 'Crítico',
        detail: 'CR caiu de 7.4 para 4.2. Acúmulo de 3 DPs e risco iminente de reprovação por falta (32% de ausências).',
      },
      relacionamento: {
        score: 82,
        status: 'Alto',
        detail: 'Redução de 75% no acesso ao AVA/Portal do Aluno, ausência em 2 reuniões de tutoria e cancelamento de mentoria.',
      },
      geografica: {
        score: 74,
        status: 'Moderado',
        detail: 'Residência a 34 km do campus Liberdade (Guaianases - ZL), tempo médio de trânsito superior a 2h20min.',
      },
    },
    explanation:
      'A sobreposição de inadimplência financeira recente com aumento severo de faltas decorrente do longo deslocamento diário gerou isolamento acadêmico e probabilidade de 88% de trancamento voluntário nas próximas 3 semanas se não houver intervenção.',
    recommendation:
      'Acolhimento urgente com a Assistência Estudantil para plano de parcelamento especial sem juros, flexibilização para disciplinas híbridas e indicação para Bolsa Permanência Alvarista.',
  },
  {
    id: 'risk-02',
    name: 'Beatriz Vasconcelos',
    ra: '23091140',
    course: 'Administração de Empresas',
    semester: '5º Semestre',
    category: 'Vermelho',
    overallRiskScore: 82,
    temporalTrend: 'Piorando',
    trendVariation: '+18% nos últimos 45 dias',
    historyScores: [
      { month: 'Jun', score: 55 },
      { month: 'Jul', score: 71 },
      { month: 'Ago', score: 82 },
    ],
    dimensions: {
      financeira: {
        score: 84,
        status: 'Crítico',
        detail: 'Inadimplência de 1 mensalidade corrente e cancelamento de estágio não-remunerado.',
      },
      academica: {
        score: 79,
        status: 'Alto',
        detail: 'Queda de rendimento nas matérias quantitativas (Finanças e Estatística), com notas de P1 abaixo de 4.0.',
      },
      relacionamento: {
        score: 76,
        status: 'Alto',
        detail: 'Não participa de grupos de estudos e protocolou 2 solicitações de esclarecimento sobre cancelamento.',
      },
      geografica: {
        score: 65,
        status: 'Médio',
        detail: 'Reside a 18 km do campus (Osasco), afetada por alterações recentes na linha de trens/metrô.',
      },
    },
    explanation:
      'A perda de renda familiar recente desestabilizou o pagamento e causou desmotivação e ansiedade pedagógica, com abertura de consulta sobre cancelamento no portal.',
    recommendation:
      'Encaminhamento imediato ao Núcleo de Apoio Psicopedagógico (NAP) e inclusão no Banco de Talentos FECAP Carreiras para recolocação em estágio remunerado.',
  },
  {
    id: 'risk-03',
    name: 'Matheus Henrique Silveira',
    ra: '24033219',
    course: 'Ciências Contábeis',
    semester: '2º Semestre',
    category: 'Amarelo',
    overallRiskScore: 58,
    temporalTrend: 'Estavel',
    trendVariation: '±2% (oscilação estável)',
    historyScores: [
      { month: 'Jun', score: 56 },
      { month: 'Jul', score: 59 },
      { month: 'Ago', score: 58 },
    ],
    dimensions: {
      financeira: {
        score: 35,
        status: 'Controlado',
        detail: 'Mensalidades em dia através do crédito estudantil.',
      },
      academica: {
        score: 68,
        status: 'Atenção',
        detail: 'Dificuldade de adaptação curricular em Contabilidade Geral (CR 5.8), porém sem excesso de faltas.',
      },
      relacionamento: {
        score: 62,
        status: 'Atenção',
        detail: 'Baixo engajamento nas atividades extracurriculares e horas de Atividades Complementares zeradas.',
      },
      geografica: {
        score: 40,
        status: 'Baixo',
        detail: 'Reside a 8 km do campus (Bela Vista), fácil acesso.',
      },
    },
    explanation:
      'Risco moderado predominantemente pedagógico decorrente da transição de ciclo básico para específico sem rede de mentores de apoio.',
    recommendation:
      'Inscrição prioritária no Programa de Nivelamento em Contabilidade e vinculação a um monitor sênior do 7º semestre.',
  },
  {
    id: 'risk-04',
    name: 'Carolina Mendes de Oliveira',
    ra: '22045618',
    course: 'Economia',
    semester: '6º Semestre',
    category: 'Verde',
    overallRiskScore: 22,
    temporalTrend: 'Melhorando',
    trendVariation: '-15% nos últimos 60 dias',
    historyScores: [
      { month: 'Jun', score: 38 },
      { month: 'Jul', score: 29 },
      { month: 'Ago', score: 22 },
    ],
    dimensions: {
      financeira: {
        score: 15,
        status: 'Excelente',
        detail: 'Mensalidades pontuais e beneficiária de bolsa mérito acadêmico.',
      },
      academica: {
        score: 20,
        status: 'Excelente',
        detail: 'CR 8.9, 96% de presença e participação em projeto de Iniciação Científica.',
      },
      relacionamento: {
        score: 25,
        status: 'Excelente',
        detail: 'Líder de turma ativa e membro da Empresa Júnior.',
      },
      geografica: {
        score: 28,
        status: 'Baixo',
        detail: 'Reside a 6 km do campus, transporte direto.',
      },
    },
    explanation:
      'Estudante com alto engajamento institucional e índice de permanência consolidado.',
    recommendation:
      'Convidar para atuar como tutora voluntária no programa de mentoria preventiva de calouros.',
  },
];

export const StaffDashboard: React.FC = () => {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { user } = useAuth();
  const { showToast } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<'Todos' | RiskCategory>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>('risk-01');

  const filteredStudents = MOCK_RISK_STUDENTS.filter((st) => {
    const matchesCategory = selectedCategory === 'Todos' || st.category === selectedCategory;
    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.ra.includes(searchQuery) ||
      st.course.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const countVermelho = MOCK_RISK_STUDENTS.filter((s) => s.category === 'Vermelho').length;
  const countAmarelo = MOCK_RISK_STUDENTS.filter((s) => s.category === 'Amarelo').length;
  const countVerde = MOCK_RISK_STUDENTS.filter((s) => s.category === 'Verde').length;

  const handleActionSupport = (studentName: string, actionType: string) => {
    showToast(`Ação registrada para ${studentName}: "${actionType}"`, 'success');
  };

  const getCategoryTheme = (category: RiskCategory) => {
    switch (category) {
      case 'Vermelho':
        return {
          color: '#DC2626',
          bgColor: '#FEE2E2',
          borderColor: 'rgba(220, 38, 38, 0.3)',
          label: 'Risco Crítico',
        };
      case 'Amarelo':
        return {
          color: '#D97706',
          bgColor: '#FEF3C7',
          borderColor: 'rgba(217, 119, 6, 0.3)',
          label: 'Atenção / Moderado',
        };
      case 'Verde':
        return {
          color: '#059669',
          bgColor: '#D1FAE5',
          borderColor: 'rgba(5, 150, 105, 0.3)',
          label: 'Estável / Baixo Risco',
        };
    }
  };

  const renderTrendIcon = (trend: 'Piorando' | 'Estavel' | 'Melhorando') => {
    switch (trend) {
      case 'Piorando':
        return <TrendingUp size={16} color="#DC2626" />;
      case 'Melhorando':
        return <TrendingDown size={16} color="#059669" />;
      case 'Estavel':
        return <Minus size={16} color="#D97706" />;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header do Funcionário */}
        <View style={[styles.headerContainer, { paddingTop: topPadding + spacing.sm }]}>
          <View style={styles.headerBadge}>
            <Sparkles size={12} color={colors.primaryDark} style={{ marginRight: 4 }} />
            <Text style={styles.headerBadgeText}>
              NÚCLEO DE PERMANÊNCIA & RETENÇÃO ESTUDANTIL FECAP
            </Text>
          </View>
          <Text style={styles.headerTitle}>Painel de Ações Preventivas</Text>
          <Text style={styles.headerSubtitle}>
            Prevenção proativa de evasão com monitoramento multidimensional em tempo real
          </Text>

          {/* Cards de Métricas Semafóricas */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { borderLeftColor: '#DC2626' }]}>
              <Text style={styles.metricNumber}>{countVermelho}</Text>
              <Text style={styles.metricLabel}>Crítico (Vermelho)</Text>
              <Text style={styles.metricSub}>Ação Imediata</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#D97706' }]}>
              <Text style={styles.metricNumber}>{countAmarelo}</Text>
              <Text style={styles.metricLabel}>Atenção (Amarelo)</Text>
              <Text style={styles.metricSub}>Monitoramento</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#059669' }]}>
              <Text style={styles.metricNumber}>{countVerde}</Text>
              <Text style={styles.metricLabel}>Estável (Verde)</Text>
              <Text style={styles.metricSub}>Baixo Risco</Text>
            </View>
          </View>
        </View>

        {/* Filtros e Busca */}
        <View style={styles.filtersSection}>
          <View style={styles.searchBox}>
            <Search size={18} color={colors.textMuted} />
            <TextInput
              placeholder="Buscar aluno por nome, RA ou curso..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Chips de Categoria Semafórica */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {(['Todos', 'Vermelho', 'Amarelo', 'Verde'] as const).map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  activeOpacity={0.7}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.filterChip,
                    isSelected && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextActive,
                    ]}
                  >
                    {cat === 'Todos' ? 'Todos os Alunos' : `Categoria ${cat}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Lista de Alunos em Risco */}
        <View style={styles.studentsList}>
          <Text style={styles.listSectionTitle}>
            Estudantes em Acompanhamento ({filteredStudents.length})
          </Text>

          {filteredStudents.map((st) => {
            const isExpanded = expandedStudentId === st.id;
            const theme = getCategoryTheme(st.category);

            return (
              <View key={st.id} style={[styles.studentCard, { borderColor: theme.borderColor }]}>
                {/* Cabeçalho do Card */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setExpandedStudentId(isExpanded ? null : st.id)}
                  style={styles.cardHeader}
                >
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.studentNameRow}>
                      <Text style={styles.studentName}>{st.name}</Text>
                      <View style={[styles.categoryBadge, { backgroundColor: theme.bgColor }]}>
                        <View style={[styles.categoryDot, { backgroundColor: theme.color }]} />
                        <Text style={[styles.categoryText, { color: theme.color }]}>
                          {theme.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.studentMeta}>
                      RA: {st.ra} • {st.course} ({st.semester})
                    </Text>
                  </View>

                  <View style={styles.riskScoreCol}>
                    <Text style={[styles.scoreValue, { color: theme.color }]}>
                      {st.overallRiskScore}
                    </Text>
                    <Text style={styles.scoreUnit}>Score / 100</Text>
                  </View>
                </TouchableOpacity>

                {/* Resumo da Tendência */}
                <View style={styles.trendRow}>
                  <View style={styles.trendItem}>
                    {renderTrendIcon(st.temporalTrend)}
                    <Text style={styles.trendText}>
                      Tendência: <Text style={{ fontWeight: 'bold' }}>{st.temporalTrend}</Text> ({st.trendVariation})
                    </Text>
                  </View>
                  <ChevronRight
                    size={18}
                    color={colors.textMuted}
                    style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                  />
                </View>

                {/* Detalhamento Multidimensional Completo */}
                {isExpanded && (
                  <View style={styles.cardExpandedContent}>
                    {/* Grade das 4 Dimensões */}
                    <Text style={styles.subheading}>Scores por Dimensão Analisada:</Text>
                    <View style={styles.dimensionsGrid}>
                      {/* 1. Financeira */}
                      <View style={styles.dimensionBox}>
                        <View style={styles.dimHeader}>
                          <DollarSign size={16} color="#DC2626" />
                          <Text style={styles.dimTitle}>Financeira</Text>
                          <Text style={styles.dimScoreBadge}>{st.dimensions.financeira.score}/100</Text>
                        </View>
                        <Text style={styles.dimDetailText}>{st.dimensions.financeira.detail}</Text>
                      </View>

                      {/* 2. Acadêmica */}
                      <View style={styles.dimensionBox}>
                        <View style={styles.dimHeader}>
                          <GraduationCap size={16} color="#D97706" />
                          <Text style={styles.dimTitle}>Acadêmica</Text>
                          <Text style={styles.dimScoreBadge}>{st.dimensions.academica.score}/100</Text>
                        </View>
                        <Text style={styles.dimDetailText}>{st.dimensions.academica.detail}</Text>
                      </View>

                      {/* 3. Relacionamento */}
                      <View style={styles.dimensionBox}>
                        <View style={styles.dimHeader}>
                          <Users size={16} color={colors.secondary} />
                          <Text style={styles.dimTitle}>Relacionamento</Text>
                          <Text style={styles.dimScoreBadge}>
                            {st.dimensions.relacionamento.score}/100
                          </Text>
                        </View>
                        <Text style={styles.dimDetailText}>
                          {st.dimensions.relacionamento.detail}
                        </Text>
                      </View>

                      {/* 4. Geográfica */}
                      <View style={styles.dimensionBox}>
                        <View style={styles.dimHeader}>
                          <MapPin size={16} color={colors.primaryDark} />
                          <Text style={styles.dimTitle}>Geográfica</Text>
                          <Text style={styles.dimScoreBadge}>{st.dimensions.geografica.score}/100</Text>
                        </View>
                        <Text style={styles.dimDetailText}>{st.dimensions.geografica.detail}</Text>
                      </View>
                    </View>

                    {/* Histórico Temporal dos Últimos Meses */}
                    <View style={styles.historyBox}>
                      <Text style={styles.historyTitle}>Evolução do Histórico Temporal:</Text>
                      <View style={styles.historyTimeline}>
                        {st.historyScores.map((h, i) => (
                          <View key={i} style={styles.historyPoint}>
                            <Text style={styles.historyMonth}>{h.month}</Text>
                            <View
                              style={[
                                styles.historyScoreCircle,
                                {
                                  backgroundColor:
                                    h.score >= 70 ? '#FEE2E2' : h.score >= 40 ? '#FEF3C7' : '#D1FAE5',
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: 'bold',
                                  color: h.score >= 70 ? '#DC2626' : h.score >= 40 ? '#D97706' : '#059669',
                                }}
                              >
                                {h.score}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Explicação Analítica da Situação */}
                    <View style={styles.explanationBox}>
                      <Text style={styles.explanationTitle}>🔍 Explicação Analítica do Risco:</Text>
                      <Text style={styles.explanationText}>{st.explanation}</Text>
                    </View>

                    {/* Recomendação de Apoio à Permanência */}
                    <View style={styles.recommendationBox}>
                      <Text style={styles.recommendationTitle}>
                        💡 Recomendação de Apoio (Ação Preventiva):
                      </Text>
                      <Text style={styles.recommendationText}>{st.recommendation}</Text>
                    </View>

                    {/* Botões de Ação Imediata do Funcionário */}
                    <View style={styles.actionsBtnRow}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => handleActionSupport(st.name, 'Acolhimento CAA Agendado')}
                        style={styles.primaryActionBtn}
                      >
                        <UserCheck size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.primaryActionBtnText}>Registrar Acolhimento</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleActionSupport(st.name, 'Plano de Permanência Acionado')}
                        style={styles.secondaryActionBtn}
                      >
                        <Send size={16} color={colors.primaryDark} style={{ marginRight: 6 }} />
                        <Text style={styles.secondaryActionBtnText}>Plano Permanência</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  metricNumber: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metricSub: {
    fontSize: 9,
    color: colors.textMuted,
  },
  filtersSection: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.fontSizes.xs,
    color: colors.textPrimary,
  },
  chipsRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeights.bold,
  },
  studentsList: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
  },
  listSectionTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  studentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: 2,
  },
  studentName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
    gap: 4,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryText: {
    fontSize: 9,
    fontWeight: typography.fontWeights.bold,
  },
  studentMeta: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
  },
  riskScoreCol: {
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  scoreValue: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
  },
  scoreUnit: {
    fontSize: 8,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.xs,
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  cardExpandedContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  subheading: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  dimensionsGrid: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dimensionBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  dimHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dimTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginLeft: 4,
    flex: 1,
  },
  dimScoreBadge: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.textSecondary,
  },
  dimDetailText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  historyBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  historyTimeline: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  historyPoint: {
    alignItems: 'center',
  },
  historyMonth: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  historyScoreCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  explanationBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
    marginBottom: spacing.sm,
  },
  explanationTitle: {
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
    color: '#1E40AF',
    marginBottom: 2,
  },
  explanationText: {
    fontSize: typography.fontSizes.xs,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  recommendationBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
    marginBottom: spacing.md,
  },
  recommendationTitle: {
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
    color: '#065F46',
    marginBottom: 2,
  },
  recommendationText: {
    fontSize: typography.fontSizes.xs,
    color: '#064E3B',
    lineHeight: 18,
  },
  actionsBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(0, 176, 116, 0.3)',
  },
  secondaryActionBtnText: {
    color: colors.primaryDark,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
});
