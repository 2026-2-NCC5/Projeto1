import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../utils/constants';
import { authService } from '../services/supabase/authService';
import { pushNotificationService } from '../services/notifications/pushNotificationService';

interface AuthContextData {
  user: UserProfile | null;
  isLoading: boolean;
  isRestoringSession: boolean;
  isAuthenticated: boolean;
  selectedRole: UserRole;
  setSelectedRole: (role: UserRole) => void;
  signIn: (identifier: string, pass: string, role?: UserRole, remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  signInWithSocial: (provider: 'google' | 'apple') => Promise<{
    success: boolean;
    needsRaLink?: boolean;
    socialData?: { provider: 'google' | 'apple'; socialId: string; email: string; name: string };
    error?: string;
  }>;
  signUp: (data: { name: string; ra: string; email: string; password: string; role: UserRole; course?: string }) => Promise<{ success: boolean; needsEmailConfirmation?: boolean; error?: string }>;
  verifyEmailOtp: (email: string, token: string, passwordToSet?: string) => Promise<{ success: boolean; error?: string }>;
  resendConfirmationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  resetPassword: (emailOrRa: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('Aluno');
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    pushNotificationService.initialize().catch(() => {});

    async function loadStoredAuth() {
      try {
        const { user: storedUser } = await authService.getStoredSession();
        if (storedUser) {
          const validRole: UserRole = storedUser.role === 'Funcionário' ? 'Funcionário' : 'Aluno';
          setUser({ ...storedUser, role: validRole });
          setSelectedRole(validRole);
        }
      } catch (err) {
        console.warn('Erro ao carregar sessão persistida:', err);
      } finally {
        setIsRestoringSession(false);
      }
    }
    loadStoredAuth();
  }, []);

  // Registra e sincroniza automaticamente o token de Push Notification no perfil do usuário logado
  useEffect(() => {
    if (user?.id || user?.ra) {
      pushNotificationService
        .registerAndSyncUserPushToken({
          id: user.id,
          ra: user.ra,
          email: user.email,
        })
        .catch(() => {});
    }
  }, [user?.id, user?.ra]);

  const signIn = async (identifier: string, pass: string, role?: UserRole, remember: boolean = true) => {
    setIsLoading(true);
    try {
      const activeRole: UserRole = (role === 'Funcionário' || selectedRole === 'Funcionário') ? 'Funcionário' : 'Aluno';
      const result = await authService.signInWithRA(identifier, pass, remember);

      if (result.user) {
        const finalRole: UserRole = result.user.role || activeRole;
        const finalUser: UserProfile = {
          ...result.user,
          role: finalRole,
          ra: result.user.ra || identifier,
        };

        setUser(finalUser);
        setSelectedRole(finalRole);
        return { success: true };
      }
      return { success: false, error: result.error || 'Credenciais inválidas' };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithSocial = async (provider: 'google' | 'apple') => {
    setIsLoading(true);
    try {
      const res = await authService.signInWithSocial(provider);
      if (res.user) {
        setUser(res.user);
        setSelectedRole(res.user.role);
        return { success: true };
      }
      
      return { success: false, error: res.error || 'Falha na autenticação social.' };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      setIsLoading(false);
    }
  };


  const signUp = async (data: { name: string; ra: string; email: string; password: string; role: UserRole; course?: string }) => {
    setIsLoading(true);
    try {
      const roleToUse: UserRole = data.role === 'Funcionário' ? 'Funcionário' : 'Aluno';
      const result = await authService.signUp({ ...data, role: roleToUse });
      if (result.error) {
        return { success: false, error: result.error };
      }
      if (result.user && !result.needsEmailConfirmation) {
        setUser(result.user);
        setSelectedRole(result.user.role);
        return { success: true, needsEmailConfirmation: false };
      }
      // Não autentica o usuário até a confirmação do e-mail
      setUser(null);
      return { success: true, needsEmailConfirmation: true };
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    const updated = await authService.updateUserProfile(updates);
    setUser(updated);
    return updated;
  };

  const updateRole = async (role: UserRole) => {
    const validRole: UserRole = role === 'Funcionário' ? 'Funcionário' : 'Aluno';
    setSelectedRole(validRole);
    if (user) {
      const updated = await authService.updateRole(validRole);
      setUser(updated);
    }
  };

  const updateAvatar = async (avatarUrl: string) => {
    const updated = await authService.updateAvatar(avatarUrl);
    setUser((prev) => (prev ? { ...prev, avatarUrl } : updated));
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await pushNotificationService.clearUserPushTokenOnSignOut(user).catch(() => {});
      await authService.signOut();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (emailOrRa: string) => {
    return authService.resetPassword(emailOrRa);
  };

  const verifyEmailOtp = async (email: string, token: string, passwordToSet?: string) => {
    setIsLoading(true);
    try {
      const res = await authService.verifyOtp(email, token, passwordToSet);
      if (res.user) {
        setUser(res.user);
        setSelectedRole(res.user.role || 'Aluno');
        return { success: true };
      }
      return { success: false, error: res.error || 'Código inválido ou expirado.' };
    } finally {
      setIsLoading(false);
    }
  };

  const resendConfirmationEmail = async (email: string) => {
    return authService.resendConfirmationEmail(email);
  };

  const refreshUser = async () => {
    try {
      const { user: refreshed } = await authService.getStoredSession();
      if (refreshed) {
        setUser(refreshed);
      }
    } catch (e) {
      console.warn('Erro ao atualizar usuário:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isRestoringSession,
        isAuthenticated: !!user,
        selectedRole,
        setSelectedRole,
        signIn,
        signInWithSocial,
        signUp,
        verifyEmailOtp,
        resendConfirmationEmail,
        refreshUser,
        signOut,
        updateRole,
        updateAvatar,
        updateProfile,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
