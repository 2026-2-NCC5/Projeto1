import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  FileText,
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Building2,
  Calendar,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  Check,
  ArrowRight,
  DollarSign,
  Tag,
  Paperclip,
  Upload,
  Trash2,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, typography, borderRadius } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { FadeInView, ScalePressable } from '../common/AnimatedComponents';
import { storageService } from '../../services/supabase/storageService';
import { RequirementAttachment } from '../../utils/constants';
import requerimentosCatalog from '../../data/requerimentos.json';

export interface OfficialRequirementItem {
  id: string;
  titulo: string;
  grupo_de_atendimento: string;
  valor: string;
  tipo_de_requerimento?: string;
  descricao: string;
  procedimentos?: string;
  anexos_obrigatorios?: string[];
  campos_extras?: Array<{ campo: string; tipo: string; obrigatorio?: boolean }>;
  caminho_sistema?: string;
  tags?: string[];
}

const CATALOG: OfficialRequirementItem[] = requerimentosCatalog as OfficialRequirementItem[];

const GROUPS = [
  'Todos',
  'Serviços Acadêmicos',
  'Serviços Financeiros',
  'Documentos Acadêmicos',
  'Bolsas e Financiamentos',
  'Plataformas Digitais',
  'Biblioteca',
  'Documentos Financeiros',
  'Boas Práticas',
  'Reservas e Recursos',
  'Segurança',
  'Transporte e Estacionamento',
  'Internacionalização',
];

interface ManualRequirementModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (protocol: string) => void;
}

