import { groqClient, GroqChatMessage, buscarHorariosRelevantes, buscarRequerimentosRelevantes } from './groqClient';
import { localSemanticSearch } from './ragClient';

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
}

function formatarRespostaHorariosLocal(turmas: any[]): string {
  let texto = 'Aqui estão as informações oficiais de horários e salas encontradas:\n\n';
  for (const t of turmas) {
    texto += `### 📅 **${t.codigo}** — ${t.curso} (${t.semestre}º Semestre, ${t.periodo})\n`;
    for (const g of t.grade || []) {
      texto += `• **${g.dia}** (${g.horario}):\n  - **Disciplina**: ${g.disciplina}\n  - **Professor**: ${g.professor}\n  - **Local**: ${g.sala_lab}\n`;
    }
    texto += '\n';
  }
  texto += '📌 **Fonte**: Grade Oficial de Horários e Salas FECAP (2026-2)';
  return texto.trim();
}

function formatarRespostaRequerimentoLocal(req: any): string {
  let texto = `📋 **${req.titulo}**\n\n`;
  texto += `• **Setor Responsável**: ${req.grupo_de_atendimento || 'Central de Atendimento ao Aluno (CAA)'}\n`;
  texto += `• **Taxa/Valor**: ${req.valor || 'R$0,00'}\n`;
  texto += `• **Caminho no Portal**: ${req.caminho_sistema || 'Portal do Aluno > Requerimentos'}\n\n`;
  if (req.descricao) {
    texto += `**Descrição**: ${req.descricao}\n\n`;
  }
  if (req.procedimentos) {
    texto += `**Procedimentos**:\n${req.procedimentos}\n\n`;
  }
  if (req.anexos_obrigatorios && req.anexos_obrigatorios.length > 0) {
    texto += `**Anexos Obrigatórios**:\n${req.anexos_obrigatorios.map((a: string) => `• ${a}`).join('\n')}\n\n`;
  }
  texto += '📌 **Fonte**: Catálogo Oficial de Requerimentos FECAP';
  return texto.trim();
}

