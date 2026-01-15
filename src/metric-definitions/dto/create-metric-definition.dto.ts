import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsBoolean,
  IsObject,
  IsArray,
} from 'class-validator';

export class CreateMetricDefinitionDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['number', 'percentage', 'count', 'duration', 'currency', 'text'])
  metric_kind?:
    | 'number'
    | 'percentage'
    | 'count'
    | 'duration'
    | 'currency'
    | 'text';

  @IsOptional()
  @IsIn(['numeric', 'integer', 'text', 'jsonb'])
  value_type?: 'numeric' | 'integer' | 'text' | 'jsonb';

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsIn(['mean', 'sum', 'count', 'min', 'max', 'median', 'p50', 'p75', 'p90'])
  aggregation_default?:
    | 'mean'
    | 'sum'
    | 'count'
    | 'min'
    | 'max'
    | 'median'
    | 'p50'
    | 'p75'
    | 'p90';

  @IsOptional()
  @IsObject()
  dimensions?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  source_tables?: string[];

  @IsOptional()
  @IsObject()
  source_definition?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['internal', 'guardian', 'public'])
  visibility?: 'internal' | 'guardian' | 'public';

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;
}

export class UpdateMetricDefinitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsIn(['mean', 'sum', 'count', 'min', 'max', 'median', 'p50', 'p75', 'p90'])
  aggregation_default?:
    | 'mean'
    | 'sum'
    | 'count'
    | 'min'
    | 'max'
    | 'median'
    | 'p50'
    | 'p75'
    | 'p90';

  @IsOptional()
  @IsObject()
  dimensions?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  source_tables?: string[];

  @IsOptional()
  @IsObject()
  source_definition?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['internal', 'guardian', 'public'])
  visibility?: 'internal' | 'guardian' | 'public';

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;
}
