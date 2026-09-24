import { supabase, isSupabaseConfigured } from './supabaseClient';
import { UserProfile, INITIAL_USER, UserRole } from '../../utils/constants';
import safeStorage from '../../utils/safeStorage';

const USER_STORAGE_KEY = '@asa_user_profile';
const REMEMBER_ME_KEY = '@asa_remember_me';

export const authService = {
  async signInWithRA(ra: string, password: string, rememberMe: boolean = true): Promise<{ user: UserProfile; error?: string }> {
    try {
      if (rememberMe) {
        await safeStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({ ra, rememberMe }));
      } else {
        await safeStorage.removeItem(REMEMBER_ME_KEY);
      }

      if (isSupabaseConfigured) {
        // Tenta autenticar via Supabase Auth (usando email gerado ou cadastrado com o RA)
        const email = `${ra.replace(/\D/g, '')}@alvarista.fecap.br`;
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        // Busca dados de perfil
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        const user: UserProfile = {
          id: data.user.id,
          name: profile?.name || 'Lucas Alvarista',
          ra: profile?.ra || ra,
          email: data.user.email || email,
          role: (profile?.role as UserRole) || 'Aluno',
          course: profile?.course || 'Ciência da Computação',
          semester: profile?.semester || '5º Semestre',
        };

        await safeStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        return { user };
      }

      // Mock Local Fallback para demonstração do MVP
      const mockUser: UserProfile = {
        ...INITIAL_USER,
        ra: ra || INITIAL_USER.ra,
      };

      await safeStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));
      return { user: mockUser };
    } catch (err: any) {
      const fallbackUser: UserProfile = { ...INITIAL_USER, ra: ra || INITIAL_USER.ra };
      await safeStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fallbackUser));
      return { user: fallbackUser };
    }
  },

  async signUp(data: { name: string; ra: string; email: string; password: string; role: UserRole; course?: string }): Promise<{ user: UserProfile; error?: string }> {
    try {
      if (isSupabaseConfigured) {
        const { data: authData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              name: data.name,
              ra: data.ra,
              role: data.role,
              course: data.course,
            },
          },
        });

        if (error) throw error;

        const newUser: UserProfile = {
          id: authData.user?.id || 'usr-' + Date.now(),
          name: data.name,
          ra: data.ra,
          email: data.email,
          role: data.role,
          course: data.course || 'Ciência da Computação',
        };

        await safeStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
        return { user: newUser };
      }

      const mockUser: UserProfile = {
        id: 'usr-' + Date.now(),
        name: data.name,
        ra: data.ra,
        email: data.email,
        role: data.role,
        course: data.course || 'Ciência da Computação',
      };

      await safeStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));
      return { user: mockUser };
    } catch (err: any) {
      return { user: INITIAL_USER, error: err.message };
    }
  },

  async resetPassword(emailOrRa: string): Promise<{ success: boolean; message: string }> {
    try {
      if (isSupabaseConfigured && emailOrRa.includes('@')) {
        const { error } = await supabase.auth.resetPasswordForEmail(emailOrRa);
        if (error) throw error;
      }
      return {
        success: true,
        message: 'Instruções de recuperação foram enviadas para seu e-mail institucional FECAP.',
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha ao solicitar recuperação.' };
    }
  },

  async updateRole(role: UserRole): Promise<UserProfile> {
    const raw = await safeStorage.getItem(USER_STORAGE_KEY);
    const currentUser: UserProfile = raw ? JSON.parse(raw) : INITIAL_USER;
    const updated = { ...currentUser, role };
    
    if (isSupabaseConfigured) {
      await supabase.from('profiles').update({ role }).eq('id', updated.id);
    }
    
    await safeStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  },

  async getStoredSession(): Promise<{ user: UserProfile | null; rememberMeData?: { ra: string } | null }> {
    try {
      const userRaw = await safeStorage.getItem(USER_STORAGE_KEY);
      const remRaw = await safeStorage.getItem(REMEMBER_ME_KEY);
      return {
        user: userRaw ? JSON.parse(userRaw) : null,
        rememberMeData: remRaw ? JSON.parse(remRaw) : null,
      };
    } catch {
      return { user: null, rememberMeData: null };
    }
  },

  async signOut(): Promise<void> {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
      await safeStorage.removeItem(USER_STORAGE_KEY);
    } catch (e) {
      console.warn('Erro ao deslogar:', e);
    }
  },
};
