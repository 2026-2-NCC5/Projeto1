import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';
import safeStorage from '../../utils/safeStorage';

const dbClient = supabase;

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  category?: 'ticket' | 'requirement' | 'news' | 'chat';
}

export interface NotificationPreferences {
  ticketNotify: boolean;
  reqNotify: boolean;
  newsNotify: boolean;
}

const PUSH_TOKEN_STORAGE_KEY = '@asa_expo_push_token_v1';
const NOTIFICATION_PREFS_KEY = '@asa_notification_prefs_v1';
const EAS_PROJECT_ID = 'c5d20b2d-2d41-4dad-8e12-7e95e7728a5f';

let handlerConfigured = false;

function isValidUuid(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
}

/**
 * Remove valores undefined/null para evitar falha na ponte nativa WritableNativeMap do Android
 */
function sanitizeData(raw?: Record<string, any>): Record<string, string | number | boolean> {
  const clean: Record<string, string | number | boolean> = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
    } else {
      try {
        clean[key] = JSON.stringify(value);
      } catch {
        clean[key] = String(value);
      }
    }
  }
  return clean;
}

function ensureNotificationHandlerConfigured() {
  if (handlerConfigured || Platform.OS === 'web') return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    handlerConfigured = true;
  } catch (err) {
    console.warn('Aviso ao configurar handler de notificações:', err);
  }
}

// Configura o handler no carregamento inicial do módulo para acordar o app em cold start
if (Platform.OS !== 'web') {
  ensureNotificationHandlerConfigured();
}

async function ensureAndroidChannelConfigured() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ASA FECAP - Comunicados e Atualizações',
      description: 'Alertas de requerimentos, avisos institucionais, fila CAA e atendimento ao vivo',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00875A',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  } catch (err) {
    console.warn('Aviso ao criar canal de notificação Android:', err);
  }
}

export const pushNotificationService = {
  /**
   * Inicializa handlers e canal nativo de alta prioridade (estilo WhatsApp / Gmail)
   */
  async initialize(): Promise<void> {
    if (Platform.OS === 'web') return;
    ensureNotificationHandlerConfigured();
    await ensureAndroidChannelConfigured();
  },

  /**
   * Lê preferências locais de notificação do usuário
   */
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const raw = await safeStorage.getItem(NOTIFICATION_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ticketNotify: parsed.ticketNotify !== false,
          reqNotify: parsed.reqNotify !== false,
          newsNotify: parsed.newsNotify !== false,
        };
      }
    } catch {}
    return { ticketNotify: true, reqNotify: true, newsNotify: true };
  },

  /**
   * Salva preferências locais de notificação do usuário
   */
  async savePreferences(prefs: NotificationPreferences): Promise<void> {
    try {
      await safeStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  },

  /**
   * Solicita permissão do sistema operacional e obtém o ExponentPushToken real do aparelho
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
          await Notification.requestPermission();
        }
        return null;
      }

      ensureNotificationHandlerConfigured();
      await ensureAndroidChannelConfigured();

      if (!Device.isDevice) {
        console.log('Notificações push remotas exigem um aparelho físico.');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Permissão para notificações push não concedida.');
        return null;
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        (Constants as any).easConfig?.projectId ||
        EAS_PROJECT_ID;

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData?.data || null;

      if (token) {
        await safeStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
      }

      return token;
    } catch (e) {
      console.warn('Aviso ao obter token push nativo (verifique configuração FCM V1 no APK):', e);
      return null;
    }
  },

  /**
   * Registra o aparelho para push notifications e sincroniza o push_token na tabela public.profiles do Supabase
   */
  async registerAndSyncUserPushToken(user: {
    id?: string;
    ra?: string;
    email?: string;
  } | null): Promise<string | null> {
    if (!user) return null;
    const token = await this.registerForPushNotifications();
    if (!token || !isSupabaseConfigured) return token;

    try {
      const cleanRa = (user.ra || '').trim();
      const cleanId = (user.id || '').trim();
      const nowIso = new Date().toISOString();

      if (isValidUuid(cleanId)) {
        await dbClient
          .from('profiles')
          .update({ push_token: token, updated_at: nowIso })
          .eq('id', cleanId);
      }
      if (cleanRa) {
        await dbClient
          .from('profiles')
          .update({ push_token: token, updated_at: nowIso })
          .eq('ra', cleanRa);
      }
      console.log('[Push] Token push sincronizado no Supabase com sucesso:', token);
    } catch (err) {
      console.warn('Erro ao salvar push_token no Supabase:', err);
    }

    return token;
  },

  /**
   * Remove o vínculo do push_token ao deslogar para não entregar notificações de outro perfil no mesmo aparelho
   */
  async clearUserPushTokenOnSignOut(user: { id?: string; ra?: string } | null): Promise<void> {
    try {
      const localToken = await safeStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
      if (user && isSupabaseConfigured && localToken) {
        if (isValidUuid(user.id)) {
          await dbClient
            .from('profiles')
            .update({ push_token: null })
            .eq('id', user.id!.trim())
            .eq('push_token', localToken);
        }
        if (user.ra) {
          await dbClient
            .from('profiles')
            .update({ push_token: null })
            .eq('ra', user.ra.trim())
            .eq('push_token', localToken);
        }
      }
    } catch {}
  },

  /**
   * Envia uma notificação local imediata neste aparelho
   */
  async triggerLocalNotification(payload: PushNotificationPayload): Promise<void> {
    try {
      const prefs = await this.getPreferences();
      if (payload.category === 'ticket' && !prefs.ticketNotify) return;
      if (payload.category === 'requirement' && !prefs.reqNotify) return;
      if (payload.category === 'news' && !prefs.newsNotify) return;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(payload.title, { body: payload.body });
        }
        return;
      }

      ensureNotificationHandlerConfigured();
      await ensureAndroidChannelConfigured();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: String(payload.title || 'ASA FECAP'),
          body: String(payload.body || ''),
          data: sanitizeData(payload.data),
          sound: 'default',
          ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
        } as any,
        trigger: null,
      });
    } catch (err) {
      console.warn('Fallback gracioso na notificação local:', err);
    }
  },


  /**
   * Notifica localmente que a senha de atendimento do aluno foi chamada no CAA
   */
  async notifyTicketCalled(ticketNumber: string, counter: string): Promise<void> {
    await this.triggerLocalNotification({
      title: `🔔 Senha ${ticketNumber} Chamada!`,
      body: `Dirija-se ao ${counter} para ser atendido na Central de Atendimento ao Aluno (CAA).`,
      data: { type: 'queue_ticket_called', ticketNumber, counter },
      category: 'ticket',
    });
  },

  /**
   * Notifica localmente atualização de status em requerimento
   */
  async notifyRequirementStatusUpdate(protocol: string, newStatus: string, currentStage: string): Promise<void> {
    await this.triggerLocalNotification({
      title: `📄 Requerimento ${protocol} Atualizado`,
      body: `Novo status: ${newStatus}. Etapa atual: ${currentStage}.`,
      data: { type: 'requirement_updated', protocol, newStatus },
      category: 'requirement',
    });
  },

  /**
   * Notifica localmente conclusão de atendimento humano na Central CAA
   */
  async notifySupportResolved(staffName?: string): Promise<void> {
    await this.triggerLocalNotification({
      title: '✅ Atendimento CAA Concluído',
      body: `Seu atendimento foi finalizado com sucesso por ${staffName || 'Central CAA'}. Todo o histórico foi registrado.`,
      data: { type: 'live_support_resolved', staffName: staffName || 'Central CAA' },
      category: 'chat',
    });
  },
};
