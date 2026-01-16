import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AcademicStructureService } from './academic-structure.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { TenantsService } from '../tenants/tenants.service';
import { AcademicStructureSummaryResponse } from './dto/academic-structure-summary.dto';

@Controller('academic-structure')
@UseGuards(JwtAuthGuard)
export class AcademicStructureController {
  constructor(
    private academicStructureService: AcademicStructureService,
    private tenantsService: TenantsService,
    private logger: LoggerService,
  ) {}

  private async getTenantId(subdomain: string | undefined): Promise<string> {
    if (!subdomain) {
      throw new BadRequestException('Subdomain é obrigatório');
    }

    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }

    return tenant.id;
  }

  /**
   * GET /api/academic-structure/summary
   *
   * Retorna contadores agregados da estrutura acadêmica.
   * Otimizado para o dashboard da "Visão Geral".
   */
  @Get('summary')
  async getSummary(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('school_id') schoolId: string,
    @Query('academic_year_id') academicYearId?: string,
  ): Promise<AcademicStructureSummaryResponse> {
    if (!schoolId) {
      throw new BadRequestException('school_id é obrigatório');
    }

    const tenantId = await this.getTenantId(subdomain);

    this.logger.log(
      'Fetching academic structure summary',
      'AcademicStructureController',
      {
        tenantId,
        schoolId,
        academicYearId,
      },
    );

    return this.academicStructureService.getSummary(
      tenantId,
      schoolId,
      academicYearId,
    );
  }
}
