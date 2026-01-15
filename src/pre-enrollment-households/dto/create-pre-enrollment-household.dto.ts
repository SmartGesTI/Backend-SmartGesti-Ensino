import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  IsEmail,
} from 'class-validator';

export class CreatePreEnrollmentHouseholdDto {
  @IsUUID()
  school_id: string;

  @IsOptional()
  @IsUUID()
  site_id?: string;

  @IsOptional()
  @IsIn([
    'draft',
    'submitted',
    'in_review',
    'needs_info',
    'approved',
    'rejected',
    'converted',
    'cancelled',
    'archived',
  ])
  status?:
    | 'draft'
    | 'submitted'
    | 'in_review'
    | 'needs_info'
    | 'approved'
    | 'rejected'
    | 'converted'
    | 'cancelled'
    | 'archived';

  @IsOptional()
  @IsEmail()
  primary_email?: string;

  @IsOptional()
  @IsString()
  primary_phone?: string;

  @IsOptional()
  @IsObject()
  household_payload?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;
}

export class UpdatePreEnrollmentHouseholdDto {
  @IsOptional()
  @IsUUID()
  site_id?: string;

  @IsOptional()
  @IsIn([
    'draft',
    'submitted',
    'in_review',
    'needs_info',
    'approved',
    'rejected',
    'converted',
    'cancelled',
    'archived',
  ])
  status?:
    | 'draft'
    | 'submitted'
    | 'in_review'
    | 'needs_info'
    | 'approved'
    | 'rejected'
    | 'converted'
    | 'cancelled'
    | 'archived';

  @IsOptional()
  @IsEmail()
  primary_email?: string;

  @IsOptional()
  @IsString()
  primary_phone?: string;

  @IsOptional()
  @IsObject()
  household_payload?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;
}

export class SubmitHouseholdDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
