import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  DollarSign,
  GraduationCap,
  Users,
  MapPin,
  Search,
  ChevronRight,
  UserCheck,
  Sparkles,
  Bot,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useApp } from '../../store/AppContext';
import { studentsService } from '../../services/supabase/studentsService';
import { StudentRiskProfile, RiskCategory } from '../../services/ai-agent/studentRiskService';

export const StudentRiskScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const { showToast } = useApp();

  const [students, setStudents] = useState<StudentRiskProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'Todos' | RiskCategory>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await studentsService.getStudentsWithRiskScores();
      setStudents(data);
      if (data.length > 0 && !expandedStudentId) {
        setExpandedStudentId(data[0].id);
      }
    } catch (e) {
      console.warn('Erro ao carregar scores:', e);
      showToast('Erro ao carregar scores de risco', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredStudents = students.filter((st) => {
    const matchesCategory = selectedCategory === 'Todos' || st.category === selectedCategory;
    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.ra.includes(searchQuery) ||
      st.course.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const countVermelho = students.filter((s) => s.category === 'Vermelho').length;
  const countAmarelo = students.filter((s) => s.category === 'Amarelo').length;
  const countVerde = students.filter((s) => s.category === 'Verde').length;

  const handleActionSupport = (studentName: string, actionType: string) => {
    showToast(`Ação registrada para ${studentName}: "${actionType}"`, 'success');
  };

  const handleOpenAgentChat = (initialPrompt?: string) => {
    navigation.navigate('AIChat', { initialPrompt });
  };

  const getCategoryTheme = (category: RiskCategory) => {
    switch (category) {
      case 'Vermelho':
        return {
          color: '#DC2626',
          bgColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2',
          borderColor: 'rgba(220, 38, 38, 0.4)',
          label: 'Risco Crítico',
        };
      case 'Amarelo':
        return {
          color: '#D97706',
          bgColor: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FEF3C7',
          borderColor: 'rgba(217, 119, 6, 0.4)',
          label: 'Atenção / Moderado',
        };
      case 'Verde':
      default:
        return {
          color: '#059669',
          bgColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#D1FAE5',
          borderColor: 'rgba(5, 150, 105, 0.4)',
          label: 'Estável / Baixo Risco',
        };
    }
  };

  const renderTrendIcon = (trend: string) => {
    switch (trend) {
      case 'Piorando':
        return <TrendingUp size={16} color="#DC2626" />;
      case 'Melhorando':
        return <TrendingDown size={16} color="#059669" />;
      default:
        return <Minus size={16} color="#D97706" />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Top Navbar */}
      <View style={[styles.navbar, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: topPadding + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Classificação de Fragilidade (4D)</Text>
          <Text style={[styles.navSubtitle, { color: colors.textSecondary }]}>
            Análise Preditiva de Evasão • Núcleo de Permanência
          </Text>
        </View>
        <TouchableOpacity onPress={loadData} style={styles.refreshBtn} activeOpacity={0.7}>
          <RefreshCw size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Banner de Metodologia 4D */}
        <View style={[styles.methodologyBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
          <View style={styles.methodologyHeader}>
            <Sparkles size={16} color={colors.primaryDark} />
            <Text style={[styles.methodologyTitle, { color: colors.primaryDark }]}>
              MODELO MULTIDIMENSIONAL DE RISCO 4D FECAP
            </Text>
          </View>
          <Text style={[styles.methodologyDesc, { color: colors.textPrimary }]}>
            Composição ponderada de permanência: <Text style={{ fontWeight: '700' }}>Financeira (35%)</Text> +{' '}
            <Text style={{ fontWeight: '700' }}>Acadêmica (30%)</Text> +{' '}
            <Text style={{ fontWeight: '700' }}>Relacionamento (20%)</Text> +{' '}
            <Text style={{ fontWeight: '700' }}>Geográfica (15%)</Text>.
          </Text>
        </View>

        {/* Métricas Semafóricas */}
        <View style={styles.metricsRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSelectedCategory('Vermelho')}
            style={[
              styles.metricCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: '#DC2626' },
              selectedCategory === 'Vermelho' && { borderColor: '#DC2626', borderWidth: 1.5 },
            ]}
          >
            <Text style={[styles.metricNumber, { color: '#DC2626' }]}>{countVermelho}</Text>
            <Text style={[styles.metricLabel, { color: colors.textPrimary }]}>Crítico</Text>
            <Text style={[styles.metricSub, { color: colors.textMuted }]}>Ação Imediata</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSelectedCategory('Amarelo')}
            style={[
              styles.metricCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: '#D97706' },
              selectedCategory === 'Amarelo' && { borderColor: '#D97706', borderWidth: 1.5 },
            ]}
          >
            <Text style={[styles.metricNumber, { color: '#D97706' }]}>{countAmarelo}</Text>
            <Text style={[styles.metricLabel, { color: colors.textPrimary }]}>Atenção</Text>
            <Text style={[styles.metricSub, { color: colors.textMuted }]}>Monitoramento</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSelectedCategory('Verde')}
            style={[
              styles.metricCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: '#059669' },
              selectedCategory === 'Verde' && { borderColor: '#059669', borderWidth: 1.5 },
            ]}
          >
            <Text style={[styles.metricNumber, { color: '#059669' }]}>{countVerde}</Text>
            <Text style={[styles.metricLabel, { color: colors.textPrimary }]}>Estável</Text>
            <Text style={[styles.metricSub, { color: colors.textMuted }]}>Baixo Risco</Text>
          </TouchableOpacity>
        </View>

        {/* Busca e Chips de Categoria */}
        <View style={styles.filtersSection}>
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Search size={18} color={colors.textMuted} />
            <TextInput
              placeholder="Buscar por RA, Nome ou Curso..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholderTextColor={colors.textMuted}
            />
          </View>

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
                    { backgroundColor: colors.card, borderColor: colors.border },
                    isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: colors.textSecondary },
                      isSelected && { color: '#FFFFFF', fontWeight: '700' },
                    ]}
                  >
                    {cat === 'Todos' ? `Todos (${students.length})` : `Categoria ${cat}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Lista de Estudantes */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Carregando scores do Supabase...
            </Text>
          </View>
        ) : (
          <View style={styles.studentsList}>
            <Text style={[styles.listSectionTitle, { color: colors.textPrimary }]}>
              Estudantes Classificados ({filteredStudents.length})
            </Text>

            {filteredStudents.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <AlertTriangle size={32} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nenhum aluno encontrado</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Tente alterar os termos de busca ou o filtro de categoria semafórica.
                </Text>
              </View>
            ) : (
              filteredStudents.map((st) => {
                const theme = getCategoryTheme(st.category);

                return (
                  <TouchableOpacity
                    key={st.id}
                    activeOpacity={0.88}
                    onPress={() => navigation.navigate('StudentRiskDetail', { student: st })}
                    style={[
                      styles.studentCard,
                      { backgroundColor: colors.card, borderColor: theme.borderColor },
                    ]}
                  >
                    {/* Header do Card */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={styles.studentNameRow}>
                          <Text style={[styles.studentName, { color: colors.textPrimary }]}>
                            {st.name}
                          </Text>
                          <View style={[styles.categoryBadge, { backgroundColor: theme.bgColor }]}>
                            <View style={[styles.categoryDot, { backgroundColor: theme.color }]} />
                            <Text style={[styles.categoryText, { color: theme.color }]}>
                              {theme.label}
                            </Text>
                          </View>
                          <View
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                              borderRadius: 10,
                              backgroundColor:
                                st.status_academico === 'Evasão' || st.status_academico === 'Cancelado'
                                  ? '#FEE2E2'
                                  : st.status_academico === 'Formado'
                                  ? '#DBEAFE'
                                  : st.status_academico === 'Trancado'
                                  ? '#FEF3C7'
                                  : '#D1FAE5',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color:
                                  st.status_academico === 'Evasão' || st.status_academico === 'Cancelado'
                                    ? '#DC2626'
                                    : st.status_academico === 'Formado'
                                    ? '#2563EB'
                                    : st.status_academico === 'Trancado'
                                    ? '#D97706'
                                    : '#059669',
                              }}
                            >
                              {st.status_academico === 'Evasão' || st.status_academico === 'Cancelado'
                                ? '🔴 Evasão'
                                : st.status_academico === 'Formado'
                                ? '🔵 Formado'
                                : st.status_academico === 'Trancado'
                                ? '🟡 Trancado'
                                : '🟢 Matriculado'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.studentMeta, { color: colors.textMuted }]}>
                          RA: {st.ra} • {st.course} ({st.semester}) • {st.status_academico || 'Matriculado'}
                        </Text>
                      </View>

                      <View style={[styles.riskScoreCol, { backgroundColor: colors.backgroundAlt, borderColor: theme.color }]}>
                        <Text style={[styles.scoreValue, { color: theme.color }]}>
                          {st.overallRiskScore}
                        </Text>
                        <Text style={[styles.scoreUnit, { color: colors.textMuted }]}>Score / 100</Text>
                      </View>
                    </View>

                    {/* Resumo Rápido das 4 Dimensões 4D */}
                    <View style={[styles.mini4DRow, { backgroundColor: colors.backgroundAlt, borderColor: colors.borderLight }]}>
                      <View style={styles.mini4DItem}>
                        <DollarSign size={13} color="#DC2626" />
                        <Text style={[styles.mini4DLabel, { color: colors.textSecondary }]}>Fin (35%):</Text>
                        <Text style={[styles.mini4DScore, { color: '#DC2626' }]}>
                          {st.dimensions.financeira.score}
                        </Text>
                      </View>

                      <View style={styles.mini4DItem}>
                        <GraduationCap size={13} color="#D97706" />
                        <Text style={[styles.mini4DLabel, { color: colors.textSecondary }]}>Acad (30%):</Text>
                        <Text style={[styles.mini4DScore, { color: '#D97706' }]}>
                          {st.dimensions.academica.score}
                        </Text>
                      </View>

                      <View style={styles.mini4DItem}>
                        <Users size={13} color={colors.secondary} />
                        <Text style={[styles.mini4DLabel, { color: colors.textSecondary }]}>Rel (20%):</Text>
                        <Text style={[styles.mini4DScore, { color: colors.secondary }]}>
                          {st.dimensions.relacionamento.score}
                        </Text>
                      </View>

                      <View style={styles.mini4DItem}>
                        <MapPin size={13} color={colors.primaryDark} />
                        <Text style={[styles.mini4DLabel, { color: colors.textSecondary }]}>Geo (15%):</Text>
                        <Text style={[styles.mini4DScore, { color: colors.primaryDark }]}>
                          {st.dimensions.geografica.score}
                        </Text>
                      </View>
                    </View>

                    {/* Resumo da Tendência e Chamada para Detalhes */}
                    <View style={[styles.trendRow, { borderTopColor: colors.borderLight }]}>
                      <View style={styles.trendItem}>
                        {renderTrendIcon(st.temporalTrend)}
                        <Text style={[styles.trendText, { color: colors.textSecondary }]}>
                          Tendência: <Text style={{ fontWeight: 'bold' }}>{st.temporalTrend}</Text> ({st.trendVariation})
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.viewDetailsText, { color: colors.primary }]}>
                          Abrir Perfil 4D
                        </Text>
                        <ChevronRight size={16} color={colors.primary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  navSubtitle: {
    fontSize: 11,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  methodologyBanner: {
    margin: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  methodologyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  methodologyTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  methodologyDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  metricSub: {
    fontSize: 9,
  },
  filtersSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
  },
  chipsRow: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
  },
  studentsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  studentCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  studentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 4,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryText: {
    fontSize: 9,
    fontWeight: '700',
  },
  studentMeta: {
    fontSize: 11,
  },
  riskScoreCol: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  scoreUnit: {
    fontSize: 8,
    textTransform: 'uppercase',
  },
  mini4DRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 6,
  },
  mini4DItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mini4DLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  mini4DScore: {
    fontSize: 11,
    fontWeight: '800',
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    marginTop: 6,
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendText: {
    fontSize: 11,
  },
  cardExpandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  subheading: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dimensionsGrid: {
    gap: 8,
    marginBottom: 12,
  },
  dimensionBox: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
  },
  dimHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dimTitle: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    marginLeft: 6,
  },
  dimScoreBadge: {
    fontSize: 11,
    fontWeight: '700',
  },
  dimDetailText: {
    fontSize: 11,
    lineHeight: 16,
  },
  explanationBox: {
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    marginBottom: 10,
  },
  explanationTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 12,
    lineHeight: 18,
  },
  recommendationBox: {
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    marginBottom: 12,
  },
  recommendationTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 12,
    lineHeight: 18,
  },
  actionsBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
});
