import React, { useState } from 'react';
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
} from 'react-native';
import {
  X,
  Send,
  Bell,
  Sparkles,
  ImagePlus,
  Trash2,
  Users,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { noticesService, FullNoticeItem, AUDIENCE_GROUPS } from '../../services/supabase/noticesService';
import { storageService } from '../../services/supabase/storageService';

interface CreateNoticeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (notice: FullNoticeItem) => void;
}

const CATEGORIES = ['Acadêmico', 'Financeiro', 'Carreira', 'Benefícios', 'Geral'];
const BADGES = ['Importante', 'Urgente', 'Novo', 'Inscrições Abertas', 'Passo a Passo'];

export const CreateNoticeModal: React.FC<CreateNoticeModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showToast } = useApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Acadêmico');
  const [badge, setBadge] = useState('Importante');
  const [targetAudience, setTargetAudience] = useState('Todos');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePickImage = async () => {
    setUploadingImage(true);
    try {
      const res = await storageService.pickAndUploadImage('notices-images', 'notice');
      if (!res.canceled) {
        if (res.publicUrl) {
          setImageUrl(res.publicUrl);
          showToast('Imagem enviada para o bucket notices-images!', 'success');
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

  const handleSubmit = async () => {
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
      const author = user?.name ? `${user.name} (${user.role || 'Staff'})` : 'Secretaria Geral ASA FECAP';
      const created = await noticesService.createNotice({
        title: title.trim(),
        category,
        badge,
        summary: summary.trim(),
        content: content.trim() || summary.trim(),
        target_audience: targetAudience,
        author,
        image_url: imageUrl,
      });

      if (created) {
        showToast('Aviso publicado no mural dos alunos com sucesso!', 'success');
        setTitle('');
        setCategory('Acadêmico');
        setBadge('Importante');
        setTargetAudience('Todos');
        setSummary('');
        setContent('');
        setImageUrl(undefined);
        if (onSuccess) onSuccess(created);
        onClose();
      } else {
        showToast('Não foi possível salvar o aviso.', 'error');
      }
    } catch (e) {
      console.warn('Erro ao criar aviso:', e);
      showToast('Erro ao publicar aviso.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

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
                Lançar Aviso no Mural
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Banner Informativo */}
            <View style={[styles.infoBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Sparkles size={16} color={colors.primaryDark} />
              <Text style={[styles.infoBannerText, { color: colors.primaryDark }]}>
                Este aviso aparecerá imediatamente no Mural e na Central de Notificações dos estudantes.
              </Text>
            </View>

            {/* Upload de Imagem do Aviso (Bucket notices-images) */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Imagem / Banner do Comunicado (Bucket Supabase)
            </Text>
            {imageUrl ? (
              <View style={[styles.imagePreviewBox, { borderColor: colors.border }]}>
                <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setImageUrl(undefined)}
                >
                  <Trash2 size={16} color="#FFFFFF" />
                  <Text style={styles.removeImageText}>Remover Imagem</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={uploadingImage}
                onPress={handlePickImage}
                style={[styles.imageUploadBtn, { backgroundColor: colors.backgroundAlt, borderColor: colors.primary }]}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <ImagePlus size={22} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.imageUploadTitle, { color: colors.textPrimary }]}>
                        Anexar Imagem ao Comunicado
                      </Text>
                      <Text style={[styles.imageUploadSub, { color: colors.textMuted }]}>
                        JPG, PNG ou WEBP • Enviado para o bucket notices-images
                      </Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Título */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>
              Título do Comunicado *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              placeholder="Ex: Plantão Extra de Renegociação de Mensalidades PAFE"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            {/* Categoria */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>
              Categoria
            </Text>
            <View style={styles.chipsRow}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                      isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.textPrimary },
                        isSelected && { color: '#FFFFFF', fontWeight: 'bold' },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selo / Badge */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>
              Destaque / Badge
            </Text>
            <View style={styles.chipsRow}>
              {BADGES.map((b) => {
                const isSelected = badge === b;
                return (
                  <TouchableOpacity
                    key={b}
                    onPress={() => setBadge(b)}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                      isSelected && { backgroundColor: colors.secondary, borderColor: colors.secondary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.textPrimary },
                        isSelected && { color: '#FFFFFF', fontWeight: 'bold' },
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Controle de Público-Alvo e Destinatários */}
            <View style={styles.audienceSectionWrapper}>
              <View style={styles.audienceSectionHeader}>
                <Users size={16} color={colors.primary} />
                <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>
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
                  <View style={styles.chipsRow}>
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
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>
              Resumo (Card no Mural) *
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  height: 70,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              placeholder="Breve descrição que ficará visível no card..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
              value={summary}
              onChangeText={setSummary}
            />

            {/* Conteúdo Completo */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>
              Conteúdo Detalhado (Opcional)
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  height: 100,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              placeholder="Texto completo exibido ao tocar no aviso, instruções, links ou regras..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              value={content}
              onChangeText={setContent}
            />

            {/* Botão de Envio */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
              disabled={submitting}
              onPress={handleSubmit}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <View style={{ marginRight: 8 }}><Send size={18} color="#FFFFFF" /></View>
                  <Text style={styles.submitBtnText}>Publicar no Mural dos Alunos</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  infoBannerText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
    fontWeight: '500',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imageUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 12,
  },
  imageUploadTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  imageUploadSub: {
    fontSize: 11,
    marginTop: 2,
  },
  imagePreviewBox: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 150,
  },
  removeImageBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
  audienceSectionWrapper: {
    marginTop: 14,
    marginBottom: 6,
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
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 24,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
