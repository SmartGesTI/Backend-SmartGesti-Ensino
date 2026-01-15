import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LLMRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  messages: any[];

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  max_tokens?: number;

  @IsBoolean()
  @IsOptional()
  stream?: boolean;

  @IsArray()
  @IsOptional()
  tools?: any[];

  @IsObject()
  @IsOptional()
  response_format?: any;
}

export class StreamingRequestDto {
  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  model?: string;
}
