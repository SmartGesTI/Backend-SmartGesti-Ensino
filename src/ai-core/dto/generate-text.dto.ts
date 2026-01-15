import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class GenerateTextDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsEnum(['openai', 'anthropic', 'google'])
  provider?: 'openai' | 'anthropic' | 'google';

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  @IsOptional()
  conversationId?: string;

  @IsOptional()
  tenantId?: string;

  @IsOptional()
  userId?: string;

  @IsOptional()
  schoolId?: string;
}
