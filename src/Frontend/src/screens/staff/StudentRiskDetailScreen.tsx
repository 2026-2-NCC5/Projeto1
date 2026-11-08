import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ArrowLeft,
  DollarSign,
  GraduationCap,
  Users,
  MapPin,
  Sparkles,
  Bot,
  TrendingUp,
  TrendingDown,
  Minus,
  UserCheck,
  FileDown,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Calendar,
  X,
  Send,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useApp } from '../../store/AppContext';
import {
  StudentRiskProfile,
  RiskCategory,
  enrichStudentWithRequirements,
} from '../../services/ai-agent/studentRiskService';
import { studentsService } from '../../services/supabase/studentsService';
import { generateOfficialFECAPDocHTML } from '../../utils/documentGenerator';
import { storageService } from '../../services/supabase/storageService';
import { FadeInView, AnimatedProgressBar, ScalePressable } from '../../components/common/AnimatedComponents';

export const StudentRiskDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const { showToast } = useApp();

  const initialStudent: StudentRiskProfile | undefined = route.params?.student;
  const [student, setStudent] = useState<StudentRiskProfile | undefined>(initialStudent);

  useEffect(() => {
    let isMounted = true;
    async function loadFreshStudent() {
      const targetRa = initialStudent?.ra || route.params?.ra;
      if (!targetRa) return;
      try {
        const found = await studentsService.findStudentByNameOrRA(targetRa);
        if (found && isMounted) {
          setStudent(found);
        } else if (initialStudent && isMounted) {
          const enriched = await enrichStudentWithRequirements(initialStudent);
          setStudent(enriched);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados atualizados do aluno na tela de risco:', err);
      }
    }
    loadFreshStudent();
    return () => {
      isMounted = false;
    };
  }, [initialStudent?.ra, route.params?.ra]);

  const [interventionModalVisible, setInterventionModalVisible] = useState(false);
  const [interventionNote, setInterventionNote] = useState('');
  const [interventionType, setInterventionType] = useState('Acolhimento CAA');
  const [downloadingFicha, setDownloadingFicha] = useState(false);
  const [recordedActions, setRecordedActions] = useState<
    { id: string; type: string; note: string; date: string }[]
  >([]);

  if (!student) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Aluno não encontrado</Text>
        <TouchableOpacity
          style={[styles.backBtnFallback, { backgroundColor: colors.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Voltar para a Lista</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getCategoryTheme = (category: RiskCategory) => {
    switch (category) {
      case 'Vermelho':
        return {
          color: '#DC2626',
          bgColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2',
          borderColor: 'rgba(220, 38, 38, 0.4)',
          label: 'Risco Crítico',
          description: 'Ação imediata necessária para retenção',
        };
      case 'Amarelo':
        return {
          color: '#D97706',
          bgColor: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FEF3C7',
          borderColor: 'rgba(217, 119, 6, 0.4)',
          label: 'Atenção / Moderado',
          description: 'Monitoramento preventivo recomendado',
        };
      case 'Verde':
      default:
        return {
          color: '#059669',
          bgColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#D1FAE5',
          borderColor: 'rgba(5, 150, 105, 0.4)',
          label: 'Estável / Baixo Risco',
          description: 'Desempenho e assiduidade satisfatórios',
        };
    }
  };

  const theme = getCategoryTheme(student.category);

  const initials = (student.name || 'AA')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#DC2626';
    if (score >= 40) return '#D97706';
    return '#059669';
  };

  const handleOpenAIChat = () => {
    navigation.navigate('AIChat', {
      initialPrompt: `Diagnóstico detalhado do aluno ${student.name} (RA: ${student.ra}, Curso: ${student.course}, Semestre: ${student.semester}). Situação da Matrícula: ${student.status_academico || 'Matriculado'}. Quais são as causas principais da classificação de risco 4D e qual o plano de retenção ideal?`,
      studentRa: student.ra,
      studentName: student.name,
      studentCourse: student.course,
      studentStatus: student.status_academico,
    });
  };

  const handleExportReport = async () => {
    if (downloadingFicha) return;
    setDownloadingFicha(true);
    showToast(`Gerando e baixando Ficha 4D de ${student.name}...`, 'info');

    try {
      const reportHtml = generateOfficialFECAPDocHTML({
        title: `Relatório Multidimensional de Permanência (4D) - ${student.name}`,
        category: 'Permanência & Retenção',
        code: `FECAP-4D-${student.ra}-${new Date().getFullYear()}`,
        studentName: student.name,
        ra: student.ra,
        course: `${student.course} (${student.semester || 'Vigente'})`,
        semester: `Turno: ${student.turno || 'Matutino'} • Score Global: ${student.overallRiskScore}/100 (${theme.label})`,
        description: `Classificação 4D detalhada:
- Dimensão Financeira (35%): ${student.dimensions.financeira.score}/100 - ${student.dimensions.financeira.detail}
- Dimensão Acadêmica (30%): ${student.dimensions.academica.score}/100 - ${student.dimensions.academica.detail}
- Dimensão Relacionamento (20%): ${student.dimensions.relacionamento.score}/100 - ${student.dimensions.relacionamento.detail}
- Dimensão Geográfica (15%): ${student.dimensions.geografica.score}/100 - ${student.dimensions.geografica.detail}

Diagnóstico Sintético: ${student.explanation}
Recomendação Operacional: ${student.recommendation}`,
      });

      const ok = await storageService.uploadAndDownloadStudentFicha(
        student.ra,
        student.name,
        reportHtml
      );

      if (ok) {
        showToast(`Ficha 4D de ${student.name} baixada e aberta com sucesso!`, 'success');
      } else {
        showToast('Não foi possível abrir a ficha no navegador.', 'error');
      }
    } catch {
      showToast('Erro ao exportar ficha 4D.', 'error');
    } finally {
      setDownloadingFicha(false);
    }
  };

  const handleSaveIntervention = () => {
    if (!interventionNote.trim()) {
      showToast('Insira uma observação para a intervenção.', 'info');
      return;
    }

    const newAction = {
      id: Date.now().toString(),
      type: interventionType,
      note: interventionNote.trim(),
      date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setRecordedActions([newAction, ...recordedActions]);
    setInterventionNote('');
    setInterventionModalVisible(false);
    showToast(`Intervenção "${interventionType}" registrada para ${student.name}!`, 'success');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Top Navbar */}
      <View style={[styles.navbar, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: topPadding + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[styles.navTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {student.name}
          </Text>
          <Text style={[styles.navSubtitle, { color: colors.textSecondary }]}>
            RA: {student.ra} • Situação: {student.status_academico || 'Matriculado'} • Diagnóstico 4D
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: colors.primaryLight }]}
          onPress={handleExportReport}
          activeOpacity={0.7}
        >
          <FileDown size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Card do Estudante */}
        <FadeInView delay={40} translateY={12}>
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: theme.borderColor }]}>
          <View style={styles.heroTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
              {student.avatarUrl ? (
                <Image
                  source={{ uri: student.avatarUrl }}
                  style={styles.heroAvatarImage}
                />
              ) : (
                <View style={[styles.heroAvatarFallback, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.heroAvatarFallbackText, { color: colors.primaryDark }]}>
                    {initials}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                  <View style={[styles.categoryBadge, { backgroundColor: theme.bgColor }]}>
                    <View style={[styles.categoryDot, { backgroundColor: theme.color }]} />
                    <Text style={[styles.categoryText, { color: theme.color }]}>{theme.label}</Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 12,
                      backgroundColor:
                        student.status_academico === 'Evasão' || student.status_academico === 'Cancelado'
                          ? '#FEE2E2'
                          : student.status_academico === 'Formado'
                          ? '#DBEAFE'
                          : student.status_academico === 'Trancado'
                          ? '#FEF3C7'
                          : '#D1FAE5',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color:
                          student.status_academico === 'Evasão' || student.status_academico === 'Cancelado'
                            ? '#DC2626'
                            : student.status_academico === 'Formado'
                            ? '#2563EB'
                            : student.status_academico === 'Trancado'
                            ? '#D97706'
                            : '#059669',
                      }}
                    >
                      {student.status_academico === 'Evasão' || student.status_academico === 'Cancelado'
                        ? '🔴 Evasão'
                        : student.status_academico === 'Formado'
                        ? '🔵 Formado'
                        : student.status_academico === 'Trancado'
                        ? '🟡 Trancado'
                        : '🟢 Matriculado'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.studentFullName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {student.name}
                </Text>
                <Text style={[styles.studentAcademicInfo, { color: colors.textSecondary }]}>
                  {student.course} • {student.semester}
                </Text>
                <Text style={[styles.studentTurno, { color: colors.textMuted }]}>
                  Turno: {student.turno || 'Noturno'} • Situação: {student.status_academico || 'Matriculado'}
                </Text>
              </View>
            </View>

            {/* Score Circular / Destaque */}
            <View style={[styles.scoreHeroBox, { borderColor: theme.color, backgroundColor: colors.backgroundAlt }]}>
              <Text style={[styles.scoreHeroNumber, { color: theme.color }]}>
                {student.overallRiskScore}
              </Text>
              <Text style={[styles.scoreHeroLabel, { color: colors.textMuted }]}>Score / 100</Text>
            </View>
          </View>

          {/* Barra de Progresso Global */}
          <View style={styles.globalProgressWrapper}>
            <AnimatedProgressBar
              progress={student.overallRiskScore}
              color={theme.color}
              trackColor={colors.backgroundAlt}
              height={10}
            />
            <View style={styles.progressScaleLabels}>
              <Text style={[styles.scaleLabel, { color: '#059669' }]}>0 - Estável</Text>
              <Text style={[styles.scaleLabel, { color: '#D97706' }]}>40 - Atenção</Text>
              <Text style={[styles.scaleLabel, { color: '#DC2626' }]}>70 - Crítico</Text>
              <Text style={[styles.scaleLabel, { color: colors.textMuted }]}>100</Text>
            </View>
          </View>

          {/* Tendência Temporal */}
          <View style={[styles.trendBanner, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
            <View style={styles.trendLeft}>
              {student.temporalTrend === 'Piorando' ? (
                <TrendingUp size={18} color="#DC2626" />
              ) : student.temporalTrend === 'Melhorando' ? (
                <TrendingDown size={18} color="#059669" />
              ) : (
                <Minus size={18} color="#D97706" />
              )}
              <Text style={[styles.trendTitle, { color: colors.textPrimary }]}>
                Tendência Recente: <Text style={{ fontWeight: '700' }}>{student.temporalTrend}</Text>
              </Text>
            </View>
            <View style={[styles.variationPill, { backgroundColor: theme.bgColor }]}>
              <Text style={[styles.variationText, { color: theme.color }]}>
                {student.trendVariation}
              </Text>
            </View>
          </View>

          {/* Histórico Temporal Bimestral */}
          {student.historyScores && student.historyScores.length > 0 && (
            <View style={styles.historyContainer}>
              <Text style={[styles.historyHeading, { color: colors.textMuted }]}>
                Evolução Temporal dos Scores:
              </Text>
              <View style={styles.historyRow}>
                {student.historyScores.map((h, idx) => (
                  <View key={idx} style={[styles.historyPill, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                    <Text style={[styles.historyMonth, { color: colors.textSecondary }]}>{h.month}</Text>
                    <Text style={[styles.historyScore, { color: getScoreColor(h.score) }]}>
                      {h.score} pts
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
        </FadeInView>

        {/* As 4 Dimensões 4D Detalhadas */}
        <View style={styles.sectionHeaderRow}>
          <Sparkles size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Desdobramento 4D de Permanência
          </Text>
        </View>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Composição ponderada de fatores preditivos avaliados institucionalmente pela FECAP
        </Text>

        {/* 1. Dimensão Financeira */}
        <FadeInView delay={90} translateY={12}>
        <View style={[styles.dimensionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dimCardHeader}>
            <View style={[styles.dimIconBox, { backgroundColor: '#FEE2E2' }]}>
              <DollarSign size={20} color="#DC2626" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.dimCardTitle, { color: colors.textPrimary }]}>Dimensão Financeira</Text>
                <Text style={[styles.dimWeightBadge, { color: '#DC2626' }]}>Peso 35%</Text>
              </View>
              <Text style={[styles.dimCardStatus, { color: getScoreColor(student.dimensions.financeira.score) }]}>
                Score: {student.dimensions.financeira.score}/100 • Status: {student.dimensions.financeira.status}
              </Text>
            </View>
          </View>
          <View style={{ marginVertical: 10 }}>
            <AnimatedProgressBar
              progress={student.dimensions.financeira.score}
              color={getScoreColor(student.dimensions.financeira.score)}
              trackColor={colors.backgroundAlt}
              height={8}
              delay={120}
            />
          </View>
          <View style={[styles.dimDetailBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.dimDetailText, { color: colors.textPrimary }]}>
              {student.dimensions.financeira.detail}
            </Text>
          </View>
        </View>
        </FadeInView>

        {/* 2. Dimensão Acadêmica */}
        <FadeInView delay={140} translateY={12}>
        <View style={[styles.dimensionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dimCardHeader}>
            <View style={[styles.dimIconBox, { backgroundColor: '#FEF3C7' }]}>
              <GraduationCap size={20} color="#D97706" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.dimCardTitle, { color: colors.textPrimary }]}>Dimensão Acadêmica</Text>
                <Text style={[styles.dimWeightBadge, { color: '#D97706' }]}>Peso 30%</Text>
              </View>
              <Text style={[styles.dimCardStatus, { color: getScoreColor(student.dimensions.academica.score) }]}>
                Score: {student.dimensions.academica.score}/100 • Status: {student.dimensions.academica.status}
              </Text>
            </View>
          </View>
          <View style={{ marginVertical: 10 }}>
            <AnimatedProgressBar
              progress={student.dimensions.academica.score}
              color={getScoreColor(student.dimensions.academica.score)}
              trackColor={colors.backgroundAlt}
              height={8}
              delay={170}
            />
          </View>
          <View style={[styles.dimDetailBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.dimDetailText, { color: colors.textPrimary }]}>
              {student.dimensions.academica.detail}
            </Text>
          </View>
        </View>
        </FadeInView>

        {/* 3. Dimensão Relacionamento */}
        <FadeInView delay={190} translateY={12}>
        <View style={[styles.dimensionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dimCardHeader}>
            <View style={[styles.dimIconBox, { backgroundColor: colors.secondaryLight }]}>
              <Users size={20} color={colors.secondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.dimCardTitle, { color: colors.textPrimary }]}>Dimensão de Relacionamento</Text>
                <Text style={[styles.dimWeightBadge, { color: colors.secondary }]}>Peso 20%</Text>
              </View>
              <Text style={[styles.dimCardStatus, { color: getScoreColor(student.dimensions.relacionamento.score) }]}>
                Score: {student.dimensions.relacionamento.score}/100 • Status: {student.dimensions.relacionamento.status}
              </Text>
            </View>
          </View>
          <View style={{ marginVertical: 10 }}>
            <AnimatedProgressBar
              progress={student.dimensions.relacionamento.score}
              color={getScoreColor(student.dimensions.relacionamento.score)}
              trackColor={colors.backgroundAlt}
              height={8}
              delay={220}
            />
          </View>
          <View style={[styles.dimDetailBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.dimDetailText, { color: colors.textPrimary }]}>
              {student.dimensions.relacionamento.detail}
            </Text>
          </View>
        </View>
        </FadeInView>

        {/* 4. Dimensão Geográfica */}
        <FadeInView delay={240} translateY={12}>
        <View style={[styles.dimensionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dimCardHeader}>
            <View style={[styles.dimIconBox, { backgroundColor: colors.primaryLight }]}>
              <MapPin size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.dimCardTitle, { color: colors.textPrimary }]}>Dimensão Geográfica</Text>
                <Text style={[styles.dimWeightBadge, { color: colors.primary }]}>Peso 15%</Text>
              </View>
              <Text style={[styles.dimCardStatus, { color: getScoreColor(student.dimensions.geografica.score) }]}>
                Score: {student.dimensions.geografica.score}/100 • Status: {student.dimensions.geografica.status}
              </Text>
            </View>
          </View>
          <View style={{ marginVertical: 10 }}>
            <AnimatedProgressBar
              progress={student.dimensions.geografica.score}
              color={getScoreColor(student.dimensions.geografica.score)}
              trackColor={colors.backgroundAlt}
              height={8}
              delay={270}
            />
          </View>
          <View style={[styles.dimDetailBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.dimDetailText, { color: colors.textPrimary }]}>
              {student.dimensions.geografica.detail}
            </Text>
          </View>
        </View>
        </FadeInView>

        {/* Diagnóstico Integrado SISA */}
        <View style={[styles.analysisCard, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.12)' : '#F5F3FF', borderColor: colors.secondary }]}>
          <View style={styles.analysisHeader}>
            <Sparkles size={18} color={colors.secondary} />
            <Text style={[styles.analysisTitle, { color: colors.secondary }]}>
              Diagnóstico Integrado do Agente SISA
            </Text>
          </View>
          <Text style={[styles.analysisBody, { color: colors.textPrimary }]}>
            {student.explanation}
          </Text>
        </View>

        {/* Plano de Ação Recomendado */}
        <View style={[styles.actionPlanCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
          <View style={styles.analysisHeader}>
            <CheckCircle2 size={18} color={colors.primary} />
            <Text style={[styles.actionPlanTitle, { color: colors.primaryDark }]}>
              Plano de Intervenção Recomendado
            </Text>
          </View>
          <Text style={[styles.actionPlanBody, { color: colors.textPrimary }]}>
            {student.recommendation}
          </Text>
        </View>

        {/* Histórico de Intervenções Realizadas */}
        {recordedActions.length > 0 && (
          <View style={[styles.recordedActionsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.recordedActionsTitle, { color: colors.textPrimary }]}>
              Ações Registradas Nesta Sessão ({recordedActions.length})
            </Text>
            {recordedActions.map((act) => (
              <View key={act.id} style={[styles.recordedActionItem, { borderBottomColor: colors.borderLight }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.recordedActionType, { color: colors.primary }]}>{act.type}</Text>
                  <Text style={[styles.recordedActionDate, { color: colors.textMuted }]}>{act.date}</Text>
                </View>
                <Text style={[styles.recordedActionNote, { color: colors.textSecondary }]}>{act.note}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Botões de Ação Rápida */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.mainActionBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
            onPress={() => setInterventionModalVisible(true)}
          >
            <UserCheck size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.mainActionBtnText}>Registrar Intervenção CAA</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, { backgroundColor: colors.card, borderColor: colors.primary }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('StudentFullProfile', { student })}
          >
            <Users size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.secondaryActionBtnText, { color: colors.primary }]}>
              Abrir Perfil Completo & Requerimentos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, { backgroundColor: colors.card, borderColor: colors.secondary }]}
            activeOpacity={0.85}
            onPress={handleOpenAIChat}
          >
            <Bot size={18} color={colors.secondary} style={{ marginRight: 8 }} />
            <Text style={[styles.secondaryActionBtnText, { color: colors.secondary }]}>
              Consultar IA sobre este Aluno
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.outlineActionBtn, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
            activeOpacity={0.8}
            onPress={handleExportReport}
          >
            <FileDown size={18} color={colors.primaryDark} style={{ marginRight: 8 }} />
            <Text style={[styles.outlineActionBtnText, { color: colors.primaryDark, fontWeight: '700' }]}>
              {downloadingFicha ? 'Baixando Ficha...' : 'Baixar Ficha Oficial 4D'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de Registro de Intervenção */}
      <Modal
        visible={interventionModalVisible}
        transparent={true}
        statusBarTranslucent={true}
        animationType="slide"
        onRequestClose={() => setInterventionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <UserCheck size={20} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Registrar Intervenção
                </Text>
              </View>
              <TouchableOpacity onPress={() => setInterventionModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Tipo de Acolhimento:
              </Text>
              <View style={styles.typeChipsRow}>
                {['Acolhimento CAA', 'Negociação PAFE', 'Monitoria Acadêmica', 'Ajuste de Grade'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeChip,
                      { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                      interventionType === t && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setInterventionType(t)}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: colors.textPrimary },
                        interventionType === t && { color: '#FFFFFF', fontWeight: 'bold' },
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 14 }]}>
                Despacho / Anotação da Equipe:
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                placeholder={`Descreva o contato realizado com ${student.name}, acordos firmados ou encaminhamentos...`}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                value={interventionNote}
                onChangeText={setInterventionNote}
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={handleSaveIntervention}
              >
                <Send size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Salvar Intervenção</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  navSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  exportBtn: {
    padding: 8,
    borderRadius: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  heroAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  heroAvatarFallbackText: {
    fontSize: 17,
    fontWeight: '800',
  },
  studentFullName: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  studentAcademicInfo: {
    fontSize: 13,
    marginTop: 3,
    fontWeight: '500',
  },
  studentTurno: {
    fontSize: 12,
    marginTop: 2,
  },
  scoreHeroBox: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  scoreHeroNumber: {
    fontSize: 24,
    fontWeight: '900',
  },
  scoreHeroLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  globalProgressWrapper: {
    marginTop: 16,
  },
  globalProgressTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  globalProgressBar: {
    height: '100%',
    borderRadius: 5,
  },
  progressScaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scaleLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  trendBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  trendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendTitle: {
    fontSize: 13,
  },
  variationPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  variationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyContainer: {
    marginTop: 14,
  },
  historyHeading: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  historyPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  historyMonth: {
    fontSize: 11,
    fontWeight: '500',
  },
  historyScore: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14,
  },
  dimensionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  dimCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dimIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dimCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  dimWeightBadge: {
    fontSize: 12,
    fontWeight: '800',
  },
  dimCardStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  dimProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
  },
  dimProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  dimDetailBox: {
    padding: 10,
    borderRadius: 8,
  },
  dimDetailText: {
    fontSize: 13,
    lineHeight: 18,
  },
  analysisCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 6,
    marginBottom: 12,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  analysisTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  analysisBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  actionPlanCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  actionPlanTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionPlanBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  recordedActionsBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  recordedActionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  recordedActionItem: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  recordedActionType: {
    fontSize: 13,
    fontWeight: '700',
  },
  recordedActionDate: {
    fontSize: 11,
  },
  recordedActionNote: {
    fontSize: 12,
    marginTop: 4,
  },
  actionButtonsContainer: {
    gap: 10,
    marginTop: 8,
  },
  mainActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  mainActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  secondaryActionBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  outlineActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  typeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    height: 100,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
    marginTop: 18,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  backBtnFallback: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
