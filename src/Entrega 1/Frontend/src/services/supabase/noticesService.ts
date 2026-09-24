import { NoticeItem } from '../../utils/constants';

export const noticesService = {
  async getNotices(): Promise<NoticeItem[]> {
    return [
      {
        id: 'notice-1',
        title: 'PROGRAMA de MENTORIA 2026',
        category: 'Carreira',
        date: '27/08/2026',
        imageSource: require('../../assets/banners/banner_mentoria.png'),
        summary: 'Inscrições abertas para a 7ª edição do Programa de Mentoria Alvarista FECAP. Conecte-se com líderes de mercado.',
      },
      {
        id: 'notice-2',
        title: 'Lista de Oferta DPs/ADAPT',
        category: 'Acadêmico',
        date: '25/08/2026',
        imageSource: require('../../assets/banners/banner_dps.png'),
        summary: 'Possui disciplinas de Dependência ou Adaptação a cursar? Acesse a Lista de Ofertas no Portal do Aluno.',
      },
    ];
  },

  async getAllMaterials(): Promise<{ id: string; title: string; category: string; format: string; size: string; downloadUrl: string }[]> {
    return [
      { id: 'mat-1', title: 'Guia do Estudante Alvarista 2026', category: 'Institucional', format: 'PDF', size: '4.2 MB', downloadUrl: '#' },
      { id: 'mat-2', title: 'Calendário Acadêmico 2º Semestre 2026', category: 'Acadêmico', format: 'PDF', size: '1.1 MB', downloadUrl: '#' },
      { id: 'mat-3', title: 'Manual de Atividades Complementares (AC)', category: 'Normas', format: 'PDF', size: '2.5 MB', downloadUrl: '#' },
      { id: 'mat-4', title: 'Regulamento de Dependência e Adaptação', category: 'Acadêmico', format: 'PDF', size: '890 KB', downloadUrl: '#' },
      { id: 'mat-5', title: 'Modelo de Requerimento Geral da Secretaria', category: 'Formulários', format: 'DOCX', size: '320 KB', downloadUrl: '#' },
      { id: 'mat-6', title: 'Tabela de Equivalências Curriculares - CComp', category: 'Coordenação', format: 'PDF', size: '1.8 MB', downloadUrl: '#' },
    ];
  },
};
