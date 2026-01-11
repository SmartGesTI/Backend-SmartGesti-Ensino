import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Headers,
  UseGuards,
  Logger,
  Req,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/auth.guard';
import { EducaIAService } from './educa-ia.service';
import { FeedbackService } from './feedback.service';
import { EducaIAStreamDto, EducaIAFeedbackDto } from './dto';
import type { UIMessage } from 'ai';

/**
 * Helper to extract text from UIMessage parts
 */
function getTextFromUIMessage(message: UIMessage): string {
  const parts: any[] = (message as any).parts || [];
  return parts
    .filter((p) => p?.type === 'text')
    .map((p) => p?.text || '')
    .join('');
}

@Controller('educa-ia')
@UseGuards(JwtAuthGuard)
export class EducaIAController {
  private readonly logger = new Logger(EducaIAController.name);

  constructor(
    private readonly educaIAService: EducaIAService,
    private readonly feedbackService: FeedbackService,
  ) {}

  /**
   * Stream chat with EducaIA agent
   * Uses AI SDK UI protocol (compatible with useChat)
   */
  @Post('stream')
  async streamChat(
    @Body() dto: EducaIAStreamDto,
    @Res() res: Response,
    @Req() req: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-school-id') schoolId?: string,
    @Headers('origin') requestOrigin?: string,
  ) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      // Extract user from JWT
      const user = (req as any).user;
      const supabaseId = user?.sub || user?.id;

      if (!supabaseId || !tenantId) {
        throw new Error('User ID and Tenant ID are required');
      }

      this.logger.debug(
        `EducaIA stream request: ${dto.messages.length} messages (mode: ${dto.responseMode || 'fast'}, origin: ${requestOrigin})`,
      );

      // Stream using the service
      await this.educaIAService.streamChat(
        dto.messages,
        res,
        {
          tenantId,
          supabaseId,
          schoolId,
          model: dto.model,
          provider: dto.provider,
          responseMode: dto.responseMode || 'fast',
          sendReasoning: dto.sendReasoning,
          conversationId: dto.conversationId,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
          requestOrigin, // Para construir URLs dinâmicas
        },
      );
    } catch (error: any) {
      this.logger.error(`EducaIA stream error: ${error.message}`, error.stack);
      if (!res.headersSent) {
        res.status(500);
        res.setHeader('Content-Type', 'application/json');
        res.json({ error: error.message });
      } else {
        res.end();
      }
    }
  }

  /**
   * Submit feedback for a message
   */
  @Post('feedback')
  async submitFeedback(
    @Body() dto: EducaIAFeedbackDto,
    @Req() req: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.feedbackService.saveFeedback({
        ...dto,
        tenantId,
      });

      return { success: true, message: 'Feedback recebido com sucesso!' };
    } catch (error: any) {
      this.logger.error(`Feedback error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * List user conversations
   */
  @Get('conversations')
  async listConversations(
    @Req() req: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Query('limit') limit?: number,
  ) {
    try {
      const user = (req as any).user;
      const supabaseId = user?.sub || user?.id;

      if (!supabaseId || !tenantId) {
        throw new Error('User ID and Tenant ID are required');
      }

      const conversations = await this.educaIAService.listConversations(
        supabaseId,
        tenantId,
        limit || 20,
      );

      return conversations;
    } catch (error: any) {
      this.logger.error(`List conversations error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  @Get('conversations/:id')
  async getConversationHistory(
    @Param('id') conversationId: string,
    @Req() req: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    try {
      const user = (req as any).user;
      const supabaseId = user?.sub || user?.id;

      if (!supabaseId || !tenantId) {
        throw new Error('User ID and Tenant ID are required');
      }

      const history = await this.educaIAService.getConversationHistory(
        conversationId,
        supabaseId,
        tenantId,
      );

      return history;
    } catch (error: any) {
      this.logger.error(`Get conversation error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a conversation
   */
  @Delete('conversations/:id')
  async deleteConversation(
    @Param('id') conversationId: string,
    @Req() req: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    try {
      const user = (req as any).user;
      const supabaseId = user?.sub || user?.id;

      if (!supabaseId || !tenantId) {
        throw new Error('User ID and Tenant ID are required');
      }

      await this.educaIAService.deleteConversation(
        conversationId,
        supabaseId,
        tenantId,
      );

      return { success: true, message: 'Conversa deletada com sucesso!' };
    } catch (error: any) {
      this.logger.error(`Delete conversation error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Submit tool approval response
   */
  @Post('tool-approval')
  async submitToolApproval(
    @Body() dto: { toolCallId: string; approved: boolean; conversationId?: string },
    @Req() req: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    try {
      const user = (req as any).user;
      const supabaseId = user?.sub || user?.id;

      if (!supabaseId || !tenantId) {
        throw new Error('User ID and Tenant ID are required');
      }

      // Tool approval is typically handled client-side with addToolApprovalResponse
      // This endpoint can be used for logging or server-side tracking
      this.logger.debug(
        `Tool approval: ${dto.toolCallId} - ${dto.approved ? 'approved' : 'rejected'}`,
      );

      return {
        success: true,
        toolCallId: dto.toolCallId,
        approved: dto.approved,
      };
    } catch (error: any) {
      this.logger.error(`Tool approval error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
