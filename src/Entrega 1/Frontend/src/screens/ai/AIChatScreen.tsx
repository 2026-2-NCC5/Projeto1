import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Send, Sparkles, Bot, User, ArrowUpRight, Headphones } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '../../theme';
import { aiChatService, ChatMessage } from '../../services/ai-agent/aiChatService';

export const AIChatScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const initialPrompt = route.params?.initialPrompt;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: 'Olá! Sou o **SISA (Sistema Inteligente do Sucesso Alvarista) da FECAP**.\n\nEstou conectado ao motor oficial do **Groq (Qwen 27B)** e posso te informar horários de aulas, salas, laboratórios, professores e orientações detalhadas sobre abertura de requerimentos acadêmicos.\n\nComo posso te ajudar hoje?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickReplies: [
        'Quero os horários de CCOMP 4',
        'Como solicitar o Passe Escolar / SPTrans?',
        'Como pedir trancamento de curso e qual o prazo?',
      ],
    },
  ]);
  const [inputText, setInputText] = useState(initialPrompt || '');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (initialPrompt) {
      handleSendMessage(initialPrompt);
    }
  }, []);

  // Rolagem suave automática quando o teclado abre
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => sub.remove();
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await aiChatService.sendMessage(query, messages);
      setMessages((prev) => [...prev, response]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: 'Desculpe, ocorreu uma instabilidade momentânea ao processar sua dúvida. Por favor, tente novamente.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickReply = (text: string) => {
    handleSendMessage(text);
  };

  const handleActionPress = (action: any) => {
    if (action.route === 'RequirementsTab') {
      navigation.navigate('Home');
    } else if (action.route === 'DocumentsTab') {
      navigation.navigate('Arquivo');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : (StatusBar.currentHeight || 24)}
        style={styles.container}
      >
        {/* Header com espaçamento responsivo */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={24} color={colors.secondary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <View style={styles.aiBadge}>
              <Sparkles size={14} color={colors.primary} />
              <Text style={styles.aiBadgeText}>SISA FECAP Oficial</Text>
            </View>
            <Text style={styles.statusText}>
              Backend IA Conectado ({(process.env.EXPO_PUBLIC_GROQ_MODEL || 'Qwen 27B').split('/')[1] || 'Qwen 27B'})
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSendMessage('Quero falar com um atendente humano da CAA')}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Headphones size={20} color={colors.secondary} />
          </TouchableOpacity>
        </View>

        {/* Mensagens do Chat */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isUser = item.sender === 'user';
            return (
              <View
                style={[
                  styles.messageRow,
                  isUser ? styles.userMessageRow : styles.assistantMessageRow,
                ]}
              >
                {!isUser && (
                  <View style={styles.avatarAssistant}>
                    <Sparkles size={16} color="#FFFFFF" />
                  </View>
                )}
                <View style={styles.messageBubbleWrapper}>
                  <View
                    style={[
                      styles.bubble,
                      isUser ? styles.userBubble : styles.assistantBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isUser ? styles.userMessageText : styles.assistantMessageText,
                      ]}
                    >
                      {item.text}
                    </Text>
                  </View>

                  {/* Ação sugerida pela IA */}
                  {item.suggestedAction && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleActionPress(item.suggestedAction)}
                      style={styles.actionCard}
                    >
                      <View style={styles.actionCardContent}>
                        <Text style={styles.actionCardTitle}>{item.suggestedAction.label}</Text>
                        <Text style={styles.actionCardDesc}>Toque para acessar no aplicativo</Text>
                      </View>
                      <ArrowUpRight size={18} color={colors.primary} />
                    </TouchableOpacity>
                  )}

                  {/* Respostas Rápidas */}
                  {item.quickReplies && item.quickReplies.length > 0 && (
                    <View style={styles.quickRepliesContainer}>
                      {item.quickReplies.map((qr: string, idx: number) => (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.75}
                          onPress={() => handleQuickReply(qr)}
                          style={styles.quickReplyChip}
                        >
                          <Text style={styles.quickReplyText}>{qr}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            isTyping ? (
              <View style={styles.typingRow}>
                <View style={styles.avatarAssistant}>
                  <Sparkles size={16} color="#FFFFFF" />
                </View>
                <View style={styles.typingBubble}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.typingText}>IA pesquisando na base oficial...</Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* Input Bar que não fica sob o teclado */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <TextInput
            placeholder="Digite sua dúvida acadêmica..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            style={styles.inputField}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => handleSendMessage()}
          />
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim()}
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
          >
            <Send size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
    gap: 4,
    marginBottom: 2,
  },
  aiBadgeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.primaryDark,
  },
  statusText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  messagesList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    maxWidth: '90%',
  },
  userMessageRow: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  assistantMessageRow: {
    alignSelf: 'flex-start',
  },
  avatarAssistant: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  messageBubbleWrapper: {
    flex: 1,
  },
  bubble: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 2,
  },
  assistantBubble: {
    backgroundColor: colors.backgroundAlt,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  messageText: {
    fontSize: typography.fontSizes.sm,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeights.medium,
  },
  assistantMessageText: {
    color: colors.textPrimary,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionCardContent: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.primaryDark,
  },
  actionCardDesc: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quickRepliesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  quickReplyChip: {
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  quickReplyText: {
    fontSize: typography.fontSizes.xs,
    color: colors.secondary,
    fontWeight: typography.fontWeights.medium,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  typingText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: '#FFFFFF',
  },
  inputField: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontSize: typography.fontSizes.sm,
    color: colors.textPrimary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
});
