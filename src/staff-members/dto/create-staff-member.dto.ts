import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsDateString,
  IsObject,
} from 'class-validator';

export class CreateStaffMemberDto {
  @IsUUID()
  person_id: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsIn(['teacher', 'coordinator', 'admin', 'support', 'other'])
  staff_type: 'teacher' | 'coordinator' | 'admin' | 'support' | 'other';

  @IsOptional()
  @IsIn(['active', 'inactive', 'terminated'])
  status?: 'active' | 'inactive' | 'terminated';

  @IsOptional()
  @IsDateString()
  hired_at?: string;

  @IsOptional()
  @IsDateString()
  terminated_at?: string;

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
