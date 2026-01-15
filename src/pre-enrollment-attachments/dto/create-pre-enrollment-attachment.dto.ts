import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsInt,
  IsObject,
  Min,
} from 'class-validator';

export class CreatePreEnrollmentAttachmentDto {
  @IsUUID()
  school_id: string;

  @IsUUID()
  household_id: string;

  @IsOptional()
  @IsUUID()
  application_id?: string;

  @IsOptional()
  @IsUUID()
  person_id?: string;

  @IsIn([
    'birth_certificate',
    'id_document',
    'cpf',
    'proof_of_address',
    'photo',
    'vaccination_card',
    'medical_report',
    'other',
  ])
  category:
    | 'birth_certificate'
    | 'id_document'
    | 'cpf'
    | 'proof_of_address'
    | 'photo'
    | 'vaccination_card'
    | 'medical_report'
    | 'other';

  @IsString()
  file_path: string;

  @IsOptional()
  @IsString()
  file_name?: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  size_bytes?: number;

  @IsOptional()
  @IsString()
  checksum_sha256?: string;

  @IsOptional()
  @IsIn(['public', 'user', 'system'])
  uploaded_by_type?: 'public' | 'user' | 'system';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
