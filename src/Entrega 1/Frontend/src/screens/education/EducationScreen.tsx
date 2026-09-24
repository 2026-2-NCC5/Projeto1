import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BookOpen,
  Calendar,
  Award,
  CheckCircle2,
  AlertTriangle,
  Users,
  Building2,
  Clock,
  TrendingUp,
} from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';

const STUDENT_COURSES = [
  { code: 'CC501', name: 'Arquitetura de Software Móvel', professor: 'Prof. Dr. Alvarista', grade: '9.2', attendance: '96%' },
  { code: 'CC502', name: 'Inteligência Artificial e Agentes', professor: 'Profa. Dra. Elena', grade: '8.8', attendance: '92%' },
  { code: 'CC503', name: 'Engenharia de Usabilidade e UX', professor: 'Prof. Carlos Mendes', grade: '9.5', attendance: '100%' },
  { code: 'CC504', name: 'Segurança da Informação e Redes', professor: 'Prof. Marcelo Viana', grade: '8.0', attendance: '88%' },
];

const PARENT_COURSES = [
  { code: 'CC501', name: 'Arquitetura de Software Móvel', p1: '9.2', p2: 'Em breve', absences: '2 faltas', status: 'Regular' },
  { code: 'CC502', name: 'Inteligência Artificial e Agentes', p1: '8.8', p2: 'Em breve', absences: '4 faltas', status: 'Regular' },
  { code: 'CC503', name: 'Engenharia de Usabilidade e UX', p1: '9.5', p2: 'Em breve', absences: '0 faltas', status: 'Excelente' },
  { code: 'CC504', name: 'Segurança da Informação e Redes', p1: '8.0', p2: 'Em breve', absences: '6 faltas', status: 'Atenção Faltas' },
];

const TEACHER_DIARY = [
  { turma: 'CCOMP 5NA', disciplina: 'Inteligência Artificial', alunos: 42, p1Fechada: true, p2Fechada: false, mediaTurma: '8.6' },
  { turma: 'CCOMP 4NA', disciplina: 'Arquitetura Móvel', alunos: 38, p1Fechada: true, p2Fechada: false, mediaTurma: '8.9' },
  { turma: 'ADM 1NA', disciplina: 'Sistemas de Informação', alunos: 55, p1Fechada: false, p2Fechada: false, mediaTurma: '7.8' },
];

