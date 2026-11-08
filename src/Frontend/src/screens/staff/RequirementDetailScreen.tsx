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
  Image,
  Linking,
  Modal,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Send,
  UserCheck,
  Sparkles,
  User,
  Building2,
  FileText,
  Bot,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  ExternalLink,
  ChevronRight,
  Check,
  Paperclip,
  Upload,
  Download,
  Trash2,
  XCircle,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { EnrichedRequirement, requirementsService } from '../../services/supabase/requirementsService';
import { storageService } from '../../services/supabase/storageService';
import { ConfirmationModal } from '../../components/feedback/ConfirmationModal';
import { FadeInView, ScalePressable } from '../../components/common/AnimatedComponents';

const STATUS_OPTIONS: {
  label: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  stage: string;
  color: string;
  badgeBg: string;
}[] = [
  {
    label: 'Recebido / Triagem',
    status: 'pending',
    stage: 'Triagem Documental CAA',
    color: '#D97706',
    badgeBg: 'rgba(217, 119, 6, 0.15)',
  },
  {
    label: 'Em Andamento',
    status: 'in_progress',
    stage: 'Em Análise Técnica pelo Setor',
    color: '#2563EB',
    badgeBg: 'rgba(37, 99, 235, 0.15)',
  },
  {
    label: 'Aguardando Aluno',
    status: 'in_progress',
    stage: 'Aguardando Complementação do Aluno',
    color: '#7C3AED',
    badgeBg: 'rgba(124, 58, 237, 0.15)',
  },
  {
    label: 'Deferido / Concluído',
    status: 'approved',
    stage: 'Concluído & Deferido',
    color: '#059669',
    badgeBg: 'rgba(5, 150, 105, 0.15)',
  },
  {
    label: 'Indeferido',
    status: 'rejected',
    stage: 'Indeferido pela Secretaria',
    color: '#DC2626',
    badgeBg: 'rgba(220, 38, 38, 0.15)',
  },
];

