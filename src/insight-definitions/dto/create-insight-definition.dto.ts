import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsBoolean,
  IsObject,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class CreateInsightDefinitionDto {
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
  @IsIn([
    'academic',
    'attendance',
    'behavior',
    'engagement',
    'risk',
    'achievement',
    'custom',
  ])
  category?:
    | 'academic'
    | 'attendance'
    | 'behavior'
    | 'engagement'
    | 'risk'
    | 'achievement'
    | 'custom';

  @IsOptional()
  @IsIn(['info', 'low', 'medium', 'high', 'critical'])
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsIn(['student', 'class_group', 'grade_level', 'school'])
  target_kind?: 'student' | 'class_group' | 'grade_level' | 'school';

  @IsOptional()
  @IsUUID()
  metric_definition_id?: string;

  @IsOptional()
  @IsObject()
  rule?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  recommended_actions?: unknown[];

  @IsOptional()
  @IsIn(['internal_only', 'guardian_allowed', 'guardian_auto'])
  publish_policy?: 'internal_only' | 'guardian_allowed' | 'guardian_auto';

  @IsOptional()
  @IsBoolean()
  requires_consent?: boolean;

  @IsOptional()
  @IsString()
  consent_type?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  min_cohort_size?: number;

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

export class UpdateInsightDefinitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['info', 'low', 'medium', 'high', 'critical'])
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsObject()
  rule?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  recommended_actions?: unknown[];

  @IsOptional()
  @IsIn(['internal_only', 'guardian_allowed', 'guardian_auto'])
  publish_policy?: 'internal_only' | 'guardian_allowed' | 'guardian_auto';

  @IsOptional()
  @IsBoolean()
  requires_consent?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  min_cohort_size?: number;

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
