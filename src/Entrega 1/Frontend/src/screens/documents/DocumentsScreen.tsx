import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FileText,
  Download,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  Bus,
  Award,
  DollarSign,
  Briefcase,
  BookOpen,
} from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { UserRole } from '../../utils/constants';
import { documentosOficiais } from '../../services/ai-agent/data/documentosResumo';

interface DocItem {
  id: string;
  title: string;
  category: string;
  validity: string;
  description: string;
  icon: any;
}

const DOCUMENTS_BY_ROLE: Record<UserRole, DocItem[]> = {
  Aluno: [
    {
      id: 'doc-1',
      title: 'Declaração de Matrícula Ativa',
      category: 'Oficial',
      validity: 'Válido até 31/12/2026',
      description: 'Comprovante oficial com autenticação digital e código ICP-Brasil.',
      icon: FileText,
    },
    {
      id: 'doc-2',
      title: 'Declaração de Passe Escolar (SPTrans/EMTU)',
      category: 'Transporte',
      validity: 'Ano Letivo 2026',
      description: 'Comprovante para solicitação de meia-tarifa ou gratuidade de estudante.',
      icon: Bus,
    },
    {
      id: 'doc-3',
      title: 'Histórico Escolar Oficial',
      category: 'Acadêmico',
      validity: 'Atualizado em tempo real',
      description: 'Grade de disciplinas cursadas, notas e coeficientes de rendimento.',
      icon: Award,
    },
    {
      id: 'doc-4',
      title: 'Certificado de Atividades Complementares (AC)',
      category: 'Horas AC',
      validity: 'Total: 80h computadas',
      description: 'Extrato de horas complementares validadas pela coordenação.',
      icon: ShieldCheck,
    },
  ],
  Pais: [
    {
      id: 'doc-p1',
      title: 'Declaração de Quitação Anual de Débitos',
      category: 'Financeiro',
      validity: 'Exercício 2025/2026',
      description: 'Comprovante de adimplência financeira conforme Lei Federal 12.007.',
      icon: DollarSign,
    },
    {
      id: 'doc-p2',
      title: 'Informe de Pagamentos para IRPF 2026',
      category: 'Fiscal',
      validity: 'Ano-Calendário 2025/2026',
      description: 'Demonstrativo detalhado das despesas com instrução para declaração de IR.',
      icon: FileText,
    },
    {
      id: 'doc-p3',
      title: 'Atestado de Matrícula e Vínculo do Dependente',
      category: 'Oficial',
      validity: 'Válido até 31/12/2026',
      description: 'Comprovante de que Lucas Alvarista está regularmente matriculado no 5º semestre.',
      icon: Award,
    },
    {
      id: 'doc-p4',
      title: 'Contrato de Prestação de Serviços Educacionais',
      category: 'Jurídico',
      validity: 'Semestre Vigente',
      description: 'Cópia digitalizada e assinada do contrato do ano letivo de 2026.',
      icon: ShieldCheck,
    },
  ],
  Professor: [
    {
      id: 'doc-t1',
      title: 'Plano de Ensino & Cronograma 2026.1',
      category: 'Pedagógico',
      validity: 'Semestre 2026.1',
      description: 'Ementas, bibliografia básica e critérios de avaliação homologados.',
      icon: BookOpen,
    },
    {
      id: 'doc-t2',
      title: 'Declaração de Carga Horária e Titularidade',
      category: 'Institucional',
      validity: 'Ano Letivo 2026',
      description: 'Comprovante de horas-aula semanais e vínculo docente oficial FECAP.',
      icon: Award,
    },
    {
      id: 'doc-t3',
      title: 'Diário de Classe & Relação de Presenças',
      category: 'Acadêmico',
      validity: 'Atualizado Hoje',
      description: 'Relatório consolidado de chamada e notas P1 das turmas CCOMP e ADM.',
      icon: FileText,
    },
  ],
  'Funcionário': [
    {
      id: 'doc-f1',
      title: 'Espelho de Ponto Eletrônico Mensal',
      category: 'RH & Ponto',
      validity: 'Mês Vigente',
      description: 'Registro biométrico e digital de entradas, saídas e banco de horas.',
      icon: FileText,
    },
    {
      id: 'doc-f2',
      title: 'Demonstrativo de Pagamento (Holerite)',
      category: 'Financeiro',
      validity: 'Último Fechamento',
      description: 'Comprovante de vencimentos, adicionais e benefícios com autenticação.',
      icon: DollarSign,
    },
    {
      id: 'doc-f3',
      title: 'Declaração de Vínculo Empregatício',
      category: 'Institucional',
      validity: 'Válido por 90 dias',
      description: 'Comprovante oficial de colaborador ativo no quadro funcional FECAP.',
      icon: Briefcase,
    },
    {
      id: 'doc-f4',
      title: 'Manual de Procedimentos e Triagem CAA 2026',
      category: 'Operacional',
      validity: 'Revisão Fev/2026',
      description: 'Guia de diretrizes para atendimento e acolhimento aos estudantes.',
      icon: ShieldCheck,
    },
  ],
};

