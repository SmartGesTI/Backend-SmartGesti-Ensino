import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  Headers,
  Res,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/auth.guard';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { RequirePermission } from '../../permissions/decorators/require-permission.decorator';
import { AssistantService } from './assistant.service';
import { SendMessageDto, StreamingMessageDto } from './dto/assistant-message.dto';
import { ConversationService } from './conversation/conversation.service';
import { UsersService } from '../../users/users.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { TenantsService } from '../../tenants/tenants.service';
import { StreamingEvent } from '../shared/llm/llm.types';

@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(
    private readonly assistantService: AssistantService,
    private readonly conversationService: ConversationService,
    private readonly usersService: UsersService,
    private readonly supabase: SupabaseService,
    private readonly tenantsService: TenantsService,
  ) {}

  /**
   * Endpoint para mensagem sem streaming
   */
  @Post('message')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'execute')
  async sendMessage(
    @Body() dto: SendMessageDto,
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const supabaseId = req.user.sub;
    const user = await this.usersService.getUserByAuth0Id(supabaseId);

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const context = {
      userId: user.id,
      tenantId,
      schoolId,
      supabaseId,
      schoolSlug: (req as any).schoolSlug, // Pode vir do middleware
    };

    return this.assistantService.processMessage(
      dto.message,
      dto.conversationId || null,
      context,
    );
  }

  /**
   * Endpoint SSE para streaming
   */
  @Get('stream')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'execute')
  streamMessage(
    @Query() query: StreamingMessageDto,
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Res() res: Response,
    @Query('schoolId') schoolId?: string,
  ): void {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[${requestId}] [AssistantController] Stream request recebido:`, {
      message: query.message,
      conversationId: query.conversationId,
      schoolId,
      tenantId,
      timestamp: new Date().toISOString(),
    });

    // Configurar headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Desabilitar buffering no nginx

    // Obter contexto do usuário
    this.getUserContext(req, tenantId, schoolId)
      .then((context) => {
        console.log(`[${requestId}] [AssistantController] Contexto obtido:`, {
          userId: context.userId,
          tenantId: context.tenantId,
          schoolId: context.schoolId,
          schoolSlug: context.schoolSlug,
        });

        const stream = this.assistantService.streamMessage(
          query.message,
          query.conversationId || null,
          context,
        );

        let eventCount = 0;
        stream.subscribe({
          next: (event: StreamingEvent) => {
            eventCount++;
            const timestamp = event.timestamp || Date.now();
            const data = JSON.stringify({
              type: event.type,
              data: event.data,
              timestamp,
            });

            // Formato SSE: data: <json>\n\n
            res.write(`data: ${data}\n\n`);
          },
          error: (error: any) => {
            console.error(`[${requestId}] [AssistantController] Erro no stream:`, {
              message: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString(),
            });

            const errorData = JSON.stringify({
              type: 'error',
              data: {
                message: error.message || 'Erro desconhecido',
              },
            });
            res.write(`data: ${errorData}\n\n`);
            res.end();
          },
          complete: () => {
            console.log(`[${requestId}] [AssistantController] Stream completo. Total de eventos: ${eventCount}`);
            res.end();
          },
        });
      })
      .catch((error) => {
        console.error(`[${requestId}] [AssistantController] Erro ao obter contexto:`, {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        });

        const errorData = JSON.stringify({
          type: 'error',
          data: {
            message: error.message || 'Erro ao obter contexto do usuário',
          },
        });
        res.write(`event: error\n`);
        res.write(`data: ${errorData}\n\n`);
        res.end();
      });
  }

  /**
   * Obtém histórico de uma conversa (rota específica deve vir antes)
   */
  @Get('conversations/:id')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'read')
  async getConversation(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.conversationService.getHistory(id);
  }

  /**
   * Deleta uma conversa (rota específica deve vir antes)
   */
  @Post('conversations/:id/delete')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'delete')
  async deleteConversation(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const supabaseId = req.user.sub;
    const user = await this.usersService.getUserByAuth0Id(supabaseId);

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    await this.conversationService.deleteConversation(id, user.id);
    return { success: true };
  }

  /**
   * Lista conversas do usuário (rota genérica vem depois)
   */
  @Get('conversations')
  @UseGuards(PermissionGuard)
  @RequirePermission('agents', 'read')
  async listConversations(
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    const supabaseId = req.user.sub;
    const user = await this.usersService.getUserByAuth0Id(supabaseId);

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    return this.conversationService.listConversations(
      user.id,
      tenantId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * Helper para obter contexto do usuário
   */
  private async getUserContext(
    req: any,
    tenantId: string,
    schoolId?: string,
  ): Promise<{
    userId: string;
    tenantId: string;
    schoolId?: string;
    supabaseId: string;
    schoolSlug?: string;
    tenantSubdomain?: string;
    requestOrigin?: string;
  }> {
    const supabaseId = req.user.sub;
    const user = await this.usersService.getUserByAuth0Id(supabaseId);

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Tentar obter schoolSlug do request (pode vir do middleware)
    let schoolSlug = (req as any).schoolSlug;
    console.log(`[AssistantController] schoolSlug do request:`, schoolSlug);
    
    // Se não tiver schoolSlug mas tiver schoolId, buscar o slug da escola
    if (!schoolSlug && schoolId) {
      console.log(`[AssistantController] Buscando schoolSlug no banco para schoolId: ${schoolId}, tenantId: ${tenantId}`);
      try {
        const { data: school, error } = await this.supabase.getClient()
          .from('schools')
          .select('slug')
          .eq('id', schoolId)
          .eq('tenant_id', tenantId)
          .single();
        
        if (!error && school) {
          schoolSlug = school.slug;
          console.log(`[AssistantController] schoolSlug obtido do banco:`, schoolSlug);
        } else {
          console.warn(`[AssistantController] Erro ao buscar schoolSlug:`, error);
        }
      } catch (error: any) {
        // Se falhar, continuar sem schoolSlug (não é crítico)
        console.warn(`[AssistantController] Não foi possível obter schoolSlug para schoolId ${schoolId}:`, error?.message || error);
      }
    } else if (!schoolSlug) {
      console.warn(`[AssistantController] schoolSlug não disponível (nem do request nem do schoolId)`);
    }

    // Obter subdomain do tenant
    let tenantSubdomain: string | undefined;
    try {
      const tenant = await this.tenantsService.getTenantById(tenantId);
      if (tenant) {
        tenantSubdomain = tenant.subdomain;
        console.log(`[AssistantController] tenantSubdomain obtido: ${tenantSubdomain}`);
      }
    } catch (error: any) {
      console.warn(`[AssistantController] Não foi possível obter tenantSubdomain:`, error?.message || error);
    }

    // Capturar origin da requisição para construção dinâmica de URLs
    const requestOrigin = req.headers?.origin || req.headers?.referer?.split('/').slice(0, 3).join('/');
    if (requestOrigin) {
      console.log(`[AssistantController] requestOrigin capturado: ${requestOrigin}`);
    }

    return {
      userId: user.id,
      tenantId,
      schoolId,
      supabaseId,
      schoolSlug,
      tenantSubdomain,
      requestOrigin,
    };
  }
}
