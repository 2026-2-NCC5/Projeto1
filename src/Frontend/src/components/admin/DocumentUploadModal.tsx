import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { UploadCloud, FileText, CheckCircle2, X, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useApp } from '../../store/AppContext';
import { storageService } from '../../services/supabase/storageService';

interface DocumentUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { colors, isDark } = useTheme();
  const { showToast } = useApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Normas & Regulamentos');
  const [roleTarget, setRoleTarget] = useState('Todos');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ publicUrl?: string; chunksIndexed?: number } | null>(null);

  const categories = [
    'Normas & Regulamentos',
    'Calendário Acadêmico',
    'Secretaria Geral',
    'Financeiro & Bolsas',
    'Coordenação de Curso',
  ];

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/markdown', 'text/plain', 'text/x-markdown'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile(file);
        if (!title) {
          const cleanName = file.name.replace(/\.(pdf|md|markdown)$/i, '').replace(/[_-]+/g, ' ');
          setTitle(cleanName);
        }
      }
    } catch (err) {
      console.warn('Erro ao selecionar arquivo:', err);
      showToast('Erro ao selecionar arquivo PDF ou Markdown (.md)', 'error');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showToast('Por favor, selecione um arquivo PDF ou Markdown (.md).', 'info');
      return;
    }
    if (!title.trim()) {
      showToast('Por favor, informe o título do documento.', 'info');
      return;
    }

    setUploading(true);
    setSuccessInfo(null);

    try {
      const res = await storageService.uploadInstitutionalDocument({
        uri: selectedFile.uri,
        fileName: selectedFile.name || 'documento.pdf',
        webFile: selectedFile.file,
        title: title.trim(),
        category,
        roleTarget,
        description: description.trim(),
      });

      if (res.ok) {
        setSuccessInfo({ publicUrl: res.publicUrl, chunksIndexed: res.chunksIndexed });
        showToast('Documento publicado no Acervo Oficial e sincronizado com o Grafo Markdown da IA SISA!', 'success');
        if (onSuccess) onSuccess();
      } else {
        showToast(res.error || 'Falha ao publicar documento no Supabase Storage.', 'error');
      }
    } catch (error: any) {
      console.warn('Erro na requisição de upload:', error);
      showToast('Falha inesperada ao enviar documento.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleResetAndClose = () => {
    setTitle('');
    setDescription('');
    setSelectedFile(null);
    setSuccessInfo(null);
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
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <UploadCloud size={22} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Upload & Indexação no Grafo SISA (PDF / .MD)
              </Text>
            </View>
            <TouchableOpacity onPress={handleResetAndClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {successInfo ? (
              <View style={[styles.successBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <CheckCircle2 size={36} color={colors.primary} />
                <Text style={[styles.successTitle, { color: colors.primaryDark }]}>
                  Documento Publicado com Sucesso!
                </Text>
                <Text style={[styles.successDesc, { color: colors.textPrimary }]}>
                  O arquivo foi salvo no bucket oficial <Text style={{ fontWeight: '700' }}>documentos-asa</Text>,
                  disponibilizado no Acervo Oficial (App Mobile e Plataforma Web) e indexado no Grafo de Conhecimento em Markdown da IA SISA!
                </Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleResetAndClose}
                  style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.doneBtnText}>Concluir</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Seleção do Arquivo */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handlePickDocument}
                  style={[
                    styles.filePickerBox,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                      borderColor: selectedFile ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <FileText size={32} color={selectedFile ? colors.primary : colors.textMuted} />
                  {selectedFile ? (
                    <View style={{ alignItems: 'center', marginTop: 8 }}>
                      <Text style={[styles.fileName, { color: colors.primary, fontWeight: '700' }]}>
                        {selectedFile.name}
                      </Text>
                      <Text style={[styles.fileSize, { color: colors.textMuted }]}>
                        {selectedFile.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Arquivo Selecionado'}
                      </Text>
                      <Text style={[styles.changeFileTxt, { color: colors.secondary }]}>
                        Toque para alterar arquivo
                      </Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', marginTop: 8 }}>
                      <Text style={[styles.pickerPrompt, { color: colors.textPrimary }]}>
                        Selecionar Arquivo PDF ou Markdown (.md)
                      </Text>
                      <Text style={[styles.pickerSub, { color: colors.textSecondary }]}>
                        Suporta arquivos PDF e notas estruturadas em Markdown (.md) para o Grafo SISA
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Título do Documento */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Título Oficial</Text>
                  <TextInput
                    placeholder="Ex: Horários das Provas Oficiais 2026-2"
                    value={title}
                    onChangeText={setTitle}
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {/* Categoria */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Categoria</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                    {categories.map((cat) => {
                      const isSel = category === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setCategory(cat)}
                          style={[
                            styles.chip,
                            { backgroundColor: colors.background, borderColor: colors.border },
                            isSel && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                        >
                          <Text style={[styles.chipText, { color: colors.textSecondary }, isSel && { color: '#FFFFFF', fontWeight: '700' }]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Público Alvo */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Público Alvo</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {['Todos', 'Aluno', 'Funcionário'].map((rt) => {
                      const isSel = roleTarget === rt;
                      return (
                        <TouchableOpacity
                          key={rt}
                          onPress={() => setRoleTarget(rt)}
                          style={[
                            styles.chip,
                            { backgroundColor: colors.background, borderColor: colors.border, flex: 1, alignItems: 'center' },
                            isSel && { backgroundColor: colors.secondary, borderColor: colors.secondary },
                          ]}
                        >
                          <Text style={[styles.chipText, { color: colors.textSecondary }, isSel && { color: '#FFFFFF', fontWeight: '700' }]}>
                            {rt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Descrição / Resumo para IA */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Resumo & Informações Chave para a IA</Text>
                  <TextInput
                    placeholder="Informe prazos, datas, regras principais ou resumo deste PDF para consulta imediata pela SISA..."
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    style={[
                      styles.input,
                      styles.textArea,
                      { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                    ]}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {/* Botão de Enviar */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={uploading}
                  onPress={handleUpload}
                  style={[styles.submitBtn, { backgroundColor: colors.primary }, uploading && { opacity: 0.7 }]}
                >
                  {uploading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Publicando no Storage & Base SISA...</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={18} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Publicar no Acervo & Indexar na IA</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    borderRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  filePickerBox: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  fileName: {
    fontSize: 13,
  },
  fileSize: {
    fontSize: 11,
    marginTop: 2,
  },
  changeFileTxt: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  pickerPrompt: {
    fontSize: 13,
    fontWeight: '700',
  },
  pickerSub: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 11,
  },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  successBox: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  successDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  doneBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
    marginTop: 10,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