const KNOWLEDGE_RESPONSES: { keywords: string[]; answer: string; quickReplies?: string[]; action?: any }[] = [
  {
    keywords: ['troca de curso', 'transferencia', 'mudar de curso'],
    answer: 'Para solicitar a **Troca de Curso** na FECAP:\n\n1. **Acesso**: Entre na aba **Requerimentos** ou pelo Portal do Aluno.\n2. **Setor Responsável**: Secretaria Geral & Coordenação do Curso de Destino.\n3. **Etapas Necessárias**:\n   • Passo 1: Preencher o formulário de Transferência Interna.\n   • Passo 2: Anexar histórico escolar atualizado com notas e ementas.\n   • Passo 3: Aguardar análise de equivalência de grade (prazo: até 5 dias úteis).\n\n📌 **Fonte**: Regulamento de Transferências FECAP 2026 | Atualizado em: 15/02/2026',
    quickReplies: ['Ver meu requerimento', 'Transferir para Atendente Humano', 'Prazos e taxas'],
    action: { label: 'Acompanhar Requerimento', route: 'Requirements' },
  },
  {
    keywords: ['dp', 'dependencia', 'adaptacao', 'lista de oferta'],
    answer: 'Orientações para **Disciplinas em Dependência (DP) ou Adaptação (ADAPT)**:\n\n1. **Setor Responsável**: Coordenação de Curso e Secretaria Acadêmica.\n2. **Etapas Necessárias**:\n   • Passo 1: Consulte a Lista de Ofertas oficial na aba **Arquivo/Documentos**.\n   • Passo 2: Selecione as matérias respeitando o limite máximo de 2 DPs por semestre.\n   • Passo 3: Confirme o aceite de matrícula no Portal do Aluno (portal.fecap.br).\n\n📌 **Fonte**: Normas Acadêmicas de Graduação FECAP 2026 | Atualizado em: 20/01/2026',
    quickReplies: ['Abrir Lista de Oferta DPs', 'Falar com Coordenador', 'Transferir para Atendente'],
    action: { label: 'Ver Lista de Ofertas', route: 'DocumentsTab' },
  },
  {
    keywords: ['passe escolar', 'sptrans', 'emtu', 'transporte', 'bilhete unico'],
    answer: 'Para emitir ou renovar o **Passe Escolar / SPTrans / EMTU**:\n\n1. **Setor Responsável**: Central de Atendimento ao Aluno (CAA).\n2. **Etapas Necessárias**:\n   • Passo 1: Acesse a aba **Arquivo > Documentos** e emita a Declaração de Matrícula Ativa.\n   • Passo 2: O sistema ASA envia automaticamente os dados para a SPTrans (DNE).\n   • Passo 3: Acesse sptrans.com.br/estudante para revalidar seu Bilhete Único.\n\n📌 **Fonte**: Manual de Benefícios Estudantis FECAP | Atualizado em: 10/02/2026',
    quickReplies: ['Emitir Declaração', 'Status no DNE', 'Falar com Atendente Humano'],
    action: { label: 'Emitir Declaração', route: 'DocumentsTab' },
  },
  {
    keywords: ['mentoria', 'programa de mentoria', 'carreira'],
    answer: 'O **Programa de Mentoria 2026 (7ª Edição)** conecta você a ex-alunos alvaristas e executivos renomados:\n\n1. **Setor**: FECAP Carreiras & Comunidade Alvarista.\n2. **Etapas**: Inscrição no app > Seleção de mentor por área > Encontros quinzenais.\n3. **Carga Horária**: Concede 40 horas de Atividades Complementares (AC).\n\n📌 **Fonte**: FECAP Carreiras | Atualizado em: 01/02/2026',
    quickReplies: ['Quero me inscrever', 'Ver mentores', 'Horas AC'],
  },
  {
    keywords: ['declaracao', 'matricula', 'documento', 'historico'],
    answer: 'Emissão de documentos oficiais com validação digital:\n\n1. **Setor**: Secretaria Geral Digital.\n2. **Procedimento**: Acesse a aba **Arquivo**, escolha a declaração desejada e clique em "Emitir".\n3. **Autenticidade**: Todos os PDFs contam com QR Code e hash ICP-Brasil para comprovação pública instantânea.\n\n📌 **Fonte**: Secretaria Geral FECAP | Atualizado em: 18/02/2026',
    quickReplies: ['Declaração de Matrícula', 'Histórico Escolar', 'Transferir para CAA'],
    action: { label: 'Ir para Documentos', route: 'DocumentsTab' },
  },
  {
    keywords: ['trancar', 'trancamento', 'cancelamento'],
    answer: 'Orientações sobre **Trancamento de Matrícula**:\n\n1. **Setor**: CAA & Assessoria Psicopedagógica / Apoio ao Estudante.\n2. **Importante**: Antes de trancar, a FECAP oferece programas de apoio financeiro, mentoria e bolsa emergencial para permanência do estudante.\n3. **Etapa**: Caso deseje prosseguir, abra o requerimento "Trancamento Voluntário" pelo app com prazo de até 48h para atendimento orientativo.\n\n📌 **Fonte**: Conselho Universitário FECAP 2026 | Atualizado em: 05/01/2026',
    quickReplies: ['Falar com Apoio ao Estudante', 'Bolsas e Permanência', 'Transferir para Atendente Humano'],
  },
  {
    keywords: ['bolsa restituivel', 'bolsas restituiveis', 'bolsa restituível', 'bolsas restituíveis', 'financiamento'],
    answer: '🎓 **Programa de Bolsas Restituíveis FECAP**:\n\nPermite o pagamento parcial das mensalidades durante a graduação e restituição após a conclusão do curso.\n\n1. **Requisitos de Ingresso**:\n   • Renda bruta familiar per capita de até 3 salários mínimos.\n   • Desempenho no ENEM ou Processo Seletivo FECAP.\n   • Outros benefícios/descontos limitados a no máximo 35%.\n2. **Documentos Necessários**: RG, CPF, Comprovante de Renda e Comprovante de Residência atualizados.\n3. **Renovação**: Abertura de requerimento "Programa de Bolsa Restituível – Renovação" no Portal do Aluno simultaneamente à rematrícula.\n\n📌 **Fonte**: Regulamento do Programa de Bolsas Restituíveis FECAP | DocumentosASA',
    quickReplies: ['Critérios de Renda', 'Documentos Exigidos', 'Falar com Atendente Humano'],
  },
  {
    keywords: ['assistencia financeira', 'assistência financeira', 'perda de renda', 'desemprego'],
    answer: '💼 **Programa de Assistência Financeira Educacional FECAP**:\n\nGarante a continuidade dos estudos do aluno em situações comprovadas de perda de renda ou desemprego do responsável financeiro.\n\n1. **Aplicação**: Alunos regularmente matriculados que sofram descontinuidade financeira involuntária.\n2. **Como Solicitar**: Requerimento via Portal do Aluno > CAA anexando comprovação de rescisão ou redução salarial.\n3. **Atendimento**: Análise prioritária pela comissão de permanência estudantil.\n\n📌 **Fonte**: Programa de Assistência Financeira Educacional FECAP | DocumentosASA',
    quickReplies: ['Como solicitar', 'Documentos', 'Transferir para CAA'],
  },
  {
    keywords: ['rematricula', 'rematrícula', 'renovacao', 'renovação'],
    answer: '📋 **Rematrícula 2026/2 - Graduação Presencial (CI 23/26)**:\n\n1. **Rematrícula Automática (Alunos Adimplentes)**:\n   • Trancamento Total 2026-1 e Aprovados/Com DP: 22/06/2026.\n   • Reprovados (após exames): 02/07/2026.\n2. **Confirmação**: Pagamento da 1ª parcela do 2º semestre com vencimento em 07/07/2026.\n3. **Rematrícula Fora de Época**: Caso não ocorra automaticamente e não haja débitos, abrir requerimento no Portal até 22/07/2026.\n\n📌 **Fonte**: Informativo Oficial Rematrícula 2026-2 (CI 23/26) | DocumentosASA',
    quickReplies: ['Prazos de Pagamento', 'Fora de Época', 'Falar com Atendente Humano'],
  },
  {
    keywords: ['humano', 'atendente', 'falar com atendente', 'caa', 'suporte'],
    answer: '🔔 **Transferência para Atendimento Humano**:\n\nVocê está sendo conectado com a **Central de Atendimento ao Aluno (CAA - FECAP)**.\n\n• **Horário de Atendimento**: Segunda a Sexta, das 08h00 às 21h00\n• **WhatsApp Oficial**: (11) 3272-2222\n• **Atendimento Presencial**: Campus Liberdade - Bloco A, Térreo\n• **Ramal Interno**: 4004\n\nUm chamado foi registrado com o seu perfil acadêmico para acompanhamento prioritário.',
    quickReplies: ['Chamar no WhatsApp', 'Voltar ao Menu Principal'],
  },
];

