import {
  groqClient,
  isGroqConfigured,
  getGroqApiKey,
  GroqChatMessage,
  StudentAcademicProfile,
  buscarHorariosRelevantes,
  buscarRequerimentosRelevantes,
  assimilarContextoConversaTS,
  gerarQuickRepliesContextuais,
  isGreetingMessage,
} from './groqClient';
import { searchAllKnowledgeChunksAsync } from './ragClient';
import {
  studentRiskService,
  extractActiveStudentFromContextAsync,
  findStudentInTextAsync,
} from './studentRiskService';

export interface PendingRequirementSpec {
  title: string;
  type: string;
  description: string;
  valor?: string;
  caminho_sistema?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  quickReplies?: string[];
  suggestedAction?: {
    label: string;
    route: string;
    params?: any;
  };
  pendingRequirement?: PendingRequirementSpec;
  createdRequirementPayload?: {
    title: string;
    type: string;
    currentStage: string;
    status: 'pending' | 'in_progress' | 'approved' | 'rejected';
    description: string;
    steps: {
      title: string;
      description: string;
      completed: boolean;
      active: boolean;
      date?: string;
    }[];
  };
}

/**
 * Detecta se o aluno está pedindo explicitamente para abrir/protocolar um requerimento.
 * Perguntas informativas de provas, salas, horários ou regulamentos JAMAIS disparam abertura de requerimento.
 */
function detectRequirementIntent(text: string): PendingRequirementSpec | null {
  const lower = text.toLowerCase().trim();

  if (
    lower.startsWith('seguir com a abertura') ||
    lower.startsWith('confirmar abertura') ||
    lower.startsWith('sim, confirmar') ||
    lower.includes('quero falar com um atendente real primeiro') ||
    lower.includes('cancelar')
  ) {
    return null;
  }

  const INFORMATIONAL_REGEX =
    /\b(o que diz|o que [eé]|como funciona|qual [eé]|qual a data|quando [eé]|regulamento|normas|regras|resumo|resumir|expli(que|car)|d[uú]vida|informa[cç][aã]o|orienta[cç][aã]o|quanto custa|qual o valor|qual a taxa|qual o prazo|onde vejo|onde fica|posso saber|tem como me explicar|e a de )\b/i;

  if (INFORMATIONAL_REGEX.test(lower)) {
    return null;
  }

  const EXPLICIT_OPEN_INTENT =
    /\b(abrir|protocolar|gerar|cadastrar|iniciar|solicitar a abertura|quero abrir|desejo abrir|abertura de)\s+(o\s+|um\s+|minha\s+|meu\s+)?(requerimento|chamado|protocolo|solicita[çc][ãa]o)\b/i;

  const EXPLICIT_ACTION_PHRASES =
    /\b(quero|preciso|desejo|gostaria de)\s+(abrir|protocolar|trancar meu curso|fazer o trancamento|trocar de curso|pedir segunda chamada)\b/i;

  const isExplicit = EXPLICIT_OPEN_INTENT.test(lower) || EXPLICIT_ACTION_PHRASES.test(lower);
  if (!isExplicit) {
    return null;
  }

  const matches = buscarRequerimentosRelevantes(text, 1, false);
  if (matches.length > 0) {
    const req = matches[0];
    return {
      title: req.titulo,
      type: req.grupo_de_atendimento || req.tipo_de_requerimento || 'Serviços Acadêmicos',
      description: req.descricao || `Solicitação formal de ${req.titulo} protocolada via Assistente SISA.`,
      valor: req.valor,
      caminho_sistema: req.caminho_sistema,
    };
  }

  return null;
}

function findPendingRequirementInHistory(history: ChatMessage[]): PendingRequirementSpec | null {
  const reversed = [...history].reverse();
  for (const msg of reversed) {
    if (msg.sender === 'assistant' && msg.pendingRequirement) {
      return msg.pendingRequirement;
    }
  }
  return null;
}

function isConfirmationToOpenRequirement(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower.startsWith('seguir com a abertura') ||
    lower.startsWith('confirmar abertura') ||
    lower.includes('abrir o requerimento') ||
    lower.includes('abrir requerimento agora') ||
    lower.includes('pode abrir') ||
    lower.includes('seguir com abertura') ||
    lower.includes('não, quero abrir') ||
    lower.includes('nao, quero abrir') ||
    lower.includes('prosseguir com a abertura')
  );
}

function isRequestForRealAttendantBeforeOpening(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower.includes('quero falar com um atendente real primeiro') ||
    lower.includes('falar com atendente real') ||
    lower.includes('falar com algum atendente') ||
    (lower.includes('sim') && lower.includes('atendente'))
  );
}

