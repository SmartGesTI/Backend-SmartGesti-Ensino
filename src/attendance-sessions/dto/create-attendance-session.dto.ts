import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsDateString,
  IsObject,
} from 'class-validator';

export class CreateAttendanceSessionDto {
  @IsUUID()
  school_id: string;

  @IsUUID()
  academic_year_id: string;

  @IsUUID()
  class_group_id: string;

  @IsUUID()
  class_group_subject_id: string;

  @IsDateString()
  occurred_on: string;

  @IsOptional()
  @IsUUID()
  time_slot_id?: string;

  @IsOptional()
  @IsUUID()
  conducted_by_staff_school_profile_id?: string;

  @IsOptional()
  @IsIn(['open', 'closed', 'cancelled'])
  status?: 'open' | 'closed' | 'cancelled';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
