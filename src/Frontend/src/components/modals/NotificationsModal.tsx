import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Bell,
  BellOff,
  X,
  CheckCheck,
  MessageSquare,
  CheckCircle2,
  XCircle,
  FileText,
  Megaphone,
  GraduationCap,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, typography, borderRadius } from '../../theme';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { Requirement, NoticeItem } from '../../utils/constants';
import { isNoticeRelevantForStudent, FullNoticeItem } from '../../services/supabase/noticesService';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  date: string;
  category: 'requirement' | 'notice' | 'academic';
  color: string;
  requirement?: Requirement;
  notice?: NoticeItem;
}

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  readIds: string[];
  requirementsList?: Requirement[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: (allIds: string[]) => void;
  onSelectRequirement?: (req: Requirement) => void;
  onOpenNotices?: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
  readIds,
  requirementsList,
  onMarkAsRead,
  onMarkAllAsRead,
  onSelectRequirement,
  onOpenNotices,
}) => {
  const { colors, isDark } = useTheme();
  const { requirements, notices } = useApp();
  const { user } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread'>('all');

  const notifications = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    // 1. Notificações de Requerimentos e Comentários da Secretaria
    const targetReqs = requirementsList || requirements.filter((r: any) => !user?.ra || !r.studentRa || String(r.studentRa).trim() === String(user.ra).trim());
    targetReqs.slice(0, 6).forEach((req) => {
      const comments = req.comments || [];
      if (comments.length > 0) {
        const lastComment = comments[comments.length - 1];
        list.push({
          id: `req-comment-${req.id}-${lastComment.id}`,
          title: `Novo parecer em ${req.protocol}`,
          body: `${lastComment.author}: "${lastComment.text}"`,
          date: lastComment.createdAt,
          category: 'requirement',
          color: '#2563EB',
          requirement: req,
        });
      }

      const statusLabel =
        req.status === 'approved'
          ? 'Deferido'
          : req.status === 'rejected'
          ? 'Indeferido'
          : req.status === 'in_progress'
          ? 'Em Análise'
          : 'Pendente';

      list.push({
        id: `req-status-${req.id}-${req.status}-${req.currentStage || ''}`,
        title: `Requerimento ${req.protocol}: ${statusLabel}`,
        body: `${req.title} — ${req.currentStage} (${req.type})`,
        date: req.updatedAt || req.createdAt,
        category: 'requirement',
        color:
          req.status === 'approved'
            ? colors.success
            : req.status === 'rejected'
            ? colors.error
            : colors.warning,
        requirement: req,
      });
    });

    // 2. Notificações de Comunicados e Avisos Oficiais filtrados por perfil do estudante
    notices
      .filter((notice) => isNoticeRelevantForStudent(notice as FullNoticeItem, user))
      .slice(0, 5)
      .forEach((notice) => {
        list.push({
          id: `notice-${notice.id}`,
          title: `Novo Comunicado (${notice.category})`,
          body: notice.title,
          date: notice.date || 'Recente',
          category: 'notice',
          color: colors.primary,
          notice,
        });
      });

    // 3. Lembretes Acadêmicos
    list.push({
      id: 'acad-rem-1',
      title: 'Acompanhamento de Frequência e Notas',
      body: 'Consulte seu Painel Educacional para verificar notas parciais e frequência por curso e semestre.',
      date: 'Hoje',
      category: 'academic',
      color: colors.secondary,
    });

    return list;
  }, [requirements, requirementsList, user, notices, colors]);

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;
  const displayedNotifications =
    selectedFilter === 'unread'
      ? notifications.filter((n) => !readIds.includes(n.id))
      : notifications;

  const handlePressNotification = (item: NotificationItem) => {
    onMarkAsRead(item.id);
    if (item.requirement && onSelectRequirement) {
      onClose();
      onSelectRequirement(item.requirement);
    } else if (item.category === 'notice' && onOpenNotices) {
      onClose();
      onOpenNotices();
    }
  };

  const renderIcon = (item: NotificationItem) => {
    if (item.category === 'notice') {
      return <Megaphone size={20} color={item.color} />;
    }
    if (item.category === 'academic') {
      return <GraduationCap size={20} color={item.color} />;
    }
    if (item.id.startsWith('req-comment-')) {
      return <MessageSquare size={20} color={item.color} />;
    }
    if (item.requirement?.status === 'approved') {
      return <CheckCircle2 size={20} color={item.color} />;
    }
    if (item.requirement?.status === 'rejected') {
      return <XCircle size={20} color={item.color} />;
    }
    return <FileText size={20} color={item.color} />;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.card },
          ]}
        >
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleRow}>
              <View
                style={[
                  styles.headerIconBox,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <Bell size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Central de Notificações
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {unreadCount > 0
                    ? `${unreadCount} ${unreadCount === 1 ? 'notificação não lida' : 'notificações não lidas'}`
                    : 'Você está em dia com seus avisos'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                { backgroundColor: isDark ? colors.background : '#F1F5F9' },
              ]}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Filter & Actions Bar */}
          <View style={styles.filterRow}>
            <View style={styles.filterPills}>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  {
                    backgroundColor:
                      selectedFilter === 'all'
                        ? colors.primary
                        : isDark
                        ? colors.background
                        : '#F1F5F9',
                  },
                ]}
                onPress={() => setSelectedFilter('all')}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color:
                        selectedFilter === 'all' ? '#FFFFFF' : colors.textSecondary,
                    },
                  ]}
                >
                  Todas ({notifications.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterPill,
                  {
                    backgroundColor:
                      selectedFilter === 'unread'
                        ? colors.primary
                        : isDark
                        ? colors.background
                        : '#F1F5F9',
                  },
                ]}
                onPress={() => setSelectedFilter('unread')}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color:
                        selectedFilter === 'unread'
                          ? '#FFFFFF'
                          : colors.textSecondary,
                    },
                  ]}
                >
                  Não lidas ({unreadCount})
                </Text>
              </TouchableOpacity>
            </View>

            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={() => onMarkAllAsRead(notifications.map((n) => n.id))}
                style={styles.markAllBtn}
              >
                <CheckCheck size={16} color={colors.primary} />
                <Text style={[styles.markAllText, { color: colors.primary }]}>
                  Ler todas
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {displayedNotifications.length === 0 ? (
              <View style={styles.emptyBox}>
                <BellOff size={44} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  Nenhuma notificação por aqui
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  Todas as atualizações de requerimentos e comunicados aparecerão
                  nesta central.
                </Text>
              </View>
            ) : (
              displayedNotifications.map((item) => {
                const isRead = readIds.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.notificationCard,
                      {
                        backgroundColor: isRead
                          ? isDark
                            ? colors.background
                            : '#FFFFFF'
                          : isDark
                          ? 'rgba(0, 201, 136, 0.10)'
                          : '#F0FDF4',
                        borderColor: isRead
                          ? colors.border
                          : 'rgba(0, 176, 116, 0.35)',
                      },
                    ]}
                    activeOpacity={0.75}
                    onPress={() => handlePressNotification(item)}
                  >
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: `${item.color}18` },
                      ]}
                    >
                      {renderIcon(item)}
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTopRow}>
                        <Text
                          style={[
                            styles.cardTitle,
                            { color: colors.textPrimary },
                            !isRead && styles.cardTitleUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {!isRead && (
                          <View
                            style={[
                              styles.unreadDot,
                              { backgroundColor: colors.primary },
                            ]}
                          />
                        )}
                      </View>
                      <Text
                        style={[styles.cardDesc, { color: colors.textSecondary }]}
                        numberOfLines={2}
                      >
                        {item.body}
                      </Text>
                      <View style={styles.cardFooterRow}>
                        <Text
                          style={[styles.cardDate, { color: colors.textMuted }]}
                        >
                          {item.date}
                        </Text>
                        {(item.requirement || item.notice) && (
                          <Text
                            style={[
                              styles.cardActionLink,
                              { color: colors.primary },
                            ]}
                          >
                            Toque para abrir →
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '86%',
    paddingHorizontal: spacing.xl,
    paddingBottom: 28,
    paddingTop: 12,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
  },
  subtitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.regular,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.pill,
  },
  filterPillText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  listContent: {
    paddingBottom: 16,
    gap: 10,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    flex: 1,
  },
  cardTitleUnread: {
    fontWeight: typography.fontWeights.bold,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  cardDesc: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.regular,
    lineHeight: 18,
    marginBottom: 6,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardDate: {
    fontSize: 11,
  },
  cardActionLink: {
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
  },
  emptyDesc: {
    fontSize: typography.fontSizes.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
});