function formatarRespostaHorariosLocal(turmas: any[]): string {
  let texto = 'Aqui estão as informações oficiais de horários e salas encontradas:\n\n';
  for (const t of turmas) {
    texto += `### 📅 **${t.codigo}** — ${t.curso} (${t.semestre}º Semestre, ${t.periodo})\n\n`;
    texto += '| Dia | Horário | Disciplina | Professor | Local |\n';
    texto += '|---|---|---|---|---|\n';
    for (const g of t.grade || []) {
      texto += `| **${g.dia || '-'}** | ${g.horario || '-'} | ${g.disciplina || '-'} | ${g.professor || '-'} | ${g.sala_lab || '-'} |\n`;
    }
    texto += '\n';
  }
  texto += '📌 **Fonte**: Grade Oficial de Horários e Salas FECAP';
  return texto.trim();
}

function formatarRespostaRequerimentoLocal(req: any): string {
  let texto = `### 📋 **${req.titulo}**\n\n`;
  texto += `• **Setor Responsável**: ${req.grupo_de_atendimento || 'Central de Atendimento ao Aluno (CAA)'}\n`;
  texto += `• **Taxa/Valor**: ${req.valor || 'R$0,00'}\n`;
  texto += `• **Caminho no Portal**: ${req.caminho_sistema || 'Portal do Aluno > Requerimentos'}\n\n`;
  if (req.descricao) {
    texto += `**Descrição**:\n> ${req.descricao}\n\n`;
  }
  if (req.procedimentos) {
    texto += `**Procedimentos Passo a Passo**:\n${req.procedimentos}\n\n`;
  }
  texto += '📌 **Fonte**: Catálogo Oficial de Requerimentos FECAP';
  return texto.trim();
}

