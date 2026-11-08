import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  User,
  LogOut,
  Settings,
  FileText,
  RefreshCw,
  ChevronRight,
  Camera,
  Ticket,
  CheckCircle2,
  Trash2,
  X,
  CreditCard,
  Building2,
  Edit3,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { storageService } from '../../services/supabase/storageService';
import { queueService, QueueTicket } from '../../services/supabase/queueService';
import { pushNotificationService } from '../../services/notifications/pushNotificationService';
import { ConfirmationModal } from '../../components/feedback/ConfirmationModal';
import { UserRole } from '../../utils/constants';
import { FadeInView, ScalePressable } from '../../components/common/AnimatedComponents';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { user, selectedRole, signOut, updateAvatar } = useAuth();
  const { showToast } = useApp();
  const currentRole: UserRole =
    user?.role === 'Funcionário' || selectedRole === 'Funcionário' ? 'Funcionário' : 'Aluno';

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Estados da Fila de Atendimento Presencial (CAA)
  const [activeTicket, setActiveTicket] = useState<QueueTicket | null>(null);
  const [ticketHistory, setTicketHistory] = useState<QueueTicket[]>([]);
  const [queueBoard, setQueueBoard] = useState<QueueTicket[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [cancelTicketModalVisible, setCancelTicketModalVisible] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState('Geral');
  const [caaSchedule, setCaaSchedule] = useState(() => queueService.getOperatingHoursStatus());

  // Carrega e monitora a senha ativa e o histórico persistente do estudante
  const loadStudentTicket = useCallback(async () => {
    setCaaSchedule(queueService.getOperatingHoursStatus());
    if (currentRole !== 'Aluno' || !user?.ra) return;
    try {
      const [ticket, hist] = await Promise.all([
        queueService.getStudentActiveTicket(user.ra),
        queueService.getStudentTicketHistory(user.ra),
      ]);
      setTicketHistory(hist);
      setActiveTicket((prev) => {
        if (prev && !ticket) {
          const sched = queueService.getOperatingHoursStatus();
          if (!sched.isOpen) {
            showToast('Sua senha expirou devido ao encerramento do expediente do CAA.', 'info');
          }
        }
        return ticket;
      });
    } catch (e) {
      console.warn('Erro ao verificar senha ativa e histórico:', e);
    }
  }, [currentRole, user?.ra, showToast]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCaaSchedule(queueService.getOperatingHoursStatus());
      if (currentRole === 'Aluno' && user?.ra) {
        loadStudentTicket();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentRole, user?.ra, loadStudentTicket]);

  useEffect(() => {
    if (currentRole !== 'Aluno' || !user?.ra) {
      return;
    }

    loadStudentTicket();

    // T5 & Item 12: Polling a cada ~10s da lista geral na view queue_board e senha individual na tabela
    let active = true;
    const pollQueue = async () => {
      try {
        const [board, ticket] = await Promise.all([
          queueService.getQueueBoard(),
          queueService.getStudentActiveTicket(user.ra),
        ]);
        if (!active) return;
        setQueueBoard(board);
        setActiveTicket((prev) => {
          if (ticket?.status === 'called' && prev?.status !== 'called') {
            pushNotificationService.notifyTicketCalled(ticket.ticket_number, ticket.counter);
            showToast(`Sua senha ${ticket.ticket_number} foi chamada para o ${ticket.counter || 'Guichê'}!`, 'success');
          }
          return ticket;
        });
      } catch (err) {
        console.warn('Erro no polling da fila:', err);
      }
    };

    pollQueue();
    const queueInterval = setInterval(pollQueue, 10000);

    return () => {
      active = false;
      clearInterval(queueInterval);
    };
  }, [currentRole, user?.ra, loadStudentTicket]);

  // Logout
  const handleConfirmLogout = async () => {
    setLogoutModalVisible(false);
    await signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  // Upload de Foto de Perfil
  const handlePickAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await storageService.pickAndUploadImage('avatars', `avatar_${user?.ra || 'user'}`);
      if (res.canceled) return;
      if (res.publicUrl) {
        await updateAvatar(res.publicUrl);
        showToast('Foto de perfil atualizada com sucesso!', 'success');
      } else if (res.error) {
        showToast(res.error, 'error');
      }
    } catch {
      showToast('Erro ao enviar foto de perfil.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Retirar nova senha no CAA
  const handleIssueTicket = async () => {
    if (!user?.ra) {
      showToast('RA não localizado para emissão de senha.', 'error');
      return;
    }

    const sched = queueService.getOperatingHoursStatus();
    setCaaSchedule(sched);
    if (!sched.isOpen) {
      setTicketModalVisible(false);
      showToast(sched.closedMessage, 'info');
      return;
    }

    setTicketLoading(true);
    try {
      const ticket = await queueService.generateTicketForStudent({
        studentId: user.id || `std-${user.ra}`,
        studentName: user.name || 'Estudante Alvarista',
        studentRa: user.ra,
        studentCourse: user.course || 'Graduação FECAP',
        serviceType: selectedServiceType,
      });

      setActiveTicket(ticket);
      setTicketModalVisible(false);
      showToast(`Senha ${ticket.ticket_number} emitida com sucesso!`, 'success');
    } catch (e: any) {
      setTicketModalVisible(false);
      showToast(e?.message || 'Não foi possível emitir sua senha agora.', 'info');
    } finally {
      setTicketLoading(false);
    }
  };

  // Desistir da senha atual
  const handleCancelTicket = async () => {
    if (!activeTicket) return;
    setTicketLoading(true);
    try {
      await queueService.cancelTicket(activeTicket.id, user?.ra);
      setActiveTicket(null);
      setCancelTicketModalVisible(false);
      showToast('Você desistiu da sua senha de atendimento.', 'info');
    } catch (e) {
      showToast('Erro ao desistir da senha.', 'error');
    } finally {
      setTicketLoading(false);
    }
  };

  const hasAvatar = Boolean(user?.avatarUrl && user.avatarUrl.trim().length > 0);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header do Perfil com Avatar */}
        <FadeInView delay={30} translateY={12}>
          <View style={styles.profileHeader}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePickAvatar}
              disabled={uploadingAvatar}
              style={styles.avatarWrapper}
            >
              <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="large" color="#FFFFFF" />
                ) : hasAvatar ? (
                  <Image source={{ uri: user!.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
                ) : (
                  <User size={42} color="#FFFFFF" />
                )}
              </View>
              <View
                style={[
                  styles.cameraBadge,
                  { backgroundColor: colors.secondary, borderColor: colors.background },
                ]}
              >
                <Camera size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.75}>
              <Text style={[styles.changePhotoText, { color: colors.primary }]}>
                {uploadingAvatar ? 'Enviando foto...' : 'Alterar Foto'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.userName, { color: colors.textPrimary }]}>
              {user?.name || (currentRole === 'Funcionário' ? 'Colaborador FECAP' : 'Estudante Alvarista')}
            </Text>

            <View style={styles.metaBadgeRow}>
              <View style={[styles.metaPill, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.metaPillText, { color: colors.primaryDark }]}>
                  {currentRole === 'Funcionário' ? 'Chapa:' : 'RA:'} {user?.ra || '24026851'}
                </Text>
              </View>

              <View style={[styles.metaPill, { backgroundColor: colors.secondaryLight }]}>
                <Text style={[styles.metaPillText, { color: colors.secondary }]}>
                  Perfil: {currentRole}
                </Text>
              </View>
            </View>

            <Text style={[styles.userCourseText, { color: colors.textSecondary }]}>
              {user?.course || (currentRole === 'Funcionário' ? 'Central CAA / Atendimento' : 'Ciência da Computação')}
            </Text>

            {/* Botão de Alterar Informações / Editar Dados Cadastrais */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('PersonalData')}
              style={[styles.editInfoButton, { backgroundColor: colors.primary }]}
            >
              <Edit3 size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.editInfoButtonText}>Alterar Informações Cadastrais</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>

        {/* CARTÃO DE SENHA PRESENCIAL NOMINAL DO CAA (Para Alunos) */}
        {currentRole === 'Aluno' && (
          <FadeInView delay={60} translateY={12}>
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ticket size={18} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                    Atendimento Presencial CAA
                  </Text>
                </View>
                {activeTicket ? (
                  <View style={[styles.livePill, { backgroundColor: activeTicket.status === 'called' ? '#DC2626' : '#059669' }]}>
                    <Text style={styles.livePillText}>
                      {activeTicket.status === 'called' ? 'CHAMADA!' : 'ATIVA'}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.livePill, { backgroundColor: caaSchedule.isOpen ? '#059669' : '#64748B' }]}>
                    <Text style={styles.livePillText}>{caaSchedule.statusBadgeLabel}</Text>
                  </View>
                )}
              </View>

              {activeTicket ? (
                <View
                  style={[
                    styles.ticketCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: activeTicket.status === 'called' ? '#059669' : colors.border,
                      borderWidth: activeTicket.status === 'called' ? 2 : 1,
                    },
                  ]}
                >
                  <View style={styles.ticketTopRow}>
                    <View>
                      <Text style={[styles.ticketLabel, { color: colors.textSecondary }]}>SUA SENHA NOMINAL</Text>
                      <Text style={[styles.ticketNum, { color: colors.primary }]}>{activeTicket.ticket_number}</Text>
                    </View>
                    <View style={styles.ticketStatusBox}>
                      <Text
                        style={[
                          styles.ticketStatusText,
                          { color: activeTicket.status === 'called' ? '#059669' : '#D97706' },
                        ]}
                      >
                        {activeTicket.status === 'called'
                          ? `Dirija-se ao ${activeTicket.counter || 'Guichê'}`
                          : 'Aguardando no Painel'}
                      </Text>
                      <Text style={[styles.ticketServiceType, { color: colors.textSecondary }]}>
                        {activeTicket.service_type || 'Geral'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.ticketStudentInfo, { backgroundColor: colors.backgroundAlt }]}>
                    <Text style={[styles.ticketStudentName, { color: colors.textPrimary }]}>
                      {activeTicket.student_name}
                    </Text>
                    <Text style={[styles.ticketStudentMeta, { color: colors.textSecondary }]}>
                      RA: {activeTicket.student_ra} • {activeTicket.student_course}
                    </Text>
                  </View>

                  <View style={styles.ticketActionRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setCancelTicketModalVisible(true)}
                      style={[styles.cancelTicketBtn, { borderColor: '#DC2626' }]}
                    >
                      <Trash2 size={14} color="#DC2626" style={{ marginRight: 4 }} />
                      <Text style={[styles.cancelTicketText, { color: '#DC2626' }]}>Desistir da Senha</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={loadStudentTicket}
                      style={[styles.refreshTicketBtn, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
                    >
                      <RefreshCw size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={[styles.ticketEmptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.noTicketTitle, { color: colors.textPrimary }]}>
                    Nenhuma senha ativa no momento
                  </Text>
                  <Text style={[styles.noTicketDesc, { color: colors.textSecondary, marginBottom: 4 }]}>
                    Retire sua senha digital sequencial para atendimento presencial no balcão do CAA.
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 14, textAlign: 'center' }}>
                    Expediente: {caaSchedule.hoursSummary}
                  </Text>
                  <ScalePressable
                    onPress={() => {
                      const sched = queueService.getOperatingHoursStatus();
                      setCaaSchedule(sched);
                      if (!sched.isOpen) {
                        showToast(sched.closedMessage, 'info');
                        return;
                      }
                      setTicketModalVisible(true);
                    }}
                    style={[
                      styles.issueTicketBtn,
                      { backgroundColor: caaSchedule.isOpen ? colors.primary : '#94A3B8' },
                    ]}
                  >
                    <Ticket size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.issueTicketBtnText}>
                      {caaSchedule.isOpen ? 'Retirar Senha de Atendimento' : 'Fora do Horário de Expediente'}
                    </Text>
                  </ScalePressable>
                </View>
              )}

              {/* Histórico de Atendimentos Presenciais Concluídos */}
              {ticketHistory.length > 0 && (
                <View style={styles.historySection}>
                  <View style={styles.historySectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={15} color="#059669" />
                      <Text style={[styles.historySectionTitle, { color: colors.textPrimary }]}>
                        Histórico de Senhas Concluídas ({ticketHistory.length})
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 8, marginTop: 8 }}>
                    {ticketHistory.slice(0, 5).map((item) => (
                      <View
                        key={item.id}
                        style={[
                          styles.historyItemCard,
                          {
                            backgroundColor: isDark ? colors.card : '#FFFFFF',
                            borderColor: isDark ? colors.border : '#E2E8F0',
                          },
                        ]}
                      >
                        <View style={styles.historyItemTop}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ticket size={14} color={colors.primary} />
                            <Text style={[styles.historyItemNum, { color: colors.textPrimary }]}>
                              {item.ticket_number}
                            </Text>
                            <View style={[styles.historyItemBadge, { backgroundColor: '#D1FAE5' }]}>
                              <Text style={styles.historyItemBadgeText}>Atendido</Text>
                            </View>
                          </View>
                          <Text style={[styles.historyItemDate, { color: colors.textMuted }]}>
                            {item.completed_at
                              ? new Date(item.completed_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : item.created_at
                              ? new Date(item.created_at).toLocaleDateString('pt-BR')
                              : 'Concluído'}
                          </Text>
                        </View>
                        <View style={styles.historyItemBottom}>
                          <Text style={[styles.historyItemSub, { color: colors.textSecondary }]}>
                            {item.service_type || 'Geral'} • {item.counter || 'Guichê CAA'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </FadeInView>
        )}

        {/* MENU PRINCIPAL DE OPÇÕES (HUB MODULAR) */}
        <FadeInView delay={90} translateY={12}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Menu da Conta</Text>

            {/* Opção 1: Alterar Informações Cadastrais */}
            <ScalePressable
              onPress={() => navigation.navigate('PersonalData')}
              style={[styles.menuItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconCircle, { backgroundColor: colors.primaryLight }]}>
                  <FileText size={20} color={colors.primary} />
                </View>
                <View style={styles.menuItemTextBox}>
                  <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>
                    Alterar Informações Cadastrais
                  </Text>
                  <Text style={[styles.menuItemSub, { color: colors.textSecondary }]}>
                    Editar dados pessoais, documentos, endereço e CEP
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.textMuted} />
            </ScalePressable>

            {/* Opção 2: Configurações do Aplicativo */}
            <ScalePressable
              onPress={() => navigation.navigate('Settings')}
              style={[styles.menuItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconCircle, { backgroundColor: colors.secondaryLight }]}>
                  <Settings size={20} color={colors.secondary} />
                </View>
                <View style={styles.menuItemTextBox}>
                  <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>
                    Configurações do Aplicativo
                  </Text>
                  <Text style={[styles.menuItemSub, { color: colors.textSecondary }]}>
                    Modo escuro, notificações push e sobre
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.textMuted} />
            </ScalePressable>

            {/* Opção 4: Sair da Conta */}
            <ScalePressable
              onPress={() => setLogoutModalVisible(true)}
              style={[
                styles.menuItemCard,
                styles.logoutCard,
                { backgroundColor: colors.card, borderColor: colors.errorLight },
              ]}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconCircle, { backgroundColor: colors.errorLight }]}>
                  <LogOut size={20} color={colors.error} />
                </View>
                <View style={styles.menuItemTextBox}>
                  <Text style={[styles.menuItemTitle, { color: colors.error }]}>
                    Sair da Conta
                  </Text>
                  <Text style={[styles.menuItemSub, { color: colors.textSecondary }]}>
                    Encerrar sessão com segurança
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.error} />
            </ScalePressable>
          </View>
        </FadeInView>
      </ScrollView>

      {/* Modal para Retirar Senha no CAA */}
      <Modal visible={ticketModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ticket size={20} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Retirar Senha CAA</Text>
              </View>
              <TouchableOpacity onPress={() => setTicketModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Escolha a finalidade do atendimento presencial no balcão Alvarista:
            </Text>

            {['Geral', 'Financeiro', 'Prioritário'].map((type) => {
              const isSelected = selectedServiceType === type;
              return (
                <TouchableOpacity
                  key={type}
                  activeOpacity={0.8}
                  onPress={() => setSelectedServiceType(type)}
                  style={[
                    styles.serviceTypeOption,
                    {
                      backgroundColor: isSelected ? colors.primaryLight : colors.backgroundAlt,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.serviceTypeTitle,
                        { color: isSelected ? colors.primaryDark : colors.textPrimary },
                      ]}
                    >
                      {type === 'Geral'
                        ? 'Atendimento Geral (Secretaria)'
                        : type === 'Financeiro'
                        ? 'Financeiro / Bolsas & Negociação'
                        : 'Atendimento Prioritário (Lei 10.048)'}
                    </Text>
                    <Text style={[styles.serviceTypeSub, { color: colors.textSecondary }]}>
                      {type === 'Geral'
                        ? 'Declarações, atestados, histórico escolar e dúvidas'
                        : type === 'Financeiro'
                        ? 'Bolsas, parcelamentos e acordos financeiros'
                        : 'Gestantes, idosos, PCDs e pessoas com criança de colo'}
                    </Text>
                  </View>
                  {isSelected && <CheckCircle2 size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}

            <ScalePressable
              onPress={handleIssueTicket}
              disabled={ticketLoading}
              style={[styles.confirmTicketBtn, { backgroundColor: colors.primary }]}
            >
              {ticketLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmTicketBtnText}>Confirmar e Emitir Senha</Text>
              )}
            </ScalePressable>
          </View>
        </View>
      </Modal>

      {/* Modal de Desistência da Senha */}
      <ConfirmationModal
        visible={cancelTicketModalVisible}
        title="Deseja desistir da sua senha?"
        description={`Sua senha ${activeTicket?.ticket_number} será cancelada e removida da fila de espera do CAA.`}
        confirmText="Sim, Desistir"
        cancelText="Permanecer na Fila"
        variant="danger"
        onConfirm={handleCancelTicket}
        onCancel={() => setCancelTicketModalVisible(false)}
      />

      {/* Modal de Confirmação de Logout */}
      <ConfirmationModal
        visible={logoutModalVisible}
        title="Deseja sair da sua conta?"
        description="Você precisará informar suas credenciais novamente para acessar o aplicativo."
        confirmText="Sair da Conta"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleConfirmLogout}
        onCancel={() => setLogoutModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 10,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  changePhotoText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  metaBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  userCourseText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  livePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  livePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  ticketCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  ticketTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ticketNum: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
  },
  ticketStatusBox: {
    alignItems: 'flex-end',
  },
  ticketStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  ticketServiceType: {
    fontSize: 11,
    marginTop: 2,
  },
  ticketStudentInfo: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  ticketStudentName: {
    fontSize: 13,
    fontWeight: '700',
  },
  ticketStudentMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  ticketActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelTicketText: {
    fontSize: 12,
    fontWeight: '700',
  },
  refreshTicketBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  ticketEmptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  noTicketTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  noTicketDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14,
  },
  issueTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  issueTicketBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  logoutCard: {
    marginTop: 6,
  },
  menuItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemTextBox: {
    flex: 1,
    marginLeft: 12,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuItemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalDesc: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  serviceTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  serviceTypeTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  serviceTypeSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  confirmTicketBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  confirmTicketBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  editInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 12,
  },
  editInfoButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  historySection: {
    marginTop: 16,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historySectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  historyItemCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyItemNum: {
    fontSize: 14,
    fontWeight: '800',
  },
  historyItemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  historyItemBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  historyItemDate: {
    fontSize: 11,
  },
  historyItemBottom: {
    marginTop: 4,
  },
  historyItemSub: {
    fontSize: 12,
  },
});