export const RequirementDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0
  );
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const { user, selectedRole } = useAuth();
  const {
    requirements,
    updateRequirementStatusAndComment,
    cancelRequirement,
    deleteRequirement,
    addRequirementAttachment,
    removeRequirementAttachment,
    showToast,
  } = useApp();

  const isStaff = (user?.role || selectedRole) === 'Funcionário';

  const initialReq: EnrichedRequirement | undefined = route.params?.requirement;
  const [req, setReq] = useState<EnrichedRequirement | null>(initialReq || null);
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'in_progress' | 'approved' | 'rejected'>(
    initialReq?.status || 'in_progress'
  );
  const [selectedStage, setSelectedStage] = useState(initialReq?.currentStage || 'Em Análise Técnica');
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<{
    id: string;
    name: string;
    role: 'student' | 'staff';
  } | null>(null);
  const [isDeletingAttachment, setIsDeletingAttachment] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRefreshRequirement = async () => {
    if (!req?.id) return;
    setRefreshing(true);
    try {
      const list = await requirementsService.getRequirements();
      const found = list.find((item) => item.id === req.id || item.protocol === req.protocol);
      if (found) {
        setReq(found);
        setSelectedStatus(found.status || 'in_progress');
        setSelectedStage(found.currentStage || 'Em Análise Técnica');
      }
    } catch (e) {
      console.warn('Erro ao atualizar requerimento:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfirmDeleteAttachment = async () => {
    if (!req || !attachmentToDelete) return;
    setIsDeletingAttachment(true);
    try {
      const updated = await removeRequirementAttachment({
        requirementId: req.id,
        protocol: req.protocol,
        attachmentId: attachmentToDelete.id,
        role: attachmentToDelete.role,
      });
      if (updated) {
        setReq(updated);
      }
      setAttachmentToDelete(null);
    } finally {
      setIsDeletingAttachment(false);
    }
  };

  const handlePickAndUploadAttachment = async (role: 'student' | 'staff') => {
    if (!req) return;
    setUploadingAttachment(true);
    try {
      const res = await storageService.pickAndUploadRequirementAttachment(
        req.protocol || req.id,
        role === 'student' ? 'Aluno' : 'Funcionário'
      );

      if (res.canceled) return;

      if (res.attachment) {
        const updated = await addRequirementAttachment({
          requirementId: req.id,
          protocol: req.protocol,
          attachment: res.attachment,
          role,
        });
        if (updated) {
          setReq(updated);
        }
      } else if (res.error) {
        showToast(res.error, 'error');
      }
    } catch {
      showToast('Erro ao processar anexo.', 'error');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!req) return;
    if (!cancelReason.trim()) {
      showToast('Por favor, informe a justificativa do cancelamento.', 'info');
      return;
    }
    setIsCancelling(true);
    try {
      const ok = await cancelRequirement({
        requirementId: req.id,
        protocol: req.protocol,
        reason: cancelReason.trim(),
        authorName: user?.name || 'Aluno',
      });
      if (ok) {
        setReq((prev) =>
          prev
            ? {
                ...prev,
                status: 'rejected',
                currentStage: 'Cancelado pelo Aluno',
                cancellationReason: cancelReason.trim(),
              }
            : null
        );
        setCancelModalVisible(false);
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!req) return;
    setIsDeleting(true);
    try {
      const ok = await deleteRequirement(req.id, req.protocol);
      if (ok) {
        setDeleteModalVisible(false);
        navigation.goBack();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Sincroniza instantaneamente com a lista global de requerimentos (atualizada em tempo real via AppContext)
  useEffect(() => {
    const targetId = req?.id || initialReq?.id || route.params?.requirementId;
    const targetProtocol = req?.protocol || initialReq?.protocol;
    if (!targetId && !targetProtocol) return;

    const fresh = requirements.find(
      (item) =>
        (targetId && item.id === targetId) ||
        (targetProtocol && item.protocol === targetProtocol)
    );

    if (fresh) {
      setReq(fresh);
      if (!saving) {
        setSelectedStatus(fresh.status || 'in_progress');
        setSelectedStage(fresh.currentStage || 'Em Análise Técnica');
      }
    }
  }, [requirements]);

  // Carregamento inicial se veio pelo parâmetro de navegação
  useEffect(() => {
    if (initialReq) {
      const freshFromStore = requirements.find(
        (item) => item.id === initialReq.id || item.protocol === initialReq.protocol
      );
      const sourceReq = freshFromStore || initialReq;
      setReq(sourceReq);
      setSelectedStatus(sourceReq.status || 'in_progress');
      setSelectedStage(sourceReq.currentStage || 'Em Análise Técnica');
    } else if (route.params?.requirementId) {
      const freshFromStore = requirements.find((item) => item.id === route.params?.requirementId);
      if (freshFromStore) {
        setReq(freshFromStore);
        setSelectedStatus(freshFromStore.status || 'in_progress');
        setSelectedStage(freshFromStore.currentStage || 'Em Análise Técnica');
      } else {
        requirementsService.getRequirements().then((list) => {
          const found = list.find((item) => item.id === route.params?.requirementId);
          if (found) {
            setReq(found);
            setSelectedStatus(found.status || 'in_progress');
            setSelectedStage(found.currentStage || 'Em Análise Técnica');
          }
        });
      }
    }
  }, [initialReq?.id, route.params?.requirementId]);

  if (!req) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Carregando detalhes do requerimento...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const getStatusColor = (st: string) => {
    switch (st) {
      case 'approved':
        return '#059669';
      case 'rejected':
        return '#DC2626';
      case 'in_progress':
        return '#2563EB';
      default:
        return '#D97706';
    }
  };

  const isUrgent = req.attentionLevel === 'Urgente';

  const handleSaveUpdate = async () => {
    if (saving) return;
    if (!selectedStage.trim()) {
      showToast('Por favor, defina a etapa atual do processo.', 'info');
      return;
    }

    Keyboard.dismiss();
    setSaving(true);
    try {
      const updated = await updateRequirementStatusAndComment({
        requirementId: req.id,
        protocol: req.protocol,
        newStatus: selectedStatus,
        newStage: selectedStage.trim(),
        commentText: commentText.trim() || undefined,
        authorName: user?.name || 'Equipe CAA FECAP',
        authorRole: isStaff ? 'Funcionário' : 'Aluno',
      });

      if (updated) {
        setReq(updated);
        setCommentText('');
      }
    } catch (err: any) {
      console.warn('Erro ao atualizar requerimento:', err);
      showToast('Erro ao atualizar requerimento.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const commentsList = req.comments || [];
  const stepsList = req.steps || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.card}
      />

      {/* Top Bar Fixa de Navegação */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: topPadding + spacing.xs,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.topBarTitleCol}>
          <Text style={[styles.topBarProtocol, { color: colors.primary }]}>{req.protocol}</Text>
          <Text style={[styles.topBarSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {req.title}
          </Text>
        </View>

        {/* Botão para Consultar IA diretamente com o contexto deste requerimento */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate('AIChat', {
              initialPrompt: `Análise técnica do requerimento ${req.protocol} (${req.title}) do estudante ${req.studentName} RA ${req.studentRa}. Situação atual: ${req.currentStage}.`,
            })
          }
          style={[styles.aiQueryBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
        >
          <View style={{ marginRight: 4 }}>
            <Bot size={16} color={colors.primaryDark} />
          </View>
          <Text style={[styles.aiQueryBtnText, { color: colors.primaryDark }]}>IA SISA</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner de Identificação & Status */}
        <FadeInView delay={50}>
          <View style={[styles.mainCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.mainCardHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.protocolBadgesRow}>
                  <View style={[styles.typeBadge, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                    <View style={{ marginRight: 4 }}>
                      <Building2 size={12} color={colors.textSecondary} />
                    </View>
                    <Text style={[styles.typeBadgeText, { color: colors.textSecondary }]}>
                      {req.type || req.departmentDirection || 'Secretaria Acadêmica'}
                    </Text>
                  </View>

                  {isUrgent ? (
                    <View style={[styles.attentionBadge, { backgroundColor: isDark ? 'rgba(220,38,38,0.2)' : '#FEE2E2' }]}>
                      <View style={{ marginRight: 3 }}>
                        <AlertTriangle size={12} color="#DC2626" />
                      </View>
                      <Text style={styles.attentionText}>Urgente / Prioritário</Text>
                    </View>
                  ) : (
                    <View style={[styles.regularBadge, { backgroundColor: colors.backgroundAlt }]}>
                      <Text style={[styles.regularBadgeText, { color: colors.textMuted }]}>Triagem Regular</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.demandTitle, { color: colors.textPrimary }]}>{req.title}</Text>
              </View>
            </View>

            {/* Status e Etapa Atual */}
            <View
              style={[
                styles.currentStageCard,
                {
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : colors.backgroundAlt,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: getStatusColor(req.status) },
                    ]}
                  />
                  <Text style={[styles.statusLabel, { color: getStatusColor(req.status) }]}>
                    {req.currentStage}
                  </Text>
                </View>

                <Text style={[styles.dateMeta, { color: colors.textMuted }]}>
                  {req.updatedAt || 'Hoje'}
                </Text>
              </View>

              {req.departmentDirection ? (
                <Text style={[styles.departmentInfo, { color: colors.textSecondary }]}>
                  Setor responsável: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{req.departmentDirection}</Text>
                </Text>
              ) : null}
            </View>

            {req.cancellationReason ? (
              <View style={[styles.cancellationBanner, { backgroundColor: isDark ? 'rgba(220,38,38,0.2)' : '#FEE2E2', borderColor: '#DC2626' }]}>
                <XCircle size={18} color="#DC2626" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.cancellationBannerTitle, { color: '#DC2626' }]}>
                    Requerimento Cancelado pelo Estudante
                  </Text>
                  <Text style={[styles.cancellationBannerReason, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
                    Motivo registrado: "{req.cancellationReason}"
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </FadeInView>

        {/* Card do Estudante Solicitante com Link Direto para o Perfil Completo */}
        <FadeInView delay={100}>
          <View style={[styles.studentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.studentCardRow}>
              <View style={[styles.avatarBox, { backgroundColor: colors.primaryLight }]}>
                <User size={24} color={colors.primaryDark} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.studentCardLabel, { color: colors.textMuted }]}>
                  ESTUDANTE SOLICITANTE
                </Text>
                <Text style={[styles.studentName, { color: colors.textPrimary }]}>
                  {req.studentName || 'Estudante Alvarista'}
                </Text>
                <Text style={[styles.studentMeta, { color: colors.textSecondary }]}>
                  RA: {req.studentRa || '24026851'} • {req.studentCourse || 'Graduação FECAP'}
                </Text>
              </View>

              <View style={[styles.activeTag, { backgroundColor: colors.primaryLight }]}>
                <View style={{ marginRight: 3 }}>
                  <ShieldCheck size={12} color={colors.primaryDark} />
                </View>
                <Text style={[styles.activeTagText, { color: colors.primaryDark }]}>Ativo</Text>
              </View>
            </View>

            {isStaff && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate('StudentFullProfile', {
                    student: {
                      id: `std-${req.studentRa}`,
                      ra: req.studentRa || '24026851',
                      name: req.studentName || 'Estudante Alvarista',
                      course: req.studentCourse || 'Ciência da Computação',
                      status: 'Ativo',
                    },
                  })
                }
                style={[
                  styles.viewProfileLinkBtn,
                  { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.viewProfileLinkText, { color: colors.primary }]}>
                  Ver Ficha e Perfil Completo do Aluno
                </Text>
                <ChevronRight size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </FadeInView>

        {/* Descrição Detalhada / Justificativa do Pedido */}
        <FadeInView delay={150}>
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <FileText size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Justificativa & Detalhes da Demanda
              </Text>
            </View>
            <Text style={[styles.descriptionText, { color: colors.textPrimary }]}>
              {req.description || 'Nenhum detalhe adicional informado no momento da solicitação.'}
            </Text>
          </View>
        </FadeInView>

        {/* Linha do Tempo do Atendimento (Steps) */}
        <FadeInView delay={200}>
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <Clock size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Linha do Tempo do Protocolo
              </Text>
            </View>

            <View style={styles.timelineContainer}>
              {stepsList.map((step, idx) => {
                const isCompleted = step.completed;
                const isActive = step.active;

                return (
                  <View key={idx} style={styles.timelineRow}>
                    <View style={styles.timelineLeftCol}>
                      <View
                        style={[
                          styles.timelineDot,
                          isCompleted && { backgroundColor: colors.primary, borderColor: colors.primary },
                          isActive && {
                            backgroundColor: '#2563EB',
                            borderColor: '#2563EB',
                            transform: [{ scale: 1.15 }],
                          },
                          !isCompleted && !isActive && {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        {isCompleted && <Check size={10} color="#FFFFFF" />}
                      </View>
                      {idx < stepsList.length - 1 && (
                        <View
                          style={[
                            styles.timelineLine,
                            { backgroundColor: isCompleted ? colors.primary : colors.border },
                          ]}
                        />
                      )}
                    </View>

                    <View style={styles.timelineContentCol}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text
                          style={[
                            styles.timelineStepTitle,
                            { color: isActive ? colors.primary : colors.textPrimary },
                            (isCompleted || isActive) && { fontWeight: '700' },
                          ]}
                        >
                          {step.title}
                        </Text>
                        {step.date ? (
                          <Text style={[styles.timelineStepDate, { color: colors.textMuted }]}>
                            {step.date}
                          </Text>
                        ) : null}
                      </View>
                      {step.description ? (
                        <Text style={[styles.timelineStepDesc, { color: colors.textSecondary }]}>
                          {step.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </FadeInView>

        {/* PAINEL OPERACIONAL DE ATUALIZAÇÃO (Exclusivo para Funcionário CAA) */}
        {isStaff && (
          <FadeInView delay={250}>
            <View
              style={[
                styles.staffUpdatePanel,
                {
                  backgroundColor: colors.card,
                  borderColor: isDark ? 'rgba(0, 176, 116, 0.4)' : colors.primary,
                },
              ]}
            >
              <View style={styles.staffPanelHeader}>
                <View style={[styles.staffPanelIconBox, { backgroundColor: colors.primaryLight }]}>
                  <UserCheck size={20} color={colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.staffPanelTitle, { color: colors.textPrimary }]}>
                    Painel de Despacho & Atualização CAA
                  </Text>
                  <Text style={[styles.staffPanelSub, { color: colors.textSecondary }]}>
                    Defina o status, edite a etapa pública e registre pareceres no banco
                  </Text>
                </View>
              </View>

              {/* Seletor de Status (Chips) */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                  Status do Requerimento:
                </Text>
                <View style={styles.statusChipsGrid}>
                  {STATUS_OPTIONS.map((opt) => {
                    const isSelected = selectedStatus === opt.status;
                    return (
                      <TouchableOpacity
                        key={opt.label}
                        activeOpacity={0.8}
                        onPress={() => {
                          setSelectedStatus(opt.status);
                          setSelectedStage(opt.stage);
                        }}
                        style={[
                          styles.statusOptionChip,
                          { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                          isSelected && {
                            backgroundColor: opt.badgeBg,
                            borderColor: opt.color,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.chipDot,
                            { backgroundColor: opt.color },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusOptionText,
                            { color: colors.textSecondary },
                            isSelected && { color: opt.color, fontWeight: '700' },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Etapa Atual Personalizada */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                  Etapa Descritiva do Processo:
                </Text>
                <TextInput
                  value={selectedStage}
                  onChangeText={setSelectedStage}
                  placeholder="Ex: Em Análise Técnica pelo Núcleo Financeiro"
                  style={[
                    styles.stageInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Novo Parecer / Comentário */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                  Adicionar Parecer Oficial / Observação Técnica:
                </Text>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Digite aqui o despacho para o estudante, orientações sobre prazos, documentos pendentes..."
                  multiline
                  numberOfLines={4}
                  style={[
                    styles.commentInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Botão Salvar Despacho */}
              <ScalePressable
                onPress={handleSaveUpdate}
                disabled={saving}
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              >
                {saving ? (
                  <View key="saving-indicator">
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : (
                  <View key="save-btn-content" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Send size={16} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Salvar Atualização no Protocolo</Text>
                  </View>
                )}
              </ScalePressable>
            </View>
          </FadeInView>
        )}

        {/* Histórico de Comentários e Pareceres Anteriores */}
        <FadeInView delay={300}>
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <MessageSquare size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Histórico de Pareceres & Mensagens ({commentsList.length})
              </Text>
            </View>

            {commentsList.length === 0 ? (
              <View style={styles.emptyCommentsBox}>
                <Text style={[styles.emptyCommentsText, { color: colors.textMuted }]}>
                  Nenhum comentário ou parecer foi registrado neste protocolo até o momento.
                </Text>
              </View>
            ) : (
              commentsList.map((c) => (
                <View
                  key={c.id}
                  style={[
                    styles.commentBubble,
                    {
                      backgroundColor: colors.backgroundAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.commentHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <User size={14} color={colors.primary} />
                      <Text style={[styles.commentAuthor, { color: colors.textPrimary }]}>
                        {c.author}
                      </Text>
                      <View style={[styles.commentRolePill, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.commentRoleText, { color: colors.primaryDark }]}>
                          {c.role}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.commentDate, { color: colors.textMuted }]}>
                      {c.createdAt}
                    </Text>
                  </View>
                  <Text style={[styles.commentBody, { color: colors.textPrimary }]}>
                    {c.text}
                  </Text>
                </View>
              ))
            )}
          </View>
        </FadeInView>

        {/* Anexos e Documentação Comprobatória (Bidirecional Aluno <-> Funcionário) */}
        <FadeInView delay={320}>
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <Paperclip size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Anexos & Documentação do Processo
              </Text>
            </View>

            {/* Anexos Enviados pelo Aluno */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.attachmentSubTitle, { color: colors.textSecondary }]}>
                  Documentos Enviados pelo Estudante ({(req.studentAttachments || []).length}):
                </Text>
                {!isStaff && req.status !== 'rejected' && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={uploadingAttachment}
                    onPress={() => handlePickAndUploadAttachment('student')}
                    style={[styles.attachSmallBtn, { backgroundColor: colors.primaryLight }]}
                  >
                    {uploadingAttachment ? (
                      <View key="att-up-std">
                        <ActivityIndicator size="small" color={colors.primaryDark} />
                      </View>
                    ) : (
                      <View key="att-idle-std" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Upload size={13} color={colors.primaryDark} />
                        <Text style={[styles.attachSmallBtnText, { color: colors.primaryDark }]}>Adicionar Anexo</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {(!req.studentAttachments || req.studentAttachments.length === 0) ? (
                <Text style={[styles.emptyAttachmentText, { color: colors.textMuted }]}>
                  Nenhum documento anexado pelo estudante até o momento.
                </Text>
              ) : (
                req.studentAttachments.map((att) => (
                  <View
                    key={att.id}
                    style={[styles.attachmentItemRow, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => att.url && Linking.openURL(att.url)}
                      style={styles.attachmentItemLeft}
                    >
                      <View style={{ marginRight: 8 }}>
                        <FileText size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.attachmentName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {att.name}
                        </Text>
                        <Text style={[styles.attachmentMeta, { color: colors.textSecondary }]}>
                          {att.uploadedAt} • Enviado pelo Aluno
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.attachmentActionsRow}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => att.url && Linking.openURL(att.url)}
                        style={styles.attachmentActionBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Download size={16} color={colors.primary} />
                      </TouchableOpacity>
                      {(!isStaff || isStaff) && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => setAttachmentToDelete({ id: att.id, name: att.name, role: 'student' })}
                          style={styles.attachmentActionBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Devolutivas e Documentos Emitidos pela FECAP */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.attachmentSubTitle, { color: colors.textSecondary }]}>
                  Devolutiva Oficial & Documentos da FECAP ({(req.staffAttachments || []).length}):
                </Text>
                {isStaff && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={uploadingAttachment}
                    onPress={() => handlePickAndUploadAttachment('staff')}
                    style={[styles.attachSmallBtn, { backgroundColor: colors.primaryLight }]}
                  >
                    {uploadingAttachment ? (
                      <View key="att-up-staff">
                        <ActivityIndicator size="small" color={colors.primaryDark} />
                      </View>
                    ) : (
                      <View key="att-idle-staff" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Upload size={13} color={colors.primaryDark} />
                        <Text style={[styles.attachSmallBtnText, { color: colors.primaryDark }]}>Anexar Devolutiva</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {(!req.staffAttachments || req.staffAttachments.length === 0) ? (
                <Text style={[styles.emptyAttachmentText, { color: colors.textMuted }]}>
                  Nenhum arquivo ou parecer foi anexado pela equipe técnica.
                </Text>
              ) : (
                req.staffAttachments.map((att) => (
                  <View
                    key={att.id}
                    style={[styles.attachmentItemRow, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => att.url && Linking.openURL(att.url)}
                      style={styles.attachmentItemLeft}
                    >
                      <View style={{ marginRight: 8 }}>
                        <ShieldCheck size={16} color="#059669" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.attachmentName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {att.name}
                        </Text>
                        <Text style={[styles.attachmentMeta, { color: colors.textSecondary }]}>
                          {att.uploadedAt} • Devolutiva Oficial FECAP
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.attachmentActionsRow}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => att.url && Linking.openURL(att.url)}
                        style={styles.attachmentActionBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Download size={16} color="#059669" />
                      </TouchableOpacity>
                      {isStaff && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => setAttachmentToDelete({ id: att.id, name: att.name, role: 'staff' })}
                          style={styles.attachmentActionBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </FadeInView>

        {/* Ações do Estudante: Cancelar ou Excluir Requerimento */}
        {!isStaff && (
          <FadeInView delay={350}>
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 12 }]}>
                Gerenciamento do Protocolo
              </Text>

              <View style={styles.studentActionsCol}>
                {req.status !== 'approved' && req.status !== 'rejected' && req.currentStage !== 'Cancelado pelo Aluno' ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setCancelModalVisible(true)}
                    style={[styles.actionBtnOutline, { borderColor: '#D97706', marginBottom: 10 }]}
                  >
                    <View style={{ marginRight: 6 }}>
                      <XCircle size={16} color="#D97706" />
                    </View>
                    <Text style={[styles.actionBtnOutlineText, { color: '#D97706' }]}>
                      Cancelar Solicitação
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setDeleteModalVisible(true)}
                  style={[styles.actionBtnOutline, { borderColor: '#DC2626' }]}
                >
                  <View style={{ marginRight: 6 }}>
                    <Trash2 size={16} color="#DC2626" />
                  </View>
                  <Text style={[styles.actionBtnOutlineText, { color: '#DC2626' }]}>
                    Excluir Requerimento Permanentemente
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </FadeInView>
        )}
      </ScrollView>

      {/* Modal de Cancelamento com Justificativa */}
      <Modal visible={cancelModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Cancelar Requerimento</Text>
              <TouchableOpacity onPress={() => setCancelModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Por favor, informe a justificativa do cancelamento do protocolo {req.protocol}:
            </Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
              placeholder="Ex: Não tenho mais interesse nesta solicitação..."
              placeholderTextColor={colors.textMuted}
              style={[styles.cancelInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setCancelModalVisible(false)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isCancelling}
                onPress={handleConfirmCancel}
                style={[styles.modalConfirmBtn, { backgroundColor: '#DC2626' }]}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Confirmar Cancelamento</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmationModal
        visible={deleteModalVisible}
        title="Excluir Requerimento?"
        description={`Tem certeza que deseja excluir permanentemente o requerimento ${req.protocol}? Esta ação removerá o histórico e não poderá ser desfeita.`}
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalVisible(false)}
      />

      {/* Modal de Confirmação para Apagar Anexo */}
      <ConfirmationModal
        visible={!!attachmentToDelete}
        title="Apagar Anexo?"
        description={`Tem certeza que deseja apagar o documento "${attachmentToDelete?.name}" deste requerimento? Esta ação não pode ser desfeita.`}
        confirmText="Sim, Apagar Anexo"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleConfirmDeleteAttachment}
        onCancel={() => setAttachmentToDelete(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitleCol: {
    flex: 1,
  },
  topBarProtocol: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  topBarSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  aiQueryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  aiQueryBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  mainCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  mainCardHeader: {
    marginBottom: 14,
  },
  protocolBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  attentionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  attentionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  regularBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  regularBadgeText: {
    fontSize: 11,
  },
  demandTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  currentStageCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  dateMeta: {
    fontSize: 11,
  },
  departmentInfo: {
    fontSize: 11,
    marginTop: 2,
  },
  studentCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  studentCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  studentMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  viewProfileLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  viewProfileLinkText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 20,
  },
  timelineContainer: {
    paddingTop: 6,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineLeftCol: {
    alignItems: 'center',
    width: 20,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 36,
  },
  timelineContentCol: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineStepTitle: {
    fontSize: 13,
  },
  timelineStepDate: {
    fontSize: 10,
  },
  timelineStepDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  staffUpdatePanel: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    gap: 14,
  },
  staffPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  staffPanelIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffPanelTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  staffPanelSub: {
    fontSize: 11,
    marginTop: 1,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusOptionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  stageInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  commentInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyCommentsBox: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyCommentsText: {
    fontSize: 12,
    textAlign: 'center',
  },
  commentBubble: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 6,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '700',
  },
  commentRolePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  commentRoleText: {
    fontSize: 9,
    fontWeight: '700',
  },
  commentDate: {
    fontSize: 10,
  },
  commentBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  cancellationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  cancellationBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  cancellationBannerReason: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  attachmentSubTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  attachSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attachSmallBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyAttachmentText: {
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  attachmentItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  attachmentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  attachmentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 6,
  },
  attachmentActionBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentName: {
    fontSize: 12,
    fontWeight: '600',
  },
  attachmentMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  studentActionsCol: {
    gap: 8,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  cancelInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
