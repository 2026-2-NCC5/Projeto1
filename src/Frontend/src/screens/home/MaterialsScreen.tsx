import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  FileText,
  Download,
  Search,
  CheckCircle,
  Bell,
  Sparkles,
  Calendar,
  User,
  X,
  Share2,
  Users,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { noticesService, FullNoticeItem, isNoticeRelevantForStudent } from '../../services/supabase/noticesService';
import { storageService } from '../../services/supabase/storageService';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { FadeInView, ScalePressable } from '../../components/common/AnimatedComponents';

export const MaterialsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const { showToast } = useApp();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'notices' | 'materials'>('notices');
  const [notices, setNotices] = useState<FullNoticeItem[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [downloadedIds, setDownloadedIds] = useState<string[]>([]);

  // Modal para leitura do aviso completo
  const [selectedNotice, setSelectedNotice] = useState<FullNoticeItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    async function load() {
      const [noticesData, materialsData] = await Promise.all([
        noticesService.getNotices(),
        noticesService.getAllMaterials(),
      ]);
      setNotices(noticesData);
      setMaterials(materialsData);
    }
    load();

    const unsubscribe = noticesService.subscribeToNotices((fresh) => {
      setNotices(fresh);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleDownloadMaterial = async (item: any) => {
    setDownloadedIds((prev) => [...prev, item.id]);

    const ok = await storageService.downloadOriginalDocument({
      id: item.id,
      title: item.title,
      fileName: item.fileName,
      url: item.url,
    });

    if (ok) {
      showToast(`Download integral do PDF original "${item.fileName || item.title}" iniciado!`, 'success');
    } else {
      showToast('Não foi possível abrir o PDF original no momento.', 'error');
    }
  };

  const handleOpenNotice = (item: FullNoticeItem) => {
    setSelectedNotice(item);
    setModalVisible(true);
  };

  const filteredNotices = notices.filter((n) => {
    if (user?.role === 'Aluno' && !isNoticeRelevantForStudent(n, user)) {
      return false;
    }
    const matchesQuery =
      n.title.toLowerCase().includes(filter.toLowerCase()) ||
      n.summary.toLowerCase().includes(filter.toLowerCase());
    const matchesCat = selectedCategory === 'Todos' || n.category === selectedCategory;
    return matchesQuery && matchesCat;
  });

  const filteredMaterials = materials.filter(
    (m) =>
      m.title.toLowerCase().includes(filter.toLowerCase()) ||
      m.category.toLowerCase().includes(filter.toLowerCase())
  );

  const noticeCategories = ['Todos', 'Carreira', 'Acadêmico', 'Benefícios', 'Financeiro'];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
          >
            <ChevronLeft size={24} color={colors.secondary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Mural & Acervo Alvarista</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabsContainer, { backgroundColor: colors.backgroundAlt }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('notices')}
            style={[styles.tabButton, activeTab === 'notices' && [styles.tabButtonActive, { backgroundColor: colors.card }]]}
          >
            <Bell size={16} color={activeTab === 'notices' ? colors.primary : colors.textMuted} />
            <Text
              style={[
                styles.tabButtonText,
                { color: colors.textSecondary },
                activeTab === 'notices' && { color: colors.primary, fontWeight: '700' },
              ]}
            >
              Mural de Avisos ({notices.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('materials')}
            style={[styles.tabButton, activeTab === 'materials' && [styles.tabButtonActive, { backgroundColor: colors.card }]]}
          >
            <FileText size={16} color={activeTab === 'materials' ? colors.primary : colors.textMuted} />
            <Text
              style={[
                styles.tabButtonText,
                { color: colors.textSecondary },
                activeTab === 'materials' && { color: colors.primary, fontWeight: '700' },
              ]}
            >
              DocumentosASA ({materials.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Barra de Busca */}
        <View style={[styles.searchContainer, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            placeholder={activeTab === 'notices' ? 'Buscar comunicados ou temas...' : 'Filtrar documentos oficiais por título...'}
            placeholderTextColor={colors.textMuted}
            value={filter}
            onChangeText={setFilter}
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
        </View>

        {/* Chips de Categoria para Avisos (SEM EFEITO DE ESTIRAMENTO) */}
        {activeTab === 'notices' && (
          <View style={styles.categoriesWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScrollContent}
            >
              {noticeCategories.map((cat) => {
                const isSel = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    activeOpacity={0.7}
                    onPress={() => setSelectedCategory(cat)}
                    style={[
                      styles.categoryChip,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      isSel && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: colors.textSecondary },
                        isSel && { color: '#FFFFFF', fontWeight: '700' },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Conteúdo: Avisos ou Materiais */}
        {activeTab === 'notices' ? (
          <FlatList
            data={filteredNotices}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <FadeInView delay={Math.min(index * 45, 250)} translateY={12}>
                <ScalePressable
                  onPress={() => handleOpenNotice(item)}
                  style={[styles.noticeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.noticeCardImage}
                      resizeMode="cover"
                    />
                  ) : null}

                  <View style={styles.noticeCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                      <View style={[styles.noticeBadge, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.noticeBadgeText, { color: colors.primaryDark }]}>
                          {item.badge || 'Informativo'}
                        </Text>
                      </View>
                      {item.target_audience && item.target_audience !== 'Todos' && item.target_audience !== 'Aluno' ? (
                        <View style={[styles.targetAudienceBadge, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                          <Users size={10} color={colors.primary} />
                          <Text style={[styles.targetAudienceBadgeText, { color: colors.textSecondary }]}>
                            {item.target_audience}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.noticeCategory, { color: colors.textMuted }]}>{item.category}</Text>
                  </View>

                  <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[styles.noticeSummary, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.summary}
                  </Text>

                  <View style={[styles.noticeCardFooter, { borderTopColor: colors.border }]}>
                    <View style={styles.authorRow}>
                      <User size={12} color={colors.textMuted} />
                      <Text style={[styles.noticeAuthor, { color: colors.textMuted }]}>
                        {item.author || 'Secretaria ASA'}
                      </Text>
                    </View>
                    <View style={styles.dateRow}>
                      <Calendar size={12} color={colors.textMuted} />
                      <Text style={[styles.noticeDate, { color: colors.textMuted }]}>{item.date}</Text>
                    </View>
                  </View>
                </ScalePressable>
              </FadeInView>
            )}
          />
        ) : (
          <FlatList
            data={filteredMaterials}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const isDownloaded = downloadedIds.includes(item.id);
              return (
                <FadeInView delay={Math.min(index * 40, 240)} translateY={12}>
                  <ScalePressable
                    onPress={() => handleDownloadMaterial(item)}
                    style={[styles.materialCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
                      <FileText size={24} color={colors.primary} />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={[styles.materialTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                      <Text style={[styles.materialMeta, { color: colors.textMuted }]}>
                        {item.fileName || item.category} • {item.format} • {item.size}
                      </Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleDownloadMaterial(item)}
                      style={[styles.downloadButton, { backgroundColor: colors.primary }, isDownloaded && { backgroundColor: colors.primaryLight }]}
                    >
                      {isDownloaded ? (
                        <CheckCircle size={18} color={colors.primary} />
                      ) : (
                        <Download size={18} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </ScalePressable>
                </FadeInView>
              );
            }}
          />
        )}
      </View>

      {/* Modal de Detalhes do Aviso */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={[styles.noticeBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.noticeBadgeText, { color: colors.primaryDark }]}>
                  {selectedNotice?.badge || 'Comunicado Oficial'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedNotice?.imageUrl ? (
                <Image
                  source={{ uri: selectedNotice.imageUrl }}
                  style={styles.modalNoticeImage}
                  resizeMode="cover"
                />
              ) : null}

              <Text style={[styles.modalNoticeTitle, { color: colors.textPrimary }]}>
                {selectedNotice?.title}
              </Text>

              <View style={styles.modalMetaRow}>
                <Text style={[styles.modalMetaItem, { color: colors.textMuted }]}>
                  📅 {selectedNotice?.date} • 🏛️ {selectedNotice?.author || 'Secretaria ASA'}
                </Text>
                {selectedNotice?.target_audience && selectedNotice.target_audience !== 'Todos' && selectedNotice.target_audience !== 'Aluno' ? (
                  <Text style={[styles.modalMetaCategory, { color: colors.primary }]}>
                    🎯 Público-Alvo: {selectedNotice.target_audience}
                  </Text>
                ) : null}
                <Text style={[styles.modalMetaCategory, { color: colors.primary }]}>
                  Categoria: {selectedNotice?.category}
                </Text>
              </View>

              <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

              <Text style={[styles.modalContentText, { color: colors.textPrimary }]}>
                {selectedNotice?.content || selectedNotice?.summary}
              </Text>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setModalVisible(false)}
                style={[styles.modalCloseButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.modalCloseButtonText}>Fechar Comunicado</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 16,
    height: 44,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
  },
  categoriesWrapper: {
    height: 40,
    marginBottom: 10,
  },
  categoriesScrollContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'center',
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  noticeCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  noticeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noticeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  noticeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  targetAudienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  targetAudienceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  noticeCategory: {
    fontSize: 11,
    fontWeight: '600',
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeSummary: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  noticeCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noticeAuthor: {
    fontSize: 10,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noticeDate: {
    fontSize: 10,
  },
  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardInfo: {
    flex: 1,
    marginRight: 10,
  },
  materialTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  materialMeta: {
    fontSize: 11,
  },
  downloadButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 18,
    maxHeight: '80%',
    overflow: 'hidden',
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalBody: {
    padding: 16,
  },
  modalNoticeImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
  },
  noticeCardImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginBottom: 12,
  },
  modalNoticeTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalMetaRow: {
    gap: 2,
    marginBottom: 10,
  },
  modalMetaItem: {
    fontSize: 11,
  },
  modalMetaCategory: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalDivider: {
    height: 1,
    marginVertical: 10,
  },
  modalContentText: {
    fontSize: 13,
    lineHeight: 21,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  modalCloseButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
