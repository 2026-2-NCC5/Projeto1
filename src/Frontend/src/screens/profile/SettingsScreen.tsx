import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  Moon,
  Sun,
  Bell,
  Ticket,
  FileText,
  Info,
  ShieldCheck,
  Building,
  Type,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  DownloadCloud,
} from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { useTheme, FontScaleLevel } from '../../theme/ThemeContext';
import { useApp } from '../../store/AppContext';
import { FadeInView } from '../../components/common/AnimatedComponents';
import { pushNotificationService } from '../../services/notifications/pushNotificationService';
import { otaUpdateService } from '../../services/updates/otaUpdateService';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, isDark, toggleTheme, fontScaleLevel, setFontScaleLevel, typography } = useTheme();
  const { showToast } = useApp();

  const [hasSystemPermission, setHasSystemPermission] = useState<boolean>(true);
  const [ticketNotify, setTicketNotify] = useState(false);
  const [reqNotify, setReqNotify] = useState(false);
  const [newsNotify, setNewsNotify] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    async function checkPermissionsAndPrefs() {
      if (Platform.OS === 'web') {
        setHasSystemPermission(true);
        const prefs = await pushNotificationService.getPreferences();
        setTicketNotify(prefs.ticketNotify);
        setReqNotify(prefs.reqNotify);
        setNewsNotify(prefs.newsNotify);
        return;
      }

      try {
        const { status } = await Notifications.getPermissionsAsync();
        const granted = status === 'granted';
        setHasSystemPermission(granted);

        if (!granted) {
          setTicketNotify(false);
          setReqNotify(false);
          setNewsNotify(false);
        } else {
          const prefs = await pushNotificationService.getPreferences();
          setTicketNotify(prefs.ticketNotify);
          setReqNotify(prefs.reqNotify);
          setNewsNotify(prefs.newsNotify);
        }
      } catch {
        setHasSystemPermission(false);
      }
    }

    checkPermissionsAndPrefs();
  }, []);

  const handleToggle = async (
    key: 'ticketNotify' | 'reqNotify' | 'newsNotify',
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    val: boolean,
    label: string
  ) => {
    if (val && !hasSystemPermission && Platform.OS !== 'web') {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permissão Negada',
            'As notificações do aplicativo foram recusadas no seu dispositivo. Para ativá-las, habilite as notificações do App ASA nas configurações do sistema do seu celular.',
            [{ text: 'Entendi' }]
          );
          setter(false);
          return;
        }
        setHasSystemPermission(true);
      } catch {
        setter(false);
        return;
      }
    }

    setter(val);
    const nextPrefs = {
      ticketNotify: key === 'ticketNotify' ? val : ticketNotify,
      reqNotify: key === 'reqNotify' ? val : reqNotify,
      newsNotify: key === 'newsNotify' ? val : newsNotify,
    };
    await pushNotificationService.savePreferences(nextPrefs);
    showToast(val ? `Notificações de ${label} ativadas.` : `Notificações de ${label} desativadas.`, 'info');
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const res = await otaUpdateService.checkManually();
      showToast(res.message, res.isAvailable ? 'success' : 'info');
    } catch {
      showToast('Erro ao consultar atualizações.', 'error');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const fontOptions: { id: FontScaleLevel; label: string; desc: string }[] = [
    { id: 'small', label: 'Pequeno', desc: '0.9x' },
    { id: 'normal', label: 'Padrão', desc: '1.0x' },
    { id: 'large', label: 'Grande', desc: '1.15x' },
    { id: 'extraLarge', label: 'Extra', desc: '1.30x' },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={22} color={colors.secondary} />
        </TouchableOpacity>
        <View style={styles.topBarTitleBox}>
          <Text style={[styles.topBarTitle, { color: colors.textPrimary }]}>Configurações</Text>
          <Text style={[styles.topBarSub, { color: colors.textSecondary }]}>
            Aparência, Notificações, Acessibilidade & OTA
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* SEÇÃO 1: APARÊNCIA & MODO ESCURO */}
        <FadeInView delay={30} translateY={10}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Aparência do Aplicativo</Text>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.2)' : colors.secondaryLight },
                    ]}
                  >
                    {isDark ? (
                      <Moon size={22} color={colors.warning} />
                    ) : (
                      <Sun size={22} color={colors.secondary} />
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                      Modo Escuro (Dark Mode)
                    </Text>
                    <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                      {isDark ? 'Tema escuro ativado' : 'Tema claro institucional ativado'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#D1D5DB', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </FadeInView>

        {/* SEÇÃO 2: ACESSIBILIDADE - TAMANHO DA FONTE */}
        <FadeInView delay={45} translateY={10}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Acessibilidade — Tamanho da Fonte</Text>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 14 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <Type size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                    Escala de Texto
                  </Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                    Ajuste o tamanho do texto para melhor legibilidade
                  </Text>
                </View>
              </View>

              {/* Botões de Seleção de Escala */}
              <View style={styles.fontButtonsRow}>
                {fontOptions.map((opt) => {
                  const isSelected = fontScaleLevel === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      activeOpacity={0.8}
                      onPress={() => setFontScaleLevel(opt.id)}
                      style={[
                        styles.fontScalePill,
                        {
                          backgroundColor: isSelected ? colors.primary : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                          borderColor: isSelected ? colors.primary : (isDark ? colors.border : '#E2E8F0'),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.fontScalePillText,
                          {
                            color: isSelected ? '#FFFFFF' : colors.textPrimary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text
                        style={[
                          styles.fontScalePillDesc,
                          { color: isSelected ? '#E6F8F1' : colors.textSecondary },
                        ]}
                      >
                        {opt.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Caixa de Prévia Interativa de Texto */}
              <View
                style={[
                  styles.fontPreviewBox,
                  { backgroundColor: isDark ? colors.backgroundAlt : '#F8FAFC', borderColor: colors.border },
                ]}
              >
                <Text style={[styles.fontPreviewLabel, { color: colors.textSecondary }]}>Pré-visualização ao vivo:</Text>
                <Text style={[styles.fontPreviewTitle, { color: colors.textPrimary }]}>
                  O Sucesso do Estudante Alvarista
                </Text>
                <Text style={[styles.fontPreviewBody, { color: colors.textSecondary }]}>
                  Todas as orientações acadêmicas, horários de aulas, requerimentos e notas adaptam-se dinamicamente a este tamanho de fonte.
                </Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* SEÇÃO 3: NOTIFICAÇÕES */}
        <FadeInView delay={60} translateY={10}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notificações Push & Alertas</Text>

            {!hasSystemPermission && (
              <View style={styles.permissionWarningBox}>
                <AlertTriangle size={16} color="#D97706" style={{ marginRight: 8 }} />
                <Text style={styles.permissionWarningText}>
                  As notificações estão desativadas nas permissões do celular. Toque em qualquer chave abaixo para solicitar acesso.
                </Text>
              </View>
            )}

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Senhas do Atendimento */}
              <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                    <Ticket size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                      Chamadas de Senha (CAA)
                    </Text>
                    <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                      Alertar quando sua senha for chamada no guichê
                    </Text>
                  </View>
                </View>
                <Switch
                  value={ticketNotify}
                  onValueChange={(val) => handleToggle('ticketNotify', setTicketNotify, val, 'senhas')}
                  trackColor={{ false: '#D1D5DB', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Status de Requerimentos */}
              <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: colors.secondaryLight }]}>
                    <FileText size={20} color={colors.secondary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                      Requerimentos Acadêmicos
                    </Text>
                    <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                      Novas atualizações, pareceres e deferimentos
                    </Text>
                  </View>
                </View>
                <Switch
                  value={reqNotify}
                  onValueChange={(val) => handleToggle('reqNotify', setReqNotify, val, 'requerimentos')}
                  trackColor={{ false: '#D1D5DB', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Avisos Gerais */}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                    <Bell size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                      Avisos Institucionais & Prazos
                    </Text>
                    <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                      Período de rematrícula, calendários e comunicados
                    </Text>
                  </View>
                </View>
                <Switch
                  value={newsNotify}
                  onValueChange={(val) => handleToggle('newsNotify', setNewsNotify, val, 'avisos')}
                  trackColor={{ false: '#D1D5DB', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </FadeInView>

        {/* SEÇÃO 4: ATUALIZAÇÕES AUTOMÁTICAS (OTA) */}
        <FadeInView delay={75} translateY={10}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Atualizações Over-The-Air (OTA)</Text>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 14 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <DownloadCloud size={20} color="#0284C7" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                    Atualizações Rápidas (OTA)
                  </Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                    Novas versões são instaladas automaticamente ao abrir o app
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleCheckUpdate}
                disabled={checkingUpdate}
                activeOpacity={0.8}
                style={[styles.updateCheckBtn, { backgroundColor: colors.primary }]}
              >
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <RefreshCw size={15} color="#FFFFFF" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.updateCheckBtnText}>
                  {checkingUpdate ? 'Consultando Servidor...' : 'Verificar Atualizações Agora'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </FadeInView>

        {/* SEÇÃO 5: SOBRE O APP */}
        <FadeInView delay={90} translateY={10}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Sobre o Aplicativo</Text>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
                <Building size={18} color={colors.textMuted} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Instituição:</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>FECAP — Alvaristas</Text>
              </View>

              <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
                <Info size={18} color={colors.textMuted} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Versão:</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>ASA Mobile v1.0.0 (OTA Ativo)</Text>
              </View>

              <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
                <ShieldCheck size={18} color={colors.textMuted} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Segurança:</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>Supabase Auth & Criptografia</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.copyrightText, { color: colors.textMuted }]}>
                  © 2026 Fundação Escola de Comércio Álvares Penteado. Todos os direitos reservados.
                </Text>
              </View>
            </View>
          </View>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  topBarTitleBox: {
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  topBarSub: {
    fontSize: 11,
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  fontButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  fontScalePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontScalePillText: {
    fontSize: 12,
  },
  fontScalePillDesc: {
    fontSize: 10,
    marginTop: 1,
  },
  fontPreviewBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  fontPreviewLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fontPreviewTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  fontPreviewBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  permissionWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  permissionWarningText: {
    color: '#92400E',
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  updateCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 12,
  },
  updateCheckBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
    width: 100,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  copyrightText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    width: '100%',
  },
});
