import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import {
  AgentType,
  AgentVisibility,
  AgentCategory,
  AgentDifficulty,
} from './create-agent.dto';

// Re-exportar os enums para facilitar o uso
export { AgentType, AgentVisibility, AgentCategory, AgentDifficulty } from './create-agent.dto';

export class UpdateAgentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsEnum(AgentCategory)
  @IsOptional()
  category?: AgentCategory;

  @IsObject()
  @IsOptional()
  workflow?: {
    nodes: any[];
    edges: any[];
  };

  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsEnum(AgentDifficulty)
  @IsOptional()
  difficulty?: AgentDifficulty;

  @IsString()
  @IsOptional()
  use_case?: string;

  @IsString()
  @IsOptional()
  flow?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  estimated_time?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  category_tags?: string[];

  @IsEnum(AgentType)
  @IsOptional()
  type?: AgentType;

  @IsEnum(AgentVisibility)
  @IsOptional()
  visibility?: AgentVisibility;

  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsBoolean()
  @IsOptional()
  is_template?: boolean;

  @IsString()
  @IsOptional()
  school_id?: string;

  @IsBoolean()
  @IsOptional()
  use_auto_layout?: boolean;
}