export const aiChatService = {
  async sendMessage(
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    userRole: string = 'Aluno',
    targetStudentContext?: StudentAcademicProfile
  ): Promise<ChatMessage> {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      if (userRole !== 'Funcionário') {
        if (isGreetingMessage(userMessage)) {
          const studentFirstName = targetStudentContext?.name
            ? targetStudentContext.name.trim().split(' ')[0]
            : '';
          const greetingHeader = studentFirstName
            ? `Olá, **${studentFirstName}**! 👋`
            : 'Olá! 👋';

          const greetingText = `${greetingHeader} Sou o **SISA (Assistente de Inteligência Artificial)** da FECAP.\n\nComo posso ajudar você hoje?\n\n• 📅 **Horários e Salas de Aula** da sua turma\n• 📝 **Datas e Locais de Provas Oficiais (PO)**\n• 📋 **Requerimentos Acadêmicos** (abertura, taxas e prazos)\n• 💰 **Bolsas de Estudo & Financeiro** (PAFE, Restituível, Mérito)\n• 📖 **Regulamentos, Estágio Supervisionado e Manuais de PEDP**`;

          return {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text: greetingText,
            timestamp,
            quickReplies: [
              'Quais são os horários das minhas aulas?',
              'Quando são as minhas provas oficiais?',
              'Como solicitar Passe Escolar (SPTrans)?',
              'Bolsas de Estudo disponíveis',
            ],
          };
        }
        const pendingReq = findPendingRequirementInHistory(conversationHistory);

        if (pendingReq && isRequestForRealAttendantBeforeOpening(userMessage)) {
          return {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text: `### 👨‍💼 **Encaminhamento Prioritário para Atendente Real (CAA)**\n\nPerfeito! Antes de protocolarmos o seu **${pendingReq.title}**, registrei seu pedido de acolhimento com um consultor humano da **Central de Atendimento ao Aluno (CAA)**.\n\n• **Canal Direto CAA (WhatsApp/Telefone)**: (11) 3272-2222\n• **Presencial**: Bloco C - Térreo\n\nCaso deseje **protocolar o requerimento agora mesmo**, basta tocar no botão abaixo:`,
            timestamp,
            pendingRequirement: pendingReq,
            quickReplies: [
              `Seguir com a abertura do requerimento: ${pendingReq.title}`,
              'Cancelar solicitação',
            ],
          };
        }

        if (pendingReq && isConfirmationToOpenRequirement(userMessage)) {
          const todayFormatted = new Date().toLocaleDateString('pt-BR');
          return {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text: `### ✅ **Requerimento Aberto com Sucesso pela IA SISA!**\n\nSua solicitação de **${pendingReq.title}** foi registrada oficialmente no sistema acadêmico da FECAP e encaminhada para **${pendingReq.type}**.\n\n• **Modalidade**: ${pendingReq.title}\n• **Etapa Atual**: Recebido via Assistente SISA — Em Triagem CAA\n• **Data de Abertura**: ${todayFormatted}`,
            timestamp,
            quickReplies: ['Ver meus requerimentos', 'Baixar documentos oficiais'],
            suggestedAction: {
              label: 'Acompanhar Requerimento',
              route: 'StudentRequirements',
            },
            createdRequirementPayload: {
              title: pendingReq.title,
              type: pendingReq.type,
              currentStage: 'Recebido via IA SISA',
              status: 'in_progress',
              description: pendingReq.description,
              steps: [
                {
                  title: 'Abertura via Assistente SISA',
                  description: 'Protocolado automaticamente pela IA após confirmação do aluno',
                  completed: true,
                  active: false,
                  date: todayFormatted,
                },
                {
                  title: 'Triagem e Análise CAA',
                  description: `Em análise pelo setor: ${pendingReq.type}`,
                  completed: false,
                  active: true,
                  date: 'Em andamento',
                },
                {
                  title: 'Parecer Final & Conclusão',
                  description: 'Emissão do despacho oficial pela Secretaria',
                  completed: false,
                  active: false,
                },
              ],
            },
          };
        }

        const detectedReq = detectRequirementIntent(userMessage);
        if (detectedReq) {
          const valorText = detectedReq.valor ? `• **Taxa/Valor**: ${detectedReq.valor}\n` : '';
          const caminhoText = detectedReq.caminho_sistema ? `• **Caminho no Portal**: ${detectedReq.caminho_sistema}\n` : '';

          return {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text: `### 📋 **Abertura de Requerimento: ${detectedReq.title}**\n\nIdentifiquei no catálogo oficial da FECAP sua solicitação de **${detectedReq.title}** (*${detectedReq.type}*).\n\n${valorText}${caminhoText}• **Descrição Oficial**: ${detectedReq.description}\n\n🤝 **Deseja que eu protocole a abertura oficial deste requerimento agora para você?**`,
            timestamp,
            pendingRequirement: detectedReq,
            quickReplies: [
              `Seguir com a abertura do requerimento: ${detectedReq.title}`,
              'Quero falar com um atendente real primeiro',
            ],
          };
        }
      }

      if (userRole === 'Funcionário') {
        const activeStudent =
          (targetStudentContext?.ra ? await findStudentInTextAsync(targetStudentContext.ra) : undefined) ||
          (await extractActiveStudentFromContextAsync(userMessage, conversationHistory));
        const hasKey = isGroqConfigured || Boolean(getGroqApiKey() && getGroqApiKey().length > 10);

        if (hasKey && activeStudent) {
          try {
            const systemPrompt = `Você é o Agente Analítico de Sucesso e Permanência Estudantil da FECAP.
Você está conversando com um colaborador da CAA/Coordenação.
Dados completos do aluno em análise:
- Nome: ${activeStudent.name} (RA: ${activeStudent.ra})
- Situação da Matrícula (Status Acadêmico): ${activeStudent.status_academico || 'Matriculado'}
- Curso: ${activeStudent.course} (${activeStudent.semester})
- Turno: ${activeStudent.turno || 'Noturno'}
- Score de Risco Global: ${activeStudent.overallRiskScore}/100 [Categoria: ${activeStudent.category}]
- Tendência: ${activeStudent.temporalTrend} (${activeStudent.trendVariation})
- Dimensão Financeira (${activeStudent.dimensions.financeira.score}/100): ${activeStudent.dimensions.financeira.detail}
- Dimensão Acadêmica (${activeStudent.dimensions.academica.score}/100): ${activeStudent.dimensions.academica.detail}
- Dimensão Relacionamento & Requerimentos (${activeStudent.dimensions.relacionamento.score}/100 - ${activeStudent.dimensions.relacionamento.status}): ${activeStudent.dimensions.relacionamento.detail}
- Dimensão Geográfica (${activeStudent.dimensions.geografica.score}/100): ${activeStudent.dimensions.geografica.detail}
- Explicação do Risco: ${activeStudent.explanation}
- Recomendação de Ação: ${activeStudent.recommendation}

Instruções Cruciais:
1. Informe SEMPRE a Situação da Matrícula do estudante (Matriculado, Evadido, Formado ou Trancado) logo no início do diagnóstico.
2. Responda a dúvida do funcionário com precisão institucional e mantenha o contexto entre turnos.`;

            const groqHistory: GroqChatMessage[] = [
              { role: 'system', content: systemPrompt },
              ...conversationHistory
                .filter((msg) => msg.sender !== 'system')
                .slice(-8)
                .map((msg) => ({
                  role: (msg.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                  content: msg.text,
                })),
              { role: 'user', content: userMessage },
            ];

            const reply = await groqClient.chatCompletion(groqHistory);
            return {
              id: `msg-${Date.now()}`,
              sender: 'assistant',
              text: reply,
              timestamp,
              quickReplies: [
                'Explique a situação financeira',
                'Quais as recomendações?',
                'Ver desempenho acadêmico',
              ],
            };
          } catch (groqErr) {
            console.warn('Fallback para motor local de risco:', groqErr);
          }
        }

        const analise = await studentRiskService.queryRiskAgent(userMessage, conversationHistory, activeStudent);
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: analise,
          timestamp,
          quickReplies: activeStudent
            ? [
                'Explique a situação financeira dele',
                'Como está o rendimento acadêmico?',
                'Qual o plano de ação recomendado?',
              ]
            : [
                'Alunos com risco crítico',
                'Panorama geral do semestre',
                'Diagnóstico RA 24018932',
              ],
        };
      }

      const groqHistory: GroqChatMessage[] = conversationHistory
        .filter((msg) => msg.sender !== 'system')
        .slice(-8)
        .map((msg) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        }));

      groqHistory.push({
        role: 'user',
        content: userMessage,
      });

      const ctxState = assimilarContextoConversaTS(groqHistory, targetStudentContext);

      const hasKey = isGroqConfigured || Boolean(getGroqApiKey() && getGroqApiKey().length > 10);
      if (hasKey) {
        try {
          const reply = await groqClient.chatCompletion(groqHistory, targetStudentContext);
          if (reply && reply.trim()) {
            return {
              id: `msg-${Date.now()}`,
              sender: 'assistant',
              text: reply,
              timestamp,
              quickReplies: gerarQuickRepliesContextuais(userMessage, reply, ctxState, targetStudentContext),
            };
          }
        } catch (chatErr) {
          console.warn('[AIChatService] Erro ao comunicar com IA online, aplicando contingência determinística...', chatErr);
        }
      }

      // Contingência baseada no Grafo de Conhecimento em Markdown caso não haja chave de API configurada no cliente
      const chunks = await searchAllKnowledgeChunksAsync(ctxState.queryContextualizada, 2, false);
      if (chunks.length > 0) {
        const bodyText = chunks.map((c) => {
          const textoLimpo = (c.texto || '').replace(/^\[.*?\]\s*Tags:.*?\n+/gim, '').trim();
          return `### 📄 **${c.titulo}**\n\n${textoLimpo}`;
        }).join('\n\n---\n\n');
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: bodyText,
          timestamp,
          quickReplies: gerarQuickRepliesContextuais(userMessage, bodyText, ctxState, targetStudentContext),
        };
      }

      const turmasLocais = buscarHorariosRelevantes(ctxState.queryContextualizada, 2);
      if (turmasLocais.length > 0) {
        const scheduleText = formatarRespostaHorariosLocal(turmasLocais);
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: scheduleText,
          timestamp,
          quickReplies: gerarQuickRepliesContextuais(userMessage, scheduleText, ctxState, targetStudentContext),
        };
      }

      const reqsLocais = buscarRequerimentosRelevantes(userMessage, 1, true);
      if (reqsLocais.length > 0) {
        const reqText = formatarRespostaRequerimentoLocal(reqsLocais[0]);
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: reqText,
          timestamp,
          quickReplies: [
            `Quero abrir o requerimento: ${reqsLocais[0].titulo}`,
            'Ver taxas e prazos de requerimentos',
            'Falar com atendente humano CAA',
          ],
        };
      }

      const clarifyText = `Para eu encontrar a informação exata para você, poderia especificar o seu **curso** e **turma/semestre** (por exemplo: \`5NA Economia\`, \`3NA ADM\`, \`2NA Ciência da Computação\`, \`1NA ADS\`)?`;
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: clarifyText,
        timestamp,
        quickReplies: gerarQuickRepliesContextuais(userMessage, clarifyText, ctxState, targetStudentContext),
      };
    } catch (error: any) {
      console.warn('Erro ao processar mensagem no chat:', error);

      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `### ⚠️ **Aviso de Atendimento**\n\nO serviço de IA está em alta demanda no momento. Por favor, tente novamente em alguns instantes ou entre em contato com a CAA pelo WhatsApp oficial **(11) 3272-2222**.`,
        timestamp,
      };
    }
  },
};
