import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Star, CheckCircle2, MessageSquare, Sparkles, Send } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { feedbackService, FeedbackChannel, StudentFeedbackPayload } from '../../services/supabase/feedbackService';

interface SatisfactionRatingCardProps {
  sessionId: string;
  channel?: FeedbackChannel;
  staffName?: string;
  onFeedbackSubmitted?: (feedback: StudentFeedbackPayload) => void;
  compact?: boolean;
}

const POSITIVE_TAGS = [
  '⚡ Resposta Rápida',
  '🎯 Resolveu meu Problema',
  '💡 Explicação Clara',
  '🤝 Muito Atencioso',
];

const NEGATIVE_TAGS = [
  '⏳ Demorado',
  '❓ Dúvida Não Esclarecida',
  '🔄 Informação Confusa',
  '🤖 Prefiro Atendimento Humano',
];

export const SatisfactionRatingCard: React.FC<SatisfactionRatingCardProps> = ({
  sessionId,
  channel = 'Chat IA (SISA)',
  staffName,
  onFeedbackSubmitted,
  compact = false,
}) => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useApp();

  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [existingFeedback, setExistingFeedback] = useState<StudentFeedbackPayload | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const found = await feedbackService.getFeedbackForSession(sessionId);
        if (isMounted && found) {
          setExistingFeedback(found);
          setRating(found.rating);
          setSelectedTags(found.tags || []);
          setComment(found.comment || '');
        }
      } finally {
        if (isMounted) setCheckingExisting(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const toggleTag = (tag: string) => {
    if (existingFeedback) return;
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      showToast('Por favor, selecione uma nota de 1 a 5 estrelas.', 'info');
      return;
    }

    setLoading(true);
    try {
      const payload: StudentFeedbackPayload = {
        sessionId,
        channel,
        rating,
        studentId: user?.id,
        studentName: user?.name || 'Estudante Alvarista',
        studentRa: user?.ra || '24026851',
        comment: comment.trim(),
        tags: selectedTags,
      };

      const res = await feedbackService.submitFeedback(payload);
      if (res.success) {
        setExistingFeedback(payload);
        showToast('Avaliação enviada com sucesso! Obrigado pelo feedback.', 'success');
        if (onFeedbackSubmitted) onFeedbackSubmitted(payload);
      } else {
        showToast('Não foi possível registrar o feedback.', 'error');
      }
    } catch {
      showToast('Erro ao enviar avaliação.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (checkingExisting) {
    return null;
  }

  // 1. Estado Já Avaliado
  if (existingFeedback) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? 'rgba(5, 150, 105, 0.12)' : '#ECFDF5',
            borderColor: '#059669',
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.titleWithIcon}>
            <CheckCircle2 size={18} color="#059669" />
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Atendimento Avaliado
            </Text>
          </View>
          <View style={[styles.channelBadge, { backgroundColor: '#D1FAE5' }]}>
            <Text style={[styles.channelBadgeText, { color: '#059669' }]}>{channel}</Text>
          </View>
        </View>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={compact ? 20 : 24}
              color="#F59E0B"
              fill={star <= existingFeedback.rating ? '#F59E0B' : 'transparent'}
            />
          ))}
          <Text style={[styles.scoreSummaryText, { color: colors.textPrimary }]}>
            {existingFeedback.rating}.0 / 5.0
          </Text>
        </View>

        {existingFeedback.tags && existingFeedback.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {existingFeedback.tags.map((t, idx) => (
              <View
                key={idx}
                style={[
                  styles.tagPill,
                  { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: '#059669' },
                ]}
              >
                <Text style={[styles.tagPillText, { color: '#059669' }]}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {existingFeedback.comment ? (
          <Text style={[styles.submittedCommentText, { color: colors.textSecondary }]}>
            💬 "{existingFeedback.comment}"
          </Text>
        ) : null}

        <Text style={[styles.thankYouNote, { color: colors.textMuted }]}>
          Sua avaliação já foi computada nos indicadores de satisfação da FECAP.
        </Text>
      </View>
    );
  }

  // 2. Estado de Formulário de Avaliação Ativo
  const displayRating = hoverRating || rating;
  const ratingLabels: Record<number, string> = {
    1: 'Muito insatisfeito 😞',
    2: 'Insatisfeito 🙁',
    3: 'Neutro / Regular 😐',
    4: 'Satisfeito 😊',
    5: 'Excelente atendimento! 🌟',
  };

  const activeTags = displayRating >= 4 ? POSITIVE_TAGS : NEGATIVE_TAGS;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Sparkles size={16} color="#F59E0B" />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {channel === 'Atendimento Humano CAA'
              ? `Avalie seu atendimento com ${staffName || 'Central CAA'}`
              : 'Como foi sua experiência com a SISA?'}
          </Text>
        </View>
        <View style={[styles.channelBadge, { backgroundColor: colors.backgroundAlt }]}>
          <Text style={[styles.channelBadgeText, { color: colors.textSecondary }]}>{channel}</Text>
        </View>
      </View>

      <Text style={[styles.promptText, { color: colors.textSecondary }]}>
        Sua nota alimenta o indicador oficial de satisfação (CSAT) da FECAP.
      </Text>

      {/* Seletor de 5 Estrelas */}
      <View style={styles.interactiveStarsContainer}>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = star <= displayRating;
            return (
              <TouchableOpacity
                key={star}
                activeOpacity={0.7}
                onPress={() => setRating(star)}
                onPressIn={() => setHoverRating(star)}
                onPressOut={() => setHoverRating(0)}
                style={styles.starTouchTarget}
              >
                <Star
                  size={compact ? 28 : 34}
                  color={isFilled ? '#F59E0B' : isDark ? '#475569' : '#CBD5E1'}
                  fill={isFilled ? '#F59E0B' : 'transparent'}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {displayRating > 0 && (
          <Text style={[styles.ratingLabelText, { color: colors.primaryDark }]}>
            {ratingLabels[displayRating]}
          </Text>
        )}
      </View>

      {/* Chips Rápidos de Sentimento */}
      {displayRating > 0 && (
        <View style={styles.tagsSection}>
          <Text style={[styles.tagsSectionLabel, { color: colors.textSecondary }]}>
            O que mais se destacou? (opcional)
          </Text>
          <View style={styles.tagsContainer}>
            {activeTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  activeOpacity={0.75}
                  onPress={() => toggleTag(tag)}
                  style={[
                    styles.tagPill,
                    {
                      backgroundColor: isSelected
                        ? colors.primaryLight
                        : colors.backgroundAlt,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagPillText,
                      { color: isSelected ? colors.primaryDark : colors.textPrimary },
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Campo Opcional de Comentário */}
      {displayRating > 0 && !compact && (
        <View style={styles.commentContainer}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Deixe um comentário adicional sobre o atendimento (opcional)..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={2}
            style={[
              styles.commentInput,
              {
                backgroundColor: colors.backgroundAlt,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
        </View>
      )}

      {/* Botão de Envio */}
      {displayRating > 0 && (
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={loading}
          onPress={handleSubmit}
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Send size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.submitButtonText}>Confirmar Avaliação</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  channelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  channelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  promptText: {
    fontSize: 11,
    marginBottom: 10,
  },
  interactiveStarsContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  starTouchTarget: {
    padding: 4,
  },
  ratingLabelText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  scoreSummaryText: {
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
  tagsSection: {
    marginTop: 10,
  },
  tagsSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  commentContainer: {
    marginTop: 10,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    minHeight: 46,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  submittedCommentText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  thankYouNote: {
    fontSize: 10.5,
    marginTop: 6,
  },
});
