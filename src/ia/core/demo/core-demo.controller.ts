import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  Res,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CoreDemoService } from './core-demo.service';
import { RunDemoDto } from './dto/core-demo.dto';

/**
 * Controller para demo do Core IA
 */
@Controller('ia/core/demo')
export class CoreDemoController {
  private readonly logger = new Logger(CoreDemoController.name);

  constructor(private readonly coreDemoService: CoreDemoService) {}

  /**
   * Executa o demo multi-agente
   * POST /ia/core/demo
   */
  @Post()
  async runDemo(
    @Body() dto: RunDemoDto,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-school-id') schoolId?: string,
  ) {
    this.logger.log(
      `Demo request recebido: ${dto.query.substring(0, 50)}...`,
    );

    // Usar tenantId do header ou do DTO, com fallback para demo
    const finalTenantId = dto.tenantId || tenantId || 'demo-tenant';
    
    // Usar userId do DTO ou gerar um demo
    const finalUserId = dto.userId || `demo-user-${Date.now()}`;

    const result = await this.coreDemoService.runMultiAgentDemo(
      dto.query,
      finalTenantId,
      finalUserId,
      dto.schoolId || schoolId,
    );

    return result;
  }

  /**
   * Executa o demo multi-agente com streaming (SSE)
   * GET /ia/core/demo/stream?query=...
   */
  @Get('stream')
  streamDemo(
    @Res() res: Response,
    @Query('query') query: string,
    @Query('tenantId') tenantId?: string,
    @Query('schoolId') schoolId?: string,
    @Query('userId') userId?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-school-id') headerSchoolId?: string,
  ): void {
    if (!query) {
      res.status(400).json({ error: 'Query parameter is required' });
      return;
    }

    this.logger.log(`Demo streaming request recebido: ${query.substring(0, 50)}...`);

    // Usar tenantId do query param, header ou fallback
    const finalTenantId = tenantId || headerTenantId || 'demo-tenant';
    
    // Usar userId do query param ou gerar um demo
    const finalUserId = userId || `demo-user-${Date.now()}`;

    // Configurar headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const stream = this.coreDemoService.streamMultiAgentDemo(
      query,
      finalTenantId,
      finalUserId,
      schoolId || headerSchoolId,
    );

    stream.subscribe({
      next: (event: any) => {
        const data = JSON.stringify({
          type: event.type,
          data: event.data,
          timestamp: event.timestamp || Date.now(),
        });
        res.write(`data: ${data}\n\n`);
      },
      error: (error: any) => {
        this.logger.error(`Stream error: ${error.message}`);
        const errorData = JSON.stringify({
          type: 'error',
          data: { message: error.message || 'Erro desconhecido' },
        });
        res.write(`data: ${errorData}\n\n`);
        res.end();
      },
      complete: () => {
        this.logger.log('Stream completo');
        res.end();
      },
    });
  }
}
