import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agent, run, setDefaultOpenAIKey } from '@openai/agents';
import { LoggerService } from '../common/logger/logger.service';

/**
 * Schema simplificado para geração por IA
 * (Versão inline do @smartgesti/site-editor/shared)
 */
interface SimpleColorTokens {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

interface SimpleTypographyTokens {
  fontFamily: string;
  fontFamilyHeading: string;
  baseFontSize: string;
  lineHeight: number;
  headingLineHeight: number;
}

interface SimpleSpacingTokens {
  unit: string;
  scale: number[];
}

interface SimpleEffectTokens {
  borderRadius: string;
  shadow: string;
  shadowLg: string;
  transition: string;
}

interface SimpleThemeTokens {
  colors: SimpleColorTokens;
  typography: SimpleTypographyTokens;
  spacing: SimpleSpacingTokens;
  effects: SimpleEffectTokens;
}

interface DocumentMeta {
  title: string;
  description?: string;
  favicon?: string;
  language?: string;
}

interface Block {
  id: string;
  type: string;
  props: Record<string, any>;
}

export interface GeneratedSiteDocument {
  meta: DocumentMeta;
  theme: SimpleThemeTokens;
  structure: Block[];
}

export interface GenerationOptions {
  language?: string;
  tone?: 'formal' | 'informal' | 'technical' | 'friendly';
  model?: string;
  businessContext?: string;
  baseTemplateId?: string;
  maxSections?: number;
  /** Documento atual para modo de edição (se fornecido, a IA vai editar em vez de gerar do zero) */
  currentDocument?: GeneratedSiteDocument;
}

export interface GenerationResult {
  success: boolean;
  document?: GeneratedSiteDocument;
  patches?: PatchOperation[];
  error?: string;
  processingTime?: number;
  model?: string;
}

/** JSON Patch Operation (RFC 6902) */
export interface PatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
}

/**
 * System prompt para geração de sites (do zero)
 */
const SITE_GENERATOR_SYSTEM_PROMPT = `Você é um assistente especializado em gerar estruturas JSON para landing pages modernas e profissionais.

TAREFA: Gerar um documento SiteDocumentV2 válido em JSON baseado na descrição do usuário.

## SiteDocumentV2 Schema

O documento deve ter esta estrutura:
{
  "meta": {
    "title": "string",
    "description": "string",
    "language": "string"
  },
  "theme": {
    "colors": {
      "primary": "#hex",
      "secondary": "#hex",
      "accent": "#hex",
      "background": "#hex",
      "surface": "#hex",
      "text": "#hex",
      "textMuted": "#hex",
      "border": "#hex",
      "success": "#hex",
      "warning": "#hex",
      "error": "#hex"
    },
    "typography": {
      "fontFamily": "string",
      "fontFamilyHeading": "string",
      "baseFontSize": "string",
      "lineHeight": number,
      "headingLineHeight": number
    },
    "spacing": {
      "unit": "string",
      "scale": [number array]
    },
    "effects": {
      "borderRadius": "string",
      "shadow": "string",
      "shadowLg": "string",
      "transition": "string"
    }
  },
  "structure": [Block array]
}

## Block Types e Props

Cada bloco tem: { "id": "unique-string", "type": "blockType", "props": {...} }

### Composed Sections (Recomendados para Landing Pages)
- navbar: { logo?: {src,alt,href}, links: [{text,href}], sticky?: boolean, transparent?: boolean }
- hero: { title: string, subtitle?: string, description?: string, image?: string, primaryButton?: {text,href}, secondaryButton?: {text,href}, variant?: "centered"|"split"|"background", align?: string }
- featureGrid: { title?: string, subtitle?: string, columns?: 2|3|4, features: [{icon,title,description}] }
- stats: { items: [{value,label,description}] }
- pricing: { title?: string, subtitle?: string, plans: [{name,price,period,description,features[],buttonText,highlighted}] }
- testimonialGrid: { title?: string, testimonials: [{quote,author,role,company,avatar}] }
- faq: { title?: string, items: [{question,answer}] }
- cta: { title: string, description?: string, buttonText: string, buttonHref?: string, variant?: "simple"|"centered"|"split" }
- logoCloud: { title?: string, logos: [{src,alt,href}] }

## Regras OBRIGATÓRIAS:

1. RETORNE APENAS JSON VÁLIDO - sem markdown, sem explicações, sem código
2. Cada bloco DEVE ter um "id" único (use formato: "tipo-N", ex: "hero-1", "feature-1")
3. Use os blocos compostos para landing pages
4. Mantenha cores consistentes usando o tema definido
5. Use textos realistas e relevantes ao contexto do usuário
6. Inclua sempre: navbar, hero, pelo menos 2 seções de conteúdo, e cta

## Estrutura típica de landing page:
1. navbar - navegação
2. hero - seção principal
3. featureGrid ou stats - diferenciais
4. pricing ou testimonialGrid - social proof ou preços
5. faq - perguntas frequentes
6. cta - chamada para ação final
`;

