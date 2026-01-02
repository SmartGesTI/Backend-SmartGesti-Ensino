/**
 * Site Map completo do sistema SmartGesTI
 * Baseado nos menus definidos em Sidebar.tsx
 */

export interface MenuSection {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  description: string;
  category: 'ia' | 'dashboard' | 'academico' | 'administracao' | 'calendario' | 'sites' | 'documentos' | 'configuracoes';
  requiresPermission?: {
    resource: string;
    action: string;
  };
  children: MenuItem[];
}

export interface MenuItem {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  routePattern: string; // Padrão da rota (ex: /escola/:slug/ia/assistente)
  description: string;
  detailedDescription: string;
  features: string[];
  useCases: string[];
  relatedPages: string[]; // IDs de páginas relacionadas
  requiresPermission?: {
    resource: string;
    action: string;
  };
  breadcrumb: string;
  parentMenu: string;
  menuPath: string; // Caminho completo no menu (ex: "EducaIA > Assistente")
}

/**
 * Dados completos do Site Map
 */
export const SITEMAP_DATA: MenuSection[] = [
  {
    id: 'educaia',
    name: 'EducaIA',
    icon: 'Sparkles',
    iconColor: 'text-purple-500',
    description: 'Ferramentas de Inteligência Artificial para educação',
    category: 'ia',
    children: [
      {
        id: 'assistente-ia',
        name: 'Assistente',
        icon: 'MessageCircle',
        iconColor: 'text-purple-400',
        routePattern: '/escola/:slug/ia/assistente',
        description: 'Assistente virtual inteligente que conhece todo o sistema',
        detailedDescription: 'Chat interativo com IA que pode responder perguntas sobre o sistema, explicar funcionalidades, fornecer links para páginas, consultar dados do banco e ajudar na navegação. O assistente conhece todas as páginas, rotas e funcionalidades do SmartGesTI.',
        features: [
          'Chat interativo em tempo real',
          'Streaming de respostas',
          'Histórico de conversas',
          'Geração de links para páginas',
          'Consultas ao banco de dados',
          'Explicação de funcionalidades',
          'Busca no conhecimento do sistema',
        ],
        useCases: [
          'Fazer perguntas sobre o sistema',
          'Descobrir onde encontrar funcionalidades',
          'Obter ajuda para usar uma página',
          'Consultar informações do sistema',
          'Gerar links para navegação',
        ],
        relatedPages: ['criar-agente-ia', 'relatorio-inteligente', 'ver-agentes'],
        breadcrumb: 'Assistente IA',
        parentMenu: 'EducaIA',
        menuPath: 'EducaIA > Assistente',
      },
      {
        id: 'relatorio-inteligente',
        name: 'Relatório Inteligente',
        icon: 'Wand2',
        iconColor: 'text-purple-500',
        routePattern: '/escola/:slug/ia/relatorio',
        description: 'Gera relatórios inteligentes em PDF usando IA',
        detailedDescription: 'Sistema de geração de relatórios acadêmicos, financeiros, de matrículas e frequência em formato PDF. Permite filtrar por período, turma, aluno e outros parâmetros. Gera relatórios formatados e profissionais com processamento inteligente.',
        features: [
          'Geração de relatórios em PDF',
          'Múltiplos tipos de relatórios (Acadêmico, Financeiro, Matrículas, Frequência)',
          'Filtros por período, turma, aluno',
          'Visualização prévia antes de gerar',
          'Processamento com IA',
          'Download de PDF',
        ],
        useCases: [
          'Gerar relatórios acadêmicos',
          'Criar relatórios financeiros',
          'Exportar dados de matrículas',
          'Gerar relatórios de frequência',
          'Criar documentos formatados',
        ],
        relatedPages: ['criar-agente-ia', 'assistente-ia'],
        breadcrumb: 'Relatório Inteligente',
        parentMenu: 'EducaIA',
        menuPath: 'EducaIA > Relatório Inteligente',
      },
      {
        id: 'criar-agente-ia',
        name: 'Criar Agente IA',
        icon: 'Bot',
        iconColor: 'text-purple-600',
        routePattern: '/escola/:slug/ia/criar',
        description: 'Crie agentes de IA personalizados usando workflow visual',
        detailedDescription: 'Editor visual drag-and-drop para criar agentes de IA personalizados. Permite montar workflows complexos conectando diferentes tipos de nós: entrada (documentos, formulários, API, banco de dados, texto), processamento (agentes de IA, transformações), e saída (PDF, texto, API). Inclui templates pré-configurados e validação de workflow mínimo.',
        features: [
          'Editor visual drag-and-drop (React Flow)',
          'Templates pré-configurados',
          'Processamento de documentos (PDF, Word, Excel)',
          'Análise com IA',
          'Geração de relatórios',
          'Configuração de modelos de IA',
          'Validação de workflow mínimo (entrada, agente, saída)',
          'Execução e teste de agentes',
          'Salvamento como rascunho ou publicação',
        ],
        useCases: [
          'Criar automação para processar documentos',
          'Gerar relatórios automáticos',
          'Analisar dados com IA',
          'Criar workflows personalizados',
          'Automatizar tarefas repetitivas',
        ],
        relatedPages: ['ver-agentes', 'meus-agentes', 'relatorio-inteligente'],
        breadcrumb: 'Criar Agente IA',
        parentMenu: 'EducaIA',
        menuPath: 'EducaIA > Criar Agente IA',
      },
      {
        id: 'ver-agentes',
        name: 'Ver Agentes',
        icon: 'Grid3x3',
        iconColor: 'text-purple-500',
        routePattern: '/escola/:slug/ia/agentes',
        description: 'Explore agentes públicos e colaborativos disponíveis',
        detailedDescription: 'Galeria de agentes públicos e colaborativos criados pela comunidade. Permite explorar, filtrar por categoria e dificuldade, buscar agentes específicos, usar agentes como templates para criar novas versões, e editar agentes colaborativos.',
        features: [
          'Explorar agentes públicos',
          'Filtros por categoria e dificuldade',
          'Busca de agentes',
          'Usar agentes como templates',
          'Editar agentes colaborativos',
          'Visualizar detalhes dos agentes',
        ],
        useCases: [
          'Encontrar agentes úteis',
          'Usar templates prontos',
          'Colaborar em agentes públicos',
          'Descobrir novas automações',
        ],
        relatedPages: ['criar-agente-ia', 'meus-agentes'],
        breadcrumb: 'Galeria de Agentes',
        parentMenu: 'EducaIA',
        menuPath: 'EducaIA > Ver Agentes',
      },
      {
        id: 'meus-agentes',
        name: 'Meus Agentes',
        icon: 'UserCircle',
        iconColor: 'text-purple-400',
        routePattern: '/escola/:slug/ia/meus-agentes',
        description: 'Gerencie seus agentes de IA criados',
        detailedDescription: 'Lista de todos os agentes criados pelo usuário. Permite editar, executar, excluir e gerenciar a visibilidade (público, privado, colaborativo) dos agentes. Inclui filtros e busca para encontrar agentes específicos.',
        features: [
          'Lista de agentes do usuário',
          'Editar agentes criados',
          'Executar agentes',
          'Excluir agentes',
          'Filtros e busca',
          'Gerenciar visibilidade (público/privado/colaborativo)',
          'Visualizar estatísticas de uso',
        ],
        useCases: [
          'Gerenciar agentes criados',
          'Editar workflows existentes',
          'Testar agentes',
          'Organizar agentes pessoais',
        ],
        relatedPages: ['criar-agente-ia', 'ver-agentes'],
        breadcrumb: 'Meus Agentes',
        parentMenu: 'EducaIA',
        menuPath: 'EducaIA > Meus Agentes',
      },
    ],
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: 'LayoutDashboard',
    iconColor: 'text-blue-500',
    description: 'Painéis de controle e métricas',
    category: 'dashboard',
    children: [
      {
        id: 'dashboard-visao-geral',
        name: 'Visão Geral',
        icon: 'Eye',
        iconColor: 'text-blue-400',
        routePattern: '/escola/:slug/painel',
        description: 'Painel principal com visão geral da escola',
        detailedDescription: 'Dashboard principal com métricas gerais da escola, estatísticas de alunos, turmas, matrículas, gráficos e indicadores. Fornece uma visão consolidada de todos os aspectos da escola com acesso rápido a funcionalidades principais.',
        features: [
          'Métricas gerais da escola',
          'Estatísticas de alunos, turmas e matrículas',
          'Gráficos e indicadores visuais',
          'Acesso rápido a funcionalidades',
          'Cards de estatísticas',
          'Lista de eventos recentes',
        ],
        useCases: [
          'Visualizar resumo da escola',
          'Acompanhar métricas principais',
          'Acessar funcionalidades rapidamente',
          'Monitorar atividades recentes',
        ],
        relatedPages: ['dashboard-financeiro', 'dashboard-academico'],
        breadcrumb: 'Visão Geral',
        parentMenu: 'Dashboard',
        menuPath: 'Dashboard > Visão Geral',
      },
      {
        id: 'dashboard-financeiro',
        name: 'Financeiro',
        icon: 'DollarSign',
        iconColor: 'text-blue-500',
        routePattern: '/escola/:slug/painel/financeiro',
        description: 'Painel com métricas e informações financeiras',
        detailedDescription: 'Dashboard financeiro com métricas de receitas, despesas, pagamentos, análises financeiras e relatórios. Fornece visão consolidada da saúde financeira da escola.',
        features: [
          'Métricas financeiras',
          'Receitas e despesas',
          'Análise de pagamentos',
          'Gráficos financeiros',
          'Indicadores de saúde financeira',
        ],
        useCases: [
          'Monitorar situação financeira',
          'Acompanhar receitas e despesas',
          'Analisar pagamentos',
          'Visualizar indicadores financeiros',
        ],
        relatedPages: ['dashboard-visao-geral', 'dashboard-academico'],
        breadcrumb: 'Financeiro',
        parentMenu: 'Dashboard',
        menuPath: 'Dashboard > Financeiro',
      },
      {
        id: 'dashboard-academico',
        name: 'Acadêmico',
        icon: 'BarChart3',
        iconColor: 'text-blue-600',
        routePattern: '/escola/:slug/painel/academico',
        description: 'Painel com métricas e informações acadêmicas',
        detailedDescription: 'Dashboard acadêmico com métricas de desempenho, estatísticas de turmas e alunos, análises educacionais e indicadores de qualidade do ensino.',
        features: [
          'Métricas acadêmicas',
          'Estatísticas de turmas e alunos',
          'Análise de desempenho',
          'Gráficos educacionais',
          'Indicadores de qualidade',
        ],
        useCases: [
          'Monitorar desempenho acadêmico',
          'Acompanhar estatísticas de turmas',
          'Analisar indicadores educacionais',
          'Visualizar métricas de alunos',
        ],
        relatedPages: ['dashboard-visao-geral', 'turmas', 'alunos'],
        breadcrumb: 'Acadêmico',
        parentMenu: 'Dashboard',
        menuPath: 'Dashboard > Acadêmico',
      },
    ],
  },
  {
    id: 'administracao',
    name: 'Administração',
    icon: 'Building2',
    iconColor: 'text-amber-500',
    description: 'Gerenciamento administrativo da escola',
    category: 'administracao',
    requiresPermission: {
      resource: 'users',
      action: 'read',
    },
    children: [
      {
        id: 'gerenciar-escola',
        name: 'Gerenciar Escola',
        icon: 'School',
        iconColor: 'text-amber-400',
        routePattern: '/escola/:slug/escola-atual',
        description: 'Configurações e informações da escola',
        detailedDescription: 'Página para gerenciar informações gerais da escola, dados cadastrais, endereço, contatos, redes sociais e configurações básicas.',
        features: [
          'Editar dados gerais da escola',
          'Gerenciar endereço',
          'Configurar contatos',
          'Gerenciar redes sociais',
          'Upload de logo',
        ],
        useCases: [
          'Atualizar dados da escola',
          'Configurar informações de contato',
          'Gerenciar endereço',
          'Personalizar logo da escola',
        ],
        relatedPages: ['equipe', 'permissoes'],
        breadcrumb: 'Escola',
        parentMenu: 'Administração',
        menuPath: 'Administração > Gerenciar Escola',
      },
      {
        id: 'matricula',
        name: 'Matrícula',
        icon: 'ClipboardCheck',
        iconColor: 'text-amber-500',
        routePattern: '/escola/:slug/matricula',
        description: 'Gerencie matrículas de novos alunos',
        detailedDescription: 'Sistema para realizar matrículas de novos alunos na escola, incluindo cadastro de informações pessoais, seleção de turma e período letivo.',
        features: [
          'Cadastrar novos alunos',
          'Realizar matrículas',
          'Selecionar turma',
          'Definir período letivo',
        ],
        useCases: [
          'Matricular novos alunos',
          'Cadastrar alunos na escola',
          'Iniciar processo de matrícula',
        ],
        relatedPages: ['rematricula', 'matriculas', 'alunos'],
        breadcrumb: 'Matrícula',
        parentMenu: 'Administração',
        menuPath: 'Administração > Matrícula',
      },
      {
        id: 'rematricula',
        name: 'Rematrícula',
        icon: 'RefreshCw',
        iconColor: 'text-amber-500',
        routePattern: '/escola/:slug/rematricula',
        description: 'Gerencie rematrículas de alunos existentes',
        detailedDescription: 'Sistema para realizar rematrículas de alunos já cadastrados, permitindo renovar matrículas para novos períodos letivos.',
        features: [
          'Rematricular alunos existentes',
          'Renovar matrículas',
          'Atualizar informações',
          'Selecionar novo período',
        ],
        useCases: [
          'Renovar matrículas',
          'Rematricular alunos',
          'Atualizar dados de matrícula',
        ],
        relatedPages: ['matricula', 'matriculas', 'alunos'],
        breadcrumb: 'Rematrícula',
        parentMenu: 'Administração',
        menuPath: 'Administração > Rematrícula',
      },
      {
        id: 'equipe',
        name: 'Equipe',
        icon: 'UserCog',
        iconColor: 'text-amber-500',
        routePattern: '/escola/:slug/usuarios',
        description: 'Gerencie os membros da equipe e seus perfis',
        detailedDescription: 'Gerenciamento de usuários da escola, incluindo adicionar membros da equipe, definir perfis de acesso, gerenciar permissões e visualizar lista de usuários.',
        features: [
          'Listar membros da equipe',
          'Adicionar novos usuários',
          'Gerenciar perfis de acesso',
          'Visualizar informações de usuários',
        ],
        useCases: [
          'Gerenciar membros da equipe',
          'Adicionar novos usuários',
          'Visualizar lista de usuários',
          'Configurar perfis de acesso',
        ],
        requiresPermission: {
          resource: 'users',
          action: 'read',
        },
        relatedPages: ['permissoes', 'gerenciar-escola'],
        breadcrumb: 'Usuários',
        parentMenu: 'Administração',
        menuPath: 'Administração > Equipe',
      },
      {
        id: 'permissoes',
        name: 'Permissões',
        icon: 'Shield',
        iconColor: 'text-amber-600',
        routePattern: '/escola/:slug/permissoes',
        description: 'Gerencie permissões e acessos dos usuários',
        detailedDescription: 'Sistema de gerenciamento de permissões para controlar acesso de usuários a diferentes recursos e funcionalidades do sistema.',
        features: [
          'Gerenciar permissões de usuários',
          'Definir acessos por recurso',
          'Controlar ações permitidas',
          'Visualizar permissões',
        ],
        useCases: [
          'Configurar permissões de usuários',
          'Controlar acesso a recursos',
          'Definir níveis de acesso',
          'Gerenciar segurança do sistema',
        ],
        requiresPermission: {
          resource: 'users',
          action: 'create',
        },
        relatedPages: ['equipe', 'gerenciar-escola'],
        breadcrumb: 'Permissões',
        parentMenu: 'Administração',
        menuPath: 'Administração > Permissões',
      },
    ],
  },
  {
    id: 'academico',
    name: 'Acadêmico',
    icon: 'GraduationCap',
    iconColor: 'text-purple-500',
    description: 'Gerenciamento acadêmico',
    category: 'academico',
    children: [
      {
        id: 'turmas',
        name: 'Turmas',
        icon: 'Users',
        iconColor: 'text-purple-400',
        routePattern: '/escola/:slug/turmas',
        description: 'Gerencie as turmas e classes da escola',
        detailedDescription: 'Sistema para gerenciar turmas da escola, incluindo criar, editar, visualizar turmas, gerenciar alunos por turma e visualizar detalhes de cada turma.',
        features: [
          'Listar turmas',
          'Criar e editar turmas',
          'Gerenciar alunos por turma',
          'Visualizar detalhes da turma',
        ],
        useCases: [
          'Gerenciar turmas da escola',
          'Organizar alunos em turmas',
          'Visualizar informações de turmas',
          'Criar novas turmas',
        ],
        relatedPages: ['alunos', 'matriculas', 'dashboard-academico'],
        breadcrumb: 'Turmas',
        parentMenu: 'Acadêmico',
        menuPath: 'Acadêmico > Turmas',
      },
      {
        id: 'alunos',
        name: 'Alunos',
        icon: 'BookOpen',
        iconColor: 'text-purple-500',
        routePattern: '/escola/:slug/alunos',
        description: 'Gerencie o cadastro e informações dos alunos',
        detailedDescription: 'Sistema completo para gerenciar alunos da escola, incluindo cadastro, edição, visualização de perfil, histórico acadêmico e informações detalhadas de cada aluno.',
        features: [
          'Listar alunos',
          'Criar e editar alunos',
          'Visualizar perfil do aluno',
          'Histórico acadêmico',
          'Buscar alunos',
        ],
        useCases: [
          'Gerenciar cadastro de alunos',
          'Visualizar informações de alunos',
          'Consultar histórico acadêmico',
          'Atualizar dados de alunos',
        ],
        relatedPages: ['turmas', 'matriculas'],
        breadcrumb: 'Alunos',
        parentMenu: 'Acadêmico',
        menuPath: 'Acadêmico > Alunos',
      },
      {
        id: 'matriculas',
        name: 'Matrículas',
        icon: 'ClipboardList',
        iconColor: 'text-purple-600',
        routePattern: '/escola/:slug/matriculas',
        description: 'Visualize e gerencie todas as matrículas dos alunos',
        detailedDescription: 'Sistema para visualizar e gerenciar todas as matrículas dos alunos, incluindo histórico de matrículas, status, períodos letivos e informações relacionadas.',
        features: [
          'Listar matrículas',
          'Visualizar histórico de matrículas',
          'Gerenciar matrículas existentes',
          'Filtrar matrículas',
        ],
        useCases: [
          'Consultar matrículas',
          'Visualizar histórico',
          'Gerenciar matrículas',
          'Acompanhar status de matrículas',
        ],
        relatedPages: ['alunos', 'turmas', 'matricula'],
        breadcrumb: 'Matrículas',
        parentMenu: 'Acadêmico',
        menuPath: 'Acadêmico > Matrículas',
      },
    ],
  },
  {
    id: 'calendario',
    name: 'Calendário',
    icon: 'Calendar',
    iconColor: 'text-cyan-500',
    description: 'Calendário escolar e eventos',
    category: 'calendario',
    children: [
      {
        id: 'ver-calendario',
        name: 'Ver Calendário',
        icon: 'Eye',
        iconColor: 'text-cyan-400',
        routePattern: '/escola/:slug/calendario',
        description: 'Visualize eventos e atividades do calendário escolar',
        detailedDescription: 'Visualização do calendário escolar com todos os eventos, atividades, feriados e datas importantes. Permite visualizar eventos por mês, filtrar por tipo e visualizar detalhes.',
        features: [
          'Visualizar calendário',
          'Ver eventos e atividades',
          'Filtrar por tipo de evento',
          'Visualizar detalhes de eventos',
        ],
        useCases: [
          'Consultar calendário escolar',
          'Visualizar eventos',
          'Acompanhar atividades',
          'Ver datas importantes',
        ],
        relatedPages: ['novo-evento'],
        breadcrumb: 'Calendário',
        parentMenu: 'Calendário',
        menuPath: 'Calendário > Ver Calendário',
      },
      {
        id: 'novo-evento',
        name: 'Novo Evento',
        icon: 'Plus',
        iconColor: 'text-cyan-600',
        routePattern: '/escola/:slug/calendario/novo',
        description: 'Crie um novo evento no calendário escolar',
        detailedDescription: 'Formulário para criar novos eventos no calendário escolar, incluindo data, hora, descrição, tipo de evento e outras informações relevantes.',
        features: [
          'Criar novos eventos',
          'Definir data e hora',
          'Adicionar descrição',
          'Selecionar tipo de evento',
        ],
        useCases: [
          'Adicionar eventos ao calendário',
          'Criar atividades escolares',
          'Agendar eventos',
        ],
        relatedPages: ['ver-calendario'],
        breadcrumb: 'Novo Evento',
        parentMenu: 'Calendário',
        menuPath: 'Calendário > Novo Evento',
      },
    ],
  },
  {
    id: 'criador-sites',
    name: 'Criador de Sites',
    icon: 'Globe',
    iconColor: 'text-pink-500',
    description: 'Editor de sites para a escola',
    category: 'sites',
    children: [
      {
        id: 'meus-sites',
        name: 'Meus Sites',
        icon: 'Layout',
        iconColor: 'text-pink-400',
        routePattern: '/escola/:slug/sites',
        description: 'Gerencie os sites criados para sua escola',
        detailedDescription: 'Lista de todos os sites criados para a escola usando o editor de sites. Permite visualizar, editar, publicar e gerenciar sites criados.',
        features: [
          'Listar sites criados',
          'Visualizar sites',
          'Editar sites existentes',
          'Publicar sites',
          'Gerenciar versões',
        ],
        useCases: [
          'Gerenciar sites da escola',
          'Visualizar sites criados',
          'Editar sites existentes',
          'Publicar sites',
        ],
        relatedPages: ['criar-site'],
        breadcrumb: 'Meus Sites',
        parentMenu: 'Criador de Sites',
        menuPath: 'Criador de Sites > Meus Sites',
      },
      {
        id: 'criar-site',
        name: 'Criar Novo',
        icon: 'Plus',
        iconColor: 'text-pink-600',
        routePattern: '/escola/:slug/sites/novo',
        description: 'Crie um novo site para sua escola',
        detailedDescription: 'Editor visual de sites para criar páginas web personalizadas para a escola. Inclui componentes drag-and-drop, templates e sistema de publicação.',
        features: [
          'Editor visual de sites',
          'Componentes drag-and-drop',
          'Templates pré-configurados',
          'Sistema de publicação',
          'Preview em tempo real',
        ],
        useCases: [
          'Criar site para a escola',
          'Desenvolver páginas web',
          'Publicar conteúdo online',
        ],
        relatedPages: ['meus-sites'],
        breadcrumb: 'Criar Novo Site',
        parentMenu: 'Criador de Sites',
        menuPath: 'Criador de Sites > Criar Novo',
      },
    ],
  },
  {
    id: 'documentos',
    name: 'Documentos',
    icon: 'FileText',
    iconColor: 'text-teal-500',
    description: 'Gerenciamento de documentos',
    category: 'documentos',
    children: [
      {
        id: 'documentos-page',
        name: 'Documentos',
        icon: 'FileText',
        iconColor: 'text-teal-500',
        routePattern: '/escola/:slug/documentos',
        description: 'Gerencie documentos e arquivos da escola',
        detailedDescription: 'Sistema para gerenciar documentos e arquivos da escola, incluindo upload, organização por categorias, compartilhamento e download de documentos.',
        features: [
          'Listar documentos',
          'Upload de documentos',
          'Organizar por categorias',
          'Compartilhamento',
          'Download de documentos',
        ],
        useCases: [
          'Gerenciar documentos da escola',
          'Armazenar arquivos',
          'Compartilhar documentos',
          'Organizar arquivos',
        ],
        relatedPages: [],
        breadcrumb: 'Documentos',
        parentMenu: 'Documentos',
        menuPath: 'Documentos',
      },
    ],
  },
  {
    id: 'configuracoes',
    name: 'Configurações',
    icon: 'Settings',
    iconColor: 'text-red-500',
    description: 'Configurações do sistema',
    category: 'configuracoes',
    children: [
      {
        id: 'configuracoes-page',
        name: 'Configurações',
        icon: 'Settings',
        iconColor: 'text-red-500',
        routePattern: '/escola/:slug/configuracoes',
        description: 'Preferências e configurações do sistema',
        detailedDescription: 'Página de configurações gerais do sistema, preferências do usuário e ajustes de funcionalidades.',
        features: [
          'Configurações gerais',
          'Preferências do usuário',
          'Ajustes de funcionalidades',
        ],
        useCases: [
          'Ajustar configurações',
          'Personalizar preferências',
          'Configurar funcionalidades',
        ],
        relatedPages: [],
        breadcrumb: 'Configurações',
        parentMenu: 'Configurações',
        menuPath: 'Configurações',
      },
    ],
  },
];

/**
 * Mapa de todas as páginas por ID para busca rápida
 */
export const PAGES_BY_ID: Map<string, MenuItem> = new Map();

/**
 * Mapa de páginas por padrão de rota
 */
export const PAGES_BY_ROUTE: Map<string, MenuItem> = new Map();

// Popular os mapas
SITEMAP_DATA.forEach((section) => {
  section.children.forEach((item) => {
    PAGES_BY_ID.set(item.id, item);
    PAGES_BY_ROUTE.set(item.routePattern, item);
  });
});
