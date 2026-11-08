import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Sparkles, MessageSquarePlus, Bot, Edit3, Plus, Trash2, X, Check, RotateCcw } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { quickSuggestionsService } from '../../services/ai-agent/quickSuggestionsService';
import AiOrbSvg from '../../assets/illustrations/ai_orb.svg';

const { width } = Dimensions.get('window');
const orbWidth = Math.min(width * 0.75, 300);
const orbHeight = Math.round(orbWidth * (378 / 397));

export const AIAssistantScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();
  const { user, selectedRole } = useAuth();
  const { showToast } = useApp();
  const currentRole = user?.role || selectedRole || 'Aluno';
  const isStaff = currentRole === 'Funcionário';
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editableList, setEditableList] = useState<string[]>([]);
  const [newSuggestionInput, setNewSuggestionInput] = useState('');
  const [targetEditRole, setTargetEditRole] = useState<'Aluno' | 'Funcionário'>('Aluno');

  const loadSuggestions = useCallback(async () => {
    const list = await quickSuggestionsService.getSuggestions(currentRole);
    setSuggestions(list);
  }, [currentRole]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  useFocusEffect(
    useCallback(() => {
      loadSuggestions();
    }, [loadSuggestions])
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const handleStartChat = (initialPrompt?: string) => {
    navigation.navigate('AIChat', { initialPrompt });
  };

  const handleOpenEditModal = async () => {
    const initialTarget = isStaff ? 'Aluno' : currentRole as any;
    setTargetEditRole(initialTarget);
    const current = await quickSuggestionsService.getSuggestions(initialTarget);
    setEditableList([...current]);
    setEditModalVisible(true);
  };

  const handleChangeTargetRole = async (role: 'Aluno' | 'Funcionário') => {
    setTargetEditRole(role);
    const current = await quickSuggestionsService.getSuggestions(role);
    setEditableList([...current]);
  };

  const handleAddSuggestion = () => {
    const trimmed = newSuggestionInput.trim();
    if (!trimmed) return;
    if (editableList.includes(trimmed)) {
      showToast('Esta sugestão já está na lista.', 'info');
      return;
    }
    setEditableList((prev) => [...prev, trimmed]);
    setNewSuggestionInput('');
  };

  const handleRemoveSuggestion = (index: number) => {
    setEditableList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveSuggestions = async () => {
    if (editableList.length === 0) {
      Alert.alert('Lista vazia', 'Adicione pelo menos uma sugestão antes de salvar.');
      return;
    }
    const success = await quickSuggestionsService.saveSuggestions(targetEditRole, editableList);
    if (success) {
      showToast(`Sugestões para ${targetEditRole} atualizadas!`, 'success');
      setEditModalVisible(false);
      loadSuggestions();
    } else {
      showToast('Erro ao salvar sugestões.', 'error');
    }
  };

  const handleResetSuggestions = async () => {
    const defaults = await quickSuggestionsService.resetDefaults(targetEditRole);
    setEditableList([...defaults]);
    showToast('Sugestões restauradas para o padrão oficial.', 'info');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.container}>
        {/* Orbe Central com Animação Pulsante */}
        <View style={styles.orbSection}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleStartChat()}
            style={styles.orbTouchable}
          >
            <Animated.View
              style={[
                styles.orbGlowWrapper,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <AiOrbSvg width={orbWidth} height={orbHeight} />
            </Animated.View>
          </TouchableOpacity>

          {/* Título Oficial da Tela */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {currentRole === 'Funcionário'
              ? 'Agente Analítico de\nPermanência Estudantil'
              : 'Como posso te\najudar hoje?'}
          </Text>
        </View>

        {/* Sugestões Rápidas de Prompt */}
        <View style={styles.suggestionsSection}>
          <View style={styles.suggestionsHeaderRow}>
            <Text style={[styles.suggestionsLabel, { color: colors.textMuted }]}>
              Sugestões rápidas:
            </Text>
            {isStaff && (
              <TouchableOpacity
                onPress={handleOpenEditModal}
                style={[styles.editSuggestionsBtn, { backgroundColor: colors.secondaryLight }]}
                activeOpacity={0.7}
              >
                <Edit3 size={13} color={colors.secondary} style={{ marginRight: 4 }} />
                <Text style={[styles.editSuggestionsBtnText, { color: colors.secondary }]}>
                  Editar Sugestões
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.chipsContainer}>
            {suggestions.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                onPress={() => handleStartChat(item)}
                style={[styles.chip, { backgroundColor: colors.secondaryLight, borderColor: colors.secondaryMuted }]}
              >
                <Sparkles size={14} color={colors.secondary} style={{ marginRight: 6 }} />
                <Text style={[styles.chipText, { color: colors.secondary }]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Botão de Iniciar Chat */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleStartChat()}
            style={[styles.chatButton, { backgroundColor: colors.primary }]}
          >
            <MessageSquarePlus size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.chatButtonText}>Abrir Chat Conversacional</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal de Edição de Sugestões Rápidas (Início de Semestre, etc.) */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: isDark ? colors.card : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Editar Sugestões Rápidas
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Personalize as dúvidas frequentes (ex: Início de Semestre, Rematrícula, Provas)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Alternância de Perfil Aluno / Funcionário */}
            <View style={styles.roleToggleRow}>
              <TouchableOpacity
                onPress={() => handleChangeTargetRole('Aluno')}
                style={[
                  styles.roleTogglePill,
                  targetEditRole === 'Aluno'
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                ]}
              >
                <Text
                  style={[
                    styles.roleToggleText,
                    { color: targetEditRole === 'Aluno' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  Para Alunos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleChangeTargetRole('Funcionário')}
                style={[
                  styles.roleTogglePill,
                  targetEditRole === 'Funcionário'
                    ? { backgroundColor: colors.secondary }
                    : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                ]}
              >
                <Text
                  style={[
                    styles.roleToggleText,
                    { color: targetEditRole === 'Funcionário' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  Para Funcionários
                </Text>
              </TouchableOpacity>
            </View>

            {/* Campo para Nova Sugestão */}
            <View style={styles.addInputRow}>
              <TextInput
                style={[
                  styles.addInput,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="Ex: Como pedir dispensa no início de semestre?"
                placeholderTextColor={colors.textSecondary}
                value={newSuggestionInput}
                onChangeText={setNewSuggestionInput}
                onSubmitEditing={handleAddSuggestion}
              />
              <TouchableOpacity
                onPress={handleAddSuggestion}
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
              >
                <Plus size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Lista de Sugestões Ativas */}
            <ScrollView style={{ maxHeight: 240, marginVertical: 12 }}>
              {editableList.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.suggestionItemRow,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
                    },
                  ]}
                >
                  <Sparkles size={14} color={colors.secondary} style={{ marginRight: 8 }} />
                  <Text style={[styles.suggestionItemText, { color: colors.textPrimary }]}>{item}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveSuggestion(idx)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ padding: 4 }}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {/* Ações do Modal */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                onPress={handleResetSuggestions}
                style={[styles.resetBtn, { borderColor: colors.border }]}
              >
                <RotateCcw size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[styles.resetBtnText, { color: colors.textSecondary }]}>Restaurar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveSuggestions}
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              >
                <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>Salvar Sugestões</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  orbSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  orbGlowWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
  },
  suggestionsSection: {
    marginBottom: 16,
  },
  suggestionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  suggestionsLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editSuggestionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  editSuggestionsBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#00B074',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  roleToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  roleTogglePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  suggestionItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
