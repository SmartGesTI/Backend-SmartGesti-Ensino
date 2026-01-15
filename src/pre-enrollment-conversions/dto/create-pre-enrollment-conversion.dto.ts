import {
  IsString,
  IsOptional,
  IsUUID,
  IsObject,
  IsDateString,
} from 'class-validator';

export class CreatePreEnrollmentConversionDto {
  @IsUUID()
  household_id: string;

  @IsUUID()
  application_id: string;

  @IsOptional()
  @IsDateString()
  converted_at?: string;

  @IsOptional()
  @IsUUID()
  family_id?: string;

  @IsOptional()
  @IsUUID()
  student_id?: string;

  @IsOptional()
  @IsUUID()
  enrollment_id?: string;

  @IsOptional()
  @IsObject()
  created_entities?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConvertApplicationDto {
  @IsOptional()
  @IsUUID()
  family_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  options?: {
    createFamily?: boolean;
    createStudent?: boolean;
    createEnrollment?: boolean;
  };
}
