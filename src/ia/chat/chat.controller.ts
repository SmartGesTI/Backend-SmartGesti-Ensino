import {
  Controller,
  Post,
  Body,
  Res,
  Headers,
  UseGuards,
  Logger,
  Req,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/auth.guard';
import { UIChatService } from '../../ai-core/streaming/ui-chat.service';
import { MemoryService } from '../../ai-core/memory/memory.service';
import { SupabaseService } from '../../supabase/supabase.service';
import type { UIMessage } from 'ai';

function getTextFromUIMessage(message: UIMessage): string {
  const parts: any[] = (message as any).parts || [];
  return parts
    .filter((p) => p?.type === 'text')
    .map((p) => p?.text || '')
    .join('');
}

interface ChatRequestDto {
  messages: UIMessage[];
  model?: string;
  provider?: 'openai' | 'anthropic' | 'google';
  temperature?: number;
  maxTokens?: number;
  sendReasoning?: boolean;
  conversationId?: string;
}

@Controller('ia/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly uiChatService: UIChatService,
    private readonly memoryService: MemoryService,
    private readonly supabase: SupabaseService,
  ) {}

  @Post('stream')
  async streamChat(
    @Body() dto: ChatRequestDto,
    @Res() res: Response,
    @Req() req: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-school-id') schoolId?: string,
  ) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      // Extract Supabase ID from JWT (sub claim)
      const supabaseId = (req as any).user?.sub || (req as any).user?.id;

      if (!supabaseId || !tenantId) {
        throw new Error('User ID and Tenant ID are required');
      }

      // Convert Supabase ID (auth0_id) to users table ID (required for foreign key)
      const { data: userData, error: userError } = await this.supabase
        .getClient()
        .from('users')
        .select('id')
        .eq('auth0_id', supabaseId)
        .single();

      if (userError || !userData) {
        this.logger.error(
          `User not found in database for Supabase ID: ${supabaseId}`,
          userError,
        );
        throw new Error('Usuário não encontrado no sistema');
      }

      const userId = userData.id;

      // Load conversation history if conversationId is provided
      let conversationMessages: UIMessage[] = dto.messages;
      if (dto.conversationId) {
        const history = await this.memoryService.getMessages(
          {
            tenantId,
            userId,
            schoolId,
            conversationId: dto.conversationId,
          },
          { maxMessages: 50 }, // Limit history
        );

        // Convert ModelMessages to UIMessages (simplified - in production, handle tool calls properly)
        if (history.length > 0) {
          // Prepend history to current messages (excluding the last user message which is already in dto.messages)
          const historyUIMessages: UIMessage[] = history.map((msg) => {
            const text =
              typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

            // UIMessage v6 exige parts (não existe mais "content" direto no tipo)
            return {
              id: `msg-${Date.now()}-${Math.random()}`,
              role: msg.role as any,
              parts: [{ type: 'text', text }],
            } as any;
          });

          // Merge history with current messages (avoid duplicates)
          conversationMessages = [...historyUIMessages, ...dto.messages];
        }
      }

      this.logger.debug(
        `Streaming chat: ${conversationMessages.length} messages (user: ${userId}, tenant: ${tenantId})`,
      );

      // Create abort signal for timeout (if needed)
      const timeout = 60000; // 60 seconds default
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      // Stream chat using AI SDK UI protocol (pipes directly to response)
      await this.uiChatService.streamChat(
        conversationMessages,
        res,
        {
          model: dto.model,
          provider: dto.provider,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
          sendReasoning: dto.sendReasoning ?? false,
          abortSignal: abortController.signal,
        },
      );

      clearTimeout(timeoutId);

      // Save messages to memory after stream completes (in background)
      // Note: In production, you'd want to save incrementally or after completion
      // For now, we'll save the user message immediately
      if (dto.conversationId || userId) {
        const lastUserMessage = dto.messages[dto.messages.length - 1];
        if (lastUserMessage && lastUserMessage.role === 'user') {
          const userText = getTextFromUIMessage(lastUserMessage);
          this.memoryService
            .addMessage(
              {
                tenantId,
                userId,
                schoolId,
                conversationId: dto.conversationId,
              },
              {
                role: 'user',
                content: userText,
              },
            )
            .catch((err) => {
              this.logger.error(`Error saving message to memory: ${err.message}`);
            });
        }
      }
    } catch (error: any) {
      this.logger.error(`Chat stream error: ${error.message}`, error.stack);
      if (!res.headersSent) {
        res.status(500);
        res.setHeader('Content-Type', 'application/json');
        res.json({ error: error.message });
      } else {
        res.end();
      }
    }
  }
}