export const aiChatService = {
  /**
   * Processa a mensagem do usuário via Groq API ou fallback inteligente
   */
  async sendMessage(userMessage: string, conversationHistory: ChatMessage[] = []): Promise<ChatMessage> {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      // 1. Chama o Backend (que executa o agente Groq server-side)
      const groqHistory: GroqChatMessage[] = conversationHistory
        .filter((msg) => msg.sender !== 'system')
        .slice(-6)
        .map((msg) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        }));

      groqHistory.push({
        role: 'user',
        content: userMessage,
      });

      const reply = await groqClient.chatCompletion(groqHistory);

      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: reply,
        timestamp,
        quickReplies: ['Mais detalhes', 'Ver Requerimentos', 'Falar com Atendimento'],
      };
    } catch (error: any) {
      console.warn('Erro ao processar mensagem com Backend (acionando contingência local):', error);

      // Contingência Graciosa: Caso a API Groq atinja 429 ou falhe, consome diretamente horários e documentos locais
      const turmasLocais = buscarHorariosRelevantes(userMessage, 3);
      if (turmasLocais.length > 0) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: `${formatarRespostaHorariosLocal(turmasLocais)}\n\n*(Nota: Dados consultados diretamente na base oficial de horários do app)*`,
          timestamp,
          quickReplies: ['Outras Turmas', 'Salas de Aula', 'Falar com CAA'],
        };
      }

      const reqsLocais = buscarRequerimentosRelevantes(userMessage, 1);
      if (reqsLocais.length > 0) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: `${formatarRespostaRequerimentoLocal(reqsLocais[0])}\n\n*(Nota: Dados consultados diretamente no catálogo oficial de requerimentos do app)*`,
          timestamp,
          quickReplies: ['Como solicitar', 'Ver no Portal'],
        };
      }

      const normalized = userMessage.toLowerCase().trim();
      const match = KNOWLEDGE_RESPONSES.find((item) =>
        item.keywords.some((kw) => normalized.includes(kw))
      );

      if (match) {
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: `${match.answer}\n\n*(Nota: Resposta fornecida pelo SISA em modo de contingência local)*`,
          timestamp,
          quickReplies: match.quickReplies,
          suggestedAction: match.action,
        };
      }

      const localChunks = localSemanticSearch(userMessage, 2);
      if (localChunks.length > 0) {
        const principal = localChunks[0];
        return {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: `Consultei diretamente os documentos oficiais salvos no app:\n\n**${principal.titulo}** (Pág. ${principal.pagina}):\n> "${principal.texto.slice(0, 350)}..."\n\n📌 **Fonte**: ${principal.arquivo} | DocumentosASA`,
          timestamp,
          quickReplies: ['Tentar Novamente', 'Falar com Atendente Humano', 'Ver Regulamentos'],
        };
      }

      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `O serviço de IA está temporariamente ocupado. Por favor, tente novamente em alguns instantes ou entre em contato com a CAA pelo WhatsApp oficial (11) 3272-2222.`,
        timestamp,
        quickReplies: ['Tentar Novamente', 'Falar com Atendente Humano'],
      };
    }
  },
};

