import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Requirement, NoticeItem } from '../utils/constants';
import { requirementsService, EnrichedRequirement } from '../services/supabase/requirementsService';
import { noticesService, FullNoticeItem } from '../services/supabase/noticesService';
import { pushNotificationService } from '../services/notifications/pushNotificationService';

interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextData {
  requirements: EnrichedRequirement[];
  notices: NoticeItem[];
  isLoadingData: boolean;
  activeToast: ToastData | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  refreshData: () => Promise<void>;
  addRequirement: (
    data: Omit<Requirement, 'id' | 'createdAt' | 'updatedAt' | 'protocol'> & {
      studentRa?: string;
      studentName?: string;
      studentCourse?: string;
    }
  ) => Promise<EnrichedRequirement>;
  updateRequirementStatusAndComment: (params: {
    requirementId: string;
    protocol: string;
    newStatus: 'pending' | 'in_progress' | 'approved' | 'rejected';
    newStage: string;
    commentText?: string;
    authorName?: string;
    authorRole?: 'Funcionário' | 'Aluno';
  }) => Promise<EnrichedRequirement | null>;
  cancelRequirement: (params: {
    requirementId: string;
    protocol?: string;
    reason: string;
    authorName?: string;
  }) => Promise<boolean>;
  deleteRequirement: (id: string, protocol?: string) => Promise<boolean>;
  addRequirementAttachment: (params: {
    requirementId: string;
    protocol?: string;
    attachment: any;
    role: 'student' | 'staff';
  }) => Promise<EnrichedRequirement | null>;
  removeRequirementAttachment: (params: {
    requirementId: string;
    protocol?: string;
    attachmentId: string;
    role?: 'student' | 'staff';
  }) => Promise<EnrichedRequirement | null>;
}

const AppContext = createContext<AppContextData>({} as AppContextData);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requirements, setRequirements] = useState<EnrichedRequirement[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeToast, setActiveToast] = useState<ToastData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadInitialData = async () => {
    setIsLoadingData(true);
    try {
      const [reqs, nots] = await Promise.all([
        requirementsService.getRequirements(),
        noticesService.getNotices(),
      ]);
      setRequirements(reqs);
      setNotices(nots);
    } catch (e) {
      console.warn('Erro ao carregar dados do app:', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Sincroniza dados automaticamente sempre que o aplicativo é reaberto ou volta do segundo plano
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        loadInitialData();
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    // 1. Inscrição em tempo real para sincronização instantânea de requerimentos
    const unsubscribeReqs = requirementsService.subscribeToRequirements(async () => {
      try {
        const fresh = await requirementsService.getRequirements();
        setRequirements(fresh);
      } catch (err) {
        console.warn('Erro ao atualizar requerimentos via Realtime:', err);
      }
    });

    // 2. Inscrição em tempo real para o mural de avisos e comunicados
    const unsubscribeNotices = noticesService.subscribeToNotices((freshNotices) => {
      setNotices(freshNotices);
    });

    return () => {
      appStateSub.remove();
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (typeof unsubscribeReqs === 'function') unsubscribeReqs();
      if (typeof unsubscribeNotices === 'function') unsubscribeNotices();
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setActiveToast({ id: `toast-${Date.now()}`, message, type });
    toastTimerRef.current = setTimeout(() => {
      setActiveToast(null);
      toastTimerRef.current = null;
    }, 3500);
  };

  const hideToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setActiveToast(null);
  };

  const refreshData = async () => {
    await loadInitialData();
  };

  const addRequirement = async (
    data: Omit<Requirement, 'id' | 'createdAt' | 'updatedAt' | 'protocol'> & {
      studentRa?: string;
      studentName?: string;
      studentCourse?: string;
    }
  ) => {
    const created = await requirementsService.createRequirement(data);
    setRequirements((prev) => [created, ...prev.filter((r) => r.protocol !== created.protocol)]);
    showToast(`Requerimento ${created.protocol} protocolado com sucesso!`, 'success');

    // Push coberto pelo Database Webhook → push-notification-dispatcher

    return created;
  };

  const updateRequirementStatusAndComment = async (params: {
    requirementId: string;
    protocol: string;
    newStatus: 'pending' | 'in_progress' | 'approved' | 'rejected';
    newStage: string;
    commentText?: string;
    authorName?: string;
    authorRole?: 'Funcionário' | 'Aluno';
  }) => {
    const updated = await requirementsService.updateRequirementStatusAndComment(params);
    if (updated) {
      setRequirements((prev) =>
        prev.map((r) =>
          r.id === params.requirementId || r.protocol === params.protocol ? updated : r
        )
      );
      showToast(`Status do requerimento ${params.protocol} atualizado!`, 'success');

      const statusLabel =
        params.newStatus === 'approved'
          ? 'Deferido'
          : params.newStatus === 'rejected'
          ? 'Indeferido'
          : params.newStatus === 'pending'
          ? 'Triagem'
          : 'Em Andamento';

      // Push coberto pelo Database Webhook → push-notification-dispatcher
    }
    return updated;
  };

  const cancelRequirement = async (params: {
    requirementId: string;
    protocol?: string;
    reason: string;
    authorName?: string;
  }) => {
    const updated = await requirementsService.cancelRequirement(params);
    if (updated) {
      setRequirements((prev) =>
        prev.map((r) =>
          r.id === params.requirementId || r.protocol === params.protocol ? updated : r
        )
      );
      showToast('Requerimento cancelado com sucesso.', 'info');
      return true;
    }
    showToast('Não foi possível cancelar o requerimento.', 'error');
    return false;
  };

  const deleteRequirement = async (id: string, protocol?: string) => {
    const ok = await requirementsService.deleteRequirement(id, protocol);
    if (ok) {
      setRequirements((prev) => prev.filter((r) => r.id !== id && r.protocol !== protocol && r.protocol !== id));
      showToast('Requerimento excluído com sucesso.', 'success');
      return true;
    }
    showToast('Erro ao excluir requerimento.', 'error');
    return false;
  };

  const addRequirementAttachment = async (params: {
    requirementId: string;
    protocol?: string;
    attachment: any;
    role: 'student' | 'staff';
  }) => {
    const updated = await requirementsService.addAttachmentToRequirement(params);
    if (updated) {
      setRequirements((prev) =>
        prev.map((r) =>
          r.id === params.requirementId || r.protocol === params.protocol ? updated : r
        )
      );
      showToast('Anexo adicionado ao processo!', 'success');

      // Push coberto pelo Database Webhook → push-notification-dispatcher
      return updated;
    }
    showToast('Falha ao adicionar anexo ao requerimento.', 'error');
    return null;
  };

  const removeRequirementAttachment = async (params: {
    requirementId: string;
    protocol?: string;
    attachmentId: string;
    role?: 'student' | 'staff';
  }) => {
    const updated = await requirementsService.removeAttachmentFromRequirement(params);
    if (updated) {
      setRequirements((prev) =>
        prev.map((r) =>
          r.id === params.requirementId || r.protocol === params.protocol ? updated : r
        )
      );
      showToast('Anexo removido do requerimento.', 'success');
      return updated;
    }
    showToast('Falha ao remover anexo do requerimento.', 'error');
    return null;
  };

  return (
    <AppContext.Provider
      value={{
        requirements,
        notices,
        isLoadingData,
        activeToast,
        searchQuery,
        setSearchQuery,
        showToast,
        hideToast,
        refreshData,
        addRequirement,
        updateRequirementStatusAndComment,
        cancelRequirement,
        deleteRequirement,
        addRequirementAttachment,
        removeRequirementAttachment,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
