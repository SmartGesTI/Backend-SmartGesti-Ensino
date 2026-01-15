import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsBoolean,
  IsObject,
  IsDateString,
} from 'class-validator';

export class CreatePreEnrollmentConsentDto {
  @IsUUID()
  school_id: string;

  @IsUUID()
  household_id: string;

  @IsOptional()
  @IsUUID()
  application_id?: string;

  @IsOptional()
  @IsUUID()
  guardian_person_id?: string;

  @IsIn([
    'lgpd_data_processing',
    'terms_of_service',
    'privacy_policy',
    'communication_opt_in',
  ])
  consent_type:
    | 'lgpd_data_processing'
    | 'terms_of_service'
    | 'privacy_policy'
    | 'communication_opt_in';

  @IsBoolean()
  consented: boolean;

  @IsOptional()
  @IsDateString()
  consented_at?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  user_agent?: string;

  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;
}
