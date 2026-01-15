import {
  IsString,
  IsOptional,
  IsIn,
  IsObject,
  IsUUID,
  IsDateString,
} from 'class-validator';

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsIn(['active', 'transferred', 'withdrawn', 'completed'], {
    message: 'Status deve ser: active, transferred, withdrawn ou completed',
  })
  status?: 'active' | 'transferred' | 'withdrawn' | 'completed';

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

export class AssignClassDto {
  @IsUUID('4', { message: 'ID da turma deve ser um UUID válido' })
  class_group_id: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data deve estar no formato ISO (YYYY-MM-DD)' })
  valid_from?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class LeaveSchoolDto {
  @IsIn(['transferred', 'withdrawn', 'completed'], {
    message: 'Motivo deve ser: transferred, withdrawn ou completed',
  })
  reason: 'transferred' | 'withdrawn' | 'completed';

  @IsOptional()
  @IsDateString({}, { message: 'Data deve estar no formato ISO (YYYY-MM-DD)' })
  left_at?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
