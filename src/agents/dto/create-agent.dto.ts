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

/**
 * @deprecated Use AgentVisibility instead
 */
export enum AgentType {
  PUBLIC_SCHOOL = 'public_school',
  PUBLIC_EDITABLE = 'public_editable',
  PRIVATE = 'private',
  RESTRICTED = 'restricted',
}

/**
 * Visibilidade simplificada do agente
 * - public: Todos da escola podem ver e usar
 * - public_collaborative: Público + qualquer um edita, só dono apaga
 * - private: Só o dono vê e edita
 */
export enum AgentVisibility {
  PUBLIC = 'public',
  PUBLIC_COLLABORATIVE = 'public_collaborative',
  PRIVATE = 'private',
}

/**
 * Status do agente
 * - draft: Rascunho (em criação/edição)
 * - published: Publicado (visível conforme visibilidade)
 */
export enum AgentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
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

  /**
   * @deprecated Campo depreciado, usar status e visibility
   */
  @IsBoolean()
  @IsOptional()
  is_template?: boolean;

  @IsString()
  @IsOptional()
  school_id?: string;

  @IsEnum(AgentStatus)
  @IsOptional()
  status?: AgentStatus;

  @IsBoolean()
  @IsOptional()
  use_auto_layout?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  best_uses?: string[];

  @IsString()
  @IsOptional()
  how_it_helps?: string;
}
