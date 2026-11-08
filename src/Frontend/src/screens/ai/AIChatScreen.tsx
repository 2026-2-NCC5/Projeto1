import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Modal,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  ChevronLeft,
  Send,
  Sparkles,
  History,
  Plus,
  Trash2,
  ArrowUpRight,
  Headphones,
  Bot,
  MessageSquare,
  X,
  FileText,
  UserCheck,
  CheckCircle2,
  ShieldCheck,
  Clock,
  User,
  Star,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { aiChatService, ChatMessage } from '../../services/ai-agent/aiChatService';
import { chatHistoryService, ChatSession } from '../../services/ai-agent/chatHistoryService';
import { liveChatService, LiveChatMessage, LiveSupportSession } from '../../services/supabase/liveChatService';
import { isGroqConfigured, getGroqModel } from '../../services/ai-agent/groqClient';
import { pushNotificationService } from '../../services/notifications/pushNotificationService';
import { MarkdownMessage } from '../../components/chat/MarkdownMessage';
import { ManualRequirementModal } from '../../components/modals/ManualRequirementModal';
import { SatisfactionRatingCard } from '../../components/feedback/SatisfactionRatingCard';
import { SatisfactionFeedbackModal } from '../../components/feedback/SatisfactionFeedbackModal';
import AiOrbSvg from '../../assets/illustrations/ai_orb.svg';

function deduplicateMessages(msgs: LiveChatMessage[]): LiveChatMessage[] {
  const seenIds = new Set<string>();
  const seenContent = new Set<string>();
  const result: LiveChatMessage[] = [];

  for (const m of msgs) {
    if (!m || !m.text) continue;
    if (m.id && seenIds.has(m.id)) continue;
    if (m.id) seenIds.add(m.id);

    const normText = m.text.trim();
    const contentKey = `${m.sender}_${m.senderRole || ''}_${normText}`;
    if (seenContent.has(contentKey)) continue;
    seenContent.add(contentKey);

    result.push(m);
  }
  return result;
}

