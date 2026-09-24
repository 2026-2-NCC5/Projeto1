import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../utils/constants';
import { authService } from '../services/supabase/authService';

export const ROLE_PROFILES: Record<UserRole, UserProfile> = {
  Aluno: {
    id: 'usr-aluno-1',
    name: 'Lucas Alvarista',
    ra: '24026851',
    email: 'lucas.alvarista@fecap.br',
    role: 'Aluno',
    course: 'Ciência da Computação',
    semester: '5º Semestre',
  },
  Pais: {
    id: 'usr-pais-1',
    name: 'Roberto Alvarista',
    ra: '24026851',
    email: 'roberto.alvarista@gmail.com',
    role: 'Pais',
    course: 'Responsável Financeiro & Acadêmico',
    semester: 'Dependente: Lucas Alvarista (CCOMP - 5º Sem.)',
  },
  Professor: {
    id: 'usr-prof-1',
    name: 'Prof. Dr. Carlos Alvarista',
    ra: 'PROF-1082',
    email: 'carlos.alvarista@fecap.br',
    role: 'Professor',
    course: 'Ciência da Computação & Sistemas',
    semester: 'Docente Titular',
  },
  'Funcionário': {
    id: 'usr-func-1',
    name: 'Fernanda Santos',
    ra: 'FUNC-4421',
    email: 'fernanda.santos@fecap.br',
    role: 'Funcionário',
    course: 'Ações de Permanência & Atendimento CAA',
    semester: 'Analista de Atendimento e Permanência',
  },
};

interface AuthContextData {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  selectedRole: UserRole;
  setSelectedRole: (role: UserRole) => void;
  signIn: (identifier: string, pass: string, role?: UserRole, remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  signUp: (data: { name: string; ra: string; email: string; password: string; role: UserRole; course?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
  resetPassword: (emailOrRa: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('Aluno');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const { user: storedUser } = await authService.getStoredSession();
        if (storedUser) {
          setUser(storedUser);
          setSelectedRole(storedUser.role);
        }
      } catch (err) {
        console.warn('Erro ao carregar sessão persistida:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredAuth();
  }, []);

  const signIn = async (identifier: string, pass: string, role?: UserRole, remember: boolean = true) => {
    setIsLoading(true);
    try {
      const activeRole = role || selectedRole || 'Aluno';
      const roleDefaults = ROLE_PROFILES[activeRole];

      const result = await authService.signInWithRA(identifier, pass, remember);
      if (result.user) {
        // Enriquecer usuário com as especificidades do perfil ativo
        const customizedUser: UserProfile = {
          ...roleDefaults,
          ...result.user,
          role: activeRole,
          ra: identifier || roleDefaults.ra,
        };

        setUser(customizedUser);
        setSelectedRole(activeRole);
        return { success: true };
      }
      return { success: false, error: result.error || 'Credenciais inválidas' };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (data: { name: string; ra: string; email: string; password: string; role: UserRole; course?: string }) => {
    setIsLoading(true);
    try {
      const result = await authService.signUp(data);
      if (result.user) {
        setUser(result.user);
        setSelectedRole(result.user.role);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateRole = async (role: UserRole) => {
    setSelectedRole(role);
    if (user) {
      const updated = await authService.updateRole(role);
      setUser(updated);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await authService.signOut();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (emailOrRa: string) => {
    return authService.resetPassword(emailOrRa);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        selectedRole,
        setSelectedRole,
        signIn,
        signUp,
        signOut,
        updateRole,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
