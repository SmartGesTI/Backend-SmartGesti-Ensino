import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agent, run, setDefaultOpenAIKey } from '@openai/agents';
import { PdfGeneratorService, ReportDocument } from './pdf-generator.service';
import { MarkdownPdfService } from './markdown-pdf.service';
import { DocumentTextExtractorService } from './document-text-extractor.service';

interface WorkflowNode {
  id: string;
  type: string;
  data: {
    label: string;
    config: {
      model?: string;
      instructions?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  file?: {
    data: string; // base64
    fileName: string;
    mimeType: string;
  };
  error?: string;
  // Informações de processamento da IA
  processingTime?: number; // ms
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  provider?: string;
}

@Injectable()
export class WorkflowExecutorService {
  private readonly logger = new Logger(WorkflowExecutorService.name);
  private readonly openaiApiKey: string;
  private readonly defaultModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly markdownPdfService: MarkdownPdfService,
    private readonly documentTextExtractor: DocumentTextExtractorService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    // SDK usa OPENAI_DEFAULT_MODEL como variável padrão
    // Fallback: gpt-4.1-mini (rápido e econômico para tarefas gerais)
    this.defaultModel = this.configService.get<string>('OPENAI_DEFAULT_MODEL') || 'gpt-4.1-mini';

    // Log do modelo configurado para debug
    this.logger.log(`Modelo OpenAI configurado: ${this.defaultModel}`);

    if (!this.openaiApiKey) {
      this.logger.warn('OPENAI_API_KEY não configurada. Execuções de IA falharão.');
    } else {
      // Configurar chave padrão do OpenAI SDK
      setDefaultOpenAIKey(this.openaiApiKey);
    }
  }

  /**
   * Ordena nós do workflow em ordem topológica
   */
  private getNodesInOrder(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
  ): WorkflowNode[] {
    const targetIds = new Set(edges.map((e) => e.target));
    const inputNodes = nodes.filter((n) => !targetIds.has(n.id));

    if (inputNodes.length === 0) return nodes;

    const dependencies = new Map<string, string[]>();
    edges.forEach((edge) => {
      if (!dependencies.has(edge.target)) {
        dependencies.set(edge.target, []);
      }
      dependencies.get(edge.target)!.push(edge.source);
    });

    const ordered: WorkflowNode[] = [];
    const visited = new Set<string>();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    function visit(nodeId: string) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const deps = dependencies.get(nodeId) || [];
      deps.forEach((dep) => visit(dep));

      const node = nodeMap.get(nodeId);
      if (node) ordered.push(node);
    }

    inputNodes.forEach((n) => visit(n.id));

    nodes.forEach((n) => {
      if (!visited.has(n.id)) {
        ordered.push(n);
      }
    });

    return ordered;
  }

