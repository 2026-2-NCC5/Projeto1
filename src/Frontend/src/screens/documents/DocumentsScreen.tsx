import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Share,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  FileText,
  Download,
  CheckCircle2,
  ShieldCheck,
  BookOpen,
  Share2,
  UploadCloud,
  Calendar,
  Award,
  DollarSign,
  Trash2,
  Search,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { UserRole } from '../../utils/constants';
import { documentosOficiais } from '../../services/ai-agent/data/documentosResumo';
import { DocumentUploadModal } from '../../components/admin/DocumentUploadModal';
import {
  storageService,
  UploadedInstitutionalDoc,
} from '../../services/supabase/storageService';
import { FadeInView, ScalePressable } from '../../components/common/AnimatedComponents';

interface DocItem {
  id: string;
  title: string;
  category: string;
  validity: string;
  description: string;
  arquivo: string;
  icon: any;
}

const FEATURED_DOCS_BY_ROLE: Record<UserRole, DocItem[]> = {
  Aluno: [
    {
      id: 'doc-01',
      title: 'Informativo Oficial de Rematrícula Graduação Presencial 2026-2',
      category: 'Rematrícula & Matrícula',
      validity: '4 páginas • PDF Integral',
      arquivo: '2026626_205153_Informativo Rematrícula Graduação Presencial 2026-2_vfinal_.pdf',
      description: 'Cronograma oficial CI 23/26, prazos de renovação automática, bolsas e rematrícula fora de época.',
      icon: FileText,
    },
    {
      id: 'doc-02',
      title: 'Calendário Acadêmico Oficial da Graduação 2026 (Veteranos)',
      category: 'Calendário Oficial',
      validity: 'Ano Letivo 2026 • PDF Integral',
      arquivo: '202671_182650_Calendário Graduação 2026 - versão 7_Discentes-Veteranos (1).pdf',
      description: 'Datas oficiais de início das aulas, P1, P2, Substitutivas, Exames Finais, feriados e recesso.',
      icon: Calendar,
    },
    {
      id: 'doc-12',
      title: 'Regulamento do Programa de Bolsas Restituíveis FECAP',
      category: 'Bolsas & Financiamento',
      validity: '7 páginas • PDF Integral',
      arquivo: 'Regulamento_do_Programa_de_Bolsas_Restituíveis_FECAP.pdf',
      description: 'Regras completas de elegibilidade, renda per capita, renovação semestral e restituição.',
      icon: Award,
    },
    {
      id: 'doc-11',
      title: 'Programa de Assistência Financeira Educacional (PAFE)',
      category: 'Apoio Financeiro',
      validity: '6 páginas • PDF Integral',
      arquivo: 'Programa_de_Assistencia_Financeira_Educacional.pdf',
      description: 'Normas de amparo financeiro estudantil em caso de perda de renda ou desemprego familiar.',
      icon: DollarSign,
    },
  ],
  'Funcionário': [
    {
      id: 'doc-11',
      title: 'Programa de Assistência Financeira Educacional (PAFE)',
      category: 'Permanência & Retenção',
      validity: '6 páginas • PDF Integral',
      arquivo: 'Programa_de_Assistencia_Financeira_Educacional.pdf',
      description: 'Documento base de triagem CAA para amparo financeiro e retenção de alunos em fragilidade.',
      icon: ShieldCheck,
    },
    {
      id: 'doc-12',
      title: 'Regulamento do Programa de Bolsas Restituíveis FECAP',
      category: 'Bolsas & Permanência',
      validity: '7 páginas • PDF Integral',
      arquivo: 'Regulamento_do_Programa_de_Bolsas_Restituíveis_FECAP.pdf',
      description: 'Critérios oficiais para concessão, manutenção de aproveitamento acadêmico e renovação.',
      icon: Award,
    },
    {
      id: 'doc-09',
      title: 'Grade Oficial de Horários - DPs e Adaptação aos Sábados 2026-2',
      category: 'Coordenação & Grade',
      validity: '2 páginas • PDF Integral',
      arquivo: '2026827_14268_Horario da Graduacao - DPs e Adapt Sabado - 2026-2 - 27-08-2026.pdf',
      description: 'Quadro oficial de turmas de Dependência e Adaptação aos sábados para orientação no balcão.',
      icon: BookOpen,
    },
    {
      id: 'doc-01',
      title: 'Informativo Oficial de Rematrícula Graduação Presencial 2026-2',
      category: 'Normas & Secretaria',
      validity: '4 páginas • PDF Integral',
      arquivo: '2026626_205153_Informativo Rematrícula Graduação Presencial 2026-2_vfinal_.pdf',
      description: 'Diretrizes da Circular Interna CI 23/26 para atendimento de rematrícula e acordos.',
      icon: FileText,
    },
  ],
};

