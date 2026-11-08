import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Sparkles,
  Search,
  Bell,
  Headphones,
  PlusCircle,
  GraduationCap,
  ChevronRight,
  FileText,
  Ticket,
  Clock,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { spacing, typography, borderRadius } from '../../../theme';
import { QUICK_ACTIONS, Requirement } from '../../../utils/constants';
import { QuickActionCard } from '../../../components/cards/QuickActionCard';
import { RequirementCard } from '../../../components/cards/RequirementCard';
import { BannerCarousel } from '../../../components/cards/BannerCarousel';
import { FadeInView, ScalePressable } from '../../../components/common/AnimatedComponents';
import { useAuth } from '../../../store/AuthContext';
import { useApp } from '../../../store/AppContext';
import { isNoticeRelevantForStudent, FullNoticeItem } from '../../../services/supabase/noticesService';
import { RequirementDetailModal } from '../RequirementDetailModal';
import { NotificationsModal } from '../../../components/modals/NotificationsModal';
import { ManualRequirementModal } from '../../../components/modals/ManualRequirementModal';
import safeStorage from '../../../utils/safeStorage';
import { supabase, isSupabaseConfigured } from '../../../services/supabase/supabaseClient';
import { pushNotificationService } from '../../../services/notifications/pushNotificationService';
import { queueService, QueueTicket } from '../../../services/supabase/queueService';

