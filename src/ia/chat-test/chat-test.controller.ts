import {
  Controller,
  Post,
  Body,
  Res,
  Headers,
  UseGuards,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/auth.guard';
import { StreamService } from '../../ai-core/streaming/stream.service';
import { StructuredOutputService } from '../../ai-core/structured/structured-output.service';
import { ModelMessage } from '@ai-sdk/provider-utils';
import { z } from 'zod';

interface ChatMessageDto {
  message: string;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  provider?: 'openai' | 'anthropic' | 'google';
  enableReasoning?: boolean;
  enableStructuredOutput?: boolean;
}

@Controller('ia/chat-test')
@UseGuards(JwtAuthGuard)
export class ChatTestController {
  private readonly logger = new Logger(ChatTestController.name);

  constructor(
    private readonly streamService: StreamService,
    private readonly structuredOutputService: StructuredOutputService,
  ) {}

  @Post('stream')
  async streamChat(
    @Body() dto: ChatMessageDto,
    @Res() res: Response,
    @Headers('x-school-id') schoolId?: string,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Desabilitar buffering no nginx para streaming em tempo real

    try {
      // Schema para structured output se habilitado
      const schema = dto.enableStructuredOutput
        ? z.object({
            answer: z.string().describe('A resposta para a pergunta do usuário'),
            confidence: z
              .number()
              .min(0)
              .max(1)
              .describe('Nível de confiança da resposta (0-1)'),
          })
        : undefined;

      // Construir array de mensagens com histórico + mensagem atual
      const messages: ModelMessage[] = [];

      // Adicionar histórico se fornecido
      if (dto.history && Array.isArray(dto.history)) {
        this.logger.debug(
          `Recebido histórico com ${dto.history.length} mensagens`,
        );
        for (const msg of dto.history) {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      } else {
        this.logger.debug('Nenhum histórico fornecido');
      }

      // Adicionar mensagem atual
      messages.push({
        role: 'user',
        content: dto.message,
      });

      this.logger.debug(
        `Total de mensagens enviadas ao modelo: ${messages.length}`,
      );

      // Reasoning desabilitado - usando simulação no frontend
      // Passar array de mensagens para manter contexto da conversa
      const stream = await this.streamService.streamText(messages, {
        model: dto.model,
        provider: dto.provider,
        schema,
      });

      stream.subscribe({
        next: (event) => {
          const data = JSON.stringify(event);
          res.write(`data: ${data}\n\n`);
          // Forçar flush para garantir streaming em tempo real
          if (res.flushHeaders && typeof res.flushHeaders === 'function') {
            res.flushHeaders();
          }
        },
        error: (error) => {
          const errorEvent = {
            type: 'error',
            data: { error: error.message },
            timestamp: Date.now(),
          };
          res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
          res.end();
        },
        complete: () => {
          res.end();
        },
      });
    } catch (error) {
      const errorEvent = {
        type: 'error',
        data: { error: error.message },
        timestamp: Date.now(),
      };
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
      res.end();
    }
  }

  @Post('structured')
  async structuredChat(
    @Body() dto: ChatMessageDto,
    @Headers('x-school-id') schoolId?: string,
  ) {
    // Schema simples para teste
    // Nota: Para Responses API (gpt-4.1-nano), todos os campos devem estar em 'required'
    // Por isso removemos campos opcionais ou os tornamos obrigatórios
    const responseSchema = z.object({
      answer: z.string().describe('A resposta para a pergunta do usuário'),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe('Nível de confiança da resposta (0-1)'),
    });

    const result = await this.structuredOutputService.generateObject(
      dto.message,
      responseSchema,
      {
        model: dto.model,
        provider: dto.provider,
      },
    );

    return {
      object: result.object,
      usage: result.usage,
      finishReason: result.finishReason,
    };
  }
}
