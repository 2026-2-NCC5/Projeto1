import React, { createContext, useContext, useState, useEffect } from 'react';
import { Requirement, NoticeItem } from '../utils/constants';
import { requirementsService } from '../services/supabase/requirementsService';
import { noticesService } from '../services/supabase/noticesService';

interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextData {
  requirements: Requirement[];
  notices: NoticeItem[];
  isLoadingData: boolean;
  activeToast: ToastData | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  refreshData: () => Promise<void>;
  addRequirement: (data: Omit<Requirement, 'id' | 'createdAt' | 'updatedAt' | 'protocol'>) => Promise<Requirement>;
}

const AppContext = createContext<AppContextData>({} as AppContextData);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeToast, setActiveToast] = useState<ToastData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setActiveToast({ id: `toast-${Date.now()}`, message, type });
    setTimeout(() => {
      setActiveToast(null);
    }, 3500);
  };

  const hideToast = () => setActiveToast(null);

  const refreshData = async () => {
    await loadInitialData();
  };

  const addRequirement = async (data: Omit<Requirement, 'id' | 'createdAt' | 'updatedAt' | 'protocol'>) => {
    const created = await requirementsService.createRequirement(data);
    setRequirements((prev) => [created, ...prev]);
    showToast('Requerimento protocolado com sucesso!', 'success');
    return created;
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