export const StudentDashboard: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0
  );
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { requirements, notices, showToast, refreshData, isLoadingData } = useApp();

  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [manualReqVisible, setManualReqVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [hasLoadedReadIds, setHasLoadedReadIds] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [queueBoard, setQueueBoard] = useState<QueueTicket[]>([]);
  const [myActiveTicket, setMyActiveTicket] = useState<QueueTicket | null>(null);

  const studentNotices = useMemo(() => {
    const relevant = notices.filter((n) => isNoticeRelevantForStudent(n as FullNoticeItem, user));
    return relevant.length > 0 ? relevant : notices;
  }, [notices, user]);

  const readStorageKey = useMemo(() => {
    const keySuffix = String(user?.ra || user?.id || 'default').trim().toLowerCase();
    return `@asa_read_notifications_v2_${keySuffix}`;
  }, [user?.ra, user?.id]);

  
  // T5 & Item 12: Polling a cada ~10s do painel geral da fila (queue_board) e senha do próprio aluno
  useEffect(() => {
    let active = true;
    const fetchQueue = async () => {
      try {
        const boardPromise = queueService.getQueueBoard();
        const ticketPromise = user?.ra
          ? queueService.getStudentActiveTicket(user.ra)
          : Promise.resolve(null);
        const [board, ticket] = await Promise.all([boardPromise, ticketPromise]);
        if (!active) return;
        setQueueBoard(board);
        setMyActiveTicket(ticket);
      } catch (e) {
        console.warn('Erro ao carregar fila no StudentDashboard:', e);
      }
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user?.ra]);

  // Carrega notificações já visualizadas pelo aluno (persistência local + sincronia opcional no Supabase)
  useEffect(() => {
    let mounted = true;
    async function loadReadNotifications() {
      try {
        const localRaw = await safeStorage.getItem(readStorageKey);
        const localIds: string[] = localRaw ? JSON.parse(localRaw) : [];
        let remoteIds: string[] = [];

        if (isSupabaseConfigured && user?.ra) {
          const { data } = await supabase
            .from('profiles')
            .select('read_notifications')
            .eq('ra', String(user.ra).trim())
            .maybeSingle();
          if (Array.isArray(data?.read_notifications)) {
            remoteIds = data.read_notifications;
          }
        }

        const merged = Array.from(new Set([...localIds, ...remoteIds]));
        if (mounted) {
          setReadNotificationIds(merged);
          setHasLoadedReadIds(true);
        }
        if (merged.length !== localIds.length) {
          await safeStorage.setItem(readStorageKey, JSON.stringify(merged));
        }
      } catch {
        if (mounted) setHasLoadedReadIds(true);
      }
    }
    loadReadNotifications();
    return () => {
      mounted = false;
    };
  }, [readStorageKey, user?.ra]);

  const persistReadIds = useCallback(
    (nextIds: string[]) => {
      safeStorage.setItem(readStorageKey, JSON.stringify(nextIds)).catch(() => {});
      if (isSupabaseConfigured && user?.ra) {
        supabase
          .from('profiles')
          .update({ read_notifications: nextIds })
          .eq('ra', String(user.ra).trim())
          .then(() => {}, () => {});
      }
    },
    [readStorageKey, user?.ra]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  // Filtra apenas os requerimentos do aluno logado
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

  // Monitora novas atualizações em tempo real para emitir notificação de sistema quando não houver push remoto ativo
  const realtimeSnapshotRef = useRef<{
    initialized: boolean;
    reqMap: Map<string, string>;
    noticeIds: Set<string>;
  }>({
    initialized: false,
    reqMap: new Map(),
    noticeIds: new Set(),
  });

  useEffect(() => {
    if (isLoadingData) return;

    const currentReqMap = new Map<string, string>();
    studentRequirements.forEach((req) => {
      const lastCommentId = req.comments && req.comments.length > 0 ? req.comments[req.comments.length - 1].id : '';
      const staffAttCount = req.staffAttachments?.length || 0;
      currentReqMap.set(req.id, `${req.status}|${req.currentStage}|${lastCommentId}|${staffAttCount}`);
    });
    const currentNoticeIds = new Set(notices.map((n) => n.id));

    if (!realtimeSnapshotRef.current.initialized) {
      realtimeSnapshotRef.current = {
        initialized: true,
        reqMap: currentReqMap,
        noticeIds: currentNoticeIds,
      };
      return;
    }

    const prevReqMap = realtimeSnapshotRef.current.reqMap;
    const prevNoticeIds = realtimeSnapshotRef.current.noticeIds;

    safeStorage.getItem('@asa_expo_push_token_v1').then((hasRemoteToken) => {
      // Se ainda não há token FCM remoto configurado, dispara alerta local do sistema operacional via Realtime
      if (!hasRemoteToken) {
        studentRequirements.forEach((req) => {
          const prevSig = prevReqMap.get(req.id);
          const newSig = currentReqMap.get(req.id);
          if (prevSig && prevSig !== newSig) {
            const lastComment =
              req.comments && req.comments.length > 0 ? req.comments[req.comments.length - 1] : null;
            if (lastComment && lastComment.role === 'Funcionário' && !prevSig.includes(lastComment.id)) {
              pushNotificationService.triggerLocalNotification({
                title: `💬 Novo parecer em ${req.protocol}`,
                body: `${lastComment.author}: "${lastComment.text}"`,
                data: { type: 'requirement_comment', protocol: req.protocol, requirementId: req.id },
                category: 'requirement',
              });
            } else {
              pushNotificationService.triggerLocalNotification({
                title: `📄 Requerimento ${req.protocol} Atualizado`,
                body: `Etapa atual: ${req.currentStage}`,
                data: { type: 'requirement_updated', protocol: req.protocol, requirementId: req.id },
                category: 'requirement',
              });
            }
          }
        });

        notices.forEach((n) => {
          if (!prevNoticeIds.has(n.id)) {
            pushNotificationService.triggerLocalNotification({
              title: `📢 Novo Comunicado (${n.category})`,
              body: n.title,
              data: { type: 'new_notice', noticeId: n.id },
              category: 'news',
            });
          }
        });
      }
    });

    realtimeSnapshotRef.current = {
      initialized: true,
      reqMap: currentReqMap,
      noticeIds: currentNoticeIds,
    };
  }, [studentRequirements, notices, isLoadingData]);

  // Calcula total de notificações não lidas para o badge do sino
  const unreadNotificationsCount = useMemo(() => {
    if (!hasLoadedReadIds) return 0;
    const ids: string[] = [];
    studentRequirements.slice(0, 6).forEach((req) => {
      const comments = req.comments || [];
      if (comments.length > 0) {
        const lastComment = comments[comments.length - 1];
        ids.push(`req-comment-${req.id}-${lastComment.id}`);
      }
      ids.push(`req-status-${req.id}-${req.status}-${req.currentStage || ''}`);
    });
    notices.slice(0, 5).forEach((n) => ids.push(`notice-${n.id}`));
    ids.push('acad-rem-1');
    return ids.filter((id) => !readNotificationIds.includes(id)).length;
  }, [studentRequirements, notices, readNotificationIds, hasLoadedReadIds]);

  const handleMarkAsRead = (id: string) => {
    setReadNotificationIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      persistReadIds(next);
      return next;
    });
  };

  const handleMarkAllAsRead = (allIds: string[]) => {
    setReadNotificationIds((prev) => {
      const next = Array.from(new Set([...prev, ...allIds]));
      persistReadIds(next);
      return next;
    });
    showToast('Todas as notificações foram marcadas como lidas', 'success');
  };

  const handleQuickAction = (action: any) => {
    switch (action.iconName) {
      case 'sparkles':
        navigation.navigate('IA');
        break;
      case 'book':
        navigation.navigate('Arquivo');
        break;
      case 'message':
        navigation.navigate('StudentRequirements');
        break;
      case 'award':
      case 'graduation-cap':
        navigation.navigate('Educacional');
        break;
      default:
        break;
    }
  };

  const handleHumanSupport = () => {
    navigation.navigate('AIChat', {
      requestHumanTransfer: true,
      initialPrompt: 'Gostaria de falar com um atendente humano da Central CAA.',
    });
  };

  const initials = (user?.name || 'LA')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

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
        {/* Header Curvado Verde Ampliado e Mais Limpo */}
        <FadeInView
          delay={0}
          duration={450}
          style={[
            styles.headerContainer,
            { paddingTop: topPadding + spacing.lg, backgroundColor: colors.primary },
          ]}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Perfil')}
              style={styles.avatarContainer}
            >
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={[styles.onlineIndicator, { borderColor: colors.primary }]} />
            </TouchableOpacity>

            <View style={styles.greetingCol}>
              <Text style={styles.welcomeLabel}>ÁREA DO SUCESSO ALVARISTA</Text>
              <Text style={styles.greetingTitle} numberOfLines={2}>
                Olá, {user?.name || 'Lucas Alvarista'}
              </Text>
              <View style={styles.coursePill}>
                <GraduationCap size={14} color="#FFFFFF" />
                <Text style={styles.greetingSubtitle} numberOfLines={1}>
                  {user?.course || 'Ciência da Computação'} • {user?.semester || '5º Sem'}
                </Text>
              </View>
            </View>

            <ScalePressable
              onPress={() => setNotificationsVisible(true)}
              style={styles.notificationButton}
            >
              <Bell size={24} color="#FFFFFF" />
              {unreadNotificationsCount > 0 && (
                <View style={[styles.bellBadge, { borderColor: colors.primary }]}>
                  <Text style={styles.bellBadgeText}>
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </Text>
                </View>
              )}
            </ScalePressable>
          </View>

          {/* Barra de Busca / Prompt IA */}
          <ScalePressable
            onPress={() => navigation.navigate('IA', { screen: 'AIChat' })}
            style={styles.searchBar}
          >
            <View
              style={[
                styles.searchSparkleIcon,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF' },
              ]}
            >
              <Sparkles size={20} color="#00B074" />
            </View>
            <View style={styles.searchPromptCol}>
              <Text style={styles.searchPromptTitle}>
                Pergunte à IA Oficial ou abra um requerimento
              </Text>
              <Text style={styles.searchPromptSubtitle}>
                Notas, boletos, trancamento, documentos e normas FECAP
              </Text>
            </View>
            <Search size={20} color="rgba(255, 255, 255, 0.9)" />
          </ScalePressable>
        </FadeInView>

        {/* Corpo Principal Mais Limpo e Menos Poluído */}
        <View style={styles.body}>
          {/* Seção 1: Ações Rápidas */}
          <FadeInView delay={100} style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>
              Acesso Rápido
            </Text>
            <View style={[styles.quickActionsRow, { marginTop: spacing.md }]}>
              {QUICK_ACTIONS.map((action) => (
                <QuickActionCard
                  key={action.id}
                  action={action}
                  onPress={handleQuickAction}
                />
              ))}
            </View>
          </FadeInView>

          {/* Seção 2: Avisos & Comunicados Institucionais */}
          <FadeInView delay={180} style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>
                Mural de Avisos
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Materials')}
                activeOpacity={0.7}
                style={styles.linkRow}
              >
                <Text style={[styles.verTodosLink, { color: colors.primary }]}>
                  Ver mural completo
                </Text>
                <ChevronRight size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <BannerCarousel
              notices={studentNotices}
              onPressBanner={() => navigation.navigate('Materials')}
            />
          </FadeInView>

          {/* Seção 3: Requerimentos em andamento */}
          <FadeInView delay={260} style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('StudentRequirements')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>
                  Meus Requerimentos ({studentRequirements.length})
                </Text>
                <ChevronRight size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={() => setManualReqVisible(true)}
                  activeOpacity={0.7}
                  style={[
                    styles.newReqBtn,
                    {
                      backgroundColor: isDark ? 'rgba(0,135,90,0.2)' : '#E6F4EA',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                    },
                  ]}
                >
                  <FileText size={14} color={colors.primary} />
                  <Text style={[styles.verTodosLink, { color: colors.primary, fontSize: 12 }]}>
                    Manual
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('AIChat', {
                      initialPrompt: 'Olá SISA! Gostaria de abrir um requerimento acadêmico.',
                    })
                  }
                  activeOpacity={0.7}
                  style={[
                    styles.newReqBtn,
                    {
                      backgroundColor: isDark ? 'rgba(124,58,237,0.2)' : '#EDE9FE',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                    },
                  ]}
                >
                  <Sparkles size={14} color={colors.secondary} />
                  <Text style={[styles.verTodosLink, { color: colors.secondary, fontSize: 12 }]}>
                    Via IA
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {studentRequirements.slice(0, 2).map((req) => (
              <View key={req.id} style={{ marginBottom: spacing.sm }}>
                <RequirementCard
                  requirement={req}
                  onPress={(item) => {
                    const lastComment =
                      item.comments && item.comments.length > 0
                        ? item.comments[item.comments.length - 1]
                        : null;
                    handleMarkAsRead(`req-status-${item.id}-${item.status}-${item.currentStage || ''}`);
                    if (lastComment) {
                      handleMarkAsRead(`req-comment-${item.id}-${lastComment.id}`);
                    }
                    navigation.navigate('RequirementDetail', { requirement: item });
                  }}
                />
              </View>
            ))}

            {studentRequirements.length > 2 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('StudentRequirements')}
                style={[
                  styles.viewAllRequirementsBtn,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                  },
                ]}
              >
                <Text style={[styles.viewAllRequirementsText, { color: colors.primary }]}>
                  Ver todos os requerimentos ({studentRequirements.length})
                </Text>
                <ChevronRight size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </FadeInView>

          
          {/* Seção 3.5: Painel de Atendimento Presencial CAA (T5 & Item 12) */}
          <FadeInView delay={320}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Profile')}
              style={[
                styles.queueCardContainer,
                {
                  backgroundColor: isDark ? colors.card : '#FFFFFF',
                  borderColor: myActiveTicket?.status === 'called' ? '#059669' : colors.border,
                  borderWidth: myActiveTicket?.status === 'called' ? 2 : 1,
                },
              ]}
            >
              <View style={styles.queueCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View
                    style={[
                      styles.queueIconBox,
                      {
                        backgroundColor:
                          myActiveTicket?.status === 'called'
                            ? '#D1FAE5'
                            : isDark
                            ? 'rgba(124, 58, 237, 0.2)'
                            : colors.primaryLight,
                      },
                    ]}
                  >
                    <Ticket
                      size={20}
                      color={myActiveTicket?.status === 'called' ? '#059669' : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.queueTitle, { color: colors.textPrimary }]}>
                      Atendimento Presencial CAA
                    </Text>
                    <Text style={[styles.queueSubtitle, { color: colors.textSecondary }]}>
                      {myActiveTicket
                        ? myActiveTicket.status === 'called'
                          ? `Sua senha foi chamada para o ${myActiveTicket.counter || 'Guichê'}!`
                          : `Sua senha: ${myActiveTicket.ticket_number} • Aguardando chamada`
                        : `${queueBoard.filter((t) => t.status === 'waiting').length} pessoas aguardando no balcão`}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.queueBadge,
                    {
                      backgroundColor:
                        myActiveTicket?.status === 'called'
                          ? '#059669'
                          : myActiveTicket
                          ? '#D97706'
                          : colors.primaryLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.queueBadgeText,
                      {
                        color:
                          myActiveTicket?.status === 'called' || myActiveTicket
                            ? '#FFFFFF'
                            : colors.primaryDark,
                      },
                    ]}
                  >
                    {myActiveTicket
                      ? myActiveTicket.status === 'called'
                        ? 'CHAMADA'
                        : myActiveTicket.ticket_number
                      : 'Tirar Senha'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </FadeInView>

          {/* Seção 4: Card de Atendimento Humano CAA ao Vivo */}
          <FadeInView delay={340}>
            <View
              style={[
                styles.humanSupportCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(139, 92, 246, 0.14)'
                    : colors.secondaryLight,
                  borderColor: isDark
                    ? 'rgba(139, 92, 246, 0.35)'
                    : 'rgba(124, 58, 237, 0.22)',
                },
              ]}
            >
              <View
                style={[
                  styles.humanSupportIconBox,
                  { backgroundColor: isDark ? colors.card : '#FFFFFF' },
                ]}
              >
                <Headphones size={22} color={colors.secondary} />
              </View>
              <View style={styles.humanSupportContent}>
                <Text style={[styles.humanSupportTitle, { color: colors.secondary }]}>
                  Chat ao Vivo CAA • Atendimento Real
                </Text>
                <Text
                  style={[styles.humanSupportDesc, { color: colors.textSecondary }]}
                >
                  Converse diretamente com um atendente da secretaria com seu histórico preservado.
                </Text>
              </View>
              <ScalePressable
                onPress={handleHumanSupport}
                style={[styles.humanSupportBtn, { backgroundColor: colors.secondary }]}
              >
                <Text style={styles.humanSupportBtnText}>Falar Agora</Text>
              </ScalePressable>
            </View>
          </FadeInView>
        </View>
      </ScrollView>

      <RequirementDetailModal
        visible={modalVisible}
        requirement={selectedReq}
        onClose={() => setModalVisible(false)}
      />

      <NotificationsModal
        visible={notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
        readIds={readNotificationIds}
        requirementsList={studentRequirements}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onSelectRequirement={(req) => {
          setSelectedReq(req);
          setModalVisible(true);
        }}
        onOpenNotices={() => navigation.navigate('Materials')}
      />

      <ManualRequirementModal
        visible={manualReqVisible}
        onClose={() => setManualReqVisible(false)}
        onSuccess={(protocol) => {
          showToast(`Requerimento ${protocol} criado com sucesso!`, 'success');
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
    paddingBottom: spacing.xxxl + 16,
  },
  headerContainer: {
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl + 8,
    shadowColor: '#00875A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl + 4,
    marginTop: spacing.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.extraBold,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34D399',
    borderWidth: 2,
  },
  greetingCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  welcomeLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeights.extraBold,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  greetingTitle: {
    fontSize: 28,
    fontWeight: typography.fontWeights.extraBold,
    color: '#FFFFFF',
    lineHeight: 33,
    marginBottom: 8,
  },
  coursePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    gap: 6,
  },
  greetingSubtitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semiBold,
    color: '#FFFFFF',
  },
  notificationButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: typography.fontWeights.extraBold,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  searchSparkleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPromptCol: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  searchPromptTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    marginBottom: 2,
  },
  searchPromptSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: typography.fontSizes.xs,
  },
  body: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
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
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  newReqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  verTodosLink: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueCardContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  queueCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  queueIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  queueSubtitle: {
    fontSize: 12,
  },
  queueBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 8,
  },
  queueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  humanSupportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  humanSupportIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  humanSupportContent: {
    flex: 1,
  },
  humanSupportTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    marginBottom: 2,
  },
  humanSupportDesc: {
    fontSize: typography.fontSizes.xs,
    lineHeight: 16,
  },
  humanSupportBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.pill,
  },
  humanSupportBtnText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  viewAllRequirementsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    gap: 6,
  },
  viewAllRequirementsText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
