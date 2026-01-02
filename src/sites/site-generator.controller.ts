/**
 * Site Generator Controller
 * Controller dedicado para geração de sites por IA
 * Separado do SitesController para permitir acesso sem autenticação (temporário)
 */
import {
  Controller,
  Get,
  Post,
  Body,
} from '@nestjs/common';
import { SiteGeneratorService, GenerationOptions, GenerationResult, GeneratedSiteDocument, PatchOperation } from './site-generator.service';
import { LoggerService } from '../common/logger/logger.service';

@Controller('sites')
export class SiteGeneratorController {
  constructor(
    private readonly siteGeneratorService: SiteGeneratorService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Gera um site completo usando IA
   */
  @Post('generate')
  async generateSite(
    @Body() body: { prompt: string; options?: GenerationOptions },
  ): Promise<GenerationResult> {
    if (!body.prompt) {
      return {
        success: false,
        error: 'prompt is required',
      };
    }

    this.logger.log(`[AI Generator] Gerando site com prompt: ${body.prompt.substring(0, 100)}...`, 'SiteGeneratorController');
    
    try {
      const result = await this.siteGeneratorService.generateSite(body.prompt, body.options || {});
      this.logger.log(`[AI Generator] Resultado: success=${result.success}`, 'SiteGeneratorController');
      return result;
    } catch (error: any) {
      this.logger.error(`[AI Generator] Erro: ${error.message}`, error.stack, 'SiteGeneratorController');
      return {
        success: false,
        error: error.message || 'Erro interno ao gerar site',
      };
    }
  }

  /**
   * Refina uma seção específica do site usando IA
   */
  @Post('refine')
  async refineSection(
    @Body() body: { section: any; instruction: string; model?: string },
  ): Promise<{ success: boolean; section?: any; error?: string }> {
    if (!body.section || !body.instruction) {
      return {
        success: false,
        error: 'section and instruction are required',
      };
    }

    this.logger.log(`[AI Generator] Refinando seção: ${body.section.type}`, 'SiteGeneratorController');
    
    try {
      return await this.siteGeneratorService.refineSection(
        body.section,
        body.instruction,
        { model: body.model },
      );
    } catch (error: any) {
      this.logger.error(`[AI Generator] Erro ao refinar: ${error.message}`, error.stack, 'SiteGeneratorController');
      return {
        success: false,
        error: error.message || 'Erro interno ao refinar seção',
      };
    }
  }

  /**
   * Gera patches para editar um documento existente (modo rápido)
   * Retorna apenas as operações de patch, não o documento inteiro
   */
  @Post('patch')
  async generatePatches(
    @Body() body: { document: GeneratedSiteDocument; instruction: string; model?: string },
  ): Promise<{ success: boolean; patches?: PatchOperation[]; error?: string; processingTime?: number }> {
    if (!body.document || !body.instruction) {
      return {
        success: false,
        error: 'document and instruction are required',
      };
    }

    this.logger.log(`[AI Patcher] Gerando patches: ${body.instruction.substring(0, 100)}...`, 'SiteGeneratorController');
    
    try {
      const result = await this.siteGeneratorService.generatePatches(
        body.document,
        body.instruction,
        { model: body.model },
      );
      this.logger.log(`[AI Patcher] Resultado: ${result.patches?.length || 0} patches em ${result.processingTime}ms`, 'SiteGeneratorController');
      return result;
    } catch (error: any) {
      this.logger.error(`[AI Patcher] Erro: ${error.message}`, error.stack, 'SiteGeneratorController');
      return {
        success: false,
        error: error.message || 'Erro interno ao gerar patches',
      };
    }
  }

  /**
   * Lista templates disponíveis
   */
  @Get('templates')
  async getTemplates(): Promise<Array<{ id: string; name: string; description: string }>> {
    return this.siteGeneratorService.getAvailableTemplates();
  }
}
