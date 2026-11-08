import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  BookOpen,
  Calendar,
  Clock,
  MapPin,
  CheckSquare,
  Award,
  Users,
  Bell,
  ChevronRight,
  PlusCircle,
  FileSpreadsheet,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { borderRadius, typography, spacing, lightColors as colors } from '../../../theme';
import { useAuth } from '../../../store/AuthContext';
import { useApp } from '../../../store/AppContext';

const { width } = Dimensions.get('window');

const TEACHER_CLASSES = [
  {
    id: 'cls-1',
    code: 'CCOMP-502',
    name: 'Inteligência Artificial e Agentes',
    classId: 'CCOMP-5NA',
    studentsCount: 42,
    attendanceAverage: '92%',
    nextClass: 'Hoje | 19:15 às 22:40',
    room: 'Lab. Informática 402 (Bloco B)',
  },
  {
    id: 'cls-2',
    code: 'CCOMP-401',
    name: 'Arquitetura de Software Móvel',
    classId: 'CCOMP-4NA',
    studentsCount: 38,
    attendanceAverage: '96%',
    nextClass: 'Amanhã | 19:15 às 22:40',
    room: 'Lab. Informática 404 (Bloco B)',
  },
  {
    id: 'cls-3',
    code: 'ADM-105',
    name: 'Sistemas de Informação e Gestão',
    classId: 'ADM-1NA',
    studentsCount: 55,
    attendanceAverage: '88%',
    nextClass: 'Quinta-feira | 19:15 às 22:40',
    room: 'Sala 305 (Bloco A)',
  },
];

export const TeacherDashboard: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useApp();

  const [activeCallClass, setActiveCallClass] = useState<string | null>(null);

  const handleLaunchAttendance = (className: string) => {
    setActiveCallClass(className);
    setTimeout(() => {
      setActiveCallClass(null);
      showToast(`Chamada digital da turma "${className}" registrada com sucesso!`, 'success');
    }, 1200);
  };

  const handleLaunchGrades = (className: string) => {
    showToast(`Painel de lançamento de notas aberto para "${className}".`, 'info');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header do Docente */}
        <View style={[styles.headerContainer, { paddingTop: topPadding + spacing.md }]}>
          <View style={styles.badge}>
            <BookOpen size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.badgeText}>CORPO DOCENTE FECAP</Text>
          </View>
          <Text style={styles.headerTitle}>{user?.name || 'Prof. Dr. Carlos Alvarista'}</Text>
          <Text style={styles.headerSubtitle}>
            Matrícula: PROF-1082 • Depto. de Tecnologia & Computação
          </Text>

          {/* Card Próxima Aula Hoje */}
          <View style={[styles.nextClassCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.nextClassHeader}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>PRÓXIMA AULA HOJE</Text>
              </View>
              <Text style={styles.timeText}>19:15 - 22:40</Text>
            </View>

            <Text style={[styles.classNameTitle, { color: colors.textPrimary }]}>Inteligência Artificial e Agentes</Text>
            <Text style={[styles.classTurma, { color: colors.textSecondary }]}>Turma: CCOMP 5º Semestre Noturno</Text>

            <View style={styles.nextClassFooter}>
              <View style={styles.locationItem}>
                <MapPin size={14} color={colors.primaryDark} />
                <Text style={[styles.locationText, { color: colors.textSecondary }]}>Laboratório 402 • Bloco B</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleLaunchAttendance('CCOMP-5NA')}
                style={styles.quickCallBtn}
              >
                <CheckSquare size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.quickCallText}>
                  {activeCallClass === 'CCOMP-5NA' ? 'Gravando...' : 'Fazer Chamada'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Seção: Ações Rápidas do Professor */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ações Acadêmicas</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleLaunchAttendance('CCOMP-5NA')}
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primaryLight }]}>
                  <CheckSquare size={22} color={colors.primaryDark} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Chamada Digital</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleLaunchGrades('CCOMP-5NA')}
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.secondaryLight }]}>
                  <Award size={22} color={colors.secondary} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Lançar Notas</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => showToast('Reserva de laboratório solicitada com sucesso!', 'info')}
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(217,119,6,0.2)' : '#FEF3C7' }]}>
                  <MapPin size={22} color="#D97706" />
                </View>
                <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Reservar Sala</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => showToast('Comunicação enviada aos alunos da turma!', 'info')}
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(2,132,199,0.2)' : '#E0F2FE' }]}>
                  <Bell size={22} color="#0284C7" />
                </View>
                <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Enviar Aviso</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Seção: Minhas Turmas Ativas */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Minhas Turmas Ativas</Text>
              <Text style={[styles.classesCountText, { color: colors.textSecondary }]}>{TEACHER_CLASSES.length} turmas</Text>
            </View>

            {TEACHER_CLASSES.map((cls) => (
              <View key={cls.id} style={[styles.classCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.classCardHeader}>
                  <View style={[styles.classCodeTag, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.classCodeText, { color: colors.primaryDark }]}>{cls.code}</Text>
                  </View>
                  <View style={[styles.studentsCountBadge, { backgroundColor: colors.backgroundAlt }]}>
                    <Users size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.studentsCountText, { color: colors.textSecondary }]}>{cls.studentsCount} alunos</Text>
                  </View>
                </View>

                <Text style={[styles.cardClassName, { color: colors.textPrimary }]}>{cls.name}</Text>
                <Text style={[styles.cardClassRoom, { color: colors.textSecondary }]}>{cls.room}</Text>

                <View style={styles.classCardFooter}>
                  <View>
                    <Text style={[styles.scheduleText, { color: colors.textPrimary }]}>{cls.nextClass}</Text>
                    <Text style={[styles.attendanceText, { color: colors.textSecondary }]}>Frequência média: {cls.attendanceAverage}</Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleLaunchGrades(cls.classId)}
                    style={styles.manageClassBtn}
                  >
                    <Text style={[styles.manageClassBtnText, { color: colors.secondary }]}>Gerenciar Diário</Text>
                    <ChevronRight size={14} color={colors.secondary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  headerContainer: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: spacing.lg,
  },
  nextClassCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  nextClassHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.textSecondary,
  },
  classNameTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  classTurma: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  nextClassFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  quickCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.pill,
  },
  quickCallText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
  },
  body: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  classesCountText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    fontWeight: typography.fontWeights.medium,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  actionCard: {
    width: '23%',
    alignItems: 'center',
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  classCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  classCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  classCodeTag: {
    backgroundColor: colors.backgroundGray,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  classCodeText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.textSecondary,
  },
  studentsCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentsCountText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  cardClassName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  cardClassRoom: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  classCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  scheduleText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
  },
  attendanceText: {
    fontSize: 10,
    color: colors.primaryDark,
    fontWeight: typography.fontWeights.semiBold,
    marginTop: 1,
  },
  manageClassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  manageClassBtnText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.secondary,
  },
});
