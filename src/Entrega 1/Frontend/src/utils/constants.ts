export type UserRole = 'Aluno' | 'Pais' | 'Professor' | 'Funcionário';

export interface UserProfile {
  id: string;
  name: string;
  ra: string;
  email: string;
  role: UserRole;
  course?: string;
  semester?: string;
  avatarUrl?: string;
}

export interface Requirement {
  id: string;
  protocol: string;
  title: string;
  type: string;
  currentStage: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  description: string;
  steps: {
    title: string;
    description: string;
    completed: boolean;
    active: boolean;
    date?: string;
  }[];
}

export interface NoticeItem {
  id: string;
  title: string;
  category: string;
  date: string;
  imageSource: any;
  summary: string;
  detailsUrl?: string;
}

export interface QuickAction {
  id: string;
  label: string;
  iconName: 'sparkles' | 'book' | 'message' | 'award';
  route: string;
  hasNotification?: boolean;
}

export const INITIAL_USER: UserProfile = {
  id: 'usr-fecap-101',
  name: 'Tutancamon',
  ra: '24026851',
  email: 'tutancamon.alvarista@fecap.br',
  role: 'Aluno',
  course: 'Ciência da Computação',
  semester: '5º Semestre',
};

export const QUICK_ACTIONS: QuickAction[] = [
  { id: '1', label: 'Pergunte a IA', iconName: 'sparkles', route: 'AITab' },
  { id: '2', label: 'Documentos', iconName: 'book', route: 'DocumentsTab' },
  { id: '3', label: 'Requerimentos', iconName: 'message', route: 'Requirements', hasNotification: true },
  { id: '4', label: 'Serviços', iconName: 'award', route: 'EducationTab' },
];

export const INITIAL_REQUIREMENTS: Requirement[] = [
  {
    id: 'req-001',
    protocol: 'REQ-2026-0892',
    title: 'Troca de curso',
    type: 'Secretaria Acadêmica',
    currentStage: 'Análise da solicitação',
    status: 'in_progress',
    createdAt: '2026-08-20',
    updatedAt: '2026-08-25',
    description: 'Solicitação de transferência interna do curso de Engenharia de Software para Ciência da Computação (Período Noturno).',
    steps: [
      { title: 'Abertura do protocolo', description: 'Requerimento registrado pelo aluno via ASA App', completed: true, active: false, date: '20/08/2026' },
      { title: 'Conferência de documentação', description: 'Histórico escolar e grade verificados', completed: true, active: false, date: '22/08/2026' },
      { title: 'Análise da solicitação', description: 'Coordenação avaliando equivalência curricular', completed: false, active: true, date: 'Em andamento' },
      { title: 'Parecer Final & Deferimento', description: 'Emissão do novo contrato e confirmação da turma', completed: false, active: false },
    ],
  },
  {
    id: 'req-002',
    protocol: 'REQ-2026-0741',
    title: 'Declaração de Matrícula',
    type: 'Documentos',
    currentStage: 'Concluído',
    status: 'approved',
    createdAt: '2026-08-10',
    updatedAt: '2026-08-11',
    description: 'Emissão de comprovante oficial de matrícula ativa com código de autenticidade digital.',
    steps: [
      { title: 'Solicitação enviada', description: 'Registrada', completed: true, active: false, date: '10/08/2026' },
      { title: 'Emissão Digital', description: 'Documento assinado digitalmente com hash ICP-Brasil', completed: true, active: false, date: '11/08/2026' },
    ],
  },
];
