import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
} from 'class-validator';
import type { UIMessage } from 'ai';

export type ResponseMode = 'fast' | 'detailed';

export class EducaIAStreamDto {
  @IsArray()
  messages: UIMessage[];

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  provider?: 'openai' | 'anthropic' | 'google';

  @IsOptional()
  @IsEnum(['fast', 'detailed'])
  responseMode?: ResponseMode;

  @IsOptional()
  @IsBoolean()
  sendReasoning?: boolean;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  temperature?: number;

  @IsOptional()
  maxTokens?: number;

  @IsOptional()
  @IsString()
  schoolSlug?: string;
}