export const EducationScreen: React.FC = () => {
  const { user, selectedRole } = useAuth();
  const currentRole = user?.role || selectedRole || 'Aluno';

  const renderContent = () => {
    switch (currentRole) {
      case 'Pais':
        return (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Boletim do Dependente</Text>
              <Text style={styles.subtitle}>
                Lucas Alvarista • Ciência da Computação (5º Semestre)
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Award size={22} color={colors.primary} />
                <Text style={styles.statNumber}>8.9</Text>
                <Text style={styles.statLabel}>Média Semestral</Text>
              </View>
              <View style={styles.statCard}>
                <CheckCircle2 size={22} color={colors.secondary} />
                <Text style={styles.statNumber}>94%</Text>
                <Text style={styles.statLabel}>Frequência</Text>
              </View>
              <View style={styles.statCard}>
                <BookOpen size={22} color={colors.warningYellow} />
                <Text style={styles.statNumber}>4</Text>
                <Text style={styles.statLabel}>Disciplinas</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Desempenho por Disciplina</Text>
              {PARENT_COURSES.map((course, idx) => (
                <View key={idx} style={styles.courseCard}>
                  <View style={styles.courseHeader}>
                    <Text style={styles.courseCode}>{course.code}</Text>
                    <View style={styles.badgeGrade}>
                      <Text style={styles.badgeGradeText}>Nota P1: {course.p1}</Text>
                    </View>
                  </View>
                  <Text style={styles.courseName}>{course.name}</Text>
                  <View style={styles.courseFooter}>
                    <Text style={styles.attendanceText}>{course.absences}</Text>
                    <Text style={[styles.statusOkText, course.status.includes('Atenção') && { color: colors.warning }]}>
                      Situação: {course.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        );

      case 'Professor':
        return (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Gestão de Aulas & Diário</Text>
              <Text style={styles.subtitle}>
                Prof. Dr. Carlos Alvarista • Semestre 2026.1
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Users size={22} color={colors.primary} />
                <Text style={styles.statNumber}>135</Text>
                <Text style={styles.statLabel}>Alunos Totais</Text>
              </View>
              <View style={styles.statCard}>
                <BookOpen size={22} color={colors.secondary} />
                <Text style={styles.statNumber}>3</Text>
                <Text style={styles.statLabel}>Turmas Ativas</Text>
              </View>
              <View style={styles.statCard}>
                <Award size={22} color={colors.warningYellow} />
                <Text style={styles.statNumber}>8.4</Text>
                <Text style={styles.statLabel}>Média Global</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Status dos Diários de Classe</Text>
              {TEACHER_DIARY.map((d, idx) => (
                <View key={idx} style={styles.courseCard}>
                  <View style={styles.courseHeader}>
                    <Text style={styles.courseCode}>{d.turma}</Text>
                    <View style={styles.badgeGrade}>
                      <Text style={styles.badgeGradeText}>Média: {d.mediaTurma}</Text>
                    </View>
                  </View>
                  <Text style={styles.courseName}>{d.disciplina}</Text>
                  <Text style={styles.professorText}>{d.alunos} alunos matriculados</Text>
                  <View style={styles.courseFooter}>
                    <Text style={styles.attendanceText}>P1: {d.p1Fechada ? 'Lançada ✓' : 'Pendente'}</Text>
                    <Text style={styles.attendanceText}>P2: {d.p2Fechada ? 'Lançada ✓' : 'Aguardando data'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        );

      case 'Funcionário':
        return (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Indicadores de Rendimento & Retenção</Text>
              <Text style={styles.subtitle}>
                Visão Institucional FECAP • Acompanhamento Curricular
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <TrendingUp size={22} color={colors.primary} />
                <Text style={styles.statNumber}>91.2%</Text>
                <Text style={styles.statLabel}>Taxa Aprovação</Text>
              </View>
              <View style={styles.statCard}>
                <AlertTriangle size={22} color={colors.warning} />
                <Text style={styles.statNumber}>8.8%</Text>
                <Text style={styles.statLabel}>Taxa em DP</Text>
              </View>
              <View style={styles.statCard}>
                <Building2 size={22} color={colors.secondary} />
                <Text style={styles.statNumber}>14</Text>
                <Text style={styles.statLabel}>Cursos Graduação</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Disciplinas com Maior Demanda de Permanência</Text>
              <View style={styles.courseCard}>
                <Text style={styles.courseName}>Cálculo Diferencial e Integral I</Text>
                <Text style={styles.professorText}>Índice de Retenção: 18.4% • Turmas: 1º e 2º Sem.</Text>
                <View style={styles.courseFooter}>
                  <Text style={styles.statusOkText}>Ação: Programa de Nivelamento Ativo</Text>
                </View>
              </View>
              <View style={styles.courseCard}>
                <Text style={styles.courseName}>Algoritmos e Estruturas de Dados</Text>
                <Text style={styles.professorText}>Índice de Retenção: 14.2% • Turmas: CCOMP 2º Sem.</Text>
                <View style={styles.courseFooter}>
                  <Text style={styles.statusOkText}>Ação: Tutores de Apoio Alocados</Text>
                </View>
              </View>
            </View>
          </>
        );

      case 'Aluno':
      default:
        return (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Painel Educacional</Text>
              <Text style={styles.subtitle}>
                {user?.course || 'Ciência da Computação'} • {user?.semester || '5º Semestre'}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Award size={22} color={colors.primary} />
                <Text style={styles.statNumber}>8.9</Text>
                <Text style={styles.statLabel}>Média Geral (CR)</Text>
              </View>
              <View style={styles.statCard}>
                <CheckCircle2 size={22} color={colors.secondary} />
                <Text style={styles.statNumber}>94%</Text>
                <Text style={styles.statLabel}>Frequência Global</Text>
              </View>
              <View style={styles.statCard}>
                <BookOpen size={22} color={colors.warningYellow} />
                <Text style={styles.statNumber}>4</Text>
                <Text style={styles.statLabel}>Disciplinas Ativas</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Disciplinas do Semestre</Text>
              {STUDENT_COURSES.map((course, idx) => (
                <View key={idx} style={styles.courseCard}>
                  <View style={styles.courseHeader}>
                    <Text style={styles.courseCode}>{course.code}</Text>
                    <View style={styles.badgeGrade}>
                      <Text style={styles.badgeGradeText}>Média: {course.grade}</Text>
                    </View>
                  </View>
                  <Text style={styles.courseName}>{course.name}</Text>
                  <Text style={styles.professorText}>{course.professor}</Text>
                  <View style={styles.courseFooter}>
                    <Text style={styles.attendanceText}>Presença: {course.attendance}</Text>
                    <Text style={styles.statusOkText}>Situação: Aprovado</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.semiBold,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statNumber: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  courseCode: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.secondary,
  },
  badgeGrade: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  badgeGradeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.primaryDark,
  },
  courseName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  professorText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  courseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.xs,
  },
  attendanceText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  statusOkText: {
    fontSize: typography.fontSizes.xs,
    color: colors.primary,
    fontWeight: typography.fontWeights.semiBold,
  },
});