  /**
   * Executa um workflow completo
   */
  async executeWorkflow(
    workflow: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
    params: Record<string, any>,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let totalUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    let modelUsed = this.defaultModel;

    try {
      // Validar quantidade de nós de saída
      const outputNodes = workflow.nodes.filter((n: any) => {
        const nodeType = n.id.split('-').slice(0, -1).join('-') || n.id;
        const category = n.category || n.data?.category;
        return (
          nodeType.startsWith('send-') ||
          nodeType.startsWith('generate-report') ||
          nodeType.startsWith('generate-pdf') ||
          category === 'ENVIAR E GERAR' ||
          category === 'SAIDA'
        );
      });
      if (outputNodes.length === 0) {
        throw new Error('Workflow sem nó de saída (output). Adicione um gerador de relatório ou envio.');
      }
      if (outputNodes.length > 1) {
        throw new Error('Workflow possui múltiplos nós de saída. Mantenha apenas um nó de output.');
      }
      const orderedNodes = this.getNodesInOrder(workflow.nodes, workflow.edges);
      let currentData: any = null;

      // Executar cada nó em ordem
      for (let i = 0; i < orderedNodes.length; i++) {
        const node = orderedNodes[i];
        const nodeType = node.id.split('-').slice(0, -1).join('-') || node.id;

        const nodeCategory = (node as any).category || (node as any).data?.category;

        const isInputNode =
          nodeType.startsWith('receive-') ||
          nodeCategory === 'RECEBER DADOS' ||
          nodeCategory === 'ENTRADA';

        // IMPORTANTE: identificar output primeiro (para não confundir generate-report com IA)
        const isOutputNode =
          nodeType.startsWith('send-') ||
          nodeType.startsWith('generate-report') ||
          nodeType.startsWith('generate-pdf') ||
          nodeCategory === 'ENVIAR E GERAR' ||
          nodeCategory === 'SAIDA';

        const isAINode =
          !isOutputNode &&
          (nodeType.startsWith('analyze-') ||
            nodeType.startsWith('generate-summary') ||
            nodeType.startsWith('classify-') ||
            nodeType.startsWith('extract-') ||
            nodeCategory === 'ANALISAR COM IA' ||
            nodeCategory === 'AGENTES');

        if (isInputNode) {
          currentData = await this.executeInputNode(node, params);
        } else if (isAINode) {
          const nodeParams = params[node.id] || {};
          const extraInstructions = nodeParams.extraInstructions;
          const maxLines = nodeParams.maxLines;

          // Prioridade: 1) modelo da execução, 2) modelo do nó, 3) default
          const executionModel = params._executionModel;
          modelUsed = executionModel || node.data.config?.model || this.defaultModel;

          currentData = await this.executeAINode(
            node,
            currentData,
            extraInstructions,
            { maxLines },
          );

          // Acumular usage se disponível no trace
          if (currentData?.__trace?.usage) {
            totalUsage.prompt_tokens += currentData.__trace.usage.prompt_tokens || 0;
            totalUsage.completion_tokens += currentData.__trace.usage.completion_tokens || 0;
            totalUsage.total_tokens += currentData.__trace.usage.total_tokens || 0;
          }
        } else if (isOutputNode) {
          const nodeParams = params[node.id] || {};
          const format = nodeParams.format || 'pdf';
          const result = await this.executeOutputNode(node, currentData, format);

          const processingTime = Date.now() - startTime;

          return {
            success: true,
            data: currentData,
            file: result,
            processingTime,
            usage: totalUsage.total_tokens > 0 ? totalUsage : undefined,
            model: this.getModelName(modelUsed),
            provider: 'OpenAI',
          };
        }
      }

      const processingTime = Date.now() - startTime;

      // Se chegou aqui sem nó de output, retornar dados finais
      return {
        success: true,
        data: currentData,
        processingTime,
        usage: totalUsage.total_tokens > 0 ? totalUsage : undefined,
        model: this.getModelName(modelUsed),
        provider: 'OpenAI',
      };
    } catch (error: any) {
      this.logger.error('Erro ao executar workflow', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido durante a execução',
      };
    }
  }

  /**
   * Executa um nó de entrada (input)
   */
  private async executeInputNode(
    node: WorkflowNode,
    params: Record<string, any>,
  ): Promise<any> {
    const nodeParams = params[node.id];

    const data = nodeParams?.data;
    const files = nodeParams?.files;

    if (!data && !files) {
      throw new Error(
        `Dados não fornecidos para o nó ${node.data.label}`,
      );
    }

    // Se for arquivo(s), retornar estrutura apropriada
    if (files && Array.isArray(files) && files.length > 0) {
      return {
        files: files,
        text: files.map((f: any) => f.name || f).join(', '),
      };
    } else if (data && typeof data === 'object' && data.name && data.data) {
      return { file: data, text: data.name };
    } else {
      return { text: data };
    }
  }

