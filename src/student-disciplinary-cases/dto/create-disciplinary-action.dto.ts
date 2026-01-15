import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsInt,
  IsDateString,
  IsObject,
  Min,
} from 'class-validator';

export class CreateDisciplinaryActionDto {
  @IsIn([
    'warning',
    'suspension',
    'detention',
    'guardian_meeting',
    'pedagogical_plan',
    'other',
  ])
  action_type:
    | 'warning'
    | 'suspension'
    | 'detention'
    | 'guardian_meeting'
    | 'pedagogical_plan'
    | 'other';

  @IsOptional()
  @IsDateString()
  effective_from?: string;

  @IsOptional()
  @IsDateString()
  effective_to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration_days?: number;

  @IsOptional()
  @IsString()
  decision_notes?: string;

  @IsOptional()
  @IsUUID()
  document_id?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateDisciplinaryActionDto {
  @IsOptional()
  @IsDateString()
  effective_from?: string;

  @IsOptional()
  @IsDateString()
  effective_to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration_days?: number;

  @IsOptional()
  @IsString()
  decision_notes?: string;

  @IsOptional()
  @IsUUID()
  document_id?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