export const DocumentsScreen: React.FC = () => {
  const { showToast } = useApp();
  const { user, selectedRole } = useAuth();
  const currentRole = user?.role || selectedRole || 'Aluno';
  const docsList = DOCUMENTS_BY_ROLE[currentRole] || DOCUMENTS_BY_ROLE.Aluno;

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadDoc = (title: string, id: string) => {
    setDownloadingId(id);
    setTimeout(() => {
      setDownloadingId(null);
      showToast(`Documento "${title}" gerado com sucesso!`, 'success');
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Arquivo e Documentos</Text>
          <Text style={styles.subtitle}>
            Emita declarações oficiais com autenticidade digital imediata ({currentRole})
          </Text>
        </View>

        {/* Card de Autenticidade */}
        <View style={styles.securityBanner}>
          <QrCode size={28} color={colors.primary} />
          <View style={styles.securityInfo}>
            <Text style={styles.securityTitle}>Validação Digital Segura</Text>
            <Text style={styles.securityDesc}>
              Todos os documentos contêm QR Code e hash ICP-Brasil de autenticação pública.
            </Text>
          </View>
        </View>

        {/* Lista de Documentos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documentos Disponíveis</Text>
          {docsList.map((doc) => {
            const Icon = doc.icon;
            const isProcessing = downloadingId === doc.id;
            return (
              <View key={doc.id} style={styles.docCard}>
                <View style={styles.docIconBox}>
                  <Icon size={24} color={colors.secondary} />
                </View>
                <View style={styles.docContent}>
                  <Text style={styles.docTitle}>{doc.title}</Text>
                  <Text style={styles.docDesc}>{doc.description}</Text>
                  <Text style={styles.docValidity}>{doc.validity}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleDownloadDoc(doc.title, doc.id)}
                  style={[styles.emitButton, isProcessing && styles.emitButtonActive]}
                >
                  <Download size={18} color="#FFFFFF" />
                  <Text style={styles.emitButtonText}>
                    {isProcessing ? 'Gerando...' : 'Emitir'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Acervo Oficial DocumentosASA */}
        <View style={[styles.section, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Acervo Oficial e Normas (DocumentosASA)</Text>
          <Text style={styles.sectionSubtitle}>
            Manuais, regulamentos e grades horárias ingeridos pelo Agente Inteligente SISA
          </Text>
          {(documentosOficiais || []).map((d) => {
            const isProcessing = downloadingId === d.id;
            return (
              <View key={d.id} style={styles.docCard}>
                <View style={[styles.docIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <BookOpen size={24} color="#0284C7" />
                </View>
                <View style={styles.docContent}>
                  <Text style={styles.docTitle}>{d.titulo}</Text>
                  <Text style={styles.docDesc}>{d.categoria} • {d.paginas} página(s)</Text>
                  <Text style={[styles.docValidity, { color: '#0284C7' }]}>📄 {d.arquivo}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleDownloadDoc(d.titulo, d.id)}
                  style={[styles.emitButton, { backgroundColor: '#0284C7' }, isProcessing && styles.emitButtonActive]}
                >
                  <Download size={18} color="#FFFFFF" />
                  <Text style={styles.emitButtonText}>
                    {isProcessing ? 'Abrindo...' : 'Acessar'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 176, 116, 0.2)',
    marginBottom: spacing.xxl,
    gap: spacing.md,
  },
  securityInfo: {
    flex: 1,
  },
  securityTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.primaryDark,
  },
  securityDesc: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  docIconBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  docContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  docTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  docDesc: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 4,
  },
  docValidity: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: typography.fontWeights.semiBold,
  },
  emitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.pill,
    gap: 4,
  },
  emitButtonActive: {
    backgroundColor: colors.primaryDark,
  },
  emitButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
});
