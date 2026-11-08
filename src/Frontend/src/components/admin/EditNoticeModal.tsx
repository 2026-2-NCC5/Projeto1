import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import {
  X,
  Save,
  Trash2,
  Bell,
  Sparkles,
  ImagePlus,
  AlertTriangle,
  RotateCcw,
  Users,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useApp } from '../../store/AppContext';
import { noticesService, FullNoticeItem, AUDIENCE_GROUPS } from '../../services/supabase/noticesService';
import { storageService } from '../../services/supabase/storageService';

interface EditNoticeModalProps {
  visible: boolean;
  notice: FullNoticeItem | null;
  onClose: () => void;
  onSuccess?: () => void;
  onDeleted?: () => void;
}

const CATEGORIES = ['Acadêmico', 'Financeiro', 'Carreira', 'Benefícios', 'Geral'];
const BADGES = ['Importante', 'Urgente', 'Novo', 'Inscrições Abertas', 'Passo a Passo'];

export const EditNoticeModal: React.FC<EditNoticeModalProps> = ({
  visible,
  notice,
  onClose,
  onSuccess,
  onDeleted,
}) => {
  const { colors, isDark } = useTheme();
  const { showToast } = useApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Acadêmico');
  const [badge, setBadge] = useState('Importante');
  const [targetAudience, setTargetAudience] = useState('Todos');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Carrega os dados do aviso selecionado quando o modal é aberto
  useEffect(() => {
    if (notice && visible) {
      setTitle(notice.title || '');
      setCategory(notice.category || 'Acadêmico');
      setBadge(notice.badge || 'Importante');
      setTargetAudience(notice.target_audience || 'Todos');
      setSummary(notice.summary || '');
      setContent(notice.content || notice.summary || '');
      setImageUrl(notice.imageUrl || null);
      setConfirmDelete(false);
    }
  }, [notice, visible]);

  const handlePickImage = async () => {
    setUploadingImage(true);
    try {
      const res = await storageService.pickAndUploadImage('notices-images', 'notice');
      if (!res.canceled) {
        if (res.publicUrl) {
          setImageUrl(res.publicUrl);
          showToast('Imagem atualizada com sucesso no bucket!', 'success');
        } else {
          showToast(res.error || 'Erro ao enviar imagem.', 'error');
        }
      }
    } catch (e) {
      showToast('Erro ao selecionar imagem.', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    showToast('Imagem removida do aviso.', 'info');
  };

  const handleSave = async () => {
    if (!notice) return;
    if (!title.trim()) {
      showToast('O título do comunicado é obrigatório.', 'info');
      return;
    }
    if (!summary.trim()) {
      showToast('Insira um resumo breve para o mural.', 'info');
      return;
    }

    setSubmitting(true);
    try {
      const success = await noticesService.updateNotice(notice.id, {
        title: title.trim(),
        category,
        badge,
        summary: summary.trim(),
        content: content.trim() || summary.trim(),
        target_audience: targetAudience,
        image_url: imageUrl,
      });

      if (success) {
        showToast('Aviso atualizado no mural com sucesso!', 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast('Não foi possível salvar as alterações do aviso.', 'error');
      }
    } catch (e) {
      console.warn('Erro ao atualizar aviso:', e);
      showToast('Erro ao atualizar comunicado.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!notice) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    try {
      const success = await noticesService.deleteNotice(notice.id);
      if (success) {
        showToast('Aviso removido do mural com sucesso!', 'success');
        if (onDeleted) onDeleted();
        onClose();
      } else {
        showToast('Não foi possível excluir o aviso.', 'error');
      }
    } catch (e) {
      console.warn('Erro ao excluir aviso:', e);
      showToast('Erro ao excluir o comunicado.', 'error');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (!notice) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      statusBarTranslucent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Bell size={20} color={colors.primary} />
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Editar Comunicado
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Banner de Status */}
            <View style={[styles.infoBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Sparkles size={16} color={colors.primaryDark} />
              <Text style={[styles.infoBannerText, { color: colors.primaryDark }]}>
                As alterações serão refletidas em tempo real para os alunos no app.
              </Text>
            </View>

            {/* Imagem do Comunicado */}
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              Banner Ilustrativo
            </Text>
            {imageUrl ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: imageUrl }} style={styles.imagePreview} resizeMode="cover" />
                <View style={styles.imageActionsRow}>
                  <TouchableOpacity
                    onPress={handlePickImage}
                    disabled={uploadingImage}
                    style={[styles.imgActionBtn, { backgroundColor: colors.primary }]}
                  >
                    {uploadingImage ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <ImagePlus size={14} color="#FFFFFF" />
                        <Text style={styles.imgActionText}>Alterar Foto</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleRemoveImage}
                    style={[styles.imgActionBtn, { backgroundColor: '#EF4444' }]}
                  >
                    <Trash2 size={14} color="#FFFFFF" />
                    <Text style={styles.imgActionText}>Remover</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={uploadingImage}
                style={[
                  styles.uploadPlaceholder,
                  { borderColor: colors.border, backgroundColor: colors.backgroundAlt },
                ]}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <ImagePlus size={24} color={colors.textSecondary} />
                    <Text style={[styles.uploadText, { color: colors.textSecondary }]}>
                      Adicionar Imagem do Bucket
                    </Text>
                    <Text style={[styles.uploadSubtext, { color: colors.textMuted }]}>
                      Formatos aceitos: JPG, PNG, WEBP
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Título */}
            <Text style={[styles.label, { color: colors.textPrimary }]}>Título Oficial *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Programa de Mentoria Alvarista 2026"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                { backgroundColor: colors.backgroundAlt, borderColor: colors.border, color: colors.textPrimary },
              ]}
            />

            {/* Categoria */}
            <Text style={[styles.label, { color: colors.textPrimary }]}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.backgroundAlt,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? '#FFFFFF' : colors.textSecondary, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Badge de Destaque */}
            <Text style={[styles.label, { color: colors.textPrimary }]}>Etiqueta / Badge</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
              {BADGES.map((b) => {
                const isSelected = badge === b;
                return (
                  <TouchableOpacity
                    key={b}
                    onPress={() => setBadge(b)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? colors.primaryLight : colors.backgroundAlt,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? colors.primaryDark : colors.textSecondary, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Controle de Público-Alvo e Destinatários */}
            <View style={styles.audienceSectionWrapper}>
              <View style={styles.audienceSectionHeader}>
                <Users size={16} color={colors.primary} />
                <Text style={[styles.label, { color: colors.textPrimary, marginBottom: 0 }]}>
                  Público-Alvo & Destinatários *
                </Text>
              </View>
              <Text style={[styles.audienceHelpText, { color: colors.textMuted }]}>
                Selecione os estudantes que visualizarão este comunicado no mural e nas notificações.
              </Text>

              {/* Destinatário Selecionado */}
              <View style={[styles.activeAudienceBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <Text style={[styles.activeAudienceLabel, { color: colors.primaryDark }]}>
                  🎯 Destinatário Selecionado:
                </Text>
                <Text style={[styles.activeAudienceValue, { color: colors.primaryDark }]}>
                  {targetAudience}
                </Text>
              </View>

              {AUDIENCE_GROUPS.map((group) => (
                <View key={group.title} style={styles.audienceGroupBlock}>
                  <Text style={[styles.audienceGroupTitle, { color: colors.textSecondary }]}>
                    {group.title}
                  </Text>
                  <View style={styles.chipsRowWrap}>
                    {group.options.map((opt) => {
                      const isSelected = targetAudience === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => setTargetAudience(opt.value)}
                          activeOpacity={0.7}
                          style={[
                            styles.chip,
                            { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                            isSelected && {
                              backgroundColor: colors.primary,
                              borderColor: colors.primary,
                            },
                          ]}
                        >
                          {isSelected ? (
                            <Check size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                          ) : null}
                          <Text
                            style={[
                              styles.chipText,
                              { color: colors.textPrimary },
                              isSelected && { color: '#FFFFFF', fontWeight: 'bold' },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>

            {/* Resumo */}
            <Text style={[styles.label, { color: colors.textPrimary }]}>Resumo do Mural *</Text>
            <TextInput
              value={summary}
              onChangeText={setSummary}
              placeholder="Breve resumo em até duas linhas que aparecerá no card do mural..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
              style={[
                styles.textArea,
                { height: 68, backgroundColor: colors.backgroundAlt, borderColor: colors.border, color: colors.textPrimary },
              ]}
            />

            {/* Conteúdo Completo */}
            <Text style={[styles.label, { color: colors.textPrimary }]}>Conteúdo Detalhado</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Texto completo do informativo, orientações detalhadas, links e prazos..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              style={[
                styles.textArea,
                { height: 110, backgroundColor: colors.backgroundAlt, borderColor: colors.border, color: colors.textPrimary },
              ]}
            />

            {/* Seção de Exclusão Perigosa */}
            <View
              style={[
                styles.deleteSection,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5',
                },
              ]}
            >
              <View style={styles.deleteSectionHeader}>
                <AlertTriangle size={16} color="#DC2626" />
                <Text style={styles.deleteSectionTitle}>Zona de Exclusão</Text>
              </View>
              <Text style={styles.deleteSectionDesc}>
                {confirmDelete
                  ? 'Tem certeza? Clique no botão vermelho novamente para confirmar a remoção permanente.'
                  : 'Ao excluir, este comunicado não será mais exibido no mural de estudantes.'}
              </Text>
              <TouchableOpacity
                onPress={handleDelete}
                disabled={deleting}
                style={[
                  styles.deleteBtn,
                  { backgroundColor: confirmDelete ? '#DC2626' : 'transparent', borderColor: '#DC2626' },
                ]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Trash2 size={16} color={confirmDelete ? '#FFFFFF' : '#DC2626'} />
                    <Text
                      style={[
                        styles.deleteBtnText,
                        { color: confirmDelete ? '#FFFFFF' : '#DC2626' },
                      ]}
                    >
                      {confirmDelete ? 'Confirmar Exclusão' : 'Excluir Este Aviso'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {confirmDelete && (
                <TouchableOpacity
                  onPress={() => setConfirmDelete(false)}
                  style={styles.cancelDeleteBtn}
                >
                  <RotateCcw size={14} color={colors.textSecondary} />
                  <Text style={[styles.cancelDeleteText, { color: colors.textSecondary }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ height: 28 }} />
          </ScrollView>

          {/* Footer com Botões de Ação */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting || deleting}
              style={[styles.cancelBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={submitting || deleting}
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Save size={16} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Salvar Alterações</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoBannerText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 16,
  },
  textArea: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
  },
  chipsRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  audienceSectionWrapper: {
    marginTop: 4,
    marginBottom: 16,
  },
  audienceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  audienceHelpText: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8,
  },
  activeAudienceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  activeAudienceLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  activeAudienceValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  audienceGroupBlock: {
    marginBottom: 10,
  },
  audienceGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  uploadPlaceholder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 4,
  },
  uploadText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  uploadSubtext: {
    fontSize: 11,
  },
  previewContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
  },
  imageActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  imgActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  imgActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteSection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
  },
  deleteSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  deleteSectionTitle: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteSectionDesc: {
    color: '#B91C1C',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cancelDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 4,
  },
  cancelDeleteText: {
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    height: 46,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
