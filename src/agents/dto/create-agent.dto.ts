import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsBoolean,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AgentType {
  PUBLIC_SCHOOL = 'public_school',
  PUBLIC_EDITABLE = 'public_editable',
  PRIVATE = 'private',
  RESTRICTED = 'restricted',
}

export enum AgentVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  RESTRICTED = 'restricted',
}

export enum AgentCategory {
  ACADEMICO = 'academico',
  FINANCEIRO = 'financeiro',
  RH = 'rh',
  ADMINISTRATIVO = 'administrativo',
}

export enum AgentDifficulty {
  INICIANTE = 'iniciante',
  INTERMEDIARIO = 'intermediario',
  AVANCADO = 'avancado',
}

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsEnum(AgentCategory)
  @IsNotEmpty()
  category: AgentCategory;

  @IsObject()
  @IsNotEmpty()
  workflow: {
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
}