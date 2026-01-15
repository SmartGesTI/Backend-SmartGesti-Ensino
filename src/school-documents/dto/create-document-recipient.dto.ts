import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsBoolean,
  IsEmail,
  IsObject,
} from 'class-validator';

export class CreateDocumentRecipientDto {
  @IsIn(['guardian', 'student', 'staff', 'external'])
  recipient_type: 'guardian' | 'student' | 'staff' | 'external';

  @IsOptional()
  @IsUUID()
  guardian_id?: string;

  @IsOptional()
  @IsUUID()
  student_id?: string;

  @IsOptional()
  @IsUUID()
  staff_school_profile_id?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsString()
  recipient_name?: string;

  @IsOptional()
  @IsEmail()
  recipient_email?: string;

  @IsOptional()
  @IsString()
  recipient_phone?: string;

  @IsOptional()
  @IsIn(['in_app', 'email', 'sms', 'whatsapp', 'printed', 'handed'])
  delivery_channel?:
    | 'in_app'
    | 'email'
    | 'sms'
    | 'whatsapp'
    | 'printed'
    | 'handed';

  @IsOptional()
  @IsBoolean()
  acknowledgement_required?: boolean;

  @IsOptional()
  @IsUUID()
  consent_id?: string;
}

export class UpdateDocumentRecipientDto {
  @IsOptional()
  @IsIn(['in_app', 'email', 'sms', 'whatsapp', 'printed', 'handed'])
  delivery_channel?:
    | 'in_app'
    | 'email'
    | 'sms'
    | 'whatsapp'
    | 'printed'
    | 'handed';

  @IsOptional()
  @IsBoolean()
  acknowledgement_required?: boolean;
}

export class DeliverRecipientDto {
  @IsOptional()
  @IsObject()
  delivery_metadata?: Record<string, unknown>;
}

export class AcknowledgeRecipientDto {
  @IsIn(['clickwrap', 'digital_signature', 'in_person', 'other'])
  ack_method: 'clickwrap' | 'digital_signature' | 'in_person' | 'other';

  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;
}
