import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  User,
  CreditCard,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  MapPin,
  RefreshCw,
  Navigation,
  Clock,
  Save,
  CheckCircle2,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { distanceService, DistanceCalculationResult } from '../../services/location/distanceService';
import { UserRole } from '../../utils/constants';
import { FadeInView, ScalePressable } from '../../components/common/AnimatedComponents';

export const PersonalDataScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { user, selectedRole, updateProfile, refreshUser } = useAuth();
  const { showToast } = useApp();
  const currentRole: UserRole =
    user?.role === 'Funcionário' || selectedRole === 'Funcionário' ? 'Funcionário' : 'Aluno';

  const [savingProfile, setSavingProfile] = useState(false);
  const [calculatingDist, setCalculatingDist] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [cpf, setCpf] = useState(user?.cpf || '');
  const [rg, setRg] = useState(user?.rg || '');
  const [birthDate, setBirthDate] = useState(user?.birthDate || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [cep, setCep] = useState(user?.cep || '');
  const [street, setStreet] = useState(user?.street || '');
  const [number, setNumber] = useState(user?.number || '');
  const [complement, setComplement] = useState(user?.complement || '');
  const [neighborhood, setNeighborhood] = useState(user?.neighborhood || '');
  const [city, setCity] = useState(user?.city || 'São Paulo');
  const [state, setState] = useState(user?.state || 'SP');

  // Distância calculada em tempo real até o campus Liberdade
  const [distanceInfo, setDistanceInfo] = useState<DistanceCalculationResult | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (refreshUser) await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

  // Sincroniza formulário com dados do usuário autenticado
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setCpf(user.cpf || '');
      setRg(user.rg || '');
      setBirthDate(user.birthDate || '');
      setPhone(user.phone || '');
      setCep(user.cep || '');
      setStreet(user.street || '');
      setNumber(user.number || '');
      setComplement(user.complement || '');
      setNeighborhood(user.neighborhood || '');
      setCity(user.city || 'São Paulo');
      setState(user.state || 'SP');

      if (user.distanceKm != null) {
        const numKm = Number(user.distanceKm);
        setDistanceInfo({
          distanceKm: numKm,
          distanceText: user.distanceText || `${numKm.toFixed(1)} km`,
          status: numKm > 30 ? 'Longe' : numKm >= 12 ? 'Moderado' : 'Perto',
          estimatedMinutes: Math.round(numKm * 2.2),
        });
      }
    }
  }, [user]);

  // Busca endereço automático ao digitar CEP válido
  const handleCepChange = async (val: string) => {
    setCep(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
      try {
        const res = await distanceService.fetchAddressByCep(clean);
        if (res && !res.error) {
          if (res.street) setStreet(res.street);
          if (res.neighborhood) setNeighborhood(res.neighborhood);
          if (res.city) setCity(res.city);
          if (res.state) setState(res.state);

          recalcDistance({
            cep: clean,
            street: res.street,
            neighborhood: res.neighborhood,
            city: res.city,
            state: res.state,
          });
        }
      } catch (e) {
        console.warn('Erro ao autocompletar CEP:', e);
      }
    }
  };

  // Recálculo dinâmico da distância até o Campus Liberdade
  const recalcDistance = async (addrParams?: {
    cep?: string;
    street?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  }) => {
    setCalculatingDist(true);
    try {
      const result = await distanceService.calculateDistanceToFECAP({
        cep: addrParams?.cep || cep,
        street: addrParams?.street || street,
        neighborhood: addrParams?.neighborhood || neighborhood,
        city: addrParams?.city || city,
        state: addrParams?.state || state,
      });

      setDistanceInfo(result);
      return result;
    } catch (e) {
      console.warn('Erro ao calcular distância:', e);
      return null;
    } finally {
      setCalculatingDist(false);
    }
  };

  // Salvar alterações de perfil
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const dist = await recalcDistance();

      const updates: any = {
        name: name.trim(),
        email: email.trim(),
        cpf: cpf.trim(),
        rg: rg.trim(),
        birthDate: birthDate.trim(),
        phone: phone.trim(),
        cep: cep.trim(),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim(),
      };

      if (dist) {
        updates.distanceKm = dist.distanceKm;
        updates.distanceText = dist.distanceText;
      }

      await updateProfile(updates);
      showToast('Dados cadastrais e endereço salvos com sucesso!', 'success');
      navigation.goBack();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar alterações.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const getDistanceBadge = (status?: 'Perto' | 'Moderado' | 'Longe') => {
    switch (status) {
      case 'Longe':
        return { label: 'Zona Externa (> 30km)', bg: isDark ? 'rgba(220,38,38,0.2)' : '#FEE2E2', color: '#DC2626' };
      case 'Moderado':
        return { label: 'Distância Média (12 a 30km)', bg: isDark ? 'rgba(217,119,6,0.2)' : '#FEF3C7', color: '#D97706' };
      default:
        return { label: 'Região Próxima (< 12km)', bg: isDark ? 'rgba(5,150,105,0.2)' : '#D1FAE5', color: '#059669' };
    }
  };

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
          <Text style={[styles.topBarTitle, { color: colors.textPrimary }]}>Meus Dados Cadastrais</Text>
          <Text style={[styles.topBarSub, { color: colors.textSecondary }]}>
            {currentRole === 'Funcionário' ? 'Prontuário Funcional' : 'Dados Pessoais & Endereço'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleSaveProfile}
          disabled={savingProfile}
          style={[styles.topSaveBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          {savingProfile ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Save size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.topSaveBtnText}>Salvar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* SEÇÃO 1: DADOS PESSOAIS */}
        <FadeInView delay={30} translateY={10}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {currentRole === 'Funcionário' ? 'Identificação Funcional' : 'Identificação & Documentos'}
            </Text>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* RA / Chapa */}
              <View style={[styles.inputRow, { borderBottomColor: colors.borderLight }]}>
                <CreditCard size={18} color={colors.primary} />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  {currentRole === 'Funcionário' ? 'Chapa Funcional:' : 'RA Institucional:'}
                </Text>
                <Text style={[styles.staticValue, { color: colors.textPrimary }]}>
                  {user?.ra || '24026851'}
                </Text>
              </View>

              {/* Nome */}
              <View style={[styles.inputRow, { borderBottomColor: colors.borderLight }]}>
                <User size={18} color={colors.primary} />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nome Completo:</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Nome Completo"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { color: colors.textPrimary }]}
                />
              </View>

              {/* E-mail */}
              <View style={[styles.inputRow, { borderBottomColor: colors.borderLight }]}>
                <Mail size={18} color={colors.primary} />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>E-mail:</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="email@fecap.br"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { color: colors.textPrimary }]}
                />
              </View>

              {/* Telefone */}
              <View style={[styles.inputRow, { borderBottomColor: colors.borderLight }]}>
                <Phone size={18} color={colors.primary} />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Telefone / Cel:</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="(11) 98765-4321"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { color: colors.textPrimary }]}
                />
              </View>

                            {/* Curso / Lotação */}
              <View style={styles.inputRow}>
                <BookOpen size={18} color={colors.primary} />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  {currentRole === 'Funcionário' ? 'Lotação:' : 'Curso:'}
                </Text>
                <Text style={[styles.staticValue, { color: colors.textPrimary }]}>
                  {user?.course || (currentRole === 'Funcionário' ? 'Central CAA' : 'Ciência da Computação')}
                </Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* SEÇÃO 2: ENDEREÇO & DISTÂNCIA CAMPUS LIBERDADE */}
        <FadeInView delay={60} translateY={10}>
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                  Endereço & Trajeto Liberdade
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => recalcDistance()}
                disabled={calculatingDist}
                style={[styles.recalcBtn, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
              >
                {calculatingDist ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <RefreshCw size={12} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.recalcBtnText, { color: colors.primary }]}>Recalcular</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Card com o Cálculo Dinâmico de Distância */}
            {distanceInfo && (
              <View
                style={[
                  styles.distanceBadgeCard,
                  { backgroundColor: colors.card, borderColor: getDistanceBadge(distanceInfo.status).color },
                ]}
              >
                <View style={styles.distHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Navigation size={18} color={getDistanceBadge(distanceInfo.status).color} />
                    <Text style={[styles.distKmText, { color: colors.textPrimary }]}>
                      {distanceInfo.distanceText}
                    </Text>
                  </View>
                  <View style={[styles.statusBadgePill, { backgroundColor: getDistanceBadge(distanceInfo.status).bg }]}>
                    <Text style={[styles.statusBadgeText, { color: getDistanceBadge(distanceInfo.status).color }]}>
                      {getDistanceBadge(distanceInfo.status).label}
                    </Text>
                  </View>
                </View>

                {distanceInfo.estimatedMinutes ? (
                  <View style={styles.distMetaRow}>
                    <Clock size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
                    <Text style={[styles.distMetaText, { color: colors.textSecondary }]}>
                      Estimativa de trajeto até a Liberdade: ~{distanceInfo.estimatedMinutes} minutos
                    </Text>
                  </View>
                ) : null}

                <Text style={[styles.distDestText, { color: colors.textMuted }]}>
                  Destino: FECAP Liberdade (Av. da Liberdade, 532, São Paulo - SP)
                </Text>
              </View>
            )}

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }]}>
              {/* CEP */}
              <View style={[styles.inputRow, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CEP:</Text>
                <TextInput
                  value={cep}
                  onChangeText={handleCepChange}
                  keyboardType="numeric"
                  maxLength={9}
                  placeholder="00000-000"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { color: colors.textPrimary }]}
                />
              </View>

              {/* Logradouro */}
              <View style={[styles.inputRow, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Logradouro:</Text>
                <TextInput
                  value={street}
                  onChangeText={setStreet}
                  placeholder="Rua, Avenida, etc."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { color: colors.textPrimary }]}
                />
              </View>

              {/* Número e Complemento */}
              <View style={[styles.inputRow, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nº / Compl.:</Text>
                <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={number}
                    onChangeText={setNumber}
                    placeholder="Nº"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.textInput, { flex: 1, color: colors.textPrimary }]}
                  />
                  <TextInput
                    value={complement}
                    onChangeText={setComplement}
                    placeholder="Apto/Bloco"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.textInput, { flex: 1.5, color: colors.textPrimary }]}
                  />
                </View>
              </View>

              {/* Bairro */}
              <View style={[styles.inputRow, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Bairro:</Text>
                <TextInput
                  value={neighborhood}
                  onChangeText={setNeighborhood}
                  placeholder="Bairro"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { color: colors.textPrimary }]}
                />
              </View>

              {/* Cidade e UF */}
              <View style={styles.inputRow}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Cidade / UF:</Text>
                <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={city}
                    onChangeText={setCity}
                    placeholder="Cidade"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.textInput, { flex: 2, color: colors.textPrimary }]}
                  />
                  <TextInput
                    value={state}
                    onChangeText={setState}
                    placeholder="UF"
                    maxLength={2}
                    autoCapitalize="characters"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.textInput, { flex: 1, color: colors.textPrimary }]}
                  />
                </View>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* Botão de Salvar Alterações */}
        <ScalePressable
          onPress={handleSaveProfile}
          disabled={savingProfile}
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
        >
          {savingProfile ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Save size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.saveButtonText}>Salvar Alterações</Text>
            </>
          )}
        </ScalePressable>
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
  topSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  topSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
    width: 120,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  staticValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  recalcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  recalcBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  distanceBadgeCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 4,
  },
  distHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distKmText: {
    fontSize: 18,
    fontWeight: '800',
  },
  statusBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  distMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  distMetaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  distDestText: {
    fontSize: 11,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