/**
 * System prompt para refinamento de seções
 */
const SECTION_REFINE_SYSTEM_PROMPT = `Você é um assistente que edita seções específicas de landing pages.

TAREFA: Modificar a seção fornecida baseado nas instruções do usuário.

## Regras:
1. RETORNE APENAS o JSON da seção modificada
2. Mantenha o "id" original do bloco
3. Mantenha o "type" original (a menos que explicitamente pedido para mudar)
4. Aplique apenas as alterações solicitadas
5. Preserve props não mencionados
`;

/**
 * System prompt para EDIÇÃO via PATCHES (JSON Patch RFC 6902)
 * MUITO mais rápido pois retorna apenas as alterações
 */
const SITE_PATCH_SYSTEM_PROMPT = `Você é um assistente que gera patches JSON Patch (RFC 6902) para editar landing pages.

TAREFA: Analisar o documento e a instrução do usuário, retornar APENAS um array de operações JSON Patch.

## Formato JSON Patch (RFC 6902)
Cada operação é um objeto com:
- "op": "add" | "remove" | "replace" | "move" | "copy"
- "path": caminho JSON (ex: "/theme/colors/primary", "/structure/0/props/bg")
- "value": novo valor (para add/replace)
- "from": caminho origem (para move/copy)

## Exemplos de Patches:

### Mudar cor primária:
[{"op":"replace","path":"/theme/colors/primary","value":"#22c55e"}]

### Mudar cor de fundo do navbar (structure[0]):
[{"op":"replace","path":"/structure/0/props/bg","value":"linear-gradient(135deg, #3b82f6, #60a5fa)"}]

### Mudar texto de um bloco:
[{"op":"replace","path":"/structure/1/props/children/0/props/children/0/props/text","value":"Novo Título"}]

### Adicionar nova propriedade:
[{"op":"add","path":"/structure/0/props/sticky","value":true}]

### Remover um bloco (ex: remover terceiro item do structure):
[{"op":"remove","path":"/structure/2"}]

## Caminhos comuns:
- /theme/colors/primary - cor primária
- /theme/colors/background - cor de fundo
- /theme/colors/text - cor do texto
- /structure/N - N-ésimo bloco (0=navbar, 1=hero, etc)
- /structure/N/props/bg - cor de fundo de um bloco
- /structure/N/props/children/M/props/text - texto de elemento filho

## REGRAS:
1. RETORNE APENAS um array JSON de patches - SEM markdown, SEM explicações
2. Use caminhos EXATOS baseados no documento fornecido
3. Prefira "replace" para atualizar valores existentes
4. Use "add" apenas para propriedades que NÃO existem
5. Para gradientes, use: "linear-gradient(135deg, cor1, cor2)"
6. Cores devem ser hex (#RRGGBB) ou CSS válido

RETORNE APENAS O ARRAY JSON DE PATCHES.
`;

/**
 * Tema padrão
 */