function matchTitleOnly(title?: string | null, query?: string): boolean {
  if (!query || !query.trim()) return true;
  if (!title) return false;
  const normTitle = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const normQuery = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return normTitle.includes(normQuery);
}

export const DocumentsScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { showToast } = useApp();
  const { user, selectedRole } = useAuth();
  const currentRole: UserRole = (user?.role === 'Funcionário' || selectedRole === 'Funcionário') ? 'Funcionário' : 'Aluno';
  const docsList = FEATURED_DOCS_BY_ROLE[currentRole] || FEATURED_DOCS_BY_ROLE.Aluno;

  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<string[]>([]);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);

  const [dynamicDocs, setDynamicDocs] = useState<UploadedInstitutionalDoc[]>([]);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<UploadedInstitutionalDoc | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const isSearching = searchQuery.trim().length > 0;

  const filteredDynamicDocs = useMemo(() => {
    return dynamicDocs.filter((d) => matchTitleOnly(d.title, searchQuery));
  }, [dynamicDocs, searchQuery]);

  const filteredFeaturedDocs = useMemo(() => {
    return docsList.filter((d) => matchTitleOnly(d.title, searchQuery));
  }, [docsList, searchQuery]);

  const filteredBaseDocs = useMemo(() => {
    return (documentosOficiais || []).filter((d) => matchTitleOnly(d.titulo, searchQuery));
  }, [searchQuery]);

  const totalMatches =
    filteredDynamicDocs.length + filteredFeaturedDocs.length + filteredBaseDocs.length;

  const loadUploadedDocs = useCallback(async () => {
    const items = await storageService.listDynamicUploadedDocuments(currentRole);
    setDynamicDocs(items);
  }, [currentRole]);

  useEffect(() => {
    loadUploadedDocs();
  }, [loadUploadedDocs]);

  useFocusEffect(
    useCallback(() => {
      loadUploadedDocs();
    }, [loadUploadedDocs])
  );

  const handleDownloadRealPDF = async (doc: DocItem | any) => {
    setDownloadingId(doc.id);
    const title = doc.title || doc.titulo || 'Documento Oficial';
    try {
      const res = await storageService.downloadOriginalDocument(doc);
      setDownloadedIds((prev) => (prev.includes(doc.id) ? prev : [...prev, doc.id]));
      if (res.success) {
        showToast(`PDF original "${res.filename}" baixado em sua total integralidade!`, 'success');
      } else {
        showToast(`Não foi possível abrir "${title}".`, 'error');
      }
    } catch {
      showToast('Erro ao iniciar download do PDF original.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShareDocLink = async (doc: any) => {
    const info = storageService.getOriginalDocumentUrl(doc);
    try {
      await Share.share({
        title: info.title,
        message: `${info.title} (Documento Oficial Integral FECAP - DocumentosASA): ${info.url}`,
        url: info.url,
      });
    } catch (e) {
      console.warn('Erro ao compartilhar link do PDF:', e);
    }
  };

  const handleConfirmDeleteDoc = async () => {
    if (!confirmDeleteDoc) return;
    setDeletingDoc(true);
    const res = await storageService.deleteInstitutionalDocument(confirmDeleteDoc);
    setDeletingDoc(false);
    const deletedTitle = confirmDeleteDoc.title;
    setConfirmDeleteDoc(null);

    if (res.ok) {
      showToast(`"${deletedTitle}" removido do acervo e da base RAG!`, 'success');
      await loadUploadedDocs();
    } else {
      showToast(res.error || 'Não foi possível excluir o documento.', 'error');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <FadeInView delay={30}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Acervo Oficial DocumentosASA</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Download integral dos documentos oficiais da FECAP utilizados no treinamento da IA ({currentRole})
            </Text>
          </View>
        </FadeInView>

        {/* Campo de Pesquisa por Título */}
        <FadeInView delay={50}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.card,
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : colors.border,
              },
            ]}
          >
            <Search size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Pesquisar arquivo pelo título..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {isSearching && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.searchClearBtn}
              >
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </FadeInView>

        {/* Feedback visual de contagem da pesquisa */}
        {isSearching && (
          <FadeInView delay={60}>
            <View style={styles.searchFeedbackRow}>
              <Text style={[styles.searchFeedbackText, { color: colors.primary }]}>
                {totalMatches === 0
                  ? 'Nenhum arquivo encontrado'
                  : `${totalMatches} ${totalMatches === 1 ? 'arquivo encontrado' : 'arquivos encontrados'} pelo título`}
              </Text>
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={[styles.searchFeedbackClear, { color: colors.textMuted }]}>Limpar</Text>
              </TouchableOpacity>
            </View>
          </FadeInView>
        )}

        {/* Card de Upload RAG exclusivo para Funcionários (oculto durante pesquisa ativa) */}
        {!isSearching && currentRole === 'Funcionário' && (
          <FadeInView delay={80}>
            <ScalePressable onPress={() => setUploadModalVisible(true)}>
              <View
                style={[
                  styles.securityBanner,
                  {
                    backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE',
                    borderColor: '#0284C7',
                    marginBottom: 14,
                  },
                ]}
              >
                <UploadCloud size={28} color="#0284C7" />
                <View style={styles.securityInfo}>
                  <Text style={[styles.securityTitle, { color: '#0284C7' }]}>Upload & Grafo de Conhecimento (PDF / .MD)</Text>
                  <Text style={[styles.securityDesc, { color: colors.textSecondary }]}>
                    Publique novos regulamentos ou quadros de provas em PDF ou Markdown (.md) no acervo (App & Web) e no Grafo SISA.
                  </Text>
                </View>
              </View>
            </ScalePressable>
          </FadeInView>
        )}

        {/* Banner de Integralidade DocumentosASA (oculto durante pesquisa ativa) */}
        {!isSearching && (
          <FadeInView delay={120}>
            <View style={[styles.securityBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <ShieldCheck size={28} color={colors.primary} />
              <View style={styles.securityInfo}>
                <Text style={[styles.securityTitle, { color: colors.primaryDark }]}>
                  Arquivos Originais em Total Integralidade (PDF)
                </Text>
                <Text style={[styles.securityDesc, { color: colors.textSecondary }]}>
                  Todos os arquivos abaixo são os PDFs oficiais institucionais da FECAP, sincronizados entre App, Plataforma Web e SISA.
                </Text>
              </View>
            </View>
          </FadeInView>
        )}

        {/* Estado Vazio de Busca */}
        {isSearching && totalMatches === 0 && (
          <FadeInView delay={100}>
            <View style={[styles.emptySearchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <FileText size={40} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={[styles.emptySearchTitle, { color: colors.textPrimary }]}>
                Nenhum arquivo encontrado
              </Text>
              <Text style={[styles.emptySearchSubtitle, { color: colors.textSecondary }]}>
                Não encontramos nenhum documento cujo título contenha "{searchQuery}".
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSearchQuery('')}
                style={[styles.resetSearchBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.resetSearchBtnText}>Limpar pesquisa</Text>
              </TouchableOpacity>
            </View>
          </FadeInView>
        )}

        {/* Documentos Enviados Dinamicamente (Provas Oficiais, Novos Regulamentos, Uploads Web/App) */}
        {filteredDynamicDocs.length > 0 && (
          <View style={[styles.section, { marginBottom: 18 }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {isSearching
                ? `Publicações & Atualizações Recentes (${filteredDynamicDocs.length})`
                : `Publicações & Atualizações Recentes (${dynamicDocs.length})`}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Documentos adicionados ao acervo oficial e sincronizados com o Agente SISA
            </Text>
            {filteredDynamicDocs.map((upDoc, idx) => {
              const isProcessing = downloadingId === upDoc.id;
              const isDownloaded = downloadedIds.includes(upDoc.id);
              return (
                <FadeInView key={upDoc.id} delay={130 + idx * 45}>
                  <View style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
                    <View style={[styles.docIconBox, { backgroundColor: colors.primaryLight }]}>
                      <FileText size={24} color={colors.primary} />
                    </View>
                    <View style={styles.docContent}>
                      <Text style={[styles.docTitle, { color: colors.textPrimary }]}>{upDoc.title}</Text>
                      <Text style={[styles.docDesc, { color: colors.textSecondary }]} numberOfLines={3}>
                        {upDoc.description}
                      </Text>
                      <Text style={[styles.docValidity, { color: colors.primary }]}>
                        • {upDoc.category} • {upDoc.validity} • {upDoc.arquivo}
                      </Text>
                    </View>
                    <View style={styles.cardActionsCol}>
                      <ScalePressable onPress={() => handleDownloadRealPDF(upDoc)}>
                        <View
                          style={[
                            styles.emitButton,
                            { backgroundColor: colors.primary },
                            isProcessing && styles.emitButtonActive,
                          ]}
                        >
                          {isDownloaded ? (
                            <CheckCircle2 size={15} color="#FFFFFF" />
                          ) : (
                            <Download size={15} color="#FFFFFF" />
                          )}
                          <Text style={styles.emitButtonText}>
                            {isProcessing ? 'Abrindo...' : 'Baixar PDF'}
                          </Text>
                        </View>
                      </ScalePressable>

                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => handleShareDocLink(upDoc)}
                          style={[styles.shareMiniBtn, { borderColor: colors.border }]}
                        >
                          <Share2 size={13} color={colors.textSecondary} />
                        </TouchableOpacity>

                        {currentRole === 'Funcionário' && (
                          <TouchableOpacity
                            onPress={() => setConfirmDeleteDoc(upDoc)}
                            style={[
                              styles.shareMiniBtn,
                              {
                                borderColor: 'rgba(220, 38, 38, 0.45)',
                                backgroundColor: isDark ? 'rgba(220, 38, 38, 0.14)' : '#FEF2F2',
                              },
                            ]}
                          >
                            <Trash2 size={13} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                </FadeInView>
              );
            })}
          </View>
        )}

        {/* Destaques por Perfil */}
        {filteredFeaturedDocs.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {isSearching
                ? `Principais Regulamentos e Editais (${filteredFeaturedDocs.length})`
                : `Principais Regulamentos e Editais (${currentRole})`}
            </Text>
            {filteredFeaturedDocs.map((doc, idx) => {
              const Icon = doc.icon;
              const isProcessing = downloadingId === doc.id;
              const isDownloaded = downloadedIds.includes(doc.id);

              return (
                <FadeInView key={`${doc.id}-${idx}`} delay={150 + idx * 50}>
                  <View style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.docIconBox, { backgroundColor: colors.secondaryLight }]}>
                      <Icon size={24} color={colors.secondary} />
                    </View>
                    <View style={styles.docContent}>
                      <Text style={[styles.docTitle, { color: colors.textPrimary }]}>{doc.title}</Text>
                      <Text style={[styles.docDesc, { color: colors.textSecondary }]}>{doc.description}</Text>
                      <Text style={[styles.docValidity, { color: colors.primary }]}>
                        • {doc.validity} • {doc.arquivo}
                      </Text>
                    </View>
                    <View style={styles.cardActionsCol}>
                      <ScalePressable onPress={() => handleDownloadRealPDF(doc)}>
                        <View
                          style={[
                            styles.emitButton,
                            { backgroundColor: colors.primary },
                            isProcessing && styles.emitButtonActive,
                          ]}
                        >
                          {isDownloaded ? (
                            <CheckCircle2 size={15} color="#FFFFFF" />
                          ) : (
                            <Download size={15} color="#FFFFFF" />
                          )}
                          <Text style={styles.emitButtonText}>
                            {isProcessing ? 'Abrindo...' : 'Baixar PDF'}
                          </Text>
                        </View>
                      </ScalePressable>

                      <TouchableOpacity
                        onPress={() => handleShareDocLink(doc)}
                        style={[styles.shareMiniBtn, { borderColor: colors.border }]}
                      >
                        <Share2 size={13} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </FadeInView>
              );
            })}
          </View>
        )}

        {/* Catálogo Completo dos 12 PDFs da Pasta DocumentosASA */}
        {filteredBaseDocs.length > 0 && (
          <View style={[styles.section, { marginTop: 18 }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {isSearching
                ? `Arquivos Base DocumentosASA (${filteredBaseDocs.length})`
                : 'Todos os Arquivos Base DocumentosASA (12 PDFs)'}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Base documental permanente utilizada para o treinamento e Grafo de Conhecimento do Agente SISA
            </Text>
            {filteredBaseDocs.map((d, idx) => {
              const isProcessing = downloadingId === d.id;
              const isDownloaded = downloadedIds.includes(d.id);
              return (
                <FadeInView key={d.id} delay={250 + idx * 35}>
                  <View style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.docIconBox, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : '#E0F2FE' }]}>
                      <BookOpen size={24} color="#0284C7" />
                    </View>
                    <View style={styles.docContent}>
                      <Text style={[styles.docTitle, { color: colors.textPrimary }]}>{d.titulo}</Text>
                      <Text style={[styles.docDesc, { color: colors.textSecondary }]}>
                        {d.categoria} • {d.paginas} página(s) • PDF Original Integral
                      </Text>
                      <Text style={[styles.docValidity, { color: '#0284C7' }]}>📄 {d.arquivo}</Text>
                    </View>
                    <View style={styles.cardActionsCol}>
                      <ScalePressable onPress={() => handleDownloadRealPDF(d)}>
                        <View
                          style={[
                            styles.emitButton,
                            { backgroundColor: '#0284C7' },
                            isProcessing && styles.emitButtonActive,
                          ]}
                        >
                          {isDownloaded ? (
                            <CheckCircle2 size={15} color="#FFFFFF" />
                          ) : (
                            <Download size={15} color="#FFFFFF" />
                          )}
                          <Text style={styles.emitButtonText}>
                            {isProcessing ? 'Baixando...' : 'Baixar PDF'}
                          </Text>
                        </View>
                      </ScalePressable>
                    </View>
                  </View>
                </FadeInView>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal de Upload de PDFs RAG para Funcionários */}
      <DocumentUploadModal
        visible={uploadModalVisible}
        onClose={() => setUploadModalVisible(false)}
        onSuccess={() => {
          loadUploadedDocs();
        }}
      />

      {/* Modal de Confirmação de Exclusão de Upload (Funcionário) */}
      <Modal
        visible={Boolean(confirmDeleteDoc)}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => !deletingDoc && setConfirmDeleteDoc(null)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Trash2 size={22} color="#DC2626" />
              <Text style={[styles.deleteModalTitle, { color: colors.textPrimary }]}>
                Excluir Documento Enviado?
              </Text>
            </View>
            <Text style={[styles.deleteModalText, { color: colors.textSecondary }]}>
              Deseja remover permanentemente "{confirmDeleteDoc?.title}" do Acervo Oficial (App e Web) e da base dinâmica da IA SISA?
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                disabled={deletingDoc}
                onPress={() => setConfirmDeleteDoc(null)}
                style={[styles.deleteCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={deletingDoc}
                onPress={handleConfirmDeleteDoc}
                style={styles.deleteConfirmBtn}
              >
                {deletingDoc ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Excluir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 6,
  },
  searchFeedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  searchFeedbackText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  searchFeedbackClear: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptySearchCard: {
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySearchSubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  resetSearchBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
  },
  resetSearchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 24,
    gap: 14,
  },
  securityInfo: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  securityDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  docIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docContent: {
    flex: 1,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  docDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
  },
  docValidity: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardActionsCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  emitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    gap: 5,
  },
  emitButtonActive: {
    opacity: 0.7,
  },
  emitButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  shareMiniBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  deleteModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  deleteModalText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  deleteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  deleteCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  deleteConfirmBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    minWidth: 84,
    alignItems: 'center',
  },
});
