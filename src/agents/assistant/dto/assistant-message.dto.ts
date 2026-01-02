import { IsString, IsOptional, IsUUID, IsBoolean, IsIn } from 'class-validator';

/**
 * Níveis de reasoning suportados
 */
const REASONING_LEVELS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;
type ReasoningEffortType = typeof REASONING_LEVELS[number];

export class SendMessageDto {
  @IsString()
  message: string;

  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  model?: string;

  /**
   * Nível de esforço de reasoning (GPT 5.2)
   * - none: Sem reasoning
   * - minimal: Reasoning mínimo (padrão para gpt-5-nano)
   * - low: Reasoning baixo
   * - medium: Reasoning médio
   * - high: Reasoning alto
   * - xhigh: Reasoning extra alto (GPT 5.2+)
   */
  @IsOptional()
  @IsIn([...REASONING_LEVELS])
  reasoningEffort?: ReasoningEffortType;

  /**
   * Se deve mostrar o reasoning/pensamentos do modelo para o usuário
   */
  @IsOptional()
  @IsBoolean()
  showReasoning?: boolean;
}

export class StreamingMessageDto {
  @IsString()
  message: string;

  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  model?: string;

  /**
   * Nível de esforço de reasoning (GPT 5.2)
   */
  @IsOptional()
  @IsIn([...REASONING_LEVELS])
  reasoningEffort?: ReasoningEffortType;

  /**
   * Se deve mostrar o reasoning/pensamentos do modelo para o usuário
   */
  @IsOptional()
  @IsBoolean()
  showReasoning?: boolean;
}
