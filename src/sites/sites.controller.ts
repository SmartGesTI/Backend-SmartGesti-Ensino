import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { SitesService, Site } from './sites.service';
import { SiteGeneratorService, GenerationOptions, GenerationResult } from './site-generator.service';
import { LoggerService } from '../common/logger/logger.service';

@Controller('sites')
@UseGuards(JwtAuthGuard)
export class SitesController {
  constructor(
    private readonly sitesService: SitesService,
    private readonly siteGeneratorService: SiteGeneratorService,
    private readonly logger: LoggerService,
  ) {}

  // ============================================
  // CRUD ENDPOINTS
  // ============================================
  // Note: AI endpoints (generate, refine, templates) are handled by SiteGeneratorController

  @Get()
  async findAll(
    @Request() req: any,
    @Query('projectId') projectId: string,
    @Query('schoolId') schoolId?: string,
  ): Promise<Site[]> {
    if (!projectId) {
      throw new Error('projectId is required');
    }

    return this.sitesService.findAll(projectId, schoolId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('projectId') projectId: string,
  ): Promise<Site> {
    if (!projectId) {
      throw new Error('projectId is required');
    }

    return this.sitesService.findOne(id, projectId);
  }

  @Post()
  async create(
    @Body() site: Partial<Site>,
    @Request() req: any,
  ): Promise<Site> {
    const userId = req.user?.sub || req.user?.id;
    return this.sitesService.create(site, userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() site: Partial<Site>,
    @Query('projectId') projectId: string,
  ): Promise<Site> {
    if (!projectId) {
      throw new Error('projectId is required');
    }

    return this.sitesService.update(id, site, projectId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Query('projectId') projectId: string,
  ): Promise<{ message: string }> {
    if (!projectId) {
      throw new Error('projectId is required');
    }

    await this.sitesService.delete(id, projectId);
    return { message: 'Site deleted successfully' };
  }

  @Post(':id/publish')
  async publish(
    @Param('id') id: string,
    @Query('projectId') projectId: string,
  ): Promise<Site> {
    if (!projectId) {
      throw new Error('projectId is required');
    }

    return this.sitesService.publish(id, projectId);
  }

  @Get(':siteId/sections/:sectionId/data')
  async getSectionData(
    @Param('siteId') siteId: string,
    @Param('sectionId') sectionId: string,
    @Query('projectId') projectId: string,
    @Query('type') type: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('orderBy') orderBy?: string,
    @Query('order') order?: string,
  ): Promise<{ items: any[]; total: number; hasMore: boolean }> {
    if (!projectId) {
      throw new Error('projectId is required');
    }

    return this.sitesService.getSectionData(
      siteId,
      sectionId,
      projectId,
      type,
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        category,
        tags: tags ? tags.split(',') : undefined,
        orderBy: orderBy as 'date' | 'title' | 'popularity' | undefined,
        order: order as 'asc' | 'desc' | undefined,
      },
    );
  }

  @Post(':id/patch')
  async applyPatch(
    @Param('id') id: string,
    @Query('projectId') projectId: string,
    @Body() body: { patches: any[]; authorType?: 'user' | 'ai' | 'system'; description?: string },
    @Request() req: any,
  ): Promise<Site> {
    if (!projectId) {
      throw new Error('projectId is required');
    }

    const userId = req.user?.sub || req.user?.id;
    return this.sitesService.applyPatch(
      id,
      projectId,
      body.patches,
      userId,
      body.authorType || 'user',
      body.description,
    );
  }

  @Get(':id/versions')
  async getVersions(
    @Param('id') id: string,
    @Query('projectId') projectId: string,
  ): Promise<any[]> {
    if (!projectId) {
      throw new Error('projectId is required');
    }

    return this.sitesService.getVersions(id, projectId);
  }

  @Post(':id/rollback/:version')
  async rollbackToVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Query('projectId') projectId: string,
    @Request() req: any,
  ): Promise<Site> {
    if (!projectId) {
      throw new Error('projectId is required');
    }

    const userId = req.user?.sub || req.user?.id;
    return this.sitesService.rollbackToVersion(id, projectId, parseInt(version, 10), userId);
  }

  /**
   * Aplica edição por IA a um site existente
   */
  @Post(':id/ai-edit')
  async aiEditSite(
    @Param('id') id: string,
    @Query('projectId') projectId: string,
    @Body() body: { instruction: string; sectionId?: string; model?: string },
    @Request() req: any,
  ): Promise<Site> {
    if (!projectId) {
      throw new Error('projectId is required');
    }

    if (!body.instruction) {
      throw new Error('instruction is required');
    }

    // Buscar site atual
    const site = await this.sitesService.findOne(id, projectId);

    if (!site.template) {
      throw new Error('Site não possui template para edição');
    }

    // Se sectionId especificado, refinar apenas essa seção
    if (body.sectionId && site.template.structure) {
      const sectionIndex = site.template.structure.findIndex(
        (s: any) => s.id === body.sectionId,
      );

      if (sectionIndex === -1) {
        throw new Error(`Seção ${body.sectionId} não encontrada`);
      }

      const result = await this.siteGeneratorService.refineSection(
        site.template.structure[sectionIndex],
        body.instruction,
        { model: body.model },
      );

      if (!result.success || !result.section) {
        throw new Error(result.error || 'Erro ao refinar seção');
      }

      // Atualizar seção no template
      const updatedStructure = [...site.template.structure];
      updatedStructure[sectionIndex] = result.section;

      const updatedTemplate = {
        ...site.template,
        structure: updatedStructure,
      };

      // Salvar site atualizado
      const userId = req.user?.sub || req.user?.id;
      return this.sitesService.update(
        id,
        { template: updatedTemplate },
        projectId,
      );
    }

    // Caso contrário, gerar novo site baseado na instrução
    // usando o template atual como contexto
    const generateResult = await this.siteGeneratorService.generateSite(
      `${body.instruction}\n\nContexto atual do site: ${JSON.stringify(site.template.meta)}`,
      { model: body.model },
    );

    if (!generateResult.success || !generateResult.document) {
      throw new Error(generateResult.error || 'Erro ao gerar site');
    }

    // Salvar site atualizado
    return this.sitesService.update(
      id,
      { template: generateResult.document },
      projectId,
    );
  }
}
