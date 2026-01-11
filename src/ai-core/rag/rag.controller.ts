import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SearchService } from './services/search.service';
import { IngestionService } from './services/ingestion.service';
import { RagAssistantService } from './services/rag-assistant.service';
import { FeedbackService } from './services/feedback.service';
import {
  SearchQueryDto,
  IngestDocumentDto,
  AskQuestionDto,
  SendFeedbackDto,
  RegenerateDto,
  ExportFinetuningDto,
  StreamingAskDto,
} from './dto';
import { StreamingEvent } from '../../agents/shared/llm/llm.types';

@Controller('rag')
export class RagController {
  constructor(
    private readonly searchService: SearchService,
    private readonly ingestionService: IngestionService,
    private readonly ragAssistantService: RagAssistantService,
    private readonly feedbackService: FeedbackService,
  ) {}

  /**
   * Perguntar para o assistente IA (com suporte a histórico)
   * POST /rag/ask
   */
  @Post('ask')
  async ask(
    @Body() dto: AskQuestionDto,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-school-id') schoolId?: string,
  ) {
    const result = await this.ragAssistantService.answerQuestion(
      dto.question,
      dto.history,
      tenantId,
      schoolId,
    );
    return {
      success: true,
      question: dto.question,
      answer: result.answer,
      hasHistory: dto.history && dto.history.length > 0,
      usedTools: result.usedTools,
      toolResults: result.toolResults,
    };
  }

  /**
   * Endpoint SSE para streaming
   * GET /rag/stream?question=...
   */
  @Get('stream')
  streamAnswer(
    @Query() query: StreamingAskDto,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-school-id') schoolId: string | undefined,
    @Res() res: Response,
  ): void {
    const requestId = `rag-${Date.now()}`;
    
    console.log(`[${requestId}] [RagController] Stream request:`, {
      question: query.question?.substring(0, 50),
      tenantId,
      schoolId,
    });

    // Configurar headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const stream = this.ragAssistantService.streamAnswer(
      query.question,
      undefined, // sem histórico no streaming por enquanto
      tenantId,
      schoolId,
    );

    stream.subscribe({
      next: (event: StreamingEvent) => {
        const data = JSON.stringify({
          type: event.type,
          data: event.data,
          timestamp: event.timestamp || Date.now(),
        });
        res.write(`data: ${data}\n\n`);
      },
      error: (error: any) => {
        console.error(`[${requestId}] [RagController] Stream error:`, error.message);
        const errorData = JSON.stringify({
          type: 'error',
          data: { message: error.message || 'Erro desconhecido' },
        });
        res.write(`data: ${errorData}\n\n`);
        res.end();
      },
      complete: () => {
        console.log(`[${requestId}] [RagController] Stream complete`);
        res.end();
      },
    });
  }

  /**
   * Regenerar resposta
   * POST /rag/regenerate
   */
  @Post('regenerate')
  async regenerate(
    @Body() dto: RegenerateDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    const result = await this.ragAssistantService.regenerateAnswer(
      dto.question,
      dto.history,
    );
    return {
      success: true,
      question: dto.question,
      answer: result.answer,
    };
  }

  /**
   * Enviar feedback (like/dislike)
   * POST /rag/feedback
   */
  @Post('feedback')
  async sendFeedback(
    @Body() dto: SendFeedbackDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    const result = await this.feedbackService.saveFeedback(
      tenantId || 'default',
      dto,
    );
    return {
      success: result.success,
      feedbackId: result.id,
      feedbackType: dto.feedbackType,
    };
  }

  /**
   * Obter estatísticas de feedback
   * GET /rag/feedback/stats
   */
  @Get('feedback/stats')
  async getFeedbackStats(@Headers('x-tenant-id') tenantId: string) {
    const stats = await this.feedbackService.getStats(tenantId || 'default');
    return {
      success: true,
      ...stats,
    };
  }

  /**
   * Exportar dados para fine-tuning (formato JSONL)
   * GET /rag/feedback/export
   */
  @Get('feedback/export')
  async exportFinetuning(
    @Headers('x-tenant-id') tenantId: string,
    @Query('type') feedbackType: 'like' | 'dislike',
    @Query('limit') limit: string,
    @Res() res: Response,
  ) {
    const jsonl = await this.feedbackService.exportAsJsonl(
      tenantId || 'default',
      {
        feedbackType: feedbackType || 'like',
        limit: limit ? parseInt(limit, 10) : 1000,
      },
    );

    res.setHeader('Content-Type', 'application/jsonl');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=finetuning-${feedbackType || 'like'}-${Date.now()}.jsonl`,
    );
    res.send(jsonl);
  }

  /**
   * Busca na knowledge base
   * POST /rag/search
   */
  @Post('search')
  async search(@Body() dto: SearchQueryDto) {
    const results = await this.searchService.search(dto.query, {
      category: dto.category,
      topK: dto.topK,
      tags: dto.tags,
      useHybrid: true,
    });

    return {
      success: true,
      query: dto.query,
      totalResults: results.length,
      results,
    };
  }

  /**
   * Busca semântica pura (sem BM25)
   * POST /rag/search/semantic
   */
  @Post('search/semantic')
  async semanticSearch(@Body() dto: SearchQueryDto) {
    const results = await this.searchService.semanticSearch(dto.query, {
      category: dto.category,
      topK: dto.topK,
      tags: dto.tags,
    });

    return {
      success: true,
      query: dto.query,
      totalResults: results.length,
      results,
    };
  }

  /**
   * Status da knowledge base
   * GET /rag/status
   */
  @Get('status')
  async getStatus() {
    return this.ingestionService.getStatus();
  }

  /**
   * Lista documentos
   * GET /rag/documents
   */
  @Get('documents')
  async listDocuments(
    @Query('category') category?: string,
    @Query('limit') limit?: number,
  ) {
    // TODO: Implementar listagem paginada
    const status = await this.ingestionService.getStatus();
    return {
      totalDocuments: status.totalDocuments,
      categoryCounts: status.categoryCounts,
    };
  }

  /**
   * Ingere um documento
   * POST /rag/ingest
   */
  @Post('ingest')
  async ingestDocument(@Body() dto: IngestDocumentDto) {
    return this.ingestionService.ingestDocument(dto.filePath, dto.content);
  }

  /**
   * Ingere diretório completo
   * POST /rag/ingest/directory
   */
  @Post('ingest/directory')
  async ingestDirectory(@Body() body: { path: string }) {
    const results = await this.ingestionService.ingestDirectory(body.path);
    
    const successful = results.filter(r => r.success).length;
    const totalChunks = results.reduce((sum, r) => sum + r.chunksCreated, 0);

    return {
      success: true,
      documentsProcessed: results.length,
      documentsSuccessful: successful,
      totalChunks,
      details: results,
    };
  }

  /**
   * Reindexar tudo
   * POST /rag/reindex
   */
  @Post('reindex')
  async reindex(@Body() body: { path: string }) {
    const results = await this.ingestionService.reindexAll(body.path);
    
    const successful = results.filter(r => r.success).length;
    const totalChunks = results.reduce((sum, r) => sum + r.chunksCreated, 0);

    return {
      success: true,
      documentsProcessed: results.length,
      documentsSuccessful: successful,
      totalChunks,
      details: results,
    };
  }

  /**
   * Remove documento
   * DELETE /rag/documents/:id
   */
  @Delete('documents/:id')
  async removeDocument(@Param('id') id: string) {
    const removed = await this.ingestionService.removeDocument(id);
    return {
      success: removed,
      documentId: id,
    };
  }
}