  /**
   * Executa um nó de IA usando OpenAI Agents SDK
   */
  async executeAINode(
    node: WorkflowNode,
    inputData: any,
    extraInstructions?: string,
    options?: { maxLines?: number; executionModel?: string },
  ): Promise<any> {
    if (!this.openaiApiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const nodeType = node.id.split('-').slice(0, -1).join('-') || node.id;

    // Instruções vêm do frontend (config.instructions)
    const baseInstructions = node.data.config?.instructions?.trim() || '';

    if (!baseInstructions) {
      throw new Error(`Instruções não configuradas para o nó de IA: ${node.data.label}. Configure as instruções no painel de configuração do nó.`);
    }

    // Prioridade: 1) modelo da execução, 2) modelo do nó, 3) default
    const model = options?.executionModel || node.data.config?.model || this.defaultModel;

    // Adicionar instrução obrigatória sobre formato JSON
    const jsonFormatInstruction = `\n\nIMPORTANTE: Você DEVE retornar APENAS JSON válido, sem texto adicional, sem markdown, sem code blocks. O JSON deve estar no formato exato especificado na seção SAÍDA das instruções. Não inclua explicações, comentários ou texto fora do JSON.`;

    // Combinar instruções extras do config (salvas no agente) com as da execução
    const configExtraInstructions = node.data.config?.extraInstructions?.trim() || '';
    const executionExtraInstructions = extraInstructions?.trim() || '';
    
    // Juntar ambas as instruções extras (config primeiro, depois execução)
    const allExtraInstructions = [configExtraInstructions, executionExtraInstructions]
      .filter(Boolean)
      .join(' ');

    // Combinar instruções base com extras
    const combinedInstructions = allExtraInstructions
      ? `${baseInstructions}${jsonFormatInstruction}\n\nINSTRUÇÕES EXTRAS: ${allExtraInstructions}`
      : `${baseInstructions}${jsonFormatInstruction}`;

    // Preparar input para o agente
    let inputText = '';

    // Para nós de documento: extrair texto real do(s) arquivo(s) (PDF/DOCX/XLSX)
    const shouldExtractDocuments =
      nodeType.startsWith('analyze-document') ||
      nodeType.startsWith('analyze-curriculum') ||
      nodeType.startsWith('extract-information');

    let extractedDocInfo: { text: string; filesProcessed: number } | null = null;
    if (shouldExtractDocuments && inputData && typeof inputData === 'object') {
      extractedDocInfo = await this.documentTextExtractor.extractTextFromInput(inputData);
      if (extractedDocInfo.text && extractedDocInfo.text.trim().length > 0) {
        inputText = extractedDocInfo.text;
      }
    }

    if (!inputText) {
      if (typeof inputData === 'string') {
        inputText = inputData;
      } else if (inputData?.text) {
        inputText = inputData.text;
      } else if (inputData?.content) {
        inputText = inputData.content;
      } else if (inputData?.extracted_text) {
        inputText = inputData.extracted_text;
      } else if (inputData?.summary) {
        inputText = inputData.summary;
      } else if (typeof inputData === 'object') {
        // Tentar serializar objeto para JSON
        inputText = JSON.stringify(inputData, null, 2);
      }
    }

    try {
      // Determinar modelo a usar
      const modelToUse = this.getModelName(model);
      
      this.logger.log(`Executando nó de IA: ${node.id}`);
      this.logger.log(`Modelo da execução: ${options?.executionModel || 'não especificado'}`);
      this.logger.log(`Modelo configurado no nó: ${node.data.config?.model || 'não especificado'}`);
      this.logger.log(`Modelo default: ${this.defaultModel}`);
      this.logger.log(`Modelo final a usar: ${modelToUse}`);
      
      // Criar agente usando o SDK
      const agent = new Agent({
        name: node.data.label,
        instructions: combinedInstructions,
        model: modelToUse,
      });

      // Executar agente usando a função run do SDK
      const result = await run(agent, inputText);

      // Parsear resposta (pode ser JSON ou texto)
      let parsedResult: any;
      const output = result.finalOutput || '';
      
      // Se o output estiver vazio, retornar erro
      if (!output || output.trim().length === 0) {
        this.logger.warn(`Resposta vazia do agente ${node.id}`);
        return { text: 'Resposta vazia do agente' };
      }

      // Tentar parsear como JSON
      try {
        // Remover markdown code blocks se existirem
        let cleanedOutput = output.trim();
        if (cleanedOutput.startsWith('```json')) {
          cleanedOutput = cleanedOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedOutput.startsWith('```')) {
          cleanedOutput = cleanedOutput.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        parsedResult = JSON.parse(cleanedOutput);
      } catch (parseError) {
        // Se não for JSON válido, tentar extrair JSON do texto
        try {
          const jsonMatch = output.match(/\{[\s\S]*\}/);
          if (jsonMatch && jsonMatch[0]) {
            parsedResult = JSON.parse(jsonMatch[0]);
          } else {
            // Se não encontrar JSON, retornar como texto
            this.logger.warn(`Resposta não é JSON válido para nó ${node.id}, retornando como texto`);
            parsedResult = { text: output };
          }
        } catch (secondParseError) {
          // Se ainda falhar, retornar como texto
          this.logger.warn(`Não foi possível parsear JSON para nó ${node.id}: ${secondParseError}`);
          parsedResult = { text: output };
        }
      }

      // Aplicar maxLines se especificado (para nós de resumo/relatório)
      if (options?.maxLines) {
        if (typeof parsedResult.summary === 'string') {
          const lines = parsedResult.summary.split('\n');
          parsedResult.summary = lines.slice(0, options.maxLines).join('\n');
        }
        if (typeof parsedResult.markdown === 'string') {
          const lines = parsedResult.markdown.split('\n');
          parsedResult.markdown = lines.slice(0, options.maxLines).join('\n');
        }
      }

      // Extrair usage do resultado se disponível
      // O SDK de agents pode expor usage em result.usage ou result.rawResponses
      let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
      
      // Tentar extrair usage de diferentes locais possíveis no resultado
      if ((result as any).usage) {
        usage = (result as any).usage;
      } else if ((result as any).rawResponses?.length > 0) {
        // Somar usage de todas as respostas
        usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        for (const resp of (result as any).rawResponses) {
          if (resp.usage) {
            usage.prompt_tokens! += resp.usage.prompt_tokens || 0;
            usage.completion_tokens! += resp.usage.completion_tokens || 0;
            usage.total_tokens! += resp.usage.total_tokens || 0;
          }
        }
      }

      // Anexar trace simples para exibição no frontend
      const trace = {
        input_preview: inputText?.slice(0, 400),
        model_used: this.getModelName(model),
        raw_output: output,
        usage,
        ...(extractedDocInfo?.filesProcessed
          ? { files_processed: extractedDocInfo.filesProcessed }
          : {}),
      };

      return { ...parsedResult, __trace: trace };
    } catch (error: any) {
      this.logger.error(`Erro ao executar nó de IA ${node.id}`, error);
      
      // Melhorar mensagem de erro
      let errorMessage = 'Erro desconhecido';
      if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(`Erro ao executar nó de IA: ${errorMessage}`);
    }
  }

  /**
   * Executa um nó de saída (output)
   */
  private async executeOutputNode(
    _node: WorkflowNode,
    inputData: any,
    format: string = 'pdf',
  ): Promise<{ data: string; fileName: string; mimeType: string }> {
    const markdown =
      typeof inputData?.markdown === 'string'
        ? inputData.markdown
        : typeof inputData?.md === 'string'
          ? inputData.md
          : null;

    let fileBuffer: Buffer;
    let fileName: string;
    let mimeType: string;

    switch (format.toLowerCase()) {
      case 'pdf': {
        if (!markdown || markdown.trim().length === 0) {
          throw new Error(
            'Para gerar PDF, o nó anterior deve fornecer markdown (ex.: nó generate-summary).',
          );
        }

        fileBuffer = await this.markdownPdfService.renderPdfFromMarkdown(markdown, {
          institutionName: 'Instituição',
          generatedAtIso: new Date().toISOString(),
        });
        fileName = 'relatorio.pdf';
        mimeType = 'application/pdf';
        break;
      }
      case 'md':
      case 'markdown': {
        if (markdown && markdown.trim().length > 0) {
          fileBuffer = Buffer.from(markdown, 'utf-8');
        } else {
          const report: ReportDocument = this.pdfGenerator.normalizeReportData(inputData);
          const md = this.pdfGenerator.generateMarkdown(report);
          fileBuffer = Buffer.from(md, 'utf-8');
        }
        fileName = 'relatorio.md';
        mimeType = 'text/markdown';
        break;
      }
      case 'json': {
        const report: ReportDocument = this.pdfGenerator.normalizeReportData(inputData);
        const json = this.pdfGenerator.generateJSON(report);
        fileBuffer = Buffer.from(json, 'utf-8');
        fileName = 'relatorio.json';
        mimeType = 'application/json';
        break;
      }
      default:
        throw new Error(`Formato de saída não suportado: ${format}`);
    }

    return {
      data: fileBuffer.toString('base64'),
      fileName,
      mimeType,
    };
  }

  /**
   * Retorna o nome do modelo a ser usado
   * Usa o modelo configurado ou o default da env OPENAI_MODEL
   */
  private getModelName(model?: string): string {
    // Se um modelo foi especificado, usar ele
    // Caso contrário, usar o modelo padrão da env
    return model?.trim() || this.defaultModel;
  }
}
