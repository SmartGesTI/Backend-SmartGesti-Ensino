import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  IsDateString,
} from 'class-validator';

export class CreateConsentDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsOptional()
  @IsUUID()
  guardian_id?: string;

  @IsOptional()
  @IsUUID()
  student_id?: string;

  @IsIn([
    'data_processing',
    'data_sharing',
    'communication',
    'media_use',
    'pickup_authorization',
  ])
  consent_type:
    | 'data_processing'
    | 'data_sharing'
    | 'communication'
    | 'media_use'
    | 'pickup_authorization';

  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  given_at?: string;
}

export class RevokeConsentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
