import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CreateAgentPermissionDto } from './dto/agent-permission.dto';
import { CreateAgentRestrictionDto } from './dto/agent-restriction.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionGuard, PERMISSION_CONTEXT_KEY } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { ExecutionResult } from './workflow-executor.service';
import { PermissionContextResult } from '../permissions/permissions.service';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  /**
   * Lista todos os agentes (filtrado por permissões)
   */
  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'read')
  async findAll(
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Query('schoolId') schoolId?: string,
    @Query('category') category?: string,
    @Query('type') type?: string,
    @Query('is_template') is_template?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('visibility') visibility?: string,
    @Query('myAgents') myAgents?: string,
  ) {
    const supabaseId = req.user.sub;
    // Usar contexto de permissões já calculado pelo guard
    const permContext: PermissionContextResult | undefined = req[PERMISSION_CONTEXT_KEY];
    return this.agentsService.findAll(supabaseId, tenantId, schoolId, {
      category,
      type,
      is_template: is_template === 'true',
      search,
      status,
      visibility,
      myAgents: myAgents === 'true',
    }, permContext);
  }

  /**
   * Busca um agente por ID
   */
  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'read')
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const supabaseId = req.user.sub;
    return this.agentsService.findOne(id, supabaseId, tenantId, schoolId);
  }

  /**
   * Cria um novo agente
   */
  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'create')
  async create(
    @Body() createAgentDto: CreateAgentDto,
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    const supabaseId = req.user.sub;
    return this.agentsService.create(createAgentDto, supabaseId, tenantId);
  }

  /**
   * Atualiza um agente
   */
  @Put(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'update')
  async update(
    @Param('id') id: string,
    @Body() updateAgentDto: UpdateAgentDto,
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const supabaseId = req.user.sub;
    return this.agentsService.update(
      id,
      updateAgentDto,
      supabaseId,
      tenantId,
      schoolId,
    );
  }

  /**
   * Deleta um agente
   */
  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'delete')
  async delete(
    @Param('id') id: string,
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    const supabaseId = req.user.sub;
    // Usar contexto de permissões já calculado pelo guard
    const permContext: PermissionContextResult | undefined = req[PERMISSION_CONTEXT_KEY];
    return this.agentsService.delete(id, supabaseId, tenantId, permContext);
  }

  /**
   * Executa um agente
   */
  @Post(':id/execute')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'execute')
  async execute(
    @Param('id') id: string,
    @Body() params: Record<string, any>,
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Query('schoolId') schoolId?: string,
  ): Promise<ExecutionResult> {
    const supabaseId = req.user.sub;
    return this.agentsService.execute(
      id,
      params,
      supabaseId,
      tenantId,
      schoolId,
    );
  }

  /**
   * Executa um nó individual (para execução híbrida frontend/backend)
   */
  @Post('execute-node')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'execute')
  async executeNode(
    @Body() body: {
      node: any;
      inputData: any;
      instructions?: string;
      options?: { maxLines?: number; executionModel?: string };
    },
    @Request() req: any,
  ) {
    const { node, inputData, instructions, options } = body;
    
    // Verificar se é nó de IA (excluir nós de output)
    const nodeType = node.id?.split('-').slice(0, -1).join('-') || node.id;
    const category = node.category || node.data?.category;

    const isOutputNode = 
      nodeType.startsWith('generate-report') ||
      nodeType.startsWith('generate-pdf') ||
      nodeType.startsWith('send-') ||
      category === 'ENVIAR E GERAR' ||
      category === 'SAIDA';
    
    const isAINode =
      !isOutputNode && (
        nodeType.startsWith('analyze-') ||
        nodeType.startsWith('generate-summary') ||
        nodeType.startsWith('classify-') ||
        nodeType.startsWith('extract-') ||
        category === 'ANALISAR COM IA' ||
        category === 'AGENTES'
      );

    if (!isAINode) {
      throw new BadRequestException('Este endpoint é apenas para nós de IA. Nós de output devem ser processados no frontend.');
    }

    // Executar nó de IA usando WorkflowExecutorService
    const result = await this.agentsService.executeAINode(
      node,
      inputData,
      instructions,
      options,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Renderiza um PDF a partir de Markdown (com header/footer padrão)
   */
  @Post('render-pdf')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'execute')
  async renderPdf(
    @Body() body: { markdown: string; fileName?: string },
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const supabaseId = req.user.sub;
    return this.agentsService.renderPdfFromMarkdown(
      body.markdown,
      supabaseId,
      tenantId,
      schoolId,
      body.fileName || 'relatorio.pdf',
    );
  }

  /**
   * Lista permissões de um agente
   */
  @Get(':id/permissions')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'read')
  async getPermissions(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.agentsService.getPermissions(id, tenantId);
  }

  /**
   * Adiciona permissão a um agente
   */
  @Post(':id/permissions')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'update')
  async addPermission(
    @Param('id') id: string,
    @Body() dto: CreateAgentPermissionDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.agentsService.addPermission(id, dto, tenantId);
  }

  /**
   * Remove permissão de um agente
   */
  @Delete(':id/permissions/:permId')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'update')
  async removePermission(
    @Param('permId') permId: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.agentsService.removePermission(permId, tenantId);
  }

  /**
   * Lista bloqueios de um agente
   */
  @Get(':id/restrictions')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'read')
  async getRestrictions(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.agentsService.getRestrictions(id, tenantId);
  }

  /**
   * Adiciona bloqueio a um agente
   */
  @Post(':id/restrictions')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'update')
  async addRestriction(
    @Param('id') id: string,
    @Body() dto: CreateAgentRestrictionDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.agentsService.addRestriction(id, dto, tenantId);
  }

  /**
   * Remove bloqueio de um agente
   */
  @Delete(':id/restrictions/:restId')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'update')
  async removeRestriction(
    @Param('restId') restId: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.agentsService.removeRestriction(restId, tenantId);
  }
}