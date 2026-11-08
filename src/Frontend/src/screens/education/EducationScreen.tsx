import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BookOpen,
  Award,
  CheckCircle2,
  AlertTriangle,
  Building2,
  TrendingUp,
  RefreshCw,
  GraduationCap,
  Layers,
  Calendar,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { studentsService } from '../../services/supabase/studentsService';
import {
  FadeInView,
  ScalePressable,
  AnimatedProgressBar,
} from '../../components/common/AnimatedComponents';

interface DisciplineData {
  disciplina: string;
  situacao: string;
  nota_obtida: number;
  faltas_lancadas: number;
  semestreLabel: string;
  courseName: string;
  aulas_ministradas?: number;
  pct_assiduidade?: number;
}

const SEMESTERS = [
  'Todos',
  '1º Semestre',
  '2º Semestre',
  '3º Semestre',
  '4º Semestre',
  '5º Semestre',
  '6º Semestre',
];

export const EducationScreen: React.FC = () => {
  const { colors, spacing, typography, borderRadius, isDark } = useTheme();
  const { user, selectedRole } = useAuth();
  const currentRole = user?.role || selectedRole || 'Aluno';

  const primaryCourse = user?.course || 'Ciência da Computação';

  // Cursos atribuídos ao aluno (permite alternar entre múltiplos cursos atribuídos)
  const studentCourses = useMemo(() => {
    const list = [
      {
        id: 'course-1',
        name: primaryCourse,
        degree: 'Bacharelado Principal',
        code: 'CCOMP-2026',
        shift: 'Noturno',
      },
      {
        id: 'course-2',
        name:
          primaryCourse === 'Análise e Desenvolvimento de Sistemas'
            ? 'Ciência de Dados e Inteligência Artificial'
            : 'Análise e Desenvolvimento de Sistemas (ADS)',
        degree: 'Dupla Titulação / 2º Vínculo',
        code: 'ADS-2026',
        shift: 'Matutino / Híbrido',
      },
      {
        id: 'course-3',
        name: 'Finanças Corporativas & Business Analytics',
        degree: 'Certificação Associada FECAP',
        code: 'FIN-2026',
        shift: 'Híbrido',
      },
    ];
    return list;
  }, [primaryCourse]);

  const [selectedCourse, setSelectedCourse] = useState(studentCourses[0].name);
  const [selectedSemester, setSelectedSemester] = useState<string>(
    user?.semester || '5º Semestre'
  );
  const [loading, setLoading] = useState(true);
  const [dbHistory, setDbHistory] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const targetRa = user?.ra || '24026851';
      const res = await studentsService.getStudentAcademicHistory(targetRa);
      if (res && res.history && res.history.length > 0) {
        setDbHistory(res.history);
      } else {
        const altRes = await studentsService.getStudentAcademicHistory('24018932');
        if (altRes && altRes.history && altRes.history.length > 0) {
          setDbHistory(altRes.history);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar histórico educacional:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Constrói a grade de disciplinas por Curso e Semestre
  const allCourseDisciplines: DisciplineData[] = useMemo(() => {
    const c1 = studentCourses[0].name;
    const c2 = studentCourses[1].name;
    const c3 = studentCourses[2].name;

    const baseList: DisciplineData[] = [
      // Curso 1 - vários semestres
      {
        courseName: c1,
        semestreLabel: '1º Semestre',
        disciplina: 'Lógica de Programação e Algoritmos',
        situacao: 'Aprovado',
        nota_obtida: 9.2,
        faltas_lancadas: 2,
      },
      {
        courseName: c1,
        semestreLabel: '1º Semestre',
        disciplina: 'Fundamentos de Matemática Discreta',
        situacao: 'Aprovado',
        nota_obtida: 8.4,
        faltas_lancadas: 4,
      },
      {
        courseName: c1,
        semestreLabel: '2º Semestre',
        disciplina: 'Estrutura de Dados e Complexidade',
        situacao: 'Aprovado',
        nota_obtida: 8.7,
        faltas_lancadas: 2,
      },
      {
        courseName: c1,
        semestreLabel: '2º Semestre',
        disciplina: 'Modelagem de Banco de Dados SQL',
        situacao: 'Aprovado',
        nota_obtida: 9.5,
        faltas_lancadas: 0,
      },
      {
        courseName: c1,
        semestreLabel: '3º Semestre',
        disciplina: 'Engenharia de Software & Métodos Ágeis',
        situacao: 'Aprovado',
        nota_obtida: 8.9,
        faltas_lancadas: 2,
      },
      {
        courseName: c1,
        semestreLabel: '4º Semestre',
        disciplina: 'Desenvolvimento Mobile Multiplataforma',
        situacao: 'Aprovado',
        nota_obtida: 9.4,
        faltas_lancadas: 0,
      },
      {
        courseName: c1,
        semestreLabel: '5º Semestre',
        disciplina: 'Arquitetura de Sistemas & Cloud Computing',
        situacao: 'Em Curso',
        nota_obtida: 8.8,
        faltas_lancadas: 2,
      },
      {
        courseName: c1,
        semestreLabel: '5º Semestre',
        disciplina: 'Inteligência Artificial & Machine Learning',
        situacao: 'Em Curso',
        nota_obtida: 9.1,
        faltas_lancadas: 0,
      },
      {
        courseName: c1,
        semestreLabel: '5º Semestre',
        disciplina: 'Segurança Cibernética e Governança de TI',
        situacao: 'Em Curso',
        nota_obtida: 8.3,
        faltas_lancadas: 4,
      },
      {
        courseName: c1,
        semestreLabel: '6º Semestre',
        disciplina: 'Projeto Interdisciplinar de Conclusão (TCC)',
        situacao: 'Matriculado',
        nota_obtida: 9.0,
        faltas_lancadas: 0,
      },

      // Curso 2 (Segundo curso atribuído ao aluno)
      {
        courseName: c2,
        semestreLabel: '1º Semestre',
        disciplina: 'Desenvolvimento Web Full-Stack',
        situacao: 'Aprovado',
        nota_obtida: 9.3,
        faltas_lancadas: 0,
      },
      {
        courseName: c2,
        semestreLabel: '2º Semestre',
        disciplina: 'APIs RESTful e Microsserviços',
        situacao: 'Aprovado',
        nota_obtida: 8.6,
        faltas_lancadas: 2,
      },
      {
        courseName: c2,
        semestreLabel: '3º Semestre',
        disciplina: 'DevOps, Containers & CI/CD',
        situacao: 'Em Curso',
        nota_obtida: 8.9,
        faltas_lancadas: 2,
      },
      {
        courseName: c2,
        semestreLabel: '5º Semestre',
        disciplina: 'UX/UI Design & Engenharia de Produto Digital',
        situacao: 'Em Curso',
        nota_obtida: 9.4,
        faltas_lancadas: 0,
      },

      // Curso 3 (Terceiro vínculo / trilha executiva)
      {
        courseName: c3,
        semestreLabel: '1º Semestre',
        disciplina: 'Mercado de Capitais e Valuation',
        situacao: 'Aprovado',
        nota_obtida: 8.5,
        faltas_lancadas: 2,
      },
      {
        courseName: c3,
        semestreLabel: '2º Semestre',
        disciplina: 'Análise Preditiva Aplicada a Finanças',
        situacao: 'Em Curso',
        nota_obtida: 9.0,
        faltas_lancadas: 0,
      },
    ];

    // Incorpora também as disciplinas vindas do Supabase no curso principal
    dbHistory.forEach((item, idx) => {
      baseList.push({
        courseName: c1,
        semestreLabel: idx % 2 === 0 ? '5º Semestre' : '4º Semestre',
        disciplina: item.disciplina || `Disciplina Curricular ${idx + 1}`,
        situacao: item.situacao || 'Em Curso',
        nota_obtida: Number(item.nota_obtida || 8.5),
        faltas_lancadas: Number(item.faltas_lancadas || 2),
      });
    });

    return baseList;
  }, [studentCourses, dbHistory]);

  // Filtra disciplinas pelo Curso selecionado e Semestre selecionado
  const filteredDisciplines = useMemo(() => {
    const byCourse = allCourseDisciplines.filter((d) => d.courseName === selectedCourse);
    if (selectedSemester === 'Todos') {
      return byCourse;
    }
    const bySem = byCourse.filter((d) => d.semestreLabel === selectedSemester);
    return bySem.length > 0 ? bySem : byCourse;
  }, [allCourseDisciplines, selectedCourse, selectedSemester]);

  const mediaCR =
    filteredDisciplines.length > 0
      ? (
          filteredDisciplines.reduce((acc, h) => acc + (Number(h.nota_obtida) || 0), 0) /
          filteredDisciplines.length
        ).toFixed(1)
      : '8.8';

  const totalFaltas = filteredDisciplines.reduce(
    (acc, h) => acc + (Number(h.faltas_lancadas) || 0),
    0
  );
  const frequenciaGlobal =
    Math.max(75, Math.min(100, Math.round(100 - totalFaltas * 1.5))) + '%';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <FadeInView delay={20} translateY={10}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Painel Educacional
                </Text>
                <Text style={[styles.subtitle, { color: colors.primary }]}>
                  {selectedCourse} • {selectedSemester}
                </Text>
              </View>
              <TouchableOpacity
                onPress={loadData}
                style={[styles.refreshBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <RefreshCw size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </FadeInView>

        {/* Seletor de Curso (Para alunos com mais de um curso atribuído) */}
        <FadeInView delay={60} translateY={10}>
          <View style={styles.selectorSection}>
            <View style={styles.selectorLabelRow}>
              <Layers size={15} color={colors.primary} />
              <Text style={[styles.selectorTitle, { color: colors.textPrimary }]}>
                Selecione o Curso Atribuído ({studentCourses.length} vínculos):
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.coursesScroll}
            >
              {studentCourses.map((c) => {
                const isSelected = selectedCourse === c.name;
                return (
                  <ScalePressable
                    key={c.id}
                    onPress={() => setSelectedCourse(c.name)}
                    style={[
                      styles.courseSelectorCard,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.courseSelectorTop}>
                      <GraduationCap
                        size={16}
                        color={isSelected ? '#FFFFFF' : colors.primary}
                      />
                      <Text
                        style={[
                          styles.courseCodePill,
                          { color: isSelected ? 'rgba(255,255,255,0.85)' : colors.textMuted },
                        ]}
                      >
                        {c.code}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.courseSelectorName,
                        { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                      ]}
                      numberOfLines={2}
                    >
                      {c.name}
                    </Text>
                    <Text
                      style={[
                        styles.courseSelectorSub,
                        { color: isSelected ? 'rgba(255,255,255,0.8)' : colors.textSecondary },
                      ]}
                    >
                      {c.degree}
                    </Text>
                  </ScalePressable>
                );
              })}
            </ScrollView>
          </View>
        </FadeInView>

        {/* Seletor de Semestre */}
        <FadeInView delay={100} translateY={10}>
          <View style={styles.selectorSection}>
            <View style={styles.selectorLabelRow}>
              <Calendar size={15} color={colors.primary} />
              <Text style={[styles.selectorTitle, { color: colors.textPrimary }]}>
                Semestre de Escolha:
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.semesterPillsRow}
            >
              {SEMESTERS.map((sem) => {
                const isSelected = selectedSemester === sem;
                return (
                  <TouchableOpacity
                    key={sem}
                    activeOpacity={0.75}
                    onPress={() => setSelectedSemester(sem)}
                    style={[
                      styles.semesterChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.semesterChipText,
                        { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {sem}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </FadeInView>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Sincronizando histórico acadêmico...
            </Text>
          </View>
        ) : (
          <>
            {/* Cards de Métricas do Curso e Semestre Selecionados */}
            <FadeInView delay={140} translateY={10}>
              <View style={styles.statsRow}>
                <View
                  style={[
                    styles.statCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Award size={22} color={colors.primary} />
                  <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{mediaCR}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Média Geral (CR)
                  </Text>
                </View>
                <View
                  style={[
                    styles.statCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <CheckCircle2 size={22} color={colors.secondary} />
                  <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
                    {frequenciaGlobal}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Frequência
                  </Text>
                </View>
                <View
                  style={[
                    styles.statCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <BookOpen size={22} color={colors.warning} />
                  <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
                    {filteredDisciplines.length}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Disciplinas
                  </Text>
                </View>
              </View>
            </FadeInView>

            {/* Lista de Disciplinas Filtradas */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Disciplinas & Notas ({selectedSemester})
              </Text>

              {filteredDisciplines.map((item, idx) => {
                const isReprovado = (item.situacao || '').toLowerCase().includes('reprov');
                const gradeColor =
                  Number(item.nota_obtida) >= 7.0
                    ? colors.primary
                    : isReprovado
                    ? '#DC2626'
                    : '#D97706';

                return (
                  <FadeInView key={`${item.disciplina}-${idx}`} delay={Math.min(idx * 45, 220)} translateY={10}>
                    <View
                      style={[
                        styles.courseCard,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                    >
                      <View style={styles.courseHeader}>
                        <Text style={[styles.courseCode, { color: colors.secondary }]}>
                          {item.semestreLabel.toUpperCase()} • DISC-0{idx + 1}
                        </Text>
                        <View
                          style={[
                            styles.badgeGrade,
                            {
                              backgroundColor: isReprovado ? '#FEE2E2' : colors.primaryLight,
                            },
                          ]}
                        >
                          <Text style={[styles.badgeGradeText, { color: gradeColor }]}>
                            Nota: {Number(item.nota_obtida).toFixed(1)}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.courseName, { color: colors.textPrimary }]}>
                        {item.disciplina}
                      </Text>
                      <Text style={[styles.professorText, { color: colors.textMuted }]}>
                        Curso: {item.courseName} • Carga Horária: 80h
                      </Text>

                      <View style={{ marginBottom: 10 }}>
                        <AnimatedProgressBar
                          progress={Number(item.nota_obtida) * 10}
                          color={gradeColor}
                          trackColor={colors.backgroundAlt}
                          height={6}
                        />
                      </View>

                      <View style={[styles.courseFooter, { borderTopColor: colors.border }]}>
                        <Text style={[styles.attendanceText, { color: colors.textSecondary }]}>
                          Faltas: {item.faltas_lancadas} h/a (Assiduidade Regular)
                        </Text>
                        <Text
                          style={[
                            styles.statusOkText,
                            { color: isReprovado ? '#DC2626' : colors.primary },
                          ]}
                        >
                          {item.situacao}
                        </Text>
                      </View>
                    </View>
                  </FadeInView>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    paddingBottom: 36,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorSection: {
    marginBottom: 16,
  },
  selectorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  selectorTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  coursesScroll: {
    gap: 10,
    paddingRight: 8,
  },
  courseSelectorCard: {
    width: 215,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
  },
  courseSelectorTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  courseCodePill: {
    fontSize: 10,
    fontWeight: '700',
  },
  courseSelectorName: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    marginBottom: 4,
  },
  courseSelectorSub: {
    fontSize: 10,
    fontWeight: '600',
  },
  semesterPillsRow: {
    gap: 8,
    paddingRight: 8,
  },
  semesterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  semesterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  courseCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  courseCode: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeGrade: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeGradeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  professorText: {
    fontSize: 11,
    marginBottom: 10,
  },
  courseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  attendanceText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusOkText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
