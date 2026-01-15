import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsDateString,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateStaffSchoolProfileDto {
  @IsUUID()
  school_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employee_code?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'left'])
  status?: 'active' | 'inactive' | 'left';

  @IsOptional()
  @IsDateString()
  joined_at?: string;

  @IsOptional()
  @IsDateString()
  left_at?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}