const DEFAULT_THEME: SimpleThemeTokens = {
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    accent: '#f59e0b',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1e293b',
    textMuted: '#64748b',
    border: '#e2e8f0',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontFamilyHeading: 'Inter, system-ui, sans-serif',
    baseFontSize: '16px',
    lineHeight: 1.6,
    headingLineHeight: 1.2,
  },
  spacing: {
    unit: '0.25rem',
    scale: [0, 1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64],
  },
  effects: {
    borderRadius: '0.5rem',
    shadow: '0 1px 3px rgba(0,0,0,0.1)',
    shadowLg: '0 10px 15px rgba(0,0,0,0.1)',
    transition: '0.2s ease',
  },
};

@Injectable()
export class SiteGeneratorService {
  private readonly openaiApiKey: string;
  private readonly defaultModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.defaultModel = this.configService.get<string>('OPENAI_DEFAULT_MODEL') || 'gpt-4.1-mini';

    if (!this.openaiApiKey) {
      this.logger.warn('OPENAI_API_KEY não configurada. Geração de sites por IA não funcionará.', 'SiteGeneratorService');
    } else {
      setDefaultOpenAIKey(this.openaiApiKey);
    }
  }

  /**
   * Gera um site completo a partir de um prompt do usuário
   */
  async generateSite(
    prompt: string,
    options: GenerationOptions = {},
  ): Promise<GenerationResult> {
    if (!this.openaiApiKey) {
      return {
        success: false,
        error: 'OPENAI_API_KEY não configurada',
      };
    }

    const startTime = Date.now();
    const {
      language = 'pt-BR',
      tone = 'formal',
      model,
      businessContext,
      maxSections = 8,
    } = options;

    const modelToUse = model || this.defaultModel;

    this.logger.log(`Gerando site com modelo: ${modelToUse}`, 'SiteGeneratorService');

    try {
      // Montar prompt completo
      let fullPrompt = prompt;
      
      if (language !== 'pt-BR') {
        fullPrompt += `\n\nIdioma do conteúdo: ${language}`;
      }
      
      if (tone) {
        fullPrompt += `\n\nTom do texto: ${tone}`;
      }
      
      if (businessContext) {
        fullPrompt += `\n\nContexto do negócio: ${businessContext}`;
      }
      
      fullPrompt += `\n\nLimite de seções: máximo ${maxSections} blocos na estrutura principal`;

      // Criar agente
      const agent = new Agent({
        name: 'SiteGenerator',
        instructions: SITE_GENERATOR_SYSTEM_PROMPT,
        model: modelToUse,
      });

      // Executar
      const result = await run(agent, fullPrompt);

      // LOG DETALHADO DA RESPOSTA
      this.logger.log(`=== RESPOSTA DO AGENTE ==`, 'SiteGeneratorService');
      this.logger.log(`Prompt enviado: ${fullPrompt}`, 'SiteGeneratorService');
      this.logger.log(`Result keys: ${Object.keys(result).join(', ')}`, 'SiteGeneratorService');
      this.logger.log(`finalOutput (primeiros 500 chars): ${(result.finalOutput || '').substring(0, 500)}`, 'SiteGeneratorService');
      this.logger.log(`finalOutput length: ${(result.finalOutput || '').length}`, 'SiteGeneratorService');

      // Parsear resposta
      const output = result.finalOutput || '';
      let document: GeneratedSiteDocument;

      try {
        // Limpar markdown se presente
        let cleanedOutput = output.trim();
        if (cleanedOutput.startsWith('```json')) {
          cleanedOutput = cleanedOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedOutput.startsWith('```')) {
          cleanedOutput = cleanedOutput.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        document = JSON.parse(cleanedOutput);
      } catch (parseError) {
        // Tentar extrair JSON do texto
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) {
          document = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Resposta não contém JSON válido');
        }
      }

      // Validar e sanitizar documento
      document = this.sanitizeDocument(document);

      // LOG DO DOCUMENTO SANITIZADO
      this.logger.log(`=== DOCUMENTO GERADO ==`, 'SiteGeneratorService');
      this.logger.log(`Meta: ${JSON.stringify(document.meta)}`, 'SiteGeneratorService');
      this.logger.log(`Structure blocks: ${document.structure.length}`, 'SiteGeneratorService');
      this.logger.log(`Block types: ${document.structure.map(b => b.type).join(', ')}`, 'SiteGeneratorService');
      this.logger.log(`Structure (primeiros 1000 chars): ${JSON.stringify(document.structure).substring(0, 1000)}`, 'SiteGeneratorService');

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        document,
        processingTime,
        model: modelToUse,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao gerar site: ${error.message}`, 'SiteGeneratorService');
      return {
        success: false,
        error: error.message || 'Erro desconhecido durante a geração',
      };
    }
  }

  /**
   * Refina uma seção específica do site
   */
  async refineSection(
    currentSection: Block,
    instruction: string,
    options: { model?: string } = {},
  ): Promise<{ success: boolean; section?: Block; error?: string }> {
    if (!this.openaiApiKey) {
      return {
        success: false,
        error: 'OPENAI_API_KEY não configurada',
      };
    }

    try {
      const modelToUse = options.model || this.defaultModel;

      const prompt = `Seção atual:
${JSON.stringify(currentSection, null, 2)}

Instrução de modificação:
${instruction}

Retorne APENAS o JSON da seção modificada.`;

      const agent = new Agent({
        name: 'SectionRefiner',
        instructions: SECTION_REFINE_SYSTEM_PROMPT,
        model: modelToUse,
      });

      const result = await run(agent, prompt);

      const output = result.finalOutput || '';
      let section: Block;

      try {
        let cleanedOutput = output.trim();
        if (cleanedOutput.startsWith('```json')) {
          cleanedOutput = cleanedOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedOutput.startsWith('```')) {
          cleanedOutput = cleanedOutput.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        section = JSON.parse(cleanedOutput);
      } catch (parseError) {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) {
          section = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Resposta não contém JSON válido');
        }
      }

      // Garantir que id e type estão presentes
      if (!section.id) section.id = currentSection.id;
      if (!section.type) section.type = currentSection.type;

      return { success: true, section };
    } catch (error: any) {
      this.logger.error(`Erro ao refinar seção: ${error.message}`, 'SiteGeneratorService');
      return {
        success: false,
        error: error.message || 'Erro desconhecido',
      };
    }
  }

  /**
   * Gera patches para editar um documento existente (modo rápido)
   * Retorna apenas as operações de patch, não o documento inteiro
   */
  async generatePatches(
    currentDocument: GeneratedSiteDocument,
    instruction: string,
    options: { model?: string } = {},
  ): Promise<{ success: boolean; patches?: PatchOperation[]; error?: string; processingTime?: number }> {
    if (!this.openaiApiKey) {
      return {
        success: false,
        error: 'OPENAI_API_KEY não configurada',
      };
    }

    const startTime = Date.now();
    const modelToUse = options.model || this.defaultModel;

    this.logger.log(`[PATCH MODE] Gerando patches | Modelo: ${modelToUse}`, 'SiteGeneratorService');

    try {
      // Resumo simplificado do documento para o prompt (reduz tokens)
      const docSummary = {
        theme: {
          colors: currentDocument.theme.colors,
        },
        structure: currentDocument.structure.map((block, index) => ({
          index,
          id: block.id,
          type: block.type,
          // Incluir apenas props relevantes para edição
          bg: block.props?.bg,
          text: block.props?.text,
          title: block.props?.title,
        })),
      };

      const prompt = `## Resumo do documento atual:
\`\`\`json
${JSON.stringify(docSummary, null, 2)}
\`\`\`

## Instrução do usuário:
${instruction}

Gere o array de patches JSON Patch para aplicar esta alteração.`;

      const agent = new Agent({
        name: 'SitePatcher',
        instructions: SITE_PATCH_SYSTEM_PROMPT,
        model: modelToUse,
      });

      const result = await run(agent, prompt);
      const output = result.finalOutput || '';

      this.logger.log(`[PATCH MODE] Resposta: ${output.substring(0, 500)}`, 'SiteGeneratorService');

      // Parsear patches
      let patches: PatchOperation[];

      try {
        let cleanedOutput = output.trim();
        if (cleanedOutput.startsWith('```json')) {
          cleanedOutput = cleanedOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedOutput.startsWith('```')) {
          cleanedOutput = cleanedOutput.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        patches = JSON.parse(cleanedOutput);
      } catch (parseError) {
        // Tentar extrair array do texto
        const arrayMatch = output.match(/\[[\s\S]*\]/);
        if (arrayMatch && arrayMatch[0]) {
          patches = JSON.parse(arrayMatch[0]);
        } else {
          throw new Error('Resposta não contém array de patches válido');
        }
      }

      // Validar patches
      if (!Array.isArray(patches)) {
        throw new Error('Resposta não é um array de patches');
      }

      // Validar cada patch
      patches = patches.filter(p => {
        if (!p.op || !p.path) return false;
        if (!['add', 'remove', 'replace', 'move', 'copy', 'test'].includes(p.op)) return false;
        return true;
      });

      const processingTime = Date.now() - startTime;

      this.logger.log(`[PATCH MODE] ${patches.length} patches gerados em ${processingTime}ms`, 'SiteGeneratorService');
      this.logger.log(`[PATCH MODE] Patches: ${JSON.stringify(patches)}`, 'SiteGeneratorService');

      return {
        success: true,
        patches,
        processingTime,
      };
    } catch (error: any) {
      this.logger.error(`[PATCH MODE] Erro: ${error.message}`, 'SiteGeneratorService');
      return {
        success: false,
        error: error.message || 'Erro ao gerar patches',
      };
    }
  }

  /**
   * Sanitiza e valida documento gerado
   */
  private sanitizeDocument(doc: any): GeneratedSiteDocument {
    // Garantir estrutura básica
    const sanitized: GeneratedSiteDocument = {
      meta: {
        title: doc.meta?.title || 'Untitled Site',
        description: doc.meta?.description,
        favicon: doc.meta?.favicon,
        language: doc.meta?.language || 'pt-BR',
      },
      theme: { ...DEFAULT_THEME },
      structure: [],
    };

    // Merge theme se presente
    if (doc.theme) {
      if (doc.theme.colors) {
        sanitized.theme.colors = { ...DEFAULT_THEME.colors, ...doc.theme.colors };
      }
      if (doc.theme.typography) {
        sanitized.theme.typography = { ...DEFAULT_THEME.typography, ...doc.theme.typography };
      }
      if (doc.theme.spacing) {
        sanitized.theme.spacing = { ...DEFAULT_THEME.spacing, ...doc.theme.spacing };
      }
      if (doc.theme.effects) {
        sanitized.theme.effects = { ...DEFAULT_THEME.effects, ...doc.theme.effects };
      }
    }

    // Sanitizar blocos
    if (doc.structure && Array.isArray(doc.structure)) {
      const usedIds = new Set<string>();
      let idCounter = 1;

      sanitized.structure = doc.structure.map((block: any) => {
        if (!block || typeof block !== 'object') return null;

        // Garantir id único
        let id = block.id;
        if (!id || usedIds.has(id)) {
          id = `${block.type || 'block'}-${idCounter++}`;
          while (usedIds.has(id)) {
            id = `${block.type || 'block'}-${idCounter++}`;
          }
        }
        usedIds.add(id);

        return {
          id,
          type: block.type || 'box',
          props: block.props || {},
        };
      }).filter(Boolean);
    }

    return sanitized;
  }

  /**
   * Lista templates disponíveis
   */
  getAvailableTemplates(): Array<{ id: string; name: string; description: string }> {
    return [
      { id: 'landing-saas', name: 'SaaS / Software', description: 'Template para produtos digitais' },
      { id: 'landing-escola', name: 'Escola / Curso', description: 'Para instituições de ensino' },
      { id: 'landing-portfolio', name: 'Portfolio', description: 'Para freelancers e criativos' },
      { id: 'landing-empresa', name: 'Empresa / Serviços', description: 'Para empresas e consultorias' },
      { id: 'landing-evento', name: 'Evento', description: 'Para conferências e workshops' },
    ];
  }
}
