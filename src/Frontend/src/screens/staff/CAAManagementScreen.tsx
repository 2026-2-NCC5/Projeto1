import React, { useState, useEffect, useCallback } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft,
  Users,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Calendar,
  Building2,
  RefreshCw,
  Award,
  Layers,
  User,
  Ticket,
  ChevronRight,
  Bell,
  Headphones,
  UserCheck,
  Lock,
  MessageSquare,
  Star,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { studentsService } from '../../services/supabase/studentsService';
import { requirementsService, EnrichedRequirement } from '../../services/supabase/requirementsService';
import { queueService, QueueTicket } from '../../services/supabase/queueService';
import { liveChatService, LiveSupportSession } from '../../services/supabase/liveChatService';
import { feedbackService, OverallSatisfactionSummary } from '../../services/supabase/feedbackService';

export const CAAManagementScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const { showToast } = useApp();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ total: 392, matriculados: 352, formados: 20, evasao: 20 });
  const [requirements, setRequirements] = useState<EnrichedRequirement[]>([]);
  const [queue, setQueue] = useState<QueueTicket[]>([]);
  const [completedQueue, setCompletedQueue] = useState<QueueTicket[]>([]);
  const [queueTab, setQueueTab] = useState<'active' | 'completed'>('active');
  const [liveSessions, setLiveSessions] = useState<LiveSupportSession[]>([]);
  const [resolvedSessions, setResolvedSessions] = useState<LiveSupportSession[]>([]);
  const [liveTab, setLiveTab] = useState<'queue' | 'history'>('queue');
  const [satisfaction, setSatisfaction] = useState<OverallSatisfactionSummary>({
    averageRating: null,
    totalResponses: 0,
    overallFcr: null,
    npsScore: null,
    breakdown: [],
  });
  const [solvedSearch, setSolvedSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [baseM, reqs, q, completedQ, liveQ, resolvedQ, sat] = await Promise.all([
        studentsService.getBaseMetrics(),
        requirementsService.getRequirements(),
        queueService.getQueue(),
        queueService.getCompletedTicketsHistory(),
        liveChatService.getStaffQueue(),
        liveChatService.getResolvedStaffHistory(),
        feedbackService.getSatisfactionSummary(),
      ]);
      setMetrics(baseM);
      setRequirements(reqs);
      setQueue(q);
      setCompletedQueue(completedQ);
      setLiveSessions(liveQ);
      setResolvedSessions(resolvedQ);
      setSatisfaction(sat);
    } catch (e) {
      console.warn('Erro ao carregar dados do CAA:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    loadData();

    const unsubscribeQueue = queueService.subscribeToQueue((fresh) => {
      setQueue(fresh);
    });

    const unsubscribeLive = liveChatService.subscribeToStaffQueue(() => {
      liveChatService.getStaffQueue().then(setLiveSessions);
      liveChatService.getResolvedStaffHistory().then(setResolvedSessions);
    });

    const unsubscribeFeedback = feedbackService.subscribeToFeedbacks(() => {
      feedbackService.getSatisfactionSummary().then(setSatisfaction);
    });

    return () => {
      if (unsubscribeQueue) unsubscribeQueue();
      if (unsubscribeLive) unsubscribeLive();
      if (unsubscribeFeedback) unsubscribeFeedback();
    };
  }, []);

  // Análise de tipos de requerimentos mais recorrentes
  const recurringCounts: Record<string, number> = {};
  requirements.forEach((r) => {
    const key = r.title || 'Solicitação Geral';
    recurringCounts[key] = (recurringCounts[key] || 0) + 1;
  });

  const sortedRecurring = Object.entries(recurringCounts).sort((a, b) => b[1] - a[1]);

  const waitingCount = queue.filter((t) => t.status === 'waiting').length;
  const inServiceCount = queue.filter((t) => t.status === 'called' || t.status === 'in_service').length;
  const waitingLiveCount = liveSessions.filter((s) => s.status === 'waiting_staff').length;
  const urgentReqsCount = requirements.filter((r) => r.attentionLevel === 'Urgente' || (r as any).status === 'urgent').length;

  const handleCallNextTicket = async () => {
    try {
      const called = await queueService.callNextTicket('Guichê 01');
      if (called) {
        showToast(`Senha ${called.ticket_number} chamada com sucesso para o ${called.counter}!`, 'success');
        loadData();
      } else {
        showToast('Não há senhas aguardando atendimento.', 'info');
      }
    } catch {
      showToast('Erro ao chamar próxima senha.', 'error');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Navbar */}
      <View
        style={[
          styles.navbar,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: topPadding + 8,
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Central de Gestão CAA</Text>
          <Text style={[styles.navSubtitle, { color: colors.textSecondary }]}>
            Painel Analítico de Atendimento, Fila, Chat ao Vivo & SLA
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
            refreshing={loading}
            onRefresh={loadData}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Banner Institucional */}
        <View style={[styles.summaryBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
          <Building2 size={24} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryBannerTitle, { color: colors.primaryDark }]}>
              Área do Sucesso Alvarista (ASA) • Gestão Integrada
            </Text>
            <Text style={[styles.summaryBannerDesc, { color: colors.textSecondary }]}>
              Visão consolidada de capacidade operacional, demandas estudantis, chat ao vivo e controle de permanência.
            </Text>
          </View>
        </View>

        {/* PAINEL DOS 6 INDICADORES OFICIAIS DE DESEMPENHO CAA */}
        <View style={styles.sixKpiSection}>
          <Text style={[styles.sixKpiHeaderTitle, { color: colors.textPrimary }]}>
            Indicadores Estratégicos de Atendimento & SLA
          </Text>
          <View style={styles.sixKpiGrid}>
            {/* 1. Tempo Médio de 1ª Resposta */}
            <View style={[styles.sixKpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Clock size={16} color="#0284C7" />
              </View>
              <Text style={[styles.sixKpiVal, { color: colors.textPrimary }]}>14 min</Text>
              <Text style={[styles.sixKpiLbl, { color: colors.textSecondary }]}>Tempo Médio de 1ª Resposta</Text>
              <Text style={[styles.sixKpiSub, { color: '#059669' }]}>-4 min vs mês anterior</Text>
            </View>

            {/* 2. Tempo Médio de Resolução */}
            <View style={[styles.sixKpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#F3E8FF' }]}>
                <Calendar size={16} color="#7C3AED" />
              </View>
              <Text style={[styles.sixKpiVal, { color: colors.textPrimary }]}>1.6 dias</Text>
              <Text style={[styles.sixKpiLbl, { color: colors.textSecondary }]}>Tempo Médio de Resolução</Text>
              <Text style={[styles.sixKpiSub, { color: '#059669' }]}>Meta: até 3.0 dias</Text>
            </View>

            {/* 3. Taxa de Cumprimento de SLA */}
            <View style={[styles.sixKpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#D1FAE5' }]}>
                <Award size={16} color="#059669" />
              </View>
              <Text style={[styles.sixKpiVal, { color: '#059669' }]}>96.8%</Text>
              <Text style={[styles.sixKpiLbl, { color: colors.textSecondary }]}>Taxa Cumprimento SLA</Text>
              <Text style={[styles.sixKpiSub, { color: '#059669' }]}>Alto padrão FECAP</Text>
            </View>

            {/* 4. Demandas Críticas / Fora do Prazo */}
            <View style={[styles.sixKpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#FEE2E2' }]}>
                <AlertTriangle size={16} color="#DC2626" />
              </View>
              <Text style={[styles.sixKpiVal, { color: urgentReqsCount > 0 ? '#DC2626' : colors.textPrimary }]}>
                {urgentReqsCount} {urgentReqsCount === 1 ? 'chamado' : 'chamados'}
              </Text>
              <Text style={[styles.sixKpiLbl, { color: colors.textSecondary }]}>Críticas / Urgentes</Text>
              <Text style={[styles.sixKpiSub, { color: urgentReqsCount > 0 ? '#DC2626' : '#059669' }]}>
                {urgentReqsCount > 0 ? 'Requer atenção imediata' : 'Nenhuma pendência crítica'}
              </Text>
            </View>

            {/* 5. Resolução no 1º Contato (FCR) */}
            <View style={[styles.sixKpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#FEF3C7' }]}>
                <TrendingUp size={16} color="#D97706" />
              </View>
              <Text style={[styles.sixKpiVal, { color: colors.textPrimary }]}>
                {satisfaction.overallFcr !== null ? `${satisfaction.overallFcr}%` : '—'}
              </Text>
              <Text style={[styles.sixKpiLbl, { color: colors.textSecondary }]}>Resolução no 1º Contato (FCR)</Text>
              <Text style={[styles.sixKpiSub, { color: satisfaction.overallFcr !== null ? '#059669' : colors.textMuted }]}>
                {satisfaction.overallFcr !== null ? 'Baseado em avaliações' : 'Sem métrica registrada'}
              </Text>
            </View>

            {/* 6. Nota de Satisfação Estudantil (CSAT / NPS) */}
            <View style={[styles.sixKpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Star size={16} color="#D97706" fill="#F59E0B" />
              </View>
              <Text style={[styles.sixKpiVal, { color: '#D97706' }]}>
                {satisfaction.totalResponses > 0 && satisfaction.averageRating !== null
                  ? `★ ${satisfaction.averageRating.toFixed(2)}`
                  : '—'}
              </Text>
              <Text style={[styles.sixKpiLbl, { color: colors.textSecondary }]}>CSAT & NPS Oficial</Text>
              <Text style={[styles.sixKpiSub, { color: '#059669' }]}>
                {satisfaction.totalResponses > 0
                  ? `NPS ${satisfaction.npsScore !== null ? (satisfaction.npsScore > 0 ? '+' : '') + satisfaction.npsScore : '0'} • ${satisfaction.totalResponses} avaliaç${satisfaction.totalResponses === 1 ? 'ão' : 'ões'}`
                  : 'Aguardando avaliações'}
              </Text>
            </View>
          </View>
        </View>

        {/* Grade de 4 Grandes Indicadores */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Users size={20} color={colors.primary} />
            <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{metrics.total}</Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Alunos na Base</Text>
            <Text style={[styles.kpiSub, { color: '#059669' }]}>352 Matriculados</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FileText size={20} color="#D97706" />
            <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{requirements.length}</Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Requerimentos</Text>
            <Text style={[styles.kpiSub, { color: '#D97706' }]}>Em Triagem</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Clock size={20} color="#0284C7" />
            <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{queue.length}</Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Fila Presencial</Text>
            <Text style={[styles.kpiSub, { color: '#0284C7' }]}>{waitingCount} em espera</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Headphones size={20} color="#7C3AED" />
            <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{liveSessions.length}</Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Chats Ativos</Text>
            <Text style={[styles.kpiSub, { color: '#059669' }]}>{resolvedSessions.length} finalizados</Text>
          </View>
        </View>

        {/* Indicador Oficial de Satisfação Estudantil (CSAT / NPS) */}
        <View style={[styles.csatOverviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.csatCardTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
              <View style={[styles.csatIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Star size={18} color="#D97706" fill="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.csatCardTitle, { color: colors.textPrimary }]}>
                  Satisfação Estudantil (CSAT & NPS)
                </Text>
                <Text style={[styles.csatCardSubtitle, { color: colors.textSecondary }]}>
                  {satisfaction.totalResponses > 0
                    ? `${satisfaction.totalResponses} ${satisfaction.totalResponses === 1 ? 'avaliação consolidada' : 'avaliações consolidadas'} dos atendimentos via chat`
                    : 'Aguardando avaliações dos atendimentos via chat'}
                </Text>
              </View>
            </View>

            {/* Badges de CSAT e NPS */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {/* CSAT Badge */}
              <View style={[styles.csatScoreBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', alignItems: 'center', paddingHorizontal: 8 }]}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#D97706', letterSpacing: 0.5 }}>CSAT</Text>
                <Text style={styles.csatScoreBadgeText}>
                  {satisfaction.averageRating !== null
                    ? `★ ${satisfaction.averageRating.toFixed(2)}`
                    : '—'}
                </Text>
              </View>

              {/* NPS Badge */}
              <View style={[styles.csatScoreBadge, { backgroundColor: '#D1FAE5', borderColor: '#059669', alignItems: 'center', paddingHorizontal: 8 }]}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#059669', letterSpacing: 0.5 }}>NPS</Text>
                <Text style={[styles.csatScoreBadgeText, { color: '#059669' }]}>
                  {satisfaction.npsScore !== null
                    ? `${satisfaction.npsScore > 0 ? '+' : ''}${satisfaction.npsScore}`
                    : '—'}
                </Text>
              </View>
            </View>
          </View>

          {satisfaction.breakdown.length > 0 ? (
            <View style={styles.csatChannelsRow}>
              {satisfaction.breakdown.map((ch, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.csatChannelChip,
                    { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.csatChannelName, { color: colors.textPrimary }]}>
                    {ch.channel}:
                  </Text>
                  <Text style={styles.csatChannelRating}>
                    ★ {ch.rating.toFixed(1)} ({ch.responses})
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.csatEmptyBox, { backgroundColor: colors.backgroundAlt }]}>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                Os discentes podem avaliar o suporte ao final dos atendimentos no App ASA. O indicador será atualizado automaticamente em tempo real.
              </Text>
            </View>
          )}
        </View>

        {/* Seção de Chats ao Vivo e Histórico no CAA */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Headphones size={20} color="#7C3AED" />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Atendimentos CAA • Alunos
              </Text>
            </View>
            {waitingLiveCount > 0 && liveTab === 'queue' && (
              <View style={[styles.liveAlertBadge, { backgroundColor: '#FEF3C7', borderColor: '#D97706' }]}>
                <Text style={[styles.liveAlertBadgeText, { color: '#D97706' }]}>
                  {waitingLiveCount} aguardando
                </Text>
              </View>
            )}
          </View>

          {/* Abas Alternáveis: Fila Ativa vs Histórico Concluído */}
          <View style={[styles.tabSelectorContainer, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setLiveTab('queue')}
              style={[
                styles.tabSelectorBtn,
                liveTab === 'queue' && [styles.tabSelectorBtnActive, { backgroundColor: colors.card, borderColor: '#7C3AED' }],
              ]}
            >
              <Clock size={14} color={liveTab === 'queue' ? '#7C3AED' : colors.textSecondary} />
              <Text
                style={[
                  styles.tabSelectorBtnText,
                  { color: liveTab === 'queue' ? '#7C3AED' : colors.textSecondary },
                ]}
              >
                Fila Ativa ({liveSessions.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setLiveTab('history')}
              style={[
                styles.tabSelectorBtn,
                liveTab === 'history' && [styles.tabSelectorBtnActive, { backgroundColor: colors.card, borderColor: '#059669' }],
              ]}
            >
              <CheckCircle2 size={14} color={liveTab === 'history' ? '#059669' : colors.textSecondary} />
              <Text
                style={[
                  styles.tabSelectorBtnText,
                  { color: liveTab === 'history' ? '#059669' : colors.textSecondary },
                ]}
              >
                Histórico Concluído ({resolvedSessions.length})
              </Text>
            </TouchableOpacity>
          </View>

          {liveTab === 'queue' ? (
            liveSessions.length > 0 ? (
              <View style={{ gap: 10, marginTop: 4 }}>
                {liveSessions.map((s) => {
                  const isWaiting = s.status === 'waiting_staff';
                  const isMySession =
                    s.status === 'in_human_support' &&
                    (s.assignedStaffId === user?.id || s.assignedStaffName === user?.name);
                  const isLockedByOther = s.status === 'in_human_support' && !isMySession;

                  return (
                    <View
                      key={s.id}
                      style={[
                        styles.liveChatRowCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: isWaiting ? '#D97706' : isMySession ? '#059669' : colors.border,
                          borderLeftColor: isWaiting ? '#D97706' : isMySession ? '#059669' : '#94A3B8',
                        },
                      ]}
                    >
                      <View style={styles.liveChatCardTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                          {isWaiting ? (
                            <Headphones size={16} color="#D97706" />
                          ) : isMySession ? (
                            <UserCheck size={16} color="#059669" />
                          ) : (
                            <Lock size={16} color="#64748B" />
                          )}
                          <Text style={[styles.liveChatStudentName, { color: colors.textPrimary }]}>
                            {s.studentName}
                          </Text>
                          <Text style={[styles.liveChatStudentRa, { color: colors.textSecondary }]}>
                            ({s.studentRa})
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.liveChatStatusTag,
                            {
                              backgroundColor: isWaiting
                                ? '#FEF3C7'
                                : isMySession
                                ? '#D1FAE5'
                                : isDark
                                ? '#334155'
                                : '#F1F5F9',
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            },
                          ]}
                        >
                          {isLockedByOther && <Lock size={10} color="#64748B" />}
                          <Text
                            style={[
                              styles.liveChatStatusTagText,
                              {
                                color: isWaiting
                                  ? '#D97706'
                                  : isMySession
                                  ? '#059669'
                                  : '#64748B',
                              },
                            ]}
                          >
                            {isWaiting
                              ? 'Fila • Aguardando'
                              : isMySession
                              ? 'Seu Atendimento'
                              : `Atendido por ${s.assignedStaffName || 'Colega'}`}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.liveChatPreview, { color: colors.textSecondary }]} numberOfLines={2}>
                        💬 {s.lastMessagePreview || 'Solicitação de atendimento humano'}
                      </Text>

                      <View style={styles.liveChatActionRow}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() =>
                            navigation.navigate('StudentFullProfile', {
                              ra: s.studentRa,
                              student: { ra: s.studentRa, name: s.studentName, course: s.studentCourse },
                            })
                          }
                          style={[styles.smallActionBtn, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
                        >
                          <User size={12} color={colors.textSecondary} />
                          <Text style={[styles.smallActionBtnText, { color: colors.textSecondary }]}>Dossiê Aluno</Text>
                        </TouchableOpacity>

                        {isLockedByOther ? (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() =>
                              showToast(
                                `Este aluno já está sendo atendido por ${s.assignedStaffName || 'outro colaborador'}. Escolha outro chamado da fila.`,
                                'info'
                              )
                            }
                            style={[
                              styles.openChatActionBtn,
                              { backgroundColor: isDark ? '#334155' : '#E2E8F0', opacity: 0.85 },
                            ]}
                          >
                            <Lock size={13} color="#64748B" style={{ marginRight: 4 }} />
                            <Text style={[styles.openChatActionBtnText, { color: '#64748B' }]}>
                              Bloqueado • Em Atendimento
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() =>
                              navigation.navigate('AIChat', {
                                liveSession: s,
                                staffSupportMode: true,
                              })
                            }
                            style={[
                              styles.openChatActionBtn,
                              { backgroundColor: isWaiting ? '#7C3AED' : '#059669' },
                            ]}
                          >
                            {isWaiting ? (
                              <UserCheck size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                            ) : (
                              <MessageSquare size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                            )}
                            <Text style={styles.openChatActionBtnText}>
                              {isWaiting ? 'Assumir Atendimento' : 'Continuar Atendimento'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', paddingVertical: 18 }]}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Nenhum estudante aguardando atendimento humano no momento.
                </Text>
              </View>
            )
          ) : (
            resolvedSessions.length > 0 ? (
              <View style={{ gap: 10, marginTop: 4 }}>
                {resolvedSessions.map((s) => {
                  const dateFormatted = new Date(s.updatedAt).toLocaleDateString([], {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <View
                      key={s.id}
                      style={[
                        styles.liveChatRowCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          borderLeftColor: '#059669',
                        },
                      ]}
                    >
                      <View style={styles.liveChatCardTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                          <CheckCircle2 size={16} color="#059669" />
                          <Text style={[styles.liveChatStudentName, { color: colors.textPrimary }]}>
                            {s.studentName}
                          </Text>
                          <Text style={[styles.liveChatStudentRa, { color: colors.textSecondary }]}>
                            ({s.studentRa})
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.liveChatStatusTag,
                            { backgroundColor: '#D1FAE5' },
                          ]}
                        >
                          <Text style={[styles.liveChatStatusTagText, { color: '#059669' }]}>
                            Concluído
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          👤 Atendido por: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{s.assignedStaffName || 'Equipe CAA'}</Text>
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          🕒 {dateFormatted}
                        </Text>
                      </View>

                      <Text style={[styles.liveChatPreview, { color: colors.textSecondary }]} numberOfLines={2}>
                        💬 {s.lastMessagePreview || 'Atendimento finalizado com sucesso'}
                      </Text>

                      <View style={styles.liveChatActionRow}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() =>
                            navigation.navigate('StudentFullProfile', {
                              ra: s.studentRa,
                              student: { ra: s.studentRa, name: s.studentName, course: s.studentCourse },
                            })
                          }
                          style={[styles.smallActionBtn, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
                        >
                          <User size={12} color={colors.textSecondary} />
                          <Text style={[styles.smallActionBtnText, { color: colors.textSecondary }]}>Dossiê Aluno</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() =>
                            navigation.navigate('AIChat', {
                              liveSession: s,
                              staffSupportMode: true,
                            })
                          }
                          style={[
                            styles.openChatActionBtn,
                            { backgroundColor: '#059669' },
                          ]}
                        >
                          <FileText size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.openChatActionBtnText}>
                            Ver Histórico Completo
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', paddingVertical: 22 }]}>
                <CheckCircle2 size={30} color="#059669" style={{ marginBottom: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
                  Nenhum atendimento arquivado no histórico ainda
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  Assim que um chamado for concluído por um colaborador, ele ficará disponível aqui para consulta.
                </Text>
              </View>
            )
          )}
        </View>

        {/* Demandas Mais Recorrentes */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Demandas e Requerimentos Mais Recorrentes
            </Text>
            <BarChart3 size={18} color={colors.primary} />
          </View>

          <View style={[styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {sortedRecurring.slice(0, 6).map(([demandTitle, count], idx) => {
              const pct = Math.round((count / Math.max(1, requirements.length)) * 100);

              return (
                <View
                  key={idx}
                  style={[styles.demandRow, idx > 0 && { borderTopColor: colors.borderLight, borderTopWidth: 1 }]}
                >
                  <View style={styles.demandHeader}>
                    <Text style={[styles.demandRank, { color: colors.primary }]}>#{idx + 1}</Text>
                    <Text style={[styles.demandName, { color: colors.textPrimary }]}>{demandTitle}</Text>
                    <Text style={[styles.demandCount, { color: colors.textSecondary }]}>
                      {count} ({pct}%)
                    </Text>
                  </View>

                  <View style={[styles.progressBarTrack, { backgroundColor: colors.backgroundAlt }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(100, pct * 2.5)}%`, backgroundColor: colors.primary },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Seção Oficial: Requerimentos Solucionados */}
        <View style={[styles.section, { marginTop: 14 }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.kpiIconBox, { backgroundColor: '#D1FAE5' }]}>
                <CheckCircle2 size={16} color="#059669" />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Requerimentos Solucionados
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Processos acadêmicos e financeiros deferidos, indeferidos ou concluídos
                </Text>
              </View>
            </View>
          </View>

          {/* Busca de Solucionados */}
          <View
            style={[
              styles.solvedSearchBox,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
              },
            ]}
          >
            <TextInput
              style={[styles.solvedSearchInput, { color: colors.textPrimary }]}
              placeholder="Buscar solucionados por protocolo, estudante ou curso..."
              placeholderTextColor={colors.textSecondary}
              value={solvedSearch}
              onChangeText={setSolvedSearch}
            />
          </View>

          {/* Lista de Requerimentos Solucionados */}
          <View style={{ gap: 8, marginTop: 10 }}>
            {requirements
              .filter((r) => r.status === 'approved' || r.status === 'rejected')
              .filter((r) => {
                if (!solvedSearch.trim()) return true;
                const q = solvedSearch.toLowerCase();
                return (
                  (r.protocol || '').toLowerCase().includes(q) ||
                  (r.studentName || '').toLowerCase().includes(q) ||
                  (r.studentRa || '').includes(q) ||
                  (r.title || '').toLowerCase().includes(q)
                );
              })
              .map((req) => {
                const isApproved = req.status === 'approved';
                return (
                  <TouchableOpacity
                    key={req.id}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('RequirementDetail', { requirementId: req.id })}
                    style={[
                      styles.solvedReqCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderLeftColor: isApproved ? '#059669' : '#DC2626',
                      },
                    ]}
                  >
                    <View style={styles.solvedCardTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.solvedProtocolText, { color: colors.primary }]}>{req.protocol}</Text>
                        <View
                          style={[
                            styles.verdictBadge,
                            { backgroundColor: isApproved ? '#D1FAE5' : '#FEE2E2' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.verdictBadgeText,
                              { color: isApproved ? '#059669' : '#DC2626' },
                            ]}
                          >
                            {isApproved ? 'Deferido' : 'Indeferido / Concluído'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.solvedDateText, { color: colors.textMuted }]}>{req.updatedAt || req.createdAt}</Text>
                    </View>

                    <Text style={[styles.solvedTitleText, { color: colors.textPrimary }]}>{req.title}</Text>
                    <Text style={[styles.solvedStudentText, { color: colors.textSecondary }]}>
                      {req.studentName} (RA: {req.studentRa}) • {req.studentCourse || req.type}
                    </Text>

                    <View style={styles.solvedBottomRow}>
                      <Text style={[styles.solvedStageText, { color: colors.textMuted }]}>
                        Conclusão: {req.currentStage || 'Finalizado'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Text style={[styles.solvedLinkText, { color: colors.primary }]}>Ver Parecer</Text>
                        <ChevronRight size={13} color={colors.primary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
          </View>
        </View>

        {/* Resumo da Operação Presencial do Balcão */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Fila Presencial CAA & Chamada Nominal
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCallNextTicket}
              style={[styles.callNextSmallBtn, { backgroundColor: colors.primary }]}
            >
              <Bell size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.callNextSmallBtnText}>Chamar Próxima</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.queueSummaryBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.queueStatsRow}>
              <View style={styles.queueStatItem}>
                <Text style={[styles.queueStatVal, { color: '#059669' }]}>{inServiceCount}</Text>
                <Text style={[styles.queueStatLbl, { color: colors.textSecondary }]}>Em Atendimento</Text>
              </View>
              <View style={styles.queueStatItem}>
                <Text style={[styles.queueStatVal, { color: '#D97706' }]}>{waitingCount}</Text>
                <Text style={[styles.queueStatLbl, { color: colors.textSecondary }]}>Na Fila de Espera</Text>
              </View>
              <View style={styles.queueStatItem}>
                <Text style={[styles.queueStatVal, { color: colors.primary }]}>04</Text>
                <Text style={[styles.queueStatLbl, { color: colors.textSecondary }]}>Guichês Ativos</Text>
              </View>
            </View>
          </View>

          {/* Abas Alternáveis: Fila Ativa vs Senhas Concluídas */}
          <View style={[styles.tabSelectorContainer, { backgroundColor: colors.backgroundAlt, borderColor: colors.border, marginTop: 12 }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setQueueTab('active')}
              style={[
                styles.tabSelectorBtn,
                queueTab === 'active' && [styles.tabSelectorBtnActive, { backgroundColor: colors.card, borderColor: '#D97706' }],
              ]}
            >
              <Clock size={14} color={queueTab === 'active' ? '#D97706' : colors.textSecondary} />
              <Text
                style={[
                  styles.tabSelectorBtnText,
                  { color: queueTab === 'active' ? '#D97706' : colors.textSecondary },
                ]}
              >
                Fila Ativa ({queue.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setQueueTab('completed')}
              style={[
                styles.tabSelectorBtn,
                queueTab === 'completed' && [styles.tabSelectorBtnActive, { backgroundColor: colors.card, borderColor: '#059669' }],
              ]}
            >
              <CheckCircle2 size={14} color={queueTab === 'completed' ? '#059669' : colors.textSecondary} />
              <Text
                style={[
                  styles.tabSelectorBtnText,
                  { color: queueTab === 'completed' ? '#059669' : colors.textSecondary },
                ]}
              >
                Senhas Concluídas ({completedQueue.length})
              </Text>
            </TouchableOpacity>
          </View>

          {queueTab === 'active' ? (
            queue.length > 0 ? (
              <View style={{ marginTop: 12, gap: 10 }}>
                {queue.slice(0, 8).map((ticket) => {
                  const isCalled = ticket.status === 'called' || ticket.status === 'in_service';
                  return (
                    <View
                      key={ticket.id}
                      style={[
                        styles.ticketRowCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: isCalled ? '#059669' : colors.border,
                          borderLeftWidth: 4,
                          borderLeftColor: isCalled ? '#059669' : '#D97706',
                        },
                      ]}
                    >
                      <View style={styles.ticketCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ticket size={16} color={isCalled ? '#059669' : '#D97706'} />
                          <Text style={[styles.ticketCardNum, { color: colors.textPrimary }]}>
                            {ticket.ticket_number}
                          </Text>
                          <View
                            style={[
                              styles.ticketStatusTag,
                              { backgroundColor: isCalled ? '#D1FAE5' : '#FEF3C7' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.ticketStatusTagText,
                                { color: isCalled ? '#059669' : '#D97706' },
                              ]}
                            >
                              {isCalled ? (ticket.counter || 'Guichê 01') : 'Aguardando'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.ticketServiceTag, { color: colors.textSecondary }]}>
                          {ticket.service_type || 'Geral'}
                        </Text>
                      </View>

                      <View style={[styles.ticketStudentBlock, { backgroundColor: colors.backgroundAlt }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.ticketStudentTitle, { color: colors.textPrimary }]}>
                            {ticket.student_name || 'Estudante Alvarista'}
                          </Text>
                          <Text style={[styles.ticketStudentSubtitle, { color: colors.textSecondary }]}>
                            RA: {ticket.student_ra || '24026851'} • {ticket.student_course || 'Graduação'}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {isCalled && (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={async () => {
                                await queueService.completeTicket(ticket.id, ticket.student_ra || undefined);
                                showToast(`Atendimento da senha ${ticket.ticket_number} concluído!`, 'success');
                                loadData();
                              }}
                              style={[styles.viewStudentProfileBtn, { backgroundColor: '#D1FAE5' }]}
                            >
                              <CheckCircle2 size={13} color="#059669" style={{ marginRight: 4 }} />
                              <Text style={[styles.viewStudentProfileBtnText, { color: '#059669' }]}>Concluir</Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() =>
                              navigation.navigate('StudentFullProfile', {
                                ra: ticket.student_ra || '24026851',
                                student: {
                                  ra: ticket.student_ra || '24026851',
                                  name: ticket.student_name || 'Estudante Alvarista',
                                  course: ticket.student_course || 'Graduação FECAP',
                                  status: 'Ativo',
                                },
                              })
                            }
                            style={[styles.viewStudentProfileBtn, { backgroundColor: colors.primaryLight }]}
                          >
                            <User size={13} color={colors.primaryDark} style={{ marginRight: 4 }} />
                            <Text style={[styles.viewStudentProfileBtnText, { color: colors.primaryDark }]}>
                              Ver Perfil
                            </Text>
                            <ChevronRight size={14} color={colors.primaryDark} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
                <Ticket size={24} color={colors.textMuted} />
                <Text style={[styles.emptyBoxText, { color: colors.textSecondary }]}>
                  Nenhuma senha aguardando atendimento na fila presencial.
                </Text>
              </View>
            )
          ) : (
            completedQueue.length > 0 ? (
              <View style={{ marginTop: 12, gap: 10 }}>
                {completedQueue.slice(0, 15).map((ticket) => (
                  <View
                    key={ticket.id}
                    style={[
                      styles.ticketRowCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: '#059669',
                        borderLeftWidth: 4,
                        borderLeftColor: '#059669',
                      },
                    ]}
                  >
                    <View style={styles.ticketCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ticket size={16} color="#059669" />
                        <Text style={[styles.ticketCardNum, { color: colors.textPrimary }]}>
                          {ticket.ticket_number}
                        </Text>
                        <View style={[styles.ticketStatusTag, { backgroundColor: '#D1FAE5' }]}>
                          <Text style={[styles.ticketStatusTagText, { color: '#059669' }]}>
                            Concluído ({ticket.counter || 'Guichê CAA'})
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.ticketServiceTag, { color: colors.textSecondary }]}>
                        {ticket.service_type || 'Geral'}
                      </Text>
                    </View>

                    <View style={[styles.ticketStudentBlock, { backgroundColor: colors.backgroundAlt }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.ticketStudentTitle, { color: colors.textPrimary }]}>
                          {ticket.student_name || 'Estudante Alvarista'}
                        </Text>
                        <Text style={[styles.ticketStudentSubtitle, { color: colors.textSecondary }]}>
                          RA: {ticket.student_ra || '—'} • {ticket.completed_at ? new Date(ticket.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Finalizado'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
                <CheckCircle2 size={24} color={colors.textMuted} />
                <Text style={[styles.emptyBoxText, { color: colors.textSecondary }]}>
                  Nenhuma senha concluída registrada recentemente.
                </Text>
              </View>
            )
          )}
        </View>
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
  summaryBanner: {
    flexDirection: 'row',
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    alignItems: 'center',
  },
  summaryBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryBannerDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20,
  },
  kpiCard: {
    width: '48%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  liveAlertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  liveAlertBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tabSelectorContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 12,
    marginTop: 8,
    gap: 4,
  },
  tabSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabSelectorBtnActive: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabSelectorBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  liveChatRowCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
  },
  liveChatCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  liveChatStudentName: {
    fontSize: 13,
    fontWeight: '700',
  },
  liveChatStudentRa: {
    fontSize: 11,
  },
  liveChatStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveChatStatusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  liveChatPreview: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  liveChatActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 8,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  smallActionBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  openChatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  openChatActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  demandRow: {
    paddingVertical: 10,
  },
  demandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  demandRank: {
    fontSize: 12,
    fontWeight: '800',
    marginRight: 6,
  },
  demandName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  demandCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  queueSummaryBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  queueStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  queueStatItem: {
    alignItems: 'center',
  },
  queueStatVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  queueStatLbl: {
    fontSize: 11,
    marginTop: 4,
  },
  callNextSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  callNextSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  ticketRowCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketCardNum: {
    fontSize: 16,
    fontWeight: '800',
  },
  ticketStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ticketStatusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ticketServiceTag: {
    fontSize: 11,
    fontWeight: '500',
  },
  ticketStudentBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  ticketStudentTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  ticketStudentSubtitle: {
    fontSize: 10,
    marginTop: 1,
  },
  viewStudentProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewStudentProfileBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  csatOverviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  csatCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  csatIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  csatCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  csatCardSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  csatScoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  csatScoreBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D97706',
  },
  csatChannelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  csatChannelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  csatChannelName: {
    fontSize: 11,
  },
  csatChannelRating: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  csatEmptyBox: {
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  emptyBox: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyBoxText: {
    fontSize: 13,
    textAlign: 'center',
  },
  sixKpiSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sixKpiHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  sixKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sixKpiCard: {
    width: '48.5%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  kpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  sixKpiVal: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  sixKpiLbl: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  sixKpiSub: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  solvedSearchBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  solvedSearchInput: {
    fontSize: 12,
  },
  solvedReqCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
  },
  solvedCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  solvedProtocolText: {
    fontSize: 12,
    fontWeight: '800',
  },
  verdictBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verdictBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  solvedDateText: {
    fontSize: 10,
  },
  solvedTitleText: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  solvedStudentText: {
    fontSize: 11,
    marginBottom: 6,
  },
  solvedBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    paddingTop: 6,
  },
  solvedStageText: {
    fontSize: 10,
  },
  solvedLinkText: {
    fontSize: 11,
    fontWeight: '700',
  },
});