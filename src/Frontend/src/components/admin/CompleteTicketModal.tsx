import React, { useState } from 'react';
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
  Alert,
} from 'react-native';
import { CheckCircle2, X, ClipboardCheck, MessageSquare, AlertCircle, User, Ticket } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { QueueTicket } from '../../services/supabase/queueService';

interface CompleteTicketModalProps {
  visible: boolean;
  ticket: QueueTicket | null;
  onClose: () => void;
  onConfirm: (completionData: {
    outcome: string;
    topics: string[];
    summary: string;
  }) => Promise<void>;
}

const TOPICS = [
  'Requerimentos Acadêmicos',
  'Financeiro & Bolsas',
  'Horários de Aulas & Salas',
  'Provas Oficiais (PO)',
  'Rematrícula',
  'Passe Escolar / SPTrans',
  'Trancamento / Transferência',
  'Outros',
];

const OUTCOMES = [
  'Resolvido no Guichê (Dúvida sanada / concluído)',
  'Encaminhado para a Coordenação de Curso',
  'Protocolo de Requerimento Aberto no Local',
  'Aguardando Documentação Complementar do Aluno',
  'Aluno Ausente / Desistência',
];

export const CompleteTicketModal: React.FC<CompleteTicketModalProps> = ({
  visible,
  ticket,
  onClose,
  onConfirm,
}) => {
  const { colors, isDark } = useTheme();

  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!ticket) return null;

  const toggleTopic = (t: string) => {
    setSelectedTopics((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  const handleComplete = async () => {
    if (!summary.trim() || summary.trim().length < 8) {
      setErrorMsg('Por favor, descreva em detalhes como foi o atendimento do estudante (mínimo de 8 caracteres).');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);
    try {
      await onConfirm({
        outcome,
        topics: selectedTopics,
        summary: summary.trim(),
      });
      setSummary('');
      setSelectedTopics([]);
      onClose();
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar o desfecho do atendimento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.modalCard, { backgroundColor: isDark ? colors.card : '#FFFFFF' }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={[styles.iconBox, { backgroundColor: '#E6F4EA' }]}>
                <ClipboardCheck size={20} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  Concluir Atendimento da Senha
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  Senha {ticket.ticket_number} • {ticket.counter}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Resumo do Aluno */}
            <View
              style={[
                styles.studentInfoBox,
                { backgroundColor: isDark ? colors.backgroundAlt : '#F8FAFC', borderColor: colors.border },
              ]}
            >
              <User size={16} color={colors.primary} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.studentName, { color: colors.textPrimary }]}>
                  {ticket.student_name || 'Estudante Presencial'}
                </Text>
                <Text style={[styles.studentMeta, { color: colors.textSecondary }]}>
                  {ticket.student_ra ? `RA: ${ticket.student_ra}` : 'Atendimento Balcão'} •{' '}
                  {ticket.student_course || ticket.service_type}
                </Text>
              </View>
            </View>

            {/* Resultado / Desfecho */}
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
              Resultado do Atendimento
            </Text>
            <View style={styles.outcomesList}>
              {OUTCOMES.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.8}
                  onPress={() => setOutcome(item)}
                  style={[
                    styles.outcomePill,
                    {
                      backgroundColor: outcome === item ? '#059669' : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.outcomeText,
                      { color: outcome === item ? '#FFFFFF' : colors.textSecondary, fontWeight: outcome === item ? '700' : '500' },
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Dúvidas e Tópicos Tratados */}
            <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: 14 }]}>
              Dúvidas do Aluno / Assuntos Tratados
            </Text>
            <View style={styles.topicsGrid}>
              {TOPICS.map((topic, idx) => {
                const selected = selectedTopics.includes(topic);
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.8}
                    onPress={() => toggleTopic(topic)}
                    style={[
                      styles.topicChip,
                      {
                        backgroundColor: selected ? colors.primaryLight : (isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC'),
                        borderColor: selected ? colors.primary : (isDark ? colors.border : '#E2E8F0'),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.topicChipText,
                        { color: selected ? colors.primaryDark : colors.textSecondary, fontWeight: selected ? '700' : '500' },
                      ]}
                    >
                      {topic}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Parecer / Relato do Atendimento */}
            <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: 14 }]}>
              Explicação de Como Foi o Atendimento *
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? colors.backgroundAlt : '#F8FAFC',
                  borderColor: errorMsg ? '#EF4444' : colors.border,
                  borderWidth: errorMsg ? 2 : 1,
                  color: colors.textPrimary,
                },
              ]}
              placeholder="Descreva o que o aluno solicitou, as dúvidas esclarecidas, orientações passadas e os próximos passos acordados..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              value={summary}
              onChangeText={(t) => {
                setSummary(t);
                if (errorMsg) setErrorMsg('');
              }}
            />

            {errorMsg ? (
              <View style={styles.errorAlert}>
                <AlertCircle size={14} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={styles.errorAlertText}>{errorMsg}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer de Confirmação */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={handleComplete}
              disabled={submitting}
              style={[styles.confirmBtn, { backgroundColor: '#059669' }]}
            >
              <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.confirmBtnText}>
                {submitting ? 'Gravando Parecer...' : 'Concluir Atendimento & Salvar'}
              </Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  studentInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  studentName: {
    fontSize: 13,
    fontWeight: '700',
  },
  studentMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  outcomesList: {
    gap: 6,
  },
  outcomePill: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  outcomeText: {
    fontSize: 12,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  topicChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  topicChipText: {
    fontSize: 11,
  },
  textArea: {
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  errorAlertText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