export const ManualRequirementModal: React.FC<ManualRequirementModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { addRequirement, showToast } = useApp();

  const [selectedReq, setSelectedReq] = useState<OfficialRequirementItem>(CATALOG[0] || {} as any);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [showCatalogSelector, setShowCatalogSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('Todos');
  const [createdProtocol, setCreatedProtocol] = useState<string | null>(null);

  const [attachments, setAttachments] = useState<RequirementAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const handlePickAttachment = async () => {
    setUploadingAttachment(true);
    try {
      const res = await storageService.pickAndUploadRequirementAttachment('novo-requerimento', 'Aluno');
      if (res.canceled) return;
      if (res.attachment) {
        setAttachments((prev) => [...prev, res.attachment!]);
        showToast('Documento anexado com sucesso!', 'success');
      } else if (res.error) {
        showToast(res.error, 'error');
      }
    } catch {
      showToast('Erro ao anexar arquivo.', 'error');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
    showToast('Anexo removido.', 'info');
  };

  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates?.height || 280);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Filtro em tempo real de todos os 82 requerimentos
  const filteredCatalog = useMemo(() => {
    return CATALOG.filter((item) => {
      const matchesGroup = selectedGroup === 'Todos' || item.grupo_de_atendimento === selectedGroup;
      if (!matchesGroup) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = item.titulo.toLowerCase().includes(q);
      const inDesc = item.descricao.toLowerCase().includes(q);
      const inTags = item.tags?.some((t) => t.toLowerCase().includes(q));
      return inTitle || inDesc || inTags;
    });
  }, [searchQuery, selectedGroup]);

  const handleSubmit = async () => {
    if (!description.trim() || description.trim().length < 8) {
      const msg = 'Por favor, informe uma justificativa detalhada (mínimo de 8 caracteres).';
      setFieldError(msg);
      Alert.alert(
        'Campo Obrigatório',
        'Por favor, preencha a justificativa detalhada da sua solicitação antes de enviar o requerimento.',
        [{ text: 'Entendi' }]
      );
      showToast(msg, 'error');
      return;
    }
    setFieldError('');

    setSubmitting(true);
    try {
      const created = await addRequirement({
        title: selectedReq.titulo,
        type: selectedReq.grupo_de_atendimento,
        currentStage: 'Aguardando Triagem CAA',
        status: 'pending',
        description: description.trim(),
        studentRa: user?.ra || '24026851',
        studentName: user?.name || 'Lucas Alvarista',
        studentCourse: user?.course || 'Ciência da Computação',
        studentAttachments: attachments,
        steps: [
          {
            title: 'Abertura do Protocolo',
            description: 'Registrado oficialmente pelo estudante via App ASA',
            completed: true,
            active: false,
            date: new Date().toLocaleDateString('pt-BR'),
          },
          {
            title: 'Triagem e Encaminhamento CAA',
            description: `Setor responsável: ${selectedReq.grupo_de_atendimento}`,
            completed: false,
            active: true,
            date: 'Em andamento',
          },
          {
            title: 'Análise Técnica & Parecer',
            description: `Taxa: ${selectedReq.valor || 'R$0,00'} • Prazo regulamentar de atendimento`,
            completed: false,
            active: false,
          },
          {
            title: 'Conclusão e Despacho Final',
            description: 'Emissão de documento ou parecer oficial no Portal do Aluno',
            completed: false,
            active: false,
          },
        ],
      });

      setCreatedProtocol(created.protocol);
      if (onSuccess) onSuccess(created.protocol);
    } catch (err: any) {
      console.warn('Erro ao abrir requerimento manualmente:', err);
      showToast('Erro ao protocolar requerimento.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    Keyboard.dismiss();
    setDescription('');
    setAttachments([]);
    setCreatedProtocol(null);
    setShowCatalogSelector(false);
    setSearchQuery('');
    setSelectedGroup('Todos');
    setKeyboardHeight(0);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={handleResetAndClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerIconBox, { backgroundColor: colors.primaryLight }]}>
                <FileText size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  {showCatalogSelector ? 'Catálogo de Requerimentos' : 'Novo Requerimento Acadêmico'}
                </Text>
                <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
                  {showCatalogSelector
                    ? `${filteredCatalog.length} opções disponíveis • FECAP Oficial`
                    : 'Protocolo Oficial • Central de Atendimento ao Aluno (CAA)'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleResetAndClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {showCatalogSelector ? (
            /* VISUALIZADOR E BUSCA DO CATÁLOGO COMPLETO DE 82 REQUERIMENTOS */
            <View style={styles.catalogContainer}>
              {/* Barra de Pesquisa */}
              <View style={[styles.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Search size={18} color={colors.textMuted} />
                <TextInput
                  placeholder="Pesquisar por nome, taxa ou palavras-chave..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                  placeholderTextColor={colors.textMuted}
                  autoFocus={true}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Chips de Categorias / Grupos de Atendimento */}
              <View style={styles.groupChipsWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.groupChipsScroll}
                >
                  {GROUPS.map((grp) => {
                    const isSel = selectedGroup === grp;
                    return (
                      <TouchableOpacity
                        key={grp}
                        activeOpacity={0.7}
                        onPress={() => setSelectedGroup(grp)}
                        style={[
                          styles.groupChip,
                          { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                          isSel && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.groupChipText,
                            { color: colors.textSecondary },
                            isSel && { color: '#FFFFFF', fontWeight: '700' },
                          ]}
                        >
                          {grp}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Lista com todos os requerimentos filtrados */}
              <ScrollView style={styles.catalogList} showsVerticalScrollIndicator={false}>
                {filteredCatalog.length === 0 ? (
                  <View style={styles.emptyResultsBox}>
                    <AlertCircle size={32} color={colors.textMuted} />
                    <Text style={[styles.emptyResultsTitle, { color: colors.textPrimary }]}>
                      Nenhum requerimento encontrado
                    </Text>
                    <Text style={[styles.emptyResultsDesc, { color: colors.textSecondary }]}>
                      Tente buscar por outro termo ou selecione o grupo "Todos".
                    </Text>
                  </View>
                ) : (
                  filteredCatalog.map((item) => {
                    const isSelected = item.id === selectedReq.id;
                    const isFree = !item.valor || item.valor === 'R$0,00' || item.valor === 'R$ 0,00';

                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.75}
                        onPress={() => {
                          setSelectedReq(item);
                          setShowCatalogSelector(false);
                        }}
                        style={[
                          styles.catalogItemCard,
                          { backgroundColor: colors.background, borderColor: colors.border },
                          isSelected && {
                            borderColor: colors.primary,
                            backgroundColor: colors.primaryLight,
                          },
                        ]}
                      >
                        <View style={styles.catalogItemHeader}>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.catalogItemTitle,
                                { color: isSelected ? colors.primaryDark : colors.textPrimary },
                                isSelected && { fontWeight: '700' },
                              ]}
                            >
                              {item.titulo}
                            </Text>
                            <View style={styles.catalogMetaRow}>
                              <View
                                style={[
                                  styles.groupTag,
                                  { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                                ]}
                              >
                                <Building2 size={11} color={colors.textSecondary} style={{ marginRight: 3 }} />
                                <Text style={[styles.groupTagText, { color: colors.textSecondary }]}>
                                  {item.grupo_de_atendimento}
                                </Text>
                              </View>

                              <View
                                style={[
                                  styles.feeTag,
                                  {
                                    backgroundColor: isFree
                                      ? (isDark ? 'rgba(5, 150, 105, 0.2)' : '#D1FAE5')
                                      : (isDark ? 'rgba(234, 88, 12, 0.2)' : '#FFEDD5'),
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.feeTagText,
                                    { color: isFree ? '#059669' : '#C2410C' },
                                  ]}
                                >
                                  {isFree ? 'Gratuito' : item.valor}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {isSelected ? (
                            <View style={[styles.checkCircleBox, { backgroundColor: colors.primary }]}>
                              <Check size={14} color="#FFFFFF" />
                            </View>
                          ) : (
                            <ArrowRight size={16} color={colors.textMuted} />
                          )}
                        </View>
                        {item.descricao ? (
                          <Text
                            style={[styles.catalogItemDesc, { color: colors.textSecondary }]}
                            numberOfLines={2}
                          >
                            {item.descricao}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          ) : (
            /* FORMULÁRIO DE PREENCHIMENTO E PROTOCOLO */
            <ScrollView
              ref={scrollViewRef}
              style={styles.body}
              contentContainerStyle={[
                styles.bodyContent,
                { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 36 },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              {createdProtocol ? (
                <FadeInView delay={50}>
                  <View
                    style={[
                      styles.successBox,
                      {
                        backgroundColor: colors.primaryLight,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <CheckCircle2 size={44} color={colors.primary} />
                    <Text style={[styles.successTitle, { color: colors.primaryDark }]}>
                      Requerimento Protocolado com Sucesso!
                    </Text>
                    <View
                      style={[
                        styles.protocolBadge,
                        {
                          backgroundColor: isDark ? colors.backgroundAlt : '#FFFFFF',
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={styles.protocolBadgeLabel}>NÚMERO DE PROTOCOLO OFICIAL</Text>
                      <Text style={[styles.protocolBadgeValue, { color: colors.primary }]}>
                        {createdProtocol}
                      </Text>
                    </View>
                    <Text style={[styles.successDesc, { color: colors.textPrimary }]}>
                      Sua solicitação foi registrada no banco de dados oficial do ASA e direcionada para{' '}
                      <Text style={{ fontWeight: '700' }}>{selectedReq.grupo_de_atendimento}</Text>. Você pode
                      acompanhar o andamento, pareceres e etapas na aba de Requerimentos.
                    </Text>

                    <ScalePressable
                      onPress={handleResetAndClose}
                      style={[styles.successDoneBtn, { backgroundColor: colors.primary }]}
                    >
                      <Text style={styles.successDoneBtnText}>Concluir e Voltar</Text>
                    </ScalePressable>
                  </View>
                </FadeInView>
              ) : (
                <>
                  {/* Dados do Aluno Solicitante */}
                  <View
                    style={[
                      styles.studentSummaryCard,
                      { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.studentSummaryRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.studentName, { color: colors.textPrimary }]}>
                          {user?.name || 'Lucas Alvarista'}
                        </Text>
                        <Text style={[styles.studentMeta, { color: colors.textSecondary }]}>
                          RA: {user?.ra || '24026851'} • {user?.course || 'Ciência da Computação'}
                        </Text>
                      </View>
                      <View style={[styles.officialTag, { backgroundColor: colors.primaryLight }]}>
                        <ShieldCheck size={12} color={colors.primaryDark} style={{ marginRight: 3 }} />
                        <Text style={[styles.officialTagText, { color: colors.primaryDark }]}>
                          Vínculo Ativo
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Seletor do Tipo de Requerimento com Botão para Abrir Catálogo */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.label, { color: colors.textPrimary }]}>
                        Tipo de Solicitação Selecionada
                      </Text>
                      <TouchableOpacity onPress={() => setShowCatalogSelector(true)}>
                        <Text style={[styles.changeLinkText, { color: colors.primary }]}>
                          Ver todos ({CATALOG.length})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setShowCatalogSelector(true)}
                      style={[
                        styles.typeSelectorBtn,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.selectedTypeText, { color: colors.textPrimary }]}>
                          {selectedReq.titulo}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <Building2 size={12} color={colors.textSecondary} />
                          <Text style={[styles.selectedTypeMeta, { color: colors.textSecondary }]}>
                            {selectedReq.grupo_de_atendimento} • Taxa:{' '}
                            <Text style={{ fontWeight: '700' }}>
                              {!selectedReq.valor || selectedReq.valor === 'R$0,00'
                                ? 'Gratuito'
                                : selectedReq.valor}
                            </Text>
                          </Text>
                        </View>
                      </View>
                      <ChevronDown size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Detalhes Oficiais do Requerimento Selecionado */}
                  {selectedReq.descricao ? (
                    <View
                      style={[
                        styles.reqDetailBox,
                        { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.reqDetailTitle, { color: colors.textPrimary }]}>
                        Orientações e Normas do Serviço:
                      </Text>
                      <Text style={[styles.reqDetailText, { color: colors.textSecondary }]}>
                        {selectedReq.descricao}
                      </Text>
                      {selectedReq.caminho_sistema ? (
                        <Text style={[styles.systemPathText, { color: colors.textMuted }]}>
                          Origem: {selectedReq.caminho_sistema}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Justificativa / Descrição do Pedido */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.label, { color: colors.textPrimary }]}>
                        Justificativa / Detalhes do Pedido
                      </Text>
                      <Text style={[styles.charCount, { color: colors.textMuted }]}>
                        {description.length} caracteres
                      </Text>
                    </View>
                    <TextInput
                      placeholder="Descreva detalhadamente sua solicitação, motivos, disciplina ou documentos pertinentes..."
                      value={description}
                      onChangeText={(t) => {
                        setDescription(t);
                        if (fieldError) setFieldError('');
                      }}
                      multiline
                      numberOfLines={5}
                      onFocus={() => {
                        setTimeout(() => {
                          scrollViewRef.current?.scrollToEnd({ animated: true });
                        }, 250);
                      }}
                      style={[
                        styles.textArea,
                        {
                          backgroundColor: colors.background,
                          borderColor: fieldError ? '#EF4444' : colors.border,
                          borderWidth: fieldError ? 2 : 1,
                          color: colors.textPrimary,
                        },
                      ]}
                      placeholderTextColor={colors.textMuted}
                    />
                    {fieldError ? (
                      <View style={styles.errorAlertBox}>
                        <AlertCircle size={14} color="#EF4444" style={{ marginRight: 6 }} />
                        <Text style={styles.errorAlertText}>{fieldError}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Anexos e Comprovantes */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.label, { color: colors.textPrimary }]}>
                        Documentos e Comprovantes ({attachments.length})
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={uploadingAttachment}
                        onPress={handlePickAttachment}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        {uploadingAttachment ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <Upload size={13} color={colors.primary} />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                              Anexar Arquivo
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {attachments.length === 0 ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={uploadingAttachment}
                        onPress={handlePickAttachment}
                        style={[
                          styles.emptyAttachBox,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Paperclip size={18} color={colors.textMuted} style={{ marginBottom: 4 }} />
                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '500' }}>
                          Clique para anexar atestados, históricos, comprovantes ou fotos
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        {attachments.map((att) => (
                          <View
                            key={att.id}
                            style={[
                              styles.attachedFileItem,
                              { backgroundColor: colors.background, borderColor: colors.border },
                            ]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                              <FileText size={16} color={colors.primary} style={{ marginRight: 6 }} />
                              <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
                                {att.name}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleRemoveAttachment(att.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ padding: 4 }}
                            >
                              <Trash2 size={16} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        ))}
                        <TouchableOpacity
                          activeOpacity={0.8}
                          disabled={uploadingAttachment}
                          onPress={handlePickAttachment}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 6,
                            gap: 6,
                          }}
                        >
                          {uploadingAttachment ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <>
                              <Upload size={13} color={colors.primary} />
                              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
                                Anexar outro documento
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </>
                    )}
                  </View>

                  {/* Banner de Orientações Oficiais */}
                  <View
                    style={[
                      styles.guidelinesBox,
                      {
                        backgroundColor: isDark ? 'rgba(5, 150, 105, 0.12)' : '#F0FDF4',
                        borderColor: isDark ? 'rgba(5, 150, 105, 0.3)' : '#BBF7D0',
                      },
                    ]}
                  >
                    <AlertCircle size={18} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.guidelineTitle, { color: colors.primaryDark }]}>
                        Normas e Prazos Oficiais FECAP
                      </Text>
                      <Text style={[styles.guidelineText, { color: colors.textSecondary }]}>
                        O protocolo seguirá diretamente para triagem no setor {selectedReq.grupo_de_atendimento}. O
                        despacho e eventuais notificações serão acompanhados em tempo real pelo ASA.
                      </Text>
                    </View>
                  </View>

                  {/* Botão de Enviar Requerimento */}
                  <ScalePressable
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  >
                    <Send size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>
                      {submitting ? 'Registrando Protocolo...' : 'Protocolar Requerimento Oficial'}
                    </Text>
                  </ScalePressable>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '94%',
    flexShrink: 1,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
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
  headerTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
  },
  headerSub: {
    fontSize: typography.fontSizes.xs,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  catalogContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    maxHeight: 520,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    padding: 0,
  },
  groupChipsWrapper: {
    marginBottom: 10,
  },
  groupChipsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  groupChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  catalogList: {
    maxHeight: 380,
  },
  catalogItemCard: {
    padding: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  catalogItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  catalogItemTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '600',
    marginBottom: 4,
  },
  catalogMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  groupTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  groupTagText: {
    fontSize: 10,
  },
  feeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  feeTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  catalogItemDesc: {
    fontSize: 11,
    marginTop: 6,
    lineHeight: 15,
  },
  checkCircleBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyResultsBox: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyResultsTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '700',
  },
  emptyResultsDesc: {
    fontSize: 11,
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  bodyContent: {
    paddingBottom: spacing.xxl + 20,
  },
  studentSummaryCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  studentSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
  studentMeta: {
    fontSize: typography.fontSizes.xs,
    marginTop: 2,
  },
  officialTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  officialTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  changeLinkText: {
    fontSize: 11,
    fontWeight: '700',
  },
  charCount: {
    fontSize: 10,
  },
  typeSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  selectedTypeText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
  selectedTypeMeta: {
    fontSize: 11,
  },
  reqDetailBox: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  reqDetailTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  reqDetailText: {
    fontSize: 11,
    lineHeight: 16,
  },
  systemPathText: {
    fontSize: 10,
    marginTop: 6,
    fontStyle: 'italic',
  },
  textArea: {
    minHeight: 100,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: typography.fontSizes.sm,
    textAlignVertical: 'top',
  },
  guidelinesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  guidelineTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    marginBottom: 2,
  },
  guidelineText: {
    fontSize: 11,
    lineHeight: 15,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    marginBottom: 24,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
  successBox: {
    alignItems: 'center',
    padding: 24,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    marginVertical: 16,
    gap: 12,
  },
  successTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: '800',
    textAlign: 'center',
  },
  protocolBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  protocolBadgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  protocolBadgeValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  successDesc: {
    fontSize: typography.fontSizes.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  successDoneBtn: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: borderRadius.pill,
    marginTop: 8,
  },
  successDoneBtnText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.xs,
    fontWeight: '700',
  },
  emptyAttachBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    marginTop: 6,
  },
  errorAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  errorAlertText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});