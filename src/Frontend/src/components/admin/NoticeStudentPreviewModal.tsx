import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { X, Eye, Sparkles, Building2, Calendar, UserCheck, CheckCircle2, Users } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { FullNoticeItem } from '../../services/supabase/noticesService';

const { width } = Dimensions.get('window');

interface NoticeStudentPreviewModalProps {
  visible: boolean;
  notice: FullNoticeItem | null;
  onClose: () => void;
}

export const NoticeStudentPreviewModal: React.FC<NoticeStudentPreviewModalProps> = ({
  visible,
  notice,
  onClose,
}) => {
  const { colors, isDark } = useTheme();

  if (!notice) return null;

  const imgSource = notice.imageUrl ? { uri: notice.imageUrl } : notice.imageSource;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: isDark ? colors.card : '#FFFFFF' }]}>
          {/* Header da Pré-visualização */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={[styles.previewIconBox, { backgroundColor: colors.primaryLight }]}>
                <Eye size={18} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  Visão do Estudante (Mural ASA)
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  Pré-visualização fiel de como este card e imagem aparecem no app do aluno
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* 1. Visão do Card no Carrossel da Home */}
            <View style={styles.sectionHeaderRow}>
              <Sparkles size={14} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                1. No Carrossel da Tela Inicial do Aluno
              </Text>
            </View>

            <View style={[styles.carouselCardPreview, { backgroundColor: '#0F172A' }]}>
              <View style={styles.imageBox}>
                <Image
                  source={imgSource}
                  style={styles.imageCover}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.carouselCaption}>
                <Text style={styles.carouselCaptionCategory}>
                  {notice.category} • {notice.date}
                </Text>
                <Text style={styles.carouselCaptionTitle} numberOfLines={2}>
                  {notice.title}
                </Text>
              </View>
            </View>

            {/* 2. Visão Detalhada quando o Aluno Clica */}
            <View style={[styles.sectionHeaderRow, { marginTop: 22 }]}>
              <Eye size={14} color={colors.secondary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                2. Visualização Completa ao Tocar no Comunicado
              </Text>
            </View>

            <View
              style={[
                styles.fullNoticeCard,
                {
                  backgroundColor: isDark ? colors.backgroundAlt : '#F8FAFC',
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Imagem em Tamanho Adaptável Completo sem Cortes */}
              <View style={styles.fullImageWrapper}>
                <Image
                  source={imgSource}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.noticeBody}>
                <View style={styles.badgeRow}>
                  <View style={[styles.badgePill, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.badgeText, { color: colors.primaryDark }]}>
                      {notice.badge || notice.category}
                    </Text>
                  </View>
                  <View style={[styles.audienceBadgePill, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
                    <Users size={11} color={colors.primary} />
                    <Text style={[styles.audienceBadgeText, { color: colors.textSecondary }]}>
                      {notice.target_audience || 'Todos os Alunos'}
                    </Text>
                  </View>
                  <Text style={[styles.dateText, { color: colors.textMuted }]}>
                    {notice.date}
                  </Text>
                </View>

                <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>
                  {notice.title}
                </Text>

                <View style={styles.authorRow}>
                  <Building2 size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.authorText, { color: colors.textSecondary }]}>
                    {notice.author || 'Secretaria Geral ASA FECAP'}
                  </Text>
                </View>

                <Text style={[styles.noticeSummary, { color: colors.textPrimary }]}>
                  {notice.summary}
                </Text>

                {notice.content && notice.content !== notice.summary ? (
                  <Text style={[styles.noticeContent, { color: colors.textSecondary }]}>
                    {notice.content}
                  </Text>
                ) : null}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.primary }]}
            >
              <CheckCircle2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.closeBtnText}>Entendi, está de acordo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  previewIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  scrollContent: {
    padding: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  carouselCardPreview: {
    width: 260,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  imageBox: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCover: {
    width: '100%',
    height: '100%',
  },
  carouselCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  carouselCaptionCategory: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  carouselCaptionTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    lineHeight: 14,
  },
  fullNoticeCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fullImageWrapper: {
    width: '100%',
    height: 190,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  noticeBody: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  audienceBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  audienceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 4,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  authorText: {
    fontSize: 11,
    fontWeight: '500',
  },
  noticeSummary: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  noticeContent: {
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
