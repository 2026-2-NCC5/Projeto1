import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Sparkles,
  ChevronRight,
  Filter,
  Layers,
  Calendar,
  Building2,
  MessageSquare,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, typography, borderRadius } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { EnrichedRequirement } from '../../services/supabase/requirementsService';
import { FadeInView, ScalePressable } from '../../components/common/AnimatedComponents';
import { ManualRequirementModal } from '../../components/modals/ManualRequirementModal';

export const StudentRequirementsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0
  );

  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { requirements, refreshData, isLoadingData, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filtra requerimentos vinculados ao aluno logado
  const studentRequirements = useMemo(() => {
    if (!user?.ra && !user?.id) return requirements;
    const cleanUserRa = user?.ra ? String(user.ra).trim() : '';
    const cleanUserId = user?.id ? String(user.id).trim() : '';
    return requirements.filter((r) => {
      if (!r.studentRa && !r.studentId && !r.studentProfileId) return true;
      if (cleanUserRa && r.studentRa && String(r.studentRa).trim() === cleanUserRa) return true;
      if (cleanUserId && r.studentId && String(r.studentId).trim() === cleanUserId) return true;
      if (cleanUserId && r.studentProfileId && String(r.studentProfileId).trim() === cleanUserId) return true;
      return false;
    });
  }, [requirements, user?.ra, user?.id]);

  // Contadores de status
  const counts = useMemo(() => {
    let open = 0;
    let closed = 0;
    studentRequirements.forEach((r) => {
      if (r.status === 'approved' || r.status === 'rejected') {
        closed += 1;
      } else {
        open += 1;
      }
    });
    return {
      total: studentRequirements.length,
      open,
      closed,
    };
  }, [studentRequirements]);

  // Filtragem combinada por aba e busca
  const filteredRequirements = useMemo(() => {
    return studentRequirements.filter((r) => {
      // Filtro de aba
      if (activeTab === 'open' && (r.status === 'approved' || r.status === 'rejected')) {
        return false;
      }
      if (activeTab === 'closed' && r.status !== 'approved' && r.status !== 'rejected') {
        return false;
      }

      // Filtro de texto de busca
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchProtocol = (r.protocol || '').toLowerCase().includes(q);
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchType = (r.type || '').toLowerCase().includes(q);
      const matchStage = (r.currentStage || '').toLowerCase().includes(q);
      const matchDesc = (r.description || '').toLowerCase().includes(q);

      return matchProtocol || matchTitle || matchType || matchStage || matchDesc;
    });
  }, [studentRequirements, activeTab, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          label: 'Deferido',
          color: '#059669',
          bg: isDark ? 'rgba(5, 150, 105, 0.2)' : '#E6F4EA',
          icon: CheckCircle2,
        };
      case 'rejected':
        return {
          label: 'Indeferido',
          color: '#DC2626',
          bg: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FCE8E6',
          icon: AlertCircle,
        };
      case 'in_progress':
        return {
          label: 'Em Andamento',
          color: '#2563EB',
          bg: isDark ? 'rgba(37, 99, 235, 0.2)' : '#E8F0FE',
          icon: Clock,
        };
      default:
        return {
          label: 'Em Triagem',
          color: '#D97706',
          bg: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FEF3C7',
          icon: Clock,
        };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding + spacing.sm,
            backgroundColor: isDark ? colors.card : '#FFFFFF',
            borderBottomColor: isDark ? colors.border : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={[
              styles.backButton,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
            ]}
          >
            <ArrowLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Central de Requerimentos
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {user?.name || 'Aluno'} • RA {user?.ra || '24026851'}
            </Text>
          </View>
        </View>

        {/* Barra de Busca */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
            },
          ]}
        >
          <Search size={18} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Buscar por protocolo, assunto ou setor..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Lista de Requerimentos */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isLoadingData}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Banner de Ação Rápida: IA vs Manual */}
        <FadeInView delay={50} style={styles.actionBannerContainer}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('AIChat', {
                initialPrompt: 'Olá SISA! Gostaria de abrir um requerimento acadêmico.',
              })
            }
            style={[
              styles.actionBannerCard,
              {
                backgroundColor: isDark ? 'rgba(124,58,237,0.18)' : '#F5F3FF',
                borderColor: isDark ? 'rgba(124,58,237,0.35)' : 'rgba(124,58,237,0.2)',
              },
            ]}
          >
            <View style={[styles.actionBannerIconBox, { backgroundColor: '#7C3AED' }]}>
              <Sparkles size={20} color="#FFFFFF" />
            </View>
            <View style={styles.actionBannerTextBox}>
              <Text style={[styles.actionBannerTitle, { color: isDark ? '#DDD6FE' : '#6D28D9' }]}>
                Abertura Guiada com a SISA
              </Text>
              <Text style={[styles.actionBannerDesc, { color: colors.textSecondary }]}>
                Abra requerimentos de trancamento, bolsas ou certificados conversando com a IA
              </Text>
            </View>
            <ChevronRight size={18} color={isDark ? '#DDD6FE' : '#6D28D9'} />
          </TouchableOpacity>
        </FadeInView>

        {/* Botão Central e Evidente para Novo Requerimento */}
        <FadeInView delay={70} style={styles.prominentCtaWrapper}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => setManualModalVisible(true)}
            style={[styles.prominentNewReqBtn, { backgroundColor: colors.primary }]}
          >
            <View style={styles.prominentIconCircle}>
              <Plus size={22} color="#FFFFFF" strokeWidth={2.8} />
            </View>
            <View style={styles.prominentTextCol}>
              <Text style={styles.prominentBtnTitle}>ABRIR NOVO REQUERIMENTO</Text>
              <Text style={styles.prominentBtnSubtitle}>
                Toque aqui para abrir protocolo acadêmico, financeiro ou bolsas
              </Text>
            </View>
            <ChevronRight size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </FadeInView>

        {/* Resumo Rápido em Cards - Filtros Interativos */}
        <FadeInView delay={100} style={styles.kpiRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('all')}
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? colors.card : '#FFFFFF',
                borderColor: activeTab === 'all' ? colors.primary : (isDark ? colors.border : '#E2E8F0'),
                borderWidth: activeTab === 'all' ? 2 : 1,
              },
            ]}
          >
            <Layers size={18} color={activeTab === 'all' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.kpiValue, { color: activeTab === 'all' ? colors.primary : colors.textPrimary }]}>{counts.total}</Text>
            <Text style={[styles.kpiLabel, { color: activeTab === 'all' ? colors.primary : colors.textSecondary, fontWeight: activeTab === 'all' ? '700' : '500' }]}>Total</Text>
            {activeTab === 'all' && <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('open')}
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? colors.card : '#FFFFFF',
                borderColor: activeTab === 'open' ? '#2563EB' : (isDark ? colors.border : '#E2E8F0'),
                borderWidth: activeTab === 'open' ? 2 : 1,
              },
            ]}
          >
            <Clock size={18} color={activeTab === 'open' ? '#2563EB' : colors.textSecondary} />
            <Text style={[styles.kpiValue, { color: '#2563EB' }]}>{counts.open}</Text>
            <Text style={[styles.kpiLabel, { color: activeTab === 'open' ? '#2563EB' : colors.textSecondary, fontWeight: activeTab === 'open' ? '700' : '500' }]}>Abertos</Text>
            {activeTab === 'open' && <View style={[styles.activeDot, { backgroundColor: '#2563EB' }]} />}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('closed')}
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? colors.card : '#FFFFFF',
                borderColor: activeTab === 'closed' ? '#059669' : (isDark ? colors.border : '#E2E8F0'),
                borderWidth: activeTab === 'closed' ? 2 : 1,
              },
            ]}
          >
            <CheckCircle2 size={18} color={activeTab === 'closed' ? '#059669' : colors.textSecondary} />
            <Text style={[styles.kpiValue, { color: '#059669' }]}>{counts.closed}</Text>
            <Text style={[styles.kpiLabel, { color: activeTab === 'closed' ? '#059669' : colors.textSecondary, fontWeight: activeTab === 'closed' ? '700' : '500' }]}>Concluídos</Text>
            {activeTab === 'closed' && <View style={[styles.activeDot, { backgroundColor: '#059669' }]} />}
          </TouchableOpacity>
        </FadeInView>

        {/* Lista de Requerimentos */}
        <View style={styles.listSection}>
          <View style={styles.listHeaderRow}>
            <Text style={[styles.listHeaderTitle, { color: colors.textPrimary }]}>
              {activeTab === 'all'
                ? 'Todos os Processos'
                : activeTab === 'open'
                ? 'Processos em Andamento'
                : 'Processos Finalizados'}{' '}
              ({filteredRequirements.length})
            </Text>
          </View>

          {filteredRequirements.length === 0 ? (
            <FadeInView delay={150} style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconBox,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                ]}
              >
                <FileText size={40} color={colors.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {searchQuery ? 'Nenhum requerimento encontrado' : 'Nenhum requerimento nesta aba'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {searchQuery
                  ? 'Tente pesquisar por outro termo ou limpe a busca acima.'
                  : 'Você pode abrir um novo requerimento a qualquer momento de forma manual ou conversando com a IA.'}
              </Text>

              <View style={styles.emptyActionRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setManualModalVisible(true)}
                  style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.emptyBtnText}>Novo Requerimento</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    navigation.navigate('AIChat', {
                      initialPrompt: 'Olá SISA! Gostaria de abrir um requerimento acadêmico.',
                    })
                  }
                  style={[
                    styles.emptyBtn,
                    {
                      backgroundColor: isDark ? 'rgba(124,58,237,0.2)' : '#EDE9FE',
                      borderColor: '#7C3AED',
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Sparkles size={16} color="#7C3AED" />
                  <Text style={[styles.emptyBtnText, { color: '#7C3AED' }]}>Abrir via IA</Text>
                </TouchableOpacity>
              </View>
            </FadeInView>
          ) : (
            filteredRequirements.map((req, index) => {
              const badge = getStatusBadge(req.status);
              const BadgeIcon = badge.icon;
              const commentsCount = req.comments?.length || 0;

              return (
                <FadeInView key={req.id || req.protocol || index} delay={index * 50}>
                  <ScalePressable
                    onPress={() => navigation.navigate('RequirementDetail', { requirement: req })}
                    style={[
                      styles.card,
                      {
                        backgroundColor: isDark ? colors.card : '#FFFFFF',
                        borderColor: isDark ? colors.border : '#E2E8F0',
                      },
                    ]}
                  >
                    {/* Top row: Protocol + Status badge */}
                    <View style={styles.cardHeaderRow}>
                      <View
                        style={[
                          styles.protocolBadge,
                          {
                            backgroundColor: isDark
                              ? 'rgba(0,135,90,0.18)'
                              : '#E6F4EA',
                          },
                        ]}
                      >
                        <FileText size={12} color={colors.primary} />
                        <Text style={[styles.protocolText, { color: colors.primary }]}>
                          {req.protocol}
                        </Text>
                      </View>

                      <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                        <BadgeIcon size={12} color={badge.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.statusText, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    {/* Card Title */}
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                      {req.title}
                    </Text>

                    {/* Stage & Direction */}
                    <View style={styles.stageRow}>
                      <View style={styles.stageDot} />
                      <Text style={[styles.stageText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {req.currentStage || 'Recebido pela Secretaria'}
                      </Text>
                    </View>

                    {/* Divider */}
                    <View
                      style={[
                        styles.cardDivider,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                      ]}
                    />

                    {/* Card Footer: Department, Date, Comments */}
                    <View style={styles.cardFooter}>
                      <View style={styles.cardFooterCol}>
                        <View style={styles.footerInfoItem}>
                          <Building2 size={13} color={colors.textSecondary} />
                          <Text
                            style={[styles.footerInfoText, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {req.departmentDirection || req.type || 'Secretaria Acadêmica'}
                          </Text>
                        </View>

                        <View style={[styles.footerInfoItem, { marginTop: 4 }]}>
                          <Calendar size={13} color={colors.textSecondary} />
                          <Text style={[styles.footerInfoText, { color: colors.textSecondary }]}>
                            {req.createdAt || 'Agosto / 2026'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.footerActionCol}>
                        {commentsCount > 0 && (
                          <View
                            style={[
                              styles.commentCountBadge,
                              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
                            ]}
                          >
                            <MessageSquare size={12} color={colors.textSecondary} />
                            <Text
                              style={[styles.commentCountText, { color: colors.textSecondary }]}
                            >
                              {commentsCount}
                            </Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.chevronCircle,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
                          ]}
                        >
                          <ChevronRight size={16} color={colors.primary} />
                        </View>
                      </View>
                    </View>
                  </ScalePressable>
                </FadeInView>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modal de Criação Manual */}
      <ManualRequirementModal
        visible={manualModalVisible}
        onClose={() => setManualModalVisible(false)}
        onSuccess={(protocol) => {
          showToast(`Requerimento ${protocol} criado com sucesso!`, 'success');
          refreshData();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleCol: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
  },
  headerActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl + 20,
  },
  actionBannerContainer: {
    marginBottom: spacing.lg,
  },
  actionBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionBannerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  actionBannerTextBox: {
    flex: 1,
    marginRight: spacing.sm,
  },
  actionBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionBannerDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.xl,
  },
  kpiCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  listSection: {
    marginBottom: spacing.lg,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  listHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: spacing.xxl,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  protocolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  protocolText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 8,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00875A',
    marginRight: 6,
  },
  stageText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  cardDivider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFooterCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  footerInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerInfoText: {
    fontSize: 11,
  },
  footerActionCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  commentCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prominentCtaWrapper: {
    marginHorizontal: 16,
    marginBottom: 14,
  },
  prominentNewReqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
  },
  prominentIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  prominentTextCol: {
    flex: 1,
  },
  prominentBtnTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  prominentBtnSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
});