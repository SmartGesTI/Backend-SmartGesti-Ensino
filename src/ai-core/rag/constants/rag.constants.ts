/**
 * Constantes do sistema RAG
 * Baseado nas melhores práticas do GPT-5.2 e text-embedding-3
 */

// Configurações de Embedding
export const EMBEDDING_CONFIG = {
  MODEL: 'text-embedding-3-small',
  DIMENSIONS: 1536,
  MAX_INPUT_TOKENS: 8191,
  BATCH_SIZE: 100, // Máximo de textos por request
} as const;

// Configurações de Chunking
export const CHUNK_CONFIG = {
  MAX_TOKENS: 512,
  OVERLAP_TOKENS: 50,
  MIN_CHUNK_SIZE: 100,
  SPLIT_BY_HEADING: true,
  PRESERVE_CODE_BLOCKS: true,
} as const;

// Configurações de Busca
export const SEARCH_CONFIG = {
  DEFAULT_TOP_K: 5,
  MAX_TOP_K: 20,
  SIMILARITY_THRESHOLD: 0.5, // Reduzido de 0.7 para capturar mais resultados relevantes
  HYBRID_SEMANTIC_WEIGHT: 0.7,
  HYBRID_FULLTEXT_WEIGHT: 0.3,
} as const;

// Configurações do LLM (GPT-5.2-nano)
export const LLM_CONFIG = {
  MODEL: 'gpt-5.2-nano',
  REASONING_EFFORT: 'medium' as const,
  MAX_TOKENS: 4096,
  TEMPERATURE: 0.7,
} as const;

// Categorias de documentação
export const RAG_CATEGORIES = [
  'ia',
  'dashboard',
  'academico',
  'administracao',
  'calendario',
  'sites',
  'documentos',
  'configuracoes',
  'geral',
] as const;

export type RagCategory = (typeof RAG_CATEGORIES)[number];

// Schema de frontmatter esperado
export interface DocumentFrontmatter {
  id: string;
  title: string;
  category: RagCategory;
  route?: string;
  routePattern?: string; // Preferred over 'route' - pattern with :slug placeholder
  menuPath?: string;
  tags?: string[];
  permissions?: string[];
  relatedPages?: string[];
  lastUpdated?: string;
}

// Tipos de seções de documento
export const DOCUMENT_SECTION_TYPES = [
  'description',
  'location',
  'features',
  'how-to',
  'faq',
  'troubleshooting',
  'permissions',
] as const;

export type DocumentSectionType = (typeof DOCUMENT_SECTION_TYPES)[number];
