import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsIn,
  IsObject,
  IsBoolean,
  IsArray,
  IsDateString,
  Min,
} from 'class-validator';

export class CreatePreEnrollmentPersonDto {
  @IsUUID()
  household_id: string;

  @IsOptional()
  @IsUUID()
  application_id?: string;

  @IsIn(['guardian', 'student', 'other'])
  role: 'guardian' | 'student' | 'other';

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_index?: number;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsString()
  full_name: string;

  @IsOptional()
  @IsString()
  preferred_name?: string;

  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other', 'unknown'])
  sex?: 'male' | 'female' | 'other' | 'unknown';

  @IsOptional()
  @IsObject()
  documents?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  contacts?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  addresses?: unknown[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;
}

export class UpdatePreEnrollmentPersonDto {
  @IsOptional()
  @IsUUID()
  application_id?: string;

  @IsOptional()
  @IsIn(['guardian', 'student', 'other'])
  role?: 'guardian' | 'student' | 'other';

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_index?: number;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  preferred_name?: string;

  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other', 'unknown'])
  sex?: 'male' | 'female' | 'other' | 'unknown';

  @IsOptional()
  @IsObject()
  documents?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  contacts?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  addresses?: unknown[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  matched_person_id?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;
}
