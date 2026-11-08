import { Platform, Alert } from 'react-native';
import * as Updates from 'expo-updates';

export interface OTAStatus {
  isChecking: boolean;
  isAvailable: boolean;
  isDownloading: boolean;
  isDownloaded: boolean;
  updateMessage: string;
}

export const otaUpdateService = {
  /**
   * Verifica se o app está em execução via build com suporte nativo a atualizações OTA
   */
  isUpdatesSupported(): boolean {
    if (Platform.OS === 'web') return false;
    try {
      return Boolean(Updates && Updates.isEnabled);
    } catch {
      return false;
    }
  },

  /**
   * Checagem automática no início da inicialização do app (ON_LOAD)
   */
  async checkOnAppLaunch(): Promise<void> {
    if (!this.isUpdatesSupported()) return;

    try {
      const updateCheck = await Updates.checkForUpdateAsync();

      if (updateCheck.isAvailable) {
        // Baixa a atualização em background
        await Updates.fetchUpdateAsync();

        Alert.alert(
          'Nova Versão Disponível',
          'Uma nova atualização do ASA FECAP foi baixada com melhorias e correções. Deseja reiniciar agora para aplicar?',
          [
            { text: 'Mais Tarde', style: 'cancel' },
            {
              text: 'Reiniciar Agora',
              onPress: async () => {
                try {
                  await Updates.reloadAsync();
                } catch (e) {
                  console.warn('Erro ao reiniciar app para update:', e);
                }
              },
            },
          ]
        );
      }
    } catch (e) {
      console.log('[OTA] Checagem em background finalizada (sem novas versões ou offline):', e);
    }
  },

  /**
   * Checagem manual de atualização pelo usuário na tela de Configurações
   */
  async checkManually(): Promise<{ isAvailable: boolean; message: string }> {
    if (!this.isUpdatesSupported()) {
      return {
        isAvailable: false,
        message: 'O aplicativo já está na versão estável mais recente.',
      };
    }

    try {
      const updateCheck = await Updates.checkForUpdateAsync();

      if (updateCheck.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert(
          'Atualização Baixada!',
          'A versão mais recente do aplicativo está pronta. Reinicie o aplicativo para ativá-la.',
          [
            { text: 'Depois' },
            {
              text: 'Reiniciar Agora',
              onPress: async () => {
                try {
                  await Updates.reloadAsync();
                } catch (e) {
                  console.warn('Erro ao reiniciar app:', e);
                }
              },
            },
          ]
        );
        return {
          isAvailable: true,
          message: 'Nova versão baixada! Reinicie para aplicar.',
        };
      }

      return {
        isAvailable: false,
        message: 'Seu aplicativo já está atualizado com a versão mais recente.',
      };
    } catch (e: any) {
      return {
        isAvailable: false,
        message: 'Não foi possível verificar atualizações no momento. Verifique sua conexão.',
      };
    }
  },
};
