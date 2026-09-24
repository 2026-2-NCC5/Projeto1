import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Requirement, INITIAL_REQUIREMENTS } from '../../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REQUIREMENTS_STORAGE_KEY = '@asa_requirements';

export const requirementsService = {
  async getRequirements(userId?: string): Promise<Requirement[]> {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('requirements')
          .select('*')
          .order('updated_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((item: any) => ({
            id: item.id,
            protocol: item.protocol,
            title: item.title,
            type: item.type,
            currentStage: item.current_stage,
            status: item.status,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
            description: item.description,
            steps: item.steps || [],
          }));
        }
      }

      // Local storage fallback
      const stored = await AsyncStorage.getItem(REQUIREMENTS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }

      await AsyncStorage.setItem(REQUIREMENTS_STORAGE_KEY, JSON.stringify(INITIAL_REQUIREMENTS));
      return INITIAL_REQUIREMENTS;
    } catch (e) {
      console.warn('Erro ao carregar requerimentos:', e);
      return INITIAL_REQUIREMENTS;
    }
  },

  async getRequirementById(id: string): Promise<Requirement | null> {
    const list = await this.getRequirements();
    return list.find((req) => req.id === id) || null;
  },

  async createRequirement(newReq: Omit<Requirement, 'id' | 'createdAt' | 'updatedAt' | 'protocol'>): Promise<Requirement> {
    const protocolNumber = `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const fullReq: Requirement = {
      ...newReq,
      id: `req-${Date.now()}`,
      protocol: protocolNumber,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    if (isSupabaseConfigured) {
      await supabase.from('requirements').insert({
        protocol: fullReq.protocol,
        title: fullReq.title,
        type: fullReq.type,
        current_stage: fullReq.currentStage,
        status: fullReq.status,
        description: fullReq.description,
        steps: fullReq.steps,
      });
    }

    const currentList = await this.getRequirements();
    const updatedList = [fullReq, ...currentList];
    await AsyncStorage.setItem(REQUIREMENTS_STORAGE_KEY, JSON.stringify(updatedList));

    return fullReq;
  },
};
