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
  Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  Bell,
  Clock,
  Users,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  FileText,
  Building2,
  Sparkles,
  Bot,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  Megaphone,
  Edit3,
  ChevronRight,
  Lock,
  Headphones,
  UserCheck,
  MessageSquare,
  Eye,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { useAuth } from '../../../store/AuthContext';
import { useApp } from '../../../store/AppContext';
import { queueService, QueueTicket } from '../../../services/supabase/queueService';
import {
  requirementsService,
  EnrichedRequirement,
} from '../../../services/supabase/requirementsService';
import { DocumentUploadModal } from '../../../components/admin/DocumentUploadModal';
import { CreateNoticeModal } from '../../../components/admin/CreateNoticeModal';
import { EditNoticeModal } from '../../../components/admin/EditNoticeModal';
import { CompleteTicketModal } from '../../../components/admin/CompleteTicketModal';
import { NoticeStudentPreviewModal } from '../../../components/admin/NoticeStudentPreviewModal';
import { noticesService, FullNoticeItem } from '../../../services/supabase/noticesService';
import { liveChatService, LiveSupportSession } from '../../../services/supabase/liveChatService';
import { FadeInView, ScalePressable } from '../../../components/common/AnimatedComponents';

export const StaffDashboard: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useApp();

  // Fila Presencial Realtime
  const [currentTicket, setCurrentTicket] = useState<QueueTicket | null>(null);
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [queueLoading, setQueueLoading] = useState(false);

  // Requerimentos Operacionais
  const [requirements, setRequirements] = useState<EnrichedRequirement[]>([]);
  const [reqsLoading, setReqsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'Todos' | 'Urgente' | 'Secretaria' | 'Financeiro' | 'Coordenação'>('Todos');

  // Avisos para Alunos (Mural)
  const [noticesList, setNoticesList] = useState<FullNoticeItem[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [noticeModalVisible, setNoticeModalVisible] = useState(false);
  const [editNoticeModalVisible, setEditNoticeModalVisible] = useState(false);
  const [selectedNoticeToEdit, setSelectedNoticeToEdit] = useState<FullNoticeItem | null>(null);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [previewNotice, setPreviewNotice] = useState<FullNoticeItem | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  // Modais
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liveSessions, setLiveSessions] = useState<LiveSupportSession[]>([]);

  // 1. Carregamento e sincronização da fila presencial com Supabase Realtime
  const loadQueue = async () => {
    try {
      const ticket = await queueService.getCurrentTicket();
      const waiting = await queueService.getWaitingTicketsCount();
      setCurrentTicket(ticket);
      setWaitingCount(waiting);
    } catch (e) {
      console.warn('Erro ao carregar fila:', e);
    }
  };

  // 2. Carregamento dos requerimentos de alunos
  const loadRequirements = async () => {
    setReqsLoading(true);
    try {
      const data = await requirementsService.getRequirements();
      setRequirements(data);
    } catch (e) {
      console.warn('Erro ao carregar requerimentos:', e);
    } finally {
      setReqsLoading(false);
    }
  };

  // 3. Carregamento dos avisos transmitidos para alunos
  const loadLiveSessions = async () => {
    try {
      const list = await liveChatService.getStaffQueue();
      setLiveSessions(list);
    } catch (e) {
      console.warn('Erro ao carregar chat ao vivo:', e);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadQueue(),
        loadRequirements(),
        loadNotices(),
        loadLiveSessions(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const loadNotices = async () => {
    setNoticesLoading(true);
    try {
      const data = await noticesService.getNotices();
      setNoticesList(data);
    } catch (e) {
      console.warn('Erro ao carregar avisos:', e);
    } finally {
      setNoticesLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    loadRequirements();
    loadNotices();
    loadLiveSessions();

    // Assina atualizações em tempo real do painel físico
    const unsubscribeQueue = queueService.subscribeToQueue((freshQueue) => {
      const called = freshQueue.find((t) => t.status === 'called' || t.status === 'in_service');
      const waiting = freshQueue.filter((t) => t.status === 'waiting').length;
      setCurrentTicket(called || freshQueue[0] || null);
      setWaitingCount(waiting);
      showToast('Painel físico atualizado em tempo real!', 'info');
    });

    // Assina atualizações de avisos em tempo real
    const unsubscribeNotices = noticesService.subscribeToNotices((freshNotices) => {
      setNoticesList(freshNotices);
    });

    const unsubscribeLive = liveChatService.subscribeToStaffQueue(() => {
      loadLiveSessions();
    });

    return () => {
      if (unsubscribeQueue) unsubscribeQueue();
      if (unsubscribeNotices) unsubscribeNotices();
      if (unsubscribeLive) unsubscribeLive();
    };
  }, []);

  // Recarrega requerimentos sempre que o funcionário voltar para esta tela
  useFocusEffect(
    useCallback(() => {
      loadRequirements();
      loadLiveSessions();
    }, [])
  );

  // Chamar próxima senha presencial
  const handleCallNextTicket = async () => {
    setQueueLoading(true);
    try {
      const called = await queueService.callNextTicket('Guichê 02');
      if (called) {
        setCurrentTicket(called);
        await loadQueue();
        showToast(`Senha ${called.ticket_number} chamada para o ${called.counter}!`, 'success');
      } else {
        showToast('Não há senhas aguardando na fila no momento.', 'info');
      }
    } catch (e) {
      showToast('Erro ao chamar próxima senha.', 'error');
    } finally {
      setQueueLoading(false);
    }
  };

  // Gerar nova senha rápida
  const handleGenerateTicket = async (type = 'Geral') => {
    try {
      const t = await queueService.generateTicket(type);
      showToast(`Nova senha emitida: ${t.ticket_number} (${type})`, 'success');
      loadQueue();
    } catch (e: any) {
      showToast(e?.message || 'Fora do horário de expediente do CAA.', 'info');
    }
  };

  // Concluir atendimento da senha chamada atual
  const handleCompleteCurrentTicket = async () => {
    if (!currentTicket) return;
    setQueueLoading(true);
    try {
      await queueService.completeTicket(currentTicket.id, currentTicket.student_ra || undefined);
      showToast(`Atendimento da senha ${currentTicket.ticket_number} finalizado!`, 'success');
      setCurrentTicket(null);
      await loadQueue();
    } catch {
      showToast('Erro ao concluir atendimento da senha.', 'error');
    } finally {
      setQueueLoading(false);
    }
  };

  // Requerimentos em aberto / triagem (concluídos e deferidos vão para a Central CAA)
  const openRequirements = requirements.filter(
    (req) => req.status === 'pending' || req.status === 'in_progress'
  );

  // Filtro de requerimentos
  const filteredRequirements = openRequirements.filter((req) => {
    const matchesSearch =
      (req.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.studentRa || '').includes(searchQuery) ||
      (req.protocol || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.title || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedFilter === 'Todos') return true;
    if (selectedFilter === 'Urgente') return req.attentionLevel === 'Urgente';
    if (selectedFilter === 'Financeiro') return (req.departmentDirection || '').includes('Financeiro');
    if (selectedFilter === 'Secretaria') return (req.departmentDirection || '').includes('Secretaria');
    if (selectedFilter === 'Coordenação') return (req.departmentDirection || '').includes('Coordenação');

    return true;
  });

  const handleConfirmCompletion = async (data: { outcome: string; topics: string[]; summary: string }) => {
    if (!currentTicket) return;
    setQueueLoading(true);
    try {
      await queueService.completeTicket(currentTicket.id, currentTicket.student_ra || undefined, {
        ...data,
        staffName: user?.name,
      });
      showToast(`Atendimento da senha ${currentTicket.ticket_number} finalizado com registro de parecer!`, 'success');
      setCurrentTicket(null);
      await loadQueue();
    } catch {
      showToast('Erro ao concluir atendimento da senha.', 'error');
    } finally {
      setQueueLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        {/* Header Operacional */}
        <View style={[styles.headerContainer, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: topPadding + spacing.sm }]}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <View style={[styles.onlineBadge, { backgroundColor: '#D1FAE5' }]}>
                <View style={[styles.onlineDot, { backgroundColor: '#059669' }]} />
                <Text style={[styles.onlineText, { color: '#059669' }]}>OPERACIONAL • BALCÃO ASA</Text>
              </View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                Olá, {user?.name || 'Fernanda Santos'}
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Central de Triagem, Requerimentos & Painel Físico
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AIChat')}
              style={[styles.aiDirectBtn, { backgroundColor: colors.primary }]}
            >
              <Bot size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Widget do Painel Físico de Senhas em Tempo Real */}
          <View style={[styles.ticketPanelCard, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
            <View style={styles.ticketPanelHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Clock size={16} color={colors.primary} />
                <Text style={[styles.ticketPanelTitle, { color: colors.textPrimary }]}>
                  Painel Físico de Senhas (ASA Presencial)
                </Text>
              </View>
              <View style={[styles.livePill, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#D1FAE5' }]}>
                <View style={styles.livePulseDot} />
                <Text style={styles.livePillText}>AO VIVO</Text>
              </View>
            </View>

            <View style={styles.ticketMainRow}>
              <View style={styles.currentTicketCol}>
                <Text style={[styles.currentTicketLabel, { color: colors.textSecondary }]}>SENHA CHAMADA ATUAL</Text>
                <Text style={[styles.currentTicketNumber, { color: colors.primary }]}>
                  {currentTicket?.ticket_number || '—'}
                </Text>
                <Text style={[styles.currentTicketCounter, { color: colors.textPrimary }]}>
                  {currentTicket
                    ? `${currentTicket.counter || 'Guichê 01'} • ${currentTicket.service_type || 'Geral'}`
                    : 'Sem senha ativa no painel'}
                </Text>
                {currentTicket?.student_name ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.navigate('StudentFullProfile', {
                        ra: currentTicket.student_ra || '24026851',
                        student: {
                          ra: currentTicket.student_ra,
                          name: currentTicket.student_name,
                          course: currentTicket.student_course,
                        },
                      })
                    }
                    style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                      👤 {currentTicket.student_name} ({currentTicket.student_ra}) ➔ Perfil
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.ticketActionsCol}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={queueLoading}
                  onPress={handleCallNextTicket}
                  style={[styles.callNextBtn, { backgroundColor: colors.primary }]}
                >
                  <Bell size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.callNextBtnText}>Chamar Próxima</Text>
                </TouchableOpacity>

                {currentTicket && (currentTicket.status === 'called' || currentTicket.status === 'in_service') ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={queueLoading}
                    onPress={handleCompleteCurrentTicket}
                    style={[styles.newTicketBtn, { borderColor: '#059669', backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#D1FAE5' }]}
                  >
                    <CheckCircle2 size={14} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={[styles.newTicketBtnText, { color: '#059669', fontWeight: '700' }]}>Concluir Senha</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleGenerateTicket('Geral')}
                    style={[styles.newTicketBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                  >
                    <PlusCircle size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.newTicketBtnText, { color: colors.textSecondary }]}>Emitir Senha</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={[styles.ticketFooterRow, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.waitingQueueText, { color: colors.textSecondary }]}>
                ⏳ <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{waitingCount} alunos</Text> na fila de espera
              </Text>
              <Text style={[styles.counterStatusText, { color: '#059669' }]}>
                ● 4 guichês operando
              </Text>
            </View>
          </View>
        </View>

        
        {/* Atendimentos ao Vivo CAA (Chat com Alunos) */}
        <View style={styles.liveChatSection}>
          <View style={styles.liveChatHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Headphones size={18} color={colors.primary} />
              <Text style={[styles.sectionHeading, { color: colors.textPrimary, marginBottom: 0 }]}>
                Atendimentos ao Vivo CAA ({liveSessions.length})
              </Text>
            </View>
            <View style={[styles.waitingLiveBadge, { backgroundColor: liveSessions.length > 0 ? '#FEF3C7' : '#D1FAE5' }]}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: liveSessions.length > 0 ? '#D97706' : '#059669' }}>
                {liveSessions.length > 0 ? `${liveSessions.length} em espera / ativo` : 'Fila Zerada'}
              </Text>
            </View>
          </View>
          <Text style={[styles.liveChatSubtitle, { color: colors.textSecondary }]}>
            Alunos transferidos pela SISA aguardando resposta de funcionário em chat individual
          </Text>

          {liveSessions.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 6 }}>
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
                      styles.liveSessionCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: isWaiting ? '#D97706' : isMySession ? '#059669' : colors.border,
                        borderLeftColor: isWaiting ? '#D97706' : isMySession ? '#059669' : '#94A3B8',
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={[styles.liveSessionName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {s.studentName}
                      </Text>
                      <View
                        style={[
                          styles.liveSessionStatusTag,
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
                            gap: 3,
                          },
                        ]}
                      >
                        {isLockedByOther && <Lock size={8} color="#64748B" />}
                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight: '700',
                            color: isWaiting
                              ? '#D97706'
                              : isMySession
                              ? '#059669'
                              : '#64748B',
                          }}
                        >
                          {isWaiting
                            ? 'Aguardando'
                            : isMySession
                            ? 'Seu Chamado'
                            : `Com ${s.assignedStaffName?.split(' ')[0] || 'Colega'}`}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.liveSessionRa, { color: colors.textSecondary }]}>
                      RA: {s.studentRa}
                    </Text>
                    <Text style={[styles.liveSessionPreview, { color: colors.textMuted }]} numberOfLines={2}>
                      💬 {s.lastMessagePreview || 'Solicitação de suporte'}
                    </Text>

                    {isLockedByOther ? (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() =>
                          showToast(
                            `Chamado em atendimento com ${s.assignedStaffName || 'outro atendente'}. Escolha outro aluno na fila.`,
                            'info'
                          )
                        }
                        style={[
                          styles.liveSessionJoinBtn,
                          { backgroundColor: isDark ? '#334155' : '#E2E8F0', opacity: 0.85 },
                        ]}
                      >
                        <Lock size={12} color="#64748B" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700' }}>
                          Em Atendimento
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
                          styles.liveSessionJoinBtn,
                          { backgroundColor: isWaiting ? '#7C3AED' : '#059669' },
                        ]}
                      >
                        {isWaiting ? (
                          <UserCheck size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        ) : (
                          <MessageSquare size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        )}
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                          {isWaiting ? 'Atender Aluno' : 'Continuar Chat'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={[styles.emptyLiveChatBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Nenhum estudante na fila de atendimento ao vivo no momento.
              </Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.navigate('CAAManagement')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
              Ver Histórico Completo de Atendimentos no CAA
            </Text>
            <ChevronRight size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* 4 Módulos Especializados (Acesso Rápido) */}
        <View style={styles.modulesSection}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Módulos Estratégicos & Consultas</Text>

          <View style={styles.modulesGrid}>
            {/* 1. Classificação de Fragilidade (Score 4D) */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('StudentRisk')}
              style={[styles.moduleCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: '#DC2626' }]}
            >
              <View style={[styles.moduleIconBox, { backgroundColor: isDark ? 'rgba(220,38,38,0.2)' : '#FEE2E2' }]}>
                <ShieldAlert size={22} color="#DC2626" />
              </View>
              <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>Classificação 4D</Text>
              <Text style={[styles.moduleDesc, { color: colors.textSecondary }]}>
                Scores multidimensionais de permanência e risco
              </Text>
              <View style={styles.moduleArrowRow}>
                <Text style={[styles.moduleLink, { color: '#DC2626' }]}>Ver Alunos</Text>
                <ArrowRight size={14} color="#DC2626" />
              </View>
            </TouchableOpacity>

            {/* 2. Consulta Base Geral */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('StudentSearch')}
              style={[styles.moduleCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.primary }]}
            >
              <View style={[styles.moduleIconBox, { backgroundColor: colors.primaryLight }]}>
                <Users size={22} color={colors.primary} />
              </View>
              <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>Base Geral (392)</Text>
              <Text style={[styles.moduleDesc, { color: colors.textSecondary }]}>
                Ativos, Formados e Evadidos com histórico
              </Text>
              <View style={styles.moduleArrowRow}>
                <Text style={[styles.moduleLink, { color: colors.primary }]}>Consultar Base</Text>
                <ArrowRight size={14} color={colors.primary} />
              </View>
            </TouchableOpacity>

            {/* 3. Central de Gestão CAA */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('CAAManagement')}
              style={[styles.moduleCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.secondary }]}
            >
              <View style={[styles.moduleIconBox, { backgroundColor: colors.secondaryLight }]}>
                <Building2 size={22} color={colors.secondary} />
              </View>
              <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>Central CAA</Text>
              <Text style={[styles.moduleDesc, { color: colors.textSecondary }]}>
                Métricas de demandas, SLA e volumetria
              </Text>
              <View style={styles.moduleArrowRow}>
                <Text style={[styles.moduleLink, { color: colors.secondary }]}>Painel Analítico</Text>
                <ArrowRight size={14} color={colors.secondary} />
              </View>
            </TouchableOpacity>

            {/* 4. Base RAG & Upload de PDFs */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setUploadModalVisible(true)}
              style={[styles.moduleCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: '#0284C7' }]}
            >
              <View style={[styles.moduleIconBox, { backgroundColor: isDark ? 'rgba(2,132,199,0.2)' : '#E0F2FE' }]}>
                <UploadCloud size={22} color="#0284C7" />
              </View>
              <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>Upload RAG</Text>
              <Text style={[styles.moduleDesc, { color: colors.textSecondary }]}>
                Indexar novos PDFs no SISA em runtime
              </Text>
              <View style={styles.moduleArrowRow}>
                <Text style={[styles.moduleLink, { color: '#0284C7' }]}>Novo Documento</Text>
                <ArrowRight size={14} color="#0284C7" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Gestão e Lançamento de Avisos no Mural do Aluno */}
        <FadeInView delay={100} translateY={12}>
          <View style={styles.noticesSection}>
            <View style={styles.noticesHeaderRow}>
              <View style={styles.noticesTitleCol}>
                <View style={styles.noticesTitleLine}>
                  <Megaphone size={18} color={colors.primary} />
                  <Text style={[styles.noticesHeadingText, { color: colors.textPrimary }]}>
                    Mural de Avisos para Estudantes ({noticesList.length})
                  </Text>
                </View>
                <Text style={[styles.noticesSubText, { color: colors.textSecondary }]}>
                  Transmita comunicados, imagens, prazos e informativos institucionais
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setNoticeModalVisible(true)}
                style={[styles.publishNoticeBtn, { backgroundColor: colors.primary }]}
              >
                <PlusCircle size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.publishNoticeBtnText}>Novo Aviso</Text>
              </TouchableOpacity>
            </View>

            {/* Cards de Avisos Ativos em Carrossel / Lista */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.noticesCardsRow}
            >
              {noticesList.slice(0, 8).map((item) => (
                <View
                  key={item.id}
                  style={[styles.staffNoticeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.staffNoticeImage}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.staffNoticeTopRow}>
                    <View style={[styles.staffNoticeBadge, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.staffNoticeBadgeText, { color: colors.primaryDark }]}>
                        {item.badge || item.category}
                      </Text>
                    </View>
                    <Text style={[styles.staffNoticeDate, { color: colors.textMuted }]}>{item.date}</Text>
                  </View>
                  <Text style={[styles.staffNoticeTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.staffNoticeSummary, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.summary}
                  </Text>

                  {/* Público-Alvo / Destinatário */}
                  <View style={[styles.audienceTagRow, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                    <Users size={11} color={colors.primary} />
                    <Text style={[styles.audienceTagText, { color: colors.textSecondary }]} numberOfLines={1}>
                      Público: {item.target_audience || 'Todos os Alunos'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setPreviewNotice(item);
                        setPreviewModalVisible(true);
                      }}
                      style={[
                        styles.staffNoticeEditBtn,
                        { backgroundColor: colors.primaryLight, borderColor: colors.primary, flex: 1 },
                      ]}
                    >
                      <Eye size={13} color={colors.primaryDark} />
                      <Text style={[styles.staffNoticeEditBtnText, { color: colors.primaryDark }]}>
                        Visão do Aluno
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedNoticeToEdit(item);
                        setEditNoticeModalVisible(true);
                      }}
                      style={[
                        styles.staffNoticeEditBtn,
                        { backgroundColor: colors.backgroundAlt, borderColor: colors.border, flex: 1 },
                      ]}
                    >
                      <Edit3 size={13} color={colors.textSecondary} />
                      <Text style={[styles.staffNoticeEditBtnText, { color: colors.textSecondary }]}>
                        Editar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </FadeInView>

        {/* Gestão Operacional de Requerimentos de Alunos */}
        <View style={styles.requirementsSection}>
          <View style={styles.reqHeaderRow}>
            <View>
              <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                Requerimentos Abertos em Triagem ({filteredRequirements.length})
              </Text>
              <Text style={[styles.reqSubtitle, { color: colors.textSecondary }]}>
                Demandas registradas por alunos para despacho, status e comentários
              </Text>
            </View>
            <TouchableOpacity onPress={loadRequirements} style={styles.reloadBtn}>
              <RefreshCw size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Busca e Filtros */}
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Search size={16} color={colors.textMuted} />
            <TextInput
              placeholder="Buscar por Aluno, RA ou Protocolo..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Chips de Filtro */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {(['Todos', 'Urgente', 'Secretaria', 'Financeiro', 'Coordenação'] as const).map((chip) => {
              const isSel = selectedFilter === chip;
              return (
                <TouchableOpacity
                  key={chip}
                  onPress={() => setSelectedFilter(chip)}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    isSel && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.textSecondary }, isSel && { color: '#FFFFFF', fontWeight: '700' }]}>
                    {chip}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Lista de Requerimentos */}
          {reqsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando protocolos...</Text>
            </View>
          ) : filteredRequirements.length === 0 ? (
            <View style={[styles.emptyReqBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <FileText size={32} color={colors.textMuted} />
              <Text style={[styles.emptyReqTitle, { color: colors.textPrimary }]}>Nenhum requerimento encontrado</Text>
              <Text style={[styles.emptyReqDesc, { color: colors.textSecondary }]}>
                Tente ajustar os termos de busca ou o filtro de setor.
              </Text>
            </View>
          ) : (
            filteredRequirements.map((req) => {
              const isUrgent = req.attentionLevel === 'Urgente';

              return (
                <TouchableOpacity
                  key={req.id}
                  activeOpacity={0.88}
                  onPress={() => navigation.navigate('RequirementDetail', { requirement: req })}
                  style={[
                    styles.reqCard,
                    { backgroundColor: colors.card, borderColor: isUrgent ? 'rgba(220,38,38,0.5)' : colors.border },
                  ]}
                >
                  {/* Top do Card: Protocolo, Nível de Atenção e Indicador de Navegação */}
                  <View style={styles.reqCardTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View style={styles.reqProtocolBadge}>
                        <Text style={styles.reqProtocolText}>{req.protocol}</Text>
                      </View>

                      {isUrgent ? (
                        <View style={[styles.attentionBadge, { backgroundColor: isDark ? 'rgba(220,38,38,0.2)' : '#FEE2E2' }]}>
                          <AlertTriangle size={12} color="#DC2626" />
                          <Text style={[styles.attentionText, { color: '#DC2626' }]}>Atenção Prioritária</Text>
                        </View>
                      ) : (
                        <View style={[styles.attentionBadge, { backgroundColor: colors.backgroundAlt }]}>
                          <Text style={[styles.attentionText, { color: colors.textSecondary }]}>Triagem Regular</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Ver Detalhes</Text>
                      <ChevronRight size={16} color={colors.primary} />
                    </View>
                  </View>

                  {/* Informações do Aluno */}
                  <View style={styles.reqStudentInfo}>
                    <Text style={[styles.reqStudentName, { color: colors.textPrimary }]}>
                      {req.studentName}
                    </Text>
                    <Text style={[styles.reqStudentMeta, { color: colors.textSecondary }]}>
                      RA: {req.studentRa} • {req.studentCourse}
                    </Text>
                  </View>

                  {/* Título da Demanda e Etapa */}
                  <View style={[styles.reqDemandBox, { backgroundColor: colors.backgroundAlt }]}>
                    <Text style={[styles.reqDemandTitle, { color: colors.textPrimary }]}>
                      📌 {req.title}
                    </Text>
                    <Text style={[styles.reqStageText, { color: colors.primaryDark }]}>
                      Etapa atual: <Text style={{ fontWeight: '700' }}>{req.currentStage}</Text>
                    </Text>
                  </View>

                  {/* Direcionamento Cabível */}
                  <View style={styles.directionRow}>
                    <Text style={[styles.directionLabel, { color: colors.textMuted }]}>Direcionamento:</Text>
                    <View style={[styles.directionBadge, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.directionText, { color: colors.primaryDark }]}>
                        {req.departmentDirection}
                      </Text>
                    </View>
                  </View>

                  {/* Ações: Despachar / Consultar IA */}
                  <View style={[styles.reqActionsRow, { borderTopColor: colors.borderLight }]}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate('RequirementDetail', { requirement: req })}
                      style={[styles.dispatchBtn, { backgroundColor: colors.primary }]}
                    >
                      <Text style={styles.dispatchBtnText}>Atualizar Status & Comentar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate('AIChat', {
                        initialPrompt: `Análise do requerimento ${req.protocol} do aluno ${req.studentName} RA ${req.studentRa}`
                      })}
                      style={[styles.aiQueryBtn, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}
                    >
                      <Bot size={14} color={colors.primaryDark} style={{ marginRight: 4 }} />
                      <Text style={[styles.aiQueryBtnText, { color: colors.primaryDark }]}>Consultar IA</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modal de Upload de PDFs RAG */}
      <DocumentUploadModal
        visible={uploadModalVisible}
        onClose={() => setUploadModalVisible(false)}
        onSuccess={() => {
          showToast('Documento adicionado ao acervo com sucesso!', 'success');
        }}
      />

      {/* Modal de Publicação de Avisos para Alunos */}
      <CreateNoticeModal
        visible={noticeModalVisible}
        onClose={() => setNoticeModalVisible(false)}
        onSuccess={() => {
          loadNotices();
        }}
      />

      {/* Modal de Edição e Exclusão de Avisos para Alunos */}
      <EditNoticeModal
        visible={editNoticeModalVisible}
        notice={selectedNoticeToEdit}
        onClose={() => {
          setEditNoticeModalVisible(false);
          setSelectedNoticeToEdit(null);
        }}
        onSuccess={() => {
          loadNotices();
        }}
        onDeleted={() => {
          loadNotices();
        }}
      />
      {/* Modal de Conclusão de Atendimento Presencial */}
      <CompleteTicketModal
        visible={completeModalVisible}
        ticket={currentTicket}
        onClose={() => setCompleteModalVisible(false)}
        onConfirm={handleConfirmCompletion}
      />

      {/* Modal de Pré-visualização na Visão do Aluno */}
      <NoticeStudentPreviewModal
        visible={previewModalVisible}
        notice={previewNotice}
        onClose={() => {
          setPreviewModalVisible(false);
          setPreviewNotice(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  aiDirectBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ticketPanelCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
  },
  ticketPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ticketPanelTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  livePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  ticketMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  currentTicketCol: {
    flex: 1,
  },
  currentTicketLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  currentTicketNumber: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
    marginVertical: 2,
  },
  currentTicketCounter: {
    fontSize: 11,
    fontWeight: '600',
  },
  ticketActionsCol: {
    gap: 6,
  },
  callNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  callNextBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  newTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  newTicketBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ticketFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  waitingQueueText: {
    fontSize: 11,
  },
  counterStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  modulesSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleCard: {
    width: '48%',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  moduleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  moduleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  moduleDesc: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
    minHeight: 28,
  },
  moduleArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  moduleLink: {
    fontSize: 10,
    fontWeight: '700',
  },
  noticesSection: {
    paddingTop: 22,
    paddingBottom: 6,
  },
  noticesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  noticesTitleCol: {
    flex: 1,
  },
  noticesTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  noticesHeadingText: {
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
  },
  noticesSubText: {
    fontSize: 11,
    lineHeight: 15,
  },
  publishNoticeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flexShrink: 0,
  },
  publishNoticeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  noticesCardsRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 12,
  },
  staffNoticeCard: {
    width: 255,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  staffNoticeImage: {
    width: '100%',
    height: 110,
    borderRadius: 8,
    marginBottom: 8,
  },
  staffNoticeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  staffNoticeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  staffNoticeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  staffNoticeDate: {
    fontSize: 10,
  },
  staffNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  staffNoticeSummary: {
    fontSize: 11,
    lineHeight: 15,
  },
  audienceTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 6,
  },
  audienceTagText: {
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
  },
  staffNoticeEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  staffNoticeEditBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  requirementsSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  reqHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reqSubtitle: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  reloadBtn: {
    padding: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 11,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
  },
  emptyReqBox: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  emptyReqTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyReqDesc: {
    fontSize: 11,
    textAlign: 'center',
  },
  reqCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
  },
  reqCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reqProtocolBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reqProtocolText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  attentionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 4,
  },
  attentionText: {
    fontSize: 9,
    fontWeight: '700',
  },
  reqStudentInfo: {
    marginBottom: 8,
  },
  reqStudentName: {
    fontSize: 14,
    fontWeight: '700',
  },
  reqStudentMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  reqDemandBox: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  reqDemandTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  reqStageText: {
    fontSize: 11,
    marginTop: 2,
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  directionLabel: {
    fontSize: 11,
  },
  directionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  directionText: {
    fontSize: 10,
    fontWeight: '700',
  },
  reqActionsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  dispatchBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  dispatchBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  aiQueryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  aiQueryBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  liveChatSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  liveChatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  waitingLiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveChatSubtitle: {
    fontSize: 11,
    marginBottom: 10,
  },
  liveSessionCard: {
    width: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
  },
  liveSessionName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  liveSessionStatusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveSessionRa: {
    fontSize: 10,
    marginBottom: 4,
  },
  liveSessionPreview: {
    fontSize: 11,
    lineHeight: 15,
    minHeight: 30,
    marginBottom: 8,
  },
  liveSessionJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  emptyLiveChatBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  scheduleStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  seeSolvedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  seeSolvedBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
});