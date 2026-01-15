import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class GenerateSnapshotDto {
  @IsUUID()
  student_id: string;

  @IsIn(['academic_year', 'as_of', 'full_history', 'transfer_packet', 'custom'])
  kind:
    | 'academic_year'
    | 'as_of'
    | 'full_history'
    | 'transfer_packet'
    | 'custom';

  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsOptional()
  @IsUUID()
  academic_year_id?: string;

  @IsOptional()
  @IsBoolean()
  include_assessments?: boolean;

  @IsOptional()
  @IsBoolean()
  include_attendance?: boolean;

  @IsOptional()
  @IsBoolean()
  include_results?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}

export class FinalizeSnapshotDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RevokeSnapshotDto {
  @IsString()
  reason: string;
}
