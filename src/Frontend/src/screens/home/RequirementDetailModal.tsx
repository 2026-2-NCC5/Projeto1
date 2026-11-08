import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import {
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Send,
  UserCheck,
  Sparkles,
  User,
  FileText,
  ShieldCheck,
  Download,
  Trash2,
  Upload,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { Requirement } from '../../utils/constants';
import { EnrichedRequirement, requirementsService } from '../../services/supabase/requirementsService';
import { storageService } from '../../services/supabase/storageService';
import { ConfirmationModal } from '../../components/feedback/ConfirmationModal';

interface RequirementDetailModalProps {
  visible: boolean;
  requirement: (Requirement & Partial<EnrichedRequirement>) | null;
  onClose: () => void;
  onUpdated?: (updated: EnrichedRequirement) => void;
}

const STATUS_OPTIONS: {
  label: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  stage: string;
  color: string;
}[] = [
  {
    label: 'Recebido / Triagem',
    status: 'pending',
    stage: 'Triagem Documental CAA',
    color: '#D97706',
  },
  {
    label: 'Em Andamento',
    status: 'in_progress',
    stage: 'Em Análise Técnica pelo Setor',
    color: '#2563EB',
  },
  {
    label: 'Aguardando Aluno',
    status: 'in_progress',
    stage: 'Aguardando Complementação do Aluno',
    color: '#7C3AED',
  },
  {
    label: 'Deferido / Concluído',
    status: 'approved',
    stage: 'Concluído & Deferido',
    color: '#059669',
  },
  {
    label: 'Indeferido',
    status: 'rejected',
    stage: 'Indeferido pela Secretaria',
    color: '#DC2626',
  },
];

export const RequirementDetailModal: React.FC<RequirementDetailModalProps> = ({
  visible,
  requirement,
  onClose,
  onUpdated,
}) => {
  const { colors, spacing, typography, borderRadius, isDark } = useTheme();
  const { user, selectedRole } = useAuth();
  const {
    requirements,
    updateRequirementStatusAndComment,
    addRequirementAttachment,
    removeRequirementAttachment,
    showToast,
  } = useApp();

  const isStaff = (user?.role || selectedRole) === 'Funcionário';

  const [localReq, setLocalReq] = useState<(Requirement & Partial<EnrichedRequirement>) | null>(
    requirement
  );
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'in_progress' | 'approved' | 'rejected'>('in_progress');
  const [selectedStage, setSelectedStage] = useState('');
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<{
    id: string;
    name: string;
    role: 'student' | 'staff';
  } | null>(null);

  const handlePickAndUploadAttachment = async (role: 'student' | 'staff') => {
    if (!localReq) return;
    setUploadingAttachment(true);
    try {
      const res = await storageService.pickAndUploadRequirementAttachment(
        localReq.protocol || localReq.id,
        role === 'student' ? 'Aluno' : 'Funcionário'
      );
      if (res.canceled) return;
      if (res.attachment) {
        const updated = await addRequirementAttachment({
          requirementId: localReq.id,
          protocol: localReq.protocol,
          attachment: res.attachment,
          role,
        });
        if (updated) {
          setLocalReq(updated);
          onUpdated?.(updated);
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

  const handleConfirmDeleteAttachment = async () => {
    if (!localReq || !attachmentToDelete) return;
    try {
      const updated = await removeRequirementAttachment({
        requirementId: localReq.id,
        protocol: localReq.protocol,
        attachmentId: attachmentToDelete.id,
        role: attachmentToDelete.role,
      });
      if (updated) {
        setLocalReq(updated);
        onUpdated?.(updated);
      }
    } finally {
      setAttachmentToDelete(null);
    }
  };

    const handleOpenAttachment = async (att: { name: string; url?: string; path?: string }) => {
    if (att.url) {
      Linking.openURL(att.url);
      return;
    }
    if (att.path) {
      const signed = await requirementsService.getAttachmentSignedUrl(att.path);
      if (signed) {
        Linking.openURL(signed);
        return;
      }
    }
    showToast('Não foi possível abrir o anexo.', 'error');
  };

  useEffect(() => {
    if (requirement && visible) {
      const freshFromStore = requirements.find(
        (item) => item.id === requirement.id || item.protocol === requirement.protocol
      );
      const sourceReq = (freshFromStore || requirement) as EnrichedRequirement;
      setLocalReq(sourceReq);
      setSelectedStatus(sourceReq.status || 'in_progress');
      setSelectedStage(sourceReq.currentStage || 'Em Análise');
      setCommentText('');

      // Item 6: Hidrata signed URLs em lote exclusivamente para o requerimento aberto
      requirementsService.getSignedUrlsForRequirement(sourceReq).then((hydrated) => {
        setLocalReq((prev) => (prev ? { ...prev, ...hydrated } : hydrated));
      }).catch(() => {});
    }
  }, [requirement?.id, visible]);

  // Sincroniza automaticamente comentários, etapas e status em tempo real quando o modal está aberto
  useEffect(() => {
    if (!visible || !localReq) return;
    const fresh = requirements.find(
      (item) => item.id === localReq.id || item.protocol === localReq.protocol
    );
    if (fresh) {
      setLocalReq(fresh);
      if (!saving) {
        setSelectedStatus(fresh.status || 'in_progress');
        setSelectedStage(fresh.currentStage || 'Em Análise');
      }
    }
  }, [requirements, visible]);

  if (!localReq) return null;

  const getStatusBadgeColor = (st: string) => {
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

  const handleSaveUpdate = async () => {
    setSaving(true);
    try {
      const updated = await updateRequirementStatusAndComment({
        requirementId: localReq.id,
        protocol: localReq.protocol,
        newStatus: selectedStatus,
        newStage: selectedStage || localReq.currentStage,
        commentText: commentText.trim() || undefined,
        authorName: user?.name || 'Equipe CAA FECAP',
        authorRole: isStaff ? 'Funcionário' : 'Aluno',
      });

      if (updated) {
        setLocalReq(updated);
        setCommentText('');
        if (onUpdated) {
          onUpdated(updated);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const commentsList = localReq.comments || [];

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={onClose}
      >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={styles.protocolRow}>
                <Text style={[styles.protocolText, { color: colors.primary }]}>
                  {localReq.protocol}
                </Text>
                {localReq.type ? (
                  <Text style={[styles.typeBadge, { color: colors.textMuted }]}>
                    • {localReq.type}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.titleText, { color: colors.textPrimary }]}>
                {localReq.title}
              </Text>
              {localReq.studentName && (
                <Text style={[styles.studentMeta, { color: colors.textSecondary }]}>
                  Estudante: {localReq.studentName} (RA: {localReq.studentRa || '24026851'})
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.backgroundAlt }]}
            >
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[styles.content, { padding: spacing.lg }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Status Badge */}
            <View style={styles.statusSection}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Status Atual da Solicitação
              </Text>
              <View
                style={[
                  styles.badgeContainer,
                  { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.stageTag,
                    { backgroundColor: getStatusBadgeColor(localReq.status) },
                  ]}
                >
                  <Text style={styles.stageTagText}>{localReq.currentStage}</Text>
                </View>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                  Atualizado: {localReq.updatedAt}
                </Text>
              </View>
            </View>

            {/* Descrição */}
            <View
              style={[
                styles.cardSection,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Descrição do Requerimento
              </Text>
              <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                {localReq.description}
              </Text>
            </View>

            {/* Painel Exclusivo do Funcionário: Atualizar Status e Adicionar Comentários */}
            {isStaff && (
              <View
                style={[
                  styles.staffUpdatePanel,
                  {
                    backgroundColor: isDark ? 'rgba(0, 107, 63, 0.14)' : '#ECFDF5',
                    borderColor: colors.primary,
                  },
                ]}
              >
                <View style={styles.staffPanelHeader}>
                  <UserCheck size={18} color={colors.primary} />
                  <Text style={[styles.staffPanelTitle, { color: colors.primary }]}>
                    Gestão do Requerimento (Funcionário CAA)
                  </Text>
                </View>
                <Text style={[styles.staffPanelSub, { color: colors.textSecondary }]}>
                  Atualize a etapa/status ou envie um comentário de andamento que ficará visível para o aluno em tempo real:
                </Text>

                {/* Seletor de Status/Etapa */}
                <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                  Definir Novo Status / Etapa:
                </Text>
                <View style={styles.statusChipsWrap}>
                  {STATUS_OPTIONS.map((opt) => {
                    const isSelected =
                      selectedStatus === opt.status && selectedStage === opt.stage;
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
                          {
                            backgroundColor: colors.card,
                            borderColor: isSelected ? opt.color : colors.border,
                          },
                          isSelected && { backgroundColor: opt.color },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusOptionText,
                            { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Etapa Customizável */}
                <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: 10 }]}>
                  Etapa Exibida ao Aluno:
                </Text>
                <TextInput
                  style={[
                    styles.stageInput,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={selectedStage}
                  onChangeText={setSelectedStage}
                  placeholder="Ex: Em análise pela Coordenação..."
                  placeholderTextColor={colors.textMuted}
                />

                {/* Adicionar Comentário de Andamento */}
                <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: 10 }]}>
                  Adicionar Comentário / Atualização de Andamento:
                </Text>
                <TextInput
                  style={[
                    styles.commentInput,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Escreva uma orientação, solicitação de documento ou parecer parcial para o estudante..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[
                    styles.saveUpdateBtn,
                    { backgroundColor: colors.primary },
                    saving && { opacity: 0.7 },
                  ]}
                  activeOpacity={0.85}
                  disabled={saving}
                  onPress={handleSaveUpdate}
                >
                  {saving ? (
                    <View key="modal-saving">
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  ) : (
                    <View key="modal-save-idle" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Send size={16} color="#FFFFFF" />
                      <Text style={styles.saveUpdateBtnText}>
                        Atualizar Status & Publicar Comentário
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}

            
            {/* Linha do Tempo do Atendimento (Timeline de Etapas) */}
            <View
              style={[
                styles.cardSection,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Clock size={16} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                  Linha do Tempo até a Conclusão ({(localReq.steps || []).length} etapas)
                </Text>
              </View>

              <View style={styles.modalTimelineWrap}>
                {(localReq.steps || []).map((step: any, idx: number) => {
                  const isCompleted = step.completed;
                  const isActive = step.active;
                  return (
                    <View key={idx} style={styles.modalTimelineRow}>
                      <View style={styles.modalTimelineLeftCol}>
                        <View
                          style={[
                            styles.modalTimelineDot,
                            isCompleted && { backgroundColor: colors.primary, borderColor: colors.primary },
                            isActive && {
                              backgroundColor: '#2563EB',
                              borderColor: '#2563EB',
                              transform: [{ scale: 1.15 }],
                            },
                            !isCompleted && !isActive && {
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          {isCompleted && <Check size={10} color="#FFFFFF" />}
                        </View>
                        {idx < (localReq.steps || []).length - 1 && (
                          <View
                            style={[
                              styles.modalTimelineLine,
                              { backgroundColor: isCompleted ? colors.primary : colors.border },
                            ]}
                          />
                        )}
                      </View>

                      <View style={styles.modalTimelineContentCol}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text
                            style={[
                              styles.modalTimelineStepTitle,
                              { color: isActive ? colors.primary : colors.textPrimary },
                              (isCompleted || isActive) && { fontWeight: '700' },
                            ]}
                          >
                            {step.title}
                          </Text>
                          {step.date ? (
                            <Text style={[styles.modalTimelineStepDate, { color: colors.textMuted }]}>
                              {step.date}
                            </Text>
                          ) : null}
                        </View>
                        {step.description ? (
                          <Text style={[styles.modalTimelineStepDesc, { color: colors.textSecondary }]}>
                            {step.description}
                          </Text>
                        ) : null}
                        {step.authorName ? (
                          <Text style={{ fontSize: 10, color: colors.primary, marginTop: 2, fontWeight: '600' }}>
                            Responsável: {step.authorName} ({step.authorRole || 'Atendimento'})
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Histórico de Comentários e Atualizações */}
            <View
              style={[
                styles.cardSection,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <MessageSquare size={16} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                  Comentários e Atualizações ({commentsList.length})
                </Text>
              </View>

              {commentsList.length === 0 ? (
                <Text style={[styles.emptyCommentsText, { color: colors.textMuted }]}>
                  Nenhum comentário adicional registrado ainda neste protocolo.
                </Text>
              ) : (
                commentsList.map((c) => (
                  <View
                    key={c.id}
                    style={[
                      styles.commentItem,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.commentHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <User size={13} color={colors.primary} />
                        <Text style={[styles.commentAuthor, { color: colors.textPrimary }]}>
                          {c.author}
                        </Text>
                        <View
                          style={[
                            styles.rolePill,
                            { backgroundColor: colors.primaryLight },
                          ]}
                        >
                          <Text style={[styles.rolePillText, { color: colors.primaryDark }]}>
                            {c.role}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.commentDate, { color: colors.textMuted }]}>
                        {c.createdAt}
                      </Text>
                    </View>
                    {c.statusSnapshot && (
                      <Text style={[styles.commentStageSnap, { color: colors.secondary }]}>
                        Etapa: {c.statusSnapshot}
                      </Text>
                    )}
                    <Text style={[styles.commentBody, { color: colors.textSecondary }]}>
                      {c.text}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* Anexos e Documentos */}
            <View
              style={[
                styles.cardSection,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <FileText size={16} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                    Documentos e Anexos ({((localReq.studentAttachments || []).length) + ((localReq.staffAttachments || []).length)})
                  </Text>
                </View>
                {!isStaff && localReq.status !== 'rejected' && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={uploadingAttachment}
                    onPress={() => handlePickAndUploadAttachment('student')}
                    style={[styles.attachSmallBtn, { backgroundColor: colors.primaryLight }]}
                  >
                    {uploadingAttachment ? (
                      <View key="modal-att-up-std">
                        <ActivityIndicator size="small" color={colors.primaryDark} />
                      </View>
                    ) : (
                      <View key="modal-att-idle-std" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Upload size={13} color={colors.primaryDark} />
                        <Text style={[styles.attachSmallBtnText, { color: colors.primaryDark }]}>Anexar</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                {isStaff && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={uploadingAttachment}
                    onPress={() => handlePickAndUploadAttachment('staff')}
                    style={[styles.attachSmallBtn, { backgroundColor: colors.primaryLight }]}
                  >
                    {uploadingAttachment ? (
                      <View key="modal-att-up-staff">
                        <ActivityIndicator size="small" color={colors.primaryDark} />
                      </View>
                    ) : (
                      <View key="modal-att-idle-staff" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Upload size={13} color={colors.primaryDark} />
                        <Text style={[styles.attachSmallBtnText, { color: colors.primaryDark }]}>Anexar Parecer</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Anexos do Estudante */}
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.attachmentSubTitle, { color: colors.textSecondary, marginBottom: 6 }]}>
                  Enviados pelo Aluno ({(localReq.studentAttachments || []).length}):
                </Text>
                {(!localReq.studentAttachments || localReq.studentAttachments.length === 0) ? (
                  <Text style={[styles.emptyAttachmentText, { color: colors.textMuted }]}>
                    Nenhum documento anexado pelo estudante.
                  </Text>
                ) : (
                  localReq.studentAttachments.map((att) => (
                    <View
                      key={att.id}
                      style={[styles.attachmentItemRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleOpenAttachment(att)}
                        style={styles.attachmentItemLeft}
                      >
                        <View style={{ marginRight: 8 }}>
                          <FileText size={15} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.attachmentName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {att.name}
                          </Text>
                          <Text style={[styles.attachmentMeta, { color: colors.textSecondary }]}>
                            {att.uploadedAt}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <View style={styles.attachmentActionsRow}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleOpenAttachment(att)}
                          style={styles.attachmentActionBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Download size={15} color={colors.primary} />
                        </TouchableOpacity>
                        {(!isStaff || isStaff) && (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setAttachmentToDelete({ id: att.id, name: att.name, role: 'student' })}
                            style={styles.attachmentActionBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Trash2 size={15} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Anexos da Equipe / Devolutivas */}
              <View>
                <Text style={[styles.attachmentSubTitle, { color: colors.textSecondary, marginBottom: 6 }]}>
                  Devolutiva Oficial FECAP ({(localReq.staffAttachments || []).length}):
                </Text>
                {(!localReq.staffAttachments || localReq.staffAttachments.length === 0) ? (
                  <Text style={[styles.emptyAttachmentText, { color: colors.textMuted }]}>
                    Nenhum parecer técnico anexado ainda.
                  </Text>
                ) : (
                  localReq.staffAttachments.map((att) => (
                    <View
                      key={att.id}
                      style={[styles.attachmentItemRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleOpenAttachment(att)}
                        style={styles.attachmentItemLeft}
                      >
                        <View style={{ marginRight: 8 }}>
                          <ShieldCheck size={15} color="#059669" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.attachmentName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {att.name}
                          </Text>
                          <Text style={[styles.attachmentMeta, { color: colors.textSecondary }]}>
                            {att.uploadedAt}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <View style={styles.attachmentActionsRow}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleOpenAttachment(att)}
                          style={styles.attachmentActionBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Download size={15} color="#059669" />
                        </TouchableOpacity>
                        {isStaff && (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setAttachmentToDelete({ id: att.id, name: att.name, role: 'staff' })}
                            style={styles.attachmentActionBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Trash2 size={15} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Timeline de Etapas */}
            <View
              style={[
                styles.cardSection,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Linha do Tempo do Processo
              </Text>
              <View style={styles.timeline}>
                {(localReq.steps || []).map((step, index) => {
                  const isLast = index === (localReq.steps || []).length - 1;
                  return (
                    <View key={index} style={styles.stepItem}>
                      <View style={styles.indicatorCol}>
                        {step.completed ? (
                          <View style={[styles.dot, { backgroundColor: colors.primary }]}>
                            <CheckCircle2 size={14} color="#FFFFFF" />
                          </View>
                        ) : step.active ? (
                          <View style={[styles.dot, { backgroundColor: '#D97706' }]}>
                            <Clock size={14} color="#FFFFFF" />
                          </View>
                        ) : (
                          <View style={[styles.dot, { backgroundColor: colors.border }]} />
                        )}
                        {!isLast && (
                          <View
                            style={[
                              styles.line,
                              {
                                backgroundColor: step.completed
                                  ? colors.primary
                                  : colors.border,
                              },
                            ]}
                          />
                        )}
                      </View>
                      <View style={styles.stepContent}>
                        <Text
                          style={[
                            styles.stepTitle,
                            { color: colors.textPrimary },
                            step.active && { color: '#D97706', fontWeight: '700' },
                          ]}
                        >
                          {step.title}
                        </Text>
                        <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                          {step.description}
                        </Text>
                        {step.date && (
                          <Text style={[styles.stepDate, { color: colors.textMuted }]}>
                            {step.date}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>

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
  </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  protocolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  protocolText: {
    fontSize: 12,
    fontWeight: '800',
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: '600',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  studentMeta: {
    fontSize: 12,
    marginTop: 3,
    fontWeight: '500',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 32,
  },
  statusSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  stageTag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  stageTagText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  dateText: {
    fontSize: 11,
  },
  cardSection: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 20,
  },
  staffUpdatePanel: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  staffPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  staffPanelTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  staffPanelSub: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  statusChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusOptionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusOptionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stageInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 72,
  },
  saveUpdateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 12,
  },
  saveUpdateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCommentsText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  commentItem: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '700',
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  commentDate: {
    fontSize: 10,
  },
  commentStageSnap: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
  },
  commentBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  timeline: {
    marginTop: 4,
  },
  stepItem: {
    flexDirection: 'row',
    minHeight: 58,
  },
  indicatorCol: {
    alignItems: 'center',
    width: 26,
    marginRight: 10,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 3,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 12,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  stepDate: {
    fontSize: 10,
    marginTop: 2,
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
  attachmentSubTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyAttachmentText: {
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 2,
  },
  attachmentItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
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
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentName: {
    fontSize: 11,
    fontWeight: '600',
  },
  attachmentMeta: {
    fontSize: 9,
    marginTop: 1,
  },
  modalTimelineWrap: {
    paddingLeft: 4,
  },
  modalTimelineRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  modalTimelineLeftCol: {
    alignItems: 'center',
    width: 22,
    marginRight: 10,
  },
  modalTimelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTimelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  modalTimelineContentCol: {
    flex: 1,
  },
  modalTimelineStepTitle: {
    fontSize: 13,
  },
  modalTimelineStepDate: {
    fontSize: 10,
  },
  modalTimelineStepDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
});
