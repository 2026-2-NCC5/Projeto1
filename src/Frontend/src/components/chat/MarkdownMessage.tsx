import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Sparkles, FileText, CheckCircle2, AlertCircle, Info, ExternalLink } from 'lucide-react-native';

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, isUser = false }) => {
  const { colors, typography, isDark } = useTheme();

  if (isUser) {
    return (
      <Text style={[styles.userText, { color: colors.userBubbleText }]}>
        {content}
      </Text>
    );
  }

  // Parser robusto para renderização rica de Markdown, incluindo tabelas, títulos, listas e callouts
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];

  let currentParagraph: string[] = [];
  let tableRows: string[][] = [];
  let isParsingTable = false;

  const flushParagraph = (keyPrefix: string) => {
    if (currentParagraph.length > 0) {
      const fullText = currentParagraph.join(' ').trim();
      if (fullText) {
        renderedElements.push(
          <Text key={`${keyPrefix}-${renderedElements.length}`} style={[styles.paragraph, { color: colors.textPrimary }]}>
            {parseInlineStyles(fullText, colors, isDark)}
          </Text>
        );
      }
      currentParagraph = [];
    }
  };

  const flushTable = (keyPrefix: string) => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const dataRows = tableRows.slice(1);

      renderedElements.push(
        <View
          key={`${keyPrefix}-${renderedElements.length}`}
          style={[
            styles.tableWrapper,
            {
              backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          {/* Cabeçalho da Tabela */}
          <View
            style={[
              styles.tableHeaderRow,
              {
                backgroundColor: isDark ? 'rgba(0, 201, 136, 0.15)' : colors.primaryLight,
                borderBottomColor: isDark ? '#334155' : '#CBD5E1',
              },
            ]}
          >
            {headers.map((h, colIdx) => (
              <View
                key={`th-${colIdx}`}
                style={[
                  styles.tableCell,
                  colIdx === 0 ? { flex: 1.1 } : colIdx === 2 ? { flex: 1.8 } : { flex: 1.3 },
                ]}
              >
                <Text
                  style={[
                    styles.tableHeaderText,
                    { color: isDark ? colors.primary : colors.primaryDark },
                  ]}
                  numberOfLines={2}
                >
                  {h.trim()}
                </Text>
              </View>
            ))}
          </View>

          {/* Linhas de Dados */}
          {dataRows.map((row, rowIdx) => (
            <View
              key={`tr-${rowIdx}`}
              style={[
                styles.tableDataRow,
                {
                  backgroundColor:
                    rowIdx % 2 === 1
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.03)'
                        : 'rgba(0, 0, 0, 0.02)'
                      : 'transparent',
                  borderBottomColor:
                    rowIdx === dataRows.length - 1 ? 'transparent' : isDark ? '#334155' : '#E2E8F0',
                },
              ]}
            >
              {row.map((cell, colIdx) => (
                <View
                  key={`td-${rowIdx}-${colIdx}`}
                  style={[
                    styles.tableCell,
                    colIdx === 0 ? { flex: 1.1 } : colIdx === 2 ? { flex: 1.8 } : { flex: 1.3 },
                  ]}
                >
                  <Text
                    style={[
                      styles.tableCellText,
                      colIdx === 0 && styles.tableCellPrimary,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {parseInlineStyles(cell.trim(), colors, isDark)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
      tableRows = [];
      isParsingTable = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Detecção de linha de Tabela Markdown (ex: | Dia | Horário | Disciplina |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushParagraph(`p-${index}`);

      // Ignora linha de separação Markdown (ex: |---|---|---|)
      if (/^\|(\s*:?-+:?\s*\|)+$/.test(trimmed)) {
        return;
      }

      const columns = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      tableRows.push(columns);
      isParsingTable = true;
      return;
    } else if (isParsingTable) {
      // Saiu do bloco de tabela
      flushTable(`table-${index}`);
    }

    // Linha vazia
    if (!trimmed) {
      flushParagraph(`p-${index}`);
      return;
    }

    // Título H1, H2 ou H3 (ex: # Título ou ## Título ou ### Título)
    if (trimmed.startsWith('### ') || trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      flushParagraph(`p-${index}`);
      const titleText = trimmed.replace(/^#{1,3}\s+/, '');
      const isScheduleHeader = titleText.includes('📅') || titleText.includes('Turma') || titleText.includes('Grade');

      renderedElements.push(
        <View key={`heading-${index}`} style={styles.headingContainer}>
          <View style={styles.headingTitleRow}>
            <Text style={[styles.headingText, { color: isScheduleHeader ? colors.primaryDark : colors.primaryDark }]}>
              {parseInlineStyles(titleText, colors, isDark)}
            </Text>
          </View>
          <View style={[styles.headingDivider, { backgroundColor: isDark ? colors.border : colors.primaryLight }]} />
        </View>
      );
      return;
    }

    // Callout / Citação (ex: > texto ou 📌 Fonte: ...)
    if (trimmed.startsWith('> ') || trimmed.startsWith('📌 Fonte:') || trimmed.startsWith('📌 **Fonte**:')) {
      flushParagraph(`p-${index}`);
      const quoteText = trimmed.replace(/^>\s*/, '');
      const isSource = quoteText.includes('Fonte:');

      renderedElements.push(
        <View
          key={`quote-${index}`}
          style={[
            styles.calloutBox,
            {
              backgroundColor: isDark ? 'rgba(0, 201, 136, 0.1)' : colors.primaryLight,
              borderColor: colors.primary,
            },
          ]}
        >
          {isSource ? (
            <View key="callout-src" style={{ marginTop: 2, marginRight: 6 }}><Sparkles size={14} color={colors.primary} /></View>
          ) : (
            <View key="callout-info" style={{ marginTop: 2, marginRight: 6 }}><Info size={14} color={colors.primary} /></View>
          )}
          <Text style={[styles.calloutText, { color: isDark ? colors.textPrimary : colors.primaryDark }]}>
            {parseInlineStyles(quoteText, colors, isDark)}
          </Text>
        </View>
      );
      return;
    }

    // Item de Lista com Bullets (•, -, *)
    if (trimmed.match(/^([•\-\*]|\d+\.)\s+/)) {
      flushParagraph(`p-${index}`);
      const isNumbered = trimmed.match(/^(\d+)\.\s+(.*)$/);
      let bulletLabel = '•';
      let itemText = trimmed.replace(/^([•\-\*]|\d+\.)\s+/, '');

      if (isNumbered) {
        bulletLabel = `${isNumbered[1]}.`;
        itemText = isNumbered[2];
      }

      // Detecção se é item de dia/horário de aula (ex: • Segunda (19h15 - 22h45): ...)
      const isDayItem = /^(Segunda|Terça|Terca|Quarta|Quinta|Sexta|Sábado|Sabado)/i.test(itemText.replace(/\*\*/g, ''));

      renderedElements.push(
        <View key={`list-${index}`} style={[styles.listItemRow, isDayItem && styles.dayListItemRow]}>
          <View
            style={[
              styles.bulletCircle,
              isNumbered && styles.numberedCircle,
              isDayItem && { backgroundColor: isDark ? 'rgba(0,201,136,0.2)' : colors.primaryLight },
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <Text style={[styles.bulletText, { color: colors.primaryDark }]}>{bulletLabel}</Text>
          </View>
          <Text style={[styles.listItemText, { color: colors.textPrimary }]}>
            {parseInlineStyles(itemText, colors, isDark)}
          </Text>
        </View>
      );
      return;
    }

    // Sub-item indentado (ex: - Subitem ou   • Subitem)
    if (line.startsWith('  -') || line.startsWith('    •') || line.startsWith('  •') || line.startsWith('   -')) {
      flushParagraph(`p-${index}`);
      const subText = line.replace(/^(\s+[-•]\s*)/, '');
      renderedElements.push(
        <View key={`sublist-${index}`} style={styles.subListItemRow}>
          <View style={[styles.subBulletDot, { backgroundColor: colors.secondary }]} />
          <Text style={[styles.subListItemText, { color: colors.textSecondary }]}>
            {parseInlineStyles(subText, colors, isDark)}
          </Text>
        </View>
      );
      return;
    }

    // Linha de texto normal (acumula no parágrafo corrente)
    currentParagraph.push(trimmed);
  });

  if (isParsingTable) {
    flushTable('final-table');
  }
  flushParagraph('final');

  return <View style={styles.container}>{renderedElements}</View>;
};

/**
 * Função utilitária para converter negrito (**texto**), itálico (*texto*) e código (`texto`) em Text aninhados
 */
function parseInlineStyles(text: string, colors: any, isDark: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Regex que busca `código`, **negrito** e *itálico*
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const segments = text.split(regex);

  segments.forEach((seg, i) => {
    if (!seg) return;

    if (seg.startsWith('`') && seg.endsWith('`')) {
      // Código inline
      const code = seg.slice(1, -1);
      parts.push(
        <Text
          key={`code-${i}`}
          style={[
            styles.inlineCode,
            {
              backgroundColor: isDark ? '#0F172A' : '#E2E8F0',
              color: colors.primary,
            },
          ]}
        >
          {` ${code} `}
        </Text>
      );
    } else if (seg.startsWith('**') && seg.endsWith('**')) {
      // Negrito
      const boldText = seg.slice(2, -2);
      parts.push(
        <Text key={`bold-${i}`} style={styles.boldText}>
          {boldText}
        </Text>
      );
    } else if (seg.startsWith('*') && seg.endsWith('*')) {
      // Itálico
      const italicText = seg.slice(1, -1);
      parts.push(
        <Text key={`italic-${i}`} style={styles.italicText}>
          {italicText}
        </Text>
      );
    } else {
      parts.push(<Text key={`plain-${i}`}>{seg}</Text>);
    }
  });

  return parts;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  userText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  headingContainer: {
    marginTop: 8,
    marginBottom: 6,
  },
  headingText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headingDivider: {
    height: 1.5,
    borderRadius: 1,
    marginTop: 3,
    marginBottom: 4,
    width: '100%',
  },
  calloutBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderLeftWidth: 3.5,
    marginVertical: 6,
  },
  calloutText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 3,
  },
  bulletCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  numberedCircle: {
    borderRadius: 4,
  },
  bulletText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listItemText: {
    fontSize: 13.5,
    lineHeight: 21,
    flex: 1,
  },
  subListItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: 26,
    marginVertical: 2,
  },
  subBulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 8,
    marginTop: 7,
  },
  subListItemText: {
    fontSize: 12.5,
    lineHeight: 19,
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
  },
  italicText: {
    fontStyle: 'italic',
  },
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
    borderRadius: 4,
  },
  headingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayListItemRow: {
    marginVertical: 4,
    paddingVertical: 3,
  },
  tableWrapper: {
    borderWidth: 1,
    borderRadius: 10,
    marginVertical: 10,
    overflow: 'hidden',
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableHeaderText: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tableCell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  tableCellPrimary: {
    fontWeight: '700',
  },
});