export const AIChatScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const { user, selectedRole } = useAuth();
  const { addRequirement, showToast } = useApp();

  const currentRole = user?.role || selectedRole || 'Aluno';
  const isStaff = currentRole === 'Funcionário';
  const activeUserId = user?.id || user?.ra || 'guest';
  const initialPrompt = route.params?.initialPrompt;
  const passedSession: LiveSupportSession | undefined = route.params?.liveSession;
  const staffSupportMode: boolean = Boolean(route.params?.staffSupportMode && isStaff);
  const passedStudentRa: string | undefined = route.params?.studentRa;
  const passedStudentName: string | undefined = route.params?.studentName;
  const passedStudentCourse: string | undefined = route.params?.studentCourse;
  const passedStudentStatus: string | undefined = route.params?.studentStatus;

  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const lastHandledPromptRef = useRef<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [manualReqModalVisible, setManualReqModalVisible] = useState(false);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);

  // Estado de atendimento humano ao vivo
  const [liveStatus, setLiveStatus] = useState<'ai_active' | 'waiting_staff' | 'in_human_support' | 'resolved'>(
    passedSession?.status || 'ai_active'
  );
  const [assignedStaffName, setAssignedStaffName] = useState<string | undefined>(
    passedSession?.assignedStaffName
  );
  const [studentInfo, setStudentInfo] = useState<{ name: string; ra: string; course?: string } | null>(
    passedSession
      ? { name: passedSession.studentName, ra: passedSession.studentRa, course: passedSession.studentCourse }
      : null
  );

  const isLiveSupportActive = liveStatus === 'in_human_support' || liveStatus === 'waiting_staff';
  const isStaffLiveSupport = Boolean(
    staffSupportMode || (isStaff && (passedSession != null || isLiveSupportActive))
  );

  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const activeSessionIdRef = useRef<string | null>(passedSession?.id || null);
  const detachedFromLiveRef = useRef<boolean>(false);
  const initCompletedRef = useRef<boolean>(false);

  // Animação contínua da marca d'água oficial
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Inicialização de sessão: modo atendimento funcionário ou modo aluno SISA
  useEffect(() => {
    async function init() {
      if (staffSupportMode && passedSession) {
        // Trava para evitar que dois atendentes entrem no mesmo chamado
        const isLockedByOther =
          passedSession.status === 'in_human_support' &&
          passedSession.assignedStaffId &&
          passedSession.assignedStaffId !== user?.id &&
          passedSession.assignedStaffName &&
          passedSession.assignedStaffName !== user?.name;

        if (isLockedByOther) {
          Alert.alert(
            'Atendimento Bloqueado',
            `Este aluno já está sendo atendido por ${passedSession.assignedStaffName}.\n\nPara otimizar a fila e evitar conflito de orientações, você foi redirecionado para a fila de espera.`,
            [{ text: 'Voltar para a Fila', onPress: () => navigation.goBack() }]
          );
          return;
        }

        // Se o chamado ainda estava aguardando, o funcionário assume formalmente com a trava
        if (passedSession.status === 'waiting_staff' && user?.name) {
          const assignRes = await liveChatService.assignStaffToSession({
            sessionId: passedSession.id,
            staffId: user?.id || 'staff-1',
            staffName: user?.name,
          });

          if (!assignRes.success && assignRes.alreadyAssigned) {
            Alert.alert(
              'Chamado já em Atendimento',
              `Este aluno acabou de ser assumido por ${assignRes.assignedStaffName || 'outro colaborador'}.\n\nVocê foi redirecionado para atender os próximos estudantes da fila.`,
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
            return;
          }

          setLiveStatus('in_human_support');
          setAssignedStaffName(user?.name);
        } else {
          setLiveStatus(passedSession.status);
          setAssignedStaffName(passedSession.assignedStaffName || user?.name);
        }

        // Carrega todas as mensagens (incluindo o histórico com a SISA prévio)
        activeSessionIdRef.current = passedSession.id;
        const loadedMessages = await liveChatService.getSessionMessages(passedSession.id);
        setMessages(deduplicateMessages(loadedMessages));

        setCurrentSession({
          id: passedSession.id,
          title: passedSession.title,
          role: 'Aluno',
          status: passedSession.status === 'waiting_staff' ? 'in_human_support' : passedSession.status,
          assignedStaffName: user?.name || passedSession.assignedStaffName,
          lastMessagePreview: passedSession.lastMessagePreview || '',
          messages: loadedMessages,
          createdAt: passedSession.createdAt,
          updatedAt: passedSession.updatedAt,
        });
        initCompletedRef.current = true;
      } else {
        // Modo Aluno
        // Só recupera atendimento humano ao vivo ativo se a rota explicitamente pediu suporte humano (ex: redirect ou chamado ao vivo)
        const shouldResumeLive = Boolean(
          route.params?.liveSession ||
          route.params?.resumeLiveSession ||
          route.params?.requestHumanTransfer
        );

        if (shouldResumeLive && !isStaff && !detachedFromLiveRef.current) {
          const activeLiveSession = await liveChatService.getStudentActiveLiveSession(
            user?.id,
            user?.ra || '24026851'
          );

          if (activeLiveSession) {
            activeSessionIdRef.current = activeLiveSession.id;
            setLiveStatus(activeLiveSession.status);
            setAssignedStaffName(activeLiveSession.assignedStaffName);
            const loadedMsgs = await liveChatService.getSessionMessages(activeLiveSession.id);
            setMessages(deduplicateMessages(loadedMsgs));
            setCurrentSession({
              id: activeLiveSession.id,
              title: activeLiveSession.title,
              role: 'Aluno',
              status: activeLiveSession.status,
              assignedStaffName: activeLiveSession.assignedStaffName,
              lastMessagePreview: activeLiveSession.lastMessagePreview || '',
              messages: loadedMsgs,
              createdAt: activeLiveSession.createdAt,
              updatedAt: activeLiveSession.updatedAt,
            });

            await chatHistoryService.setActiveSessionId(activeLiveSession.id, activeUserId);
            chatHistoryService.getSessions(currentRole, activeUserId).then(setAllSessions);
            initCompletedRef.current = true;
            return;
          }
        }

        // Se veio com forceNewSession ou funcionário consultando aluno específico com prompt, cria novo chat
        const isStaffStudentQuery = isStaff && Boolean(initialPrompt);
        const shouldForceNew = Boolean(route.params?.forceNewSession || isStaffStudentQuery);
        let activeSession: ChatSession | null = null;

        if (!shouldForceNew) {
          // Recupera a sessão ativa recente para preservar a conversa do aluno ao sair e voltar
          activeSession = await chatHistoryService.getLatestActiveSession(
            currentRole,
            activeUserId,
            user?.ra
          );
        }

        if (!activeSession) {
          const sessTitle = isStaffStudentQuery
            ? (passedStudentName ? `Análise: ${passedStudentName.split(' ')[0]} (${passedStudentRa || ''})` : `Consulta: ${initialPrompt.slice(0, 24).trim()}...`)
            : 'Nova Conversa';
          activeSession = await chatHistoryService.createNewSession(
            currentRole,
            sessTitle,
            activeUserId,
            user?.ra,
            passedStudentName || user?.name
          );
          if (passedStudentRa) {
            activeSession.studentRa = passedStudentRa;
            activeSession.studentName = passedStudentName;
          }
        }

        activeSessionIdRef.current = activeSession.id;
        setLiveStatus(activeSession.status || 'ai_active');
        setAssignedStaffName(activeSession.assignedStaffName);
        setCurrentSession(activeSession);
        setMessages(deduplicateMessages([...(activeSession.messages as LiveChatMessage[])]));

        const sessions = await chatHistoryService.getSessions(currentRole, activeUserId, user?.ra);
        setAllSessions(sessions);
        initCompletedRef.current = true;

        if (route.params?.requestHumanTransfer) {
          handleRequestHumanTransfer();
        } else if (initialPrompt && lastHandledPromptRef.current !== initialPrompt) {
          lastHandledPromptRef.current = initialPrompt;
          navigation.setParams({ initialPrompt: undefined });
          handleSendMessage(initialPrompt, activeSession);
        }
      }
    }

    init();
  }, [currentRole, activeUserId, passedSession?.id, staffSupportMode]);

  // Cria automaticamente uma nova sessão isolada quando o funcionário ou aluno envia uma nova consulta externa
  useEffect(() => {
    if (!initCompletedRef.current) return;
    const incomingPrompt = route.params?.initialPrompt;
    if (incomingPrompt && lastHandledPromptRef.current !== incomingPrompt) {
      lastHandledPromptRef.current = incomingPrompt;
      navigation.setParams({ initialPrompt: undefined });

      (async () => {
        const studentName = route.params?.studentName || passedStudentName;
        const studentRa = route.params?.studentRa || passedStudentRa;
        const title = isStaff
          ? (studentName ? `Análise: ${studentName.split(' ')[0]} (${studentRa || ''})` : `Consulta: ${incomingPrompt.slice(0, 24).trim()}...`)
          : 'Nova Conversa';
        const freshSession = await chatHistoryService.createNewSession(
          currentRole,
          title,
          activeUserId,
          user?.ra,
          studentName || user?.name
        );
        if (studentRa) {
          freshSession.studentRa = studentRa;
          freshSession.studentName = studentName;
        }
        activeSessionIdRef.current = freshSession.id;
        setLiveStatus('ai_active');
        setAssignedStaffName(undefined);
        setCurrentSession(freshSession);
        setMessages(deduplicateMessages([...(freshSession.messages as LiveChatMessage[])]));
        handleSendMessage(incomingPrompt, freshSession);
      })();
    }
  }, [route.params?.initialPrompt]);

  // Recarrega automaticamente mensagens em foco APENAS se a conversa ativa exibida for de atendimento humano
  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;

      async function refreshOnFocus() {
        if (!initCompletedRef.current) return;

        // Se a conversa aberta no momento for atendimento humano ao vivo
        if (isLiveSupportActive && currentSession?.id) {
          const fresh = await liveChatService.getSessionMessages(currentSession.id);
          if (isCurrent && activeSessionIdRef.current === currentSession.id) {
            setMessages(deduplicateMessages(fresh));
          }
        } else if (staffSupportMode && passedSession?.id) {
          const fresh = await liveChatService.getSessionMessages(passedSession.id);
          if (isCurrent && activeSessionIdRef.current === passedSession.id) {
            setMessages(deduplicateMessages(fresh));
          }
        }
      }

      refreshOnFocus();

      return () => {
        isCurrent = false;
      };
    }, [isLiveSupportActive, currentSession?.id, staffSupportMode, passedSession?.id])
  );

  const safeScrollToEnd = (animated: boolean = true) => {
    try {
      flatListRef.current?.scrollToEnd({ animated });
    } catch {
      // ignore layout transition timing
    }
  };

  // Inscrição em tempo real para receber novas mensagens da sessão
  useEffect(() => {
    if (!currentSession?.id) return;
    let active = true;

    const targetSessionId = currentSession.id;
    const unsubscribe = liveChatService.subscribeToSessionMessages(
      targetSessionId,
      (newMsg) => {
        if (!active || activeSessionIdRef.current !== targetSessionId) return;

        setMessages((prev) => {
          return deduplicateMessages([...prev, newMsg]);
        });

        // Se o chamado foi concluído pela equipe, atualiza status e avisa o aluno sem bloquear a thread de UI nativa
        if (newMsg.senderRole === 'Sistema' && (newMsg.text.includes('finalizado') || newMsg.text.includes('concluído'))) {
          setLiveStatus('resolved');
          if (!isStaff) {
            showToast(
              `Atendimento finalizado por ${newMsg.senderName || 'Central CAA'}. Histórico salvo!`,
              'success'
            );
          }
        }

        setTimeout(() => {
          if (active) safeScrollToEnd();
        }, 180);
      }
    );

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [currentSession?.id, isStaff]);

  // Rolagem automática ao abrir o teclado
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        safeScrollToEnd();
      }, 100);
    });
    return () => sub.remove();
  }, []);

  const isHumanTransferQuery = (text: string) => {
    const t = text.toLowerCase().trim();
    return (
      t.includes('humano') ||
      t.includes('atendente') ||
      t.includes('funcionario') ||
      t.includes('funcionário') ||
      t.includes('pessoa real') ||
      t.includes('contato humano') ||
      t.includes('atendimento humano') ||
      t.includes('falar com alguém') ||
      t.includes('falar com alguem') ||
      t.includes('atendente real') ||
      t.includes('suporte humano') ||
      t.includes('transferir') ||
      t.includes('transferência') ||
      t.includes('transferencia') ||
      t.includes('falar com a caa') ||
      t.includes('falar com o caa') ||
      (t.includes('pedi') && t.includes('contato'))
    );
  };

  // Solicitar transferência para atendente humano (pelo Aluno)
  const handleRequestHumanTransfer = async (userNote?: string) => {
    // Se já estiver aguardando atendente ou em atendimento com atendente, não duplica
    if (liveStatus === 'waiting_staff' || liveStatus === 'in_human_support') {
      if (userNote && currentSession?.id) {
        await liveChatService.sendMessage({
          sessionId: currentSession.id,
          text: userNote,
          sender: 'user',
          senderName: user?.name || 'Aluno',
          senderRole: 'Aluno',
          isHuman: true,
        });
      }
      showToast('Você já está em atendimento com a Central CAA.', 'info');
      return;
    }

    let session = currentSession;
    if (!session) {
      session = await chatHistoryService.createNewSession(currentRole, 'Nova Conversa', activeUserId);
      setCurrentSession(session);
    }
    if (!session) return;

    let updatedMsgList = messages;
    if (typeof userNote === 'string' && userNote.trim().length > 0) {
      const userMsg: LiveChatMessage = {
        id: `usr-${Date.now()}`,
        sender: 'user',
        senderName: user?.name || 'Aluno',
        senderRole: 'Aluno',
        isHuman: true,
        text: userNote.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      updatedMsgList = [...messages, userMsg];
      setMessages(updatedMsgList);
    }

    const res = await liveChatService.requestHumanTransfer({
      sessionId: session.id,
      studentId: user?.id || user?.ra || 'student-1',
      studentName: user?.name || 'Estudante Alvarista',
      studentRa: user?.ra || '24026851',
      studentCourse: user?.course || 'Graduação FECAP',
      priorMessages: updatedMsgList,
    });

    if (res.success && res.session) {
      detachedFromLiveRef.current = false;
      activeSessionIdRef.current = res.session.id;
      setLiveStatus('waiting_staff');
      if (res.session.id !== session.id) {
        setCurrentSession({ ...session, id: res.session.id });
      }

      showToast('Solicitação enviada! Um funcionário da CAA atenderá você em instantes.', 'info');

      const sysNotice: LiveChatMessage = {
        id: `sys-${Date.now()}`,
        sender: 'assistant',
        senderName: 'Central SISA / CAA',
        senderRole: 'Sistema',
        isHuman: false,
        text: '🔔 **Atendimento transferido para a Central CAA.**\nSeu chamado foi posicionado na fila de colaboradores com todo o histórico prévio da conversa.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, sysNotice]);
    }
  };

  // Concluir atendimento humano (pelo Funcionário)
  const [isResolvingSession, setIsResolvingSession] = useState(false);

  const handleResolveSession = async () => {
    if (!currentSession || isResolvingSession || liveStatus === 'resolved') return;
    Keyboard.dismiss();
    setIsResolvingSession(true);
    try {
      await liveChatService.resolveSession(currentSession.id, user?.name);
      setLiveStatus('resolved');
      showToast('Atendimento finalizado com sucesso!', 'success');
    } catch (e) {
      console.warn('Erro ao finalizar sessão:', e);
      showToast('Erro ao finalizar atendimento.', 'error');
    } finally {
      setIsResolvingSession(false);
    }
  };

  const handleSendMessage = async (textToSend?: string, targetSession?: ChatSession) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    const activeTargetSession = targetSession || currentSession;
    const activeBaseMessages = targetSession ? (targetSession.messages as LiveChatMessage[]) : messages;

    // Se o aluno solicitar contato/atendente humano no texto para a SISA, transfere imediatamente
    if (!isStaff && !isLiveSupportActive && isHumanTransferQuery(query)) {
      setInputText('');
      await handleRequestHumanTransfer(query);
      return;
    }

    if (!activeTargetSession) return;

    setInputText('');
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Se o atendimento humano anterior foi concluído e o aluno enviar nova mensagem, inicia novo chat com a SISA
    if (!isStaff && liveStatus === 'resolved') {
      const newSession = await chatHistoryService.createNewSession(currentRole, 'Nova Conversa', activeUserId);
      activeSessionIdRef.current = newSession.id;
      setCurrentSession(newSession);
      setLiveStatus('ai_active');
      setAssignedStaffName(undefined);
      setStudentInfo(null);
      setMessages([...(newSession.messages as LiveChatMessage[])]);
    }

    // SE ESTIVER EM ATENDIMENTO HUMANO (Aluno ou Funcionário)
    if (liveStatus === 'in_human_support' || liveStatus === 'waiting_staff' || (staffSupportMode && liveStatus !== 'resolved')) {
      const senderType = isStaff ? 'assistant' : 'user';
      const senderRole = isStaff ? 'Funcionário' : 'Aluno';
      const senderName = user?.name || (isStaff ? 'Atendente CAA' : 'Aluno');

      const sentMsg = await liveChatService.sendMessage({
        sessionId: currentSession?.id || activeSessionIdRef.current || '',
        text: query,
        sender: senderType,
        senderName,
        senderRole,
        isHuman: true,
      });

      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });

      return;
    }

    // FLUXO REGULAR DE IA SISA
    const userMsg: LiveChatMessage = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'user',
      senderName: user?.name || 'Aluno',
      senderRole: 'Aluno',
      isHuman: true,
      text: query,
      timestamp: nowTime,
    };

    const updatedMessages = deduplicateMessages([...activeBaseMessages, userMsg]);
    setMessages(updatedMessages);
    setIsTyping(true);
    setTimeout(() => safeScrollToEnd(true), 60);

    const studentCtx = {
      ra: passedStudentRa || activeTargetSession?.studentRa || (!isStaff ? user?.ra : undefined),
      name: passedStudentName || activeTargetSession?.studentName || (!isStaff ? user?.name : undefined),
      status: passedStudentStatus,
      course: passedStudentCourse || (!isStaff ? user?.course : undefined),
      semester: !isStaff ? user?.semester : undefined,
    };

    const updatedSession: ChatSession = {
      ...(activeTargetSession || {}),
      id: activeTargetSession?.id || activeSessionIdRef.current || `sess-${Date.now()}`,
      title: activeTargetSession?.title || 'Nova Conversa',
      role: currentRole,
      createdAt: activeTargetSession?.createdAt || new Date().toISOString(),
      messages: updatedMessages,
      lastMessagePreview: query,
      updatedAt: new Date().toISOString(),
      studentRa: studentCtx.ra || activeTargetSession?.studentRa,
      studentName: studentCtx.name || activeTargetSession?.studentName,
    };
    setCurrentSession(updatedSession);
    await chatHistoryService.saveSession(updatedSession, activeUserId, user?.ra);

    try {
      const response = await aiChatService.sendMessage(query, updatedMessages, currentRole, studentCtx);

      // Se a IA confirmou a abertura de um requerimento, cria o requerimento real
      if (response.createdRequirementPayload) {
        const createdReq = await addRequirement({
          ...response.createdRequirementPayload,
          studentRa: user?.ra || '24026851',
          studentName: user?.name || 'Lucas Alvarista',
          studentCourse: user?.course || 'Ciência da Computação',
        });
        response.text = `${response.text}\n\n📌 **Protocolo Oficial Gerado**: \`${createdReq.protocol}\``;
      }

      const finalMsg: LiveChatMessage = {
        ...response,
        id: response.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderName: 'SISA IA',
        senderRole: 'IA',
        isHuman: false,
      };

      const finalMessages = deduplicateMessages([...updatedMessages, finalMsg]);
      setMessages(finalMessages);
      setTimeout(() => safeScrollToEnd(true), 80);

      const finalSession: ChatSession = {
        ...updatedSession,
        messages: finalMessages,
        lastMessagePreview: response.text.slice(0, 60),
        updatedAt: new Date().toISOString(),
        studentRa: studentCtx.ra || updatedSession.studentRa,
        studentName: studentCtx.name || updatedSession.studentName,
      };
      setCurrentSession(finalSession);
      await chatHistoryService.saveSession(finalSession, activeUserId, user?.ra);

      const refreshed = await chatHistoryService.getSessions(currentRole, activeUserId, user?.ra);
      setAllSessions(refreshed);
    } catch (err: any) {
      const errResponse: LiveChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        senderName: 'SISA IA',
        senderRole: 'IA',
        isHuman: false,
        text: 'Desculpe, ocorreu uma instabilidade momentânea ao processar sua dúvida. Por favor, tente novamente.',
        timestamp: nowTime,
      };
      setMessages((prev) => [...prev, errResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCreateNewChat = async () => {
    detachedFromLiveRef.current = true;
    // Encerra qualquer atendimento humano pendente no dispositivo para que não interfira com a nova conversa
    await liveChatService.clearStudentActiveLiveSession(user?.ra, user?.id);

    const newSession = await chatHistoryService.createNewSession(currentRole, 'Nova Conversa', activeUserId, user?.ra, user?.name);
    activeSessionIdRef.current = newSession.id;
    setLiveStatus('ai_active');
    setAssignedStaffName(undefined);
    setStudentInfo(null);
    setCurrentSession(newSession);
    setMessages([...(newSession.messages as LiveChatMessage[])]);
    await chatHistoryService.setActiveSessionId(newSession.id, activeUserId, user?.ra);
    const sessions = await chatHistoryService.getSessions(currentRole, activeUserId, user?.ra);
    setAllSessions(sessions);
    setHistoryModalVisible(false);
  };

  const handleSelectSession = async (session: ChatSession) => {
    const isLive = session.status === 'waiting_staff' || session.status === 'in_human_support';
    detachedFromLiveRef.current = !isLive;
    activeSessionIdRef.current = session.id;
    setCurrentSession(session);
    setLiveStatus(session.status || 'ai_active');
    setAssignedStaffName(session.assignedStaffName);
    await chatHistoryService.setActiveSessionId(session.id, activeUserId);

    if (isLive) {
      const fresh = await liveChatService.getSessionMessages(session.id);
      setMessages(deduplicateMessages(fresh));
    } else {
      setMessages([...(session.messages as LiveChatMessage[])]);
    }

    setHistoryModalVisible(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await chatHistoryService.deleteSession(sessionId, activeUserId);
    const refreshed = await chatHistoryService.getSessions(currentRole, activeUserId);
    setAllSessions(refreshed);
    if (currentSession?.id === sessionId) {
      if (refreshed.length > 0) {
        setCurrentSession(refreshed[0]);
        setMessages(refreshed[0].messages as LiveChatMessage[]);
      } else {
        await handleCreateNewChat();
      }
    }
  };

  const handleQuickReply = (text: string) => {
    if (text.toLowerCase().includes('humano') || text.toLowerCase().includes('atendente')) {
      handleRequestHumanTransfer();
    } else {
      handleSendMessage(text);
    }
  };

  const handleActionPress = (action: any) => {
    if (
      action.route === 'RequirementsTab' ||
      action.route === 'Requirements' ||
      action.route === 'StudentRequirements'
    ) {
      navigation.navigate('StudentRequirements');
    } else if (action.route === 'DocumentsTab') {
      navigation.navigate('Arquivo');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} translucent={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={styles.container}
      >
        {/* Header do Chat */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={22} color={colors.secondary} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <View
              style={[
                styles.aiBadge,
                {
                  backgroundColor: isLiveSupportActive
                    ? liveStatus === 'in_human_support'
                      ? '#D1FAE5'
                      : '#FEF3C7'
                    : colors.primaryLight,
                },
              ]}
            >
              {isLiveSupportActive ? (
                <View key="badge-human">
                  <UserCheck
                    size={13}
                    color={liveStatus === 'in_human_support' ? '#059669' : '#D97706'}
                  />
                </View>
              ) : (
                <View key="badge-ai">
                  <Sparkles size={13} color={colors.primary} />
                </View>
              )}
              <Text
                style={[
                  styles.aiBadgeText,
                  {
                    color: isLiveSupportActive
                      ? liveStatus === 'in_human_support'
                        ? '#059669'
                        : '#D97706'
                      : colors.primaryDark,
                  },
                ]}
              >
                {staffSupportMode
                  ? `Atendendo: ${studentInfo?.name || 'Aluno'}`
                  : isLiveSupportActive
                  ? liveStatus === 'in_human_support'
                    ? `Atendente: ${assignedStaffName || 'CAA FECAP'}`
                    : 'Fila CAA • Aguardando Atendente'
                  : currentRole === 'Funcionário'
                  ? (currentSession?.studentName || passedStudentName ? `Análise: ${(currentSession?.studentName || passedStudentName)?.split(' ')[0]}` : 'Agente Analítico SISA')
                  : 'SISA FECAP Oficial'}
              </Text>
            </View>

            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {staffSupportMode
                ? `RA: ${studentInfo?.ra || '24026851'} • Histórico Preservado`
                : isLiveSupportActive
                ? liveStatus === 'in_human_support'
                  ? 'Conversa Privada e Restrita em Tempo Real'
                  : 'Chamado na fila de colaboradores'
                : currentRole === 'Funcionário'
                ? (currentSession?.studentRa || passedStudentRa ? `RA: ${currentSession?.studentRa || passedStudentRa} • IA de Sucesso e Risco` : 'IA de Métricas e Diagnósticos de Alunos')
                : `Groq IA Conectada (${getGroqModel().split('/')[1] || 'Qwen 27B'})`}
            </Text>
          </View>

          <View style={styles.headerRightActions}>
            {/* Botão de Transferir para Atendente Humano (para o Aluno) */}
            {!isStaff && !isLiveSupportActive && (
              <TouchableOpacity
                key="btn-human-transfer"
                activeOpacity={0.8}
                onPress={() => handleRequestHumanTransfer()}
                style={[styles.backButton, { backgroundColor: '#EDE9FE', borderColor: '#8B5CF6' }]}
                accessibilityLabel="Falar com atendente humano da CAA"
              >
                <Headphones size={18} color="#7C3AED" />
              </TouchableOpacity>
            )}

            {/* Botão de Concluir Atendimento (para o Funcionário) */}
            {staffSupportMode && liveStatus !== 'resolved' && (
              <TouchableOpacity
                key="btn-resolve-session"
                activeOpacity={0.8}
                disabled={isResolvingSession}
                onPress={handleResolveSession}
                style={[styles.backButton, { backgroundColor: '#D1FAE5', borderColor: '#059669' }]}
                accessibilityLabel="Concluir atendimento"
              >
                {isResolvingSession ? (
                  <View key="resolving-spin">
                    <ActivityIndicator size="small" color="#059669" />
                  </View>
                ) : (
                  <View key="resolving-icon">
                    <CheckCircle2 size={18} color="#059669" />
                  </View>
                )}
              </TouchableOpacity>
            )}

            {!staffSupportMode && (
              <>
                {currentRole === 'Aluno' && (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setFeedbackModalVisible(true)}
                      style={[
                        styles.backButton,
                        {
                          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
                          borderColor: '#F59E0B',
                        },
                      ]}
                      accessibilityLabel="Avaliar atendimento"
                    >
                      <Star size={18} color="#D97706" fill="#F59E0B" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setManualReqModalVisible(true)}
                      style={[styles.backButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
                      accessibilityLabel="Abrir requerimento manual"
                    >
                      <FileText size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setHistoryModalVisible(true)}
                  style={[styles.backButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
                >
                  <History size={19} color={colors.secondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleCreateNewChat}
                  style={[styles.backButton, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                >
                  <Plus size={19} color={colors.primaryDark} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Banner Informativo de Atendimento Humano ou Concluído */}
        {isLiveSupportActive && (
          <View
            key="banner-live-active"
            style={[
              styles.liveBanner,
              {
                backgroundColor:
                  liveStatus === 'in_human_support'
                    ? isDark
                      ? 'rgba(5, 150, 105, 0.15)'
                      : '#D1FAE5'
                    : isDark
                    ? 'rgba(217, 119, 6, 0.15)'
                    : '#FEF3C7',
                borderBottomColor: liveStatus === 'in_human_support' ? '#059669' : '#D97706',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              {liveStatus === 'in_human_support' ? (
                <View key="live-icon-active">
                  <ShieldCheck size={16} color="#059669" />
                </View>
              ) : (
                <View key="live-icon-waiting">
                  <Clock size={16} color="#D97706" />
                </View>
              )}
              <Text
                style={[
                  styles.liveBannerText,
                  { color: liveStatus === 'in_human_support' ? '#059669' : '#D97706' },
                ]}
              >
                {staffSupportMode
                  ? `Atendimento ativo com ${studentInfo?.name || 'Aluno'} (${studentInfo?.ra || ''}). Responda para orientar o estudante.`
                  : liveStatus === 'in_human_support'
                  ? `Atendimento humano oficial por ${assignedStaffName || 'Central CAA'}. Todo o histórico prévio foi mantido.`
                  : 'Sua solicitação está na fila da Central CAA. Um funcionário humano assumirá em instantes.'}
              </Text>
            </View>
          </View>
        )}

        {liveStatus === 'resolved' && (
          <View
            key="banner-live-resolved"
            style={[
              styles.liveBanner,
              {
                backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#D1FAE5',
                borderBottomColor: '#059669',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <View key="live-icon-resolved">
                <CheckCircle2 size={16} color="#059669" />
              </View>
              <Text style={[styles.liveBannerText, { color: '#059669', flex: 1 }]}>
                {staffSupportMode
                  ? `Atendimento finalizado com ${studentInfo?.name || 'Aluno'}. Todo o histórico está arquivado no CAA.`
                  : `Atendimento finalizado com sucesso por ${assignedStaffName || 'Central CAA'}. Todo o histórico está salvo no seu perfil.`}
              </Text>
            </View>
          </View>
        )}

        {/* Avaliação Interativa de Satisfação CSAT pós-resolução para o Aluno */}
        {!staffSupportMode && liveStatus === 'resolved' && currentSession?.id && (
          <View style={{ paddingHorizontal: 16, backgroundColor: colors.background }}>
            <SatisfactionRatingCard
              sessionId={currentSession.id}
              channel="Atendimento Humano CAA"
              staffName={assignedStaffName}
            />
          </View>
        )}

        {/* Marca d'água de fundo pulsante */}
        <View style={styles.backgroundOrbWrapper} pointerEvents="none">
          <Animated.View
            style={[
              styles.backgroundOrbAnimated,
              {
                transform: [{ scale: pulseAnim }],
                opacity: isDark ? 0.08 : 0.05,
              },
            ]}
          >
            <AiOrbSvg width={320} height={305} />
          </Animated.View>
        </View>

        {/* Mensagens do Chat com Diferenciação Visual Explícita */}
        <FlatList
          key={currentSession?.id || 'fresh-chat-session'}
          ref={flatListRef}
          data={messages}
          extraData={currentSession?.id}
          removeClippedSubviews={false}
          keyExtractor={(item, index) => `${currentSession?.id || 's'}-${item.id || index}`}
          contentContainerStyle={styles.messagesList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => safeScrollToEnd(false)}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyChatBox}>
              <Animated.View
                style={[
                  styles.emptyOrbWrapper,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <AiOrbSvg width={180} height={171} />
              </Animated.View>
              <Text style={[styles.emptyChatTitle, { color: colors.textPrimary }]}>
                {staffSupportMode
                  ? `Atendimento com ${studentInfo?.name || 'Aluno'}`
                  : currentRole === 'Funcionário'
                  ? 'Agente Analítico SISA'
                  : 'Como posso te ajudar hoje?'}
              </Text>
              <Text style={[styles.emptyChatSubtitle, { color: colors.textSecondary }]}>
                {staffSupportMode
                  ? 'Envie mensagens que serão transmitidas em tempo real para o estudante.'
                  : currentRole === 'Funcionário'
                  ? 'Consulte indicadores de permanência, histórico de matrículas e diagnósticos de estudantes.'
                  : 'Tire dúvidas sobre matérias, grade de horários, requerimentos e normas FECAP.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSystem = item.senderRole === 'Sistema';
            const isFeedback = item.senderRole === 'Feedback' || (item.text && item.text.includes('"type":"csat_feedback"'));

            if (isFeedback) {
              let fbData: any = null;
              try {
                fbData = JSON.parse(item.text);
              } catch {}
              const stars = fbData?.rating || 5;
              const ch = fbData?.channel || 'Atendimento';

              return (
                <View style={styles.systemMessageContainer}>
                  <View
                    style={[
                      styles.systemMessageCard,
                      {
                        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
                        borderColor: '#F59E0B',
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Star size={15} color="#D97706" fill="#F59E0B" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#FCD34D' : '#92400E' }}>
                        Avaliação Registrada: {stars}.0 / 5.0 ★
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10.5, color: colors.textSecondary }}>
                      Canal: {ch} • Computado nos indicadores de satisfação
                    </Text>
                    {fbData?.comment ? (
                      <Text style={{ fontSize: 11, fontStyle: 'italic', color: colors.textPrimary, marginTop: 4 }}>
                        "{fbData.comment}"
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            }

            if (isSystem) {
              return (
                <View style={styles.systemMessageContainer}>
                  <View
                    style={[
                      styles.systemMessageCard,
                      {
                        backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7',
                        borderColor: '#D97706',
                      },
                    ]}
                  >
                    <View style={{ marginTop: 1 }}>
                      <ShieldCheck size={14} color="#D97706" />
                    </View>
                    <Text style={[styles.systemMessageText, { color: isDark ? '#FCD34D' : '#92400E' }]}>
                      {item.text.replace(/\\n/g, '\n')}
                    </Text>
                  </View>
                </View>
              );
            }

            const isStaffMsg = Boolean(
              item.senderRole === 'Funcionário' || (item.sender === 'assistant' && item.isHuman)
            );
            const isStudentMsg = Boolean(
              item.senderRole === 'Aluno' || item.sender === 'user'
            );
            const isAiMsg = Boolean(
              !item.isHuman && item.sender === 'assistant' && !isSystem && item.senderRole !== 'Funcionário'
            );

            // Inversão estilo WhatsApp:
            // - Para o Funcionário em atendimento ao vivo: a mensagem DELE fica à DIREITA (isMe = true), e a do ALUNO à ESQUERDA (isMe = false).
            // - Para o Aluno: a mensagem DELE fica à DIREITA (isMe = true), e a do FUNCIONÁRIO à ESQUERDA (isMe = false).
            // - No chat normal com IA SISA: mensagem do usuário à DIREITA (isMe = true), respostas da IA à ESQUERDA (isMe = false).
            const isMe = isStaffLiveSupport ? isStaffMsg : item.sender === 'user';

            return (
              <View
                style={[
                  styles.messageRow,
                  isMe ? styles.userMessageRow : styles.assistantMessageRow,
                ]}
              >
                {!isMe && (
                  <View
                    style={[
                      styles.avatarAssistant,
                      {
                        backgroundColor: isStaffMsg
                          ? '#2563EB'
                          : isStudentMsg
                          ? '#059669'
                          : colors.primary,
                      },
                    ]}
                  >
                    {isStaffMsg ? (
                      <UserCheck size={16} color="#FFFFFF" />
                    ) : isStudentMsg ? (
                      <User size={16} color="#FFFFFF" />
                    ) : (
                      <Bot size={16} color="#FFFFFF" />
                    )}
                  </View>
                )}

                <View style={styles.messageBubbleWrapper}>
                  {/* Badge de Atendente Humano CAA (quando visualizado pelo Aluno) */}
                  {!isMe && isStaffMsg && (
                    <View
                      style={[
                        styles.humanBadgeHeader,
                        {
                          backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#EFF6FF',
                          borderColor: '#2563EB',
                        },
                      ]}
                    >
                      <UserCheck size={12} color="#2563EB" />
                      <Text style={[styles.humanBadgeHeaderText, { color: '#2563EB' }]}>
                        Atendente Humano CAA • {item.senderName || 'Colaborador FECAP'}
                      </Text>
                    </View>
                  )}

                  {/* Badge do Aluno (quando visualizado pelo Funcionário) */}
                  {!isMe && isStudentMsg && (
                    <View
                      style={[
                        styles.studentBadgeHeader,
                        {
                          backgroundColor: isDark ? 'rgba(5,150,105,0.2)' : '#ECFDF5',
                          borderColor: '#059669',
                        },
                      ]}
                    >
                      <User size={12} color="#059669" />
                      <Text style={[styles.studentBadgeHeaderText, { color: '#059669' }]}>
                        Aluno • {item.senderName && item.senderName !== 'Aluno' ? item.senderName : studentInfo?.name || 'Estudante'}
                        {studentInfo?.ra ? ` (${studentInfo.ra})` : ''}
                      </Text>
                    </View>
                  )}

                  {/* Badge da IA SISA */}
                  {!isMe && isAiMsg && item.senderName && (
                    <View style={[styles.aiBadgeHeader, { backgroundColor: colors.primaryLight }]}>
                      <Sparkles size={11} color={colors.primaryDark} />
                      <Text style={[styles.aiBadgeHeaderText, { color: colors.primaryDark }]}>
                        {item.senderName}
                      </Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.bubble,
                      isMe
                        ? [styles.userBubble, { backgroundColor: colors.userBubble }]
                        : isStaffMsg
                        ? [
                            styles.humanBubble,
                            {
                              backgroundColor: isDark ? '#1E293B' : '#F0F7FF',
                              borderColor: '#2563EB',
                            },
                          ]
                        : isStudentMsg
                        ? [
                            styles.studentBubble,
                            {
                              backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                              borderColor: isDark ? '#334155' : '#E2E8F0',
                            },
                          ]
                        : [
                            styles.assistantBubble,
                            { backgroundColor: colors.card, borderColor: colors.border },
                          ],
                    ]}
                  >
                    <MarkdownMessage content={item.text} isUser={isMe} />
                    <Text
                      style={[
                        styles.messageTimestamp,
                        { color: isMe ? 'rgba(255,255,255,0.75)' : colors.textMuted },
                      ]}
                    >
                      {item.timestamp}
                    </Text>
                  </View>

                  {/* Ação sugerida pela IA */}
                  {isAiMsg && item.suggestedAction && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleActionPress(item.suggestedAction)}
                      style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.primary }]}
                    >
                      <View style={styles.actionCardContent}>
                        <Text style={[styles.actionCardTitle, { color: colors.primaryDark }]}>
                          {item.suggestedAction.label}
                        </Text>
                        <Text style={[styles.actionCardDesc, { color: colors.textSecondary }]}>
                          Toque para acessar no aplicativo
                        </Text>
                      </View>
                      <ArrowUpRight size={18} color={colors.primary} />
                    </TouchableOpacity>
                  )}

                  {/* Respostas Rápidas */}
                  {isAiMsg && item.quickReplies && item.quickReplies.length > 0 && (
                    <View style={styles.quickRepliesContainer}>
                      {item.quickReplies.map((qr: string, idx: number) => (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.75}
                          onPress={() => handleQuickReply(qr)}
                          style={[styles.quickReplyChip, { backgroundColor: colors.secondaryLight, borderColor: colors.secondaryMuted }]}
                        >
                          <Text style={[styles.quickReplyText, { color: colors.secondary }]}>{qr}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            isTyping ? (
              <View style={styles.typingRow}>
                <View style={[styles.avatarAssistant, { backgroundColor: colors.primary }]}>
                  <Bot size={16} color="#FFFFFF" />
                </View>
                <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.typingText, { color: colors.textSecondary }]}>
                    {currentRole === 'Funcionário' ? 'Analisando scores e métricas...' : 'Consultando base de conhecimento oficial...'}
                  </Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* Input Bar com Margem Segura para Barra Inferior */}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <TextInput
            placeholder={
              staffSupportMode
                ? liveStatus === 'resolved'
                  ? 'Atendimento arquivado no histórico do CAA'
                  : `Responder como ${user?.name || 'Atendente CAA'}...`
                : liveStatus === 'resolved'
                ? 'Atendimento concluído. Digite para falar com a SISA...'
                : isLiveSupportActive
                ? 'Digite sua mensagem para o atendente CAA...'
                : currentRole === 'Funcionário'
                ? 'Ex: Qual a situação do RA 24018932?'
                : 'Digite sua dúvida acadêmica...'
            }
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            style={[
              styles.inputField,
              {
                backgroundColor: colors.card,
                borderColor: isLiveSupportActive ? '#2563EB' : colors.border,
                color: colors.textPrimary,
              },
            ]}
            multiline
            maxLength={600}
            returnKeyType="send"
            onSubmitEditing={() => handleSendMessage()}
          />
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim()}
            style={[
              styles.sendButton,
              {
                backgroundColor: isLiveSupportActive ? '#2563EB' : colors.primary,
              },
              !inputText.trim() && { backgroundColor: colors.border },
            ]}
          >
            <Send size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Modal de Histórico de Conversas */}
        <Modal
          visible={historyModalVisible}
          animationType="slide"
          transparent={true}
          statusBarTranslucent={false}
          onRequestClose={() => setHistoryModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <History size={20} color={colors.primary} />
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Histórico de Diálogos</Text>
                </View>
                <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                  <X size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleCreateNewChat}
                style={[styles.newChatModalBtn, { backgroundColor: colors.primary }]}
              >
                <Plus size={18} color="#FFFFFF" />
                <Text style={styles.newChatModalBtnText}>Iniciar Nova Conversa</Text>
              </TouchableOpacity>

              <FlatList
                data={allSessions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingVertical: 8 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = item.id === currentSession?.id;
                  const dateFormatted = new Date(item.updatedAt).toLocaleDateString([], {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <View
                      style={[
                        styles.historyItemCard,
                        { backgroundColor: colors.background, borderColor: colors.border },
                        isSelected && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleSelectSession(item)}
                        style={{ flex: 1 }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <MessageSquare size={14} color={isSelected ? colors.primary : colors.textSecondary} />
                          <Text
                            style={[
                              styles.historyItemTitle,
                              { color: colors.textPrimary },
                              isSelected && { color: colors.primaryDark, fontWeight: '700' },
                            ]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                        </View>
                        <Text style={[styles.historyItemPreview, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.lastMessagePreview || 'Conversa sem mensagens'}
                        </Text>
                        <Text style={[styles.historyItemDate, { color: colors.textMuted }]}>{dateFormatted}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleDeleteSession(item.id)}
                        style={styles.deleteSessionBtn}
                      >
                        <Trash2 size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            </View>
          </View>
        </Modal>

        {/* Modal de Requerimento Manual */}
        <ManualRequirementModal
          visible={manualReqModalVisible}
          onClose={() => setManualReqModalVisible(false)}
          onSuccess={(protocol) => {
            showToast(`Requerimento ${protocol} criado com sucesso!`, 'success');
          }}
        />

        {/* Modal de Avaliação de Atendimento (CSAT / NPS) */}
        <SatisfactionFeedbackModal
          visible={feedbackModalVisible}
          onClose={() => setFeedbackModalVisible(false)}
          sessionId={currentSession?.id || 'sisa-direct-chat'}
          channel={liveStatus === 'in_human_support' || liveStatus === 'resolved' ? 'Atendimento Humano CAA' : 'Chat IA (SISA)'}
          staffName={assignedStaffName}
          onSubmitted={() => {
            setFeedbackModalVisible(false);
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 10,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  liveBannerText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  backgroundOrbWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  backgroundOrbAnimated: {
    width: 320,
    height: 305,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '92%',
  },
  userMessageRow: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  assistantMessageRow: {
    alignSelf: 'flex-start',
  },
  avatarAssistant: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  messageBubbleWrapper: {
    flex: 1,
  },
  humanBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  humanBadgeHeaderText: {
    fontSize: 11,
    fontWeight: '700',
  },
  studentBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  studentBadgeHeaderText: {
    fontSize: 11,
    fontWeight: '700',
  },
  aiBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  aiBadgeHeaderText: {
    fontSize: 10,
    fontWeight: '600',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 16,
  },
  systemMessageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '96%',
  },
  systemMessageText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    flex: 1,
  },
  bubble: {
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    borderBottomRightRadius: 2,
  },
  assistantBubble: {
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  humanBubble: {
    borderBottomLeftRadius: 2,
    borderWidth: 1.5,
  },
  studentBubble: {
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  messageTimestamp: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1.5,
  },
  actionCardContent: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionCardDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  quickRepliesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickReplyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  quickReplyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
  },
  typingText: {
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  inputField: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  newChatModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  newChatModalBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  historyItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  historyItemTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyItemPreview: {
    fontSize: 11,
    marginTop: 2,
  },
  historyItemDate: {
    fontSize: 9,
    marginTop: 4,
  },
  deleteSessionBtn: {
    padding: 8,
  },
  emptyChatBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyOrbWrapper: {
    marginBottom: 16,
  },
  emptyChatTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyChatSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
