import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsObject,
} from 'class-validator';

export class GenerateObjectDto {
  @IsString()
  prompt: string;

  @IsObject()
  schema: any; // Zod schema serializado

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
}
