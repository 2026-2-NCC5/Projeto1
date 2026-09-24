import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, FileText, Download, Search, CheckCircle } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';
import { noticesService } from '../../services/supabase/noticesService';
import { useApp } from '../../store/AppContext';

export const MaterialsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { showToast } = useApp();
  const [materials, setMaterials] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [downloadedIds, setDownloadedIds] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const data = await noticesService.getAllMaterials();
      setMaterials(data);
    }
    load();
  }, []);

  const handleDownload = (id: string, title: string) => {
    setDownloadedIds((prev) => [...prev, id]);
    showToast(`Download de "${title}" iniciado!`, 'success');
  };

  const filteredMaterials = materials.filter(
    (m) =>
      m.title.toLowerCase().includes(filter.toLowerCase()) ||
      m.category.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ChevronLeft size={24} color={colors.secondary} />
          </TouchableOpacity>
          <Text style={styles.title}>Materiais e Editais (6)</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Busca */}
        <View style={styles.searchContainer}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Filtrar materiais ou categorias..."
            placeholderTextColor={colors.textMuted}
            value={filter}
            onChangeText={setFilter}
            style={styles.searchInput}
          />
        </View>

        {/* Lista */}
        <FlatList
          data={filteredMaterials}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isDownloaded = downloadedIds.includes(item.id);
            return (
              <View style={styles.materialCard}>
                <View style={styles.iconBox}>
                  <FileText size={24} color={colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.materialTitle}>{item.title}</Text>
                  <Text style={styles.materialMeta}>
                    {item.category} • {item.format} • {item.size}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleDownload(item.id, item.title)}
                  style={[styles.downloadButton, isDownloaded && styles.downloadedButton]}
                >
                  {isDownloaded ? (
                    <CheckCircle size={18} color={colors.primary} />
                  ) : (
                    <Download size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.pill,
    marginHorizontal: spacing.xxl,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.fontSizes.sm,
    color: colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  materialTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  materialMeta: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
  },
  downloadButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadedButton: {
    backgroundColor: colors.primaryLight,
  },
});
