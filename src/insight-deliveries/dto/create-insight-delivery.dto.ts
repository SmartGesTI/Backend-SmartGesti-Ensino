import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  IsDateString,
  IsEmail,
} from 'class-validator';

export class CreateInsightDeliveryDto {
  @IsUUID()
  insight_instance_id: string;

  @IsIn(['email', 'push', 'sms', 'whatsapp', 'in_app'])
  channel: 'email' | 'push' | 'sms' | 'whatsapp' | 'in_app';

  @IsOptional()
  @IsUUID()
  recipient_id?: string;

  @IsOptional()
  @IsEmail()
  recipient_email?: string;

  @IsOptional()
  @IsString()
  recipient_phone?: string;

  @IsOptional()
  @IsDateString()
  scheduled_for?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateDeliveryStatusDto {
  @IsIn(['pending', 'sent', 'delivered', 'failed', 'read'])
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

  @IsOptional()
  @IsString()
  error_message?: string;
}
