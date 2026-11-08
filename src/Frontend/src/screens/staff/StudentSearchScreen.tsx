import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Search,
  User,
  GraduationCap,
  Calendar,
  MapPin,
  DollarSign,
  BookOpen,
  Clock,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useApp } from '../../store/AppContext';
import {
  studentsService,
  StudentBase,
} from '../../services/supabase/studentsService';
import { FadeInView, ScalePressable } from '../../components/common/AnimatedComponents';
import { ChevronRight } from 'lucide-react-native';

export const StudentSearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const { showToast } = useApp();

  const [students, setStudents] = useState<StudentBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(392);
  const [metrics, setMetrics] = useState({ total: 392, matriculados: 352, formados: 20, evasao: 20 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchRefreshing, setSearchRefreshing] = useState(false);

  const fetchStudents = async (reset = false, newPage = 1) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    }
    try {
      const res = await studentsService.searchGeneralBase({
        query: searchQuery,
        status: selectedStatus,
        page: newPage,
        pageSize: 25,
      });

      if (reset) {
        setStudents(res.data);
      } else {
        setStudents((prev) => [...prev, ...res.data]);
      }

      setTotalCount(res.total);
      setHasMore(res.data.length === 25);
    } catch (e) {
      console.warn('Erro ao buscar alunos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Carrega métricas globais
    studentsService.getBaseMetrics().then(setMetrics);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(true, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedStatus]);

  const handleSearchRefresh = async () => {
    setSearchRefreshing(true);
    try {
      await Promise.all([
        studentsService.getBaseMetrics().then(setMetrics),
        fetchStudents(true, 1),
      ]);
    } finally {
      setSearchRefreshing(false);
    }
  };

  const handleOpenDossier = (student: StudentBase) => {
    navigation.navigate('StudentFullProfile', {
      student,
      ra: student.ra,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Matriculado':
        return {
          color: '#059669',
          bg: isDark ? 'rgba(5, 150, 105, 0.2)' : '#D1FAE5',
          label: 'Ativo / Matriculado',
        };
      case 'Formado':
        return {
          color: '#0284C7',
          bg: isDark ? 'rgba(2, 132, 199, 0.2)' : '#E0F2FE',
          label: 'Formado / Alum',
        };
      case 'Evasão':
      default:
        return {
          color: '#DC2626',
          bg: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2',
          label: 'Evasão / Trancado',
        };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Top Navbar */}
      <View style={[styles.navbar, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: topPadding + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Base Geral de Alunos</Text>
          <Text style={[styles.navSubtitle, { color: colors.textSecondary }]}>
            Toque em qualquer estudante para abrir a Tela de Perfil Completo & Requerimentos
          </Text>
        </View>
      </View>

      {/* Barra de Métricas */}
      <View style={[styles.metricsBanner, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setSelectedStatus('Todos')}
          style={[styles.metricItem, selectedStatus === 'Todos' && styles.metricItemActive]}
        >
          <Text style={[styles.metricVal, { color: colors.textPrimary }]}>{metrics.total}</Text>
          <Text style={[styles.metricTxt, { color: colors.textSecondary }]}>Total Base</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedStatus('Matriculado')}
          style={[styles.metricItem, selectedStatus === 'Matriculado' && styles.metricItemActive]}
        >
          <Text style={[styles.metricVal, { color: '#059669' }]}>{metrics.matriculados}</Text>
          <Text style={[styles.metricTxt, { color: colors.textSecondary }]}>Matriculados</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedStatus('Formado')}
          style={[styles.metricItem, selectedStatus === 'Formado' && styles.metricItemActive]}
        >
          <Text style={[styles.metricVal, { color: '#0284C7' }]}>{metrics.formados}</Text>
          <Text style={[styles.metricTxt, { color: colors.textSecondary }]}>Formados</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedStatus('Evasão')}
          style={[styles.metricItem, selectedStatus === 'Evasão' && styles.metricItemActive]}
        >
          <Text style={[styles.metricVal, { color: '#DC2626' }]}>{metrics.evasao}</Text>
          <Text style={[styles.metricTxt, { color: colors.textSecondary }]}>Evasão</Text>
        </TouchableOpacity>
      </View>

      {/* Campo de Busca */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Pesquisar por Nome, RA ou Curso..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholderTextColor={colors.textMuted}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Chips de Status */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {['Todos', 'Matriculado', 'Formado', 'Evasão'].map((st) => {
            const isSel = selectedStatus === st;
            return (
              <TouchableOpacity
                key={st}
                onPress={() => setSelectedStatus(st)}
                style={[
                  styles.chip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  isSel && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.textSecondary }, isSel && { color: '#FFFFFF', fontWeight: '700' }]}>
                  {st === 'Todos' ? `Todos os Registros (${totalCount})` : st}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Lista de Alunos */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingLabel, { color: colors.textSecondary }]}>Consultando banco Supabase...</Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (hasMore && !loading) {
              const next = page + 1;
              setPage(next);
              fetchStudents(false, next);
            }
          }}
          onEndReachedThreshold={0.3}
          renderItem={({ item, index }) => {
            const badge = getStatusBadge(item.status_academico);

            return (
              <FadeInView delay={Math.min(index * 30, 180)} translateY={10}>
                <ScalePressable
                  onPress={() => handleOpenDossier(item)}
                  style={[styles.studentCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.studentCardHeader}>
                    <View style={[styles.avatarBox, { backgroundColor: colors.primary }]}>
                      {item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarInitialTxt}>
                          {item.name ? item.name.split(' ').filter(Boolean).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join('') : 'AL'}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.studentCardName, { color: colors.textPrimary }]}>{item.name}</Text>
                      <Text style={[styles.studentCardCourse, { color: colors.textSecondary }]}>
                        {item.course} • {item.semestre || 'Semestre Regular'}
                      </Text>
                    </View>
                    <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgePillText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  </View>

                  <View style={[styles.studentCardMeta, { borderTopColor: colors.borderLight }]}>
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>
                      RA: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{item.ra}</Text>
                    </Text>
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>
                      Turno: {item.turno || 'Noturno'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                        Ver Perfil Completo
                      </Text>
                      <ChevronRight size={13} color={colors.primary} />
                    </View>
                  </View>
                </ScalePressable>
              </FadeInView>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <AlertCircle size={36} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nenhum registro encontrado</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Nenhum aluno com os critérios selecionados na base institucional.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderRadius: 8,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  navSubtitle: {
    fontSize: 11,
  },
  metricsBanner: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
  },
  metricItemActive: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  metricTxt: {
    fontSize: 10,
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 11,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingLabel: {
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  studentCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  studentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarInitialTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  studentCardName: {
    fontSize: 14,
    fontWeight: '700',
  },
  studentCardCourse: {
    fontSize: 11,
    marginTop: 2,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  studentCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  metaText: {
    fontSize: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 18,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 11,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  modalBody: {
    padding: 16,
  },
  dossierProfileBox: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  dossierName: {
    fontSize: 16,
    fontWeight: '800',
  },
  dossierRA: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  dossierCourse: {
    fontSize: 12,
    marginTop: 2,
  },
  dossierSection: {
    marginBottom: 14,
  },
  dossierSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  dossierInfoGrid: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  infoRow: {
    fontSize: 11,
    lineHeight: 16,
  },
  dossierRiskBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  riskExpl: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  riskRecom: {
    fontSize: 11,
    fontWeight: '700',
  },
  finCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
  },
  finServico: {
    fontSize: 11,
  },
  finValor: {
    fontSize: 11,
    fontWeight: '700',
  },
  histCard: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
  },
  histDisc: {
    fontSize: 12,
    fontWeight: '600',
  },
  histMeta: {
    fontSize: 10,
    marginTop: 2,
  },
});
