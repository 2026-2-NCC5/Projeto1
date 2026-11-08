import { supabase, isSupabaseConfigured } from './supabaseClient';
import { UserProfile, UserRole } from '../../utils/constants';
import safeStorage from '../../utils/safeStorage';
import { studentRiskService } from '../ai-agent/studentRiskService';

const USER_STORAGE_KEY = '@asa_user_profile';
const REMEMBER_ME_KEY = '@asa_remember_me';

export const authService = {
  /**
   * Autentica o usuário via RA/Chapa ou E-mail com validação estrita no Supabase Auth
   */
  async signInWithRA(
    identifier: string,
    password: string,
    rememberMe: boolean = true
  ): Promise<{ user?: UserProfile; error?: string }> {
    try {
      const cleanId = (identifier || '').trim();
      const cleanPass = (password || '').trim();

      if (!cleanId || !cleanPass) {
        return { error: 'Por favor, informe seu identificador e sua senha.' };
      }

      if (rememberMe) {
        await safeStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({ ra: cleanId, rememberMe }));
      } else {
        await safeStorage.removeItem(REMEMBER_ME_KEY);
      }

      if (!isSupabaseConfigured) {
        return { error: 'Serviço de autenticação não configurado no aplicativo.' };
      }

      // 1. Resolve o e-mail: RA numérico → <ra>@alvarista.fecap.br; entrada com '@' → usa como está.
      // Nenhuma chamada de RPC é feita aqui (email_by_ra não existe e não será criada).
      let emailToAuth: string;

      if (cleanId.includes('@')) {
        emailToAuth = cleanId.toLowerCase();
      } else if (/^[0-9]+$/.test(cleanId)) {
        emailToAuth = `${cleanId}@alvarista.fecap.br`;
      } else {
        return { error: 'Identificador inválido. Use seu RA numérico ou e-mail institucional.' };
      }

      // 2. Autenticação oficial no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToAuth,
        password: cleanPass,
      });

      if (authError) {
        const msg = authError.message.toLowerCase();
        if (msg.includes('email not confirmed')) {
          return {
            error:
              'E-mail institucional ainda não confirmado. Verifique o código de validação enviado à sua caixa de entrada.',
          };
        }
        if (msg.includes('invalid login credentials')) {
          return {
            error:
              'Identificador (RA/E-mail) ou senha incorretos. Verifique suas credenciais.',
          };
        }
        return { error: authError.message };
      }

      if (!authData?.user) {
        return { error: 'Falha ao obter dados da sessão após login.' };
      }

      // 3. Busca o perfil completo sincronizado no Supabase (Client Autenticado)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      // 4. Busca dados acadêmicos na tabela oficial de estudantes e contatos
      const userRa = profile?.ra || authData.user.user_metadata?.ra || cleanId;
      let studentDetails: any = null;
      let contactDetails: any = null;

      if (userRa) {
        const { data: stData } = await supabase
          .from('students')
          .select('*, student_contacts(*)')
          .eq('ra', userRa)
          .maybeSingle();

        if (stData) {
          studentDetails = stData;
          contactDetails = Array.isArray(stData.student_contacts)
            ? stData.student_contacts[0]
            : stData.student_contacts;
        }
      }

      const user: UserProfile = {
        id: authData.user.id,
        name:
          profile?.name ||
          studentDetails?.name ||
          authData.user.user_metadata?.name ||
          'Estudante Alvarista',
        ra: userRa,
        email: authData.user.email || emailToAuth,
        role: (profile?.role || authData.user.user_metadata?.role || 'Aluno') as UserRole,
        course:
          profile?.course ||
          studentDetails?.course ||
          authData.user.user_metadata?.course ||
          'Graduação FECAP',
        semester:
          profile?.semester ||
          studentDetails?.semestre ||
          '1º Semestre',
        avatarUrl: profile?.avatar_url || undefined,
        cpf: profile?.cpf,
        rg: profile?.rg,
        birthDate: profile?.birth_date,
        phone: profile?.phone,
        cep: profile?.cep || contactDetails?.cep,
        street: profile?.street || contactDetails?.logradouro,
        number: profile?.number,
        complement: profile?.complement,
        neighborhood: profile?.neighborhood || contactDetails?.bairro,
        city: profile?.city || contactDetails?.cidade || 'São Paulo',
        state: profile?.state || contactDetails?.estado || 'SP',
        distanceKm: profile?.distance_km,
        distanceText: profile?.distance_text,
        pushToken: profile?.push_token,
        googleId: profile?.google_id,
        appleId: profile?.apple_id,
      };

      await safeStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      if (user.avatarUrl && user.ra) {
        await safeStorage.setItem(`@asa_avatar_${user.ra}`, user.avatarUrl);
      }

      return { user };
    } catch (err: any) {
      return { error: err.message || 'Falha ao autenticar no servidor.' };
    }
  },

  /**
   * Login Social via Google ou Apple.
   * Regra estrita: Login social só é aceito para contas previamente cadastradas pela instituição.
   */
  async signInWithSocial(
    provider: 'google' | 'apple'
  ): Promise<{
    user?: UserProfile;
    error?: string;
  }> {
    try {
      if (!isSupabaseConfigured) {
        return { error: 'Serviço de autenticação em nuvem não configurado.' };
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: 'asa-mobile://auth/callback',
        },
      });

      if (error) {
        return { error: error.message };
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData?.session?.user;

      if (!authUser) {
        return { error: 'Falha ao obter dados do usuário após login social.' };
      }

      // Busca perfil existente vinculado ao ID do usuário autenticado
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profile && profile.ra) {
        const user: UserProfile = {
          id: profile.id,
          name: profile.name || authUser.user_metadata?.full_name || 'Estudante',
          ra: profile.ra,
          email: profile.email || authUser.email || '',
          role: (profile.role || 'Aluno') as UserRole,
          course: profile.course || 'Graduação FECAP',
          semester: profile.semester || '1º Semestre',
          avatarUrl: profile.avatar_url || authUser.user_metadata?.avatar_url,
          cpf: profile.cpf,
          rg: profile.rg,
          birthDate: profile.birth_date,
          phone: profile.phone,
          cep: profile.cep,
          street: profile.street,
          number: profile.number,
          complement: profile.complement,
          neighborhood: profile.neighborhood,
          city: profile.city,
          state: profile.state,
          distanceKm: profile.distance_km,
          distanceText: profile.distance_text,
        };

        await safeStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        return { user };
      }

      // Se a conta não tiver RA institucional previamente vinculado, encerra e bloqueia
      await supabase.auth.signOut();
      return {
        error:
          'Esta conta social não está vinculada a nenhum estudante matriculado na FECAP. O login social só é permitido para contas previamente cadastradas no sistema.',
      };
    } catch (e: any) {
      return { error: e?.message || 'Falha na autenticação social.' };
    }
  },

  /**
   * Vinculação manual de conta social desativada por política de segurança institucional.
   */
  async linkSocialAccountToRa(_params: {
    ra: string;
    provider: 'google' | 'apple';
    socialId: string;
    email: string;
    name?: string;
  }): Promise<{ user?: UserProfile; error?: string }> {
    return {
      error:
        'A vinculação manual de contas sociais está desativada por motivos de segurança institucional. Procure a Secretaria CAA para vincular seus acessos.',
    };
  },

  /**
   * Cadastro de nova conta com validação estrita de RA ativo no banco institucional.
   * Regra P0: O app NUNCA chama supabase.auth.signUp direto. Todo cadastro passa pela Edge Function.
   * Papel SEMPRE 'Aluno'. E-mail no domínio @alvarista.fecap.br.
   */
  async signUp(data: {
    name: string;
    ra: string;
    email: string;
    password: string;
    role?: UserRole;
    course?: string;
  }): Promise<{ user?: UserProfile; needsEmailConfirmation?: boolean; error?: string }> {
    try {
      const cleanRa = data.ra.trim();
      const cleanEmail = data.email.trim().toLowerCase();
      const cleanPass = data.password.trim();

      if (!cleanRa || !cleanEmail || !cleanPass) {
        return { error: 'RA, e-mail e senha são obrigatórios.' };
      }

      if (cleanPass.length < 6) {
        return { error: 'A senha deve ter no mínimo 6 caracteres.' };
      }

      // Validação estrita do domínio institucional
      if (!cleanEmail.endsWith('@alvarista.fecap.br')) {
        return {
          error:
            'Apenas e-mails institucionais do domínio @alvarista.fecap.br (ex: <seu_ra>@alvarista.fecap.br) são permitidos para cadastro.',
        };
      }

      if (!isSupabaseConfigured) {
        return { error: 'Supabase não está configurado no aplicativo.' };
      }

      // 1. Invoca a Edge Function validate-and-register-student (revisada)
      const { data: edgeResult, error: edgeError } = await supabase.functions.invoke(
        'validate-and-register-student',
        {
          body: {
            name: data.name.trim(),
            ra: cleanRa,
            email: cleanEmail,
            password: cleanPass,
            course: data.course?.trim(),
          },
        }
      );

      if (edgeError) {
        return { error: edgeError.message || 'Falha ao validar cadastro institucional.' };
      }

      if (edgeResult?.error) {
        return { error: edgeResult.error };
      }

      // 2. Dispara o envio de código OTP de 6 dígitos via Supabase Auth
      // shouldCreateUser: false garante que não cria conta arbitrária fora da Edge Function
      const { error: otpSendError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpSendError) {
        console.warn('Erro ao disparar OTP pós-registro na Edge Function:', otpSendError.message);
      }

      return {
        needsEmailConfirmation: true,
      };
    } catch (err: any) {
      return { error: err.message || 'Falha ao realizar cadastro institucional.' };
    }
  },

  /**
   * Confirma o cadastro utilizando o código OTP de 6 dígitos enviado por e-mail.
   * Após a validação, chama a RPC segura link_student_after_verification() no banco.
   */
  async verifyOtp(
    email: string,
    token: string,
    passwordToSet?: string
  ): Promise<{ user?: UserProfile; error?: string }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanToken = token.trim();

      if (!cleanEmail || !cleanToken) {
        return { error: 'E-mail e código de verificação são obrigatórios.' };
      }

      if (!isSupabaseConfigured) {
        return { error: 'Supabase não está configurado.' };
      }

      // 1. Valida o código OTP no Supabase Auth
      let authUser: any = null;
      const { data: otpData, error: otpErr } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email',
      });

      if (!otpErr && otpData?.user) {
        authUser = otpData.user;
      } else {
        // Tenta também com tipo signup caso o envio tenha sido pelo fluxo de signup
        const { data: signupOtpData, error: signupOtpErr } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'signup',
        });

        if (signupOtpErr) {
          return { error: signupOtpErr.message || otpErr?.message || 'Código de verificação incorreto ou expirado.' };
        }
        authUser = signupOtpData?.user;
      }

      if (!authUser) {
        return { error: 'Não foi possível autenticar após a verificação do código.' };
      }

      // Item 3: Define a senha definitiva do estudante após confirmação do OTP
      if (passwordToSet && passwordToSet.trim().length >= 6) {
        try {
          const { error: pwdErr } = await supabase.auth.updateUser({ password: passwordToSet.trim() });
          if (pwdErr) {
            console.warn('[authService] Aviso ao definir senha pós-OTP:', pwdErr.message);
          }
        } catch (pwdEx) {
          console.warn('[authService] Exceção ao definir senha pós-OTP:', pwdEx);
        }
      }

      // 2. Chama RPC para vincular student.profile_id atômica e seguramente no banco
      try {
        await supabase.rpc('link_student_after_verification');
      } catch (linkErr) {
        console.warn('Aviso ao executar link_student_after_verification:', linkErr);
      }

      // 3. Busca o perfil criado
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      const user: UserProfile = {
        id: authUser.id,
        name: profile?.name || authUser.user_metadata?.name || 'Estudante Alvarista',
        ra: profile?.ra || authUser.user_metadata?.ra || '',
        email: authUser.email || cleanEmail,
        role: (profile?.role || 'Aluno') as UserRole,
        course: profile?.course || authUser.user_metadata?.course || 'Graduação FECAP',
        semester: profile?.semester || '1º Semestre',
        avatarUrl: profile?.avatar_url,
      };

      await safeStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      return { user };
    } catch (e: any) {
      return { error: e.message || 'Falha ao validar código.' };
    }
  },

  /**
   * Reenvia e-mail de código OTP de verificação
   */
  async resendConfirmationEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        return { success: false, error: 'E-mail é obrigatório.' };
      }

      if (!isSupabaseConfigured) {
        return { success: false, error: 'Supabase não está configurado.' };
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Falha ao reenviar código de confirmação.' };
    }
  },

  /**
   * Atualiza as informações completas do perfil do usuário em profiles e students
   */
  async updateUserProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const raw = await safeStorage.getItem(USER_STORAGE_KEY);
    const current: UserProfile = raw ? JSON.parse(raw) : ({} as UserProfile);
    const updated: UserProfile = { ...current, ...updates };

    await safeStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));

    if (updated.ra) {
      await safeStorage.setItem(`@asa_student_profile_${updated.ra}`, JSON.stringify(updated));
      studentRiskService.syncStudentProfile(updated.ra, updated);
    }

    if (isSupabaseConfigured && updated.ra) {
      try {
        const nowIso = new Date().toISOString();

        // 1. Atualiza profiles (cliente autenticado tem permissão para seu id/ra)
        const profileUpdates: any = {
          name: updated.name,
          email: updated.email,
          cpf: updated.cpf || null,
          rg: updated.rg || null,
          birth_date: updated.birthDate || null,
          phone: updated.phone || null,
          cep: updated.cep || null,
          street: updated.street || null,
          number: updated.number || null,
          complement: updated.complement || null,
          neighborhood: updated.neighborhood || null,
          city: updated.city || null,
          state: updated.state || null,
          distance_km: updated.distanceKm || null,
          distance_text: updated.distanceText || null,
          avatar_url: updated.avatarUrl || null,
          updated_at: nowIso,
        };

        if (updated.pushToken) {
          profileUpdates.push_token = updated.pushToken;
        }

        if (current.id) {
          await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', current.id);
        } else {
          await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('ra', updated.ra);
        }

        // Item 6: Aluno NÃO pode escrever em students (registro institucional imutável pelo aluno).
        // Todos os dados pessoais (nome social, telefone, endereço, avatar, push_token) ficam salvos em profiles.
        // Se a policy de student_contacts for liberada pelo DBA, os dados geográficos podem ser sincronizados.
        const { data: stRecord } = await supabase
          .from('students')
          .select('id')
          .eq('profile_id', current.id)
          .maybeSingle();

        if (stRecord?.id && (updated.city || updated.neighborhood || updated.state)) {
          const contactPayload: Record<string, any> = {
            cidade: updated.city || null,
            estado: updated.state || null,
            bairro: updated.neighborhood || null,
          };

          const { data: hasContact } = await supabase
            .from('student_contacts')
            .select('student_id')
            .eq('student_id', stRecord.id)
            .maybeSingle();

          if (hasContact) {
            await supabase
              .from('student_contacts')
              .update(contactPayload)
              .eq('student_id', stRecord.id);
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar perfil no Supabase:', err);
      }
    }

    return updated;
  },

  async updateRole(role: UserRole): Promise<UserProfile> {
    return this.updateUserProfile({ role });
  },

  async updateAvatar(avatarUrl: string): Promise<UserProfile> {
    const updated = await this.updateUserProfile({ avatarUrl });
    if (updated.ra) {
      await safeStorage.setItem(`@asa_avatar_${updated.ra}`, avatarUrl);
    }
    return updated;
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

  async getStoredSession(): Promise<{ user: UserProfile | null; rememberMeData?: { ra: string } | null }> {
    try {
      const userRaw = await safeStorage.getItem(USER_STORAGE_KEY);
      const remRaw = await safeStorage.getItem(REMEMBER_ME_KEY);
      let user: UserProfile | null = userRaw ? JSON.parse(userRaw) : null;

      if (user && user.ra && isSupabaseConfigured) {
        try {
          const { data: dbProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('ra', user.ra)
            .maybeSingle();

          if (dbProfile) {
            user = {
              ...user,
              name: dbProfile.name || user.name,
              avatarUrl: dbProfile.avatar_url || user.avatarUrl,
              cpf: dbProfile.cpf || user.cpf,
              rg: dbProfile.rg || user.rg,
              birthDate: dbProfile.birth_date || user.birthDate,
              phone: dbProfile.phone || user.phone,
              cep: dbProfile.cep || user.cep,
              street: dbProfile.street || user.street,
              number: dbProfile.number || user.number,
              complement: dbProfile.complement || user.complement,
              neighborhood: dbProfile.neighborhood || user.neighborhood,
              city: dbProfile.city || user.city,
              state: dbProfile.state || user.state,
              distanceKm: dbProfile.distance_km || user.distanceKm,
              distanceText: dbProfile.distance_text || user.distanceText,
            };
            await safeStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
          }
        } catch {
          // offline fallback
        }
      }

      return {
        user,
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
