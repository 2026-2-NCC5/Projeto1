import { fetchWithAuth } from '../api/apiClient';
import { Platform, Linking, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { supabase } from './supabaseClient';
import { RequirementAttachment } from '../../utils/constants';
import { invalidateDynamicDocsCache, RAG_EXTRACTED_DELIMITER } from '../ai-agent/ragClient';

export interface UploadedInstitutionalDoc {
  id: string;
  dbId?: string;
  title: string;
  category: string;
  validity: string;
  description: string;
  role_target: string;
  file_url: string;
  arquivo: string;
  storagePath?: string;
  created_at?: string;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hevywbfvoooybuxxewwp.supabase.co';
const PUBLIC_DOCS_BASE = `${SUPABASE_URL}/storage/v1/object/public/documentos-asa/oficiais`;

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Converte string Base64 diretamente em ArrayBuffer binário para upload confiável no React Native (Android/iOS Hermes)
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').replace(/[^A-Za-z0-9+/=]/g, '');
  let bufferLength = Math.floor(clean.length * 0.75);
  if (clean.endsWith('==')) {
    bufferLength -= 2;
  } else if (clean.endsWith('=')) {
    bufferLength -= 1;
  }

  const bytes = new Uint8Array(bufferLength);
  const lookup = new Uint8Array(256);
  for (let i = 0; i < BASE64_CHARS.length; i++) {
    lookup[BASE64_CHARS.charCodeAt(i)] = i;
  }

  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const encoded1 = lookup[clean.charCodeAt(i)];
    const encoded2 = lookup[clean.charCodeAt(i + 1)];
    const encoded3 = lookup[clean.charCodeAt(i + 2)];
    const encoded4 = lookup[clean.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (p < bufferLength) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return bytes.buffer;
}

/**
 * Lê um arquivo local (file:// ou content://) em formato ArrayBuffer compatível com Supabase Storage no Android/iOS
 */
async function readUriAsUploadBody(uri: string, webFile?: any): Promise<ArrayBuffer | Blob | File> {
  if (Platform.OS === 'web') {
    if (webFile) return webFile;
    const resp = await fetch(uri);
    return await resp.blob();
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64ToArrayBuffer(base64);
  } catch {
    // Fallback para URIs content:// restritas: copia primeiro para cache local
    const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
    const tempUri = `${cacheDir}upload_${Date.now()}.tmp`;
    await FileSystem.copyAsync({ from: uri, to: tempUri });
    const base64 = await FileSystem.readAsStringAsync(tempUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
    return base64ToArrayBuffer(base64);
  }
}

function formatStorageError(errorMsg: string): string {
  const lower = (errorMsg || '').toLowerCase();
  if (lower.includes('row-level security') || lower.includes('unauthorized') || lower.includes('403')) {
    return 'Permissão RLS pendente no Supabase Storage. Execute a migração SQL do Storage no painel do Supabase.';
  }
  return `Falha no envio do arquivo: ${errorMsg}`;
}

/**
 * Mapeamento oficial e integral de todos os 12 documentos originais da pasta DocumentosASA
 * hospedados no bucket público 'documentos-asa' do Supabase Storage.
 */
export const DOCUMENTOS_ASA_STORAGE_MAP: Record<string, { url: string; filename: string; title: string }> = {
  'doc-01': {
    url: `${PUBLIC_DOCS_BASE}/2026626_205153_Informativo_Rematricula_Graduacao_Presencial_2026-2_vfinal.pdf`,
    filename: 'Informativo_Rematricula_Graduacao_Presencial_2026-2.pdf',
    title: 'Informativo Oficial de Rematrícula Graduação Presencial 2026-2',
  },
  'doc-02': {
    url: `${PUBLIC_DOCS_BASE}/202671_182650_Calendario_Graduacao_2026_-_versao_7_Discentes-Veteranos_1.pdf`,
    filename: 'Calendario_Graduacao_2026_Discentes_Veteranos.pdf',
    title: 'Calendário Acadêmico Oficial da Graduação 2026 - Discentes Veteranos',
  },
  'doc-03': {
    url: `${PUBLIC_DOCS_BASE}/2026731_121553_Horario_da_Graduacao_-_Relacoes_Internacionais_-_2026-2.pdf`,
    filename: 'Horario_da_Graduacao_Relacoes_Internacionais_2026-2.pdf',
    title: 'Grade Oficial de Horários - Relações Internacionais 2026-2',
  },
  'doc-04': {
    url: `${PUBLIC_DOCS_BASE}/2026731_122017_Horario_da_Graduacao_-_Ciencia_da_Computacao_-_2026-2_1.pdf`,
    filename: 'Horario_da_Graduacao_Ciencia_da_Computacao_2026-2.pdf',
    title: 'Grade Oficial de Horários - Ciência da Computação 2026-2',
  },
  'doc-05': {
    url: `${PUBLIC_DOCS_BASE}/2026811_12351_Horario_da_Graduacao_-_Analise_e_Desenvolvimento_de_Sistemas_-_2026-2_-_11-08-2026.pdf`,
    filename: 'Horario_da_Graduacao_ADS_2026-2.pdf',
    title: 'Grade Oficial de Horários - Análise e Desenvolvimento de Sistemas (ADS) 2026-2',
  },
  'doc-06': {
    url: `${PUBLIC_DOCS_BASE}/2026825_144411_Horario_da_Graduacao_-_Ciencias_Contabeis_-_2026-2_-_25-08-2026.pdf`,
    filename: 'Horario_da_Graduacao_Ciencias_Contabeis_2026-2.pdf',
    title: 'Grade Oficial de Horários - Ciências Contábeis 2026-2',
  },
  'doc-07': {
    url: `${PUBLIC_DOCS_BASE}/2026825_144430_Horario_da_Graduacao_-_Administracao_-_2026-2_-_25-08-2026.pdf`,
    filename: 'Horario_da_Graduacao_Administracao_2026-2.pdf',
    title: 'Grade Oficial de Horários - Administração 2026-2',
  },
  'doc-08': {
    url: `${PUBLIC_DOCS_BASE}/2026825_144455_Horario_da_Graduacao_-_Ciencias_Economicas_-_2026-2_-_25-08-2026.pdf`,
    filename: 'Horario_da_Graduacao_Ciencias_Economicas_2026-2.pdf',
    title: 'Grade Oficial de Horários - Ciências Econômicas 2026-2',
  },
  'doc-09': {
    url: `${PUBLIC_DOCS_BASE}/2026827_14268_Horario_da_Graduacao_-_DPs_e_Adapt_Sabado_-_2026-2_-_27-08-2026.pdf`,
    filename: 'Horario_da_Graduacao_DPs_e_Adaptacao_Sabado_2026-2.pdf',
    title: 'Lista e Grade de Horários - DPs e Adaptação aos Sábados 2026-2',
  },
  'doc-10': {
    url: `${PUBLIC_DOCS_BASE}/202683_15283_Horario_Noturno_Ciencias_Contabeis_para_Graduados_-_13-04-2026.pdf`,
    filename: 'Horario_Noturno_Ciencias_Contabeis_Graduados_2026.pdf',
    title: 'Grade de Horários - Ciências Contábeis para Graduados 2026',
  },
  'doc-11': {
    url: `${PUBLIC_DOCS_BASE}/Programa_de_Assistencia_Financeira_Educacional.pdf`,
    filename: 'Programa_de_Assistencia_Financeira_Educacional.pdf',
    title: 'Programa de Assistência Financeira Educacional FECAP (PAFE)',
  },
  'doc-12': {
    url: `${PUBLIC_DOCS_BASE}/Regulamento_do_Programa_de_Bolsas_Restituiveis_FECAP.pdf`,
    filename: 'Regulamento_do_Programa_de_Bolsas_Restituiveis_FECAP.pdf',
    title: 'Regulamento do Programa de Bolsas Restituíveis FECAP',
  },
};

export const storageService = {
  /**
   * Resolve a URL assinada temporária para anexos em bucket privado (student-attachments)
   */
  async getSignedAttachmentUrl(pathOrUrl: string, expiresIn: number = 3600): Promise<string> {
    if (!pathOrUrl) return '';
    let storagePath = pathOrUrl;
    const marker = '/student-attachments/';
    const mIdx = pathOrUrl.indexOf(marker);
    if (mIdx !== -1) {
      storagePath = decodeURIComponent(pathOrUrl.slice(mIdx + marker.length).split('?')[0]);
    }
    try {
      const { data, error } = await supabase.storage
        .from('student-attachments')
        .createSignedUrl(storagePath, expiresIn);
      if (error || !data?.signedUrl) {
        return pathOrUrl;
      }
      return data.signedUrl;
    } catch {
      return pathOrUrl;
    }
  },
  /**
   * Resolve a URL pública do PDF original da pasta DocumentosASA ou de um upload dinâmico
   */
  getOriginalDocumentUrl(docOrId: any): { url: string; filename: string; title: string } {
    if (typeof docOrId === 'string' && DOCUMENTOS_ASA_STORAGE_MAP[docOrId]) {
      return DOCUMENTOS_ASA_STORAGE_MAP[docOrId];
    }

    const explicitUrl = docOrId?.file_url || docOrId?.url;
    if (typeof explicitUrl === 'string' && explicitUrl.startsWith('http')) {
      const rawName = decodeURIComponent(explicitUrl.split('/').pop()?.split('?')[0] || 'documento.pdf');
      const cleanFilename = (docOrId?.arquivo || rawName.replace(/^\d+_/, '') || 'documento.pdf')
        .replace(/[^\w.-]/g, '_');
      return {
        url: explicitUrl,
        filename: cleanFilename.toLowerCase().endsWith('.pdf') ? cleanFilename : `${cleanFilename}.pdf`,
        title: docOrId?.title || docOrId?.titulo || cleanFilename,
      };
    }

    const id = docOrId?.id || '';
    if (DOCUMENTOS_ASA_STORAGE_MAP[id]) {
      return DOCUMENTOS_ASA_STORAGE_MAP[id];
    }

    // Mapeia atalhos por título/categoria para os PDFs reais da pasta DocumentosASA
    const text = `${docOrId?.title || ''} ${docOrId?.titulo || ''} ${docOrId?.arquivo || ''}`.toLowerCase();
    if (text.includes('rematr') || text.includes('matrícula')) return DOCUMENTOS_ASA_STORAGE_MAP['doc-01'];
    if (text.includes('calend') || text.includes('prazos')) return DOCUMENTOS_ASA_STORAGE_MAP['doc-02'];
    if (text.includes('relações internacionais') || text.includes('relacoes internacionais')) return DOCUMENTOS_ASA_STORAGE_MAP['doc-03'];
    if (text.includes('computa')) return DOCUMENTOS_ASA_STORAGE_MAP['doc-04'];
    if (text.includes('sistemas') || text.includes('ads')) return DOCUMENTOS_ASA_STORAGE_MAP['doc-05'];
    if (text.includes('graduados')) return DOCUMENTOS_ASA_STORAGE_MAP['doc-10'];
    if (text.includes('contáb') || text.includes('contab')) return DOCUMENTOS_ASA_STORAGE_MAP['doc-06'];
    if (text.includes('administra')) return DOCUMENTOS_ASA_STORAGE_MAP['doc-07'];
    if (text.includes('econôm') || text.includes('econom')) return DOCUMENTOS_ASA_STORAGE_MAP['doc-08'];
    if (text.includes('dp') || text.includes('adapta') || text.includes('equival')) return DOCUMENTOS_ASA_STORAGE_MAP['doc-09'];
    if (text.includes('assistência') || text.includes('assistencia') || text.includes('permanência') || text.includes('pafe')) return DOCUMENTOS_ASA_STORAGE_MAP['doc-11'];
    if (text.includes('bolsa') || text.includes('restitu')) return DOCUMENTOS_ASA_STORAGE_MAP['doc-12'];

    return DOCUMENTOS_ASA_STORAGE_MAP['doc-01'];
  },

  /**
   * Faz o download/abertura do PDF original de DocumentosASA em sua total integralidade (Web & Mobile nativo)
   */
  async downloadOriginalDocument(docOrId: any): Promise<{ success: boolean; url: string; filename: string }> {
    const info = this.getOriginalDocumentUrl(docOrId);
    const downloadUrl = `${info.url}?download=${encodeURIComponent(info.filename)}`;

    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.target = '_blank';
        link.download = info.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return { success: true, url: info.url, filename: info.filename };
      } else {
        // Mobile nativo: Baixa de forma segura no cache local e abre o visualizador nativo sem reiniciar o app
        try {
          const cacheDir =
            (FileSystem as any).cacheDirectory ||
            (FileSystem as any).documentDirectory ||
            (FileSystem as any).Paths?.cache?.uri ||
            '';
          const targetUri = `${cacheDir}${info.filename}`;
          const downloadRes = await (FileSystem as any).downloadAsync(downloadUrl, targetUri);
          const canShare = await Sharing.isAvailableAsync();
          if (canShare && downloadRes.uri) {
            await Sharing.shareAsync(downloadRes.uri, {
              mimeType: 'application/pdf',
              dialogTitle: info.title,
            });
            return { success: true, url: info.url, filename: info.filename };
          }
        } catch (fsErr) {
          console.warn('Falha no download nativo via FileSystem, abrindo link:', fsErr);
          await Linking.openURL(downloadUrl);
        }
      }
      return { success: true, url: info.url, filename: info.filename };
    } catch (e) {
      console.warn('Erro ao abrir PDF original:', e);
      return { success: false, url: info.url, filename: info.filename };
    }
  },

  /**
   * Seleciona uma imagem da galeria do dispositivo e faz upload para um bucket público do Supabase ('notices-images' ou 'avatars')
   */
  async pickAndUploadImage(
    bucket: 'notices-images' | 'avatars',
    prefix: string = 'img'
  ): Promise<{ canceled: boolean; publicUrl?: string; fileName?: string; error?: string }> {
    try {
      let pickedUri = '';
      let pickedName = '';
      let pickedMime = '';
      let webFile: any = undefined;

      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
          return {
            canceled: false,
            error: 'Permissão para acessar a galeria de fotos não foi concedida nas configurações do aparelho.',
          };
        }

        const pickerRes = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: bucket === 'avatars',
          aspect: bucket === 'avatars' ? [1, 1] : undefined,
          quality: 0.85,
        });

        if (pickerRes.canceled || !pickerRes.assets || pickerRes.assets.length === 0) {
          return { canceled: true };
        }

        const asset = pickerRes.assets[0];
        pickedUri = asset.uri;
        pickedName = asset.fileName || asset.uri.split('/').pop() || `${prefix}.jpg`;
        pickedMime = asset.mimeType || '';
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*'],
          copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
          return { canceled: true };
        }

        const asset = result.assets[0];
        pickedUri = asset.uri;
        pickedName = asset.name || `${prefix}.jpg`;
        pickedMime = asset.mimeType || '';
        webFile = (asset as any).file;
      }

      const extMatch = (pickedName || pickedUri).match(/\.(jpg|jpeg|png|webp|gif)$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
      const mimeType =
        pickedMime ||
        (ext === 'png'
          ? 'image/png'
          : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
          ? 'image/gif'
          : 'image/jpeg');
      // Contrato T4: Avatar avatars/${profileId}/avatar.<ext> (upsert)
      let objectName: string;
      if (bucket === 'avatars') {
        objectName = `${prefix}/avatar.${ext}`;
      } else {
        objectName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      }

      const bodyData = await readUriAsUploadBody(pickedUri, webFile);

      const { error } = await supabase.storage
        .from(bucket)
        .upload(objectName, bodyData, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        console.warn('Erro no upload de imagem para Supabase Storage:', error.message);
        return { canceled: false, error: formatStorageError(error.message) };
      }

      const { data: pubData } = supabase.storage
        .from(bucket)
        .getPublicUrl(objectName);

      const publicUrl = pubData?.publicUrl || `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectName}`;
      return {
        canceled: false,
        publicUrl,
        fileName: pickedName || objectName,
      };
    } catch (e: any) {
      console.warn('Exceção ao selecionar/enviar imagem:', e);
      return { canceled: false, error: e?.message || 'Erro ao selecionar imagem.' };
    }
  },

  /**
   * Seleciona e faz upload de anexo (foto da galeria, PDF ou documento) para um requerimento no bucket 'requerimentos-anexos'
   */
  async pickAndUploadRequirementAttachment(
    requirementProtocol: string,
    uploadedBy: 'Aluno' | 'Funcionário',
    authorName?: string,
    studentProfileId?: string,
    studentRa?: string
  ): Promise<{ canceled: boolean; attachment?: RequirementAttachment; error?: string }> {
    try {
      let sourceMode: 'gallery' | 'document' | 'cancel' = 'document';

      if (Platform.OS !== 'web') {
        sourceMode = await new Promise<'gallery' | 'document' | 'cancel'>((resolve) => {
          Alert.alert(
            'Anexar Arquivo ao Requerimento',
            'Escolha de onde deseja selecionar o arquivo:',
            [
              {
                text: 'Galeria de Fotos (Imagem)',
                onPress: () => resolve('gallery'),
              },
              {
                text: 'Documento ou PDF',
                onPress: () => resolve('document'),
              },
              {
                text: 'Cancelar',
                style: 'cancel',
                onPress: () => resolve('cancel'),
              },
            ],
            {
              cancelable: true,
              onDismiss: () => resolve('cancel'),
            }
          );
        });
      }

      if (sourceMode === 'cancel') {
        return { canceled: true };
      }

      let pickedUri = '';
      let pickedName = '';
      let pickedMime = '';
      let pickedSize: number | undefined = undefined;
      let webFile: any = undefined;

      if (sourceMode === 'gallery') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
          return {
            canceled: false,
            error: 'Permissão para acessar a galeria de fotos não foi concedida.',
          };
        }

        const pickerRes = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
        });

        if (pickerRes.canceled || !pickerRes.assets || pickerRes.assets.length === 0) {
          return { canceled: true };
        }

        const asset = pickerRes.assets[0];
        pickedUri = asset.uri;
        const extFromUri = (asset.fileName || asset.uri).match(/\.(jpg|jpeg|png|webp|gif)$/i)?.[1] || 'jpg';
        pickedName = asset.fileName || `imagem_${Date.now()}.${extFromUri}`;
        pickedMime = asset.mimeType || 'image/jpeg';
        pickedSize = asset.fileSize;
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: [
            'image/*',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
          copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
          return { canceled: true };
        }

        const asset = result.assets[0];
        pickedUri = asset.uri;
        pickedName = asset.name || 'documento.pdf';
        pickedMime = asset.mimeType || '';
        pickedSize = asset.size;
        webFile = (asset as any).file;
      }

      const cleanFileName = (pickedName || 'documento').replace(/[^a-zA-Z0-9._-]/g, '_');
      const extMatch = cleanFileName.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : sourceMode === 'gallery' ? 'jpg' : 'pdf';
      const mimeType =
        pickedMime ||
        (ext === 'pdf'
          ? 'application/pdf'
          : ext === 'png'
          ? 'image/png'
          : ext === 'webp'
          ? 'image/webp'
          : ext === 'doc'
          ? 'application/msword'
          : ext === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'image/jpeg');

      // T4 Contratos de caminho no bucket privado student-attachments
      let objectPath: string;
      const ts = Date.now();

      if (uploadedBy === 'Aluno') {
        let profileId = studentProfileId;
        if (!profileId) {
          const { data: authData } = await supabase.auth.getUser();
          profileId = authData?.user?.id;
        }
        if (!profileId) profileId = 'aluno';
        const safeProtocol = (requirementProtocol || 'REQ').replace(/[^a-zA-Z0-9_-]/g, '_');
        objectPath = `${profileId}/${safeProtocol}/${ts}_${cleanFileName}`;
      } else {
        // Staff upload
        let targetStudentProfileId = studentProfileId;
        if (!targetStudentProfileId && studentRa) {
          const { data: stRow } = await supabase
            .from('students')
            .select('profile_id')
            .eq('ra', studentRa.trim())
            .maybeSingle();
          if (stRow?.profile_id) targetStudentProfileId = stRow.profile_id;
        }
        if (!targetStudentProfileId && requirementProtocol) {
          const { data: reqRow } = await supabase
            .from('student_requirements')
            .select('students(profile_id)')
            .eq('protocol', requirementProtocol)
            .maybeSingle();
          const stObj: any = reqRow?.students;
          if (stObj?.profile_id) targetStudentProfileId = stObj.profile_id;
        }
        if (!targetStudentProfileId) {
          const warningMsg = 'Não é possível anexar documento: o estudante ainda não possui uma conta com perfil vinculado no sistema.';
          Alert.alert('Aviso', warningMsg);
          return { canceled: false, error: warningMsg };
        }
        objectPath = `${targetStudentProfileId}/staff/${ts}_${cleanFileName}`;
      }

      const bodyData = await readUriAsUploadBody(pickedUri, webFile);

      // T4: Bucket PRIVADO student-attachments
      const { error } = await supabase.storage
        .from('student-attachments')
        .upload(objectPath, bodyData, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        console.warn('Erro ao enviar anexo de requerimento:', error.message);
        return { canceled: false, error: formatStorageError(error.message) };
      }

      // T4: Signed URL temporária (nunca getPublicUrl)
      const { data: signedData, error: signErr } = await supabase.storage
        .from('student-attachments')
        .createSignedUrl(objectPath, 7200);

      const signedUrl = signedData?.signedUrl || '';

      const attachment: RequirementAttachment = {
        id: `att-${Date.now()}`,
        name: pickedName || cleanFileName,
        url: signedUrl,
        path: objectPath,
        mime: mimeType,
        size: pickedSize || 0,
        sizeBytes: pickedSize,
        uploadedAt: new Date().toISOString(),
        uploadedBy,
        authorName: authorName || (uploadedBy === 'Funcionário' ? 'Equipe CAA' : 'Aluno'),
      };

      return {
        canceled: false,
        attachment,
      };
    } catch (e: any) {
      console.warn('Exceção ao selecionar anexo:', e);
      return { canceled: false, error: e?.message || 'Erro ao processar anexo.' };
    }
  },

  /**
   * Gera e salva a Ficha Oficial do Aluno em formato PDF e inicia o download ou compartilhamento nativo
   */
  async uploadAndDownloadStudentFicha(
    raOrFilename: string,
    nameOrHtml: string,
    htmlMaybe?: string,
    studentProfileId?: string
  ): Promise<{ success: boolean; publicUrl?: string; signedUrl?: string; error?: string }> {
    const htmlContent = htmlMaybe !== undefined ? htmlMaybe : nameOrHtml;
    const rawFilename =
      htmlMaybe !== undefined
        ? `Ficha_FECAP_${raOrFilename}_${nameOrHtml}`
        : raOrFilename.replace(/\.(html|pdf)$/i, '');
    const cleanName = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const pdfFileName = `${cleanName}.pdf`;
    const ts = Date.now();

    // T4: Resolução de studentProfileId para ficha 360º no bucket privado student-attachments
    let targetProfileId = studentProfileId;
    if (!targetProfileId && /^\d+$/.test(raOrFilename)) {
      const { data: stRow } = await supabase
        .from('students')
        .select('profile_id')
        .eq('ra', raOrFilename)
        .maybeSingle();
      if (stRow?.profile_id) targetProfileId = stRow.profile_id;
    }

    if (!targetProfileId) {
      const warningMsg = 'Não é possível gerar e arquivar a Ficha 360º no Storage: o estudante ainda não possui uma conta com perfil vinculado no sistema.';
      Alert.alert('Aviso', warningMsg);
      // Ainda permite visualização local se for no mobile/web sem upload remoto
    }

    const objectPath = targetProfileId
      ? `${targetProfileId}/staff/${ts}_Ficha_FECAP_${cleanName}.pdf`
      : `fichas/${ts}_${pdfFileName}`;
    let signedUrl = '';

    try {
      // 1. No ambiente Web: aciona a impressão direta para PDF nativo através de iframe
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          document.body.appendChild(iframe);
          const doc = iframe.contentWindow?.document;
          if (doc) {
            doc.open();
            doc.write(htmlContent);
            doc.close();
            setTimeout(() => {
              try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
              } catch {
                window.print();
              }
              setTimeout(() => {
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
              }, 4000);
            }, 400);
          }
        } catch (webPrintErr) {
          console.warn('Erro ao abrir diálogo de impressão web:', webPrintErr);
        }

        // Upload para bucket privado student-attachments
        if (targetProfileId) {
          try {
            await supabase.storage
              .from('student-attachments')
              .upload(objectPath, htmlContent, {
                contentType: 'text/html; charset=utf-8',
                upsert: true,
              });
            const { data: sData } = await supabase.storage
              .from('student-attachments')
              .createSignedUrl(objectPath, 7200);
            signedUrl = sData?.signedUrl || '';
          } catch {}
        }

        return { success: true, publicUrl: signedUrl, signedUrl };
      }

      // 2. No ambiente Mobile (Android / iOS): Gera arquivo PDF real com expo-print
      let pdfFileUri = '';
      try {
        const printResult = await Print.printToFileAsync({
          html: htmlContent,
        });
        pdfFileUri = printResult.uri;
      } catch (printErr) {
        console.warn('Aviso ao gerar PDF via Print.printToFileAsync:', printErr);
      }

      // Se gerou o PDF nativo com sucesso, faz upload do binário para o bucket privado student-attachments
      if (pdfFileUri && targetProfileId) {
        try {
          const pdfBody = await readUriAsUploadBody(pdfFileUri);
          const { error: uploadError } = await supabase.storage
            .from('student-attachments')
            .upload(objectPath, pdfBody, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (!uploadError) {
            const { data: sData } = await supabase.storage
              .from('student-attachments')
              .createSignedUrl(objectPath, 7200);
            if (sData?.signedUrl) signedUrl = sData.signedUrl;
          }
        } catch (uploadCatch) {
          console.warn('Falha no upload do PDF para o storage:', uploadCatch);
        }
      }

      // Compartilha o arquivo PDF gerado
      if (pdfFileUri) {
        const canShare = await Sharing.isAvailableAsync().catch(() => false);
        if (canShare) {
          await Sharing.shareAsync(pdfFileUri, {
            mimeType: 'application/pdf',
            dialogTitle: `Ficha Completa FECAP - ${cleanName}.pdf`,
            UTI: 'com.adobe.pdf',
          });
          return { success: true, publicUrl: signedUrl, signedUrl };
        }
      }

      if (signedUrl) {
        await Linking.openURL(signedUrl);
      }

      return { success: true, publicUrl: signedUrl, signedUrl };
    } catch (e) {
      console.warn('Erro ao exportar ficha em PDF:', e);
      return { success: false };
    }
  },

  /**
   * Lista documentos enviados dinamicamente (via Web Admin ou App Mobile) em public.documents
   * e no bucket documentos-asa/oficiais (excluindo os 12 PDFs base já exibidos no catálogo fixo).
   */
  async listDynamicUploadedDocuments(currentRole: 'Aluno' | 'Funcionário' = 'Aluno'): Promise<UploadedInstitutionalDoc[]> {
    try {
      const seedUrls = new Set(Object.values(DOCUMENTOS_ASA_STORAGE_MAP).map((m) => m.url));
      const seedObjectNames = new Set(
        Object.values(DOCUMENTOS_ASA_STORAGE_MAP).map((m) => m.url.split('/').pop() || '')
      );

      const [dbRes, bucketRes] = await Promise.all([
        supabase.from('documents').select('*').order('created_at', { ascending: false }),
        supabase.storage.from('documentos-asa').list('oficiais', { limit: 150 }),
      ]);

      const byUrl = new Map<string, UploadedInstitutionalDoc>();

      if (!dbRes.error && Array.isArray(dbRes.data)) {
        for (const row of dbRes.data as any[]) {
          const url = String(row.file_url || '');
          if (!url || seedUrls.has(url)) continue;

          const rawDesc = String(row.description || '');
          const cleanDesc = rawDesc.includes(RAG_EXTRACTED_DELIMITER)
            ? rawDesc.split(RAG_EXTRACTED_DELIMITER)[0].trim()
            : rawDesc.trim();
          const rawFile = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'documento.pdf');
          const marker = '/object/public/documentos-asa/';
          const mIdx = url.indexOf(marker);
          const storagePath = mIdx !== -1 ? decodeURIComponent(url.slice(mIdx + marker.length).split('?')[0]) : undefined;

          byUrl.set(url, {
            id: `dyn-${row.id}`,
            dbId: row.id,
            title: row.title || rawFile.replace(/^\d+_/, ''),
            category: row.category || 'Documentos Oficiais',
            validity: row.validity || 'PDF Oficial Indexado',
            description: cleanDesc || 'Documento institucional disponível para consulta e indexado na IA SISA.',
            role_target: row.role_target || 'Todos',
            file_url: url,
            arquivo: rawFile.replace(/^\d+_/, ''),
            storagePath,
            created_at: row.created_at,
          });
        }
      }

      if (Array.isArray(bucketRes.data)) {
        for (const obj of bucketRes.data) {
          if (!obj.name || obj.name === '.emptyFolderPlaceholder' || seedObjectNames.has(obj.name)) {
            continue;
          }
          const { data: pub } = supabase.storage
            .from('documentos-asa')
            .getPublicUrl(`oficiais/${obj.name}`);
          const url = pub.publicUrl;
          if (!byUrl.has(url)) {
            const friendly = obj.name.replace(/^\d+_/, '').replace(/_/g, ' ');
            byUrl.set(url, {
              id: `storage-${obj.id || obj.name}`,
              title: friendly.replace(/\.pdf$/i, ''),
              category: 'Upload Institucional',
              validity: 'PDF Oficial',
              description: 'Documento institucional publicado no acervo oficial DocumentosASA.',
              role_target: 'Todos',
              file_url: url,
              arquivo: obj.name.replace(/^\d+_/, ''),
              storagePath: `oficiais/${obj.name}`,
              created_at: obj.created_at || undefined,
            });
          }
        }
      }

      const list = Array.from(byUrl.values());
      if (currentRole === 'Funcionário') return list;
      return list.filter((d) => !d.role_target || d.role_target === 'Todos' || d.role_target === 'Aluno');
    } catch (e) {
      console.warn('Erro ao listar uploads dinâmicos:', e);
      return [];
    }
  },

  /**
   * Publica um novo documento institucional (PDF ou Markdown .md) diretamente no Supabase Storage ('documentos-asa')
   * e registra em public.documents para disponibilidade imediata no Acervo (App + Web) e no Grafo Markdown SISA.
   */
  async uploadInstitutionalDocument(params: {
    uri: string;
    fileName: string;
    webFile?: any;
    title: string;
    category: string;
    roleTarget: string;
    description?: string;
  }): Promise<{ ok: boolean; publicUrl?: string; chunksIndexed?: number; error?: string }> {
    const safeName = (params.fileName || 'documento.pdf')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_');
    const isMarkdown = /\.(md|markdown)$/i.test(safeName);
    const mimeType = isMarkdown ? 'text/markdown; charset=utf-8' : 'application/pdf';
    const storagePath = `oficiais/${Date.now()}_${safeName}`;

    try {
      let body: any;
      let extractedMarkdownText = '';

      if (Platform.OS === 'web' && params.webFile) {
        body = params.webFile;
        if (isMarkdown && typeof params.webFile.text === 'function') {
          extractedMarkdownText = await params.webFile.text().catch(() => '');
        }
      } else if (Platform.OS === 'web') {
        const resp = await fetch(params.uri);
        body = await resp.blob();
        if (isMarkdown) {
          extractedMarkdownText = await body.text().catch(() => '');
        }
      } else {
        body = await readUriAsUploadBody(params.uri);
        if (isMarkdown) {
          try {
            extractedMarkdownText = await FileSystem.readAsStringAsync(params.uri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
          } catch {}
        }
      }

      const { error: uploadErr } = await supabase.storage
        .from('documentos-asa')
        .upload(storagePath, body, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadErr) {
        return { ok: false, error: formatStorageError(uploadErr.message) };
      }

      const { data: pub } = supabase.storage.from('documentos-asa').getPublicUrl(storagePath);
      const publicUrl = pub.publicUrl;

      const userSummary = params.description?.trim() || `${params.title.trim()} (${params.category})`;
      const fullDescription = extractedMarkdownText.trim()
        ? `${userSummary}\n\n${RAG_EXTRACTED_DELIMITER}\n${extractedMarkdownText.trim()}`
        : userSummary;

      await supabase.from('documents').insert({
        title: params.title.trim(),
        category: params.category,
        validity: isMarkdown ? 'Nota Markdown Estruturada (.md)' : 'PDF Oficial Indexado',
        description: fullDescription,
        role_target: params.roleTarget,
        file_url: publicUrl,
        auth_code_prefix: 'FECAP-APP',
      });

      invalidateDynamicDocsCache();

      // Se o backend Python estiver configurado e online, aciona também a gravação no Grafo Markdown local
      let chunksIndexed: number | undefined;
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (backendUrl) {
        try {
          const formData = new FormData();
          if (Platform.OS === 'web' && params.webFile) {
            formData.append('file', params.webFile);
          } else {
            formData.append('file', {
              uri: params.uri,
              type: isMarkdown ? 'text/markdown' : 'application/pdf',
              name: safeName,
            } as any);
          }
          formData.append('title', params.title.trim());
          formData.append('category', params.category);
          formData.append('role_target', params.roleTarget);
          formData.append('description', userSummary);

          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 5000);
          const resp = await fetchWithAuth(`${backendUrl}/api/admin/documents/upload`, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(t);
          if (resp.ok) {
            const json = await resp.json();
            chunksIndexed = json?.total_secoes_grafo ?? json?.chunks_indexed ?? json?.chunks_indexados;
          }
        } catch {
          // Backend opcional offline — documento já ativo no Supabase Storage e public.documents
        }
      }

      return { ok: true, publicUrl, chunksIndexed };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Erro ao publicar documento no acervo.' };
    }
  },

  /**
   * Exclui um documento enviado do bucket 'documentos-asa' e da tabela public.documents.
   */
  async deleteInstitutionalDocument(
    doc: UploadedInstitutionalDoc
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      let storagePath = doc.storagePath;
      if (!storagePath && doc.file_url) {
        const marker = '/object/public/documentos-asa/';
        const idx = doc.file_url.indexOf(marker);
        if (idx !== -1) {
          storagePath = decodeURIComponent(doc.file_url.slice(idx + marker.length).split('?')[0]);
        }
      }

      if (storagePath) {
        await supabase.storage.from('documentos-asa').remove([storagePath]);
      }

      if (doc.dbId) {
        await supabase.from('documents').delete().eq('id', doc.dbId);
      }
      if (doc.file_url) {
        await supabase.from('documents').delete().eq('file_url', doc.file_url);
      }

      invalidateDynamicDocsCache();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Não foi possível excluir o documento.' };
    }
  },
};
