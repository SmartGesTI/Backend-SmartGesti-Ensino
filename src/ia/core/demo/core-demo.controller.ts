import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
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
}
